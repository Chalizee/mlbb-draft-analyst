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

const pBattleCodeIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'battle code');
const pDateIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'date');
const pTeamIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'team');
const pEnemyIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'enemy team');
const pKillsIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'kills');
const pDeathsIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'deaths');
const pAssistsIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'assists');
const pTimeIdx = playerHeaders.findIndex(h => h.toLowerCase().trim() === 'time/s');

const weirdCodes = ['pvmg1m1r', 'BWVSMISAM2', 'BJKVSPCFM1', 'MISAVSEF', 'evrm1', 'evrm2', 'avrg1m1'];

console.log('--- DETAILS OF WEIRD BATTLE CODES ---');
weirdCodes.forEach(code => {
  console.log(`\n=== Code: ${code} ===`);
  const tRow = teamRows.slice(1).find(r => r[2] === code);
  if (tRow) {
    console.log(`Team Row: Date=${tRow[6]}, Team=${tRow[7]}, Enemy=${tRow[9]}, Side=${tRow[12]}, Result=${tRow[13]}, Time=${tRow[43]}s`);
  }
  
  const pRows = playerRows.slice(1).filter(r => r[pBattleCodeIdx] === code);
  console.log(`Player Rows: ${pRows.length}`);
  let killsSum = 0, deathsSum = 0, assistsSum = 0;
  pRows.forEach(r => {
    killsSum += parseFloat(r[pKillsIdx]) || 0;
    deathsSum += parseFloat(r[pDeathsIdx]) || 0;
    assistsSum += parseFloat(r[pAssistsIdx]) || 0;
  });
  console.log(`Totals: Kills=${killsSum}, Deaths=${deathsSum}, Assists=${assistsSum}`);
  if (pRows.length > 0) {
    console.log('Sample Players:');
    pRows.slice(0, 2).forEach(r => {
      const pName = r[playerHeaders.findIndex(h => h.toLowerCase().trim() === 'player')];
      console.log(`- ${pName} (${r[pTeamIdx]}): ${r[pKillsIdx]}/${r[pDeathsIdx]}/${r[pAssistsIdx]}`);
    });
  }
});
