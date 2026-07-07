const fs = require('fs');
const downloadsDir = 'C:\\Users\\wahid\\Downloads';

if (!fs.existsSync(downloadsDir)) {
  console.error('Downloads folder does not exist!');
  process.exit(1);
}

const files = fs.readdirSync(downloadsDir);
console.log('--- ALL PNG FILES IN DOWNLOADS ---');
files.forEach(f => {
  if (f.toLowerCase().endsWith('.png')) {
    const stats = fs.statSync(path = downloadsDir + '\\' + f);
    console.log(`- ${f} (${(stats.size/1024).toFixed(1)} KB)`);
  }
});
