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

const pTeamIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'team');
const pEnemyIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'enemy team');
const pBattleCodeIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'battle code');
const pStageIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'stage');

console.log('--- PLAYER MATCH MTC20260411M3 GAMES ---');
playerRows.slice(1).forEach((row, idx) => {
  const code = row[pBattleCodeIdx];
  if (code && code.startsWith('MTC20260411M3')) {
    console.log(`P-Row ${idx}: Code=${code}, Team=${row[pTeamIdx]}, Enemy=${row[pEnemyIdx]}, Stage=${row[pStageIdx]}`);
  }
});

console.log('\n--- TEAM MATCH MTC20260411M3 GAMES ---');
teamRows.slice(1).forEach((row, idx) => {
  const code = row[2];
  if (code && code.startsWith('MTC20260411M3')) {
    console.log(`T-Row ${idx}: Code=${code}, Team=${row[7]}, Enemy=${row[9]}, Stage=${row[5]}`);
  }
});
