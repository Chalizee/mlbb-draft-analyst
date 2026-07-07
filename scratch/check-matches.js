const fs = require('fs');
const path = require('path');

// 1. Load CSV
const csvPath = 'C:\\Users\\wahid\\Downloads\\MPL TR PLAYER.csv';
if (!fs.existsSync(csvPath)) {
  console.error('CSV not found!');
  process.exit(1);
}
const csvContent = fs.readFileSync(csvPath, 'utf8');

// 2. Parse unique hero names from CSV
const lines = csvContent.split(/\r?\n/).slice(1);
const csvHeroNames = new Set();
for (const line of lines) {
  if (!line.trim()) continue;
  // Hero is at column 13 (0-indexed: index 13 is "Hero")
  // Let's parse columns carefully by handling quotes
  const cols = [];
  let inQuotes = false;
  let currentToken = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cols.push(currentToken.trim());
      currentToken = '';
    } else {
      currentToken += char;
    }
  }
  cols.push(currentToken.trim());
  const heroName = cols[13];
  if (heroName) {
    csvHeroNames.add(heroName.trim());
  }
}

console.log('Unique hero names in CSV:', Array.from(csvHeroNames));

// 3. Load HERO_DATA
const heroDataContent = fs.readFileSync('src/data/heroData.ts', 'utf8');
const match = heroDataContent.match(/export const HERO_DATA:.*=\s*\[([\s\S]+?)\];/);
if (!match) {
  console.error('Could not find HERO_DATA in heroData.ts!');
  process.exit(1);
}
const heroes = eval('[' + match[1] + ']');

// 4. Test matching
const cleanName = (name) => name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

const findHeroByName = (name) => {
  const cleaned = cleanName(name);
  if (!cleaned) return undefined;
  
  // Exact cleaned name match
  const matched = heroes.find(h => cleanName(h.name) === cleaned || cleanName(h.slug) === cleaned);
  if (matched) return matched;

  // Custom mapping rules
  if (cleaned === 'wuzetian' || cleaned === 'zetian') {
    return heroes.find(h => cleanName(h.slug) === 'wu-zetian');
  }
  if (cleaned === 'yisunshin') {
    return heroes.find(h => cleanName(h.slug) === 'yi-sun-shin');
  }
  if (cleaned === 'popolandkupa' || cleaned === 'popol') {
    return heroes.find(h => cleanName(h.slug) === 'popol-and-kupa');
  }
  
  // Substring match
  return heroes.find(h => cleanName(h.name).includes(cleaned) || cleaned.includes(cleanName(h.name)));
};

console.log('\n--- MATCHING RESULTS ---');
let matchesCount = 0;
let missedCount = 0;
for (const csvName of csvHeroNames) {
  const matched = findHeroByName(csvName);
  if (matched) {
    matchesCount++;
    console.log(`✅ [${csvName}] matches [${matched.name}] (imageUrl: ${matched.imageUrl})`);
  } else {
    missedCount++;
    console.log(`❌ [${csvName}] could not be matched!`);
  }
}

console.log(`\nSummary: ${matchesCount} matched, ${missedCount} missed.`);
