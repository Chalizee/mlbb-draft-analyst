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
const pTeamIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'team');
const pPlayerIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'player');
const pBattleCodeIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'battle code');

console.log('--- PLAYERS IN RC TEAM IN PLAYER.CSV ---');
playerRows.slice(1).forEach((row, idx) => {
  if (row[pTeamIdx] === 'RC') {
    console.log(`Row ${idx}: Player="${row[pPlayerIdx]}", BattleCode="${row[pBattleCodeIdx]}"`);
  }
});
