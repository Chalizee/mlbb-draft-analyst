import { HERO_DATA } from '@/data/heroData';

export type ScoutingRole = 'EXP' | 'JUNGLE' | 'MID' | 'GOLD' | 'ROAM';
export type ScoutingSignal = 'UNDERVALUED' | 'BALANCED' | 'CONTEXT_BOOSTED';

export interface PlayerHeroProfile {
  name: string;
  games: number;
  wins: number;
  winRate: number;
  kda?: number;
  avgKills?: number;
  avgDeaths?: number;
  avgAssists?: number;
  kp?: number;
  gpm?: number;
  dpm?: number;
  dtpm?: number;
  buildingDpm?: number;
}

export interface PlayerMatchProfile {
  battleCode: string;
  date: string;
  tournament: string;
  stage: string;
  opponent: string;
  side: 'BLUE' | 'RED' | 'UNKNOWN';
  win: boolean;
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  kp: number;
  gpm: number;
  dpm: number;
  dtpm: number;
  buildingDpm: number;
  goldShare: number;
  damageShare: number;
  damageTakenShare: number;
}

export interface PlayerScoutingProfile {
  id: string;
  name: string;
  playerCode: string;
  team: string;
  role: ScoutingRole;
  roleConfidence: number;
  matches: number;
  wins: number;
  winRate: number;
  kda: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  heroPool: number;
  impactScore: number;
  surfaceScore: number;
  confidence: number;
  dependencyRisk: number;
  signal: ScoutingSignal;
  metrics: {
    kp: number;
    gpm: number;
    dpm: number;
    dtpm: number;
    buildingDpm: number;
    goldShare: number;
    damageShare: number;
    damageTakenShare: number;
    damageEfficiency: number;
    controlPerMinute: number;
    healPerMinute: number;
    objectivesPerGame: number;
    versatility: number;
  };
  percentiles: Record<MetricKey, number>;
  heroes: PlayerHeroProfile[];
  matchHistory?: PlayerMatchProfile[];
}

export interface TeamScoutingProfile {
  name: string;
  matches: number;
  wins: number;
  winRate: number;
  blueMatches: number;
  blueWinRate: number;
  redMatches: number;
  redWinRate: number;
  avgGameMinutes: number;
  avgKills: number;
  avgTurtles: number;
  avgLords: number;
  avgTowers: number;
  draftDiversity: number;
  topPicks: Array<{ name: string; count: number }>;
  topBans: Array<{ name: string; count: number }>;
  firstPhasePicks: Array<{ name: string; count: number }>;
  firstPhaseBans: Array<{ name: string; count: number }>;
}

export interface QualityIssue {
  severity: 'warning' | 'info';
  title: string;
  detail: string;
  count: number;
}

export interface ScoutingReport {
  meta: {
    matches: number;
    playerRows: number;
    teamRows: number;
    players: number;
    teams: number;
    heroes: number;
    tournaments: string[];
    stages: string[];
  };
  players: PlayerScoutingProfile[];
  teams: TeamScoutingProfile[];
  contestedHeroes: Array<{ name: string; picks: number; bans: number; presence: number }>;
  quality: QualityIssue[];
  generatedAt: string;
}

type MetricKey =
  | 'farm'
  | 'damage'
  | 'damageEfficiency'
  | 'survival'
  | 'teamwork'
  | 'pressure'
  | 'frontline'
  | 'control'
  | 'healing'
  | 'objective'
  | 'versatility'
  | 'lowResource';

interface PlayerGame {
  battleCode: string;
  date: string;
  stage: string;
  tournament: string;
  team: string;
  enemyTeam: string;
  side: 'BLUE' | 'RED' | 'UNKNOWN';
  win: boolean;
  player: string;
  playerCode: string;
  hero: string;
  spell: string;
  equips: string;
  emblem: string;
  kills: number;
  deaths: number;
  assists: number;
  kp: number;
  gpm: number;
  dpm: number;
  dtpm: number;
  buildingDpm: number;
  goldShare: number;
  damageShare: number;
  damageTakenShare: number;
  controlTime: number;
  heal: number;
  turtleKills: number;
  lordKills: number;
  timeSeconds: number;
  inferredRole?: ScoutingRole;
}

interface TeamGame {
  battleCode: string;
  team: string;
  side: 'BLUE' | 'RED' | 'UNKNOWN';
  win: boolean;
  picks: string[];
  bans: string[];
  kills: number;
  turtles: number;
  lords: number;
  towers: number;
  timeSeconds: number;
}

interface ParsedCsv {
  headers: string[];
  rows: string[][];
  index: Map<string, number>;
}

const ROLES: ScoutingRole[] = ['EXP', 'JUNGLE', 'MID', 'GOLD', 'ROAM'];
const ROLE_PERMUTATIONS = createPermutations(ROLES);

const ROLE_WEIGHTS: Record<ScoutingRole, Partial<Record<MetricKey, number>>> = {
  EXP: {
    damageEfficiency: 18,
    frontline: 18,
    survival: 15,
    teamwork: 14,
    pressure: 16,
    versatility: 12,
    objective: 7,
  },
  JUNGLE: {
    objective: 22,
    farm: 18,
    teamwork: 18,
    damageEfficiency: 16,
    survival: 12,
    versatility: 14,
  },
  MID: {
    teamwork: 20,
    damageEfficiency: 18,
    control: 16,
    damage: 16,
    survival: 10,
    versatility: 20,
  },
  GOLD: {
    damage: 22,
    damageEfficiency: 20,
    pressure: 18,
    survival: 16,
    farm: 12,
    versatility: 12,
  },
  ROAM: {
    teamwork: 24,
    control: 18,
    frontline: 16,
    lowResource: 12,
    survival: 10,
    healing: 8,
    versatility: 12,
  },
};

const HEADER_ALIASES: Record<string, string[]> = {
  battleCode: ['Battle Code'],
  player: ['Player'],
  playerCode: ['Player Code'],
  team: ['Team'],
  enemyTeam: ['Enemy Team'],
  hero: ['Hero'],
  result: ['Result'],
  side: ['Side'],
  stage: ['Stage'],
  date: ['Date'],
  tournament: ['Tournament'],
  spell: ['Battle Spell'],
  equips: ['Equips'],
  emblem: ['Emblem'],
  kills: ['Kills'],
  deaths: ['Deaths'],
  assists: ['Assists'],
  kp: ['Kill Participation%'],
  gpm: ['Gold per Minute'],
  dpm: ['Damage per Minute'],
  dtpm: ['Damage Taken per Minute'],
  buildingDpm: ['Building Damage per Minute'],
  goldShare: ['Gold Share%'],
  damageShare: ['Damage Share%'],
  damageTakenShare: ['Damage Taken Share%'],
  controlTime: ['Control Time/s'],
  heal: ['Heal'],
  turtleKills: ['Cryoturtle Kill Count'],
  lordKills: ['Lord Kill Count'],
  timeSeconds: ['Time/s'],
  pick: ['Pick'],
  ban: ['Ban'],
  towers: ['Tower Destroy Count'],
};

export function analyzeScoutingCSVs(playerCsv: string, teamCsv: string): ScoutingReport {
  const parsedPlayers = parseCsv(playerCsv);
  const parsedTeams = parseCsv(teamCsv);

  assertHeaders(parsedPlayers, [
    'battleCode',
    'player',
    'team',
    'hero',
    'result',
    'gpm',
    'dpm',
  ], 'Player Match Record');
  assertHeaders(parsedTeams, ['battleCode', 'team', 'result', 'pick', 'ban'], 'Team Match Record');

  const playerGames = parsedPlayers.rows
    .map((row) => parsePlayerGame(parsedPlayers, row))
    .filter((row): row is PlayerGame => Boolean(row));
  const teamGames = parsedTeams.rows
    .map((row) => parseTeamGame(parsedTeams, row))
    .filter((row): row is TeamGame => Boolean(row));

  if (playerGames.length === 0 || teamGames.length === 0) {
    throw new Error('CSV terbaca, tetapi tidak ada record pertandingan yang valid.');
  }

  inferLineupRoles(playerGames);
  const players = aggregatePlayers(playerGames);
  applyRoleBenchmarks(players);
  const teams = aggregateTeams(teamGames);
  const quality = buildQualityReport(parsedPlayers, parsedTeams, playerGames, teamGames, players);
  const contestedHeroes = aggregateContestedHeroes(teamGames);

  const battleCodes = new Set(playerGames.map((row) => row.battleCode));
  const tournaments = unique(playerGames.map((row) => row.tournament).filter(Boolean));
  const stages = unique(playerGames.map((row) => row.stage).filter(Boolean));

  return {
    meta: {
      matches: battleCodes.size,
      playerRows: playerGames.length,
      teamRows: teamGames.length,
      players: players.length,
      teams: teams.length,
      heroes: unique(playerGames.map((row) => row.hero)).length,
      tournaments,
      stages,
    },
    players: players.sort((a, b) => b.impactScore - a.impactScore),
    teams: teams.sort((a, b) => b.winRate - a.winRate),
    contestedHeroes,
    quality,
    generatedAt: new Date().toISOString(),
  };
}

export function overridePlayerRole(
  report: ScoutingReport,
  playerId: string,
  role: ScoutingRole,
): ScoutingReport {
  const players = report.players.map((player) => ({
    ...player,
    role: player.id === playerId ? role : player.role,
    roleConfidence: player.id === playerId ? 100 : player.roleConfidence,
    impactScore: 0,
    surfaceScore: 0,
    confidence: 0,
    dependencyRisk: 0,
    signal: 'BALANCED' as ScoutingSignal,
    percentiles: emptyPercentiles(),
  }));

  applyRoleBenchmarks(players);
  const roleReviewCount = players.filter((player) => player.roleConfidence < 60).length;
  const quality = report.quality
    .map((issue) =>
      issue.title === 'Role needs review'
        ? { ...issue, count: roleReviewCount }
        : issue,
    )
    .filter((issue) => issue.title !== 'Role needs review' || issue.count > 0);

  return {
    ...report,
    players: players.sort((a, b) => b.impactScore - a.impactScore),
    quality,
    generatedAt: new Date().toISOString(),
  };
}

function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error('File CSV kosong.');
  }

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, '').trim());
  const index = new Map(headers.map((header, idx) => [normalizeHeader(header), idx]));

  return {
    headers,
    index,
    rows: rows.slice(1),
  };
}

function assertHeaders(csv: ParsedCsv, keys: string[], label: string) {
  const missing = keys.filter((key) => findColumn(csv, key) === -1);
  if (missing.length > 0) {
    const readable = missing.map((key) => HEADER_ALIASES[key]?.[0] ?? key).join(', ');
    throw new Error(`${label} tidak cocok. Kolom yang belum ditemukan: ${readable}.`);
  }
}

function findColumn(csv: ParsedCsv, key: string): number {
  for (const alias of HEADER_ALIASES[key] ?? [key]) {
    const index = csv.index.get(normalizeHeader(alias));
    if (index !== undefined) return index;
  }
  return -1;
}

function getValue(csv: ParsedCsv, row: string[], key: string): string {
  const index = findColumn(csv, key);
  return index >= 0 ? (row[index] ?? '').trim() : '';
}

function parsePlayerGame(csv: ParsedCsv, row: string[]): PlayerGame | null {
  const battleCode = getValue(csv, row, 'battleCode');
  const player = getValue(csv, row, 'player');
  const team = getValue(csv, row, 'team');
  const hero = getValue(csv, row, 'hero');

  if (!battleCode || !player || !team || !hero) return null;

  return {
    battleCode,
    date: getValue(csv, row, 'date'),
    stage: getValue(csv, row, 'stage'),
    tournament: getValue(csv, row, 'tournament'),
    team,
    enemyTeam: getValue(csv, row, 'enemyTeam'),
    side: normalizeSourceSide(getValue(csv, row, 'side')),
    win: isWin(getValue(csv, row, 'result')),
    player,
    playerCode: getValue(csv, row, 'playerCode') || `${team}:${normalizeName(player)}`,
    hero,
    spell: getValue(csv, row, 'spell'),
    equips: getValue(csv, row, 'equips'),
    emblem: getValue(csv, row, 'emblem'),
    kills: toNumber(getValue(csv, row, 'kills')),
    deaths: toNumber(getValue(csv, row, 'deaths')),
    assists: toNumber(getValue(csv, row, 'assists')),
    kp: toNumber(getValue(csv, row, 'kp')),
    gpm: toNumber(getValue(csv, row, 'gpm')),
    dpm: toNumber(getValue(csv, row, 'dpm')),
    dtpm: toNumber(getValue(csv, row, 'dtpm')),
    buildingDpm: toNumber(getValue(csv, row, 'buildingDpm')),
    goldShare: toNumber(getValue(csv, row, 'goldShare')),
    damageShare: toNumber(getValue(csv, row, 'damageShare')),
    damageTakenShare: toNumber(getValue(csv, row, 'damageTakenShare')),
    controlTime: toNumber(getValue(csv, row, 'controlTime')),
    heal: toNumber(getValue(csv, row, 'heal')),
    turtleKills: toNumber(getValue(csv, row, 'turtleKills')),
    lordKills: toNumber(getValue(csv, row, 'lordKills')),
    timeSeconds: toNumber(getValue(csv, row, 'timeSeconds')),
  };
}

function parseTeamGame(csv: ParsedCsv, row: string[]): TeamGame | null {
  const battleCode = getValue(csv, row, 'battleCode');
  const team = getValue(csv, row, 'team');
  if (!battleCode || !team) return null;

  return {
    battleCode,
    team,
    side: normalizeSourceSide(getValue(csv, row, 'side')),
    win: isWin(getValue(csv, row, 'result')),
    picks: parseOrderedHeroList(getValue(csv, row, 'pick')),
    bans: parseOrderedHeroList(getValue(csv, row, 'ban')),
    kills: toNumber(getValue(csv, row, 'kills')),
    turtles: toNumber(getValue(csv, row, 'turtleKills')),
    lords: toNumber(getValue(csv, row, 'lordKills')),
    towers: toNumber(getValue(csv, row, 'towers')),
    timeSeconds: toNumber(getValue(csv, row, 'timeSeconds')),
  };
}

function inferLineupRoles(games: PlayerGame[]) {
  const lineups = groupBy(games, (game) => `${game.battleCode}::${game.team}`);

  for (const lineup of lineups.values()) {
    const goldShares = lineup.map((game) => game.goldShare);
    const minGold = Math.min(...goldShares);
    const maxGold = Math.max(...goldShares);

    if (lineup.length === 5) {
      let bestScore = Number.NEGATIVE_INFINITY;
      let bestAssignment = ROLE_PERMUTATIONS[0];

      for (const assignment of ROLE_PERMUTATIONS) {
        const score = assignment.reduce(
          (total, role, index) =>
            total + roleFitScore(lineup[index], role, minGold, maxGold),
          0,
        );
        if (score > bestScore) {
          bestScore = score;
          bestAssignment = assignment;
        }
      }

      lineup.forEach((game, index) => {
        game.inferredRole = bestAssignment[index];
      });
    } else {
      lineup.forEach((game) => {
        game.inferredRole = [...ROLES].sort(
          (a, b) =>
            roleFitScore(game, b, minGold, maxGold) -
            roleFitScore(game, a, minGold, maxGold),
        )[0];
      });
    }
  }
}

function roleFitScore(
  game: PlayerGame,
  role: ScoutingRole,
  minGold: number,
  maxGold: number,
): number {
  const normalizedHero = normalizeName(game.hero);
  const hero = HERO_DATA.find(
    (item) =>
      normalizeName(item.name) === normalizedHero ||
      normalizeName(item.slug) === normalizedHero,
  );
  const recommendations = (hero?.laneRecommendation ?? []).map((lane) =>
    lane.toUpperCase() === 'EXP' ? 'EXP' : (lane.toUpperCase() as ScoutingRole),
  );
  const primary = recommendations[0];
  const spell = game.spell.toLowerCase();
  const equips = game.equips.toLowerCase();
  const emblem = game.emblem.toLowerCase();
  const hasRetribution = spell.includes('retribution');
  const hasRoamBlessing = /conceal|encourage|favor|dire hit|roam/.test(equips);

  let score = 0;
  if (recommendations.includes(role)) score += primary === role ? 85 : 52;

  if (role === 'JUNGLE') {
    if (hasRetribution) score += 220;
    if (emblem.includes('assassin')) score += 18;
  } else if (hasRetribution) {
    score -= 130;
  }

  if (role === 'ROAM') {
    if (hasRoamBlessing) score += 200;
    if (game.goldShare === minGold) score += 72;
    if (emblem.includes('tank') || emblem.includes('support')) score += 20;
    score += Math.min(24, game.controlTime / 80);
  } else if (hasRoamBlessing) {
    score -= 90;
  }

  if (role === 'GOLD') {
    if (game.goldShare === maxGold) score += 38;
    if (hero?.role === 'Marksman') score += 34;
    score += Math.max(0, game.damageShare - game.goldShare) * 1.2;
  }

  if (role === 'MID') {
    if (hero?.role === 'Mage') score += 30;
    if (emblem.includes('mage')) score += 16;
    score += Math.min(18, game.controlTime / 100);
  }

  if (role === 'EXP') {
    if (hero?.role === 'Fighter' || hero?.role === 'Tank') score += 22;
    if (emblem.includes('fighter')) score += 14;
    score += Math.max(0, game.damageTakenShare - 18) * 0.8;
  }

  return score;
}

function aggregatePlayers(games: PlayerGame[]): PlayerScoutingProfile[] {
  const groups = groupBy(games, (game) => game.playerCode);
  const profiles: PlayerScoutingProfile[] = [];

  for (const [playerCode, rows] of groups.entries()) {
    const name = mostCommon(rows.map((row) => row.player));
    const team = mostCommon(rows.map((row) => row.team));
    const roleCounts = countBy(rows.map((row) => row.inferredRole ?? 'GOLD'));
    const role = [...ROLES].sort(
      (a, b) => (roleCounts.get(b) ?? 0) - (roleCounts.get(a) ?? 0),
    )[0];
    const roleConfidence = (roleCounts.get(role) ?? 0) / rows.length;
    const wins = rows.filter((row) => row.win).length;
    const totalDeaths = sum(rows, (row) => row.deaths);
    const heroGroups = groupBy(rows, (row) => row.hero);
    const heroes = [...heroGroups.entries()]
      .map(([heroName, heroRows]) => {
        const heroWins = heroRows.filter((row) => row.win).length;
        const heroDeaths = sum(heroRows, (row) => row.deaths);
        return {
          name: heroName,
          games: heroRows.length,
          wins: heroWins,
          winRate: round((heroWins / heroRows.length) * 100),
          kda: round(
            (sum(heroRows, (row) => row.kills) +
              sum(heroRows, (row) => row.assists)) /
              Math.max(1, heroDeaths),
            2,
          ),
          avgKills: round(average(heroRows.map((row) => row.kills)), 1),
          avgDeaths: round(average(heroRows.map((row) => row.deaths)), 1),
          avgAssists: round(average(heroRows.map((row) => row.assists)), 1),
          kp: round(average(heroRows.map((row) => row.kp)), 1),
          gpm: round(average(heroRows.map((row) => row.gpm))),
          dpm: round(average(heroRows.map((row) => row.dpm))),
          dtpm: round(average(heroRows.map((row) => row.dtpm))),
          buildingDpm: round(average(heroRows.map((row) => row.buildingDpm))),
        };
      })
      .sort((a, b) => b.games - a.games);

    const avgGameMinutes = average(
      rows.map((row) => (row.timeSeconds > 0 ? row.timeSeconds / 60 : 0)),
    );
    const controlPerMinute =
      avgGameMinutes > 0 ? average(rows.map((row) => row.controlTime)) / avgGameMinutes : 0;
    const healPerMinute =
      avgGameMinutes > 0 ? average(rows.map((row) => row.heal)) / avgGameMinutes : 0;
    const heroShares = heroes.map((hero) => hero.games / rows.length);
    const hhi = heroShares.reduce((total, share) => total + share * share, 0);
    const versatility =
      rows.length > 1
        ? (1 - hhi) * 100 * Math.min(1, Math.sqrt(rows.length / 8))
        : 0;

    const goldShare = average(rows.map((row) => row.goldShare));
    const damageShare = average(rows.map((row) => row.damageShare));

    profiles.push({
      id: playerCode,
      name,
      playerCode,
      team,
      role,
      roleConfidence: round(roleConfidence * 100),
      matches: rows.length,
      wins,
      winRate: round((wins / rows.length) * 100),
      kda: round(
        (sum(rows, (row) => row.kills) + sum(rows, (row) => row.assists)) /
          Math.max(1, totalDeaths),
        2,
      ),
      avgKills: round(average(rows.map((row) => row.kills)), 1),
      avgDeaths: round(average(rows.map((row) => row.deaths)), 1),
      avgAssists: round(average(rows.map((row) => row.assists)), 1),
      heroPool: heroes.length,
      impactScore: 0,
      surfaceScore: 0,
      confidence: 0,
      dependencyRisk: 0,
      signal: 'BALANCED',
      metrics: {
        kp: round(average(rows.map((row) => row.kp)), 1),
        gpm: round(average(rows.map((row) => row.gpm))),
        dpm: round(average(rows.map((row) => row.dpm))),
        dtpm: round(average(rows.map((row) => row.dtpm))),
        buildingDpm: round(average(rows.map((row) => row.buildingDpm))),
        goldShare: round(goldShare, 1),
        damageShare: round(damageShare, 1),
        damageTakenShare: round(
          average(rows.map((row) => row.damageTakenShare)),
          1,
        ),
        damageEfficiency: round(damageShare - goldShare, 1),
        controlPerMinute: round(controlPerMinute, 1),
        healPerMinute: round(healPerMinute),
        objectivesPerGame: round(
          average(rows.map((row) => row.turtleKills + row.lordKills)),
          2,
        ),
        versatility: round(versatility, 1),
      },
      percentiles: emptyPercentiles(),
      heroes,
      matchHistory: [...rows]
        .sort((a, b) => {
          const dateOrder = b.date.localeCompare(a.date);
          return dateOrder !== 0
            ? dateOrder
            : b.battleCode.localeCompare(a.battleCode);
        })
        .map((row) => ({
          battleCode: row.battleCode,
          date: row.date,
          tournament: row.tournament,
          stage: row.stage,
          opponent: row.enemyTeam,
          side: row.side,
          win: row.win,
          hero: row.hero,
          kills: row.kills,
          deaths: row.deaths,
          assists: row.assists,
          kda: round(
            (row.kills + row.assists) / Math.max(1, row.deaths),
            2,
          ),
          kp: round(row.kp, 1),
          gpm: round(row.gpm),
          dpm: round(row.dpm),
          dtpm: round(row.dtpm),
          buildingDpm: round(row.buildingDpm),
          goldShare: round(row.goldShare, 1),
          damageShare: round(row.damageShare, 1),
          damageTakenShare: round(row.damageTakenShare, 1),
        })),
    });
  }

  return profiles;
}

function applyRoleBenchmarks(players: PlayerScoutingProfile[]) {
  const roleGroups = groupBy(players, (player) => player.role);

  for (const rolePlayers of roleGroups.values()) {
    const values: Record<MetricKey, number[]> = {
      farm: rolePlayers.map((player) => player.metrics.gpm),
      damage: rolePlayers.map((player) => player.metrics.dpm),
      damageEfficiency: rolePlayers.map((player) => player.metrics.damageEfficiency),
      survival: rolePlayers.map((player) => -player.avgDeaths),
      teamwork: rolePlayers.map((player) => player.metrics.kp),
      pressure: rolePlayers.map((player) => player.metrics.buildingDpm),
      frontline: rolePlayers.map((player) => player.metrics.damageTakenShare),
      control: rolePlayers.map((player) => player.metrics.controlPerMinute),
      healing: rolePlayers.map((player) => player.metrics.healPerMinute),
      objective: rolePlayers.map((player) => player.metrics.objectivesPerGame),
      versatility: rolePlayers.map((player) => player.metrics.versatility),
      lowResource: rolePlayers.map((player) => -player.metrics.goldShare),
    };

    const winRates = rolePlayers.map((player) => player.winRate);
    const kdas = rolePlayers.map((player) => player.kda);
    const goldShares = rolePlayers.map((player) => player.metrics.goldShare);

    rolePlayers.forEach((player) => {
      const metricValues: Record<MetricKey, number> = {
        farm: player.metrics.gpm,
        damage: player.metrics.dpm,
        damageEfficiency: player.metrics.damageEfficiency,
        survival: -player.avgDeaths,
        teamwork: player.metrics.kp,
        pressure: player.metrics.buildingDpm,
        frontline: player.metrics.damageTakenShare,
        control: player.metrics.controlPerMinute,
        healing: player.metrics.healPerMinute,
        objective: player.metrics.objectivesPerGame,
        versatility: player.metrics.versatility,
        lowResource: -player.metrics.goldShare,
      };

      for (const metric of Object.keys(metricValues) as MetricKey[]) {
        player.percentiles[metric] = percentile(metricValues[metric], values[metric]);
      }

      const weights = ROLE_WEIGHTS[player.role];
      const totalWeight = Object.values(weights).reduce((total, weight) => total + (weight ?? 0), 0);
      const rawImpact =
        (Object.entries(weights) as Array<[MetricKey, number]>).reduce(
          (total, [metric, weight]) => total + player.percentiles[metric] * weight,
          0,
        ) / totalWeight;

      const sampleConfidence = Math.min(100, Math.sqrt(player.matches / 20) * 100);
      player.confidence = round(
        sampleConfidence * (0.8 + (player.roleConfidence / 100) * 0.2),
      );
      const confidenceFactor = 0.2 + (player.confidence / 100) * 0.8;
      player.impactScore = round(50 + (rawImpact - 50) * confidenceFactor, 1);

      const winRatePercentile = percentile(player.winRate, winRates);
      const kdaPercentile = percentile(player.kda, kdas);
      player.surfaceScore = round(winRatePercentile * 0.55 + kdaPercentile * 0.45, 1);

      const resourceDemand = percentile(player.metrics.goldShare, goldShares);
      const supportedImpact =
        (player.percentiles.damageEfficiency +
          player.percentiles.teamwork +
          player.percentiles.objective) /
        3;
      player.dependencyRisk = round(Math.max(0, resourceDemand - supportedImpact));

      const gap = player.impactScore - player.surfaceScore;
      player.signal =
        gap >= 10 ? 'UNDERVALUED' : gap <= -12 ? 'CONTEXT_BOOSTED' : 'BALANCED';
    });
  }
}

function aggregateTeams(games: TeamGame[]): TeamScoutingProfile[] {
  const groups = groupBy(games, (game) => game.team);

  return [...groups.entries()].map(([team, rows]) => {
    const wins = rows.filter((row) => row.win).length;
    const blueRows = rows.filter((row) => row.side === 'BLUE');
    const redRows = rows.filter((row) => row.side === 'RED');
    const pickCounts = countBy(rows.flatMap((row) => row.picks));
    const banCounts = countBy(rows.flatMap((row) => row.bans));
    const firstPickCounts = countBy(rows.flatMap((row) => row.picks.slice(0, 3)));
    const firstBanCounts = countBy(rows.flatMap((row) => row.bans.slice(0, 3)));

    return {
      name: team,
      matches: rows.length,
      wins,
      winRate: round((wins / rows.length) * 100),
      blueMatches: blueRows.length,
      blueWinRate:
        blueRows.length > 0
          ? round((blueRows.filter((row) => row.win).length / blueRows.length) * 100)
          : 0,
      redMatches: redRows.length,
      redWinRate:
        redRows.length > 0
          ? round((redRows.filter((row) => row.win).length / redRows.length) * 100)
          : 0,
      avgGameMinutes: round(average(rows.map((row) => row.timeSeconds / 60)), 1),
      avgKills: round(average(rows.map((row) => row.kills)), 1),
      avgTurtles: round(average(rows.map((row) => row.turtles)), 1),
      avgLords: round(average(rows.map((row) => row.lords)), 1),
      avgTowers: round(average(rows.map((row) => row.towers)), 1),
      draftDiversity: new Set(rows.flatMap((row) => row.picks)).size,
      topPicks: topCounts(pickCounts, 5),
      topBans: topCounts(banCounts, 5),
      firstPhasePicks: topCounts(firstPickCounts, 5),
      firstPhaseBans: topCounts(firstBanCounts, 5),
    };
  });
}

function aggregateContestedHeroes(teamGames: TeamGame[]) {
  const picks = countBy(teamGames.flatMap((game) => game.picks));
  const bans = countBy(teamGames.flatMap((game) => game.bans));
  const heroes = unique([...picks.keys(), ...bans.keys()]);

  return heroes
    .map((name) => ({
      name,
      picks: picks.get(name) ?? 0,
      bans: bans.get(name) ?? 0,
      presence: (picks.get(name) ?? 0) + (bans.get(name) ?? 0),
    }))
    .sort((a, b) => b.presence - a.presence)
    .slice(0, 20);
}

function buildQualityReport(
  playerCsv: ParsedCsv,
  teamCsv: ParsedCsv,
  playerGames: PlayerGame[],
  teamGames: TeamGame[],
  players: PlayerScoutingProfile[],
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const aliases = groupBy(playerGames, (game) => game.playerCode);
  const aliasCount = [...aliases.values()].filter(
    (rows) => unique(rows.map((row) => row.player)).length > 1,
  ).length;
  const incompleteBans = teamGames.filter((game) => game.bans.length !== 5).length;
  const lowRoleConfidence = players.filter((player) => player.roleConfidence < 60).length;
  const invalidPlayerRows = playerCsv.rows.length - playerGames.length;
  const invalidTeamRows = teamCsv.rows.length - teamGames.length;
  const unknownSides = teamGames.filter((game) => game.side === 'UNKNOWN').length;
  const numericSideRows = teamCsv.rows.filter((row) => {
    const sourceSide = getValue(teamCsv, row, 'side').trim();
    return sourceSide === '1' || sourceSide === '2';
  }).length;
  const orderedDraftRows = teamGames.filter(
    (game) => game.picks.length > 0 || game.bans.length > 0,
  ).length;
  const inferredRoleRows = findColumn(playerCsv, 'role') === -1 ? playerGames.length : 0;
  const normalizedResults = teamCsv.rows.filter((row) => {
    const result = getValue(teamCsv, row, 'result').toLowerCase();
    return result === '胜' || result === '负';
  }).length;

  if (incompleteBans > 0) {
    issues.push({
      severity: 'warning',
      title: 'Incomplete ban sequences',
      detail: 'Some team rows contain fewer than five bans. They remain usable but are flagged.',
      count: incompleteBans,
    });
  }

  if (lowRoleConfidence > 0) {
    issues.push({
      severity: 'warning',
      title: 'Role needs review',
      detail: 'Role inference was inconsistent across matches for these players.',
      count: lowRoleConfidence,
    });
  }

  if (unknownSides > 0) {
    issues.push({
      severity: 'warning',
      title: 'Unknown side labels',
      detail: 'These rows were not recognized as Blue/1 or Red/2 and need source review.',
      count: unknownSides,
    });
  }

  if (numericSideRows > 0) {
    issues.push({
      severity: 'info',
      title: 'Numeric sides mapped',
      detail: 'Source side 1 is mapped to Blue and source side 2 is mapped to Red.',
      count: numericSideRows,
    });
  }

  if (orderedDraftRows > 0) {
    issues.push({
      severity: 'info',
      title: 'Draft sequence preserved',
      detail: 'Pick and ban heroes keep their original left-to-right source order.',
      count: orderedDraftRows,
    });
  }

  if (aliasCount > 0) {
    issues.push({
      severity: 'info',
      title: 'Player aliases merged',
      detail: 'Different display names sharing the same Player Code were merged automatically.',
      count: aliasCount,
    });
  }

  if (normalizedResults > 0) {
    issues.push({
      severity: 'info',
      title: 'Result labels normalized',
      detail: 'Chinese win/loss labels were converted into one internal format.',
      count: normalizedResults,
    });
  }

  if (inferredRoleRows > 0) {
    issues.push({
      severity: 'info',
      title: 'Roles inferred from lineups',
      detail: 'Each five-player lineup was assigned one EXP, Jungle, Mid, Gold, and Roam.',
      count: inferredRoleRows,
    });
  }

  if (invalidPlayerRows + invalidTeamRows > 0) {
    issues.push({
      severity: 'warning',
      title: 'Rows skipped',
      detail: 'Rows missing essential match, team, player, or hero values were excluded.',
      count: invalidPlayerRows + invalidTeamRows,
    });
  }

  return issues;
}

function emptyPercentiles(): Record<MetricKey, number> {
  return {
    farm: 0,
    damage: 0,
    damageEfficiency: 0,
    survival: 0,
    teamwork: 0,
    pressure: 0,
    frontline: 0,
    control: 0,
    healing: 0,
    objective: 0,
    versatility: 0,
    lowResource: 0,
  };
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9%]+/g, ' ');
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Source contract: numeric side 1 is Blue and numeric side 2 is Red.
 */
export function normalizeSourceSide(value: string): 'BLUE' | 'RED' | 'UNKNOWN' {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'BLUE' || normalized === '1') return 'BLUE';
  if (normalized === 'RED' || normalized === '2') return 'RED';
  return 'UNKNOWN';
}

function isWin(value: string): boolean {
  return ['win', 'w', '胜', '1', 'true'].includes(value.trim().toLowerCase());
}

/**
 * Preserves the source's left-to-right draft order. No sorting is applied.
 */
export function parseOrderedHeroList(value: string): string[] {
  return value
    .split(',')
    .map((hero) => hero.trim())
    .filter(Boolean);
}

function toNumber(value: string): number {
  const parsed = Number.parseFloat(value.replace(/%/g, '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, digits = 0): number {
  const multiplier = 10 ** digits;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function sum<T>(items: T[], getter: (item: T) => number): number {
  return items.reduce((total, item) => total + getter(item), 0);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function groupBy<T, K>(items: T[], getter: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  items.forEach((item) => {
    const key = getter(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  });
  return groups;
}

function countBy<T>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return counts;
}

function mostCommon(values: string[]): string {
  return [...countBy(values).entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

function topCounts(counts: Map<string, number>, limit: number) {
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function percentile(value: number, values: number[]): number {
  if (values.length <= 1) return 50;
  const lower = values.filter((candidate) => candidate < value).length;
  const equal = values.filter((candidate) => candidate === value).length;
  return round(((lower + equal * 0.5) / values.length) * 100, 1);
}

function createPermutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) =>
    createPermutations([...items.slice(0, index), ...items.slice(index + 1)]).map(
      (rest) => [item, ...rest],
    ),
  );
}
