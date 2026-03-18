'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import { getAdminSocket } from '../../../../lib/socket';
import QRDisplay from '../../../../components/QRDisplay';
import ParticipantList from '../../../../components/ParticipantList';
import styles from './control.module.css';

const DURATION_OPTIONS = [
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
  { label: '7 min', value: 420 },
  { label: '10 min', value: 600 },
  { label: '15 min', value: 900 },
];

export default function EventControlPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [event, setEvent] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [qrData, setQrData] = useState<{ qr: string; joinUrl: string } | null>(null);
  const [rounds, setRounds] = useState<{ round_number: number; match_count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [timer, setTimer] = useState<{ remaining: number; total: number } | null>(null);
  const [roundStatus, setRoundStatus] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<'participants' | 'qr'>('participants');

  // Modals
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showEndEventConfirm, setShowEndEventConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', duration_per_round: 300 });
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const socketRef = useRef<any>(null);

  const loadRounds = useCallback(async () => {
    try {
      const data = await api.getRounds(id);
      setRounds(data);
    } catch {}
  }, [id]);

  const loadEvent = useCallback(async () => {
    try {
      const data = await api.getEvent(id);
      setEvent(data.event);
      setParticipants(data.participants);
      setEditForm({ name: data.event.name, description: data.event.description || '', duration_per_round: data.event.duration_per_round });
    } catch (err: any) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.replace('/login'); return; }

    Promise.all([loadEvent(), loadRounds()]).then(() => setLoading(false));
    api.getQR(id).then(setQrData).catch(() => {});

    const socket = getAdminSocket(token);
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketStatus('connected');
      socket.emit('join_event', { eventId: id });
    });
    socket.on('disconnect', () => setSocketStatus('disconnected'));
    socket.on('connect_error', () => setSocketStatus('disconnected'));

    socket.on('participant_count', () => {
      api.getEvent(id).then((d) => setParticipants(d.participants)).catch(() => {});
    });

    socket.on('round_started', ({ round_number }: any) => {
      setEvent((prev: any) => prev ? { ...prev, status: 'active', current_round: round_number } : prev);
      setRoundStatus(`Round ${round_number} started!`);
      setActionLoading(false);
      setTimeout(() => setRoundStatus(''), 3000);
    });

    socket.on('round_ended', ({ message }: any) => {
      setEvent((prev: any) => prev ? { ...prev, status: 'waiting' } : prev);
      setTimer(null);
      setRoundStatus(message);
      setActionLoading(false);
      loadRounds();
      setTimeout(() => setRoundStatus(''), 4000);
    });

    socket.on('event_ended', () => {
      setEvent((prev: any) => prev ? { ...prev, status: 'ended' } : prev);
      setTimer(null);
      setActionLoading(false);
    });

    socket.on('timer_tick', ({ remaining, total }: any) => {
      setTimer({ remaining, total });
    });

    socket.on('event_state', (state: any) => {
      if (state.timer) setTimer(state.timer);
    });

    socket.on('error', ({ message }: any) => {
      setError(message);
      setActionLoading(false);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('participant_count');
      socket.off('round_started');
      socket.off('round_ended');
      socket.off('event_ended');
      socket.off('timer_tick');
      socket.off('event_state');
      socket.off('error');
    };
  }, [id, router, loadEvent, loadRounds]);

  const handleStartRound = () => {
    if (!socketRef.current) return;
    setActionLoading(true);
    setError('');
    socketRef.current.emit('start_round', { eventId: id });
  };

  const handleEndRoundConfirmed = () => {
    if (!socketRef.current) return;
    setShowEndConfirm(false);
    setActionLoading(true);
    setError('');
    socketRef.current.emit('end_round', { eventId: id });
  };

  const handleEndEventConfirmed = () => {
    if (!socketRef.current) return;
    setShowEndEventConfirm(false);
    setActionLoading(true);
    setError('');
    socketRef.current.emit('end_event', { eventId: id });
  };

  const handleSaveEdit = async () => {
    if (!editForm.name.trim()) return;
    setEditLoading(true);
    try {
      const updated = await api.updateEvent(id, editForm);
      setEvent((prev: any) => ({ ...prev, ...updated }));
      setShowEditModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.deleteEvent(id);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message);
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDrawerButton = (view: 'participants' | 'qr') => {
    if (!drawerOpen) {
      setDrawerView(view);
      setDrawerOpen(true);
    } else if (drawerView === view) {
      setDrawerOpen(false);
    } else {
      setDrawerView(view);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const timerPercent = timer ? (timer.remaining / timer.total) * 100 : 100;
  const isActive = event?.status === 'active';
  const isEnded = event?.status === 'ended';
  const activeParticipants = participants.filter((p) => p.is_active);
  const estimatedPairs = Math.floor(activeParticipants.length / 2);

  if (loading) return <div className={styles.loadingPage}><span className="spinner" /></div>;

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/dashboard" className={styles.back}>← Events</Link>
          <h1 className={styles.eventName}>{event?.name}</h1>
          {event && <span className={`badge badge-${event.status}`}>{event.status}</span>}
          <button className={styles.editNameBtn} onClick={() => setShowEditModal(true)} title="Edit event">
            ✏️
          </button>
        </div>
        <div className={styles.headerRight}>
          <button
            className={`${styles.headerBtn} ${drawerOpen && drawerView === 'participants' ? styles.headerBtnActive : ''}`}
            onClick={() => handleDrawerButton('participants')}
          >
            👥 {participants.length}
          </button>
          <button
            className={`${styles.headerBtn} ${drawerOpen && drawerView === 'qr' ? styles.headerBtnActive : ''}`}
            onClick={() => handleDrawerButton('qr')}
          >
            QR
          </button>
          <button className={styles.deleteEventBtn} onClick={() => setShowDeleteConfirm(true)}>
            🗑
          </button>
          <div className={styles.socketBadge} data-status={socketStatus}>
            <span className={styles.socketDot} />
            {socketStatus === 'connected' ? 'Live' : socketStatus === 'connecting' ? 'Connecting…' : 'Disconnected'}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className={styles.content}>

        {/* Hero Control Card */}
        <div className={`${styles.heroCard} ${isActive ? styles.heroCardActive : ''}`}>
          <div className={styles.heroLeft}>
            <div className={styles.heroLabel}>
              {isActive
                ? `ROUND ${event?.current_round} — IN PROGRESS`
                : event?.current_round
                ? `ROUND ${event.current_round} ENDED`
                : 'READY TO START'}
              {isActive && <span className={styles.livePill}>● LIVE</span>}
            </div>
            <div className={styles.timerDisplay} data-urgent={timer && timer.remaining <= 30 ? 'true' : 'false'}>
              {timer ? formatTime(timer.remaining) : '--:--'}
            </div>
            {timer && (
              <div className={styles.timerBar}>
                <div
                  className={styles.timerProgress}
                  style={{
                    width: `${timerPercent}%`,
                    background: timerPercent < 20 ? 'var(--danger)' : timerPercent < 50 ? 'var(--warning)' : 'var(--accent)',
                  }}
                />
              </div>
            )}
            {roundStatus && <p className={styles.roundStatus}>{roundStatus}</p>}
          </div>

          <div className={styles.heroRight}>
            {isEnded ? (
              <div className={styles.eventEndedMsg}>
                This event has ended. All rounds are complete.
              </div>
            ) : (
              <>
                <div className={styles.roundButtons}>
                  <button
                    className="btn-primary"
                    onClick={handleStartRound}
                    disabled={actionLoading || activeParticipants.length < 2}
                  >
                    {actionLoading && !isActive ? <span className="spinner" /> : `▶ Start Round ${(event?.current_round || 0) + 1}`}
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => setShowEndConfirm(true)}
                    disabled={actionLoading || !isActive}
                  >
                    ■ End Round
                  </button>
                </div>
                <p className={styles.hintText}>
                  {activeParticipants.length < 2
                    ? `Need 2+ active participants to start (${participants.length} joined, ${activeParticipants.length} active)`
                    : isActive
                    ? 'End early or let the timer run out'
                    : `${activeParticipants.length} active · ${participants.length} total`}
                </p>
                <button
                  className={styles.endEventBtn}
                  onClick={() => setShowEndEventConfirm(true)}
                  disabled={actionLoading}
                >
                  ⏹ End Event
                </button>
              </>
            )}
            {error && <p className="error-msg" style={{ marginTop: 8 }}>{error}</p>}
          </div>
        </div>

        {/* Stats Row */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{activeParticipants.length}</span>
            <span className={styles.statLabel}>Active</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{rounds.length}</span>
            <span className={styles.statLabel}>Rounds</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{Math.floor((event?.duration_per_round || 0) / 60)}m</span>
            <span className={styles.statLabel}>/ Round</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{estimatedPairs}</span>
            <span className={styles.statLabel}>Pairs</span>
          </div>
        </div>

        {/* Round History */}
        <div className={styles.historySection}>
          <h2 className={styles.historyTitle}>Round History</h2>
          <div className={styles.historyDivider} />
          {rounds.length === 0 && !isActive && (
            <p className={styles.historyEmpty}>No rounds yet — start the first round above.</p>
          )}
          {rounds.map((r) => (
            <div key={r.round_number} className={styles.historyRow}>
              <span className={styles.historyRound}>Round {r.round_number}</span>
              <span className={styles.historyDot}>·</span>
              <span className={styles.historyMatches}>{r.match_count} {r.match_count === 1 ? 'match' : 'matches'}</span>
              <span className={styles.historyDot}>·</span>
              <span className={styles.historyDuration}>{Math.floor((event?.duration_per_round || 0) / 60)}m {(event?.duration_per_round || 0) % 60 > 0 ? `${(event?.duration_per_round || 0) % 60}s` : ''}</span>
            </div>
          ))}
          {isActive && (
            <div className={`${styles.historyRow} ${styles.historyRowActive}`}>
              <span className={styles.historyRound}>Round {event?.current_round}</span>
              <span className={styles.historyDot}>·</span>
              <span className={styles.historyInProgress}>In progress</span>
            </div>
          )}
        </div>
      </div>

      {/* Drawer Backdrop */}
      {drawerOpen && (
        <div className={styles.drawerBackdrop} onClick={() => setDrawerOpen(false)} />
      )}

      {/* Drawer */}
      <div className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTabs}>
            <button
              className={`${styles.drawerTab} ${drawerView === 'participants' ? styles.drawerTabActive : ''}`}
              onClick={() => setDrawerView('participants')}
            >
              👥 Participants
            </button>
            <button
              className={`${styles.drawerTab} ${drawerView === 'qr' ? styles.drawerTabActive : ''}`}
              onClick={() => setDrawerView('qr')}
            >
              QR Code
            </button>
          </div>
          <button className={styles.drawerClose} onClick={() => setDrawerOpen(false)}>✕</button>
        </div>
        <div className={styles.drawerBody}>
          {drawerView === 'participants' && (
            <ParticipantList participants={participants} />
          )}
          {drawerView === 'qr' && (
            qrData
              ? <QRDisplay qr={qrData.qr} joinUrl={qrData.joinUrl} />
              : <div className={styles.center}><span className="spinner" /></div>
          )}
        </div>
      </div>

      {/* End Round Confirmation */}
      {showEndConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>End Round Early?</h3>
            <p className={styles.modalDesc}>
              This will immediately end the current round for all participants. They'll see the round-end screen and have a chance to save connections.
            </p>
            <div className={styles.modalActions}>
              <button className="btn-secondary" onClick={() => setShowEndConfirm(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleEndRoundConfirmed}>End Round Now</button>
            </div>
          </div>
        </div>
      )}

      {/* End Event Confirmation */}
      {showEndEventConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>End This Event?</h3>
            <p className={styles.modalDesc}>
              This will close the event for all participants — they'll see an "event ended" screen and be directed to their saved connections. No more rounds can be started after this.
            </p>
            <div className={styles.modalActions}>
              <button className="btn-secondary" onClick={() => setShowEndEventConfirm(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleEndEventConfirmed}>End Event</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Event Confirmation */}
      {showDeleteConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Delete This Event?</h3>
            <p className={styles.modalDesc}>
              <strong>"{event?.name}"</strong> and all its participants, rounds, and match history will be permanently deleted. This cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? <span className="spinner" /> : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {showEditModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Edit Event</h3>
            <div className={styles.editField}>
              <label>Event Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className={styles.editField}>
              <label>Tagline <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(optional)</span></label>
              <input
                type="text"
                placeholder="e.g. Startup founders & investors · SF"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                maxLength={500}
              />
            </div>
            <div className={styles.editField}>
              <label>Duration Per Round</label>
              <div className={styles.durationGrid}>
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles.durationBtn} ${editForm.duration_per_round === opt.value ? styles.durationBtnActive : ''}`}
                    onClick={() => setEditForm({ ...editForm, duration_per_round: opt.value })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.modalActions} style={{ marginTop: 20 }}>
              <button className="btn-secondary" onClick={() => setShowEditModal(false)} disabled={editLoading}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveEdit} disabled={editLoading || !editForm.name.trim()}>
                {editLoading ? <span className="spinner" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
