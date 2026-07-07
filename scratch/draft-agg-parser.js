// This is a draft of the code we will insert into csvParser.ts
import { db } from './db';
import type { Hero, Opponent, Player, PlayerHeroStat, HeroRole, LanePosition } from '@/types';
import { cleanName, parseCSV, isWin, findHeroByName, parsePercent } from './csvParser';
import { mplTurkeyRosters } from '../data/teamRoster';

// We can implement the isAggregatedTRFormat parser block like this:
/*
  if (isAggregatedTRFormat) {
    console.log('[csvParser] Processing aggregated playoff player sheet for MPL Turkey...');
    
    // We parse teamRosterCsv as raw logs to extract hero comfort pool if present!
    const rawLogsRows = teamRosterCsv ? parseCSV(teamRosterCsv) : [];
    const hasRawLogs = rawLogsRows[0] && rawLogsRows[0].some(cell => cell.toLowerCase().trim() === 'battle code');
    
    const playerHeroesMap = new Map<string, Map<string, any>>();
    
    if (hasRawLogs) {
      console.log('[csvParser] Aggregated mode: Raw logs detected in teamRosterCsv. Extracting hero pool history...');
      const rawHeaders = rawLogsRows[0].map(h => h.trim());
      const rawPlayerIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'player');
      const rawHeroIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'hero');
      const rawResultIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'result');
      const rawKillsIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'kills');
      const rawDeathsIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'deaths');
      const rawAssistsIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'assists');
      const rawGpmIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'gold per minute');
      const rawDpmIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'damage per minute');
      const rawDtpmIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'damage taken per minute');
      const rawKpIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'kill participation%');

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
        const heroMap = playerHeroesMap.get(key)!;
        if (!heroMap.has(hero)) {
          heroMap.set(hero, { matches: 0, wins: 0, kills: 0, deaths: 0, assists: 0, gpm: 0, dpm: 0, dtpm: 0, kp: 0 });
        }
        const stats = heroMap.get(hero)!;
        stats.matches++;
        
        if (isWin(row[rawResultIdx])) stats.wins++;
        stats.kills += parseFloat(row[rawKillsIdx]) || 0;
        stats.deaths += parseFloat(row[rawDeathsIdx]) || 0;
        stats.assists += parseFloat(row[rawAssistsIdx]) || 0;
        stats.gpm += parseFloat(row[rawGpmIdx]) || 0;
        stats.dpm += parseFloat(row[rawDpmIdx]) || 0;
        stats.dtpm += parseFloat(row[rawDtpmIdx]) || 0;
        stats.kp += parsePercent(row[rawKpIdx]);
      }
    }

    const pHeaders = playerRows[0].map(h => h.trim());
    const pDataRows = playerRows.slice(1);

    const getColIndex = (header: string[], colName: string) => {
      const cleanHeader = (h: string) => h.toLowerCase().replace(/^\uFEFF/, '').trim();
      const cleanTarget = colName.toLowerCase().trim();
      return header.findIndex(h => cleanHeader(h) === cleanTarget);
    };

    // Columns indices
    const pPlayerCol = getColIndex(pHeaders, 'Player');
    const pGamesCol = getColIndex(pHeaders, 'Games Played');
    const pWinsCol = getColIndex(pHeaders, 'Number of game wins');
    const pWinrateCol = getColIndex(pHeaders, 'Games Win Ratio%');
    const pKdaCol = getColIndex(pHeaders, 'KDA Ratio');
    const pKpCol = getColIndex(pHeaders, 'Kill Participation%');
    const pGpmCol = getColIndex(pHeaders, 'Gold Per Minute');
    const pGoldShareCol = getColIndex(pHeaders, 'Gold Share%');
    const pDpmCol = getColIndex(pHeaders, 'Damage Per Minute');
    const pDmgShareCol = getColIndex(pHeaders, 'Damage Share%');
    const pBuildingCol = getColIndex(pHeaders, 'Average Building Damage');
    const pDtpmCol = getColIndex(pHeaders, 'Damage Taken Per Minute');
    const pDtShareCol = getColIndex(pHeaders, 'Damage Taken Share%');
    const pCtrlCol = getColIndex(pHeaders, 'Control time per game/s');
    const pDeathsCol = getColIndex(pHeaders, 'Average Deaths');
    const pKillsCol = getColIndex(pHeaders, 'Average Kills per game');
    const pAssistsCol = getColIndex(pHeaders, 'Average Assists');
    const pTimeCol = getColIndex(pHeaders, 'Average Game Time/s');
    const pPoolCol = getColIndex(pHeaders, 'Heroes Used');

    const getPlayerTeamDetails = (playerName: string) => {
      const cleanP = cleanName(playerName);
      for (const team of mplTurkeyRosters) {
        for (const p of team.players) {
          if (cleanName(p.name) === cleanP) {
            return { teamCode: team.teamCode, teamName: team.teamName, role: p.role };
          }
        }
      }
      return { teamCode: 'UNK', teamName: 'Unknown Team', role: 'Mid' as any };
    };

    const parsedPlayers: MDLPlayerScouting[] = [];

    for (const row of pDataRows) {
      if (row.length < 5) continue;
      const playerName = row[pPlayerCol]?.trim();
      if (!playerName) continue;

      const { teamCode, teamName, role } = getPlayerTeamDetails(playerName);
      const gamesPlayed = parseInt(row[pGamesCol]) || 0;
      const wins = parseInt(row[pWinsCol]) || 0;
      const winRate = parsePercent(row[pWinrateCol]);
      const kda = parseFloat(row[pKdaCol]) || 0;
      const kp = parsePercent(row[pKpCol]);
      const gpm = parseInt(row[pGpmCol]) || 0;
      const goldShare = parsePercent(row[pGoldShareCol]);
      const dpm = parseInt(row[pDpmCol]) || 0;
      const damageShare = parsePercent(row[pDmgShareCol]);
      const buildingDpm = parseInt(row[pBuildingCol]) || 0;
      const dtpm = parseInt(row[pDtpmCol]) || 0;
      const damageTakenShare = parsePercent(row[pDtShareCol]);
      const controlTime = parseFloat(row[pCtrlCol]) || 0;
      const avgDeaths = parseFloat(row[pDeathsCol]) || 0;
      const avgKills = parseFloat(row[pKillsCol]) || 0;
      const avgAssists = parseFloat(row[pAssistsCol]) || 0;
      const avgGameMin = (parseFloat(row[pTimeCol]) || 0) / 60;

      // Extract and scale comfort heroes
      const rawHeroMap = playerHeroesMap.get(cleanName(playerName)) || new Map();
      const heroesList: MDLPlayerHero[] = [];

      for (const [hName, rawStats] of rawHeroMap.entries()) {
        const rawMatches = rawStats.matches;
        const rawWins = rawStats.wins;
        const rawWR = rawMatches > 0 ? (rawWins / rawMatches) : 0.5;

        const totalRawGames = Array.from(rawHeroMap.values()).reduce((sum: number, s: any) => sum + s.matches, 0) as number;
        const ratio = gamesPlayed / Math.max(1, totalRawGames);
        const finalHeroMatches = Math.max(1, Math.round(rawMatches * ratio));
        const finalHeroWins = Math.round(finalHeroMatches * rawWR);
        const heroObj = findHeroByName(hName, dbHeroes);

        heroesList.push({
          heroName: hName,
          heroId: heroObj?.id,
          matches: finalHeroMatches,
          wins: finalHeroWins,
          winRate: Math.round((finalHeroWins / finalHeroMatches) * 100),
          kda: parseFloat((rawStats.kda || ((rawStats.kills + rawStats.assists) / Math.max(1, rawStats.deaths))).toFixed(2)),
          gpm: Math.round(rawStats.gpm / rawMatches),
          dpm: Math.round(rawStats.dpm / rawMatches),
          dtm: Math.round(rawStats.dtpm / rawMatches),
          kp: parseFloat((rawStats.kp / rawMatches).toFixed(2))
        });
      }
      heroesList.sort((a, b) => b.matches - a.matches);

      // Compute scouting attributes using the exact same scaling logic
      const farmAttr = Math.min(99, Math.max(50, 50 + ((gpm - 450) / 350) * 45 + (goldShare - 15) * 1.5));
      const damageAttr = Math.min(99, Math.max(50, 50 + ((dpm - 1500) / 3500) * 45 + (damageShare - 15) * 1.5));
      const survivalAttr = Math.min(99, Math.max(50, 95 - (avgDeaths * 8) + (kda * 1.5)));
      const teamFightAttr = Math.min(99, Math.max(50, 50 + (kp - 40) * 0.8));
      const pushAttr = Math.min(99, Math.max(50, 50 + (buildingDpm / 300) * 45));
      const controlAttr = Math.min(99, Math.max(50, 50 + (controlTime / 45) * 45));

      let farmScore = farmAttr;
      let pushScore = pushAttr;
      const roleUpper = role.toUpperCase();
      if (roleUpper === 'ROAM') {
        farmScore = Math.min(99, Math.max(70, 70 + (kp - 50) * 0.4));
        pushScore = Math.min(99, Math.max(65, 65 + (controlTime / 45) * 20));
      } else if (roleUpper === 'MID') {
        pushScore = Math.min(99, Math.max(68, 68 + (damageShare - 20) * 0.8));
      }

      const scoutingScore = parseFloat(((farmScore + damageAttr + survivalAttr + teamFightAttr + pushScore + controlAttr) / 6).toFixed(1));

      let playstyleTag = 'Tactician';
      if (roleUpper === 'JUNGLE') {
        playstyleTag = farmScore > 85 ? 'Carry Jungler' : 'Elusive Assassin';
      } else if (roleUpper === 'ROAM') {
        playstyleTag = controlAttr > 85 ? 'Engage Maestro' : 'Protector';
      } else if (roleUpper === 'MID') {
        playstyleTag = damageAttr > 85 ? 'Artillery Mage' : 'Utility Mid';
      } else if (roleUpper === 'GOLD') {
        playstyleTag = damageAttr > 85 ? 'Late Game Carry' : 'Steady Marksman';
      } else if (roleUpper === 'EXP') {
        playstyleTag = pushScore > 85 ? 'Split Pusher' : 'Sturdy Frontliner';
      }

      parsedPlayers.push({
        name: playerName,
        team: teamCode,
        role: roleUpper,
        matches: gamesPlayed,
        wins,
        winRate,
        heroPoolSize: heroesList.length || parseInt(row[pPoolCol]) || 0,
        kda,
        kp,
        gpm,
        dpm,
        dtpm,
        buildingDpm,
        goldShare,
        damageShare,
        damageTakenShare,
        controlTime,
        avgDeaths,
        avgKills,
        avgAssists,
        avgGameMin,
        blueMatches: Math.round(gamesPlayed / 2),
        blueWins: Math.round(wins / 2),
        blueWR: winRate,
        redMatches: Math.round(gamesPlayed / 2),
        redWins: Math.round(wins / 2),
        redWR: winRate,
        groupStage: { matches: gamesPlayed, wins, wr: winRate },
        progressiveRound: { matches: 0, wins: 0, wr: 0 },
        playoffs: { matches: 0, wins: 0, wr: 0 },
        attributes: {
          farm: Math.round(farmScore),
          damage: Math.round(damageAttr),
          survival: Math.round(survivalAttr),
          teamFight: Math.round(teamFightAttr),
          push: Math.round(pushScore),
          control: Math.round(controlAttr)
        },
        playstyleTag,
        scoutingScore,
        heroes: heroesList
      });
    }

    // Group players by team code to aggregate team scouting stats
    const teamPlayersMap = new Map<string, MDLPlayerScouting[]>();
    parsedPlayers.forEach(p => {
      if (!teamPlayersMap.has(p.team)) {
        teamPlayersMap.set(p.team, []);
      }
      teamPlayersMap.get(p.team)!.push(p);
    });

    const parsedTeams: MDLTeamScouting[] = [];
    const globalHeroPicks = new Map<string, { picks: number; wins: number }>();

    for (const [tCode, tPlayers] of teamPlayersMap.entries()) {
      const teamRoster = mplTurkeyRosters.find(r => r.teamCode === tCode);
      const teamName = teamRoster ? teamRoster.teamName : tCode;

      const matches = Math.max(...tPlayers.map(p => p.matches));
      const wins = Math.max(...tPlayers.map(p => p.wins));
      const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;

      const teamGpm = Math.round(tPlayers.reduce((sum, p) => sum + p.gpm, 0) / tPlayers.length);
      const teamDamage = Math.round(tPlayers.reduce((sum, p) => sum + p.dpm, 0) / tPlayers.length);
      const teamDamageTaken = Math.round(tPlayers.reduce((sum, p) => sum + p.dtpm, 0) / tPlayers.length);
      const avgGameMin = tPlayers.reduce((sum, p) => sum + p.avgGameMin, 0) / tPlayers.length;

      const teamKills = tPlayers.reduce((sum, p) => sum + (p.avgKills * p.matches), 0) / 5;
      const teamDeaths = tPlayers.reduce((sum, p) => sum + (p.avgDeaths * p.matches), 0) / 5;
      const teamAssists = tPlayers.reduce((sum, p) => sum + (p.avgAssists * p.matches), 0) / 5;

      const avgTowers = 6.2;
      const avgTurtles = 2.1;
      const avgLords = 1.1;

      const scoutingScore = parseFloat((tPlayers.reduce((sum, p) => sum + p.scoutingScore, 0) / tPlayers.length).toFixed(1));

      const tempo = Math.round(tPlayers.reduce((sum, p) => sum + p.attributes.farm, 0) / tPlayers.length);
      const damage = Math.round(tPlayers.reduce((sum, p) => sum + p.attributes.damage, 0) / tPlayers.length);
      const durability = Math.round(tPlayers.reduce((sum, p) => sum + p.attributes.survival, 0) / tPlayers.length);
      const objective = Math.round((tempo + damage) / 2);
      const teamfight = Math.round(tPlayers.reduce((sum, p) => sum + p.attributes.teamFight, 0) / tPlayers.length);
      const control = Math.round(tPlayers.reduce((sum, p) => sum + p.attributes.control, 0) / tPlayers.length);

      parsedTeams.push({
        name: teamName,
        matches,
        wins,
        winRate,
        playersCount: tPlayers.length,
        distinctHeroes: tPlayers.reduce((sum, p) => sum + p.heroPoolSize, 0),
        teamGpm,
        teamDamage,
        teamDamageTaken,
        avgGameMin,
        avgTurtles,
        avgLords,
        avgTowers,
        teamKills: parseFloat((teamKills / matches).toFixed(1)),
        teamDeaths: parseFloat((teamDeaths / matches).toFixed(1)),
        teamAssists: parseFloat((teamAssists / matches).toFixed(1)),
        avgControl: parseFloat((tPlayers.reduce((sum, p) => sum + p.controlTime, 0) / tPlayers.length).toFixed(1)),
        avgKp: parseFloat((tPlayers.reduce((sum, p) => sum + p.kp, 0) / tPlayers.length).toFixed(1)),
        blueMatches: Math.round(matches / 2),
        blueWins: Math.round(wins / 2),
        blueWR: winRate,
        redMatches: Math.round(matches / 2),
        redWins: Math.round(wins / 2),
        redWR: winRate,
        groupStage: { matches, wins, wr: winRate },
        progressiveRound: { matches: 0, wins: 0, wr: 0 },
        playoffs: { matches: 0, wins: 0, wr: 0 },
        attributes: {
          tempo,
          damage,
          durability,
          objective,
          teamfight,
          control
        },
        playstyleTag: winRate >= 70 ? 'Aggressive Giant' : winRate >= 50 ? 'Balanced Contender' : 'Underdog',
        scoutingScore,
        players: tPlayers.map(p => p.name)
      });

      // Accumulate global hero picks
      tPlayers.forEach(p => {
        p.heroes.forEach(h => {
          if (!globalHeroPicks.has(h.heroName)) {
            globalHeroPicks.set(h.heroName, { picks: 0, wins: 0 });
          }
          const gh = globalHeroPicks.get(h.heroName)!;
          gh.picks += h.matches;
          gh.wins += h.wins;
        });
      });
    }

    const finalHeroes = Array.from(globalHeroPicks.entries()).map(([hName, stats]) => {
      const heroObj = findHeroByName(hName, dbHeroes);
      return {
        heroName: hName,
        heroId: heroObj?.id,
        picks: stats.picks,
        wins: stats.wins,
        winRate: stats.picks > 0 ? Math.round((stats.wins / stats.picks) * 100) : 0
      };
    });

    finalHeroes.sort((a, b) => b.picks - a.picks);
    parsedPlayers.sort((a, b) => b.scoutingScore - a.scoutingScore);
    parsedTeams.sort((a, b) => b.scoutingScore - a.scoutingScore);

    return {
      players: parsedPlayers,
      teams: parsedTeams,
      heroes: finalHeroes
    };
  }
*/
