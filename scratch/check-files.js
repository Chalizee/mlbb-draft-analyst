const fs = require('fs');
const downloadsDir = 'C:\\Users\\wahid\\Downloads';

if (!fs.existsSync(downloadsDir)) {
  console.error('Downloads directory does not exist!');
  process.exit(1);
}

const files = fs.readdirSync(downloadsDir);
console.log('--- ALL FILES IN DOWNLOADS CONTAINING MPL ---');
files.forEach(f => {
  if (f.toLowerCase().includes('mpl')) {
    console.log(`- ${f}`);
  }
});
