'use client';

import Dexie, { type EntityTable } from 'dexie';

export const SCRIM_ROLES = ['EXP', 'Jungle', 'Mid', 'Gold', 'Roam'] as const;

export type ScrimRole = (typeof SCRIM_ROLES)[number];
export type ScrimSide = 'Blue' | 'Red';
export type ScrimResult = 'Win' | 'Loss';
export type ScrimStatus = 'Draft' | 'Complete' | 'Reviewed';
export type ObjectiveOwner = 'Us' | 'Opponent' | 'None';

export interface ScrimPlayerGame {
  id: string;
  playerName: string;
  role: ScrimRole;
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  damageDealt: number;
  damageTaken: number;
  turretDamage: number;
  notes: string;
}

export interface ScrimGame {
  id: string;
  number: number;
  side: ScrimSide;
  result: ScrimResult;
  durationMinutes: number;
  teamKills: number;
  enemyKills: number;
  turtlesFor: number;
  turtlesAgainst: number;
  lordsFor: number;
  lordsAgainst: number;
  towersFor: number;
  towersAgainst: number;
  firstTurtle: ObjectiveOwner;
  firstLord: ObjectiveOwner;
  goldDiff5: number;
  goldDiff10: number;
  goldDiff15: number;
  ourPicks: string[];
  enemyPicks: string[];
  ourBans: string[];
  enemyBans: string[];
  players: ScrimPlayerGame[];
  notes: string;
}

export interface ScrimSession {
  id: string;
  opponent: string;
  date: string;
  time: string;
  patch: string;
  roster: string;
  focus: string;
  status: ScrimStatus;
  games: ScrimGame[];
  sessionNotes: string;
  createdAt: string;
  updatedAt: string;
}

class ScrimTrackerDatabase extends Dexie {
  sessions!: EntityTable<ScrimSession, 'id'>;

  constructor() {
    super('ChalizeScrimTracker');
    this.version(1).stores({
      sessions: 'id, opponent, date, status, updatedAt',
    });
  }
}

let database: ScrimTrackerDatabase | null = null;

export function getScrimDatabase() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!database) {
    database = new ScrimTrackerDatabase();
  }

  return database;
}

export function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createPlayerRow(role: ScrimRole): ScrimPlayerGame {
  return {
    id: makeId('player'),
    playerName: '',
    role,
    hero: '',
    kills: 0,
    deaths: 0,
    assists: 0,
    gold: 0,
    damageDealt: 0,
    damageTaken: 0,
    turretDamage: 0,
    notes: '',
  };
}

export function createScrimGame(number: number): ScrimGame {
  return {
    id: makeId('game'),
    number,
    side: number % 2 === 1 ? 'Blue' : 'Red',
    result: 'Win',
    durationMinutes: 15,
    teamKills: 0,
    enemyKills: 0,
    turtlesFor: 0,
    turtlesAgainst: 0,
    lordsFor: 0,
    lordsAgainst: 0,
    towersFor: 0,
    towersAgainst: 0,
    firstTurtle: 'None',
    firstLord: 'None',
    goldDiff5: 0,
    goldDiff10: 0,
    goldDiff15: 0,
    ourPicks: [],
    enemyPicks: [],
    ourBans: [],
    enemyBans: [],
    players: SCRIM_ROLES.map(createPlayerRow),
    notes: '',
  };
}

export function createScrimSession(): ScrimSession {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);

  return {
    id: makeId('session'),
    opponent: '',
    date: localDate,
    time: now.toTimeString().slice(0, 5),
    patch: '',
    roster: '',
    focus: '',
    status: 'Draft',
    games: [createScrimGame(1)],
    sessionNotes: '',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function parseHeroList(value: string) {
  return value
    .split(',')
    .map((hero) => hero.trim())
    .filter(Boolean);
}

export function formatHeroList(heroes: string[]) {
  return heroes.join(', ');
}

export function safeRate(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

export function playerDerivedStats(player: ScrimPlayerGame, game: ScrimGame) {
  const minutes = Math.max(game.durationMinutes, 1);

  return {
    kda: (player.kills + player.assists) / Math.max(player.deaths, 1),
    kp: safeRate(player.kills + player.assists, game.teamKills) * 100,
    gpm: player.gold / minutes,
    dpm: player.damageDealt / minutes,
    dtpm: player.damageTaken / minutes,
    turretDpm: player.turretDamage / minutes,
  };
}

export async function listScrimSessions() {
  const db = getScrimDatabase();
  if (!db) return [];
  return db.sessions.orderBy('updatedAt').reverse().toArray();
}

export async function saveScrimSession(session: ScrimSession) {
  const db = getScrimDatabase();
  if (!db) return;
  await db.sessions.put(session);
}
