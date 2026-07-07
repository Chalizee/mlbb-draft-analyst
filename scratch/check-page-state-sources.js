const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/app/scouting/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- Searching for db.players or db.opponents in page.tsx ---');
lines.forEach((line, idx) => {
  if (line.includes('db.players') || line.includes('db.opponents') || line.includes('db.playerHeroStats')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
