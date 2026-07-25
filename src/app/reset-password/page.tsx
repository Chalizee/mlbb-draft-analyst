'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }

    if (password !== confirmation) {
      setError('Konfirmasi password belum sama.');
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError('Secure workspace belum terhubung ke database.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError('Password gagal diperbarui. Minta link reset yang baru.');
      setLoading(false);
      return;
    }

    router.replace('/scrims');
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
          <p className="eyebrow">SECURE ACCESS</p>
          <h1>Buat password baru.</h1>
          <p>
            Password ini akan dipakai untuk login berikutnya ke workspace tim.
          </p>
        </div>

        <form className="auth-form" onSubmit={updatePassword}>
          <label>
            <span>Password baru</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimal 8 karakter"
              minLength={8}
              required
            />
          </label>
          <label>
            <span>Ulangi password baru</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Ketik ulang password"
              minLength={8}
              required
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Menyimpan…' : 'Simpan password baru →'}
          </button>
        </form>

        <div className="auth-foot">
          <i />
          <span>Link reset hanya dapat digunakan sekali</span>
        </div>
      </section>
    </div>
  );
}
