'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '../../../lib/api';
import styles from './join.module.css';

const LOOKING_FOR_OPTIONS = [
  'Investors', 'Co-founders', 'Engineers', 'Designers', 'Customers',
  'Partnerships', 'Mentorship', 'Hiring', 'Job opportunities', 'Advice',
  'Collaboration', 'Community', 'Sales leads', 'Marketing help',
];
const INTERESTS_OPTIONS = [
  'AI/ML', 'Web3', 'SaaS', 'Fintech', 'Health tech', 'EdTech', 'Climate',
  'Gaming', 'Hardware', 'Open source', 'Developer tools', 'Consumer apps',
  'Venture capital', 'Product', 'Design', 'Growth', 'Sales',
];

export default function JoinPage() {
  const router = useRouter();
  const { eventId } = useParams<{ eventId: string }>();

  const [event, setEvent] = useState<any>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState('');

  const [isReturningUser, setIsReturningUser] = useState(false);
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    linkedin: '',
    role: '',
    company: '',
    looking_for: [] as string[],
    offering: [] as string[],
    interests: [] as string[],
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('nm_user');
    const storedEventId = localStorage.getItem('nm_event_id');

    if (stored && storedEventId === eventId) {
      // Returning user — pre-fill form, let them update or continue
      const user = JSON.parse(stored);
      setIsReturningUser(true);
      setExistingUserId(user.id);
      setForm({
        name: user.name || '',
        linkedin: user.linkedin || '',
        role: user.role || '',
        company: user.company || '',
        looking_for: user.looking_for || [],
        offering: user.offering || [],
        interests: user.interests || [],
      });
    }

    api.getEventPublic(eventId)
      .then(setEvent)
      .catch((err) => setEventError(err.message))
      .finally(() => setLoadingEvent(false));
  }, [eventId]);

  const continueToLobby = async () => {
    if (!existingUserId) return;
    setSubmitting(true);
    try {
      const res = await api.joinEvent({ event_id: eventId, user_id: existingUserId });
      localStorage.setItem('user_token', res.token);
      localStorage.setItem('nm_user', JSON.stringify(res.user));
      localStorage.setItem('nm_event_id', eventId);
      router.push(`/event/${eventId}/lobby`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const toggleItem = (field: 'looking_for' | 'offering' | 'interests', value: string) => {
    setForm((prev) => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Please enter your name'); return; }
    setSubmitting(true);
    setError('');
    try {
      const payload: any = { ...form, event_id: eventId };
      if (existingUserId) payload.user_id = existingUserId;
      const res = await api.joinEvent(payload);
      localStorage.setItem('user_token', res.token);
      localStorage.setItem('nm_user', JSON.stringify(res.user));
      localStorage.setItem('nm_event_id', eventId);
      router.push(`/event/${eventId}/lobby`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loadingEvent) {
    return (
      <div className={styles.loading}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (eventError) {
    return (
      <div className={styles.loading}>
        <div className={styles.errorBox}>
          <h2>Event not found</h2>
          <p>{eventError}</p>
          <button className="btn-secondary" onClick={() => router.push('/')} style={{ marginTop: 16 }}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.eventBadge}>
          <span className={styles.eventDot} />
          {event?.name || 'Networking Event'}
        </div>
        {event?.description && (
          <p className={styles.eventTagline}>{event.description}</p>
        )}
      </div>

      <div className={styles.container}>
        <div className={styles.intro}>
          <div className={styles.logoMini}>N</div>
          <h1 className={styles.title}>
            {isReturningUser ? 'Update Your Profile' : 'Join the Event'}
          </h1>
          <p className={styles.subtitle}>
            {isReturningUser
              ? 'Update your info or continue with your existing profile'
              : 'Tell us about yourself so we can make great matches'}
          </p>
        </div>

        {/* Returning user shortcut */}
        {isReturningUser && (
          <div className={styles.returningBanner}>
            <div className={styles.returningLeft}>
              <div className={styles.returningAvatar}>{form.name.charAt(0).toUpperCase()}</div>
              <div>
                <div className={styles.returningName}>{form.name}</div>
                {form.role && <div className={styles.returningRole}>{form.role}{form.company ? ` @ ${form.company}` : ''}</div>}
              </div>
            </div>
            <button
              type="button"
              className={styles.continueBtn}
              onClick={continueToLobby}
              disabled={submitting}
            >
              {submitting ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Continue →'}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {isReturningUser && (
            <p className={styles.editHint}>Or edit your profile below and save changes:</p>
          )}

          {/* Basic Info */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>About You</h2>
            <div className={styles.field}>
              <label>Your Name *</label>
              <input
                type="text"
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus={!isReturningUser}
              />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Role</label>
                <input
                  type="text"
                  placeholder="e.g. Founder, Engineer"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label>Company</label>
                <input
                  type="text"
                  placeholder="Company name"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </div>
            </div>
            <div className={styles.field}>
              <label>LinkedIn URL</label>
              <input
                type="url"
                placeholder="https://linkedin.com/in/yourname"
                value={form.linkedin}
                onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
              />
            </div>
          </div>

          {/* Looking For */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>What are you looking for?</h2>
            <p className={styles.sectionHint}>Select all that apply</p>
            <div className={styles.tagGrid}>
              {LOOKING_FOR_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`tag ${form.looking_for.includes(opt) ? 'tag-active' : ''}`}
                  onClick={() => toggleItem('looking_for', opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Offering */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>What can you offer?</h2>
            <p className={styles.sectionHint}>Select all that apply</p>
            <div className={styles.tagGrid}>
              {LOOKING_FOR_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`tag ${form.offering.includes(opt) ? 'tag-active' : ''}`}
                  onClick={() => toggleItem('offering', opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Your Interests</h2>
            <p className={styles.sectionHint}>What sectors or topics excite you?</p>
            <div className={styles.tagGrid}>
              {INTERESTS_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`tag ${form.interests.includes(opt) ? 'tag-active' : ''}`}
                  onClick={() => toggleItem('interests', opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? <span className="spinner" /> : isReturningUser ? 'Save Changes & Enter Lobby' : 'Join Event →'}
          </button>
        </form>
      </div>
    </div>
  );
}
