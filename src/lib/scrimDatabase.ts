'use client';

import Dexie, { type EntityTable } from 'dexie';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const SCRIM_ROLES = ['EXP', 'Jungle', 'Mid', 'Gold', 'Roam'] as const;

export type ScrimRole = (typeof SCRIM_ROLES)[number];
export type ScrimSide = 'Blue' | 'Red';
export type ScrimResult = 'Win' | 'Loss';
export type ScrimStatus = 'Draft' | 'Complete' | 'Reviewed' | 'Shared';
export type ObjectiveOwner = 'Us' | 'Opponent' | 'None';
export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

export interface ScrimAccess {
  mode: 'local' | 'cloud' | 'blocked';
  workspaceId: string | null;
  workspaceName: string;
  userId: string | null;
  email: string;
  role: WorkspaceRole | null;
  canEdit: boolean;
}

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
  ourGold5: number;
  enemyGold5: number;
  ourGold10: number;
  enemyGold10: number;
  ourGold15: number;
  enemyGold15: number;
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
    ourGold5: 0,
    enemyGold5: 0,
    ourGold10: 0,
    enemyGold10: 0,
    ourGold15: 0,
    enemyGold15: 0,
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

async function listLocalScrimSessions() {
  const db = getScrimDatabase();
  if (!db) return [];
  return db.sessions.orderBy('updatedAt').reverse().toArray();
}

async function saveLocalScrimSession(session: ScrimSession) {
  const db = getScrimDatabase();
  if (!db) return;
  await db.sessions.put(session);
}

async function deleteLocalScrimSession(sessionId: string) {
  const db = getScrimDatabase();
  if (!db) return;
  await db.sessions.delete(sessionId);
}

export async function resolveScrimAccess(): Promise<ScrimAccess> {
  if (!isSupabaseConfigured) {
    return {
      mode: 'local',
      workspaceId: null,
      workspaceName: 'Local workspace',
      userId: null,
      email: '',
      role: null,
      canEdit: true,
    };
  }

  const supabase = createSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      mode: 'blocked',
      workspaceId: null,
      workspaceName: '',
      userId: null,
      email: '',
      role: null,
      canEdit: false,
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership) {
    return {
      mode: 'blocked',
      workspaceId: null,
      workspaceName: '',
      userId: user.id,
      email: user.email ?? '',
      role: null,
      canEdit: false,
    };
  }

  const role = membership.role as WorkspaceRole;
  const workspaceValue = membership.workspaces as
    | { name?: string }
    | Array<{ name?: string }>
    | null;
  const workspaceName = Array.isArray(workspaceValue)
    ? workspaceValue[0]?.name
    : workspaceValue?.name;

  return {
    mode: 'cloud',
    workspaceId: membership.workspace_id as string,
    workspaceName: workspaceName ?? 'Team workspace',
    userId: user.id,
    email: user.email ?? '',
    role,
    canEdit: role === 'owner' || role === 'editor',
  };
}

function sessionRow(session: ScrimSession, access: ScrimAccess) {
  return {
    id: session.id,
    workspace_id: access.workspaceId,
    created_by: access.userId,
    opponent: session.opponent,
    session_date: session.date || null,
    status: session.status,
    data: session,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

export async function listScrimSessions(access?: ScrimAccess) {
  if (!access || access.mode === 'local') {
    return listLocalScrimSessions();
  }

  if (access.mode === 'blocked' || !access.workspaceId) return [];

  const supabase = createSupabaseClient();
  if (!supabase) return listLocalScrimSessions();

  const { data, error } = await supabase
    .from('scrim_sessions')
    .select('data')
    .eq('workspace_id', access.workspaceId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => row.data as ScrimSession);
}

export async function saveScrimSession(
  session: ScrimSession,
  access?: ScrimAccess,
) {
  await saveLocalScrimSession(session);

  if (!access || access.mode === 'local') return 'local' as const;
  if (access.mode !== 'cloud' || !access.canEdit) return 'readonly' as const;

  const supabase = createSupabaseClient();
  if (!supabase) return 'local' as const;

  const { error } = await supabase
    .from('scrim_sessions')
    .upsert(sessionRow(session, access), { onConflict: 'id' });

  if (error) throw new Error(error.message);
  return 'cloud' as const;
}

export async function deleteScrimSession(
  sessionId: string,
  access?: ScrimAccess,
) {
  if (access?.mode === 'blocked' || (access && !access.canEdit)) {
    throw new Error('This workspace is read only.');
  }

  if (access?.mode === 'cloud') {
    if (!access.workspaceId) throw new Error('Workspace is not available.');
    const supabase = createSupabaseClient();
    if (!supabase) throw new Error('Supabase client is not configured.');

    const { error } = await supabase
      .from('scrim_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('workspace_id', access.workspaceId);

    if (error) throw new Error(error.message);
  }

  await deleteLocalScrimSession(sessionId);
  return access?.mode === 'cloud' ? ('cloud' as const) : ('local' as const);
}

function pendingLocalSessions(
  localSessions: ScrimSession[],
  cloudSessions: ScrimSession[],
) {
  const cloudUpdates = new Map(
    cloudSessions.map((session) => [session.id, session.updatedAt]),
  );

  return localSessions.filter((session) => {
    const cloudUpdatedAt = cloudUpdates.get(session.id);
    return !cloudUpdatedAt || session.updatedAt > cloudUpdatedAt;
  });
}

export async function countUnsyncedLocalScrimSessions(
  cloudSessions: ScrimSession[],
) {
  const localSessions = await listLocalScrimSessions();
  return pendingLocalSessions(localSessions, cloudSessions).length;
}

export async function migrateLocalScrimSessions(access: ScrimAccess) {
  if (
    access.mode !== 'cloud' ||
    !access.canEdit ||
    !access.workspaceId ||
    !access.userId
  ) {
    throw new Error('Only an owner or editor can migrate local scrims.');
  }

  const [localSessions, cloudSessions] = await Promise.all([
    listLocalScrimSessions(),
    listScrimSessions(access),
  ]);
  const sessions = pendingLocalSessions(localSessions, cloudSessions);
  if (sessions.length === 0) return 0;

  const supabase = createSupabaseClient();
  if (!supabase) throw new Error('Supabase client is not configured.');

  const { error } = await supabase
    .from('scrim_sessions')
    .upsert(
      sessions.map((session) => sessionRow(session, access)),
      { onConflict: 'id' },
    );

  if (error) throw new Error(error.message);
  return sessions.length;
}
