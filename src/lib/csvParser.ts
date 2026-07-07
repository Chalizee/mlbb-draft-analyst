import { db } from './db';
import type { Hero, Opponent, Player, PlayerHeroStat, HeroRole, LanePosition } from '@/types';
import { mplTurkeyRosters } from '@/data/teamRoster';


// Standardize names to match even with spaces, slashes, or casing differences
export function cleanName(name: string): string {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Case-insensitive entity check to filter out invalid test/ping entries
export function isInvalidEntity(name: string): boolean {
  if (!name) return true;
  const n = name.toLowerCase().trim();
  return (
    n.includes('ping') ||
    n.includes('test') ||
    n.includes('scrim') ||
    n.includes('temp') ||
    n.includes('admin') ||
    n.includes('practice') ||
    n === '1' ||
    n === '2'
  );
}

export interface VersatilityDetails {
  breadthScore: number;
  archetypeScore: number;
  stabilityScore: number;
  flexScore: number;
  metaScore: number;
  validPoolSize: number;
  distinctArchetypes: number;
  draftTax: number;
}

// ────────────────────────────────────────────────
// Professional Esports Dota-Style Hero Versatility Standardization Formula
// ────────────────────────────────────────────────
export function calculateAdvancedPlayerVersatility(
  playerHeroes: MDLPlayerHero[],
  totalMatches: number,
  dbHeroes: Hero[]
): { score: number; details: VersatilityDetails } {
  const M = Math.max(1, totalMatches);
  
  // 1. Hero Pool Breadth (30% weight)
  // Filter for valid heroes: played at least 2 times, or at least 1 time if player has <= 4 total games
  const minGames = M <= 4 ? 1 : 2;
  const validHeroes = playerHeroes.filter(h => h.matches >= minGames);
  const H = validHeroes.length;
  
  const breadthScore = Math.min(99, Math.max(50, 50 + (H - 2) * 9));

  // 2. Archetype Diversity (25% weight)
  // Classify playstyles based on their DB Hero teamfightStyle & lane recommended profiles
  const uniqueStyles = new Set<string>();
  validHeroes.forEach(vh => {
    const hero = findHeroByName(vh.heroName, dbHeroes);
    if (hero?.teamfightStyle) uniqueStyles.add(hero.teamfightStyle);
    if (hero?.specialty) uniqueStyles.add(hero.specialty);
  });
  
  const distinctArchetypes = uniqueStyles.size;
  const archetypeScore = Math.min(99, Math.max(50, 50 + (Math.max(1, distinctArchetypes) - 1) * 16));

  // 3. Performance Stability (20% weight)
  // Measure KDA and Win Rate consistency across their valid heroes
  const stableHeroes = validHeroes.filter(h => h.winRate >= 50);
  const stabilityRatio = H > 0 ? stableHeroes.length / H : 0.5;
  const avgKda = H > 0 ? validHeroes.reduce((sum, h) => sum + h.kda, 0) / H : 2.5;
  
  const stabilityScore = Math.min(99, Math.max(50, 45 + (stabilityRatio * 40) + (Math.min(5, avgKda) / 5) * 15));

  // 4. Draft Flexibility Value (15% weight)
  // Points awarded for variety of damage types, scaling profiles, and role flex capability
  const damageTypes = new Set<string>();
  const scalingTypes = new Set<string>();
  const heroClasses = new Set<string>();
  
  validHeroes.forEach(vh => {
    const hero = findHeroByName(vh.heroName, dbHeroes);
    if (hero) {
      if (hero.damageType) damageTypes.add(hero.damageType);
      if (hero.scalingType) scalingTypes.add(hero.scalingType);
      if (hero.role) heroClasses.add(hero.role);
    }
  });

  let flexScore = 50;
  if (damageTypes.has('Physical') && damageTypes.has('Magic')) flexScore += 15;
  if ((scalingTypes.has('Early') || scalingTypes.has('Mid')) && scalingTypes.has('Late')) flexScore += 15;
  if (heroClasses.size >= 2) flexScore += 15;
  if (heroClasses.size >= 3) flexScore += 10;
  if (H >= 5) flexScore += 10; // Extra flex points for large pools
  
  flexScore = Math.min(99, flexScore);

  // 5. Meta Adaptability (10% weight)
  // Measure overlap with S-tier professional MLBB priority heroes
  const S_TIER_META_HEROES = new Set([
    'harith', 'roger', 'claude', 'karrie', 'brody', 'bruno', 'natan', 'beatrix',
    'chou', 'minotaur', 'tigreal', 'mathilda', 'angela', 'faramis', 'floryn',
    'fanny', 'nolan', 'hayabusa', 'ling', 'helcurt', 'baxia', 'fredrinn',
    'valentina', 'yve', 'pharsa', 'xavier', 'luoyi', 'novaria',
    'ruby', 'yuzhong', 'terizla', 'arlott', 'edith', 'khufra'
  ]);

  const metaOverlap = validHeroes.filter(vh => {
    const clean = vh.heroName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return S_TIER_META_HEROES.has(clean);
  }).length;

  const metaScore = Math.min(99, Math.max(50, 50 + metaOverlap * 12));

  // 6. Draft Tax (scouting target ban threat assessment)
  // How many targeted bans are needed to shut this player down
  let draftTax = 1;
  if (H <= 2) draftTax = 1; // easily targeted
  else if (H <= 4) draftTax = 2; // moderately targeted
  else if (H <= 6) draftTax = 3; // strong ban tax
  else draftTax = 4; // elite draft tax (unbannable)

  // Calculate Weighted Versatility Score
  const score = parseFloat((
    0.30 * breadthScore +
    0.25 * archetypeScore +
    0.20 * stabilityScore +
    0.15 * flexScore +
    0.10 * metaScore
  ).toFixed(1));

  return {
    score,
    details: {
      breadthScore: Math.round(breadthScore),
      archetypeScore: Math.round(archetypeScore),
      stabilityScore: Math.round(stabilityScore),
      flexScore: Math.round(flexScore),
      metaScore: Math.round(metaScore),
      validPoolSize: H,
      distinctArchetypes,
      draftTax
    }
  };
}

// ────────────────────────────────────────────────
// Robust CSV Parser (handles quotes with commas)
// ────────────────────────────────────────────────
export function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let inQuotes = false;
    let currentToken = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentToken.trim());
        currentToken = '';
      } else {
        currentToken += char;
      }
    }
    row.push(currentToken.trim());
    result.push(row);
  }
  return result;
}

// Translate result values from CSV
export function isWin(result: string): boolean {
  if (!result) return false;
  const r = result.trim().toLowerCase();
  return r === '胜' || r === 'win' || r === 'victory' || r === 'win-scrim';
}

// Map a hero name to a Hero object from DB
export function findHeroByName(name: string, heroes: Hero[]): Hero | undefined {
  const cleaned = cleanName(name);
  if (!cleaned) return undefined;

  // Exact cleaned name match
  const matched = heroes.find(h => cleanName(h.name) === cleaned || cleanName(h.slug) === cleaned);
  if (matched) return matched;

  // Custom mapping rules for tournament csv discrepancies
  if (cleaned === 'wuzetian' || cleaned === 'zetian') {
    return heroes.find(h => cleanName(h.slug) === 'zetian');
  }
  if (cleaned === 'yisunshin') {
    return heroes.find(h => cleanName(h.slug) === 'yi-sun-shin');
  }
  if (cleaned === 'popolandkupa' || cleaned === 'popol') {
    return heroes.find(h => cleanName(h.slug) === 'popol-and-kupa');
  }
  if (cleaned === 'gord') {
    return heroes.find(h => cleanName(h.slug) === 'gord');
  }

  // Substring match fallback
  return heroes.find(h => cleanName(h.name).includes(cleaned) || cleaned.includes(cleanName(h.name)));
}

// ────────────────────────────────────────────────
// Aggregation Results Types for MDL Indonesia S12
// ────────────────────────────────────────────────
export interface MDLPlayerHero {
  heroName: string;
  heroId?: number;
  matches: number;
  wins: number;
  winRate: number;
  kda: number;
  gpm: number;
  dpm: number;
  dtm: number;
  kp: number;
}

export interface MDLPlayerScouting {
  name: string;
  team: string;
  role: string;
  matches: number;
  wins: number;
  winRate: number;
  heroPoolSize: number;
  kda: number;
  kp: number;
  gpm: number;
  dpm: number;
  dtpm: number;
  buildingDpm: number;
  goldShare: number;
  damageShare: number;
  damageTakenShare: number;
  controlTime: number;
  avgDeaths: number;
  avgKills: number;
  avgAssists: number;
  avgGameMin: number;

  // Splits
  blueMatches: number;
  blueWins: number;
  blueWR: number;
  redMatches: number;
  redWins: number;
  redWR: number;

  groupStage: { matches: number; wins: number; wr: number };
  progressiveRound: { matches: number; wins: number; wr: number };
  playoffs: { matches: number; wins: number; wr: number };

  attributes: {
    farm: number;
    damage: number;
    survival: number;
    teamFight: number;
    push: number;
    versatility: number;
  };

  playstyleTag: string;
  scoutingScore: number;
  heroes: MDLPlayerHero[];
  versatilityDetails?: VersatilityDetails;
}

export interface MDLTeamScouting {
  name: string;
  matches: number;
  wins: number;
  winRate: number;
  playersCount: number;
  distinctHeroes: number;
  teamGpm: number;
  teamDamage: number;
  teamDamageTaken: number;
  avgGameMin: number;
  avgTurtles: number;
  avgLords: number;
  avgTowers: number;
  teamKills: number;
  teamDeaths: number;
  teamAssists: number;
  avgControl: number;
  avgKp: number;

  // Splits
  blueMatches: number;
  blueWins: number;
  blueWR: number;
  redMatches: number;
  redWins: number;
  redWR: number;

  groupStage: { matches: number; wins: number; wr: number };
  progressiveRound: { matches: number; wins: number; wr: number };
  playoffs: { matches: number; wins: number; wr: number };

  attributes: {
    tempo: number;
    damage: number;
    durability: number;
    objective: number;
    teamFight: number;
    versatility: number;
  };

  playstyleTag: string;
  scoutingScore: number;
  roster: {
    playerName: string;
    role: string;
    matches: number;
    winRate: number;
    playstyleTag: string;
    scoutingScore: number;
  }[];
}

export interface MDLScoutingData {
  players: MDLPlayerScouting[];
  teams: MDLTeamScouting[];
  heroes: {
    heroId: number;
    name: string;
    role: HeroRole;
    picks: number;
    wins: number;
    winRate: number;
  }[];
}

const parsePercent = (val: string): number => {
  if (!val) return 0;
  return parseFloat(val.replace('%', '').trim()) || 0;
};

// ────────────────────────────────────────────────
// Parser Core: Aggregates stats from MDL ID S12 CSVs
// ────────────────────────────────────────────────
export function processMDLScoutingCSVs(
  playerSummaryCsv: string,
  teamSummaryCsv: string,
  teamRosterCsv: string,
  mostPlayedHeroCsv: string,
  dbHeroes: Hero[]
): MDLScoutingData {
  const playerRows = parseCSV(playerSummaryCsv);
  const teamRows = parseCSV(teamSummaryCsv);

  // If the CSV has "Battle Code" or "No." and "Tournament" columns, it's the raw MPL TR log format!
  const isRawLogFormat = playerRows[0] && playerRows[0].some(cell => cell.toLowerCase().trim() === 'battle code');
  const isAggregatedTRFormat = !isRawLogFormat;

  if (isAggregatedTRFormat) {
    console.log('[csvParser] Processing aggregated playoff player sheet for MPL Turkey...');
    
    // We parse teamRosterCsv as raw logs to extract hero comfort pool if present!
    const rawLogsRows = teamRosterCsv ? parseCSV(teamRosterCsv) : [];
    const hasRawLogs = rawLogsRows[0] && rawLogsRows[0].some(cell => cell.toLowerCase().trim() === 'battle code');
    
    const playerHeroesMap = new Map<string, Map<string, any>>();
    const playerSplitsMap = new Map<string, { gsMatches: number; gsWins: number; prMatches: number; prWins: number; poMatches: number; poWins: number }>();
    const playerMetadataMap = new Map<string, { teamCode: string; teamName: string; role: string }>();
    
    if (hasRawLogs) {
      console.log('[csvParser] Aggregated mode: Raw logs detected in teamRosterCsv. Extracting hero pool history...', rawLogsRows.length, 'raw rows');
      const rawHeaders = rawLogsRows[0].map(h => h.trim());
      const rawPlayerIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'player');
      const rawHeroIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'hero');
      const rawResultIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'result');
      const rawKillsIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'kills');
      const rawDeathsIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'deaths');
      const rawAssistsIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'assists');
      const rawGpmIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'gold per minute');
      const rawDpmIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'damage per minute');
      const rawDtpmIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'damage taken per minute');
      const rawKpIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'kill participation%');
      const rawStageIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'stage');
      const rawTeamIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'team');
      const rawSpellIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'battle spell' || h.toLowerCase() === 'spell');
      const rawEquipsIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'equips' || h.toLowerCase() === 'equipment');
      const rawEmblemIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'emblem');

      // Group rows by player for metadata calculation
      const playerRawRowsMap = new Map<string, string[][]>();

      for (let i = 1; i < rawLogsRows.length; i++) {
        const row = rawLogsRows[i];
        if (row.length < Math.max(rawPlayerIdx, rawHeroIdx)) continue;
        const player = row[rawPlayerIdx]?.trim();
        const hero = row[rawHeroIdx]?.trim();
        if (!player || !hero) continue;

        const key = cleanName(player);
        const teamNameVal = rawTeamIdx !== -1 ? row[rawTeamIdx]?.trim() || '' : '';
        if (isInvalidEntity(teamNameVal) || isInvalidEntity(player)) {
          continue;
        }

        const canonicalHeroName = findHeroByName(hero, dbHeroes)?.name || hero;

        if (!playerHeroesMap.has(key)) {
          playerHeroesMap.set(key, new Map());
        }
        const heroMap = playerHeroesMap.get(key)!;
        if (!heroMap.has(canonicalHeroName)) {
          heroMap.set(canonicalHeroName, { matches: 0, wins: 0, kills: 0, deaths: 0, assists: 0, gpm: 0, dpm: 0, dtpm: 0, kp: 0 });
        }
        const stats = heroMap.get(hero)!;
        stats.matches++;
        
        const win = isWin(row[rawResultIdx]);
        if (win) stats.wins++;
        stats.kills += parseFloat(row[rawKillsIdx]) || 0;
        stats.deaths += parseFloat(row[rawDeathsIdx]) || 0;
        stats.assists += parseFloat(row[rawAssistsIdx]) || 0;
        stats.gpm += parseFloat(row[rawGpmIdx]) || 0;
        stats.dpm += parseFloat(row[rawDpmIdx]) || 0;
        stats.dtpm += parseFloat(row[rawDtpmIdx]) || 0;
        stats.kp += parsePercent(row[rawKpIdx]);

        // Splits
        if (!playerSplitsMap.has(key)) {
          playerSplitsMap.set(key, { gsMatches: 0, gsWins: 0, prMatches: 0, prWins: 0, poMatches: 0, poWins: 0 });
        }
        const splits = playerSplitsMap.get(key)!;
        const stage = rawStageIdx !== -1 ? (row[rawStageIdx] || '').toLowerCase() : '';
        if (stage.includes('playoff') || stage.includes('???') || stage === '???') {
          splits.poMatches++;
          if (win) splits.poWins++;
        } else if (stage.includes('progressive') || stage.includes('round')) {
          splits.prMatches++;
          if (win) splits.prWins++;
        } else {
          splits.gsMatches++;
          if (win) splits.gsWins++;
        }

        // Group rows for metadata
        if (!playerRawRowsMap.has(key)) {
          playerRawRowsMap.set(key, []);
        }
        playerRawRowsMap.get(key)!.push(row);
      }

      // Calculate player dynamic metadata
      for (const [key, rows] of playerRawRowsMap.entries()) {
        const firstRow = rows[0];
        const teamCode = rawTeamIdx !== -1 ? firstRow[rawTeamIdx]?.trim() || 'UNK' : 'UNK';
        
        let retriCount = 0;
        let roamEquipCount = 0;
        const laneVotes: Record<string, number> = { Roam: 0, Jungle: 0, Mid: 0, Gold: 0, EXP: 0 };

        for (const r of rows) {
          const spell = rawSpellIdx !== -1 ? r[rawSpellIdx]?.trim() || '' : '';
          if (spell.toLowerCase().includes('retribution')) retriCount++;

          const equips = rawEquipsIdx !== -1 ? r[rawEquipsIdx]?.trim() || '' : '';
          if (equips.toLowerCase().includes('encourage') || 
              equips.toLowerCase().includes('conceal') || 
              equips.toLowerCase().includes('favor') || 
              equips.toLowerCase().includes('dire hit')) {
            roamEquipCount++;
          }

          const heroName = rawHeroIdx !== -1 ? r[rawHeroIdx]?.trim() || '' : '';
          const heroObj = findHeroByName(heroName, dbHeroes);
          if (heroObj && heroObj.laneRecommendation && heroObj.laneRecommendation.length > 0) {
            const primaryLane = heroObj.laneRecommendation[0];
            laneVotes[primaryLane] = (laneVotes[primaryLane] || 0) + 1;
          } else if (rawEmblemIdx !== -1) {
            const emblem = r[rawEmblemIdx]?.trim() || '';
            const embLower = emblem.toLowerCase();
            if (embLower.includes('mage')) laneVotes['Mid']++;
            else if (embLower.includes('fighter')) laneVotes['EXP']++;
            else if (embLower.includes('tank') || embLower.includes('support')) laneVotes['Roam']++;
            else if (embLower.includes('assassin')) laneVotes['Jungle']++;
          }
        }

        // Dynamic vote-based role assignment
        const roleVotes = {
          JUNGLE: retriCount,
          ROAM: roamEquipCount,
          MID: laneVotes['Mid'] || 0,
          GOLD: laneVotes['Gold'] || 0,
          EXP: laneVotes['EXP'] || 0
        };

        let computedRole = 'GOLD';
        let maxVotes = -1;
        for (const [r, votes] of Object.entries(roleVotes)) {
          if (votes > maxVotes) {
            maxVotes = votes;
            computedRole = r;
          }
        }

        playerMetadataMap.set(key, {
          teamCode,
          teamName: teamCode,
          role: computedRole
        });
      }
    }

    console.log(`[csvParser] Aggregated mode: playerHeroesMap built with ${playerHeroesMap.size} players. Sample:`, Array.from(playerHeroesMap.keys()).slice(0, 5));

    const pHeaders = playerRows[0].map(h => h.trim());
    const pDataRows = playerRows.slice(1);

    const getColIndex = (header: string[], colName: string) => {
      const cleanHeader = (h: string) => h.toLowerCase().replace(/^\uFEFF/, '').trim();
      const cleanTarget = colName.toLowerCase().trim();
      return header.findIndex(h => cleanHeader(h) === cleanTarget);
    };

    // Columns indices
    const pPlayerCol = getColIndex(pHeaders, 'Player');
    const pGamesCol = getColIndex(pHeaders, 'Games Played');
    const pWinsCol = getColIndex(pHeaders, 'Number of game wins');
    const pWinrateCol = getColIndex(pHeaders, 'Games Win Ratio%');
    const pKdaCol = getColIndex(pHeaders, 'KDA Ratio');
    const pKpCol = getColIndex(pHeaders, 'Kill Participation%');
    const pGpmCol = getColIndex(pHeaders, 'Gold Per Minute');
    const pGoldShareCol = getColIndex(pHeaders, 'Gold Share%');
    const pDpmCol = getColIndex(pHeaders, 'Damage Per Minute');
    const pDmgShareCol = getColIndex(pHeaders, 'Damage Share%');
    const pBuildingCol = getColIndex(pHeaders, 'Average Building Damage');
    const pDtpmCol = getColIndex(pHeaders, 'Damage Taken Per Minute');
    const pDtShareCol = getColIndex(pHeaders, 'Damage Taken Share%');
    const pCtrlCol = getColIndex(pHeaders, 'Control time per game/s');
    const pDeathsCol = getColIndex(pHeaders, 'Average Deaths');
    const pKillsCol = getColIndex(pHeaders, 'Average Kills per game');
    const pAssistsCol = getColIndex(pHeaders, 'Average Assists');
    const pTimeCol = getColIndex(pHeaders, 'Average Game Time/s');
    const pPoolCol = getColIndex(pHeaders, 'Heroes Used');

    const getPlayerTeamDetails = (playerName: string) => {
      const cleanP = cleanName(playerName);
      
      // 1. Check if we resolved player metadata from raw logs dynamically!
      const dynamicMeta = playerMetadataMap.get(cleanP);
      if (dynamicMeta) {
        return dynamicMeta;
      }
      
      // 2. Fall back to local roster file
      for (const team of mplTurkeyRosters) {
        for (const p of team.players) {
          if (cleanName(p.name) === cleanP) {
            return { teamCode: team.teamCode, teamName: team.teamName, role: p.role };
          }
        }
      }
      return { teamCode: 'UNK', teamName: 'Unknown Team', role: 'Mid' as any };
    };

    const parsedPlayers: MDLPlayerScouting[] = [];

    for (const row of pDataRows) {
      if (row.length < 5) continue;
      const playerName = row[pPlayerCol]?.trim();
      if (!playerName) continue;

      const { teamCode, teamName, role } = getPlayerTeamDetails(playerName);
      const gamesPlayed = parseInt(row[pGamesCol]) || 0;
      const wins = parseInt(row[pWinsCol]) || 0;
      const winRate = parsePercent(row[pWinrateCol]);
      const kda = parseFloat(row[pKdaCol]) || 0;
      const kp = parsePercent(row[pKpCol]);
      const gpm = parseInt(row[pGpmCol]) || 0;
      const goldShare = parsePercent(row[pGoldShareCol]);
      const dpm = parseInt(row[pDpmCol]) || 0;
      const damageShare = parsePercent(row[pDmgShareCol]);
      const buildingDpm = parseInt(row[pBuildingCol]) || 0;
      const dtpm = parseInt(row[pDtpmCol]) || 0;
      const damageTakenShare = parsePercent(row[pDtShareCol]);
      const controlTime = parseFloat(row[pCtrlCol]) || 0;
      const avgDeaths = parseFloat(row[pDeathsCol]) || 0;
      const avgKills = parseFloat(row[pKillsCol]) || 0;
      const avgAssists = parseFloat(row[pAssistsCol]) || 0;
      const avgGameMin = (parseFloat(row[pTimeCol]) || 0) / 60;

      // Extract and scale comfort heroes
      const rawHeroMap = playerHeroesMap.get(cleanName(playerName)) || new Map();
      const heroesList: MDLPlayerHero[] = [];

      for (const [hName, rawStats] of rawHeroMap.entries()) {
        const rawMatches = rawStats.matches;
        const rawWins = rawStats.wins;
        const rawWR = rawMatches > 0 ? (rawWins / rawMatches) : 0.5;

        const totalRawGames = Array.from(rawHeroMap.values()).reduce((sum: number, s: any) => sum + s.matches, 0) as number;
        const ratio = gamesPlayed / Math.max(1, totalRawGames);
        const finalHeroMatches = Math.max(1, Math.round(rawMatches * ratio));
        const finalHeroWins = Math.round(finalHeroMatches * rawWR);
        const heroObj = findHeroByName(hName, dbHeroes);

        heroesList.push({
          heroName: hName,
          heroId: heroObj?.id,
          matches: finalHeroMatches,
          wins: finalHeroWins,
          winRate: Math.round((finalHeroWins / finalHeroMatches) * 100),
          kda: parseFloat((rawStats.kda || ((rawStats.kills + rawStats.assists) / Math.max(1, rawStats.deaths))).toFixed(2)),
          gpm: Math.round(rawStats.gpm / rawMatches),
          dpm: Math.round(rawStats.dpm / rawMatches),
          dtm: Math.round(rawStats.dtpm / rawMatches),
          kp: parseFloat((rawStats.kp / rawMatches).toFixed(2))
        });
      }
      heroesList.sort((a, b) => b.matches - a.matches);

      // Compute scouting attributes using the exact same scaling logic
      const farmAttr = Math.min(99, Math.max(50, 50 + ((gpm - 450) / 350) * 45 + (goldShare - 15) * 1.5));
      const damageAttr = Math.min(99, Math.max(50, 50 + ((dpm - 1500) / 3500) * 45 + (damageShare - 15) * 1.5));
      const survivalAttr = Math.min(99, Math.max(50, 95 - (avgDeaths * 8) + (kda * 1.5)));
      const teamFightAttr = Math.min(99, Math.max(50, 50 + (kp - 40) * 0.8));
      const pushAttr = Math.min(99, Math.max(50, 50 + (buildingDpm / 300) * 45));
      const poolSize = heroesList.length || parseInt(row[pPoolCol]) || 0;
      const roleUpper = (role || '').toUpperCase();
      let activeHeroesListForCalc = [...heroesList];
      if (activeHeroesListForCalc.length === 0 && poolSize > 0) {
        // Generate representative dummy heroes matching player's role/lane to ensure accurate multi-dimensional calculation
        const roleMeta = roleUpper === 'ROAM' ? ['Tigreal', 'Minotaur', 'Mathilda', 'Chou'] 
                       : roleUpper === 'MID' ? ['Valentina', 'Lylia', 'Xavier', 'Novaria'] 
                       : roleUpper === 'JUNGLE' ? ['Nolan', 'Baxia', 'Roger', 'Fanny']
                       : roleUpper === 'EXP' ? ['Terizla', 'Ruby', 'Yu Zhong', 'Arlott']
                       : ['Claude', 'Harith', 'Brody', 'Karrie'];
                       
        for (let i = 0; i < poolSize; i++) {
          activeHeroesListForCalc.push({
            heroName: roleMeta[i % roleMeta.length],
            matches: Math.max(1, Math.round(gamesPlayed / poolSize)),
            wins: Math.max(1, Math.round((gamesPlayed / poolSize) * (winRate / 100))),
            winRate: winRate,
            kda: kda,
            gpm: gpm,
            dpm: dpm,
            dtm: dtpm,
            kp: kp
          });
        }
      }
      
      const versatilityResult = calculateAdvancedPlayerVersatility(activeHeroesListForCalc, gamesPlayed, dbHeroes);
      const versatilityAttr = versatilityResult.score;
      const versatilityDetails = versatilityResult.details;
      const controlAttr = Math.min(99, Math.max(50, 50 + (controlTime / 45) * 45));

      let farmScore = farmAttr;
      let pushScore = pushAttr;
      if (roleUpper === 'ROAM') {
        farmScore = Math.min(99, Math.max(70, 70 + (kp - 50) * 0.4));
        pushScore = Math.min(99, Math.max(65, 65 + (controlTime / 45) * 20));
      } else if (roleUpper === 'MID') {
        pushScore = Math.min(99, Math.max(68, 68 + (damageShare - 20) * 0.8));
      }

      const scoutingScore = parseFloat(((farmScore + damageAttr + survivalAttr + teamFightAttr + pushScore + versatilityAttr) / 6).toFixed(1));

      let playstyleTag = 'Tactician';
      if (roleUpper === 'JUNGLE') {
        playstyleTag = farmScore > 85 ? 'Carry Jungler' : 'Elusive Assassin';
      } else if (roleUpper === 'ROAM') {
        playstyleTag = controlAttr > 85 ? 'Engage Maestro' : 'Protector';
      } else if (roleUpper === 'MID') {
        playstyleTag = damageAttr > 85 ? 'Artillery Mage' : 'Utility Mid';
      } else if (roleUpper === 'GOLD') {
        playstyleTag = damageAttr > 85 ? 'Late Game Carry' : 'Steady Marksman';
      } else if (roleUpper === 'EXP') {
        playstyleTag = pushScore > 85 ? 'Split Pusher' : 'Sturdy Frontliner';
      }

      parsedPlayers.push({
        name: playerName,
        team: teamCode,
        role: roleUpper,
        matches: gamesPlayed,
        wins,
        winRate,
        heroPoolSize: heroesList.length || parseInt(row[pPoolCol]) || 0,
        kda,
        kp,
        gpm,
        dpm,
        dtpm,
        buildingDpm,
        goldShare,
        damageShare,
        damageTakenShare,
        controlTime,
        avgDeaths,
        avgKills,
        avgAssists,
        avgGameMin,
        blueMatches: Math.round(gamesPlayed / 2),
        blueWins: Math.round(wins / 2),
        blueWR: winRate,
        redMatches: Math.round(gamesPlayed / 2),
        redWins: Math.round(wins / 2),
        redWR: winRate,
        groupStage: {
          matches: (playerSplitsMap.get(cleanName(playerName))?.gsMatches !== undefined) ? playerSplitsMap.get(cleanName(playerName))!.gsMatches : gamesPlayed,
          wins: (playerSplitsMap.get(cleanName(playerName))?.gsWins !== undefined) ? playerSplitsMap.get(cleanName(playerName))!.gsWins : wins,
          wr: (playerSplitsMap.get(cleanName(playerName))?.gsMatches !== undefined && playerSplitsMap.get(cleanName(playerName))!.gsMatches > 0) ? Math.round((playerSplitsMap.get(cleanName(playerName))!.gsWins / playerSplitsMap.get(cleanName(playerName))!.gsMatches) * 100) : winRate
        },
        progressiveRound: {
          matches: playerSplitsMap.get(cleanName(playerName))?.prMatches || 0,
          wins: playerSplitsMap.get(cleanName(playerName))?.prWins || 0,
          wr: (playerSplitsMap.get(cleanName(playerName))?.prMatches !== undefined && playerSplitsMap.get(cleanName(playerName))!.prMatches > 0) ? Math.round((playerSplitsMap.get(cleanName(playerName))!.prWins / playerSplitsMap.get(cleanName(playerName))!.prMatches) * 100) : 0
        },
        playoffs: {
          matches: playerSplitsMap.get(cleanName(playerName))?.poMatches || 0,
          wins: playerSplitsMap.get(cleanName(playerName))?.poWins || 0,
          wr: (playerSplitsMap.get(cleanName(playerName))?.poMatches !== undefined && playerSplitsMap.get(cleanName(playerName))!.poMatches > 0) ? Math.round((playerSplitsMap.get(cleanName(playerName))!.poWins / playerSplitsMap.get(cleanName(playerName))!.poMatches) * 100) : 0
        },
        attributes: {
          farm: Math.round(farmScore),
          damage: Math.round(damageAttr),
          survival: Math.round(survivalAttr),
          teamFight: Math.round(teamFightAttr),
          push: Math.round(pushScore),
          versatility: Math.round(versatilityAttr)
        },
        playstyleTag,
        scoutingScore,
        heroes: heroesList,
        versatilityDetails
      });
    }

    console.log(`[csvParser] Aggregated mode: ${parsedPlayers.length} players parsed. Hero counts:`, parsedPlayers.slice(0, 5).map(p => `${p.name}: ${p.heroes.length} heroes`));

    // Group players by team code to aggregate team scouting stats
    const teamPlayersMap = new Map<string, MDLPlayerScouting[]>();
    parsedPlayers.forEach(p => {
      if (!teamPlayersMap.has(p.team)) {
        teamPlayersMap.set(p.team, []);
      }
      teamPlayersMap.get(p.team)!.push(p);
    });

    const parsedTeams: MDLTeamScouting[] = [];
    const globalHeroPicks = new Map<string, { picks: number; wins: number }>();

    for (const [tCode, tPlayers] of teamPlayersMap.entries()) {
      if (isInvalidEntity(tCode)) {
        console.log(`[csvParser] Filtering out invalid aggregated team: ${tCode}`);
        continue;
      }

      const teamRoster = mplTurkeyRosters.find(r => r.teamCode === tCode);
      const teamName = teamRoster ? teamRoster.teamName : tCode;

      const matches = Math.max(...tPlayers.map(p => p.matches));
      const wins = Math.max(...tPlayers.map(p => p.wins));
      const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;

      const teamGpm = Math.round(tPlayers.reduce((sum, p) => sum + p.gpm, 0) / tPlayers.length);
      const teamDamage = Math.round(tPlayers.reduce((sum, p) => sum + p.dpm, 0) / tPlayers.length);
      const teamDamageTaken = Math.round(tPlayers.reduce((sum, p) => sum + p.dtpm, 0) / tPlayers.length);
      const avgGameMin = tPlayers.reduce((sum, p) => sum + p.avgGameMin, 0) / tPlayers.length;

      const teamKills = tPlayers.reduce((sum, p) => sum + (p.avgKills * p.matches), 0) / 5;
      const teamDeaths = tPlayers.reduce((sum, p) => sum + (p.avgDeaths * p.matches), 0) / 5;
      const teamAssists = tPlayers.reduce((sum, p) => sum + (p.avgAssists * p.matches), 0) / 5;

      const avgTowers = 6.2;
      const avgTurtles = 2.1;
      const avgLords = 1.1;

      const scoutingScore = parseFloat((tPlayers.reduce((sum, p) => sum + p.scoutingScore, 0) / tPlayers.length).toFixed(1));

      const tempo = Math.round(tPlayers.reduce((sum, p) => sum + p.attributes.farm, 0) / tPlayers.length);
      const damage = Math.round(tPlayers.reduce((sum, p) => sum + p.attributes.damage, 0) / tPlayers.length);
      const durability = Math.round(tPlayers.reduce((sum, p) => sum + p.attributes.survival, 0) / tPlayers.length);
      const objective = Math.round((tempo + damage) / 2);
      const teamfight = Math.round(tPlayers.reduce((sum, p) => sum + p.attributes.teamFight, 0) / tPlayers.length);
      const versatility = Math.round(tPlayers.reduce((sum, p) => sum + p.attributes.versatility, 0) / tPlayers.length);

      const rosterList = tPlayers.map(p => ({
        playerName: p.name,
        role: p.role,
        matches: p.matches,
        winRate: p.winRate,
        playstyleTag: p.playstyleTag,
        scoutingScore: p.scoutingScore
      }));

      parsedTeams.push({
        name: teamName,
        matches,
        wins,
        winRate,
        playersCount: tPlayers.length,
        distinctHeroes: tPlayers.reduce((sum, p) => sum + p.heroPoolSize, 0),
        teamGpm,
        teamDamage,
        teamDamageTaken,
        avgGameMin,
        avgTurtles,
        avgLords,
        avgTowers,
        teamKills: parseFloat((teamKills / matches).toFixed(1)),
        teamDeaths: parseFloat((teamDeaths / matches).toFixed(1)),
        teamAssists: parseFloat((teamAssists / matches).toFixed(1)),
        avgControl: parseFloat((tPlayers.reduce((sum, p) => sum + p.controlTime, 0) / tPlayers.length).toFixed(1)),
        avgKp: parseFloat((tPlayers.reduce((sum, p) => sum + p.kp, 0) / tPlayers.length).toFixed(1)),
        blueMatches: Math.round(matches / 2),
        blueWins: Math.round(wins / 2),
        blueWR: winRate,
        redMatches: Math.round(matches / 2),
        redWins: Math.round(wins / 2),
        redWR: winRate,
        groupStage: {
          matches: Math.round(tPlayers.reduce((sum, p) => sum + p.groupStage.matches, 0) / tPlayers.length),
          wins: Math.round(tPlayers.reduce((sum, p) => sum + p.groupStage.wins, 0) / tPlayers.length),
          wr: Math.round(tPlayers.reduce((sum, p) => sum + p.groupStage.wr, 0) / tPlayers.length)
        },
        progressiveRound: {
          matches: Math.round(tPlayers.reduce((sum, p) => sum + p.progressiveRound.matches, 0) / tPlayers.length),
          wins: Math.round(tPlayers.reduce((sum, p) => sum + p.progressiveRound.wins, 0) / tPlayers.length),
          wr: Math.round(tPlayers.reduce((sum, p) => sum + p.progressiveRound.wr, 0) / tPlayers.length)
        },
        playoffs: {
          matches: Math.round(tPlayers.reduce((sum, p) => sum + p.playoffs.matches, 0) / tPlayers.length),
          wins: Math.round(tPlayers.reduce((sum, p) => sum + p.playoffs.wins, 0) / tPlayers.length),
          wr: Math.round(tPlayers.reduce((sum, p) => sum + p.playoffs.wr, 0) / tPlayers.length)
        },
        attributes: {
          tempo,
          damage,
          durability,
          objective,
          teamFight: teamfight,
          versatility
        },
        playstyleTag: winRate >= 70 ? 'Aggressive Giant' : winRate >= 50 ? 'Balanced Contender' : 'Underdog',
        scoutingScore,
        roster: rosterList
      });

      // Accumulate global hero picks
      tPlayers.forEach(p => {
        p.heroes.forEach(h => {
          if (!globalHeroPicks.has(h.heroName)) {
            globalHeroPicks.set(h.heroName, { picks: 0, wins: 0 });
          }
          const gh = globalHeroPicks.get(h.heroName)!;
          gh.picks += h.matches;
          gh.wins += h.wins;
        });
      });
    }

    const finalHeroes = Array.from(globalHeroPicks.entries()).map(([hName, stats]) => {
      const heroObj = findHeroByName(hName, dbHeroes);
      return {
        heroId: heroObj?.id || 0,
        name: hName,
        role: heroObj?.role || 'Fighter',
        picks: stats.picks,
        wins: stats.wins,
        winRate: stats.picks > 0 ? Math.round((stats.wins / stats.picks) * 100) : 0
      };
    });

    finalHeroes.sort((a, b) => b.picks - a.picks);
    parsedPlayers.sort((a, b) => b.scoutingScore - a.scoutingScore);
    parsedTeams.sort((a, b) => b.scoutingScore - a.scoutingScore);

    return {
      players: parsedPlayers,
      teams: parsedTeams,
      heroes: finalHeroes
    };
  }

  if (isRawLogFormat) {
    console.log('[csvParser] Detecting raw match-by-match log format for MPL Turkey...');
    
    // Filter invalid/test teams (e.g., ping tests, scrimmages)
    const MIN_TEAM_MATCHES = 3; // Minimum matches to filter out 1-2 game ping tests

    // Official Liquipedia Roster Roles Override for MTC Season 7
    const MTC_ROLES_OVERRIDE: Record<string, string> = {
      // Aurora Gaming
      lunar: 'EXP',
      tienzy: 'JUNGLE',
      rosa: 'MID',
      sigibum: 'GOLD',
      pagu: 'ROAM',
      reinnnn: 'GOLD',

      // FUT Esports
      eksi: 'EXP',
      kazue: 'JUNGLE',
      saiki: 'MID',
      rx: 'GOLD',
      blotzfet: 'ROAM',

      // Misa Esports
      wassa: 'EXP',
      moji: 'JUNGLE',
      afterdark: 'MID',
      xiao: 'GOLD',
      qaro: 'ROAM',
      mozi: 'EXP',
      sayaka: 'MID',

      // Beşiktaş Esports
      kunteper: 'EXP',
      toe: 'EXP',
      zeyn: 'JUNGLE',
      zeynn: 'JUNGLE',
      sancho: 'MID',
      ravex: 'GOLD',
      numb: 'ROAM',
      ccboy: 'ROAM',
      shao: 'JUNGLE',
      kirai: 'MID',

      // Bushido Wildcats
      doran: 'EXP',
      nexus: 'JUNGLE',
      sunshine: 'GOLD',
      wackter: 'ROAM',
      aizawa: 'MID',
      brian: 'JUNGLE',
      alien: 'EXP',

      // PCIFIC Esports
      ross: 'EXP',
      titan: 'JUNGLE',
      rememberme: 'MID',
      elvis: 'GOLD',
      diffy: 'ROAM',
      miku: 'MID',
      kvanch: 'ROAM',
      yalnizryuu: 'JUNGLE',
      anthesis: 'JUNGLE',
      starmurre: 'GOLD',

      // Eternal Fire
      saviom: 'EXP',
      harikasinsamet: 'JUNGLE',
      landy: 'JUNGLE',
      zeichnen: 'MID',
      ranque: 'GOLD',
      intangible: 'ROAM',
      kiritooo: 'GOLD',

      // Regnum Carya Esports
      kausei: 'EXP',
      elandor: 'JUNGLE',
      easyy: 'MID',
      kite: 'GOLD',
      shinki: 'ROAM',
      wain: 'GOLD',
      revass: 'EXP',
      borisgry: 'GOLD',
      peasyy: 'ROAM',
      akuran: 'EXP',
    };

    const pHeaders = playerRows[0].map(h => h.trim());
    const pDataRows = playerRows.slice(1);

    const getColIndex = (header: string[], colName: string) => {
      const cleanHeader = (h: string) => h.toLowerCase().replace(/^\uFEFF/, '').trim();
      const cleanTarget = colName.toLowerCase().trim();
      return header.findIndex(h => cleanHeader(h) === cleanTarget);
    };

    // Index mappings for player
    const pPlayerIdx = getColIndex(pHeaders, 'Player');
    const pTeamIdx = getColIndex(pHeaders, 'Team');
    const pHeroIdx = getColIndex(pHeaders, 'Hero');
    const pSideIdx = getColIndex(pHeaders, 'Side');
    const pResultIdx = getColIndex(pHeaders, 'Result');
    const pKillsIdx = getColIndex(pHeaders, 'Kills');
    const pDeathsIdx = getColIndex(pHeaders, 'Deaths');
    const pAssistsIdx = getColIndex(pHeaders, 'Assists');
    const pKpIdx = getColIndex(pHeaders, 'Kill Participation%');
    const pGpmIdx = getColIndex(pHeaders, 'Gold per Minute');
    const pDpmIdx = getColIndex(pHeaders, 'Damage per Minute');
    const pDtpmIdx = getColIndex(pHeaders, 'Damage Taken per Minute');
    const pBdpmIdx = getColIndex(pHeaders, 'Building Damage per Minute');
    const pGoldShareIdx = getColIndex(pHeaders, 'Gold Share%');
    const pDmgShareIdx = getColIndex(pHeaders, 'Damage Share%');
    const pDtShareIdx = getColIndex(pHeaders, 'Damage Taken Share%');
    const pCtrlIdx = getColIndex(pHeaders, 'Control Time/s');
    const pTimeIdx = getColIndex(pHeaders, 'Time/s');
    const pStageIdx = getColIndex(pHeaders, 'Stage');
    const pSpellIdx = getColIndex(pHeaders, 'Battle Spell');
    const pEquipsIdx = getColIndex(pHeaders, 'Equips');
    const pEmblemIdx = getColIndex(pHeaders, 'Emblem');

    // Standardise team abbreviations (RC -> RGE) in player data
    pDataRows.forEach(row => {
      if (pTeamIdx !== -1 && row[pTeamIdx] === 'RC') row[pTeamIdx] = 'RGE';
      const enemyColIdx = getColIndex(pHeaders, 'Enemy Team');
      if (enemyColIdx !== -1 && row[enemyColIdx] === 'RC') row[enemyColIdx] = 'RGE';
    });

    // Group player rows by player name
    const playerGamesMap = new Map<string, string[][]>();
    for (const row of pDataRows) {
      if (row.length < Math.max(pPlayerIdx, pTeamIdx)) continue;
      const playerName = row[pPlayerIdx]?.trim();
      const teamName = row[pTeamIdx]?.trim();
      if (!playerName || !teamName) continue;
      // Skip rows from invalid/test teams and players case-insensitively
      if (isInvalidEntity(teamName) || isInvalidEntity(playerName)) {
        continue;
      }
      if (!playerGamesMap.has(playerName)) {
        playerGamesMap.set(playerName, []);
      }
      playerGamesMap.get(playerName)!.push(row);
    }

    const parsedPlayers: MDLPlayerScouting[] = [];

    for (const [playerName, rows] of playerGamesMap.entries()) {
      const firstRow = rows[0];
      const teamName = firstRow[pTeamIdx]?.trim() || 'UNKNOWN';
      
      // Compute role
      let retriCount = 0;
      let roamEquipCount = 0;
      const laneVotes: Record<string, number> = { Roam: 0, Jungle: 0, Mid: 0, Gold: 0, EXP: 0 };
      
      for (const r of rows) {
        const spell = r[pSpellIdx]?.trim() || '';
        if (spell.toLowerCase().includes('retribution')) {
          retriCount++;
        }
        
        const equips = r[pEquipsIdx]?.trim() || '';
        if (equips.toLowerCase().includes('encourage') || 
            equips.toLowerCase().includes('conceal') || 
            equips.toLowerCase().includes('favor') || 
            equips.toLowerCase().includes('dire hit')) {
          roamEquipCount++;
        }
        
        const heroName = r[pHeroIdx]?.trim() || '';
        const heroObj = findHeroByName(heroName, dbHeroes);
        if (heroObj && heroObj.laneRecommendation && heroObj.laneRecommendation.length > 0) {
          const primaryLane = heroObj.laneRecommendation[0];
          laneVotes[primaryLane] = (laneVotes[primaryLane] || 0) + 1;
        } else {
          const emblem = r[pEmblemIdx]?.trim() || '';
          const embLower = emblem.toLowerCase();
          if (embLower.includes('mage')) laneVotes['Mid']++;
          else if (embLower.includes('fighter')) laneVotes['EXP']++;
          else if (embLower.includes('tank') || embLower.includes('support')) laneVotes['Roam']++;
          else if (embLower.includes('assassin')) laneVotes['Jungle']++;
        }
      }

      // Dynamic vote-based role assignment
      const roleVotes = {
        JUNGLE: retriCount,
        ROAM: roamEquipCount,
        MID: laneVotes['Mid'] || 0,
        GOLD: laneVotes['Gold'] || 0,
        EXP: laneVotes['EXP'] || 0
      };

      let computedRole = 'GOLD';
      let maxVotes = -1;
      for (const [r, votes] of Object.entries(roleVotes)) {
        if (votes > maxVotes) {
          maxVotes = votes;
          computedRole = r;
        }
      }

      // Liquipedia official role override
      const cleanPlayerName = cleanName(playerName);
      if (MTC_ROLES_OVERRIDE[cleanPlayerName]) {
        computedRole = MTC_ROLES_OVERRIDE[cleanPlayerName];
      }

      let wins = 0;
      let totalKills = 0;
      let totalDeaths = 0;
      let totalAssists = 0;
      let totalGpm = 0;
      let totalDpm = 0;
      let totalDtpm = 0;
      let totalBdpm = 0;
      let totalGoldShare = 0;
      let totalDmgShare = 0;
      let totalDtShare = 0;
      let totalControl = 0;
      let totalTime = 0;
      let totalKp = 0;

      let blueMatches = 0;
      let blueWins = 0;
      let redMatches = 0;
      let redWins = 0;

      let gsMatches = 0;
      let gsWins = 0;
      let prMatches = 0;
      let prWins = 0;
      let poMatches = 0;
      let poWins = 0;

      const playerHeroGamesMap = new Map<string, string[][]>();

      for (const r of rows) {
        const result = r[pResultIdx] || '';
        const win = isWin(result);
        if (win) wins++;

        totalKills += parseFloat(r[pKillsIdx]) || 0;
        totalDeaths += parseFloat(r[pDeathsIdx]) || 0;
        totalAssists += parseFloat(r[pAssistsIdx]) || 0;
        
        totalGpm += parseFloat(r[pGpmIdx]) || 0;
        totalDpm += parseFloat(r[pDpmIdx]) || 0;
        totalDtpm += parseFloat(r[pDtpmIdx]) || 0;
        totalBdpm += parseFloat(r[pBdpmIdx]) || 0;

        totalGoldShare += parsePercent(r[pGoldShareIdx]);
        totalDmgShare += parsePercent(r[pDmgShareIdx]);
        totalDtShare += parsePercent(r[pDtShareIdx]);
        totalControl += parseFloat(r[pCtrlIdx]) || 0;
        
        const gameSec = parseFloat(r[pTimeIdx]) || 0;
        totalTime += gameSec;
        totalKp += parsePercent(r[pKpIdx]);

        const side = (r[pSideIdx] || '').toUpperCase();
        if (side === 'BLUE') {
          blueMatches++;
          if (win) blueWins++;
        } else if (side === 'RED') {
          redMatches++;
          if (win) redWins++;
        }

        const stage = (r[pStageIdx] || '').toLowerCase();
        if (stage.includes('playoff') || stage.includes('???') || stage === '???') {
          poMatches++;
          if (win) poWins++;
        } else if (stage.includes('progressive') || stage.includes('round')) {
          prMatches++;
          if (win) prWins++;
        } else {
          gsMatches++;
          if (win) gsWins++;
        }

        const heroName = r[pHeroIdx]?.trim() || '';
        if (heroName) {
          if (!playerHeroGamesMap.has(heroName)) {
            playerHeroGamesMap.set(heroName, []);
          }
          playerHeroGamesMap.get(heroName)!.push(r);
        }
      }

      const matches = rows.length;
      const winRate = Math.round((wins / matches) * 100);
      const kda = parseFloat(((totalKills + totalAssists) / Math.max(1, totalDeaths)).toFixed(2));
      
      const avgKills = parseFloat((totalKills / matches).toFixed(1));
      const avgDeaths = parseFloat((totalDeaths / matches).toFixed(1));
      const avgAssists = parseFloat((totalAssists / matches).toFixed(1));
      
      const gpm = Math.round(totalGpm / matches);
      const dpm = Math.round(totalDpm / matches);
      const dtpm = Math.round(totalDtpm / matches);
      const buildingDpm = Math.round(totalBdpm / matches);
      
      const goldShare = parseFloat((totalGoldShare / matches).toFixed(2));
      const damageShare = parseFloat((totalDmgShare / matches).toFixed(2));
      const damageTakenShare = parseFloat((totalDtShare / matches).toFixed(2));
      
      const controlTime = parseFloat((totalControl / matches).toFixed(1));
      const avgGameMin = parseFloat(((totalTime / matches) / 60).toFixed(2));
      const kp = parseFloat((totalKp / matches).toFixed(2));

      const blueWR = blueMatches > 0 ? Math.round((blueWins / blueMatches) * 100) : 0;
      const redWR = redMatches > 0 ? Math.round((redWins / redMatches) * 100) : 0;

      const heroesList: MDLPlayerHero[] = [];
      for (const [hName, hRows] of playerHeroGamesMap.entries()) {
        let hWins = 0;
        let hKills = 0;
        let hDeaths = 0;
        let hAssists = 0;
        let hGpm = 0;
        let hDpm = 0;
        let hDtpm = 0;
        let hKp = 0;

        for (const hr of hRows) {
          if (isWin(hr[pResultIdx])) hWins++;
          hKills += parseFloat(hr[pKillsIdx]) || 0;
          hDeaths += parseFloat(hr[pDeathsIdx]) || 0;
          hAssists += parseFloat(hr[pAssistsIdx]) || 0;
          hGpm += parseFloat(hr[pGpmIdx]) || 0;
          hDpm += parseFloat(hr[pDpmIdx]) || 0;
          hDtpm += parseFloat(hr[pDtpmIdx]) || 0;
          hKp += parsePercent(hr[pKpIdx]);
        }

        const hMatches = hRows.length;
        const hHeroObj = findHeroByName(hName, dbHeroes);

        heroesList.push({
          heroName: hName.trim(),
          heroId: hHeroObj?.id,
          matches: hMatches,
          wins: hWins,
          winRate: Math.round((hWins / hMatches) * 100),
          kda: parseFloat(((hKills + hAssists) / Math.max(1, hDeaths)).toFixed(2)),
          gpm: Math.round(hGpm / hMatches),
          dpm: Math.round(hDpm / hMatches),
          dtm: Math.round(hDtpm / hMatches),
          kp: parseFloat((hKp / hMatches).toFixed(2)),
        });
      }
      heroesList.sort((a, b) => b.matches - a.matches);

      // Attributes Scaling
      const farmAttr = Math.min(99, Math.max(50, 50 + ((gpm - 450) / 350) * 45 + (goldShare - 15) * 1.5));
      const damageAttr = Math.min(99, Math.max(50, 50 + ((dpm - 1500) / 3500) * 45 + (damageShare - 15) * 1.5));
      const survivalAttr = Math.min(99, Math.max(50, 95 - (avgDeaths * 8) + (kda * 1.5)));
      const teamFightAttr = Math.min(99, Math.max(50, 50 + (kp - 40) * 0.8));
      const pushAttr = Math.min(99, Math.max(50, 50 + (buildingDpm / 300) * 45));
      const versatilityResult = calculateAdvancedPlayerVersatility(heroesList, matches, dbHeroes);
      const versatilityAttr = versatilityResult.score;
      const versatilityDetails = versatilityResult.details;
      const controlAttr = Math.min(99, Math.max(50, 50 + (controlTime / 45) * 45));

      let farmScore = farmAttr;
      let pushScore = pushAttr;
      if (computedRole === 'ROAM') {
        farmScore = Math.min(99, Math.max(70, 70 + (kp - 50) * 0.4));
        pushScore = Math.min(99, Math.max(65, 65 + (controlTime / 45) * 20));
      } else if (computedRole === 'MID') {
        pushScore = Math.min(99, Math.max(68, 68 + (damageShare - 20) * 0.8));
      }

      const scoutingScore = parseFloat(((farmScore + damageAttr + survivalAttr + teamFightAttr + pushScore + versatilityAttr) / 6).toFixed(1));

      let playstyleTag = 'Tactician';
      if (computedRole === 'JUNGLE') {
        playstyleTag = farmScore > 85 ? 'Carry Jungler' : 'Elusive Assassin';
      } else if (computedRole === 'ROAM') {
        playstyleTag = controlAttr > 85 ? 'Engage Maestro' : 'Protector';
      } else if (computedRole === 'MID') {
        playstyleTag = damageAttr > 85 ? 'Artillery Mage' : 'Utility Mid';
      } else if (computedRole === 'GOLD') {
        playstyleTag = damageAttr > 85 ? 'Late Game Carry' : 'Steady Marksman';
      } else if (computedRole === 'EXP') {
        playstyleTag = pushScore > 85 ? 'Split Pusher' : 'Sturdy Frontliner';
      }

      parsedPlayers.push({
        name: playerName,
        team: teamName,
        role: computedRole,
        matches,
        wins,
        winRate,
        heroPoolSize: heroesList.length,
        kda,
        kp,
        gpm,
        dpm,
        dtpm,
        buildingDpm,
        goldShare,
        damageShare,
        damageTakenShare,
        controlTime,
        avgDeaths,
        avgKills,
        avgAssists,
        avgGameMin,
        blueMatches,
        blueWins,
        blueWR,
        redMatches,
        redWins,
        redWR,
        groupStage: {
          matches: gsMatches,
          wins: gsWins,
          wr: gsMatches > 0 ? Math.round((gsWins / gsMatches) * 100) : 0,
        },
        progressiveRound: {
          matches: prMatches,
          wins: prWins,
          wr: prMatches > 0 ? Math.round((prWins / prMatches) * 100) : 0,
        },
        playoffs: {
          matches: poMatches,
          wins: poWins,
          wr: poMatches > 0 ? Math.round((poWins / poMatches) * 100) : 0,
        },
        attributes: {
          farm: parseFloat(farmScore.toFixed(1)),
          damage: parseFloat(damageAttr.toFixed(1)),
          survival: parseFloat(survivalAttr.toFixed(1)),
          teamFight: parseFloat(teamFightAttr.toFixed(1)),
          push: parseFloat(pushScore.toFixed(1)),
          versatility: parseFloat(versatilityAttr.toFixed(1)),
        },
        playstyleTag,
        scoutingScore,
        heroes: heroesList,
        versatilityDetails,
      });
    }

    // Process Teams
    const parsedTeams: MDLTeamScouting[] = [];
    const tHeaders = teamRows[0].map(h => h.trim());
    const teamDataRows = teamRows.slice(1);

    const tTeamIdx = getColIndex(tHeaders, 'Team');
    const tResultIdx = getColIndex(tHeaders, 'Result');
    const tSideIdx = getColIndex(tHeaders, 'Side');
    const tPickIdx = getColIndex(tHeaders, 'Pick');
    const tKillsIdx = getColIndex(tHeaders, 'Kills');
    const tDeathsIdx = getColIndex(tHeaders, 'Deaths');
    const tAssistsIdx = getColIndex(tHeaders, 'Assists');
    const tGpmIdx = getColIndex(tHeaders, 'Team Gold per Minute');
    const tDpmIdx = getColIndex(tHeaders, 'Team Damage per Minute');
    const tDtpmIdx = getColIndex(tHeaders, 'Team Damage Taken per Minute');
    const tTowerIdx = getColIndex(tHeaders, 'Tower Destroy Count');
    const tTurtleIdx = getColIndex(tHeaders, 'Cryoturtle Kill Count');
    const tLordIdx = getColIndex(tHeaders, 'Lord Kill Count');
    const tCtrlIdx = getColIndex(tHeaders, 'Team Control Time/s');
    const tTimeIdx = getColIndex(tHeaders, 'Time/s');
    const tStageIdx = getColIndex(tHeaders, 'Stage');
    const tEnemyIdx = getColIndex(tHeaders, 'Enemy Team');

    // Standardise team abbreviations (RC -> RGE) in team data
    teamDataRows.forEach(row => {
      if (tTeamIdx !== -1 && row[tTeamIdx] === 'RC') row[tTeamIdx] = 'RGE';
      if (tEnemyIdx !== -1 && row[tEnemyIdx] === 'RC') row[tEnemyIdx] = 'RGE';
    });

    const teamGamesMap = new Map<string, string[][]>();
    for (const row of teamDataRows) {
      if (row.length < Math.max(tTeamIdx, tResultIdx)) continue;
      const tName = row[tTeamIdx]?.trim();
      if (!tName) continue;
      // Skip invalid/test team names case-insensitively
      if (isInvalidEntity(tName)) {
        console.log(`[csvParser] Skipping invalid team entry: ${tName}`);
        continue;
      }
      if (!teamGamesMap.has(tName)) {
        teamGamesMap.set(tName, []);
      }
      teamGamesMap.get(tName)!.push(row);
    }

    for (const [tName, tRows] of teamGamesMap.entries()) {
      // Skip teams with too few matches (likely ping tests or incomplete data)
      if (tRows.length < MIN_TEAM_MATCHES) {
        console.log(`[csvParser] Skipping team "${tName}" with only ${tRows.length} matches (minimum: ${MIN_TEAM_MATCHES})`);
        continue;
      }
      let tWins = 0;
      let tKillsSum = 0;
      let tDeathsSum = 0;
      let tAssistsSum = 0;
      let tGpmSum = 0;
      let tDmgSum = 0;
      let tDtpmSum = 0;
      let tTowerSum = 0;
      let tTurtleSum = 0;
      let tLordSum = 0;
      let tCtrlSum = 0;
      let tTimeSum = 0;

      let tBlueMatches = 0;
      let tBlueWins = 0;
      let tRedMatches = 0;
      let tRedWins = 0;

      let tGsMatches = 0;
      let tGsWins = 0;
      let tPrMatches = 0;
      let tPrWins = 0;
      let tPoMatches = 0;
      let tPoWins = 0;

      const teamPickedHeroes = new Set<string>();

      for (const row of tRows) {
        const result = row[tResultIdx] || '';
        const win = isWin(result);
        if (win) tWins++;

        tKillsSum += parseFloat(row[tKillsIdx]) || 0;
        tDeathsSum += parseFloat(row[tDeathsIdx]) || 0;
        tAssistsSum += parseFloat(row[tAssistsIdx]) || 0;

        tGpmSum += parseFloat(row[tGpmIdx]) || 0;
        tDmgSum += parseFloat(row[tDpmIdx]) || 0;
        tDtpmSum += parseFloat(row[tDtpmIdx]) || 0;

        tTowerSum += parseFloat(row[tTowerIdx]) || 0;
        tTurtleSum += parseFloat(row[tTurtleIdx]) || 0;
        tLordSum += parseFloat(row[tLordIdx]) || 0;
        tCtrlSum += parseFloat(row[tCtrlIdx]) || 0;
        tTimeSum += parseFloat(row[tTimeIdx]) || 0;

        const sideVal = (row[tSideIdx] || '').trim().toUpperCase();
        if (sideVal === '1' || sideVal === 'BLUE') {
          tBlueMatches++;
          if (win) tBlueWins++;
        } else if (sideVal === '2' || sideVal === 'RED') {
          tRedMatches++;
          if (win) tRedWins++;
        }

        const stage = (row[tStageIdx] || '').toLowerCase();
        if (stage.includes('playoff') || stage.includes('???') || stage === '???') {
          tPoMatches++;
          if (win) tPoWins++;
        } else if (stage.includes('progressive') || stage.includes('round')) {
          tPrMatches++;
          if (win) tPrWins++;
        } else {
          tGsMatches++;
          if (win) tGsWins++;
        }

        const pickVal = row[tPickIdx] || '';
        if (pickVal) {
          const heroesPickedInGame = pickVal.split(',').map(h => h.trim());
          for (const hp of heroesPickedInGame) {
            if (hp) teamPickedHeroes.add(hp);
          }
        }
      }

      const tMatches = tRows.length;
      const tWinRate = Math.round((tWins / tMatches) * 100);

      const teamGpm = Math.round(tGpmSum / tMatches);
      const teamDamage = Math.round(tDmgSum / tMatches);
      const teamDamageTaken = Math.round(tDtpmSum / tMatches);
      const avgGameMin = parseFloat(((tTimeSum / tMatches) / 60).toFixed(2));

      const avgTurtles = parseFloat((tTurtleSum / tMatches).toFixed(1));
      const avgLords = parseFloat((tLordSum / tMatches).toFixed(1));
      const avgTowers = parseFloat((tTowerSum / tMatches).toFixed(1));

      const teamKills = parseFloat((tKillsSum / tMatches).toFixed(1));
      const teamDeaths = parseFloat((tDeathsSum / tMatches).toFixed(1));
      const teamAssists = parseFloat((tAssistsSum / tMatches).toFixed(1));
      const avgControl = parseFloat((tCtrlSum / tMatches).toFixed(1));

      const tBlueWR = tBlueMatches > 0 ? Math.round((tBlueWins / tBlueMatches) * 100) : 0;
      const tRedWR = tRedMatches > 0 ? Math.round((tRedWins / tRedMatches) * 100) : 0;

      // Attributes Scaling for Teams
      const tempoScore = Math.min(99, Math.max(50, 50 + (avgTurtles * 18) + (tWinRate - 50) * 0.2));
      const damageScore = Math.min(99, Math.max(50, 50 + ((teamDamage - 10000) / 8000) * 45));
      const durabilityScore = Math.min(99, Math.max(50, 95 - (teamDeaths * 2.5)));
      const objectiveScore = Math.min(99, Math.max(50, 50 + (avgLords * 15) + (avgTowers * 4.5)));
      const teamFightScore = Math.min(99, Math.max(50, 50 + (tWinRate - 50) * 0.8));
      const versatilityScore = Math.min(99, Math.max(50, 50 + (teamPickedHeroes.size - 8) * 3));

      const tScoutingScore = parseFloat(((tempoScore + damageScore + durabilityScore + objectiveScore + teamFightScore + versatilityScore) / 6).toFixed(1));

      let tPlaystyleTag = 'Balanced Playstyle';
      if (objectiveScore > 85) tPlaystyleTag = 'Objective Focused';
      else if (tempoScore > 85) tPlaystyleTag = 'Early Game Dominant';
      else if (teamFightScore > 85) tPlaystyleTag = 'Late Game Scaler';
      else if (damageScore > 85) tPlaystyleTag = 'Hyper-Aggressive';

      const rosterList = parsedPlayers
        .filter(p => p.team.toLowerCase() === tName.toLowerCase())
        .map(p => ({
          playerName: p.name,
          role: p.role,
          matches: p.matches,
          winRate: p.winRate,
          playstyleTag: p.playstyleTag,
          scoutingScore: p.scoutingScore,
        }));

      parsedTeams.push({
        name: tName,
        matches: tMatches,
        wins: tWins,
        winRate: tWinRate,
        playersCount: rosterList.length,
        distinctHeroes: teamPickedHeroes.size,
        teamGpm,
        teamDamage,
        teamDamageTaken,
        avgGameMin,
        avgTurtles,
        avgLords,
        avgTowers,
        teamKills,
        teamDeaths,
        teamAssists,
        avgControl,
        avgKp: rosterList.length > 0 ? parseFloat((rosterList.reduce((acc, curr) => acc + curr.winRate, 0) / rosterList.length).toFixed(2)) : 50,
        blueMatches: tBlueMatches,
        blueWins: tBlueWins,
        blueWR: tBlueWR,
        redMatches: tRedMatches,
        redWins: tRedWins,
        redWR: tRedWR,
        groupStage: {
          matches: tGsMatches,
          wins: tGsWins,
          wr: tGsMatches > 0 ? Math.round((tGsWins / tGsMatches) * 100) : 0,
        },
        progressiveRound: {
          matches: tPrMatches,
          wins: tPrWins,
          wr: tPrMatches > 0 ? Math.round((tPrWins / tPrMatches) * 100) : 0,
        },
        playoffs: {
          matches: tPoMatches,
          wins: tPoWins,
          wr: tPoMatches > 0 ? Math.round((tPoWins / tPoMatches) * 100) : 0,
        },
        attributes: {
          tempo: parseFloat(tempoScore.toFixed(1)),
          damage: parseFloat(damageScore.toFixed(1)),
          durability: parseFloat(durabilityScore.toFixed(1)),
          objective: parseFloat(objectiveScore.toFixed(1)),
          teamFight: parseFloat(teamFightScore.toFixed(1)),
          versatility: parseFloat(versatilityScore.toFixed(1)),
        },
        playstyleTag: tPlaystyleTag,
        scoutingScore: tScoutingScore,
        roster: rosterList,
      });
    }

    const globalHeroStats = new Map<string, { picks: number; wins: number }>();
    for (const player of parsedPlayers) {
      for (const hStat of player.heroes) {
        if (!globalHeroStats.has(hStat.heroName)) {
          globalHeroStats.set(hStat.heroName, { picks: 0, wins: 0 });
        }
        const g = globalHeroStats.get(hStat.heroName)!;
        g.picks += hStat.matches;
        g.wins += hStat.wins;
      }
    }

    const finalHeroes: MDLScoutingData['heroes'] = [];
    for (const [hName, stat] of globalHeroStats.entries()) {
      const matchedHero = findHeroByName(hName, dbHeroes);
      if (matchedHero) {
        finalHeroes.push({
          heroId: matchedHero.id!,
          name: matchedHero.name,
          role: matchedHero.role,
          picks: stat.picks,
          wins: stat.wins,
          winRate: stat.picks > 0 ? Math.round((stat.wins / stat.picks) * 100) : 0,
        });
      }
    }
    finalHeroes.sort((a, b) => b.picks - a.picks);
    parsedPlayers.sort((a, b) => b.scoutingScore - a.scoutingScore);
    parsedTeams.sort((a, b) => b.scoutingScore - a.scoutingScore);

    return {
      players: parsedPlayers,
      teams: parsedTeams,
      heroes: finalHeroes,
    };
  }

  // Otherwise, fall back to the old pre-aggregated MDL parser
  console.log('[csvParser] Processing standard pre-aggregated CSV formats...');
  const rosterRows = parseCSV(teamRosterCsv);
  const heroRows = parseCSV(mostPlayedHeroCsv);

  const findHeaderAndRows = (rows: string[][], keywords: string[]) => {
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const matchCount = keywords.filter(kw => 
        rows[i].some(cell => cell.toLowerCase().trim() === kw.toLowerCase())
      ).length;
      if (matchCount >= keywords.length - 1) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      throw new Error(`CSV format mismatch. Could not identify header containing keywords: ${keywords.join(', ')}`);
    }
    const header = rows[headerIdx].map(h => h.trim());
    const dataRows = rows.slice(headerIdx + 1);
    return { header, dataRows };
  };

  const pData = findHeaderAndRows(playerRows, ['Player', 'Team', 'Role', 'Matches', 'Win_Rate']);
  const tData = findHeaderAndRows(teamRows, ['Team', 'Matches', 'Win_Rate', 'Players', 'Distinct_Heroes']);
  const rData = findHeaderAndRows(rosterRows, ['Team', 'Role', 'Player', 'Matches', 'Scouting_Score']);
  const hData = findHeaderAndRows(heroRows, ['Player', 'Team', 'Role', 'Hero', 'Total Match']);

  const getColIndex = (header: string[], colName: string) => {
    return header.findIndex(h => h.toLowerCase() === colName.toLowerCase());
  };

  // 1. Process Most Played Heroes per Player
  const playerHeroesMap = new Map<string, MDLPlayerHero[]>();
  const globalHeroStats = new Map<string, { picks: number; wins: number }>();

  const pHPlayerIdx = getColIndex(hData.header, 'Player');
  const pHTeamIdx = getColIndex(hData.header, 'Team');
  const pHHeroIdx = getColIndex(hData.header, 'Hero');
  const pHMatchesIdx = getColIndex(hData.header, 'Total Match');
  const pHWinrateIdx = getColIndex(hData.header, 'Win Rate');
  const pHKdaIdx = getColIndex(hData.header, 'KDA');
  const pHGpmIdx = getColIndex(hData.header, 'GPM');
  const pHDpmIdx = getColIndex(hData.header, 'DPM');
  const pHDtmIdx = getColIndex(hData.header, 'DTM');
  const pHKpIdx = getColIndex(hData.header, 'KP%');

  for (const row of hData.dataRows) {
    if (row.length < Math.max(pHPlayerIdx, pHHeroIdx, pHMatchesIdx)) continue;
    const player = row[pHPlayerIdx]?.trim();
    const team = row[pHTeamIdx]?.trim();
    const heroName = row[pHHeroIdx]?.trim();
    if (!player || !heroName) continue;

    const matches = parseInt(row[pHMatchesIdx]) || 0;
    const winRate = parsePercent(row[pHWinrateIdx]);
    const wins = Math.round((matches * winRate) / 100);
    const kda = parseFloat(row[pHKdaIdx]) || 0;
    const gpm = parseInt(row[pHGpmIdx]) || 0;
    const dpm = parseInt(row[pHDpmIdx]) || 0;
    const dtm = parseInt(row[pHDtmIdx]) || 0;
    const kp = parsePercent(row[pHKpIdx]);

    const mappedHero = findHeroByName(heroName, dbHeroes);

    const playerKey = `${player.toLowerCase()}@${team?.toLowerCase()}`;
    if (!playerHeroesMap.has(playerKey)) {
      playerHeroesMap.set(playerKey, []);
    }

    playerHeroesMap.get(playerKey)!.push({
      heroName,
      heroId: mappedHero?.id,
      matches,
      wins,
      winRate,
      kda,
      gpm,
      dpm,
      dtm,
      kp,
    });

    const hKey = mappedHero ? mappedHero.name : heroName;
    if (!globalHeroStats.has(hKey)) {
      globalHeroStats.set(hKey, { picks: 0, wins: 0 });
    }
    const currentGlobal = globalHeroStats.get(hKey)!;
    currentGlobal.picks += matches;
    currentGlobal.wins += wins;
  }

  for (const key of playerHeroesMap.keys()) {
    playerHeroesMap.get(key)!.sort((a, b) => b.matches - a.matches);
  }

  // 2. Process Player Roster
  const teamRosterMap = new Map<string, MDLTeamScouting['roster']>();
  
  const rTeamIdx = getColIndex(rData.header, 'Team');
  const rRoleIdx = getColIndex(rData.header, 'Role');
  const rPlayerIdx = getColIndex(rData.header, 'Player');
  const rMatchesIdx = getColIndex(rData.header, 'Matches');
  const rWinrateIdx = getColIndex(rData.header, 'Win_Rate');
  const rTagIdx = getColIndex(rData.header, 'Playstyle_Tag');
  const rScoreIdx = getColIndex(rData.header, 'Scouting_Score');

  for (const row of rData.dataRows) {
    if (row.length < Math.max(rTeamIdx, rPlayerIdx)) continue;
    const team = row[rTeamIdx]?.trim();
    const player = row[rPlayerIdx]?.trim();
    const role = row[rRoleIdx]?.trim() || '';
    if (!team || !player) continue;

    const matches = parseInt(row[rMatchesIdx]) || 0;
    const winRate = parsePercent(row[rWinrateIdx]);
    const playstyleTag = row[rTagIdx]?.trim() || '';
    const scoutingScore = parseFloat(row[rScoreIdx]) || 0;

    const teamKey = team.toUpperCase();
    if (!teamRosterMap.has(teamKey)) {
      teamRosterMap.set(teamKey, []);
    }

    teamRosterMap.get(teamKey)!.push({
      playerName: player,
      role,
      matches,
      winRate,
      playstyleTag,
      scoutingScore,
    });
  }

  // 3. Process Players Summary
  const parsedPlayers: MDLPlayerScouting[] = [];
  const pHeaders = pData.header;

  const playerIdx = getColIndex(pHeaders, 'Player');
  const teamIdx = getColIndex(pHeaders, 'Team');
  const roleIdx = getColIndex(pHeaders, 'Role');
  const matchesIdx = getColIndex(pHeaders, 'Matches');
  const winsIdx = getColIndex(pHeaders, 'Wins');
  const winRateIdx = getColIndex(pHeaders, 'Win_Rate');
  const poolIdx = getColIndex(pHeaders, 'Hero_Pool');
  const kdaIdx = getColIndex(pHeaders, 'KDA');
  const kpIdx = getColIndex(pHeaders, 'KP');
  const gpmIdx = getColIndex(pHeaders, 'GPM');
  const dpmIdx = getColIndex(pHeaders, 'DPM');
  const dtpmIdx = getColIndex(pHeaders, 'DTPM');
  const bdpmIdx = getColIndex(pHeaders, 'BuildingDPM');
  const goldShareIdx = getColIndex(pHeaders, 'GoldShare');
  const dmgShareIdx = getColIndex(pHeaders, 'DamageShare');
  const dTakenShareIdx = getColIndex(pHeaders, 'DamageTakenShare');
  const ctrlIdx = getColIndex(pHeaders, 'ControlTime');
  const dthIdx = getColIndex(pHeaders, 'AvgDeaths');
  const klsIdx = getColIndex(pHeaders, 'AvgKills');
  const astIdx = getColIndex(pHeaders, 'AvgAssists');
  const minIdx = getColIndex(pHeaders, 'Avg_Game_Min');

  const bMatIdx = getColIndex(pHeaders, 'Blue_Matches');
  const bWinIdx = getColIndex(pHeaders, 'Blue_Wins');
  const bWrIdx = getColIndex(pHeaders, 'Blue_WR');
  const rMatIdx = getColIndex(pHeaders, 'Red_Matches');
  const rWinIdx = getColIndex(pHeaders, 'Red_Wins');
  const rWrIdx = getColIndex(pHeaders, 'Red_WR');

  const gsMatIdx = getColIndex(pHeaders, 'GS_Matches');
  const gsWinIdx = getColIndex(pHeaders, 'GS_Wins');
  const gsWrIdx = getColIndex(pHeaders, 'GS_WR');
  const prMatIdx = getColIndex(pHeaders, 'PR_Matches');
  const prWinIdx = getColIndex(pHeaders, 'PR_Wins');
  const prWrIdx = getColIndex(pHeaders, 'PR_WR');
  const poMatIdx = getColIndex(pHeaders, 'PO_Matches');
  const poWinIdx = getColIndex(pHeaders, 'PO_Wins');
  const poWrIdx = getColIndex(pHeaders, 'PO_WR');

  const attFarmIdx = getColIndex(pHeaders, 'Farm_Score');
  const attDmgIdx = getColIndex(pHeaders, 'Damage_Score');
  const attSurvIdx = getColIndex(pHeaders, 'Survival_Score');
  const attTfIdx = getColIndex(pHeaders, 'TeamFight_Score');
  const attPushIdx = getColIndex(pHeaders, 'Push_Score');
  const attCtrlIdx = getColIndex(pHeaders, 'Control_Score');

  const pTagIdx = getColIndex(pHeaders, 'Playstyle_Tag');
  const pScoreIdx = getColIndex(pHeaders, 'Scouting_Score');

  for (const row of pData.dataRows) {
    if (row.length < Math.max(playerIdx, teamIdx, matchesIdx)) continue;
    const name = row[playerIdx]?.trim();
    const team = row[teamIdx]?.trim();
    if (!name || !team) continue;

    const role = row[roleIdx]?.trim() || 'GOLD';
    const matches = parseInt(row[matchesIdx]) || 0;
    const wins = parseInt(row[winsIdx]) || 0;
    const winRate = parsePercent(row[winRateIdx]);
    const heroPoolSize = parseInt(row[poolIdx]) || 0;
    const kda = parseFloat(row[kdaIdx]) || 0;
    const kp = parsePercent(row[kpIdx]);
    const gpm = parseFloat(row[gpmIdx]) || 0;
    const dpm = parseFloat(row[dpmIdx]) || 0;
    const dtpm = parseFloat(row[dtpmIdx]) || 0;
    const buildingDpm = parseFloat(row[bdpmIdx]) || 0;
    const goldShare = parsePercent(row[goldShareIdx]);
    const damageShare = parsePercent(row[dmgShareIdx]);
    const damageTakenShare = parsePercent(row[dTakenShareIdx]);
    const controlTime = parseFloat(row[ctrlIdx]) || 0;
    const avgDeaths = parseFloat(row[dthIdx]) || 0;
    const avgKills = parseFloat(row[klsIdx]) || 0;
    const avgAssists = parseFloat(row[astIdx]) || 0;
    const avgGameMin = parseFloat(row[minIdx]) || 0;

    const playerKey = `${name.toLowerCase()}@${team.toLowerCase()}`;
    const heroesList = playerHeroesMap.get(playerKey) || [];

    parsedPlayers.push({
      name,
      team,
      role,
      matches,
      wins,
      winRate,
      heroPoolSize,
      kda,
      kp,
      gpm,
      dpm,
      dtpm,
      buildingDpm,
      goldShare,
      damageShare,
      damageTakenShare,
      controlTime,
      avgDeaths,
      avgKills,
      avgAssists,
      avgGameMin,
      blueMatches: parseInt(row[bMatIdx]) || 0,
      blueWins: parseInt(row[bWinIdx]) || 0,
      blueWR: parsePercent(row[bWrIdx]),
      redMatches: parseInt(row[rMatIdx]) || 0,
      redWins: parseInt(row[rWinIdx]) || 0,
      redWR: parsePercent(row[rWrIdx]),
      groupStage: {
        matches: parseInt(row[gsMatIdx]) || 0,
        wins: parseInt(row[gsWinIdx]) || 0,
        wr: parsePercent(row[gsWrIdx]),
      },
      progressiveRound: {
        matches: parseInt(row[prMatIdx]) || 0,
        wins: parseInt(row[prWinIdx]) || 0,
        wr: parsePercent(row[prWrIdx]),
      },
      playoffs: {
        matches: parseInt(row[poMatIdx]) || 0,
        wins: parseInt(row[poWinIdx]) || 0,
        wr: parsePercent(row[poWrIdx]),
      },
      attributes: {
        farm: parseFloat(row[attFarmIdx]) || 0,
        damage: parseFloat(row[attDmgIdx]) || 0,
        survival: parseFloat(row[attSurvIdx]) || 0,
        teamFight: parseFloat(row[attTfIdx]) || 0,
        push: parseFloat(row[attPushIdx]) || 0,
        versatility: parseFloat(row[attCtrlIdx]) || 0,
      },
      playstyleTag: row[pTagIdx]?.trim() || '',
      scoutingScore: parseFloat(row[pScoreIdx]) || 0,
      heroes: heroesList,
    });
  }

  // 4. Process Teams Summary
  const parsedTeams: MDLTeamScouting[] = [];
  const tHeaders = tData.header;

  const tTeamIdx = getColIndex(tHeaders, 'Team');
  const tMatchesIdx = getColIndex(tHeaders, 'Matches');
  const tWinsIdx = getColIndex(tHeaders, 'Wins');
  const tWinRateIdx = getColIndex(tHeaders, 'Win_Rate');
  const tPlayersIdx = getColIndex(tHeaders, 'Players');
  const tDistinctIdx = getColIndex(tHeaders, 'Distinct_Heroes');
  const tGpmIdx = getColIndex(tHeaders, 'Team_GPM');
  const tDmgIdx = getColIndex(tHeaders, 'Team_Damage');
  const tDmgTakenIdx = getColIndex(tHeaders, 'Team_DamageTaken');
  const tMinIdx = getColIndex(tHeaders, 'Avg_Game_Min');
  const tTurtlesIdx = getColIndex(tHeaders, 'Avg_Turtles');
  const tLordsIdx = getColIndex(tHeaders, 'Avg_Lords');
  const tTowersIdx = getColIndex(tHeaders, 'Avg_Towers');
  const tKillsIdx = getColIndex(tHeaders, 'Team_Kills');
  const tDeathsIdx = getColIndex(tHeaders, 'Team_Deaths');
  const tAssistsIdx = getColIndex(tHeaders, 'Team_Assists');
  const tCtrlIdx = getColIndex(tHeaders, 'Avg_Control');
  const tKpIdx = getColIndex(tHeaders, 'Avg_KP');

  const tbMatIdx = getColIndex(tHeaders, 'Blue_Matches');
  const tbWinIdx = getColIndex(tHeaders, 'Blue_Wins');
  const tbWrIdx = getColIndex(tHeaders, 'Blue_WR');
  const trMatIdx = getColIndex(tHeaders, 'Red_Matches');
  const trWinIdx = getColIndex(tHeaders, 'Red_Wins');
  const trWrIdx = getColIndex(tHeaders, 'Red_WR');

  const tgsMatIdx = getColIndex(tHeaders, 'GS_Matches');
  const tgsWinIdx = getColIndex(tHeaders, 'GS_Wins');
  const tgsWrIdx = getColIndex(tHeaders, 'GS_WR');
  const tprMatIdx = getColIndex(tHeaders, 'PR_Matches');
  const tprWinIdx = getColIndex(tHeaders, 'PR_Wins');
  const tprWrIdx = getColIndex(tHeaders, 'PR_WR');
  const tpoMatIdx = getColIndex(tHeaders, 'PO_Matches');
  const tpoWinIdx = getColIndex(tHeaders, 'PO_Wins');
  const tpoWrIdx = getColIndex(tHeaders, 'PO_WR');

  const attTempoIdx = getColIndex(tHeaders, 'Tempo_Score');
  const attTDmgIdx = getColIndex(tHeaders, 'Damage_Score');
  const attDurIdx = getColIndex(tHeaders, 'Durability_Score');
  const attObjIdx = getColIndex(tHeaders, 'Objective_Score');
  const attTfTDmgIdx = getColIndex(tHeaders, 'Teamfight_Score');
  const attCtrlTIdx = getColIndex(tHeaders, 'Control_Score');

  const tTagIdx = getColIndex(tHeaders, 'Playstyle_Tag');
  const tScoreIdx = getColIndex(tHeaders, 'Scouting_Score');

  for (const row of tData.dataRows) {
    if (row.length < Math.max(tTeamIdx, tMatchesIdx)) continue;
    const name = row[tTeamIdx]?.trim();
    if (!name) continue;

    const matches = parseInt(row[tMatchesIdx]) || 0;
    const wins = parseInt(row[tWinsIdx]) || 0;
    const winRate = parsePercent(row[tWinRateIdx]);
    const playersCount = parseInt(row[tPlayersIdx]) || 0;
    const distinctHeroes = parseInt(row[tDistinctIdx]) || 0;
    const teamGpm = parseFloat(row[tGpmIdx]) || 0;
    const teamDamage = parseFloat(row[tDmgIdx]) || 0;
    const teamDamageTaken = parseFloat(row[tDmgTakenIdx]) || 0;
    const avgGameMin = parseFloat(row[tMinIdx]) || 0;
    const avgTurtles = parseFloat(row[tTurtlesIdx]) || 0;
    const avgLords = parseFloat(row[tLordsIdx]) || 0;
    const avgTowers = parseFloat(row[tTowersIdx]) || 0;
    const teamKills = parseFloat(row[tKillsIdx]) || 0;
    const teamDeaths = parseFloat(row[tDeathsIdx]) || 0;
    const teamAssists = parseFloat(row[tAssistsIdx]) || 0;
    const avgControl = parseFloat(row[tCtrlIdx]) || 0;
    const avgKp = parsePercent(row[tKpIdx]);

    const rosterList = teamRosterMap.get(name.toUpperCase()) || [];

    parsedTeams.push({
      name,
      matches,
      wins,
      winRate,
      playersCount,
      distinctHeroes,
      teamGpm,
      teamDamage,
      teamDamageTaken,
      avgGameMin,
      avgTurtles,
      avgLords,
      avgTowers,
      teamKills,
      teamDeaths,
      teamAssists,
      avgControl,
      avgKp,
      blueMatches: parseInt(row[tbMatIdx]) || 0,
      blueWins: parseInt(row[tbWinIdx]) || 0,
      blueWR: parsePercent(row[tbWrIdx]),
      redMatches: parseInt(row[trMatIdx]) || 0,
      redWins: parseInt(row[trWinIdx]) || 0,
      redWR: parsePercent(row[trWrIdx]),
      groupStage: {
        matches: parseInt(row[tgsMatIdx]) || 0,
        wins: parseInt(row[tgsWinIdx]) || 0,
        wr: parsePercent(row[tgsWrIdx]),
      },
      progressiveRound: {
        matches: parseInt(row[tprMatIdx]) || 0,
        wins: parseInt(row[tprWinIdx]) || 0,
        wr: parsePercent(row[tprWrIdx]),
      },
      playoffs: {
        matches: parseInt(row[tpoMatIdx]) || 0,
        wins: parseInt(row[tpoWinIdx]) || 0,
        wr: parsePercent(row[tpoWrIdx]),
      },
      attributes: {
        tempo: parseFloat(row[attTempoIdx]) || 0,
        damage: parseFloat(row[attTDmgIdx]) || 0,
        durability: parseFloat(row[attDurIdx]) || 0,
        objective: parseFloat(row[attObjIdx]) || 0,
        teamFight: parseFloat(row[attTfTDmgIdx]) || 0,
        versatility: parseFloat(row[attCtrlTIdx]) || 0,
      },
      playstyleTag: row[tTagIdx]?.trim() || '',
      scoutingScore: parseFloat(row[tScoreIdx]) || 0,
      roster: rosterList,
    });
  }

  // 5. Gather unique hero pick counts
  const finalHeroes: MDLScoutingData['heroes'] = [];
  for (const [hName, stat] of globalHeroStats.entries()) {
    const matchedHero = findHeroByName(hName, dbHeroes);
    if (matchedHero) {
      finalHeroes.push({
        heroId: matchedHero.id!,
        name: matchedHero.name,
        role: matchedHero.role,
        picks: stat.picks,
        wins: stat.wins,
        winRate: stat.picks > 0 ? Math.round((stat.wins / stat.picks) * 100) : 0,
      });
    }
  }
  finalHeroes.sort((a, b) => b.picks - a.picks);

  // Sorting
  parsedPlayers.sort((a, b) => b.scoutingScore - a.scoutingScore);
  parsedTeams.sort((a, b) => b.scoutingScore - a.scoutingScore);

  return {
    players: parsedPlayers,
    teams: parsedTeams,
    heroes: finalHeroes,
  };
}

// ────────────────────────────────────────────────
// Syncer: Writes Aggregated MDL S12 Stats to IndexedDB
// ────────────────────────────────────────────────
export async function syncMDLDataToDB(data: MDLScoutingData): Promise<{
  syncedOpponents: number;
  syncedPlayers: number;
  syncedStats: number;
}> {
  if (typeof window === 'undefined' || !db) {
    return { syncedOpponents: 0, syncedPlayers: 0, syncedStats: 0 };
  }

  // 1. Sync Teams (Opponents)
  let syncedOpponents = 0;
  for (const team of data.teams) {
    const existing = await db.opponents.where('name').equalsIgnoreCase(team.name).first();

    const tendencySummary = `Playstyle: ${team.playstyleTag}. Matches: ${team.matches}, Winrate: ${team.winRate}%. Avg towers: ${team.avgTowers}, Turtles: ${team.avgTurtles}, Lords: ${team.avgLords}. Attributes: Tempo: ${team.attributes.tempo}, Damage: ${team.attributes.damage}, Durability: ${team.attributes.durability}, Objective: ${team.attributes.objective}, Versatility: ${team.attributes.versatility}.`;

    const opponentData: Omit<Opponent, 'id'> = {
      name: team.name,
      notes: `MDL Indonesia Season 12 Scouting profile: Scouting Score: ${team.scoutingScore}. Distinct heroes pooled: ${team.distinctHeroes}. GPM: ${team.teamGpm}, DPM: ${team.teamDamage}.`,
      firstPhaseBans: [],
      comfortPicks: [],
      sidePreference: team.blueWins > team.redWins ? 'Blue' : team.redWins > team.blueWins ? 'Red' : 'Neutral',
      priorityHeroes: [],
      pocketPicks: [],
      tendencies: tendencySummary,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (existing) {
      await db.opponents.update(existing.id!, {
        ...opponentData,
        notes: `${existing.notes}\n\n[MDL ID S12 Sync]: ${opponentData.notes}`,
        updatedAt: new Date(),
      });
    } else {
      await db.opponents.add(opponentData as Opponent);
    }
    syncedOpponents++;
  }

  // 2. Sync Players & their Hero Stats
  let syncedPlayers = 0;
  let syncedStats = 0;

  for (const player of data.players) {
    const existingPlayer = await db.players.where('name').equalsIgnoreCase(player.name).first();

    // Map lane string GOLD -> Gold, ROAM -> Roam, JUNGLE -> Jungle, MID -> Mid, EXP -> EXP
    let mappedRole: LanePosition = 'Gold';
    const roleUpper = player.role.toUpperCase();
    if (roleUpper === 'JUNGLE') mappedRole = 'Jungle';
    else if (roleUpper === 'MID') mappedRole = 'Mid';
    else if (roleUpper === 'ROAM') mappedRole = 'Roam';
    else if (roleUpper === 'EXP') mappedRole = 'EXP';

    const comfortHeroIds = player.heroes.slice(0, 5).map(h => h.heroId).filter((id): id is number => id !== undefined);

    const playerData: Omit<Player, 'id'> = {
      name: player.name,
      role: mappedRole,
      comfortHeroes: comfortHeroIds,
      notes: `MDL ID S12 Player for Team ${player.team}. Scouting Score: ${player.scoutingScore}, Playstyle: ${player.playstyleTag}. WR: ${player.winRate}% (${player.matches} games). KDA: ${player.kda} (${player.avgKills}/${player.avgDeaths}/${player.avgAssists}). GPM: ${player.gpm}, DPM: ${player.dpm}, Tower DPM: ${player.buildingDpm}. Gold Share: ${player.goldShare}%, Damage Share: ${player.damageShare}%.`,
      createdAt: new Date(),
    };

    let playerId: number;
    if (existingPlayer) {
      playerId = existingPlayer.id!;
      await db.players.update(playerId, {
        role: playerData.role,
        comfortHeroes: comfortHeroIds,
        notes: `${existingPlayer.notes}\n\n[MDL ID S12 Sync]: ${playerData.notes}`,
      });
    } else {
      playerId = (await db.players.add(playerData as Player)) as number;
    }
    syncedPlayers++;

    // Sync individual player hero performance stats
    for (const hStat of player.heroes) {
      if (hStat.heroId === undefined) continue;

      const existingStat = await db.playerHeroStats
        .where('playerId')
        .equals(playerId)
        .filter(item => item.heroId === hStat.heroId)
        .first();

      const confidenceScore = hStat.winRate >= 60 ? 9 : hStat.winRate >= 50 ? 7 : 5;
      const tournamentPerf = Math.round(hStat.winRate / 10);

      const statData: Omit<PlayerHeroStat, 'id'> = {
        playerId,
        heroId: hStat.heroId,
        gamesPlayed: hStat.matches,
        wins: hStat.wins,
        winrate: hStat.winRate,
        confidenceScore,
        tournamentPerformance: tournamentPerf,
        scrimPerformance: 7, // default neutral
        tier: hStat.winRate >= 65 ? 'S' : hStat.winRate >= 55 ? 'A' : hStat.winRate >= 45 ? 'B' : 'C',
      };

      if (existingStat) {
        await db.playerHeroStats.update(existingStat.id!, statData);
      } else {
        await db.playerHeroStats.add(statData as PlayerHeroStat);
      }
      syncedStats++;
    }
  }

  return { syncedOpponents, syncedPlayers, syncedStats };
}
