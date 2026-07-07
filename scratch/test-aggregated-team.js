const fs = require('fs');
const path = require('path');

// We will copy the parsed players array from our previous run or reuse the exact code to generate parsedPlayers
const playerSummaryCsvPath = 'C:\\Users\\wahid\\Downloads\\mpl trkey player.csv';
const rawLogsCsvPath = 'C:\\Users\\wahid\\Downloads\\MPL TR PLAYER.csv';

const playerSummaryCsv = fs.readFileSync(playerSummaryCsvPath, 'utf8');
const rawLogsCsv = fs.readFileSync(rawLogsCsvPath, 'utf8');

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

function getPlayerTeamDetails(playerName) {
  const cleanP = cleanName(playerName);
  for (const team of mplTurkeyRosters) {
    for (const p of team.players) {
      if (cleanName(p.name) === cleanP) {
        return { teamCode: team.teamCode, teamName: team.teamName, role: p.role };
      }
    }
  }
  return { teamCode: 'UNK', teamName: 'Unknown Team', role: 'Mid' };
}

function parsePercent(val) {
  if (!val) return 0;
  return parseFloat(val.replace('%', '')) || 0;
}

const playerRows = parseCSV(playerSummaryCsv);
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
  const gpm = parseInt(row[21]) || 0;
  const dpm = parseInt(row[26]) || 0;
  const dtpm = parseInt(row[34]) || 0;
  const avgDeaths = parseFloat(row[12]) || 0;
  const avgKills = parseFloat(row[9]) || 0;
  const avgAssists = parseFloat(row[15]) || 0;
  const avgGameMin = (parseFloat(row[51]) || 0) / 60;

  parsedPlayers.push({
    name: playerName,
    team: teamCode,
    role,
    matches: gamesPlayed,
    wins,
    winRate,
    gpm,
    dpm,
    dtpm,
    avgDeaths,
    avgKills,
    avgAssists,
    avgGameMin,
    attributes: {
      farm: 80,
      damage: 80,
      survival: 80,
      teamFight: 80,
      push: 80,
      control: 80
    },
    scoutingScore: 80
  });
}

// Group players by team code
const teamPlayersMap = new Map();
parsedPlayers.forEach(p => {
  if (!teamPlayersMap.has(p.team)) {
    teamPlayersMap.set(p.team, []);
  }
  teamPlayersMap.get(p.team).push(p);
});

const parsedTeams = [];
for (const [tCode, tPlayers] of teamPlayersMap.entries()) {
  const teamRoster = mplTurkeyRosters.find(r => r.teamCode === tCode);
  const teamName = teamRoster ? teamRoster.teamName : tCode;

  // Since players have common matches count, we can get matches and wins
  const matches = Math.max(...tPlayers.map(p => p.matches));
  const wins = Math.max(...tPlayers.map(p => p.wins));
  const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;

  const teamGpm = Math.round(tPlayers.reduce((sum, p) => sum + p.gpm, 0) / tPlayers.length);
  const teamDamage = Math.round(tPlayers.reduce((sum, p) => sum + p.dpm, 0) / tPlayers.length);
  const teamDamageTaken = Math.round(tPlayers.reduce((sum, p) => sum + p.dtpm, 0) / tPlayers.length);
  const avgGameMin = tPlayers.reduce((sum, p) => sum + p.avgGameMin, 0) / tPlayers.length;

  const teamKills = tPlayers.reduce((sum, p) => sum + (p.avgKills * p.matches), 0) / 5; // divide by 5 to get team totals
  const teamDeaths = tPlayers.reduce((sum, p) => sum + (p.avgDeaths * p.matches), 0) / 5;
  const teamAssists = tPlayers.reduce((sum, p) => sum + (p.avgAssists * p.matches), 0) / 5;

  const avgTowers = 5; // standard
  const avgTurtles = 2.1;
  const avgLords = 1.2;

  const scoutingScore = parseFloat((tPlayers.reduce((sum, p) => sum + p.scoutingScore, 0) / tPlayers.length).toFixed(1));

  // Compute team attributes
  const tempo = Math.round(tPlayers.reduce((sum, p) => sum + p.attributes.farm, 0) / tPlayers.length);
  const damage = Math.round(tPlayers.reduce((sum, p) => sum + p.attributes.damage, 0) / tPlayers.length);
  const durability = Math.round(tPlayers.reduce((sum, p) => sum + p.attributes.survival, 0) / tPlayers.length);
  const objective = Math.round((tempo + damage) / 2);
  const teamfight = Math.round(tPlayers.reduce((sum, p) => sum + p.attributes.teamFight, 0) / tPlayers.length);
  const control = Math.round(tPlayers.reduce((sum, p) => sum + p.attributes.control, 0) / tPlayers.length);

  parsedTeams.push({
    name: teamName,
    matches,
    wins,
    winRate,
    playersCount: tPlayers.length,
    distinctHeroes: tPlayers.reduce((sum, p) => sum + (p.heroPoolSize || 5), 0),
    teamGpm,
    teamDamage,
    teamDamageTaken,
    avgGameMin,
    avgTowers,
    avgTurtles,
    avgLords,
    avgTowers: 6.5,
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
    groupStage: { matches, wins, wr: winRate },
    progressiveRound: { matches: 0, wins: 0, wr: 0 },
    playoffs: { matches: 0, wins: 0, wr: 0 },
    attributes: {
      tempo,
      damage,
      durability,
      objective,
      teamfight,
      control
    },
    playstyleTag: winRate >= 70 ? 'Aggressive Giant' : winRate >= 50 ? 'Balanced Contender' : 'Underdog',
    scoutingScore,
    players: tPlayers.map(p => p.name)
  });
}

console.log('Successfully aggregated teams counts:', parsedTeams.length);
console.log('Sample team Aurora Gaming parsed:', parsedTeams.find(t => t.name.includes('Aurora')));
