const fs = require('fs');
const path = require('path');

const downloadsDir = 'C:\\Users\\wahid\\Downloads';
const playerFile = path.join(downloadsDir, 'mpl trkey player.csv');
const originalRawPath = path.join(downloadsDir, 'MPL TR PLAYER.csv');

const playerSummaryCsv = fs.readFileSync(playerFile, 'utf-8');
const teamRosterCsv = fs.readFileSync(originalRawPath, 'utf-8');

function cleanName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCSV(text) {
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
}

const playerRows = parseCSV(playerSummaryCsv);
const rawLogsRows = parseCSV(teamRosterCsv);

const playerHeroesMap = new Map();
const rawHeaders = rawLogsRows[0].map(h => h.trim());
const rawPlayerIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'player');
const rawHeroIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'hero');

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
  playerHeroesMap.get(key).set(hero, true);
}

const pHeaders = playerRows[0].map(h => h.trim());
const pDataRows = playerRows.slice(1);
const pPlayerCol = pHeaders.findIndex(h => h.toLowerCase().replace(/^\uFEFF/, '').trim() === 'player');

console.log('--- Matching Playoff Names to Raw Map ---');
pDataRows.forEach(row => {
  const name = row[pPlayerCol]?.trim();
  if (!name) return;
  const key = cleanName(name);
  const matched = playerHeroesMap.has(key);
  console.log(`Aggregated: "${name}" -> Cleaned: "${key}" -> Matched? ${matched}`);
});
