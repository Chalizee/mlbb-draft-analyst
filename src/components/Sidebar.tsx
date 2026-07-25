'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Overview', icon: '01' },
  { href: '/scouting', label: 'Scouting', icon: '02' },
  { href: '/scrims', label: 'Scrims', icon: '03' },
];

export default function Sidebar() {
  const pathname = usePathname();

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

        <div className="sidebar-foot">
          <span><i /> LOCAL MODE</span>
          <p>Your scouting files stay on this device.</p>
        </div>
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
