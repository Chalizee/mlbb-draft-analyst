const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\wahid\\Downloads\\mpl trkey player.csv';

if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- FIRST 5 LINES ---');
for (let i = 0; i < Math.min(5, lines.length); i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

// Parse headers
const headers = lines[0].split(',');
console.log('\nHeaders:', headers);

// Let's collect unique values for team and player
const teams = new Set();
const players = new Set();
const stages = new Set();
const matchIds = new Set();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const cols = line.split(',');
  if (cols.length < 5) continue;
  
  // Assuming pTeamIdx is around column index 4, let's print a sample row first
  if (i === 1) {
    console.log('\nSample Row 1:', cols);
  }
}
