const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/csvParser.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- Roster Assignment ---');
lines.forEach((line, idx) => {
  if (line.includes('roster:')) {
    console.log(`${idx + 1}: ${line.trim()}`);
    // print next 10 lines
    for (let i = 1; i <= 10; i++) {
      console.log(`  ${idx + 1 + i}: ${lines[idx + i]}`);
    }
  }
});
