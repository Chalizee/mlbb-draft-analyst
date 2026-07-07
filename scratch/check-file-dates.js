const fs = require('fs');
const path = require('path');

const downloadsDir = 'C:\\Users\\wahid\\Downloads';
const files = ['MPL TR PLAYER.csv', 'MPL TR TEAM.csv', 'mpl trkey player.csv'];

files.forEach(f => {
  const p = path.join(downloadsDir, f);
  if (fs.existsSync(p)) {
    const stats = fs.statSync(p);
    console.log(`${f}:`);
    console.log(`- Size: ${(stats.size/1024).toFixed(1)} KB`);
    console.log(`- Modified: ${stats.mtime}`);
    console.log(`- Created: ${stats.birthtime}`);
  } else {
    console.log(`${f} not found.`);
  }
});
