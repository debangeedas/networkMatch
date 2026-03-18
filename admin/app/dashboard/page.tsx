'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.replace('/login'); return; }

    const stored = localStorage.getItem('admin_user');
    if (stored) setAdmin(JSON.parse(stored));

    api.listEvents()
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push('/login');
  };

  const handleDelete = async (eventId: string) => {
    setDeleting(true);
    try {
      await api.deleteEvent(eventId);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      setConfirmDelete(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const eventToDelete = events.find((e) => e.id === confirmDelete);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>N</div>
          <span className={styles.logoText}>NetworkMatch</span>
          <span className={styles.badge}>Admin</span>
        </div>
        <div className={styles.headerRight}>
          {admin && <span className={styles.adminName}>{admin.email}</span>}
          <button className="btn-secondary" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.topRow}>
          <h1 className={styles.pageTitle}>Your Events</h1>
          <Link href="/dashboard/events/new">
            <button className="btn-primary">+ Create Event</button>
          </Link>
        </div>

        {loading && <div className={styles.center}><span className="spinner" /></div>}
        {error && <p className="error-msg">{error}</p>}

        {!loading && events.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📅</div>
            <h2>No events yet</h2>
            <p>Create your first networking event to get started.</p>
            <Link href="/dashboard/events/new">
              <button className="btn-primary" style={{ marginTop: 16 }}>Create Your First Event</button>
            </Link>
          </div>
        )}

        <div className={styles.eventGrid}>
          {events.map((event) => (
            <div key={event.id} className={styles.eventCardWrapper}>
              <Link href={`/dashboard/events/${event.id}`} className={styles.eventCard}>
                <div className={styles.eventCardTop}>
                  <h2 className={styles.eventName}>{event.name}</h2>
                  <span className={`badge badge-${event.status}`}>{event.status}</span>
                </div>
                <div className={styles.eventMeta}>
                  <span>{event.participant_count || 0} participants</span>
                  <span>Round {event.current_round || 0}</span>
                  <span>{Math.floor(event.duration_per_round / 60)}m rounds</span>
                </div>
                <div className={styles.eventDate}>
                  {new Date(event.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </div>
              </Link>
              <button
                className={styles.deleteCardBtn}
                onClick={(e) => { e.preventDefault(); setConfirmDelete(event.id); }}
                title="Delete event"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Delete Event?</h3>
            <p className={styles.modalDesc}>
              <strong>"{eventToDelete?.name}"</strong> and all its participants and match history will be permanently deleted.
            </p>
            <div className={styles.modalActions}>
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn-danger" onClick={() => handleDelete(confirmDelete)} disabled={deleting}>
                {deleting ? <span className="spinner" /> : 'Delete Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
