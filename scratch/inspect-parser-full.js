const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/csvParser.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let blockStart = -1;
let blockEnd = -1;
lines.forEach((line, idx) => {
  if (line.includes('if (isRawLogFormat) {')) {
    blockStart = idx;
  }
  if (line.includes('// Default parser for standard summary/aggregation sheets') || line.includes('} else {') && idx > 1000) {
    blockEnd = idx;
  }
});

console.log(`blockStart = ${blockStart + 1}`);

// Let's search for the matching closing brace of `if (isRawLogFormat) {`
let openBraces = 0;
let closedBraces = 0;
let elseIdx = -1;
for (let i = blockStart; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') openBraces++;
    if (line[j] === '}') {
      closedBraces++;
      if (openBraces === closedBraces) {
        // found matching brace! Is there an else on this line or next?
        elseIdx = i;
        break;
      }
    }
  }
  if (elseIdx !== -1) break;
}

console.log(`isRawLogFormat block closes at line ${elseIdx + 1}`);

// print lines around there
for (let i = Math.max(0, elseIdx - 10); i < Math.min(elseIdx + 60, lines.length); i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
