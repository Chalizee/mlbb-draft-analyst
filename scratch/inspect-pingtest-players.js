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
const pPlayerIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'player');
const pTeamIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'team');
const pBattleCodeIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'battle code');

const uniquePlayers = new Set();
playerRows.slice(1).forEach(row => {
  if (row[pPlayerIdx]) uniquePlayers.add(row[pPlayerIdx]);
});

console.log('--- ALL UNIQUE PLAYERS ---');
console.log(Array.from(uniquePlayers).sort());

// Search for test or ping in players
console.log('\nScanning players for test/ping:');
uniquePlayers.forEach(p => {
  if (p.toLowerCase().includes('test') || p.toLowerCase().includes('ping')) {
    console.log(`- Matched: "${p}"`);
  }
});
