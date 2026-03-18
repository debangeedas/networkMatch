'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '../../../../lib/api';
import { getUserSocket, disconnectSocket } from '../../../../lib/socket';
import MatchCard from '../../../../components/MatchCard';
import TimerRing from '../../../../components/TimerRing';
import RoundEndOverlay from '../../../../components/RoundEndOverlay';
import styles from './match.module.css';

export default function MatchPage() {
  const router = useRouter();
  const { eventId } = useParams<{ eventId: string }>();

  const [user, setUser] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [timer, setTimer] = useState<{ remaining: number; total: number } | null>(null);
  const [roundEnded, setRoundEnded] = useState(false);
  const [roundEndMsg, setRoundEndMsg] = useState('');
  const [eventEnded, setEventEnded] = useState(false);
  const [savedConnections, setSavedConnections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected'>('connected');

  // Menu state
  const [showMenu, setShowMenu] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const socketRef = useRef<any>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('user_token');
    const stored = localStorage.getItem('nm_user');

    if (!token || !stored) {
      router.replace(`/join/${eventId}`);
      return;
    }

    setUser(JSON.parse(stored));

    Promise.all([
      api.getEventPublic(eventId),
      api.getMyMatch(eventId),
    ]).then(([evt, matchData]) => {
      setEvent(evt);
      setMatch(matchData.match);
      setLoading(false);
    }).catch(() => setLoading(false));

    const socket = getUserSocket(token);
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketStatus('connected');
      socket.emit('join_event', { eventId });
    });
    socket.on('disconnect', () => setSocketStatus('disconnected'));

    socket.on('event_state', ({ status, timer: t }: any) => {
      if (t) setTimer(t);
      if (status === 'waiting') setRoundEnded(true);
      if (status === 'ended') setEventEnded(true);
    });

    socket.on('event_ended', () => {
      setEventEnded(true);
      setRoundEnded(false);
      setTimer(null);
    });

    socket.on('match_assigned', (data: any) => {
      setMatch(data);
      setRoundEnded(false);
      setTimer(null);
    });

    socket.on('timer_tick', ({ remaining, total }: any) => {
      setTimer({ remaining, total });
    });

    socket.on('round_started', ({ round_number, duration }: any) => {
      setRoundEnded(false);
      setTimer({ remaining: duration, total: duration });
    });

    socket.on('round_ended', ({ message }: any) => {
      setRoundEnded(true);
      setRoundEndMsg(message || 'Round has ended!');
      setTimer(null);
    });

    socket.on('error', ({ message }: any) => setError(message));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('event_state');
      socket.off('match_assigned');
      socket.off('timer_tick');
      socket.off('round_started');
      socket.off('round_ended');
      socket.off('event_ended');
      socket.off('error');
    };
  }, [eventId, router]);

  // Warn before closing/refreshing the tab
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleSaveConnection = async (connectedUserId: string) => {
    try {
      await api.saveConnection(eventId, {
        connected_user_id: connectedUserId,
        match_id: match?.match_id,
      });
      setSavedConnections((prev) => { const next = new Set(prev); next.add(connectedUserId); return next; });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGetLinkedIn = async (toUser: any) => {
    try {
      const res = await api.getLinkedInMessage(toUser.id, match?.reason || '');
      return res.message;
    } catch {
      return `Hi ${toUser.name}, great connecting with you at the event! Let's stay in touch.`;
    }
  };

  const handleLeave = () => {
    disconnectSocket();
    localStorage.removeItem('user_token');
    localStorage.removeItem('nm_user');
    localStorage.removeItem('nm_event_id');
    router.push('/');
  };

  const handleEditProfile = () => {
    setShowMenu(false);
    router.push(`/join/${eventId}`);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingText}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
          <p>Finding your match...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.logo}>N</div>
          <div>
            <div className={styles.eventName}>{event?.name}</div>
            <div className={styles.roundLabel}>
              {event?.description
                ? event.description
                : `Round ${event?.current_round || match?.round_number || '—'}`}
            </div>
          </div>
        </div>
        <div className={styles.headerRight}>
          {savedConnections.size > 0 && (
            <button className={styles.savedCounter} onClick={() => router.push('/connections')}>
              {savedConnections.size} saved
            </button>
          )}

          {/* Connection status dot */}
          <div className={styles.connStatus} data-connected={socketStatus === 'connected' ? 'true' : 'false'} title={socketStatus === 'connected' ? 'Connected' : 'Disconnected'}>
            <span className={styles.connDot} />
          </div>

          {timer && <TimerRing remaining={timer.remaining} total={timer.total} />}

          {/* ⋯ menu */}
          <div className={styles.menuWrapper} ref={menuRef}>
            <button className={styles.menuBtn} onClick={() => setShowMenu(!showMenu)} aria-label="More options">
              ⋯
            </button>
            {showMenu && (
              <div className={styles.dropdown}>
                <button className={styles.dropdownItem} onClick={handleEditProfile}>
                  ✏️ Edit Profile
                </button>
                <button className={styles.dropdownItem} onClick={() => { setShowMenu(false); router.push('/connections'); }}>
                  🤝 My Connections
                </button>
                <button
                  className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                  onClick={() => { setShowMenu(false); setShowLeaveConfirm(true); }}
                >
                  🚪 Leave Event
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Intent chip row */}
      {user && (() => {
        const chips = [
          ...(user.looking_for || []).slice(0, 2),
          ...(user.interests || []).slice(0, 2),
        ].slice(0, 4);
        return chips.length > 0 ? (
          <div className={styles.intentRow}>
            <span className={styles.intentLabel}>You're here for</span>
            {chips.map((chip: string) => (
              <span key={chip} className={styles.intentChip}>{chip}</span>
            ))}
          </div>
        ) : null;
      })()}

      <div className={styles.content}>
        {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}

        {socketStatus === 'disconnected' && (
          <div className={styles.disconnectBanner}>
            ⚠️ Connection lost — trying to reconnect...
          </div>
        )}

        {!match ? (
          <div className={styles.noMatch}>
            <div className={styles.noMatchIcon}>⏳</div>
            <h2>Waiting for your match</h2>
            <p>The host is setting up this round. Hang tight!</p>
          </div>
        ) : (
          <div className={styles.matchContainer}>
            <div className={styles.matchHeader}>
              <h2 className={styles.matchTitle}>Your Match{match.matched_users?.length > 1 ? 'es' : ''}</h2>
              {match.round_number && (
                <span className={styles.roundBadge}>Round {match.round_number}</span>
              )}
            </div>

            {match.matched_users?.map((matchedUser: any) => (
              <MatchCard
                key={matchedUser.id}
                matchedUser={matchedUser}
                reason={match.reason}
                conversationStarter={match.conversation_starter}
                isSaved={savedConnections.has(matchedUser.id)}
                onSave={() => handleSaveConnection(matchedUser.id)}
                onGetLinkedIn={() => handleGetLinkedIn(matchedUser)}
              />
            ))}

            {(!match.matched_users || match.matched_users.length === 0) && (
              <div className={styles.noMatch}>
                <p>No match assigned for this round yet.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event Ended Screen */}
      {eventEnded && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.eventEndedIcon}>🎉</div>
            <h3 className={styles.modalTitle}>Event Has Ended</h3>
            <p className={styles.modalDesc}>
              Thanks for joining! Check out the connections you made tonight.
            </p>
            <div className={styles.modalActions}>
              <button className="btn-primary" onClick={() => router.push('/connections')}>
                View My Connections
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Round End Overlay */}
      {roundEnded && (
        <RoundEndOverlay
          message={roundEndMsg}
          match={match}
          savedConnections={savedConnections}
          onSave={handleSaveConnection}
          onGetLinkedIn={handleGetLinkedIn}
          onDismiss={() => setRoundEnded(false)}
          onGoToLobby={() => {
            setRoundEnded(false);
            router.push(`/event/${eventId}/lobby`);
          }}
        />
      )}

      {/* Leave confirmation */}
      {showLeaveConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Leave Event?</h3>
            <p className={styles.modalDesc}>
              {roundEnded
                ? "You'll be marked as inactive and removed from future rounds. You can come back anytime by scanning the QR code or reopening the link — your profile is saved."
                : "A round is currently in progress. Leaving will mark you as inactive and your match won't be notified. You can rejoin anytime using the QR code or link."}
            </p>
            <div className={styles.modalActions}>
              <button className="btn-secondary" onClick={() => setShowLeaveConfirm(false)}>
                Stay
              </button>
              <button className={styles.leaveConfirmBtn} onClick={handleLeave}>
                Leave Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
