const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\wahid\\Downloads\\MPL TR PLAYER.csv';

if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- ORIGINAL MPL TR PLAYER.csv FIRST 5 LINES ---');
for (let i = 0; i < Math.min(5, lines.length); i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
