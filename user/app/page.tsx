'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import styles from './page.module.css';

type EventGroup = {
  event_id: string;
  event_name: string;
  event_date: string;
  connections: any[];
};

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<EventGroup[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('user_token');
    const stored = localStorage.getItem('nm_user');

    if (!token || !stored) {
      setLoading(false);
      return;
    }

    setUser(JSON.parse(stored));
    setActiveEventId(localStorage.getItem('nm_event_id'));

    api.getMyConnections()
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('user_token');
    localStorage.removeItem('nm_user');
    localStorage.removeItem('nm_event_id');
    setUser(null);
    setEvents([]);
    setActiveEventId(null);
  };

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  // ── Not logged in ──────────────────────────────────────────────
  if (!user) {
    return (
      <div className={styles.guestContainer}>
        <div className={styles.guestContent}>
          <div className={styles.logo}>N</div>
          <h1 className={styles.title}>NetworkMatch</h1>
          <p className={styles.subtitle}>
            Scan the QR code at your event to get started and connect with people who matter.
          </p>
          <div className={styles.hint}>
            <span>📱</span>
            <span>Ask the event host for the QR code or join link</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Logged in ──────────────────────────────────────────────────
  const totalConnections = events.reduce((sum, e) => sum + e.connections.length, 0);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerAvatar}>{user.name?.charAt(0).toUpperCase()}</div>
          <div>
            <div className={styles.headerName}>Hi, {user.name?.split(' ')[0]}!</div>
            <div className={styles.headerSub}>NetworkMatch</div>
          </div>
        </div>
        <button className={styles.signOutBtn} onClick={handleSignOut}>Sign out</button>
      </header>

      <div className={styles.container}>

        {/* Active event banner */}
        {activeEventId && (
          <button
            className={styles.activeEventBanner}
            onClick={() => router.push(`/event/${activeEventId}/lobby`)}
          >
            <div className={styles.activeEventLeft}>
              <span className={styles.activeEventDot} />
              <div>
                <div className={styles.activeEventLabel}>Active event</div>
                <div className={styles.activeEventSub}>Tap to return to the lobby</div>
              </div>
            </div>
            <span className={styles.activeEventArrow}>→</span>
          </button>
        )}

        {/* Stats strip */}
        {events.length > 0 && (
          <div className={styles.statsStrip}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{events.length}</span>
              <span className={styles.statLabel}>{events.length === 1 ? 'Event' : 'Events'}</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>{totalConnections}</span>
              <span className={styles.statLabel}>{totalConnections === 1 ? 'Connection' : 'Connections'}</span>
            </div>
            <div className={styles.statDivider} />
            <button className={styles.allConnectionsBtn} onClick={() => router.push('/connections')}>
              View all →
            </button>
          </div>
        )}

        {/* Event list */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>My Events</h2>

          {events.length === 0 ? (
            <div className={styles.emptyEvents}>
              <div className={styles.emptyIcon}>🎪</div>
              <p className={styles.emptyTitle}>No events yet</p>
              <p className={styles.emptyHint}>Scan a QR code at a networking event to join and start making connections.</p>
            </div>
          ) : (
            <div className={styles.eventList}>
              {events.map((group) => (
                <div key={group.event_id} className={styles.eventCard}>
                  <div className={styles.eventCardLeft}>
                    <div className={styles.eventCardName}>{group.event_name}</div>
                    <div className={styles.eventCardDate}>
                      {new Date(group.event_date).toLocaleDateString('en-US', {
                        month: 'long', day: 'numeric', year: 'numeric',
                      })}
                    </div>
                    {/* Avatars preview */}
                    {group.connections.length > 0 && (
                      <div className={styles.avatarRow}>
                        {group.connections.slice(0, 5).map((c) => (
                          <div key={c.id} className={styles.avatarChip} title={c.name}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {group.connections.length > 5 && (
                          <div className={styles.avatarMore}>+{group.connections.length - 5}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={styles.eventCardRight}>
                    <div className={styles.connBadge}>
                      {group.connections.length}
                      <span>{group.connections.length === 1 ? ' connection' : ' connections'}</span>
                    </div>
                    <button
                      className={styles.viewBtn}
                      onClick={() => router.push('/connections')}
                    >
                      View →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Scan CTA */}
        <div className={styles.scanCta}>
          <span>📱</span>
          <span>Scan a QR code at your next event to join</span>
        </div>

      </div>
    </div>
  );
}
