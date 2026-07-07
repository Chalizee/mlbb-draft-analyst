// Quick test to simulate the browser-side parser execution
import fs from 'fs';

const playerSummaryCsv = fs.readFileSync('C:/Users/wahid/Downloads/mpl trkey player.csv', 'utf-8');
const teamSummaryCsv = fs.readFileSync('C:/Users/wahid/Downloads/MPL TR TEAM.csv', 'utf-8');
const teamRosterCsv = fs.readFileSync('C:/Users/wahid/Downloads/MPL TR PLAYER.csv', 'utf-8');

// Inline the parseCSV function (since it's a TS module)
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current); current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  });
}

const playerRows = parseCSV(playerSummaryCsv);
console.log('Player header:', playerRows[0].slice(0, 8));
console.log('isAggregatedTRFormat:', playerRows[0].some(c => c.toLowerCase().trim() === 'player no.'));
console.log('Data rows:', playerRows.length - 1);

// Check raw logs
const rawLogsRows = parseCSV(teamRosterCsv);
console.log('Raw logs rows:', rawLogsRows.length);
console.log('Raw logs header:', rawLogsRows[0].slice(0, 8));
console.log('hasRawLogs:', rawLogsRows[0].some(c => c.toLowerCase().trim() === 'battle code'));

// Build player heroes map
const rawHeaders = rawLogsRows[0].map(h => h.trim());
const rawPlayerIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'player');
const rawHeroIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'hero');
const rawResultIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'result');

console.log('rawPlayerIdx:', rawPlayerIdx, 'rawHeroIdx:', rawHeroIdx, 'rawResultIdx:', rawResultIdx);

const playerHeroesMap = new Map();
for (let i = 1; i < rawLogsRows.length; i++) {
  const row = rawLogsRows[i];
  if (!row[rawPlayerIdx] || !row[rawHeroIdx]) continue;
  const pn = row[rawPlayerIdx].trim();
  const hn = row[rawHeroIdx].trim();
  if (!playerHeroesMap.has(pn)) playerHeroesMap.set(pn, new Map());
  const heroMap = playerHeroesMap.get(pn);
  if (!heroMap.has(hn)) heroMap.set(hn, { games: 0, wins: 0 });
  const stats = heroMap.get(hn);
  stats.games++;
  const isWin = (v) => v && (v.trim().toUpperCase() === 'WIN' || v.trim() === '1' || v.trim().toUpperCase() === 'W');
  if (isWin(row[rawResultIdx])) stats.wins++;
}

console.log(`playerHeroesMap size: ${playerHeroesMap.size}`);
console.log('Sample keys:', [...playerHeroesMap.keys()].slice(0, 5));

// Now check the aggregated player parsing
const pHeaders = playerRows[0].map(h => h.trim());
const pNameIdx = pHeaders.findIndex(h => h.toLowerCase() === 'player');
const pPlayerNoIdx = pHeaders.findIndex(h => h.toLowerCase() === 'player no.');

console.log('pNameIdx:', pNameIdx, 'pPlayerNoIdx:', pPlayerNoIdx);

// Check a specific player
const sampleRow = playerRows[1];
const playerName = sampleRow[pNameIdx]?.trim();
console.log('Sample player:', playerName);
console.log('Has comfort heroes:', playerHeroesMap.has(playerName));
if (playerHeroesMap.has(playerName)) {
  console.log('Hero pool size:', playerHeroesMap.get(playerName).size);
  console.log('Heroes:', [...playerHeroesMap.get(playerName).keys()]);
}

// Check for any player NOT matched
let matchCount = 0;
let missCount = 0;
for (let i = 1; i < playerRows.length; i++) {
  const name = playerRows[i][pNameIdx]?.trim();
  if (!name) continue;
  if (playerHeroesMap.has(name)) {
    matchCount++;
  } else {
    missCount++;
    console.log('MISS:', name, '- Not found in raw logs');
  }
}
console.log(`Matched: ${matchCount}, Missed: ${missCount}`);
