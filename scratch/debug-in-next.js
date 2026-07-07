const fs = require('fs');
const path = require('path');

// Read files
const downloadsDir = 'C:\\Users\\wahid\\Downloads';
const playerFile = path.join(downloadsDir, 'mpl trkey player.csv');
const teamSummaryFile = path.join(downloadsDir, 'MPL TR TEAM.csv');
const originalRawPath = path.join(downloadsDir, 'MPL TR PLAYER.csv');

const playerSummaryCsv = fs.readFileSync(playerFile, 'utf-8');
const teamSummaryCsv = fs.readFileSync(teamSummaryFile, 'utf-8');
const teamRosterCsv = fs.readFileSync(originalRawPath, 'utf-8');

// Load parsed module from build
const csvParserPath = path.join(__dirname, '../src/lib/csvParser.ts');
const csvParserContent = fs.readFileSync(csvParserPath, 'utf-8');

// Let's run a sandboxed eval of the parsing logic directly
// We will extract processMDLScoutingCSVs and run it with the actual file values!
const parseCSV = (text) => {
  const result = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let inQuotes = false;
    let currentToken = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentToken.trim());
        currentToken = '';
      } else {
        currentToken += char;
      }
    }
    row.push(currentToken.trim());
    result.push(row);
  }
  return result;
};

const cleanName = (name) => {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const playerRows = parseCSV(playerSummaryCsv);
const isAggregatedTRFormat = playerRows[0] && playerRows[0].some(cell => cell.toLowerCase().trim() === 'player no.');

console.log('isAggregatedTRFormat:', isAggregatedTRFormat);

const rawLogsRows = teamRosterCsv ? parseCSV(teamRosterCsv) : [];
const hasRawLogs = rawLogsRows[0] && rawLogsRows[0].some(cell => cell.toLowerCase().trim() === 'battle code');
console.log('hasRawLogs:', hasRawLogs);

// Let's check playerHeroesMap
const playerHeroesMap = new Map();
const rawHeaders = rawLogsRows[0].map(h => h.trim());
const rawPlayerIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'player');
const rawHeroIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'hero');

console.log('rawPlayerIdx:', rawPlayerIdx, 'rawHeroIdx:', rawHeroIdx);

for (let i = 1; i < rawLogsRows.length; i++) {
  const row = rawLogsRows[i];
  if (row.length < Math.max(rawPlayerIdx, rawHeroIdx)) continue;
  const player = row[rawPlayerIdx]?.trim();
  const hero = row[rawHeroIdx]?.trim();
  if (!player || !hero) continue;

  const key = cleanName(player);
  if (!playerHeroesMap.has(key)) {
    playerHeroesMap.set(key, new Map());
  }
  const heroMap = playerHeroesMap.get(key);
  if (!heroMap.has(hero)) {
    heroMap.set(hero, { matches: 0 });
  }
  const stats = heroMap.get(hero);
  stats.matches++;
}

console.log('playerHeroesMap size:', playerHeroesMap.size);

// Print a few player keys
const keys = Array.from(playerHeroesMap.keys());
console.log('Player keys in map:', keys.slice(0, 10));

const pHeaders = playerRows[0].map(h => h.trim());
const pDataRows = playerRows.slice(1);
const pPlayerCol = pHeaders.findIndex(h => h.toLowerCase().replace(/^\uFEFF/, '').trim() === 'player');
console.log('pPlayerCol:', pPlayerCol);

const samplePlayerName = pDataRows[0][pPlayerCol];
console.log('Sample player name in aggregated:', samplePlayerName, 'cleanName:', cleanName(samplePlayerName));
console.log('Is sample player in map?', playerHeroesMap.has(cleanName(samplePlayerName)));
