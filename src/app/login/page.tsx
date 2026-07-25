'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const supabase = createClient();
    if (!supabase) {
      setError('Secure workspace belum terhubung ke database.');
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError('Email atau password tidak cocok.');
      setLoading(false);
      return;
    }

    const requestedPath = new URLSearchParams(window.location.search).get('next');
    const nextPath =
      requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
        ? requestedPath
        : '/scrims';

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span>C</span>
          <div>
            <strong>CHALIZE</strong>
            <small>TEAM INTELLIGENCE</small>
          </div>
        </div>

        <div className="auth-copy">
          <p className="eyebrow">PRIVATE WORKSPACE</p>
          <h1>Team data stays with the team.</h1>
          <p>
            Login khusus coach, analyst, dan management yang sudah diberi akses.
          </p>
        </div>

        {!isSupabaseConfigured ? (
          <div className="auth-setup-note">
            <strong>Security setup pending</strong>
            <p>
              Tambahkan Supabase environment variables untuk mengaktifkan login.
            </p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={signIn}>
            <label>
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@team.com"
                required
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Enter workspace →'}
            </button>
          </form>
        )}

        <div className="auth-foot">
          <i />
          <span>Invite-only access · No public signup</span>
        </div>
      </section>
    </div>
  );
}
