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
const tGameTypeIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'game type');

const gameTypes = new Set();
teamRows.slice(1).forEach(row => {
  if (row[tGameTypeIdx]) gameTypes.add(row[tGameTypeIdx]);
});
console.log('Team Unique Game Types:', Array.from(gameTypes));

// Count per game type
const counts = {};
teamRows.slice(1).forEach(row => {
  const gt = row[tGameTypeIdx];
  if (gt) counts[gt] = (counts[gt] || 0) + 1;
});
console.log('Team Game Type Counts:', counts);
