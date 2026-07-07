const fs = require('fs');
const path = require('path');

const downloadsDir = 'C:\\Users\\wahid\\Downloads';
const targetDir = 'C:\\Users\\wahid\\.gemini\\antigravity\\scratch\\mlbb-draft-analyst\\public\\images\\heroes';

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log('Created target directory:', targetDir);
}

const heroesToCopy = [
  'kalea.png',
  'lukas.png',
  'marcel.png',
  'obsidia.png',
  'sora.png',
  'suyou.png',
  'zetian.png'
];

let copyCount = 0;
heroesToCopy.forEach(fileName => {
  const sourcePath = path.join(downloadsDir, fileName);
  const destPath = path.join(targetDir, fileName);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied: ${fileName} -> ${destPath}`);
    copyCount++;
  } else {
    console.warn(`Source file not found: ${sourcePath}`);
  }
});

console.log(`\nSuccessfully copied ${copyCount} out of ${heroesToCopy.length} hero images!`);
