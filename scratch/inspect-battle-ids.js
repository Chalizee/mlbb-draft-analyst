const fs = require('fs');
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

const teamRows = parseCSV(fs.readFileSync(teamPath, 'utf8'));
const teamHeaders = teamRows[0].map(h => h.trim());
const tBattleIdIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'battle_id');

const battleIds = new Set();
teamRows.slice(1).forEach(row => {
  if (row[tBattleIdIdx]) battleIds.add(row[tBattleIdIdx]);
});

console.log('Unique Battle IDs:');
console.log(Array.from(battleIds));

// Find any battle id containing test or ping
console.log('\nScanning battle IDs for ping/test:');
battleIds.forEach(id => {
  if (id.toLowerCase().includes('ping') || id.toLowerCase().includes('test')) {
    console.log(`- Matched: "${id}"`);
  }
});
