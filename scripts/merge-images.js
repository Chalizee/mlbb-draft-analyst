/* eslint-disable */
const fs = require('fs');
const path = require('path');

// Paths
const jsonPath = path.join('C:', 'Users', 'wahid', '.gemini', 'antigravity', 'brain', '400430bb-53d8-4d59-8f32-a4cd8295bcd1', '.system_generated', 'steps', '323', 'content.md');
const heroDataPath = path.join(__dirname, '..', 'src', 'data', 'heroData.ts');

function run() {
  console.log('Reading JSON from:', jsonPath);
  const mdContent = fs.readFileSync(jsonPath, 'utf8');
  
  // Find the JSON line (usually line 9, or starts with {"success":true)
  const lines = mdContent.split('\n');
  const jsonLine = lines.find(line => line.trim().startsWith('{"success":true'));
  
  if (!jsonLine) {
    console.error('Failed to locate JSON payload in Fandom Wiki scrape file.');
    process.exit(1);
  }
  
  const apiData = JSON.parse(jsonLine);
  const apiHeroes = apiData.data;
  console.log(`Successfully parsed ${apiHeroes.length} heroes from API data.`);

  // Create a map of normalized names to icon URLs
  const iconMap = {};
  apiHeroes.forEach(h => {
    // Normalize names (e.g. remove spaces, special chars, lower case)
    const norm = h.hero_name.toLowerCase().replace(/[^a-z0-9]/g, '');
    iconMap[norm] = h.icon;
  });

  console.log('Reading heroData.ts from:', heroDataPath);
  let heroDataContent = fs.readFileSync(heroDataPath, 'utf8');

  // We will parse the file using a regex to find each hero object in the HERO_DATA array.
  // Each object typically starts with a { and ends with }, and has name: 'HeroName'
  // Let's match the block. Since heroData.ts is structured, we can match:
  // name: '...',
  
  let matchCount = 0;
  let mismatchCount = 0;
  const mismatches = [];

  // Let's do a smart replacement.
  // We search for `name: '([^']+)'` and then find the enclosing block or just insert the imageUrl right after.
  // Let's find all occurrences of name: '...'
  const nameRegex = /name:\s*'([^']+)'/g;
  let match;
  const replacements = [];

  // To avoid indexing shifting issues during replacement, we can collect matches first
  // and perform replacements from back to front, or do string split/replace.
  // Let's do a clean replacement by splitting by lines or doing a precise replacement block by block.
  
  // Actually, we can use a stateful replacement loop.
  // We can search for the name, find the match in iconMap, and replace the name line with itself + the imageUrl line.
  // E.g., `name: 'Tigreal',` -> `name: 'Tigreal',\n    imageUrl: 'https://...',`
  
  const heroNames = [];
  while ((match = nameRegex.exec(heroDataContent)) !== null) {
    heroNames.push(match[1]);
  }

  console.log(`Found ${heroNames.length} hero entries in heroData.ts.`);

  heroNames.forEach(name => {
    const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    let url = iconMap[norm];

    // Manual overrides or fallback checks if normalization differs
    if (!url) {
      // Try fuzzy search or partial matching
      const keys = Object.keys(iconMap);
      const matchKey = keys.find(k => k.includes(norm) || norm.includes(k));
      if (matchKey) {
        url = iconMap[matchKey];
        console.log(`  Fuzzy matched: "${name}" -> "${matchKey}"`);
      }
    }

    if (url) {
      matchCount++;
      // We will perform a precise string replacement for this hero
      // We target the specific name line to insert imageUrl. E.g.:
      // name: 'Tigreal',
      // ->
      // name: 'Tigreal',
      //     imageUrl: 'https://...',
      
      const targetStr = `name: '${name}',`;
      const replacementStr = `name: '${name}',\n    imageUrl: '${url}',`;
      
      // Replace only the first occurrence that does not already have an imageUrl right after it
      // Actually, since all heroes are unique in heroData.ts, we can just replace standard.
      // But let's check if the replacement is already done to be safe.
      if (!heroDataContent.includes(`imageUrl: '${url}'`)) {
        heroDataContent = heroDataContent.replace(targetStr, replacementStr);
      }
    } else {
      mismatchCount++;
      mismatches.push(name);
    }
  });

  console.log(`\nMerge Summary:`);
  console.log(`- Successfully matched & updated: ${matchCount} heroes`);
  console.log(`- Failed to match: ${mismatchCount} heroes`);
  if (mismatches.length > 0) {
    console.log(`- Mismatched heroes:`, mismatches);
  }

  fs.writeFileSync(heroDataPath, heroDataContent, 'utf8');
  console.log('\nSuccessfully saved updated heroData.ts!');
}

run();
