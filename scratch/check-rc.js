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
const pDateIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'date');
const pResultIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'result');

const tTeamIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'team');
const tEnemyIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'enemy team');
const tBattleCodeIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'battle code');
const tDateIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'date');
const tResultIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'result');

console.log('--- PLAYER ROWS WITH RC OR RGE ---');
playerRows.slice(1).forEach((row, idx) => {
  if (row[pTeamIdx] === 'RC' || row[pEnemyIdx] === 'RC') {
    console.log(`P-Row ${idx}: Date=${row[pDateIdx]}, Team=${row[pTeamIdx]}, Enemy=${row[pEnemyIdx]}, BattleCode=${row[pBattleCodeIdx]}, Result=${row[pResultIdx]}`);
  }
});

console.log('\n--- TEAM ROWS WITH RC OR RGE ---');
teamRows.slice(1).forEach((row, idx) => {
  if (row[tTeamIdx] === 'RC' || row[tEnemyIdx] === 'RC') {
    console.log(`T-Row ${idx}: Date=${row[tDateIdx]}, Team=${row[tTeamIdx]}, Enemy=${row[tEnemyIdx]}, BattleCode=${row[tBattleCodeIdx]}, Result=${row[tResultIdx]}`);
  }
});
