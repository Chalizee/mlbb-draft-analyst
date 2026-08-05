'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import PrivateWorkspaceBoundary from '@/components/PrivateWorkspaceBoundary';
import Sidebar from '@/components/Sidebar';

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <PrivateWorkspaceBoundary>
      {pathname === '/login' ? (
        <main className="auth-content">{children}</main>
      ) : (
        <div className="app-shell">
          <Sidebar />
          <main className="app-content">{children}</main>
        </div>
      )}
    </PrivateWorkspaceBoundary>
  );
}
