const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/csvParser.ts');
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- Functions in csvParser.ts ---');
lines.forEach((line, idx) => {
  if (line.includes('export function') || line.includes('export async function')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
