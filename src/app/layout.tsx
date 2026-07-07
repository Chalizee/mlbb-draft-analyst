'use client';

import React from 'react';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import { useDatabase } from '@/lib/useDatabase';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <title>MLBB Draft Analyst</title>
        <meta name="description" content="Professional MLBB Draft Analysis Tool" />
      </head>
      <body className="font-body antialiased bg-bg-primary text-text-primary" suppressHydrationWarning>
        <DatabaseProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="h-full"
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </DatabaseProvider>
      </body>
    </html>
  );
}

/* ============ Database Provider ============ */

function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const { isReady, error } = useDatabase();

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center p-8 glass-card max-w-md">
          <p className="text-3xl mb-4">⚠️</p>
          <h2 className="font-heading text-lg font-bold text-danger mb-2">
            Database Error
          </h2>
          <p className="text-sm text-text-secondary">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-accent rounded-lg text-sm font-medium text-white
                       hover:bg-accent-hover transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-text-secondary">Initializing database...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
