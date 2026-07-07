const fs = require('fs');
const playerPath = 'C:\\Users\\wahid\\Downloads\\MPL TR PLAYER.csv';

const parseCSV = (text) => {
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
};

const playerRows = parseCSV(fs.readFileSync(playerPath, 'utf8'));
const playerHeaders = playerRows[0].map(h => h.trim());
const pBattleCodeIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'battle code');
const pPlayerIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'player');
const pTeamIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'team');

const gamePlayerCounts = {};
playerRows.slice(1).forEach(row => {
  const code = row[pBattleCodeIdx];
  const pName = row[pPlayerIdx];
  const team = row[pTeamIdx];
  if (code) {
    if (!gamePlayerCounts[code]) {
      gamePlayerCounts[code] = { players: new Set(), teams: new Set(), rows: 0 };
    }
    gamePlayerCounts[code].players.add(pName);
    gamePlayerCounts[code].teams.add(team);
    gamePlayerCounts[code].rows++;
  }
});

console.log('--- BATTLE CODE ROW COUNTS AND PLAYER COUNTS ---');
Object.entries(gamePlayerCounts).forEach(([code, data]) => {
  if (data.rows !== 10 || data.players.size !== 10 || data.teams.size !== 2) {
    console.log(`Abnormal Game: Code=${code}, Rows=${data.rows}, UniquePlayers=${data.players.size}, UniqueTeams=${data.teams.size} (${Array.from(data.teams).join(', ')})`);
  }
});
