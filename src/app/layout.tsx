import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: {
    default: 'Chalize MLBB Scouting',
    template: '%s · Chalize MLBB Scouting',
  },
  description:
    'Private MLBB tournament scouting workspace with role-adjusted player evidence and draft analysis.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <div className="app-shell">
          <Sidebar />
          <main className="app-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
