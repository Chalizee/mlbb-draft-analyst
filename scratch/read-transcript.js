const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\wahid\\.gemini\\antigravity\\brain\\400430bb-53d8-4d59-8f32-a4cd8295bcd1\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logPath)) {
  console.log('Transcript log not found at:', logPath);
  process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n');
console.log(`Loaded ${lines.length} lines from transcript.`);

const keywords = ['ping', 'test', 'pingtest', 'ping-test'];
let count = 0;

lines.forEach((line, idx) => {
  if (!line.trim()) return;
  const lower = line.toLowerCase();
  const matched = keywords.some(k => lower.includes(k));
  if (matched) {
    count++;
    // Let's parse JSON to make it readable
    try {
      const obj = JSON.parse(line);
      console.log(`\n--- Line ${idx} (Type: ${obj.type}, Source: ${obj.source}) ---`);
      if (obj.content) {
        console.log('Content snippet:', obj.content.substring(0, 500));
      } else {
        console.log('JSON keys:', Object.keys(obj));
        if (obj.tool_calls) {
          console.log('Tool calls:', JSON.stringify(obj.tool_calls).substring(0, 500));
        }
      }
    } catch (e) {
      console.log(`\n--- Line ${idx} (Raw text containing keyword) ---`);
      console.log(line.substring(0, 500));
    }
  }
});

console.log(`\nTotal matched lines: ${count}`);
