const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/csvParser.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- syncMDLDataToDB definition ---');
for (let i = 1360; i < Math.min(1485, lines.length); i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
