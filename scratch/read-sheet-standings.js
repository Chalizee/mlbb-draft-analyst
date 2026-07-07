const fs = require('fs');
const path = 'C:\\Users\\wahid\\.gemini\\antigravity\\brain\\400430bb-53d8-4d59-8f32-a4cd8295bcd1\\.system_generated\\steps\\1572\\content.md';

if (!fs.existsSync(path)) {
  console.log('File not found!');
  process.exit(1);
}

const content = fs.readFileSync(path, 'utf8');

// Let's print any text lines in content that contain any of the Turkish team abbreviations
const teams = ['AUR', 'EF', 'FUT', 'BW', 'BJK', 'RGE', 'PCF', 'MISA', 'RC'];
const lines = content.split('\n');

console.log('--- SCANNING FETCHED HTML FOR STANDINGS AND TEAMS ---');
lines.forEach((line, idx) => {
  const hasTeam = teams.some(t => line.includes(t));
  if (hasTeam && line.length < 500 && !line.includes('<script') && !line.includes('<style')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
