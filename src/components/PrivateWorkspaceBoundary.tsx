'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  isPrivateWorkspaceEnabled,
  isSupabaseConfigured,
} from '@/lib/supabase/config';
import {
  resolveScrimAccess,
  type ScrimAccess,
} from '@/lib/scrimDatabase';
import styles from './PrivateWorkspaceBoundary.module.css';

type AccessState =
  | { status: 'checking'; access: null; error: string }
  | { status: 'ready'; access: ScrimAccess; error: string }
  | { status: 'blocked'; access: ScrimAccess | null; error: string };

export default function PrivateWorkspaceBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<AccessState>({
    status: 'checking',
    access: null,
    error: '',
  });

  useEffect(() => {
    if (!isPrivateWorkspaceEnabled || !isSupabaseConfigured) return;
    let cancelled = false;

    void resolveScrimAccess()
      .then((access) => {
        if (cancelled) return;
        setState(
          access.mode === 'cloud'
            ? { status: 'ready', access, error: '' }
            : {
                status: 'blocked',
                access,
                error: access.accessError ?? '',
              },
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: 'blocked',
          access: null,
          error:
            error instanceof Error
              ? error.message
              : 'Private workspace could not be opened.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isPrivateWorkspaceEnabled || !isSupabaseConfigured) return children;
  if (state.status === 'checking') return <WorkspaceLoading />;
  if (state.status === 'blocked') {
    return <PrivateWorkspaceGate error={state.error} />;
  }
  return children;
}

function WorkspaceLoading() {
  return (
    <main className={styles.page}>
      <section className={styles.loadingCard}>
        <span className={styles.brandMark}>C</span>
        <p>CHALIZE PRIVATE WORKSPACE</p>
        <div className={styles.loadingLine}><i /></div>
        <small>Checking this device…</small>
      </section>
    </main>
  );
}

function PrivateWorkspaceGate({ error }: { error: string }) {
  const [value, setValue] = useState('');
  const [inputError, setInputError] = useState('');

  function connectDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = accessTokenFrom(value);

    if (!token) {
      setInputError('Paste the complete private link or its access code.');
      return;
    }

    window.location.replace(`/scrims#access=${encodeURIComponent(token)}`);
  }

  return (
    <main className={styles.page}>
      <section className={styles.gateCard}>
        <header className={styles.brand}>
          <span>C</span>
          <div>
            <strong>CHALIZE</strong>
            <small>MLBB TEAM INTELLIGENCE</small>
          </div>
        </header>

        <div className={styles.copy}>
          <p>PRIVATE WORKSPACE</p>
          <h1>Open the team link once.</h1>
          <span>
            Tidak perlu email atau password. Paste private link dari owner untuk
            menghubungkan perangkat ini ke data tim.
          </span>
        </div>

        <form className={styles.form} onSubmit={connectDevice}>
          <label htmlFor="private-workspace-link">Private link or access code</label>
          <input
            id="private-workspace-link"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={value}
            placeholder="https://chalize.site/scrims#access=…"
            onChange={(event) => {
              setValue(event.target.value);
              setInputError('');
            }}
          />
          {(inputError || error) && (
            <p className={styles.error}>{inputError || error}</p>
          )}
          <button type="submit">Connect this device →</button>
        </form>

        <footer className={styles.foot}>
          <i />
          <span>Access stays on this browser until the device is disconnected.</span>
        </footer>
      </section>
    </main>
  );
}

function accessTokenFrom(value: string) {
  const cleanValue = value.trim();
  if (!cleanValue) return '';

  try {
    const url = new URL(cleanValue);
    const token = new URLSearchParams(url.hash.replace(/^#/, '')).get('access');
    if (token && validAccessToken(token)) return token;
  } catch {
    // The field also accepts the raw access code.
  }

  if (cleanValue.includes('access=')) {
    const token = cleanValue.split('access=').pop()?.split(/[&#?]/)[0] ?? '';
    const decoded = decodeURIComponent(token);
    if (validAccessToken(decoded)) return decoded;
  }

  return validAccessToken(cleanValue) ? cleanValue : '';
}

function validAccessToken(value: string) {
  return /^[a-zA-Z0-9_-]{32,128}$/.test(value);
}
