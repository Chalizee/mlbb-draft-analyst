'use client';

import { useState } from 'react';
import { db } from '@/lib/db';
import { mplTurkeyRosters } from '@/data/teamRoster';
import type { Player } from '@/types';

export default function PopulatePlayersPage() {
  const [status, setStatus] = useState<string>('Ready to populate');
  const [loading, setLoading] = useState(false);

  const populatePlayers = async () => {
    setLoading(true);
    try {
      if (!db) {
        setStatus('Database not initialized');
        return;
      }

      const existingCount = await db.players.count();
      if (existingCount > 0) {
        setStatus(`Players already populated: ${existingCount} players`);
        setLoading(false);
        return;
      }

      // Flatten roster data
      const players: Player[] = [];
      for (const team of mplTurkeyRosters) {
        for (const playerData of team.players) {
          if (playerData.status === 'active') {
            players.push({
              name: playerData.name,
              role: playerData.role as any,
              comfortHeroes: [],
              notes: `${team.teamName} - ${team.teamCode}`,
              createdAt: new Date(),
            });
          }
        }
      }

      await db.players.bulkAdd(players);
      setStatus(`✓ Successfully populated ${players.length} players!`);
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Populate Players</h1>
      <button
        onClick={populatePlayers}
        disabled={loading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Loading...' : 'Populate Players'}
      </button>
      <p>{status}</p>
    </div>
  );
}
