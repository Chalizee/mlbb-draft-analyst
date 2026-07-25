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
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState<'password' | 'magic' | null>(null);

  function getNextPath() {
    const requestedPath = new URLSearchParams(window.location.search).get('next');
    return requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
      ? requestedPath
      : '/scrims';
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    const supabase = createClient();
    if (!supabase) {
      setError('Secure workspace belum terhubung ke database.');
      return;
    }

    setLoading('password');
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError('Email atau password tidak cocok.');
      setLoading(null);
      return;
    }

    router.replace(getNextPath());
    router.refresh();
  }

  async function sendMagicLink() {
    setError('');
    setNotice('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Masukkan email yang sudah diberi akses.');
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError('Secure workspace belum terhubung ke database.');
      return;
    }

    const callbackUrl = new URL('/auth/callback', window.location.origin);
    callbackUrl.searchParams.set('next', getNextPath());

    setLoading('magic');
    const { error: magicLinkError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        shouldCreateUser: false,
      },
    });

    if (magicLinkError) {
      setError('Magic link gagal dikirim. Tunggu sebentar lalu coba lagi.');
      setLoading(null);
      return;
    }

    setNotice('Link login sudah dikirim. Cek inbox atau folder spam.');
    setLoading(null);
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
            <button
              className="primary-button"
              type="button"
              onClick={sendMagicLink}
              disabled={loading !== null}
            >
              {loading === 'magic' ? 'Mengirim link…' : 'Kirim magic link →'}
            </button>
            <small style={{ color: 'var(--dim)', textAlign: 'center' }}>
              atau pakai password
            </small>
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
            {notice && (
              <div className="auth-setup-note">
                <strong>Link terkirim</strong>
                <p>{notice}</p>
              </div>
            )}
            <button
              className="secondary-button"
              type="submit"
              disabled={loading !== null}
            >
              {loading === 'password' ? 'Signing in…' : 'Masuk dengan password'}
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
