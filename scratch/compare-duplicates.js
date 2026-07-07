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

const pairs = [
  { a: 'MTC20260510M1G1', b: 'MTC2026R1M10510', label: 'Match 1: PCF vs EF' },
  { a: 'MTC20260510M2G1', b: 'MTC2026R1M20510', label: 'Match 2: BJK vs FUT' },
  { a: 'MTC20260510M3G1', b: 'avrg1m1', label: 'Match 3: AUR vs RGE' },
  { a: 'MTC20260510M4G1R', b: 'BWVSMISAM2', label: 'Match 4: BW vs MISA' }
];

pairs.forEach(pair => {
  console.log(`\n========================================`);
  console.log(pair.label);
  console.log(`========================================`);
  
  [pair.a, pair.b].forEach(code => {
    const tRow = teamRows.slice(1).find(r => r[2] === code);
    const pRows = playerRows.slice(1).filter(r => r[pBattleCodeIdx] === code);
    
    console.log(`\nCode: ${code}`);
    if (tRow) {
      console.log(`- Date/Time: ${tRow[6]}`);
      console.log(`- Match Duration: ${tRow[43]}s (${(tRow[43]/60).toFixed(2)} min)`);
      console.log(`- Matchup: ${tRow[7]} vs ${tRow[9]}`);
    }
    
    let killsSum = 0, deathsSum = 0, assistsSum = 0;
    pRows.forEach(r => {
      killsSum += parseFloat(r[pKillsIdx]) || 0;
      deathsSum += parseFloat(r[pDeathsIdx]) || 0;
      assistsSum += parseFloat(r[pAssistsIdx]) || 0;
    });
    console.log(`- Player Row Count: ${pRows.length}`);
    console.log(`- Total Stats: Kills=${killsSum}, Deaths=${deathsSum}, Assists=${assistsSum}`);
    
    if (pRows.length > 0) {
      console.log('- Picks:');
      pRows.forEach(r => {
        const pName = r[playerHeaders.findIndex(h => h.toLowerCase().trim() === 'player')];
        const hero = r[playerHeaders.findIndex(h => h.toLowerCase().trim() === 'hero')];
        console.log(`  * ${pName} (${r[pTeamIdx]}): ${hero} (${r[pKillsIdx]}/${r[pDeathsIdx]}/${r[pAssistsIdx]})`);
      });
    }
  });
});
