const fs = require('fs');
const filePath = 'C:\\Users\\wahid\\Downloads\\mpl trkey player.csv';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
console.log('Total rows:', lines.length);

const teams = new Set();
const players = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const cols = line.split(',');
  const player = cols[0];
  const gamesPlayed = cols[5];
  const wr = cols[7];
  players.push({ player, gamesPlayed, wr });
}

console.log('Total players:', players.length);
console.log('Players list (sample):');
console.log(players.slice(0, 15));
