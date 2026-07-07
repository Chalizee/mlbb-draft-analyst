const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
  const files = fs.readdirSync(dir);
  files.forEach(f => {
    const p = path.join(dir, f);
    const stats = fs.statSync(p);
    if (stats.isDirectory()) {
      searchDir(p, query);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.json')) {
      const content = fs.readFileSync(p, 'utf8');
      if (content.includes(query)) {
        console.log(`Found in: ${p}`);
      }
    }
  });
}

searchDir(path.join(__dirname, '../src'), 'mplTurkeyRosters');
