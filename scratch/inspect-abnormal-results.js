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
const tResultIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'result');
const tBattleCodeIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'battle code');
const tTeamIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'team');
const tEnemyIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'enemy team');
const tDateIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'date');

console.log('--- SCANNING RESULTS FOR "?" OR ABNORMAL VALUES ---');
const abnormalResults = [];
teamRows.slice(1).forEach((row, idx) => {
  const res = row[tResultIdx];
  if (res === '?' || res === 'Result' || !['win', 'lose', 'victory', 'defeat', 'win-scrim', '胜', '负', '1', '2'].includes(res.toLowerCase().trim())) {
    abnormalResults.push({ idx, code: row[tBattleCodeIdx], team: row[tTeamIdx], enemy: row[tEnemyIdx], date: row[tDateIdx], result: res });
  }
});

console.log(`Found ${abnormalResults.length} rows with abnormal results:`);
abnormalResults.forEach(r => {
  console.log(`- Row ${r.idx}: Code=${r.code}, Date=${r.date}, Team=${r.team} vs ${r.enemy}, Result="${r.result}"`);
});
