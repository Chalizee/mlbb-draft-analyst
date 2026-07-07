const fs = require('fs');
const path = require('path');

const playerPath = 'C:\\Users\\wahid\\Downloads\\MPL TR PLAYER.csv';
const teamPath = 'C:\\Users\\wahid\\Downloads\\MPL TR TEAM.csv';

if (!fs.existsSync(playerPath) || !fs.existsSync(teamPath)) {
  console.error('CSV files not found in Downloads!');
  process.exit(1);
}

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

console.log('Player Rows Header:', playerRows[0]);
console.log('Team Rows Header:', teamRows[0]);

// Find unique team names and match occurrences
const playerTeams = new Set();
const teamTeams = new Set();

playerRows.slice(1).forEach(row => {
  if (row[3]) playerTeams.add(row[3]); // Column 3 in player is Team
});

teamRows.slice(1).forEach(row => {
  if (row[2]) teamTeams.add(row[2]); // Column 2 in team is Team
});

console.log('Player Teams:', Array.from(playerTeams));
console.log('Team Teams:', Array.from(teamTeams));

// Let's search for "ping" or "test" in any column of playerRows
console.log('\n--- SEARCHING FOR PING/TEST IN PLAYER ROWS ---');
playerRows.forEach((row, idx) => {
  row.forEach((cell, cellIdx) => {
    if (cell.toLowerCase().includes('ping') || cell.toLowerCase().includes('test')) {
      console.log(`Row ${idx}, Cell ${cellIdx} (${playerRows[0][cellIdx]}): "${cell}"`);
    }
  });
});

console.log('\n--- SEARCHING FOR PING/TEST IN TEAM ROWS ---');
teamRows.forEach((row, idx) => {
  row.forEach((cell, cellIdx) => {
    if (cell.toLowerCase().includes('ping') || cell.toLowerCase().includes('test')) {
      console.log(`Row ${idx}, Cell ${cellIdx} (${teamRows[0][cellIdx]}): "${cell}"`);
    }
  });
});

// Let's look at the team names: AUR, EF, FUT, BW, BJK, RGE, RC, PCF, MISA
// Let's count games per team to see which ones are extremely small (might be test games)
const teamGameCounts = {};
teamRows.slice(1).forEach(row => {
  const team = row[2];
  if (team) {
    teamGameCounts[team] = (teamGameCounts[team] || 0) + 1;
  }
});
console.log('\nTeam game counts (rows in TEAM.csv):', teamGameCounts);

const playerGameCounts = {};
playerRows.slice(1).forEach(row => {
  const team = row[3];
  if (team) {
    playerGameCounts[team] = (playerGameCounts[team] || 0) + 1;
  }
});
console.log('Player game counts (rows in PLAYER.csv):', playerGameCounts);
