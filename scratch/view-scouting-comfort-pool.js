const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/app/scouting/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- Searching for hero rendering in page.tsx ---');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('comfort') || line.toLowerCase().includes('pool') || line.toLowerCase().includes('selectedplayer.heroes')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
