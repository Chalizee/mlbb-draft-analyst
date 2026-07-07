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
const pTournamentIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'tournament');
const pStageIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'stage');
const pBattleCodeIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'battle code');
const pDateIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'date');
const pTeamIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'team');
const pEnemyIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'enemy team');

const tournaments = new Set();
playerRows.slice(1).forEach(row => {
  if (row[pTournamentIdx]) tournaments.add(row[pTournamentIdx]);
});
console.log('Unique Tournaments:', Array.from(tournaments));

// Count rows per Tournament
const tournamentCounts = {};
playerRows.slice(1).forEach(row => {
  const t = row[pTournamentIdx];
  if (t) tournamentCounts[t] = (tournamentCounts[t] || 0) + 1;
});
console.log('Tournament Counts:', tournamentCounts);

// Let's print unique Stage values and their counts
const stages = {};
playerRows.slice(1).forEach(row => {
  const s = row[pStageIdx];
  if (s) stages[s] = (stages[s] || 0) + 1;
});
console.log('Stage Counts:', stages);

// Let's check for any battle codes containing non-standard suffixes or codes
console.log('\nAll unique battle codes:');
const bCodes = new Set();
playerRows.slice(1).forEach(row => {
  if (row[pBattleCodeIdx]) bCodes.add(row[pBattleCodeIdx]);
});
console.log(Array.from(bCodes));
