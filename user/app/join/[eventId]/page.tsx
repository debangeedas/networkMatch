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

type Step = 'email' | 'login' | 'otp' | 'register';

export default function JoinPage() {
  const router = useRouter();
  const { eventId } = useParams<{ eventId: string }>();

  const [event, setEvent] = useState<any>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState('');

  // localStorage shortcut state
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [existingUserName, setExistingUserName] = useState('');
  const [existingUserRole, setExistingUserRole] = useState('');
  const [existingUserCompany, setExistingUserCompany] = useState('');

  // Multi-step auth state
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [lookedUpName, setLookedUpName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

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
      const user = JSON.parse(stored);
      setIsReturningUser(true);
      setExistingUserId(user.id);
      setExistingUserName(user.name || '');
      setExistingUserRole(user.role || '');
      setExistingUserCompany(user.company || '');
    }

    api.getEventPublic(eventId)
      .then(setEvent)
      .catch((err) => setEventError(err.message))
      .finally(() => setLoadingEvent(false));
  }, [eventId]);

  // localStorage shortcut: same-device returning user
  const continueToLobby = async () => {
    if (!existingUserId) return;
    setSubmitting(true);
    setError('');
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

  const saveAndGoLobby = (token: string, user: any) => {
    localStorage.setItem('user_token', token);
    localStorage.setItem('nm_user', JSON.stringify(user));
    localStorage.setItem('nm_event_id', eventId);
    router.push(`/event/${eventId}/lobby`);
  };

  // Step: email — lookup
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.lookup(email.trim());
      if (res.exists) {
        setLookedUpName(res.name || '');
        setStep('login');
      } else {
        setStep('register');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Step: login — password auth
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError('Please enter your password'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.login(email.trim(), password);
      // Join the event with the authenticated user
      const joinRes = await api.joinEvent({ event_id: eventId, user_id: res.user.id });
      saveAndGoLobby(joinRes.token, joinRes.user);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  // Step: login → send OTP (forgot password)
  const handleSendOTP = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.sendOTP(email.trim());
      setOtpSent(true);
      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Step: otp — verify code
  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) { setError('Please enter the code'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.verifyOTP(email.trim(), otp.trim());
      const joinRes = await api.joinEvent({ event_id: eventId, user_id: res.user.id });
      saveAndGoLobby(joinRes.token, joinRes.user);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    try {
      await api.sendOTP(email.trim());
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Step: register — new user
  const toggleItem = (field: 'looking_for' | 'offering' | 'interests', value: string) => {
    setForm((prev) => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value],
      };
    });
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Please enter your name'); return; }
    if (password && password !== confirmPassword) { setError('Passwords do not match'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.joinEvent({
        ...form,
        event_id: eventId,
        email: email.trim(),
        password: password || undefined,
      });
      saveAndGoLobby(res.token, res.user);
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
            {step === 'login' ? `Welcome back${lookedUpName ? `, ${lookedUpName.split(' ')[0]}` : ''}!`
              : step === 'otp' ? 'Check your email'
              : step === 'register' ? 'Join the Event'
              : isReturningUser ? 'Welcome back!' : 'Join the Event'}
          </h1>
          <p className={styles.subtitle}>
            {step === 'login' ? 'Enter your password to continue'
              : step === 'otp' ? `We sent a 6-digit code to ${email}`
              : step === 'register' ? 'Tell us about yourself so we can make great matches'
              : isReturningUser ? 'You were here before — continue or sign in on a new device'
              : 'Enter your email to get started'}
          </p>
        </div>

        {/* localStorage shortcut — same-device returning user */}
        {isReturningUser && step === 'email' && (
          <div className={styles.returningBanner}>
            <div className={styles.returningLeft}>
              <div className={styles.returningAvatar}>{existingUserName.charAt(0).toUpperCase()}</div>
              <div>
                <div className={styles.returningName}>{existingUserName}</div>
                {existingUserRole && (
                  <div className={styles.returningRole}>
                    {existingUserRole}{existingUserCompany ? ` @ ${existingUserCompany}` : ''}
                  </div>
                )}
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

        {/* Step: email */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className={styles.form}>
            {isReturningUser && (
              <p className={styles.editHint}>Or sign in with a different account:</p>
            )}
            <div className={styles.section}>
              <div className={styles.field}>
                <label>Email address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus={!isReturningUser}
                />
              </div>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner" /> : 'Continue →'}
            </button>
          </form>
        )}

        {/* Step: login */}
        {step === 'login' && (
          <form onSubmit={handleLoginSubmit} className={styles.form}>
            <div className={styles.section}>
              <div className={styles.field}>
                <label>Password</label>
                <input
                  type="password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner" /> : 'Log in →'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: 8 }}
              onClick={handleSendOTP}
              disabled={submitting}
            >
              Forgot password? Send me a code
            </button>
            <button
              type="button"
              className={styles.backLink}
              onClick={() => { setStep('email'); setError(''); setPassword(''); }}
            >
              ← Use a different email
            </button>
          </form>
        )}

        {/* Step: otp */}
        {step === 'otp' && (
          <form onSubmit={handleOTPSubmit} className={styles.form}>
            <div className={styles.section}>
              <div className={styles.field}>
                <label>6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner" /> : 'Verify →'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: 8 }}
              onClick={handleResendOTP}
              disabled={submitting}
            >
              Resend code
            </button>
            <button
              type="button"
              className={styles.backLink}
              onClick={() => { setStep('login'); setError(''); setOtp(''); }}
            >
              ← Back to login
            </button>
          </form>
        )}

        {/* Step: register */}
        {step === 'register' && (
          <form onSubmit={handleRegisterSubmit} className={styles.form}>
            {/* Basic Info */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>About You</h2>
              <div className={styles.field}>
                <label>Email address</label>
                <input type="email" value={email} readOnly style={{ opacity: 0.6 }} />
              </div>
              <div className={styles.field}>
                <label>Your Name *</label>
                <input
                  type="text"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoFocus
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
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="Set a password (optional)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
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
              {submitting ? <span className="spinner" /> : 'Join Event →'}
            </button>
            <button
              type="button"
              className={styles.backLink}
              onClick={() => { setStep('email'); setError(''); }}
            >
              ← Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
