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
const pDateIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'date');
const pBattleCodeIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'battle code');
const pTeamIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'team');
const pEnemyIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'enemy team');

const dateMap = {};
playerRows.slice(1).forEach(row => {
  const date = row[pDateIdx];
  const code = row[pBattleCodeIdx];
  const team = row[pTeamIdx];
  const enemy = row[pEnemyIdx];
  if (date) {
    const day = date.split(' ')[0];
    if (!dateMap[day]) {
      dateMap[day] = new Set();
    }
    dateMap[day].add(code);
  }
});

console.log('--- MATCH CODES PER DAY ---');
Object.entries(dateMap).sort().forEach(([day, codes]) => {
  console.log(`${day}: ${codes.size} games (${Array.from(codes).join(', ')})`);
});
