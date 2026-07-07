const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/data/heroData.ts');
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const heroesToFind = ['kalea', 'lukas', 'marcel', 'obsidia', 'sora', 'suyou', 'zetian'];

heroesToFind.forEach(name => {
  console.log(`\n--- Searching for "${name}" ---`);
  let found = false;
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(`slug: '${name}'`) || line.toLowerCase().includes(`name: '${name}'`)) {
      found = true;
      // print surrounding 10 lines
      const start = Math.max(0, index - 3);
      const end = Math.min(lines.length - 1, index + 8);
      for (let i = start; i <= end; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
      }
    }
  });
  if (!found) {
    console.log(`Not found: ${name}`);
  }
});
