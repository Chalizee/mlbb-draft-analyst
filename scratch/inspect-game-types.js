const fs = require('fs');
const playerPath = 'C:\\Users\\wahid\\Downloads\\MPL TR PLAYER.csv';
const teamPath = 'C:\\Users\\wahid\\Downloads\\MPL TR TEAM.csv';

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
const teamRows = parseCSV(fs.readFileSync(teamPath, 'utf8'));

const playerHeaders = playerRows[0].map(h => h.trim());
const teamHeaders = teamRows[0].map(h => h.trim());

const pGameTypeIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'game type');
const tGameTypeIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'game type');

const playerGameTypes = new Set();
playerRows.slice(1).forEach(row => {
  if (row[pGameTypeIdx]) playerGameTypes.add(row[pGameTypeIdx]);
});

const teamGameTypes = new Set();
teamRows.slice(1).forEach(row => {
  if (row[tGameTypeIdx]) teamGameTypes.add(row[tGameTypeIdx]);
});

console.log('Player Game Types:', Array.from(playerGameTypes));
console.log('Team Game Types:', Array.from(teamGameTypes));

// Let's count rows per Game Type
const playerGameTypeCounts = {};
playerRows.slice(1).forEach(row => {
  const gt = row[pGameTypeIdx];
  if (gt) playerGameTypeCounts[gt] = (playerGameTypeCounts[gt] || 0) + 1;
});
console.log('\nPlayer Game Type Counts:', playerGameTypeCounts);

const teamGameTypeCounts = {};
teamRows.slice(1).forEach(row => {
  const gt = row[tGameTypeIdx];
  if (gt) teamGameTypeCounts[gt] = (teamGameTypeCounts[gt] || 0) + 1;
});
console.log('Team Game Type Counts:', teamGameTypeCounts);

// Let's inspect rows that have Game Type other than "Official" or similar
console.log('\n--- ROWS WITH NON-STANDARD GAME TYPE ---');
teamRows.slice(1).forEach((row, idx) => {
  if (row[tGameTypeIdx] !== 'Official' && row[tGameTypeIdx] !== 'Regular Season') {
    console.log(`T-Row ${idx}: GameType="${row[tGameTypeIdx]}", BattleCode="${row[2]}", Team="${row[7]}", Enemy="${row[9]}"`);
  }
});
