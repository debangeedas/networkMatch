'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import styles from './connections.module.css';

type Connection = {
  id: string;
  name: string;
  role?: string;
  company?: string;
  linkedin?: string;
  saved_at: string;
};

type EventGroup = {
  event_id: string;
  event_name: string;
  event_date: string;
  connections: Connection[];
};

export default function ConnectionsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<EventGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('user_token');
    if (!token) {
      router.replace('/');
      return;
    }
    api.getMyConnections()
      .then(setGroups)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  const totalConnections = groups.reduce((sum, g) => sum + g.connections.length, 0);

  if (loading) {
    return (
      <div className={styles.loading}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>←</button>
        <div className={styles.headerTitle}>My Connections</div>
        {totalConnections > 0 && (
          <span className={styles.totalBadge}>{totalConnections}</span>
        )}
      </header>

      <div className={styles.container}>
        {error && <p className="error-msg">{error}</p>}

        {!error && groups.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🤝</div>
            <h2>No connections yet</h2>
            <p>When you save a connection during an event, it'll show up here.</p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.event_id} className={styles.eventGroup}>
            <div className={styles.eventHeader}>
              <div className={styles.eventName}>{group.event_name}</div>
              <div className={styles.eventMeta}>
                {new Date(group.event_date).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
                {' · '}
                <span className={styles.connCount}>
                  {group.connections.length} {group.connections.length === 1 ? 'connection' : 'connections'}
                </span>
              </div>
            </div>

            <div className={styles.connectionList}>
              {group.connections.map((conn) => (
                <div key={conn.id} className={styles.connectionCard}>
                  <div className={styles.avatar}>
                    {conn.name.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.connInfo}>
                    <div className={styles.connName}>{conn.name}</div>
                    {(conn.role || conn.company) && (
                      <div className={styles.connRole}>
                        {conn.role}{conn.company ? ` @ ${conn.company}` : ''}
                      </div>
                    )}
                  </div>
                  {conn.linkedin && (
                    <a
                      href={conn.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.linkedinBtn}
                    >
                      Connect
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
