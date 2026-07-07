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
const tBattleCodeIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'battle code');

const playerGames = new Set();
playerRows.slice(1).forEach(row => {
  if (row[pBattleCodeIdx]) playerGames.add(row[pBattleCodeIdx]);
});

const teamGames = new Set();
teamRows.slice(1).forEach(row => {
  if (row[tBattleCodeIdx]) teamGames.add(row[tBattleCodeIdx]);
});

console.log('Player Unique Games:', playerGames.size);
console.log('Team Unique Games:', teamGames.size);

console.log('\n--- GAMES IN PLAYER.CSV BUT NOT IN TEAM.CSV ---');
playerGames.forEach(code => {
  if (!teamGames.has(code)) {
    console.log(`- ${code}`);
    // Print details of this game
    const pRows = playerRows.slice(1).filter(r => r[pBattleCodeIdx] === code);
    pRows.forEach(r => {
      const pName = r[playerHeaders.findIndex(h => h.toLowerCase().trim() === 'player')];
      const team = r[playerHeaders.findIndex(h => h.toLowerCase().trim() === 'team')];
      const date = r[playerHeaders.findIndex(h => h.toLowerCase().trim() === 'date')];
      const kills = r[playerHeaders.findIndex(h => h.toLowerCase().trim() === 'kills')];
      const deaths = r[playerHeaders.findIndex(h => h.toLowerCase().trim() === 'deaths')];
      const assists = r[playerHeaders.findIndex(h => h.toLowerCase().trim() === 'assists')];
      console.log(`  * ${pName} (${team}) at ${date}: ${kills}/${deaths}/${assists}`);
    });
  }
});

console.log('\n--- GAMES IN TEAM.CSV BUT NOT IN PLAYER.CSV ---');
teamGames.forEach(code => {
  if (!playerGames.has(code)) {
    console.log(`- ${code}`);
  }
});
