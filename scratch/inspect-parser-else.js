const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/csvParser.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let start = -1;
lines.forEach((line, idx) => {
  if (line.includes('} else {') && idx > 500 && start === -1) {
    start = idx;
  }
});

console.log(`Starting print from line ${start + 1}`);
for (let i = start; i < Math.min(start + 150, lines.length); i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
