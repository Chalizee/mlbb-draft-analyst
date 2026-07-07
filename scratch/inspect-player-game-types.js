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
const pGameTypeIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'game type');

const gameTypes = new Set();
playerRows.slice(1).forEach(row => {
  if (row[pGameTypeIdx]) gameTypes.add(row[pGameTypeIdx]);
});
console.log('Player Unique Game Types:', Array.from(gameTypes));

// Count per game type
const counts = {};
playerRows.slice(1).forEach(row => {
  const gt = row[pGameTypeIdx];
  if (gt) counts[gt] = (counts[gt] || 0) + 1;
});
console.log('Player Game Type Counts:', counts);
