const fs = require('fs');

const path = 'C:\\Users\\wahid\\.gemini\\antigravity\\scratch\\mlbb-draft-analyst\\src\\lib\\csvParser.ts';

if (!fs.existsSync(path)) {
  console.log('File not found:', path);
  process.exit(1);
}

const lines = fs.readFileSync(path, 'utf8').split('\n');

lines.forEach((line, idx) => {
  if (line.includes('INVALID_TEAMS') || line.includes('MIN_TEAM_MATCHES')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
