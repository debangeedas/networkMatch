'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../../lib/api';
import styles from './new.module.css';

export default function NewEventPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', description: '', duration_per_round: 300 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const durationOptions = [
    { label: '3 minutes', value: 180 },
    { label: '5 minutes', value: 300 },
    { label: '7 minutes', value: 420 },
    { label: '10 minutes', value: 600 },
    { label: '15 minutes', value: 900 },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const event = await api.createEvent(form);
      router.push(`/dashboard/events/${event.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/dashboard" className={styles.back}>← Back to Events</Link>
      </header>

      <main className={styles.main}>
        <div className={styles.box}>
          <h1 className={styles.title}>Create New Event</h1>
          <p className={styles.subtitle}>Set up your networking event. You can generate a QR code after creation.</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label>Event Name</label>
              <input
                type="text"
                placeholder="e.g. Tech Founders Mixer Q1 2025"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className={styles.field}>
              <label>Tagline <span className={styles.labelOptional}>(optional)</span></label>
              <input
                type="text"
                placeholder="e.g. Startup founders & investors · London · March 2026"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={500}
              />
            </div>

            <div className={styles.field}>
              <label>Duration Per Round</label>
              <div className={styles.durationGrid}>
                {durationOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles.durationBtn} ${form.duration_per_round === opt.value ? styles.durationBtnActive : ''}`}
                    onClick={() => setForm({ ...form, duration_per_round: opt.value })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.summary}>
              <div className={styles.summaryRow}>
                <span>Event duration:</span>
                <span>Unlimited rounds</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Time per round:</span>
                <span>{Math.floor(form.duration_per_round / 60)} minutes</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Matching:</span>
                <span>AI-powered, complementary skills</span>
              </div>
            </div>

            {error && <p className="error-msg">{error}</p>}

            <div className={styles.actions}>
              <Link href="/dashboard">
                <button type="button" className="btn-secondary">Cancel</button>
              </Link>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Create Event & Get QR Code'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
