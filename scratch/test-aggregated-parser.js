const fs = require('fs');
const path = require('path');

const playerSummaryCsvPath = 'C:\\Users\\wahid\\Downloads\\mpl trkey player.csv';
const rawLogsCsvPath = 'C:\\Users\\wahid\\Downloads\\MPL TR PLAYER.csv';

if (!fs.existsSync(playerSummaryCsvPath) || !fs.existsSync(rawLogsCsvPath)) {
  console.error('Test files missing in Downloads folder.');
  process.exit(1);
}

const playerSummaryCsv = fs.readFileSync(playerSummaryCsvPath, 'utf8');
const rawLogsCsv = fs.readFileSync(rawLogsCsvPath, 'utf8');

// Copy simple parsing and mapping utilities from csvParser.ts
function cleanName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCSV(text) {
  const result = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
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

// Roster from teamRoster.ts
const mplTurkeyRosters = [
  { teamCode: 'AUR', teamName: 'Aurora Gaming', players: [
    { name: 'Lunar', role: 'EXP' }, { name: 'Tienzy', role: 'Jungle' }, { name: 'Rosa', role: 'Mid' }, { name: 'Sigibum', role: 'Gold' }, { name: 'Pagu', role: 'Roam' }, { name: 'ReiNNNN', role: 'Mid' }
  ]},
  { teamCode: 'FUT', teamName: 'FUT Esports', players: [
    { name: 'EKSI', role: 'EXP' }, { name: 'Kazue', role: 'Jungle' }, { name: 'Saiki', role: 'Mid' }, { name: 'Rx', role: 'Gold' }, { name: 'Blotzfet', role: 'Roam' }
  ]},
  { teamCode: 'MISA', teamName: 'Misa Esports', players: [
    { name: 'Wassa', role: 'EXP' }, { name: 'Moji', role: 'Jungle' }, { name: 'After Dark', role: 'Mid' }, { name: 'XIAO', role: 'Gold' }, { name: 'Qaro', role: 'Roam' }
  ]},
  { teamCode: 'BJK', teamName: 'Beşiktaş Esports', players: [
    { name: 'Kunteper', role: 'EXP' }, { name: 'Zeyn', role: 'Jungle' }, { name: 'Sancho', role: 'Mid' }, { name: 'Ravex', role: 'Gold' }, { name: 'NUMB', role: 'Roam' }, { name: 'Kirai', role: 'Mid' }
  ]},
  { teamCode: 'BW', teamName: 'Bushido Wildcats', players: [
    { name: 'Doran', role: 'EXP' }, { name: 'Nexus', role: 'Jungle' }, { name: 'Kirai', role: 'Mid' }, { name: 'Sunshine', role: 'Gold' }, { name: 'Wackter', role: 'Roam' }, { name: 'Alien', role: 'EXP' }
  ]},
  { teamCode: 'PCF', teamName: 'PCIFIC Esports', players: [
    { name: 'Ross', role: 'EXP' }, { name: 'Titan', role: 'Jungle' }, { name: 'Remember Me', role: 'Mid' }, { name: 'Elvis', role: 'Gold' }, { name: 'Diffy', role: 'Roam' }
  ]},
  { teamCode: 'EF', teamName: 'Eternal Fire', players: [
    { name: 'Saviom', role: 'EXP' }, { name: 'Harikasın Samet', role: 'Jungle' }, { name: 'Zeichnen', role: 'Mid' }, { name: 'Ranque', role: 'Gold' }, { name: 'Intangible', role: 'Roam' }, { name: 'Alien', role: 'EXP' }
  ]},
  { teamCode: 'RGE', teamName: 'Regnum Carya Esports', players: [
    { name: 'Kausei', role: 'EXP' }, { name: 'Elandor', role: 'Jungle' }, { name: 'EASYY', role: 'Mid' }, { name: 'Kite', role: 'Gold' }, { name: 'Shinki', role: 'Roam' }
  ]}
];

// Map a player name to their team details
function getPlayerTeamDetails(playerName) {
  const cleanP = cleanName(playerName);
  for (const team of mplTurkeyRosters) {
    for (const p of team.players) {
      if (cleanName(p.name) === cleanP) {
        return { teamCode: team.teamCode, teamName: team.teamName, role: p.role };
      }
    }
  }
  // Fallback if not found in active lists
  return { teamCode: 'UNK', teamName: 'Unknown Team', role: 'Mid' };
}

function parsePercent(val) {
  if (!val) return 0;
  return parseFloat(val.replace('%', '')) || 0;
}

const playerRows = parseCSV(playerSummaryCsv);
const rawRows = parseCSV(rawLogsCsv);

console.log('Total aggregated player rows parsed:', playerRows.length);
console.log('Total raw log rows parsed:', rawRows.length);

// 1. Build map of player -> played heroes from raw log data
const rawHeaders = rawRows[0].map(h => h.trim());
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

const playerHeroesMap = new Map();
for (let i = 1; i < rawRows.length; i++) {
  const row = rawRows[i];
  if (row.length < Math.max(rawPlayerIdx, rawHeroIdx)) continue;
  const player = row[rawPlayerIdx]?.trim();
  const hero = row[rawHeroIdx]?.trim();
  if (!player || !hero) continue;

  const key = cleanName(player);
  if (!playerHeroesMap.has(key)) {
    playerHeroesMap.set(key, new Map());
  }
  const heroMap = playerHeroesMap.get(key);
  if (!heroMap.has(hero)) {
    heroMap.set(hero, { matches: 0, wins: 0, kills: 0, deaths: 0, assists: 0, gpm: 0, dpm: 0, dtpm: 0, kp: 0 });
  }
  const stats = heroMap.get(hero);
  stats.matches++;
  
  const isWin = row[rawResultIdx]?.trim().toLowerCase() === 'win';
  if (isWin) stats.wins++;
  
  stats.kills += parseFloat(row[rawKillsIdx]) || 0;
  stats.deaths += parseFloat(row[rawDeathsIdx]) || 0;
  stats.assists += parseFloat(row[rawAssistsIdx]) || 0;
  stats.gpm += parseFloat(row[rawGpmIdx]) || 0;
  stats.dpm += parseFloat(row[rawDpmIdx]) || 0;
  stats.dtpm += parseFloat(row[rawDtpmIdx]) || 0;
  stats.kp += parsePercent(row[rawKpIdx]);
}

console.log('Collected played heroes for', playerHeroesMap.size, 'players.');

// 2. Parse aggregated playoff sheet
const headers = playerRows[0].map(h => h.trim());
const dataRows = playerRows.slice(1);

const parsedPlayers = [];
for (const row of dataRows) {
  if (row.length < 5) continue;
  const playerName = row[0]?.trim();
  if (!playerName) continue;

  const { teamCode, teamName, role } = getPlayerTeamDetails(playerName);
  const gamesPlayed = parseInt(row[5]) || 0;
  const wins = parseInt(row[6]) || 0;
  const winRate = parsePercent(row[7]);
  const kda = parseFloat(row[17]) || 0;
  const kp = parsePercent(row[18]);
  const gpm = parseInt(row[21]) || 0;
  const goldShare = parsePercent(row[22]);
  const dpm = parseInt(row[26]) || 0;
  const damageShare = parsePercent(row[27]);
  const buildingDpm = parseInt(row[30]) || 0;
  const dtpm = parseInt(row[34]) || 0;
  const damageTakenShare = parsePercent(row[35]);
  const controlTime = parseFloat(row[38]) || 0;
  const avgDeaths = parseFloat(row[12]) || 0;
  const avgKills = parseFloat(row[9]) || 0;
  const avgAssists = parseFloat(row[15]) || 0;
  const avgGameMin = (parseFloat(row[51]) || 0) / 60;

  // Recalculate comfort heroes by combining raw games with playoff weights
  const rawHeroMap = playerHeroesMap.get(cleanName(playerName)) || new Map();
  const heroesList = [];
  
  for (const [hName, rawStats] of rawHeroMap.entries()) {
    const rawMatches = rawStats.matches;
    const rawWins = rawStats.wins;
    const rawWR = rawMatches > 0 ? (rawWins / rawMatches) : 0.5;

    // Scale to playoff matches: if player has 27 games instead of 26, slightly scale up hero count
    const ratio = gamesPlayed / Math.max(1, Array.from(rawHeroMap.values()).reduce((sum, s) => sum + s.matches, 0));
    const finalHeroMatches = Math.max(1, Math.round(rawMatches * ratio));
    const finalHeroWins = Math.round(finalHeroMatches * rawWR);

    heroesList.push({
      heroName: hName,
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
  const controlAttr = Math.min(99, Math.max(50, 50 + (controlTime / 45) * 45));

  let farmScore = farmAttr;
  let pushScore = pushAttr;
  const roleUpper = role.toUpperCase();
  if (roleUpper === 'ROAM') {
    farmScore = Math.min(99, Math.max(70, 70 + (kp - 50) * 0.4));
    pushScore = Math.min(99, Math.max(65, 65 + (controlTime / 45) * 20));
  } else if (roleUpper === 'MID') {
    pushScore = Math.min(99, Math.max(68, 68 + (damageShare - 20) * 0.8));
  }

  const scoutingScore = parseFloat(((farmScore + damageAttr + survivalAttr + teamFightAttr + pushScore + controlAttr) / 6).toFixed(1));

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
    role,
    matches: gamesPlayed,
    wins,
    winRate,
    heroPoolSize: heroesList.length || parseInt(row[41]) || 0,
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
    groupStage: { matches: gamesPlayed, wins, wr: winRate },
    progressiveRound: { matches: 0, wins: 0, wr: 0 },
    playoffs: { matches: 0, wins: 0, wr: 0 },
    attributes: {
      farm: Math.round(farmScore),
      damage: Math.round(damageAttr),
      survival: Math.round(survivalAttr),
      teamFight: Math.round(teamFightAttr),
      push: Math.round(pushScore),
      control: Math.round(controlAttr)
    },
    playstyleTag,
    scoutingScore,
    heroes: heroesList
  });
}

console.log('Successfully processed player counts:', parsedPlayers.length);
console.log('Sample player Rosa parsed:', parsedPlayers.find(p => p.name === 'Rosa'));
