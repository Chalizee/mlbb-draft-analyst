'use client';

import { useEffect, useState } from 'react';
import { seedDatabase } from '@/lib/db';

interface UseDatabaseResult {
  /** `true` once the database has been initialised and seeded. */
  isReady: boolean;
  /** If initialisation failed, the error is stored here. */
  error: Error | null;
}

/**
 * React hook that initialises the IndexedDB database and seeds hero
 * data on first load.
 *
 * Usage:
 * ```tsx
 * const { isReady, error } = useDatabase();
 * if (!isReady) return <Loading />;
 * ```
 */
export function useDatabase(): UseDatabaseResult {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await seedDatabase();
        if (!cancelled) {
          setIsReady(true);
        }
      } catch (err) {
        console.error('[useDatabase] Initialisation failed:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isReady, error };
}
