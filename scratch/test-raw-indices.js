const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\wahid\\Downloads\\MPL TR PLAYER.csv';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');
const rawHeaders = lines[0].split(',').map(h => h.trim());

const cols = [
  'player',
  'hero',
  'result',
  'kills',
  'deaths',
  'assists',
  'gold per minute',
  'damage per minute',
  'damage taken per minute',
  'kill participation%'
];

console.log('--- Columns matching check ---');
cols.forEach(col => {
  const idx = rawHeaders.findIndex(h => h.toLowerCase() === col);
  console.log(`- "${col}" index: ${idx} (Matched Header: "${rawHeaders[idx]}")`);
});
