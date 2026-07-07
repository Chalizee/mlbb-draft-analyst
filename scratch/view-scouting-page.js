const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/app/scouting/page.tsx');
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- Searching for import in page.tsx ---');
lines.forEach((line, idx) => {
  if (line.includes('fetch') || line.includes('import') || line.includes('sync') || line.includes('syncMDLDataToDB')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
