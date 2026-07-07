import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mplTurkeyRosters } from '@/data/teamRoster';
import type { Player } from '@/types';

export async function POST() {
  try {
    if (typeof window !== 'undefined') {
      return NextResponse.json(
        { error: 'This endpoint must be called from server-side' },
        { status: 400 }
      );
    }

    // Flatten roster data into individual player records
    const players: Player[] = [];
    for (const team of mplTurkeyRosters) {
      for (const playerData of team.players) {
        if (playerData.status === 'active') {
          players.push({
            name: playerData.name,
            role: playerData.role as any, // EXP | Jungle | Mid | Gold | Roam
            comfortHeroes: [],
            notes: `${team.teamName} - ${team.teamCode}`,
            createdAt: new Date(),
          });
        }
      }
    }

    // Check if database is ready
    const database = db;
    if (!database) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    const existingCount = await database.players.count();
    if (existingCount > 0) {
      return NextResponse.json(
        { message: 'Players already populated', count: existingCount },
        { status: 200 }
      );
    }

    await database.players.bulkAdd(players);

    return NextResponse.json({
      success: true,
      message: `Populated ${players.length} players from rosters`,
      count: players.length,
    });
  } catch (error) {
    console.error('[/api/scouting/import/players] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
