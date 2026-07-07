'use client';

import Dexie, { type EntityTable } from 'dexie';
import type {
  Hero,
  HeroRelationship,
  HeroNote,
  DraftSession,
  TeamIdentity,
  Scrim,
  Opponent,
  Player,
  PlayerHeroStat,
  AnalystNote,
  ScrimRecord,
  ScrimPlayerStats,
} from '@/types';
import { HERO_DATA } from '@/data/heroData';
import { mplTurkeyRosters } from '@/data/teamRoster';


// ────────────────────────────────────────────────
// Database schema
// ────────────────────────────────────────────────
class MLBBDraftAnalystDB extends Dexie {
  heroes!: EntityTable<Hero, 'id'>;
  heroRelationships!: EntityTable<HeroRelationship, 'id'>;
  heroNotes!: EntityTable<HeroNote, 'id'>;
  draftSessions!: EntityTable<DraftSession, 'id'>;
  teamIdentities!: EntityTable<TeamIdentity, 'id'>;
  scrims!: EntityTable<Scrim, 'id'>;
  opponents!: EntityTable<Opponent, 'id'>;
  players!: EntityTable<Player, 'id'>;
  playerHeroStats!: EntityTable<PlayerHeroStat, 'id'>;
  analystNotes!: EntityTable<AnalystNote, 'id'>;
  scrimRecords!: EntityTable<ScrimRecord, 'id'>;
  scrimPlayerStats!: EntityTable<ScrimPlayerStats, 'id'>;

  constructor() {
    super('MLBBDraftAnalystDB');

    this.version(1).stores({
      heroes: '++id, name, slug, role, damageType, scalingType, teamfightStyle',
      heroRelationships: '++id, heroId, relatedHeroId, type',
      heroNotes: '++id, heroId, firstPickViability, sidePreference',
      draftSessions: '++id, blueSideName, redSideName, result, format, scrimId, createdAt',
      teamIdentities: '++id, name, createdAt',
      scrims: '++id, date, opponentId, draftSessionId, result, createdAt',
      opponents: '++id, name, sidePreference, createdAt',
      players: '++id, name, role, createdAt',
      playerHeroStats: '++id, playerId, heroId, tier',
      analystNotes: '++id, category, title, pinned, relatedHeroId, relatedOpponentId, relatedScrimId, createdAt',
    });

    this.version(2).stores({
      heroes: '++id, name, slug, role, damageType, scalingType, teamfightStyle',
      heroRelationships: '++id, heroId, relatedHeroId, type',
      heroNotes: '++id, heroId, firstPickViability, sidePreference',
      draftSessions: '++id, blueSideName, redSideName, result, format, scrimId, createdAt',
      teamIdentities: '++id, name, createdAt',
      scrims: '++id, date, opponentId, draftSessionId, result, createdAt',
      opponents: '++id, name, sidePreference, createdAt',
      players: '++id, name, role, createdAt',
      playerHeroStats: '++id, playerId, heroId, tier',
      analystNotes: '++id, category, title, pinned, relatedHeroId, relatedOpponentId, relatedScrimId, createdAt',
      scrimRecords: '++id, matchId, date, opponent, result, side, gameNumber, week, createdAt',
      scrimPlayerStats: '++id, matchId, scrimRecordId, player, role, hero, result, side',
    });
  }
}

// ────────────────────────────────────────────────
// Singleton
// ────────────────────────────────────────────────
let dbInstance: MLBBDraftAnalystDB | null = null;

function getDB(): MLBBDraftAnalystDB {
  if (!dbInstance) {
    dbInstance = new MLBBDraftAnalystDB();
  }
  return dbInstance;
}

/**
 * The Dexie.js database singleton.
 *
 * On the server (SSR) this will still be created lazily on first access,
 * but IndexedDB operations will naturally fail — callers must guard with
 * `typeof window !== 'undefined'` or use the `useDatabase` hook.
 */
export const db = typeof window !== 'undefined' ? getDB() : (null as unknown as MLBBDraftAnalystDB);

// ────────────────────────────────────────────────
// Seed helper
// ────────────────────────────────────────────────

/**
 * Seeds the heroes table if it is empty.
 * Safe to call multiple times — it only writes on first run.
 */
export async function seedDatabase(): Promise<void> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return; // SSR – nothing to do
  }

  const database = getDB();
  const heroCount = await database.heroes.count();

  if (heroCount === 0) {
    await database.heroes.bulkAdd(HERO_DATA as Hero[]);
    console.log(`[MLBBDraftAnalystDB] Seeded ${HERO_DATA.length} heroes.`);
  } else {
    const existingHeroes = await database.heroes.toArray();
    const existingSlugs = new Set(existingHeroes.map(h => h.slug));
    
    // 1. Sync any missing heroes from seed data
    const missingHeroes = HERO_DATA.filter(seedHero => !existingSlugs.has(seedHero.slug));
    if (missingHeroes.length > 0) {
      console.log(`[MLBBDraftAnalystDB] Found ${missingHeroes.length} new/missing heroes. Adding to database...`);
      await database.heroes.bulkAdd(missingHeroes as Hero[]);
      console.log(`[MLBBDraftAnalystDB] Successfully added: ${missingHeroes.map(h => h.name).join(', ')}`);
    }

    // 2. Perform image URL migration and upgrade existing ones (like Sora/Kalea)
    const updatePromises = existingHeroes.map(async (existingHero) => {
      const seedHero = HERO_DATA.find(h => h.slug === existingHero.slug);
      if (seedHero) {
        let needsUpdate = false;
        const updates: Partial<Hero> = {};

        // If the seed hero has a new image and the database record is missing or different
        if (seedHero.imageUrl && existingHero.imageUrl !== seedHero.imageUrl) {
          updates.imageUrl = seedHero.imageUrl;
          needsUpdate = true;
        }

        if (needsUpdate) {
          return database.heroes.update(existingHero.id!, updates);
        }
      }
    });

    const results = await Promise.all(updatePromises.filter(Boolean));
    const updatedCount = results.filter(Boolean).length;
    if (updatedCount > 0) {
      console.log(`[MLBBDraftAnalystDB] Upgraded and migrated ${updatedCount} hero avatars/images.`);
    }
  }
}

/**
 * Seeds player roster data if players table is empty.
 * Loads player data from team rosters.
 */
export async function seedRosterData(): Promise<void> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return; // SSR – nothing to do
  }

  const database = getDB();
  const playerCount = await database.players.count();

  if (playerCount === 0) {
    // Flatten roster data into individual player records
    const players: Player[] = [];
    for (const team of mplTurkeyRosters) {
      for (const playerData of team.players) {
        if (playerData.status === 'active') {
          players.push({
            name: playerData.name,
            role: playerData.role as any, // Convert to LanePosition
            comfortHeroes: [],
            notes: `${team.teamName} - ${team.teamCode}`,
            createdAt: new Date(),
          });
        }
      }
    }

    if (players.length > 0) {
      await database.players.bulkAdd(players);
      console.log(`[MLBBDraftAnalystDB] Seeded ${players.length} players from rosters.`);
    }
  } else {
    console.log(`[MLBBDraftAnalystDB] Players table already populated (${playerCount} players found).`);
  }
}

export default db;
