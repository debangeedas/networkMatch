const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');
const { adminAuth, userAuth } = require('../middleware/auth');
const { runMatchingAlgorithm } = require('../matching/algorithm');

const router = express.Router();

// POST /api/events — Create event (admin)
router.post('/', adminAuth, async (req, res) => {
  const { name, description, duration_per_round } = req.body;
  if (!name) return res.status(400).json({ error: 'Event name required' });

  try {
    const result = await db.query(
      'INSERT INTO events (name, description, duration_per_round, admin_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description || null, duration_per_round || 300, req.admin.id, 'pending']
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events — List events (admin)
router.get('/', adminAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT e.*, COUNT(ep.id) as participant_count FROM events e LEFT JOIN event_participants ep ON ep.event_id = e.id WHERE e.admin_id = $1 GROUP BY e.id ORDER BY e.created_at DESC',
      [req.admin.id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:id — Get event details (admin)
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const eventResult = await db.query('SELECT * FROM events WHERE id = $1 AND admin_id = $2', [
      req.params.id,
      req.admin.id,
    ]);
    if (eventResult.rows.length === 0) return res.status(404).json({ error: 'Event not found' });

    const event = eventResult.rows[0];

    const participantsResult = await db.query(
      `SELECT u.id, u.name, u.role, u.company, u.linkedin, u.looking_for, u.offering, u.interests, ep.joined_at, ep.is_active
       FROM event_participants ep JOIN users u ON u.id = ep.user_id
       WHERE ep.event_id = $1 ORDER BY ep.is_active DESC, ep.joined_at ASC`,
      [req.params.id]
    );

    return res.json({ event, participants: participantsResult.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/events/:id — Update event name/duration/description (admin)
router.put('/:id', adminAuth, async (req, res) => {
  const { name, description, duration_per_round } = req.body;
  try {
    const result = await db.query(
      `UPDATE events SET
        name = COALESCE($1, name),
        description = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE description END,
        duration_per_round = COALESCE($3, duration_per_round)
       WHERE id = $4 AND admin_id = $5 RETURNING *`,
      [name || null, description !== undefined ? description : null, duration_per_round || null, req.params.id, req.admin.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/events/:id — Delete event (admin)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM events WHERE id = $1 AND admin_id = $2 RETURNING id',
      [req.params.id, req.admin.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:id/qr — Generate QR code (admin)
router.get('/:id/qr', adminAuth, async (req, res) => {
  try {
    const eventResult = await db.query('SELECT * FROM events WHERE id = $1 AND admin_id = $2', [
      req.params.id,
      req.admin.id,
    ]);
    if (eventResult.rows.length === 0) return res.status(404).json({ error: 'Event not found' });

    const joinUrl = `${process.env.CLIENT_USER_URL}/join/${req.params.id}`;
    const qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 400, margin: 2 });

    return res.json({ qr: qrDataUrl, joinUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:id/public — Get event info for users (no auth, for join flow)
router.get('/:id/public', async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, status, duration_per_round, current_round FROM events WHERE id = $1', [
      req.params.id,
    ]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });

    // description is fetched separately so a missing column (pre-migration) never 500s this endpoint
    let description = null;
    try {
      const descResult = await db.query('SELECT description FROM events WHERE id = $1', [req.params.id]);
      description = descResult.rows[0]?.description ?? null;
    } catch {}

    return res.json({ ...result.rows[0], description });
  } catch (err) {
    console.error('[GET /public] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:id/matches — Get current round matches (user)
router.get('/:id/my-match', userAuth, async (req, res) => {
  try {
    const eventResult = await db.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (eventResult.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const event = eventResult.rows[0];

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
      [req.params.id, event.current_round, req.user.id]
    );

    if (matchResult.rows.length === 0) return res.json({ match: null });

    const m = matchResult.rows[0];
    // Determine "the other person" from requester's perspective
    const myId = req.user.id;
    const matches = [];

    if (m.user1_id !== myId) {
      matches.push({ id: m.user1_id, name: m.u1_name, role: m.u1_role, company: m.u1_company, linkedin: m.u1_linkedin, looking_for: m.u1_looking_for, offering: m.u1_offering, interests: m.u1_interests });
    }
    if (m.user2_id !== myId) {
      matches.push({ id: m.user2_id, name: m.u2_name, role: m.u2_role, company: m.u2_company, linkedin: m.u2_linkedin, looking_for: m.u2_looking_for, offering: m.u2_offering, interests: m.u2_interests });
    }
    if (m.user3_id && m.user3_id !== myId) {
      matches.push({ id: m.user3_id, name: m.u3_name, role: m.u3_role, company: m.u3_company, linkedin: m.u3_linkedin });
    }

    return res.json({
      match: {
        id: m.id,
        round_number: m.round_number,
        reason: m.reason,
        conversation_starter: m.conversation_starter,
        matched_users: matches,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events/:id/save-connection — Save a connection (user)
router.post('/:id/save-connection', userAuth, async (req, res) => {
  const { connected_user_id, match_id } = req.body;
  if (!connected_user_id) return res.status(400).json({ error: 'connected_user_id required' });

  try {
    await db.query(
      `INSERT INTO saved_connections (user_id, connected_user_id, event_id, match_id)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [req.user.id, connected_user_id, req.params.id, match_id || null]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:id/rounds — Get round history with match counts (admin)
router.get('/:id/rounds', adminAuth, async (req, res) => {
  try {
    const eventResult = await db.query('SELECT * FROM events WHERE id = $1 AND admin_id = $2', [
      req.params.id,
      req.admin.id,
    ]);
    if (eventResult.rows.length === 0) return res.status(404).json({ error: 'Event not found' });

    const result = await db.query(
      `SELECT round_number, COUNT(*) as match_count
       FROM matches WHERE event_id = $1
       GROUP BY round_number ORDER BY round_number ASC`,
      [req.params.id]
    );
    return res.json(result.rows.map(r => ({ round_number: Number(r.round_number), match_count: Number(r.match_count) })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/:id/saved-connections — Get user's saved connections (user)
router.get('/:id/saved-connections', userAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.role, u.company, u.linkedin, sc.saved_at
       FROM saved_connections sc JOIN users u ON u.id = sc.connected_user_id
       WHERE sc.user_id = $1 AND sc.event_id = $2`,
      [req.user.id, req.params.id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
