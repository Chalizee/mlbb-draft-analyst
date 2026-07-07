const fs = require('fs');
const path = require('path');
const { processMDLScoutingCSVs } = require('./src/lib/csvParser');

const downloadsDir = 'C:\\Users\\wahid\\Downloads';
const playerFile = path.join(downloadsDir, 'mpl trkey player.csv');
const teamSummaryFile = path.join(downloadsDir, 'MPL TR TEAM.csv');
const originalRawPath = path.join(downloadsDir, 'MPL TR PLAYER.csv');

if (!fs.existsSync(playerFile) || !fs.existsSync(teamSummaryFile) || !fs.existsSync(originalRawPath)) {
  console.error('Missing CSV files in Downloads');
  process.exit(1);
}

const playerSummaryCsv = fs.readFileSync(playerFile, 'utf-8');
const teamSummaryCsv = fs.readFileSync(teamSummaryFile, 'utf-8');
const teamRosterCsv = fs.readFileSync(originalRawPath, 'utf-8');

console.log('Running processMDLScoutingCSVs simulation...');
const data = processMDLScoutingCSVs(
  playerSummaryCsv,
  teamSummaryCsv,
  teamRosterCsv,
  '',
  [] // mock heroes DB
);

console.log('Parsed players count:', data.players.length);
const rosa = data.players.find(p => p.name === 'Rosa');
if (rosa) {
  console.log('Rosa comfort heroes count:', rosa.heroes.length);
  console.log('Rosa comfort heroes sample:', rosa.heroes.slice(0, 3));
} else {
  console.log('Rosa not found');
}

const tienzy = data.players.find(p => p.name === 'Tienzy');
if (tienzy) {
  console.log('Tienzy comfort heroes count:', tienzy.heroes.length);
}
