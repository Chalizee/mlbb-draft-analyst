const fs = require('fs');

const path = 'C:\\Users\\wahid\\.gemini\\antigravity\\brain\\400430bb-53d8-4d59-8f32-a4cd8295bcd1\\.system_generated\\steps\\1243\\content.md';
if (!fs.existsSync(path)) {
  console.log('Fandom markdown file not found!');
  process.exit(1);
}

const content = fs.readFileSync(path, 'utf8');

// Search for any img tags with Chang'e or Hero611
const regexes = [
  /alt="Chang'e"[^>]+src="([^"]+)"/i,
  /alt="Chang'e"[^>]+data-src="([^"]+)"/i,
  /data-image-name="Hero611-icon.png"[^>]+data-src="([^"]+)"/i,
  /data-image-name="Hero611-icon.png"[^>]+src="([^"]+)"/i,
  /Hero611-icon\.png/i
];

for (const r of regexes) {
  const match = content.match(r);
  if (match) {
    console.log(`Matched regex: ${r}`);
    console.log('Match details:', match[0].substring(0, 300));
    if (match[1]) {
      console.log('Extracted URL:', match[1]);
    }
  }
}

// Let's also do a search for Hero611-icon in the entire text and print surrounding context
const idx = content.indexOf('Hero611-icon');
if (idx !== -1) {
  console.log('\nFound Hero611-icon at index:', idx);
  console.log('Surrounding content:', content.substring(idx - 150, idx + 350));
} else {
  console.log('\nCould not find "Hero611-icon" in file!');
}
