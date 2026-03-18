'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', inviteCode: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let res;
      if (mode === 'login') {
        res = await api.login(form.email, form.password);
      } else {
        res = await api.register(form.email, form.password, form.name, form.inviteCode);
      }
      localStorage.setItem('admin_token', res.token);
      localStorage.setItem('admin_user', JSON.stringify(res.admin));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.box}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>N</span>
          <span>NetworkMatch</span>
        </div>
        <h1 className={styles.title}>{mode === 'login' ? 'Admin Login' : 'Create Admin Account'}</h1>
        <p className={styles.subtitle}>
          {mode === 'login' ? 'Sign in to manage your events' : 'Register with your invite code'}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === 'register' && (
            <div className={styles.field}>
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          )}
          <div className={styles.field}>
            <label>Email</label>
            <input
              type="email"
              placeholder="admin@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className={styles.field}>
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </div>
          {mode === 'register' && (
            <div className={styles.field}>
              <label>Invite Code</label>
              <input
                type="text"
                placeholder="Admin invite code"
                value={form.inviteCode}
                onChange={(e) => setForm({ ...form, inviteCode: e.target.value })}
                required
              />
            </div>
          )}

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '12px' }}>
            {loading ? <span className="spinner" /> : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className={styles.toggle}>
          {mode === 'login' ? (
            <>Don&apos;t have an account?{' '}
              <button type="button" className={styles.link} onClick={() => setMode('register')}>Register</button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button type="button" className={styles.link} onClick={() => setMode('login')}>Sign In</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
