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

const teamHeaders = teamRows[0].map(h => h.trim());
const tBattleCodeIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'battle code');
const tTimeIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'time/s');
const tDateIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'date');
const tTeamIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'team');
const tEnemyIdx = teamHeaders.findIndex(h => h.toLowerCase().trim() === 'enemy team');

console.log('--- INDIVIDUAL GAMES AND DURATIONS ---');
const uniqueGames = new Map();
teamRows.slice(1).forEach(row => {
  const code = row[tBattleCodeIdx];
  const duration = parseFloat(row[tTimeIdx]) || 0;
  const date = row[tDateIdx];
  const team = row[tTeamIdx];
  const enemy = row[tEnemyIdx];
  
  if (code) {
    if (!uniqueGames.has(code)) {
      uniqueGames.set(code, { duration, date, teams: [] });
    }
    uniqueGames.get(code).teams.push({ team, enemy });
  }
});

const sortedGames = Array.from(uniqueGames.entries()).sort((a, b) => a[1].duration - b[1].duration);

console.log('Top 15 Shortest Games (Potential Ping Tests):');
sortedGames.slice(0, 15).forEach(([code, data]) => {
  console.log(`- Code: ${code}, Date: ${data.date}, Duration: ${data.duration}s (${(data.duration/60).toFixed(2)} min), Teams: ${data.teams.map(t => `${t.team} vs ${t.enemy}`).join(', ')}`);
});

console.log('\nTop 5 Longest Games:');
sortedGames.slice(-5).reverse().forEach(([code, data]) => {
  console.log(`- Code: ${code}, Date: ${data.date}, Duration: ${data.duration}s (${(data.duration/60).toFixed(2)} min), Teams: ${data.teams.map(t => `${t.team} vs ${t.enemy}`).join(', ')}`);
});
