import { readFile } from 'node:fs/promises';
import { analyzeScoutingCSVs, overridePlayerRole } from '../src/lib/scoutingEngine';

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
