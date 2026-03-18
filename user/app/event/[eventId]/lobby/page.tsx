'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '../../../../lib/api';
import { getUserSocket, disconnectSocket } from '../../../../lib/socket';
import styles from './lobby.module.css';

export default function LobbyPage() {
  const router = useRouter();
  const { eventId } = useParams<{ eventId: string }>();

  const [user, setUser] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [eventEnded, setEventEnded] = useState(false);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('user_token');
    const stored = localStorage.getItem('nm_user');

    if (!token || !stored) {
      router.replace(`/join/${eventId}`);
      return;
    }

    setUser(JSON.parse(stored));

    api.getEventPublic(eventId)
      .then((e) => {
        setEvent(e);
        if (e.status === 'active') router.replace(`/event/${eventId}/match`);
        if (e.status === 'ended') setEventEnded(true);
      })
      .catch(() => router.replace(`/join/${eventId}`));

    const socket = getUserSocket(token);
    socketRef.current = socket;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    socket.on('connect', () => socket.emit('join_event', { eventId }));

    socket.on('participant_count', ({ count }: { count: number }) => {
      setParticipantCount(count);
    });

    socket.on('event_state', ({ status: s }: any) => {
      if (s === 'active') router.replace(`/event/${eventId}/match`);
      if (s === 'ended') setEventEnded(true);
    });

    socket.on('round_started', () => router.replace(`/event/${eventId}/match`));
    socket.on('match_assigned', () => router.replace(`/event/${eventId}/match`));
    socket.on('event_ended', () => setEventEnded(true));

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      socket.off('connect');
      socket.off('participant_count');
      socket.off('event_state');
      socket.off('round_started');
      socket.off('match_assigned');
      socket.off('event_ended');
    };
  }, [eventId, router]);

  const handleLeave = () => {
    disconnectSocket();
    localStorage.removeItem('user_token');
    localStorage.removeItem('nm_user');
    localStorage.removeItem('nm_event_id');
    router.push('/');
  };

  const handleEditProfile = () => {
    // Navigate to join page — pre-fill logic will handle showing existing data
    router.push(`/join/${eventId}`);
  };

  if (eventEnded) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.logo}>N</div>
            <span className={styles.eventName}>{event?.name || 'Event'}</span>
          </div>
        </div>
        <div className={styles.content}>
          <div className={styles.endedIcon}>🎉</div>
          <h1 className={styles.title}>This event has ended</h1>
          <p className={styles.subtitle}>
            Thanks for joining{event?.name ? ` ${event.name}` : ''}! Hope you made some great connections.
          </p>
          <button className="btn-primary" style={{ marginTop: 24 }} onClick={() => router.push('/connections')}>
            View My Connections
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>N</div>
          <span className={styles.eventName}>{event?.name || 'Event Lobby'}</span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.actionBtn} onClick={handleEditProfile} title="Edit profile">
            ✏️ Edit Profile
          </button>
          <button className={styles.actionBtn} onClick={() => router.push('/connections')} title="My connections">
            🤝 Connections
          </button>
          <button className={styles.leaveBtn} onClick={() => setShowLeaveConfirm(true)} title="Leave event">
            Leave
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.pulseRing}>
          <div className={styles.pulseInner}>
            <span className={styles.userInitial}>{user?.name?.charAt(0) || '?'}</span>
          </div>
        </div>

        <h1 className={styles.title}>You're in!</h1>
        <p className={styles.subtitle}>
          Waiting for the host to start the first round...
        </p>

        <div className={styles.infoCards}>
          <div className={styles.infoCard}>
            <span className={styles.infoNum}>{participantCount || '...'}</span>
            <span className={styles.infoLabel}>People joined</span>
          </div>
          <div className={styles.infoCard}>
            <span className={styles.infoNum}>{event ? `${Math.floor(event.duration_per_round / 60)}m` : '...'}</span>
            <span className={styles.infoLabel}>Per round</span>
          </div>
        </div>

        <div className={styles.waitingAnim}>
          <span /><span /><span />
        </div>
        <p className={styles.waitingText}>Waiting for round to start</p>

        {user && (
          <div className={styles.yourProfile}>
            <h3>Your profile</h3>
            <div className={styles.profileName}>{user.name}</div>
            {user.role && <div className={styles.profileRole}>{user.role}{user.company ? ` @ ${user.company}` : ''}</div>}
          </div>
        )}
      </div>

      {/* Leave confirmation */}
      {showLeaveConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Leave Event?</h3>
            <p className={styles.modalDesc}>
              You'll be marked as inactive and skipped in future rounds. You can come back anytime by scanning the QR code or reopening the link — your profile is saved.
            </p>
            <div className={styles.modalActions}>
              <button className="btn-secondary" onClick={() => setShowLeaveConfirm(false)}>
                Stay
              </button>
              <button className={styles.modalLeaveBtn} onClick={handleLeave}>
                Leave Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
