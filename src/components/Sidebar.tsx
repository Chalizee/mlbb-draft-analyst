'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

const navItems = [
  { href: '/', label: 'Overview', icon: '01' },
  { href: '/scouting', label: 'Scouting', icon: '02' },
  { href: '/scrims', label: 'Scrims', icon: '03' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [account, setAccount] = useState<{
    email: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;

    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user || cancelled) return;

      const { data: membership } = await supabase
        .from('workspace_members')
        .select('role')
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      setAccount({
        email: data.user.email ?? 'Team member',
        role: membership?.role ?? 'pending',
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.assign('/login');
  }

  return (
    <>
      <aside className="app-sidebar">
        <Link href="/" className="brand-block" aria-label="Chalize Scouting home">
          <span>C</span>
          <div>
            <strong>CHALIZE</strong>
            <small>MLBB SCOUTING</small>
          </div>
        </Link>

        <nav aria-label="Primary navigation">
          <p>WORKSPACE</p>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? 'nav-link active' : 'nav-link'}
              >
                <span>{item.icon}</span>
                <strong>{item.label}</strong>
              </Link>
            );
          })}
        </nav>

        {isSupabaseConfigured ? (
          <div className="sidebar-foot account-foot">
            <span><i /> SECURE WORKSPACE</span>
            <strong>{account?.email ?? 'Loading account…'}</strong>
            <p>{account?.role ?? 'checking access'}</p>
            <button type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        ) : (
          <div className="sidebar-foot">
            <span><i /> LOCAL MODE</span>
            <p>Your scouting files stay on this device.</p>
          </div>
        )}
      </aside>

      <header className="mobile-header">
        <Link href="/" className="mobile-brand">
          <span>C</span>
          <strong>CHALIZE</strong>
        </Link>
        <nav aria-label="Mobile navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? 'active' : ''}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
