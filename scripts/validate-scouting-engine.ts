import { readFile } from 'node:fs/promises';
import {
  analyzeScoutingCSVs,
  canonicalizeHeroName,
  normalizeSourceSide,
  overridePlayerRole,
  parseOrderedHeroList,
} from '../src/lib/scoutingEngine';

async function main() {
  const [playerPath, teamPath] = process.argv.slice(2);

  if (!playerPath || !teamPath) {
    throw new Error('Usage: validate-scouting-engine <player.csv> <team.csv>');
  }

  const [playerCsv, teamCsv] = await Promise.all([
    readFile(playerPath, 'utf8'),
    readFile(teamPath, 'utf8'),
  ]);

  const report = analyzeScoutingCSVs(playerCsv, teamCsv);
  const roleCounts = Object.fromEntries(
    ['EXP', 'JUNGLE', 'MID', 'GOLD', 'ROAM'].map((role) => [
      role,
      report.players.filter((player) => player.role === role).length,
    ]),
  );

  if (report.meta.matches === 0 || report.players.length === 0 || report.teams.length === 0) {
    throw new Error('The scouting engine returned an empty report.');
  }

  if (report.players.some((player) => player.impactScore < 0 || player.impactScore > 100)) {
    throw new Error('Impact score escaped the expected 0–100 range.');
  }

  if (Object.values(roleCounts).some((count) => count === 0)) {
    throw new Error('At least one competitive role was not assigned.');
  }

  if (
    normalizeSourceSide('1') !== 'BLUE' ||
    normalizeSourceSide('2') !== 'RED'
  ) {
    throw new Error('Numeric side mapping no longer follows 1=Blue and 2=Red.');
  }

  const orderedDraft = parseOrderedHeroList(
    'Hilda,Irithel,Suyou,Cyclops,Benedetta',
  );
  if (
    orderedDraft.join('|') !==
    'Hilda|Irithel|Suyou|Cyclops|Benedetta'
  ) {
    throw new Error('Left-to-right pick/ban order was not preserved.');
  }

  const zetianAliases = [
    'Wu/Zetian',
    'Wu Zetian',
    'WU_ZETIAN',
    'Zetian',
  ].map(canonicalizeHeroName);
  if (
    new Set(zetianAliases).size !== 1 ||
    zetianAliases[0] !== 'Zetian'
  ) {
    throw new Error('Wu Zetian aliases no longer merge into canonical Zetian.');
  }

  if (canonicalizeHeroName('Phylax') !== 'Edith') {
    throw new Error('Legacy Phylax name no longer merges into canonical Edith.');
  }

  const aliasedDraft = parseOrderedHeroList(
    'Wu/Zetian,Zetian,Hilda',
  );
  if (aliasedDraft.join('|') !== 'Zetian|Zetian|Hilda') {
    throw new Error('Team draft aliases were not canonicalized in source order.');
  }

  const unmergedZetian = report.players.some((player) =>
    player.heroes.some((hero) => /wu[^a-z0-9]*zetian/i.test(hero.name)),
  );
  if (unmergedZetian) {
    throw new Error('A player profile still exposes Wu Zetian as a separate hero.');
  }

  const teamHeroNames = report.teams.flatMap((team) => [
    ...team.topPicks,
    ...team.topBans,
    ...team.firstPhasePicks,
    ...team.firstPhaseBans,
  ]);
  const unmergedTeamZetian =
    teamHeroNames.some((hero) => /wu[^a-z0-9]*zetian/i.test(hero.name)) ||
    report.contestedHeroes.some((hero) =>
      /wu[^a-z0-9]*zetian/i.test(hero.name),
    );
  if (unmergedTeamZetian) {
    throw new Error('A team draft statistic still exposes Wu Zetian separately.');
  }

  const mappedSideRows = report.teams.reduce(
    (total, team) => total + team.blueMatches + team.redMatches,
    0,
  );
  if (mappedSideRows !== report.meta.teamRows) {
    throw new Error('At least one team row has an unknown side after mapping.');
  }

  if (
    report.players.some(
      (player) => (player.matchHistory?.length ?? 0) !== player.matches,
    )
  ) {
    throw new Error('At least one player profile has an incomplete match log.');
  }

  if (
    report.players.some((player) =>
      player.heroes.some(
        (hero) =>
          hero.kda == null ||
          hero.gpm == null ||
          hero.dpm == null ||
          hero.kp == null,
      ),
    )
  ) {
    throw new Error('At least one hero profile is missing expanded metrics.');
  }

  const roleReview = report.players.find((player) => player.roleConfidence < 60);
  const overrideCheck = roleReview
    ? overridePlayerRole(report, roleReview.id, roleReview.role)
    : report;
  if (roleReview) {
    const updatedPlayer = overrideCheck.players.find((player) => player.id === roleReview.id);
    if (updatedPlayer?.roleConfidence !== 100) {
      throw new Error('Manual role override did not update confidence.');
    }
  }

  console.log(
    JSON.stringify(
      {
        meta: report.meta,
        reportBytes: Buffer.byteLength(JSON.stringify(report), 'utf8'),
        roleCounts,
        quality: report.quality.map((issue) => ({
          title: issue.title,
          count: issue.count,
        })),
        topPlayers: report.players.slice(0, 5).map((player) => ({
          name: player.name,
          team: player.team,
          role: player.role,
          matches: player.matches,
          impact: player.impactScore,
          confidence: player.confidence,
          signal: player.signal,
          heroes: player.heroes.length,
          matchLog: player.matchHistory?.length ?? 0,
        })),
      },
      null,
      2,
    ),
  );
}

void main();
