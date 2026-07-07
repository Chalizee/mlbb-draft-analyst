const fs = require('fs');
const path = 'C:\\Users\\wahid\\.gemini\\antigravity\\brain\\400430bb-53d8-4d59-8f32-a4cd8295bcd1\\.system_generated\\steps\\1572\\content.md';

if (!fs.existsSync(path)) {
  console.log('File not found!');
  process.exit(1);
}

const content = fs.readFileSync(path, 'utf8').toLowerCase();

const keywords = ['ping', 'test', 'scrim', 'mismatch', 'invalid', 'dummy'];
keywords.forEach(kw => {
  const count = (content.match(new RegExp(kw, 'g')) || []).length;
  console.log(`Keyword "${kw}" occurs ${count} times.`);
});
