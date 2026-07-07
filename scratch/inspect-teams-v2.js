const fs = require('fs');
const path = require('path');

const playerPath = 'C:\\Users\\wahid\\Downloads\\MPL TR PLAYER.csv';
const teamPath = 'C:\\Users\\wahid\\Downloads\\MPL TR TEAM.csv';

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

const playerRows = parseCSV(fs.readFileSync(playerPath, 'utf8'));
const teamRows = parseCSV(fs.readFileSync(teamPath, 'utf8'));

const playerHeaders = playerRows[0].map(h => h.trim());
const teamHeaders = teamRows[0].map(h => h.trim());

// Correct indices
const pTeamIdx = playerHeaders.findIndex(h => h.toLowerCase().replace(/^\uFEFF/, '').trim() === 'team');
const pEnemyIdx = playerHeaders.findIndex(h => h.toLowerCase().replace(/^\uFEFF/, '').trim() === 'enemy team');
const pStageIdx = playerHeaders.findIndex(h => h.toLowerCase().replace(/^\uFEFF/, '').trim() === 'stage');
const pBattleCodeIdx = playerHeaders.findIndex(h => h.toLowerCase().replace(/^\uFEFF/, '').trim() === 'battle code');

const tTeamIdx = teamHeaders.findIndex(h => h.toLowerCase().replace(/^\uFEFF/, '').trim() === 'team');
const tEnemyIdx = teamHeaders.findIndex(h => h.toLowerCase().replace(/^\uFEFF/, '').trim() === 'enemy team');
const tStageIdx = teamHeaders.findIndex(h => h.toLowerCase().replace(/^\uFEFF/, '').trim() === 'stage');
const tBattleCodeIdx = teamHeaders.findIndex(h => h.toLowerCase().replace(/^\uFEFF/, '').trim() === 'battle code');

console.log('Player Column Indices:');
console.log(`- Team: ${pTeamIdx}`);
console.log(`- Enemy Team: ${pEnemyIdx}`);
console.log(`- Stage: ${pStageIdx}`);
console.log(`- Battle Code: ${pBattleCodeIdx}`);

console.log('\nTeam Column Indices:');
console.log(`- Team: ${tTeamIdx}`);
console.log(`- Enemy Team: ${tEnemyIdx}`);
console.log(`- Stage: ${tStageIdx}`);
console.log(`- Battle Code: ${tBattleCodeIdx}`);

// Unique teams
const playerTeams = new Set();
const playerEnemyTeams = new Set();
playerRows.slice(1).forEach(row => {
  if (row[pTeamIdx]) playerTeams.add(row[pTeamIdx]);
  if (row[pEnemyIdx]) playerEnemyTeams.add(row[pEnemyIdx]);
});

const teamTeams = new Set();
const teamEnemyTeams = new Set();
teamRows.slice(1).forEach(row => {
  if (row[tTeamIdx]) teamTeams.add(row[tTeamIdx]);
  if (row[tEnemyIdx]) teamEnemyTeams.add(row[tEnemyIdx]);
});

console.log('\nPlayer unique Teams:', Array.from(playerTeams));
console.log('Player unique Enemy Teams:', Array.from(playerEnemyTeams));
console.log('\nTeam unique Teams:', Array.from(teamTeams));
console.log('Team unique Enemy Teams:', Array.from(teamEnemyTeams));

// Let's count occurrences per team
const playerTeamCounts = {};
playerRows.slice(1).forEach(row => {
  const team = row[pTeamIdx];
  if (team) playerTeamCounts[team] = (playerTeamCounts[team] || 0) + 1;
});
console.log('\nPlayer team row counts:', playerTeamCounts);

const teamTeamCounts = {};
teamRows.slice(1).forEach(row => {
  const team = row[tTeamIdx];
  if (team) teamTeamCounts[team] = (teamTeamCounts[team] || 0) + 1;
});
console.log('Team team row counts:', teamTeamCounts);

// Let's look for matches containing "test" or "ping" in the Stage column
console.log('\n--- SCANNING STAGES ---');
const playerStages = new Set();
playerRows.slice(1).forEach(row => {
  if (row[pStageIdx]) playerStages.add(row[pStageIdx]);
});
const teamStages = new Set();
teamRows.slice(1).forEach(row => {
  if (row[tStageIdx]) teamStages.add(row[tStageIdx]);
});
console.log('Player Stages:', Array.from(playerStages));
console.log('Team Stages:', Array.from(teamStages));

// Let's check which battle codes or stages are "Pingtest" or "Test"
console.log('\n--- SCANNING FOR TEST BATTLE CODES OR STAGES ---');
const playerTestRows = [];
playerRows.slice(1).forEach((row, idx) => {
  const isTest = row.some(cell => cell.toLowerCase().includes('ping') || cell.toLowerCase().includes('test'));
  if (isTest) {
    playerTestRows.push({ idx, stage: row[pStageIdx], battleCode: row[pBattleCodeIdx], team: row[pTeamIdx] });
  }
});
console.log(`Found ${playerTestRows.length} player rows with test/ping info. Sample:`, playerTestRows.slice(0, 10));

const teamTestRows = [];
teamRows.slice(1).forEach((row, idx) => {
  const isTest = row.some(cell => cell.toLowerCase().includes('ping') || cell.toLowerCase().includes('test'));
  if (isTest) {
    teamTestRows.push({ idx, stage: row[tStageIdx], battleCode: row[tBattleCodeIdx], team: row[tTeamIdx] });
  }
});
console.log(`Found ${teamTestRows.length} team rows with test/ping info. Sample:`, teamTestRows.slice(0, 10));
