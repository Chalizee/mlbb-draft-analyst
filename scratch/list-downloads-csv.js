const fs = require('fs');
const path = require('path');

const downloadsDir = 'C:\\Users\\wahid\\Downloads';

if (!fs.existsSync(downloadsDir)) {
  console.error('Downloads folder does not exist!');
  process.exit(1);
}

const files = fs.readdirSync(downloadsDir);
console.log('--- ALL FILES IN DOWNLOADS ---');
files.forEach(f => {
  if (f.toLowerCase().includes('mpl') || f.toLowerCase().endsWith('.csv')) {
    const stats = fs.statSync(path.join(downloadsDir, f));
    console.log(`- ${f} (${(stats.size/1024).toFixed(1)} KB)`);
  }
});
