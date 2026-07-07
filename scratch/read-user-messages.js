const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\wahid\\.gemini\\antigravity\\brain\\400430bb-53d8-4d59-8f32-a4cd8295bcd1\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logPath)) {
  console.log('Transcript log not found at:', logPath);
  process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n');
console.log(`Loaded ${lines.length} lines from transcript.`);

lines.forEach((line, idx) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    if (obj.source === 'USER_EXPLICIT' || obj.type === 'USER_INPUT') {
      console.log(`\n--- Line ${idx} (User Message) ---`);
      console.log('Content:', obj.content);
    }
  } catch (e) {
    // ignore
  }
});
