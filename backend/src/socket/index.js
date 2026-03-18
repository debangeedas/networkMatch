const jwt = require('jsonwebtoken');
const db = require('../db');
const { runMatchingAlgorithm } = require('../matching/algorithm');

/**
 * Active round timers: eventId -> { intervalId, remaining, total }
 */
const activeTimers = new Map();

/**
 * Connected sockets: socketId -> { role, id, eventId }
 */
const socketMeta = new Map();

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function startTimer(io, eventId, durationSeconds) {
  // Clear any existing timer for this event
  stopTimer(eventId);

  let remaining = durationSeconds;
  const total = durationSeconds;

  // Broadcast initial tick immediately
  io.to(`event:${eventId}`).emit('timer_tick', { remaining, total });

  const intervalId = setInterval(async () => {
    remaining -= 1;
    io.to(`event:${eventId}`).emit('timer_tick', { remaining, total });

    if (remaining <= 0) {
      stopTimer(eventId);
      // Auto end the round
      try {
        await db.query("UPDATE events SET status = 'waiting' WHERE id = $1", [eventId]);
      } catch (err) {
        console.error('Auto-end round DB error:', err);
      }
      io.to(`event:${eventId}`).emit('round_ended', { message: "Time's up! Round has ended." });
    }
  }, 1000);

  activeTimers.set(eventId, { intervalId, remaining, total });
}

function stopTimer(eventId) {
  const timer = activeTimers.get(eventId);
  if (timer) {
    clearInterval(timer.intervalId);
    activeTimers.delete(eventId);
  }
}

function getTimerState(eventId) {
  return activeTimers.get(eventId) || null;
}

function setupSocket(io) {
  // Middleware: authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    const payload = verifyToken(token);
    if (!payload) return next(new Error('Invalid token'));

    socket.data.user = payload;
    next();
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    console.log(`[Socket] Connected: ${user.role} ${user.id} (${socket.id})`);

    // --- JOIN EVENT ROOM ---
    socket.on('join_event', async ({ eventId }) => {
      if (!eventId) return;

      try {
        const eventResult = await db.query('SELECT * FROM events WHERE id = $1', [eventId]);
        if (eventResult.rows.length === 0) {
          socket.emit('error', { message: 'Event not found' });
          return;
        }
        const event = eventResult.rows[0];

        // Verify participation for users
        if (user.role === 'user') {
          const partResult = await db.query(
            'SELECT id FROM event_participants WHERE user_id = $1 AND event_id = $2',
            [user.id, eventId]
          );
          if (partResult.rows.length === 0) {
            socket.emit('error', { message: 'Not registered for this event' });
            return;
          }
        }

        // Verify ownership for admins
        if (user.role === 'admin' && event.admin_id !== user.id) {
          socket.emit('error', { message: 'Not your event' });
          return;
        }

        socket.join(`event:${eventId}`);
        socketMeta.set(socket.id, { role: user.role, id: user.id, eventId });

        // Mark user as active in this event
        if (user.role === 'user') {
          await db.query(
            'UPDATE event_participants SET is_active = true WHERE user_id = $1 AND event_id = $2',
            [user.id, eventId]
          );
        }

        // Broadcast active participant count
        const countResult = await db.query(
          `SELECT COUNT(*) as count FROM event_participants WHERE event_id = $1 AND is_active = true`,
          [eventId]
        );
        io.to(`event:${eventId}`).emit('participant_count', {
          count: parseInt(countResult.rows[0].count, 10),
        });

        // Send current event state to the joiner
        const timerState = getTimerState(eventId);
        socket.emit('event_state', {
          status: event.status,
          current_round: event.current_round,
          timer: timerState ? { remaining: timerState.remaining, total: timerState.total } : null,
        });

        // If round is active and user just joined — send their match if available
        if (user.role === 'user' && event.status === 'active') {
          const matchResult = await db.query(
            `SELECT m.*,
              u1.name as u1_name, u1.role as u1_role, u1.company as u1_company, u1.linkedin as u1_linkedin,
              u1.looking_for as u1_looking_for, u1.offering as u1_offering, u1.interests as u1_interests,
              u2.name as u2_name, u2.role as u2_role, u2.company as u2_company, u2.linkedin as u2_linkedin,
              u2.looking_for as u2_looking_for, u2.offering as u2_offering, u2.interests as u2_interests,
              u3.name as u3_name, u3.role as u3_role, u3.company as u3_company, u3.linkedin as u3_linkedin
             FROM matches m
             LEFT JOIN users u1 ON u1.id = m.user1_id
             LEFT JOIN users u2 ON u2.id = m.user2_id
             LEFT JOIN users u3 ON u3.id = m.user3_id
             WHERE m.event_id = $1 AND m.round_number = $2
               AND (m.user1_id = $3 OR m.user2_id = $3 OR m.user3_id = $3)`,
            [eventId, event.current_round, user.id]
          );

          if (matchResult.rows.length > 0) {
            const m = matchResult.rows[0];
            const matchedUsers = buildMatchedUsers(m, user.id);
            socket.emit('match_assigned', {
              match_id: m.id,
              round_number: m.round_number,
              reason: m.reason,
              conversation_starter: m.conversation_starter,
              matched_users: matchedUsers,
            });
          }
        }

        console.log(`[Socket] ${user.role} ${user.id} joined event:${eventId}`);
      } catch (err) {
        console.error('[Socket] join_event error:', err);
        socket.emit('error', { message: 'Failed to join event room' });
      }
    });

    // --- ADMIN: START ROUND ---
    socket.on('start_round', async ({ eventId }) => {
      if (user.role !== 'admin') {
        socket.emit('error', { message: 'Admin only' });
        return;
      }

      try {
        const eventResult = await db.query('SELECT * FROM events WHERE id = $1 AND admin_id = $2', [
          eventId,
          user.id,
        ]);
        if (eventResult.rows.length === 0) {
          socket.emit('error', { message: 'Event not found or not yours' });
          return;
        }
        const event = eventResult.rows[0];
        const nextRound = (event.current_round || 0) + 1;

        // Only match participants who are currently active (connected)
        const participantsResult = await db.query(
          `SELECT u.* FROM event_participants ep JOIN users u ON u.id = ep.user_id
           WHERE ep.event_id = $1 AND ep.is_active = true`,
          [eventId]
        );
        const participants = participantsResult.rows;

        if (participants.length < 2) {
          socket.emit('error', { message: 'Need at least 2 active participants to start a round' });
          return;
        }

        // Get previous matches for this event
        const prevMatchesResult = await db.query(
          'SELECT user1_id, user2_id, user3_id FROM matches WHERE event_id = $1',
          [eventId]
        );

        // Run matching algorithm
        const matchPairs = runMatchingAlgorithm(participants, prevMatchesResult.rows);

        // Store matches in DB
        const insertedMatches = [];
        for (const pair of matchPairs) {
          const insertResult = await db.query(
            `INSERT INTO matches (event_id, round_number, user1_id, user2_id, user3_id, reason, conversation_starter)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
              eventId,
              nextRound,
              pair.user1_id,
              pair.user2_id,
              pair.user3_id || null,
              pair.reason,
              pair.conversation_starter,
            ]
          );
          insertedMatches.push({ ...insertResult.rows[0], ...pair });
        }

        // Update event status
        await db.query("UPDATE events SET status = 'active', current_round = $1 WHERE id = $2", [
          nextRound,
          eventId,
        ]);

        // Notify admin of round start
        io.to(`event:${eventId}`).emit('round_started', {
          round_number: nextRound,
          duration: event.duration_per_round,
        });

        // Send individual match to each user
        for (const match of insertedMatches) {
          const usersInMatch = [
            { id: match.user1_id },
            { id: match.user2_id },
            match.user3_id ? { id: match.user3_id } : null,
          ].filter(Boolean);

          for (const participant of usersInMatch) {
            const participantData = participants.find((p) => p.id === participant.id);
            if (!participantData) continue;

            const matchedUsers = usersInMatch
              .filter((u) => u.id !== participant.id)
              .map((u) => participants.find((p) => p.id === u.id))
              .filter(Boolean)
              .map((u) => ({
                id: u.id,
                name: u.name,
                role: u.role,
                company: u.company,
                linkedin: u.linkedin,
                looking_for: u.looking_for,
                offering: u.offering,
                interests: u.interests,
              }));

            // Emit to all sockets for this user in this event room
            const socketsInRoom = await io.in(`event:${eventId}`).fetchSockets();
            for (const s of socketsInRoom) {
              if (s.data.user?.id === participant.id && s.data.user?.role === 'user') {
                s.emit('match_assigned', {
                  match_id: match.id,
                  round_number: nextRound,
                  reason: match.reason,
                  conversation_starter: match.conversation_starter,
                  matched_users: matchedUsers,
                });
              }
            }
          }
        }

        // Start server-side timer
        startTimer(io, eventId, event.duration_per_round);

        console.log(`[Socket] Round ${nextRound} started for event ${eventId} with ${matchPairs.length} matches`);
      } catch (err) {
        console.error('[Socket] start_round error:', err);
        socket.emit('error', { message: 'Failed to start round' });
      }
    });

    // --- ADMIN: END ROUND ---
    socket.on('end_round', async ({ eventId }) => {
      if (user.role !== 'admin') {
        socket.emit('error', { message: 'Admin only' });
        return;
      }

      try {
        const eventResult = await db.query('SELECT * FROM events WHERE id = $1 AND admin_id = $2', [
          eventId,
          user.id,
        ]);
        if (eventResult.rows.length === 0) {
          socket.emit('error', { message: 'Event not found or not yours' });
          return;
        }

        stopTimer(eventId);
        await db.query("UPDATE events SET status = 'waiting' WHERE id = $1", [eventId]);

        io.to(`event:${eventId}`).emit('round_ended', {
          message: 'Round ended by admin. Great conversations!',
        });

        console.log(`[Socket] Round ended for event ${eventId}`);
      } catch (err) {
        console.error('[Socket] end_round error:', err);
        socket.emit('error', { message: 'Failed to end round' });
      }
    });

    // --- DISCONNECT ---
    socket.on('disconnect', async () => {
      const meta = socketMeta.get(socket.id);
      if (meta) {
        socketMeta.delete(socket.id);

        if (meta.role === 'user' && meta.eventId) {
          try {
            // Only mark inactive if this was their last open tab/connection
            const otherConnections = [...socketMeta.values()].filter(
              (m) => m.id === meta.id && m.eventId === meta.eventId
            );

            if (otherConnections.length === 0) {
              await db.query(
                'UPDATE event_participants SET is_active = false WHERE user_id = $1 AND event_id = $2',
                [meta.id, meta.eventId]
              );
            }

            const countResult = await db.query(
              `SELECT COUNT(*) as count FROM event_participants WHERE event_id = $1 AND is_active = true`,
              [meta.eventId]
            );
            io.to(`event:${meta.eventId}`).emit('participant_count', {
              count: parseInt(countResult.rows[0].count, 10),
            });
          } catch {}
        }
      }
      console.log(`[Socket] Disconnected: ${user.role} ${user.id} (${socket.id})`);
    });
  });
}

function buildMatchedUsers(m, myId) {
  const users = [];
  if (m.user1_id !== myId) {
    users.push({ id: m.user1_id, name: m.u1_name, role: m.u1_role, company: m.u1_company, linkedin: m.u1_linkedin, looking_for: m.u1_looking_for, offering: m.u1_offering, interests: m.u1_interests });
  }
  if (m.user2_id !== myId) {
    users.push({ id: m.user2_id, name: m.u2_name, role: m.u2_role, company: m.u2_company, linkedin: m.u2_linkedin, looking_for: m.u2_looking_for, offering: m.u2_offering, interests: m.u2_interests });
  }
  if (m.user3_id && m.user3_id !== myId) {
    users.push({ id: m.user3_id, name: m.u3_name, role: m.u3_role, company: m.u3_company, linkedin: m.u3_linkedin });
  }
  return users;
}

module.exports = { setupSocket, stopTimer };
