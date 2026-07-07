'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/db';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import HeroAvatar from '@/components/ui/HeroAvatar';
import { parseCSV } from '@/lib/csvParser';
import type { ScrimRecord, ScrimPlayerStats, Hero, Player, LanePosition } from '@/types';

// Container framer-motion variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0 },
};

export default function ScrimsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'log' | 'import'>('overview');

  // Relational data from IndexedDB
  const [scrimRecords, setScrimRecords] = useState<ScrimRecord[]>([]);
  const [playerStats, setPlayerStats] = useState<ScrimPlayerStats[]>([]);
  const [dbHeroes, setDbHeroes] = useState<Hero[]>([]);
  const [dbPlayers, setDbPlayers] = useState<Player[]>([]);

  // Expanded match ID state for accordion
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Form states (Log Scrim Game)
  const [matchId, setMatchId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [opponent, setOpponent] = useState('');
  const [matchName, setMatchName] = useState('MPL PH S17 Regular Season');
  const [patch, setPatch] = useState('CSV Sample');
  const [side, setSide] = useState<'Blue' | 'Red'>('Blue');
  const [gameNumber, setGameNumber] = useState(1);
  const [result, setResult] = useState<'W' | 'L'>('W');
  const [duration, setDuration] = useState(15);
  const [teamKills, setTeamKills] = useState<number>(0);
  const [oppKills, setOppKills] = useState<number>(0);
  const [goldDiff10, setGoldDiff10] = useState<number>(0);
  const [towerDiff, setTowerDiff] = useState<number>(0);
  const [firstTurtle, setFirstTurtle] = useState<'Yes' | 'No' | ''>('');
  const [firstLord, setFirstLord] = useState<'Yes' | 'No' | ''>('');
  const [notes, setNotes] = useState('');

  // 5 Players Form states
  const initialRosterStats = {
    EXP: { player: '', hero: '', kills: 0, deaths: 0, assists: 0, gold: 0, heroDamage: 0, towerDamage: 0, damageTaken: 0, kp: 0 },
    Jungle: { player: '', hero: '', kills: 0, deaths: 0, assists: 0, gold: 0, heroDamage: 0, towerDamage: 0, damageTaken: 0, kp: 0 },
    Mid: { player: '', hero: '', kills: 0, deaths: 0, assists: 0, gold: 0, heroDamage: 0, towerDamage: 0, damageTaken: 0, kp: 0 },
    Gold: { player: '', hero: '', kills: 0, deaths: 0, assists: 0, gold: 0, heroDamage: 0, towerDamage: 0, damageTaken: 0, kp: 0 },
    Roam: { player: '', hero: '', kills: 0, deaths: 0, assists: 0, gold: 0, heroDamage: 0, towerDamage: 0, damageTaken: 0, kp: 0 },
  };
  const [rosterStats, setRosterStats] = useState(initialRosterStats);

  // Bans and Opponent Picks
  const [teamBans, setTeamBans] = useState<string[]>(['', '', '', '', '']);
  const [oppBans, setOppBans] = useState<string[]>(['', '', '', '', '']);
  const [oppPicks, setOppPicks] = useState<string[]>(['', '', '', '', '']);

  // Autocomplete UI tracking
  const [focusedInput, setFocusedInput] = useState<{ role?: string; type: 'player' | 'hero' | 'ban' | 'oppBan' | 'oppPick'; index?: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Import CSV files
  const [scrimFile, setScrimFile] = useState<File | null>(null);
  const [statsFile, setStatsFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  
  // Week Selection state
  const [week, setWeek] = useState('Week 1');

  // Print Draft Report state
  const [printOpponent, setPrintOpponent] = useState<string>('');

  // Auto-detect week from date selection based on existing records
  useEffect(() => {
    if (date && scrimRecords.length > 0) {
      const dates = scrimRecords.map(r => new Date(r.date).getTime()).filter(t => !isNaN(t));
      if (dates.length > 0) {
        const minTime = Math.min(...dates);
        const curTime = new Date(date).getTime();
        if (!isNaN(curTime)) {
          const diffDays = Math.floor((curTime - minTime) / (1000 * 60 * 60 * 24));
          const calculatedWeek = Math.max(1, Math.floor(diffDays / 7) + 1);
          setWeek(`Week ${calculatedWeek}`);
        }
      }
    }
  }, [date, scrimRecords]);

  // Load datasets on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (typeof window !== 'undefined' && db) {
        const records = await db.table('scrimRecords').toArray();
        const stats = await db.table('scrimPlayerStats').toArray();
        const heroes = await db.heroes.toArray();
        const players = await db.players.toArray();

        setScrimRecords(records.sort((a, b) => b.date.localeCompare(a.date) || b.gameNumber - a.gameNumber));
        setPlayerStats(stats);
        setDbHeroes(heroes);
        setDbPlayers(players);
      }
    } catch (err) {
      console.error('Error loading scrim databases:', err);
    }
  };

  // Helper: Find Hero Avatar URL
  const getHeroImageUrl = (heroName: string) => {
    const clean = heroName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matched = dbHeroes.find(h => h.name.toLowerCase().replace(/[^a-z0-9]/g, '') === clean);
    return matched?.imageUrl || '';
  };

  // Helper: Find Player Roster Role
  const handleAutoPlayerFill = (role: LanePosition) => {
    const active = dbPlayers.filter(p => p.role === role);
    if (active.length > 0) {
      setRosterStats(prev => ({
        ...prev,
        [role]: { ...prev[role], player: active[0].name },
      }));
    }
  };

  // Auto-fill all 5 roles with default roster players
  const autoFillRoster = () => {
    const positions: LanePosition[] = ['EXP', 'Jungle', 'Mid', 'Gold', 'Roam'];
    const updated = { ...rosterStats };
    positions.forEach(role => {
      const active = dbPlayers.filter(p => p.role === role);
      if (active.length > 0) {
        updated[role].player = active[0].name;
      }
    });
    setRosterStats(updated);
  };

  // Auto-calculate KPs for all players based on kills and teamKills
  const autoCalculateKPs = () => {
    if (!teamKills || teamKills <= 0) return;
    const positions: LanePosition[] = ['EXP', 'Jungle', 'Mid', 'Gold', 'Roam'];
    const updated = { ...rosterStats };
    positions.forEach(role => {
      const sum = updated[role].kills + updated[role].assists;
      updated[role].kp = parseFloat(((sum / teamKills) * 100).toFixed(1));
    });
    setRosterStats(updated);
  };

  // Autocomplete search filtering
  const filteredOptions = useMemo(() => {
    if (!focusedInput) return [];
    const query = searchQuery.toLowerCase().trim();

    if (focusedInput.type === 'player') {
      const allPlayers = dbPlayers.map(p => p.name);
      const uniquePlayers = Array.from(new Set([...allPlayers, 'Jeymz', 'Raizen.', 'Minguin', 'Netskie', 'Perkziva', 'Rosa', 'Alien', 'Krowbars', 'Goliath']));
      if (!query) return uniquePlayers;
      return uniquePlayers.filter(p => p.toLowerCase().includes(query));
    }

    if (focusedInput.type === 'hero' || focusedInput.type === 'ban' || focusedInput.type === 'oppBan' || focusedInput.type === 'oppPick') {
      const heroNames = dbHeroes.map(h => h.name);
      if (!query) return heroNames.slice(0, 15);
      return heroNames.filter(h => h.toLowerCase().includes(query)).slice(0, 15);
    }

    return [];
  }, [focusedInput, searchQuery, dbHeroes, dbPlayers]);

  const selectAutocompleteValue = (val: string) => {
    if (!focusedInput) return;

    if (focusedInput.type === 'player' && focusedInput.role) {
      const roleKey = focusedInput.role as LanePosition;
      setRosterStats(prev => ({
        ...prev,
        [roleKey]: { ...prev[roleKey], player: val },
      }));
    } else if (focusedInput.type === 'hero' && focusedInput.role) {
      const roleKey = focusedInput.role as LanePosition;
      setRosterStats(prev => ({
        ...prev,
        [roleKey]: { ...prev[roleKey], hero: val },
      }));
    } else if (focusedInput.type === 'ban' && typeof focusedInput.index === 'number') {
      const next = [...teamBans];
      next[focusedInput.index] = val;
      setTeamBans(next);
    } else if (focusedInput.type === 'oppBan' && typeof focusedInput.index === 'number') {
      const next = [...oppBans];
      next[focusedInput.index] = val;
      setOppBans(next);
    } else if (focusedInput.type === 'oppPick' && typeof focusedInput.index === 'number') {
      const next = [...oppPicks];
      next[focusedInput.index] = val;
      setOppPicks(next);
    }

    setFocusedInput(null);
    setSearchQuery('');
  };

  // Form Submission
  const saveManualScrim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchId.trim() || !opponent.trim()) {
      alert('Match ID and Opponent Name are required.');
      return;
    }

    try {
      const record: ScrimRecord = {
        matchId: matchId.trim(),
        date,
        opponent: opponent.trim(),
        match: matchName.trim(),
        patch: patch.trim(),
        side,
        gameNumber: Number(gameNumber),
        result,
        duration: Number(duration),
        teamKills: Number(teamKills),
        oppKills: Number(oppKills),
        goldDiff10: Number(goldDiff10),
        towerDiff: Number(towerDiff),
        firstTurtle,
        firstLord,
        expPlayer: rosterStats.EXP.player || 'EXP Player',
        expHero: rosterStats.EXP.hero || 'Lapu-Lapu',
        junglePlayer: rosterStats.Jungle.player || 'Jungle Player',
        jungleHero: rosterStats.Jungle.hero || 'Baxia',
        midPlayer: rosterStats.Mid.player || 'Mid Player',
        midHero: rosterStats.Mid.hero || 'Yve',
        goldPlayer: rosterStats.Gold.player || 'Gold Player',
        goldHero: rosterStats.Gold.hero || 'Hanabi',
        roamPlayer: rosterStats.Roam.player || 'Roam Player',
        roamHero: rosterStats.Roam.hero || 'Marcel',
        teamBans,
        oppBans,
        oppPicks,
        week,
        notes: notes.trim(),
        createdAt: new Date(),
      };

      const recordId = (await db.table('scrimRecords').add(record)) as number;

      // Save player stats
      const positions: LanePosition[] = ['EXP', 'Jungle', 'Mid', 'Gold', 'Roam'];
      const playerStatRows: ScrimPlayerStats[] = positions.map(role => ({
        scrimRecordId: recordId,
        matchId: record.matchId,
        date: record.date,
        opponent: record.opponent,
        match: record.match,
        side: record.side,
        gameNumber: record.gameNumber,
        result: record.result,
        player: rosterStats[role].player || `${role} Player`,
        role,
        hero: rosterStats[role].hero || 'Akai',
        kills: Number(rosterStats[role].kills),
        deaths: Number(rosterStats[role].deaths),
        assists: Number(rosterStats[role].assists),
        gold: Number(rosterStats[role].gold),
        heroDamage: Number(rosterStats[role].heroDamage),
        towerDamage: Number(rosterStats[role].towerDamage),
        damageTaken: Number(rosterStats[role].damageTaken),
        killParticipation: Number(rosterStats[role].kp),
      }));

      await db.table('scrimPlayerStats').bulkAdd(playerStatRows);

      // Reset states and alert
      alert(`Scrim match ${record.matchId} (Game ${record.gameNumber}) successfully saved!`);
      setMatchId('');
      setOpponent('');
      setNotes('');
      setRosterStats(initialRosterStats);
      setTeamBans(['', '', '', '', '']);
      setOppBans(['', '', '', '', '']);
      setOppPicks(['', '', '', '', '']);
      setWeek('Week 1');
      
      await loadData();
      setActiveTab('overview');
    } catch (err) {
      console.error(err);
      alert('Error saving match to IndexedDB.');
    }
  };

  // Delete Scrim Record
  const deleteScrimRecord = async (id: number) => {
    if (!confirm('Are you sure you want to delete this scrim record? All linked player stats will also be deleted.')) return;
    try {
      await db.table('scrimRecords').delete(id);
      await db.table('scrimPlayerStats').where('scrimRecordId').equals(id).delete();
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Bulk CSV Parsing and Upload
  const handleCSVImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrimFile) {
      setImportStatus({ type: 'error', message: 'Match input sheet (SCRIM_INPUT.csv) is required.' });
      return;
    }

    try {
      setImportStatus({ type: '', message: 'Parsing files and importing...' });

      // 1. Parse Scrim File
      const scrimReader = new FileReader();
      scrimReader.readAsText(scrimFile);
      scrimReader.onload = async () => {
        try {
          const scrimText = scrimReader.result as string;
          const scrimRows = parseCSV(scrimText);

          let scrimHeadersIndex = 0;
          // check if first row is title
          if (scrimRows[0][0].toLowerCase().includes('scrim') && !scrimRows[0][0].toLowerCase().includes('match id')) {
            scrimHeadersIndex = 1;
          }
          const scrimHeaders = scrimRows[scrimHeadersIndex].map(h => h.trim());
          const scrimDataRows = scrimRows.slice(scrimHeadersIndex + 1).filter(r => r.length > 1 && r[0].trim());

          // Map CSV index
          const getScrimIdx = (name: string) => scrimHeaders.findIndex(h => h.toLowerCase() === name.toLowerCase());
          const mIdIdx = getScrimIdx('Match ID');
          const dateIdx = getScrimIdx('Date');
          const oppIdx = getScrimIdx('Opponent');
          const matchIdx = getScrimIdx('Match');
          const patchIdx = getScrimIdx('Patch');
          const sideIdx = getScrimIdx('Side');
          const gameIdx = getScrimIdx('Game #');
          const resIdx = getScrimIdx('Result');
          const durIdx = getScrimIdx('Duration (min)');
          const tkIdx = getScrimIdx('Team Kills');
          const okIdx = getScrimIdx('Opp Kills');
          const gDiffIdx = getScrimIdx('Gold Diff @10');
          const towIdx = getScrimIdx('Tower Diff');
          const turtIdx = getScrimIdx('First Turtle');
          const lordIdx = getScrimIdx('First Lord');
          const notesIdx = getScrimIdx('Notes');

          const expPIdx = getScrimIdx('EXP Player');
          const expHIdx = getScrimIdx('EXP Hero');
          const jgPIdx = getScrimIdx('Jungle Player');
          const jgHIdx = getScrimIdx('Jungle Hero');
          const midPIdx = getScrimIdx('Mid Player');
          const midHIdx = getScrimIdx('Mid Hero');
          const goldPIdx = getScrimIdx('Gold Player');
          const goldHIdx = getScrimIdx('Gold Hero');
          const roamPIdx = getScrimIdx('Roam Player');
          const roamHIdx = getScrimIdx('Roam Hero');

          // Bans
          const banIdxs = [1, 2, 3, 4, 5].map(i => getScrimIdx(`Team Ban ${i}`));
          const oppBanIdxs = [1, 2, 3, 4, 5].map(i => getScrimIdx(`Opp Ban ${i}`));
          const oppPickIdxs = [1, 2, 3, 4, 5].map(i => getScrimIdx(`Opp Pick ${i}`));

          const parsedRecords: ScrimRecord[] = [];
          const recordMap = new Map<string, ScrimRecord>(); // MatchID -> Record

          // Pre-calculate minimum date for relative week grouping
          const rowDates = scrimDataRows
            .map(row => new Date(row[dateIdx]).getTime())
            .filter(t => !isNaN(t));
          const minTime = rowDates.length > 0 ? Math.min(...rowDates) : new Date().getTime();

          scrimDataRows.forEach(row => {
            const mId = row[mIdIdx]?.trim();
            if (!mId) return;

            const dateStr = row[dateIdx] || new Date().toISOString().split('T')[0];
            const curTime = new Date(dateStr).getTime();
            let weekVal = 'Week 1';
            if (!isNaN(curTime)) {
              const diffDays = Math.floor((curTime - minTime) / (1000 * 60 * 60 * 24));
              weekVal = `Week ${Math.max(1, Math.floor(diffDays / 7) + 1)}`;
            }

            const rec: ScrimRecord = {
              matchId: mId,
              date: dateStr,
              opponent: row[oppIdx] || 'Opponent',
              match: row[matchIdx] || 'Match Series',
              patch: row[patchIdx] || 'Current Patch',
              side: (row[sideIdx]?.trim().toLowerCase() === 'blue' ? 'Blue' : 'Red') as 'Blue' | 'Red',
              gameNumber: Number(row[gameIdx]) || 1,
              result: (row[resIdx]?.trim().toLowerCase() === 'w' || row[resIdx]?.trim().toLowerCase() === 'win' || row[resIdx]?.trim().toLowerCase() === 'victory' || row[resIdx]?.trim() === '胜') ? 'W' : 'L',
              duration: Number(row[durIdx]) || 15,
              teamKills: Number(row[tkIdx]) || 0,
              oppKills: Number(row[okIdx]) || 0,
              goldDiff10: Number(row[gDiffIdx]) || 0,
              towerDiff: Number(row[towIdx]) || 0,
              firstTurtle: (row[turtIdx]?.trim().toLowerCase() === 'yes' ? 'Yes' : 'No') as any,
              firstLord: (row[lordIdx]?.trim().toLowerCase() === 'yes' ? 'Yes' : 'No') as any,
              expPlayer: row[expPIdx] || '',
              expHero: row[expHIdx] || '',
              junglePlayer: row[jgPIdx] || '',
              jungleHero: row[jgHIdx] || '',
              midPlayer: row[midPIdx] || '',
              midHero: row[midHIdx] || '',
              goldPlayer: row[goldPIdx] || '',
              goldHero: row[goldHIdx] || '',
              roamPlayer: row[roamPIdx] || '',
              roamHero: row[roamHIdx] || '',
              teamBans: banIdxs.map(idx => row[idx] || ''),
              oppBans: oppBanIdxs.map(idx => row[idx] || ''),
              oppPicks: oppPickIdxs.map(idx => row[idx] || ''),
              week: weekVal,
              notes: row[notesIdx] || '',
              createdAt: new Date(),
            };
            parsedRecords.push(rec);
            recordMap.set(mId, rec);
          });

          // 2. Parse Stats File if uploaded, else fallback
          let parsedStats: ScrimPlayerStats[] = [];

          if (statsFile) {
            const statsReader = new FileReader();
            statsReader.readAsText(statsFile);
            statsReader.onload = async () => {
              try {
                const statsText = statsReader.result as string;
                const statsRows = parseCSV(statsText);

                let statsHeadersIndex = 0;
                if (statsRows[0][0].toLowerCase().includes('player') && !statsRows[0][0].toLowerCase().includes('match id')) {
                  statsHeadersIndex = 1;
                }
                const statsHeaders = statsRows[statsHeadersIndex].map(h => h.trim());
                const statsDataRows = statsRows.slice(statsHeadersIndex + 1).filter(r => r.length > 1 && r[0].trim());

                const getStatsIdx = (name: string) => statsHeaders.findIndex(h => h.toLowerCase() === name.toLowerCase());
                const smIdIdx = getStatsIdx('Match ID');
                const sPlayerIdx = getStatsIdx('Player');
                const sRoleIdx = getStatsIdx('Role');
                const sHeroIdx = getStatsIdx('Hero');
                const sKillsIdx = getStatsIdx('Kills');
                const sDeathsIdx = getStatsIdx('Deaths');
                const sAssistsIdx = getStatsIdx('Assists');
                const sGoldIdx = getStatsIdx('Gold');
                const sDmgIdx = getStatsIdx('Hero Damage');
                const sTDmgIdx = getStatsIdx('Tower Damage');
                const sTakenIdx = getStatsIdx('Damage Taken');
                const sKpIdx = getStatsIdx('Kill Participation');

                statsDataRows.forEach(row => {
                  const mId = row[smIdIdx]?.trim();
                  if (!mId) return;

                  const parent = recordMap.get(mId);
                  const pGold = row[sGoldIdx]?.replace(/,/g, '');
                  const pDmg = row[sDmgIdx]?.replace(/,/g, '');
                  const pTDmg = row[sTDmgIdx]?.replace(/,/g, '');
                  const pTaken = row[sTakenIdx]?.replace(/,/g, '');
                  let pKpStr = row[sKpIdx] || '0';
                  if (pKpStr.includes('%')) {
                    pKpStr = pKpStr.replace('%', '');
                  }
                  const pKp = parseFloat(pKpStr) || 0;

                  const statRow: ScrimPlayerStats = {
                    matchId: mId,
                    date: parent?.date || new Date().toISOString().split('T')[0],
                    opponent: parent?.opponent || 'Opponent',
                    match: parent?.match || 'Match Series',
                    side: parent?.side || 'Blue',
                    gameNumber: parent?.gameNumber || 1,
                    result: parent?.result || 'W',
                    player: row[sPlayerIdx] || 'Player',
                    role: (row[sRoleIdx] || 'Gold') as LanePosition,
                    hero: row[sHeroIdx] || 'Akai',
                    kills: Number(row[sKillsIdx]) || 0,
                    deaths: Number(row[sDeathsIdx]) || 0,
                    assists: Number(row[sAssistsIdx]) || 0,
                    gold: Number(pGold) || 0,
                    heroDamage: Number(pDmg) || 0,
                    towerDamage: Number(pTDmg) || 0,
                    damageTaken: Number(pTaken) || 0,
                    killParticipation: pKp,
                  };
                  parsedStats.push(statRow);
                });

                // Write relationally to Dexie IndexedDB
                await saveToDatabase(parsedRecords, parsedStats);
              } catch (err) {
                console.error(err);
                setImportStatus({ type: 'error', message: 'Failed to parse player stats CSV file.' });
              }
            };
          } else {
            // Auto generate fallback stats from metadata picks
            parsedRecords.forEach(rec => {
              const roles: LanePosition[] = ['EXP', 'Jungle', 'Mid', 'Gold', 'Roam'];
              roles.forEach(role => {
                let player = '';
                let hero = '';
                if (role === 'EXP') { player = rec.expPlayer; hero = rec.expHero; }
                else if (role === 'Jungle') { player = rec.junglePlayer; hero = rec.jungleHero; }
                else if (role === 'Mid') { player = rec.midPlayer; hero = rec.midHero; }
                else if (role === 'Gold') { player = rec.goldPlayer; hero = rec.goldHero; }
                else if (role === 'Roam') { player = rec.roamPlayer; hero = rec.roamHero; }

                parsedStats.push({
                  matchId: rec.matchId,
                  date: rec.date,
                  opponent: rec.opponent,
                  match: rec.match,
                  side: rec.side,
                  gameNumber: rec.gameNumber,
                  result: rec.result,
                  player: player || `${role} Player`,
                  role,
                  hero: hero || 'Akai',
                  kills: 0,
                  deaths: 0,
                  assists: 0,
                  gold: 0,
                  heroDamage: 0,
                  towerDamage: 0,
                  damageTaken: 0,
                  killParticipation: 0,
                });
              });
            });

            // Write relationally to Dexie IndexedDB
            await saveToDatabase(parsedRecords, parsedStats);
          }
        } catch (err) {
          console.error(err);
          setImportStatus({ type: 'error', message: 'Failed to parse match input CSV file.' });
        }
      };
    } catch (err) {
      console.error(err);
      setImportStatus({ type: 'error', message: 'An unexpected error occurred during CSV parsing.' });
    }
  };

  const saveToDatabase = async (records: ScrimRecord[], stats: ScrimPlayerStats[]) => {
    try {
      if (typeof window !== 'undefined' && db) {
        // Clear old records first to prevent duplications if they import multiple times
        await db.table('scrimRecords').clear();
        await db.table('scrimPlayerStats').clear();

        // Save records one by one to get auto-incremented IDs
        for (const record of records) {
          const recordId = await db.table('scrimRecords').add(record);

          // Find linked player stats and attach recordId
          const linkedStats = stats.filter(s => s.matchId === record.matchId);
          const updatedStats = linkedStats.map(s => ({
            ...s,
            scrimRecordId: recordId,
          }));

          if (updatedStats.length > 0) {
            await db.table('scrimPlayerStats').bulkAdd(updatedStats);
          }
        }

        setImportStatus({
          type: 'success',
          message: `Successfully imported ${records.length} Scrim Games and ${stats.length} Player Performance entries relational style!`,
        });

        setScrimFile(null);
        setStatsFile(null);
        await loadData();
        setTimeout(() => setActiveTab('overview'), 2000);
      }
    } catch (err) {
      console.error(err);
      setImportStatus({ type: 'error', message: 'Database write failed during bulk import.' });
    }
  };

  const clearAllScrimData = async () => {
    if (!confirm('WARNING: This will completely erase all stored scrim matches, series records, and individual player stats. This action CANNOT be undone. Are you sure you want to continue?')) return;
    try {
      await db.table('scrimRecords').clear();
      await db.table('scrimPlayerStats').clear();
      await loadData();
      alert('All scrim records and player stats have been deleted.');
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // METRICS & ANALYSIS COMPUTATIONS
  // ==========================================
  const dashboardMetrics = useMemo(() => {
    if (scrimRecords.length === 0) return null;

    const total = scrimRecords.length;
    const wins = scrimRecords.filter(r => r.result === 'W').length;
    const winRate = parseFloat(((wins / total) * 100).toFixed(1));

    // Side Win Rates
    const blueGames = scrimRecords.filter(r => r.side === 'Blue');
    const blueWins = blueGames.filter(r => r.result === 'W').length;
    const blueWinRate = blueGames.length > 0 ? parseFloat(((blueWins / blueGames.length) * 100).toFixed(1)) : 0;

    const redGames = scrimRecords.filter(r => r.side === 'Red');
    const redWins = redGames.filter(r => r.result === 'W').length;
    const redWinRate = redGames.length > 0 ? parseFloat(((redWins / redGames.length) * 100).toFixed(1)) : 0;

    // Objective controls
    const turtleWins = scrimRecords.filter(r => r.firstTurtle === 'Yes').length;
    const turtleRate = parseFloat(((turtleWins / total) * 100).toFixed(1));

    const lordWins = scrimRecords.filter(r => r.firstLord === 'Yes').length;
    const lordRate = parseFloat(((lordWins / total) * 100).toFixed(1));

    // Avg duration
    const totalDuration = scrimRecords.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = parseFloat((totalDuration / total).toFixed(1));

    return {
      total,
      wins,
      losses: total - wins,
      winRate,
      blueGames: blueGames.length,
      blueWinRate,
      redGames: redGames.length,
      redWinRate,
      turtleRate,
      lordRate,
      avgDuration,
    };
  }, [scrimRecords]);

  // Aggregate stats per player + role
  const playerPerformanceMatrix = useMemo(() => {
    if (playerStats.length === 0) return [];

    const map = new Map<string, {
      player: string;
      role: LanePosition;
      games: number;
      wins: number;
      kills: number;
      deaths: number;
      assists: number;
      gold: number;
      damage: number;
      taken: number;
      tower: number;
      kpSum: number;
    }>();

    playerStats.forEach(stat => {
      const key = `${stat.player}::${stat.role}`;
      const existing = map.get(key) || {
        player: stat.player,
        role: stat.role,
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        gold: 0,
        damage: 0,
        taken: 0,
        tower: 0,
        kpSum: 0,
      };

      existing.games += 1;
      if (stat.result === 'W') existing.wins += 1;
      existing.kills += stat.kills;
      existing.deaths += stat.deaths;
      existing.assists += stat.assists;
      existing.gold += stat.gold;
      existing.damage += stat.heroDamage;
      existing.taken += stat.damageTaken;
      existing.tower += stat.towerDamage;
      existing.kpSum += stat.killParticipation;

      map.set(key, existing);
    });

    return Array.from(map.values()).map(row => {
      const avgKills = parseFloat((row.kills / row.games).toFixed(1));
      const avgDeaths = parseFloat((row.deaths / row.games).toFixed(1));
      const avgAssists = parseFloat((row.assists / row.games).toFixed(1));
      
      const kdaVal = row.deaths === 0 ? (row.kills + row.assists) : (row.kills + row.assists) / row.deaths;
      const kda = parseFloat(kdaVal.toFixed(2));

      return {
        player: row.player,
        role: row.role,
        games: row.games,
        wins: row.wins,
        winRate: Math.round((row.wins / row.games) * 100),
        kda,
        kdaStr: `${avgKills}/${avgDeaths}/${avgAssists}`,
        avgGold: Math.round(row.gold / row.games),
        avgDamage: Math.round(row.damage / row.games),
        avgTaken: Math.round(row.taken / row.games),
        avgTower: Math.round(row.tower / row.games),
        avgKp: parseFloat((row.kpSum / row.games).toFixed(1)),
      };
    }).sort((a, b) => b.games - a.games || b.winRate - a.winRate);
  }, [playerStats]);

  // Top Hero picks and win rates in scrims
  const heroPerformanceMatrix = useMemo(() => {
    if (playerStats.length === 0) return [];

    const map = new Map<string, { name: string; picks: number; wins: number }>();
    playerStats.forEach(stat => {
      const existing = map.get(stat.hero) || { name: stat.hero, picks: 0, wins: 0 };
      existing.picks += 1;
      if (stat.result === 'W') existing.wins += 1;
      map.set(stat.hero, existing);
    });

    return Array.from(map.values())
      .map(row => ({
        ...row,
        winRate: Math.round((row.wins / row.picks) * 100),
      }))
      .sort((a, b) => b.picks - a.picks || b.winRate - a.winRate)
      .slice(0, 5);
  }, [playerStats]);

  // Group scrims by week
  const groupedScrims = useMemo(() => {
    const groups: Record<string, ScrimRecord[]> = {};
    scrimRecords.forEach(rec => {
      const wk = rec.week || 'Week 1';
      if (!groups[wk]) groups[wk] = [];
      groups[wk].push(rec);
    });

    // Sort weeks naturally (Week 1, Week 2, ..., Playoffs)
    return Object.keys(groups)
      .sort((a, b) => {
        const numA = parseInt(a.replace(/^\D+/g, '')) || 0;
        const numB = parseInt(b.replace(/^\D+/g, '')) || 0;
        if (numA === 0 && numB === 0) return b.localeCompare(a); // non-numeric fallback
        return numB - numA; // Latest week first
      })
      .map(wk => ({
        weekName: wk,
        records: groups[wk].sort((a, b) => b.date.localeCompare(a.date) || b.gameNumber - a.gameNumber),
      }));
  }, [scrimRecords]);

  // Unique opponents for dropdown
  const uniqueOpponents = useMemo(() => {
    const opps = new Set(scrimRecords.map(r => r.opponent));
    return Array.from(opps).sort();
  }, [scrimRecords]);

  // Print Draft Report — opens a new window with printable draft ban/pick report
  const printDraftReport = (opponentName: string) => {
    const filtered = scrimRecords
      .filter(r => r.opponent.toLowerCase() === opponentName.toLowerCase())
      .sort((a, b) => a.date.localeCompare(b.date) || a.gameNumber - b.gameNumber);

    if (filtered.length === 0) {
      alert(`No scrim records found for opponent: ${opponentName}`);
      return;
    }

    const totalWins = filtered.filter(r => r.result === 'W').length;
    const totalLosses = filtered.length - totalWins;
    const winRate = Math.round((totalWins / filtered.length) * 100);

    // Group by week
    const weekMap: Record<string, ScrimRecord[]> = {};
    filtered.forEach(r => {
      const wk = r.week || 'Week 1';
      if (!weekMap[wk]) weekMap[wk] = [];
      weekMap[wk].push(r);
    });
    const weekGroups = Object.keys(weekMap).sort((a, b) => {
      const numA = parseInt(a.replace(/^\D+/g, '')) || 999;
      const numB = parseInt(b.replace(/^\D+/g, '')) || 999;
      return numA - numB;
    });

    const renderHeroCell = (heroName: string) => {
      return `<span style="display:inline-flex;align-items:center;gap:4px;background:#1e1e30;border:1px solid #2a2a3e;border-radius:6px;padding:2px 8px 2px 4px;font-size:11px;color:#e2e8f0;"><span style="width:22px;height:22px;border-radius:50%;background:#0a0a0f;display:inline-flex;align-items:center;justify-content:center;font-size:9px;color:#94a3b8;flex-shrink:0;">${heroName ? heroName.charAt(0) : '?'}</span>${heroName || '—'}</span>`;
    };

    const matchCards = weekGroups.map(weekName => {
      const matches = weekMap[weekName];
      const wWins = matches.filter(r => r.result === 'W').length;
      const wLosses = matches.length - wWins;

      const matchRows = matches.map(m => {
        const ourPicks = [m.expHero, m.jungleHero, m.midHero, m.goldHero, m.roamHero].filter(Boolean);
        const oppPicksList = (m.oppPicks || []).filter(Boolean);
        const teamBansList = (m.teamBans || []).filter(Boolean);
        const oppBansList = (m.oppBans || []).filter(Boolean);

        return `
          <div style="border:1px solid #2a2a3e;border-radius:12px;margin-bottom:14px;overflow:hidden;background:#12121a;page-break-inside:avoid;">
            <!-- Match Header -->
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#0a0a0f;border-bottom:1px solid #2a2a3e;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;font-weight:bold;font-size:14px;${
                  m.result === 'W' 
                    ? 'background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);' 
                    : 'background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);'
                }">${m.result}</span>
                <div>
                  <div style="font-weight:bold;color:#e2e8f0;font-size:13px;">Game ${m.gameNumber}</div>
                  <div style="font-size:10px;color:#94a3b8;">${m.date} • ${m.match || ''} • Patch ${m.patch || ''}</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:12px;">
                <span style="font-size:10px;padding:2px 8px;border-radius:4px;font-weight:bold;text-transform:uppercase;${
                  m.side === 'Blue' 
                    ? 'background:rgba(59,130,246,0.1);color:#3b82f6;border:1px solid rgba(59,130,246,0.2);' 
                    : 'background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2);'
                }">${m.side} Side</span>
                <span style="font-size:13px;font-weight:bold;font-family:'JetBrains Mono',monospace;color:#e2e8f0;">${m.teamKills} - ${m.oppKills}</span>
                <span style="font-size:10px;color:#64748b;">${m.duration}m</span>
              </div>
            </div>
            
            <!-- Draft Grid -->
            <div style="padding:14px 16px;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px;">
                <!-- Our Bans -->
                <div>
                  <div style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:6px;">🚫 Our Bans</div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px;">
                    ${teamBansList.length > 0 
                      ? teamBansList.map(h => `<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:6px;padding:2px 8px;font-size:11px;color:#fca5a5;text-decoration:line-through;"><span style="color:#ef4444;font-weight:bold;font-size:9px;">✕</span>${h}</span>`).join('') 
                      : '<span style="font-size:10px;color:#64748b;font-style:italic;">None</span>'}
                  </div>
                </div>
                <!-- Opponent Bans -->
                <div>
                  <div style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:6px;">🚫 Opponent Bans</div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px;">
                    ${oppBansList.length > 0 
                      ? oppBansList.map(h => `<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:6px;padding:2px 8px;font-size:11px;color:#fca5a5;text-decoration:line-through;"><span style="color:#ef4444;font-weight:bold;font-size:9px;">✕</span>${h}</span>`).join('') 
                      : '<span style="font-size:10px;color:#64748b;font-style:italic;">None</span>'}
                  </div>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding-top:10px;border-top:1px solid #1e1e30;">
                <!-- Our Picks -->
                <div>
                  <div style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#3b82f6;margin-bottom:6px;">🛡️ Our Picks</div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px;">
                    ${ourPicks.length > 0 ? ourPicks.map(h => renderHeroCell(h)).join('') : '<span style="font-size:10px;color:#64748b;">None</span>'}
                  </div>
                  <div style="font-size:9px;color:#64748b;margin-top:5px;">
                    ${[
                      m.expPlayer ? `EXP: ${m.expPlayer}` : '',
                      m.junglePlayer ? `JG: ${m.junglePlayer}` : '',
                      m.midPlayer ? `Mid: ${m.midPlayer}` : '',
                      m.goldPlayer ? `Gold: ${m.goldPlayer}` : '',
                      m.roamPlayer ? `Roam: ${m.roamPlayer}` : '',
                    ].filter(Boolean).join(' • ')}
                  </div>
                </div>
                <!-- Opponent Picks -->
                <div>
                  <div style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#ef4444;margin-bottom:6px;">⚔️ Opponent Picks</div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px;">
                    ${oppPicksList.length > 0 ? oppPicksList.map(h => renderHeroCell(h)).join('') : '<span style="font-size:10px;color:#64748b;">None</span>'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div style="margin-bottom:24px;page-break-inside:avoid;">
          <div style="display:flex;align-items:center;justify-content:space-between;background:#1e1e30;border:1px solid #3a3a52;padding:8px 16px;border-radius:8px;margin-bottom:10px;">
            <span style="font-weight:800;font-size:13px;color:#6366f1;">📅 ${weekName}</span>
            <span style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
              ${matches.length} Game${matches.length > 1 ? 's' : ''} • <span style="color:#22c55e;">${wWins}W</span> - <span style="color:#ef4444;">${wLosses}L</span>
            </span>
          </div>
          ${matchRows}
        </div>
      `;
    }).join('');

    const printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Draft Report — vs ${opponentName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', sans-serif;
            background: #0a0a0f;
            color: #e2e8f0;
            padding: 32px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @media print {
            body { padding: 16px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <!-- Print Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #2a2a3e;padding-bottom:16px;margin-bottom:24px;">
          <div>
            <h1 style="font-family:'Outfit',sans-serif;font-size:24px;font-weight:800;margin-bottom:4px;">
              ⚔️ Draft Scouting Report
            </h1>
            <p style="font-size:13px;color:#94a3b8;">
              vs <span style="color:#6366f1;font-weight:700;">${opponentName}</span> — ${filtered.length} Game${filtered.length > 1 ? 's' : ''} Recorded
            </p>
          </div>
          <div style="text-align:right;">
            <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:bold;">
              <span style="color:#22c55e;">${totalWins}W</span> - <span style="color:#ef4444;">${totalLosses}L</span>
            </div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;">${winRate}% Win Rate</div>
          </div>
        </div>

        <!-- Button (no-print) -->
        <div class="no-print" style="text-align:center;margin-bottom:20px;">
          <button onclick="window.print()" style="background:#6366f1;color:white;border:none;padding:10px 28px;border-radius:8px;font-weight:bold;font-size:13px;cursor:pointer;">
            🖨️ Print / Save as PDF
          </button>
        </div>

        <!-- Match Cards -->
        ${matchCards}

        <!-- Footer -->
        <div style="border-top:1px solid #2a2a3e;padding-top:12px;margin-top:24px;text-align:center;font-size:10px;color:#64748b;">
          Generated by MLBB Draft Analyst • ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold mb-2">
            Scrims & Player <span className="gradient-text">Performance Portal</span>
          </h1>
          <p className="text-text-secondary text-sm">
            Log scrim matches manually, upload spreadsheet data, and review individual player analytics in a single unified dashboard.
          </p>
        </div>
        
        {/* Reset scrims button */}
        {scrimRecords.length > 0 && (
          <Button variant="danger" size="sm" onClick={clearAllScrimData} className="mt-4 md:mt-0 opacity-60 hover:opacity-100">
            ⚠ Clear All Data
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-3 font-heading font-semibold text-sm transition-all duration-200 border-b-2 -mb-[2px] ${
            activeTab === 'overview'
              ? 'border-accent text-white bg-accent/5'
              : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
          }`}
        >
          📊 Overview & Logs
        </button>
        <button
          onClick={() => setActiveTab('log')}
          className={`px-6 py-3 font-heading font-semibold text-sm transition-all duration-200 border-b-2 -mb-[2px] ${
            activeTab === 'log'
              ? 'border-accent text-white bg-accent/5'
              : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
          }`}
        >
          ✍ Log Scrim Game
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-6 py-3 font-heading font-semibold text-sm transition-all duration-200 border-b-2 -mb-[2px] ${
            activeTab === 'import'
              ? 'border-accent text-white bg-accent/5'
              : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
          }`}
        >
          📥 CSV Bulk Importer
        </button>
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
          
          {scrimRecords.length === 0 ? (
            <Card variant="default" className="text-center py-12">
              <span className="text-4xl mb-4 block">📊</span>
              <h3 className="font-heading text-lg font-bold text-text-primary mb-2">No Scrim Records Available</h3>
              <p className="text-text-secondary text-sm max-w-md mx-auto mb-6">
                You haven't recorded any scrim matches yet. You can either log them manually using the entry form or import legacy CSV data.
              </p>
              <div className="flex gap-4 justify-center">
                <Button variant="primary" onClick={() => setActiveTab('log')}>
                  Log Manual Scrim
                </Button>
                <Button variant="secondary" onClick={() => setActiveTab('import')}>
                  Import Excel CSV
                </Button>
              </div>
            </Card>
          ) : (
            <>
              {/* Dashboard Metrics Row */}
              {dashboardMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Overall Win Rate Card */}
                  <Card variant="elevated" className="relative flex items-center justify-between overflow-hidden">
                    <div>
                      <p className="text-text-muted text-[10px] uppercase font-bold tracking-wider mb-1">Overall Scrims</p>
                      <h4 className="text-3xl font-heading font-extrabold text-white">
                        {dashboardMetrics.winRate}%
                      </h4>
                      <p className="text-xs text-text-secondary mt-1">
                        <span className="text-success font-semibold">{dashboardMetrics.wins}W</span> — <span className="text-danger font-semibold">{dashboardMetrics.losses}L</span>
                      </p>
                    </div>
                    {/* Visual Circular Winrate Ring */}
                    <div className="w-16 h-16 relative flex-shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="32" cy="32" r="26" stroke="#222" strokeWidth="6" fill="transparent" />
                        <circle
                          cx="32"
                          cy="32"
                          r="26"
                          stroke="var(--color-success, #22c55e)"
                          strokeWidth="6"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 26}
                          strokeDashoffset={2 * Math.PI * 26 * (1 - dashboardMetrics.winRate / 100)}
                        />
                      </svg>
                      <span className="absolute text-[10px] text-text-secondary font-mono">WR</span>
                    </div>
                  </Card>

                  {/* Side Win Rates Card */}
                  <Card variant="elevated">
                    <p className="text-text-muted text-[10px] uppercase font-bold tracking-wider mb-2">Side Performance</p>
                    <div className="space-y-2 mt-1">
                      {/* Blue side */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-blue-400 font-semibold">Blue Side</span>
                          <span className="text-white font-mono">{dashboardMetrics.blueWinRate}%</span>
                        </div>
                        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full" style={{ width: `${dashboardMetrics.blueWinRate}%` }} />
                        </div>
                      </div>
                      {/* Red side */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-red-400 font-semibold">Red Side</span>
                          <span className="text-white font-mono">{dashboardMetrics.redWinRate}%</span>
                        </div>
                        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                          <div className="bg-red-500 h-full rounded-full" style={{ width: `${dashboardMetrics.redWinRate}%` }} />
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Objective Controls Card */}
                  <Card variant="elevated">
                    <p className="text-text-muted text-[10px] uppercase font-bold tracking-wider mb-2">Objective Control Rate</p>
                    <div className="space-y-2 mt-1">
                      {/* First Turtle */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-text-secondary">1st Turtle Control</span>
                          <span className="text-white font-mono">{dashboardMetrics.turtleRate}%</span>
                        </div>
                        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                          <div className="bg-accent h-full rounded-full" style={{ width: `${dashboardMetrics.turtleRate}%` }} />
                        </div>
                      </div>
                      {/* First Lord */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-text-secondary">1st Lord Control</span>
                          <span className="text-white font-mono">{dashboardMetrics.lordRate}%</span>
                        </div>
                        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                          <div className="bg-accent h-full rounded-full" style={{ width: `${dashboardMetrics.lordRate}%` }} />
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Game Length Card */}
                  <Card variant="elevated" className="flex flex-col justify-between">
                    <div>
                      <p className="text-text-muted text-[10px] uppercase font-bold tracking-wider mb-1">Avg Game Length</p>
                      <h4 className="text-3xl font-heading font-extrabold text-white mt-1">
                        {dashboardMetrics.avgDuration} <span className="text-sm font-normal text-text-secondary">min</span>
                      </h4>
                    </div>
                    <p className="text-[10px] text-text-muted mt-2 font-mono">Based on {dashboardMetrics.total} logged scrims</p>
                  </Card>
                </div>
              )}

              {/* Roster & Hero Performance Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Roster Analytics Table (Left 2 columns) */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="font-heading text-lg font-bold text-white flex items-center gap-2">
                    👥 Team Roster Performance Matrix
                  </h3>
                  <Card variant="default" className="overflow-hidden p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-bg-surface-hover/80 text-text-secondary border-b border-border uppercase tracking-wider font-semibold text-[10px]">
                            <th className="p-3">Player</th>
                            <th className="p-3 text-center">Role</th>
                            <th className="p-3 text-center">Games</th>
                            <th className="p-3 text-center">Win Rate</th>
                            <th className="p-3 text-center">KDA Ratio</th>
                            <th className="p-3 text-center">Avg Gold</th>
                            <th className="p-3 text-center font-mono">DPM Share</th>
                            <th className="p-3 text-center font-mono">Taken</th>
                            <th className="p-3 text-center">Avg KP %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 text-text-primary">
                          {playerPerformanceMatrix.map((p, idx) => (
                            <tr key={idx} className="hover:bg-bg-surface-hover/40 transition-colors duration-150">
                              <td className="p-3 font-semibold text-white">{p.player}</td>
                              <td className="p-3 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  p.role === 'EXP' ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' :
                                  p.role === 'Jungle' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' :
                                  p.role === 'Mid' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' :
                                  p.role === 'Gold' ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30' :
                                  'bg-green-500/15 text-green-400 border border-green-500/30'
                                }`}>
                                  {p.role}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono">{p.games}</td>
                              <td className="p-3 text-center">
                                <span className={`font-bold font-mono ${p.winRate >= 60 ? 'text-success' : p.winRate >= 50 ? 'text-text-primary' : 'text-danger'}`}>
                                  {p.winRate}%
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <div className="font-bold font-mono">{p.kda}</div>
                                <div className="text-[9px] text-text-muted mt-0.5 font-mono">{p.kdaStr}</div>
                              </td>
                              <td className="p-3 text-center font-mono">{p.avgGold.toLocaleString()}</td>
                              <td className="p-3 text-center font-mono text-cyan-400 font-semibold">{p.avgDamage.toLocaleString()}</td>
                              <td className="p-3 text-center font-mono text-red-400/80">{p.avgTaken.toLocaleString()}</td>
                              <td className="p-3 text-center font-semibold font-mono text-accent">{p.avgKp}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>

                {/* Scrim Comfort Pool & Top Heroes (Right 1 column) */}
                <div className="space-y-4">
                  <h3 className="font-heading text-lg font-bold text-white flex items-center gap-2">
                    🔥 Scrim Hero Comfort Pool
                  </h3>
                  <Card variant="default" className="space-y-4">
                    {heroPerformanceMatrix.length === 0 ? (
                      <p className="text-text-muted text-xs text-center py-4">No scrim pick data available yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {heroPerformanceMatrix.map((hero, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-border/20">
                            <div className="flex items-center gap-3">
                              <HeroAvatar name={hero.name} imageUrl={getHeroImageUrl(hero.name)} size="xs" />
                              <div>
                                <h4 className="text-xs font-bold text-white leading-tight">{hero.name}</h4>
                                <p className="text-[10px] text-text-secondary mt-0.5">{hero.picks} picks ({hero.wins} wins)</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`font-mono text-xs font-bold ${hero.winRate >= 60 ? 'text-success' : hero.winRate >= 50 ? 'text-text-primary' : 'text-danger'}`}>
                                {hero.winRate}% WR
                              </span>
                              <div className="w-16 bg-black/40 h-1 rounded-full overflow-hidden mt-1">
                                <div className={`h-full rounded-full ${hero.winRate >= 60 ? 'bg-success' : hero.winRate >= 50 ? 'bg-accent' : 'bg-danger'}`} style={{ width: `${hero.winRate}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              </div>

              {/* Print Draft Report Toolbar */}
              {uniqueOpponents.length > 0 && (
                <Card variant="default" className="mt-8">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-heading text-sm font-bold text-white flex items-center gap-2">
                        🖨️ Print Draft Scouting Report
                      </h3>
                      <p className="text-text-secondary text-[10px] mt-1">
                        Select an opponent to generate a printable draft report with all bans &amp; picks history.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <select
                        value={printOpponent}
                        onChange={(e) => setPrintOpponent(e.target.value)}
                        className="flex-1 sm:flex-none sm:w-48 px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent cursor-pointer"
                      >
                        <option value="">— Select Opponent —</option>
                        {uniqueOpponents.map(opp => {
                          const oppCount = scrimRecords.filter(r => r.opponent === opp).length;
                          const oppWins = scrimRecords.filter(r => r.opponent === opp && r.result === 'W').length;
                          return (
                            <option key={opp} value={opp}>
                              {opp} ({oppCount} games, {oppWins}W-{oppCount - oppWins}L)
                            </option>
                          );
                        })}
                      </select>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!printOpponent}
                        onClick={() => printOpponent && printDraftReport(printOpponent)}
                      >
                        🖨️ Print Report
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Scrim Match History Accordion */}
              <div className="space-y-6 mt-8">
                <h3 className="font-heading text-lg font-bold text-white flex items-center gap-2">
                  ⚔ Scrims Match Log & Draft breakdowns
                </h3>
                
                <div className="space-y-6">
                  {groupedScrims.map((weekGroup) => {
                    const weekWins = weekGroup.records.filter(r => r.result === 'W').length;
                    const weekLosses = weekGroup.records.length - weekWins;
                    const weekWinRate = weekGroup.records.length > 0 ? Math.round((weekWins / weekGroup.records.length) * 100) : 0;

                    return (
                      <div key={weekGroup.weekName} className="space-y-3">
                        {/* Week Group Header Banner */}
                        <div className="flex items-center justify-between bg-bg-surface border border-border/80 px-4 py-2.5 rounded-lg">
                          <span className="font-heading font-extrabold text-sm text-accent flex items-center gap-2">
                            📅 {weekGroup.weekName}
                          </span>
                          <span className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">
                            {weekGroup.records.length} Games • <span className="text-success">{weekWins}W</span> - <span className="text-danger">{weekLosses}L</span> • {weekWinRate}% WR
                          </span>
                        </div>

                        {/* Matches under this week */}
                        <div className="space-y-3 pl-2 border-l border-border/20 ml-2">
                          {weekGroup.records.map((match) => {
                            const isExpanded = expandedMatchId === `${match.id}`;
                            
                            return (
                              <div key={match.id} className="border border-border/40 rounded-xl overflow-hidden bg-bg-surface/60 transition-all duration-200">
                                {/* Summary Header */}
                                <div
                                  onClick={() => setExpandedMatchId(isExpanded ? null : `${match.id}`)}
                                  className="flex flex-col lg:flex-row lg:items-center justify-between p-4 cursor-pointer hover:bg-bg-surface-hover/30 transition-colors duration-200 gap-4"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
                                    {/* Result Indicator */}
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                                      match.result === 'W'
                                        ? 'bg-success/15 text-success border border-success/30'
                                        : 'bg-danger/15 text-danger border border-danger/30'
                                    }`}>
                                      {match.result}
                                    </div>

                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-bold text-white">vs {match.opponent}</h4>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                          match.side === 'Blue' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        }`}>
                                          {match.side}
                                        </span>
                                        <span className="text-[10px] text-text-secondary bg-bg-elevated px-2 py-0.5 rounded">
                                          G{match.gameNumber}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-text-secondary mt-1">
                                        {match.match} • Patch {match.patch} • {match.date}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Draft Heroes Quick View directly on Summary Card */}
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:gap-6 flex-1 justify-center">
                                    {/* Our Picks Stack */}
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] text-text-muted font-bold uppercase w-12 text-right">Our Picks:</span>
                                      <div className="flex -space-x-2">
                                        {[match.expHero, match.jungleHero, match.midHero, match.goldHero, match.roamHero].map((hero, hIdx) => (
                                          <div key={hIdx} className="relative group flex-shrink-0">
                                            <HeroAvatar name={hero} imageUrl={getHeroImageUrl(hero)} size="xs" className="border border-black/50 ring-1 ring-border/30 rounded-full" />
                                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 bg-bg-elevated border border-border text-white text-[9px] rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50 mb-1 shadow-lg">
                                              {hero}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Divider */}
                                    <span className="text-text-muted text-[10px] hidden sm:inline">vs</span>

                                    {/* Opp Picks Stack */}
                                    {match.oppPicks && match.oppPicks.filter(Boolean).length > 0 ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] text-text-muted font-bold uppercase w-12 text-right">Opp Picks:</span>
                                        <div className="flex -space-x-2">
                                          {match.oppPicks.filter(Boolean).map((hero, hIdx) => (
                                            <div key={hIdx} className="relative group flex-shrink-0">
                                              <HeroAvatar name={hero} imageUrl={getHeroImageUrl(hero)} size="xs" className="border border-black/50 ring-1 ring-border/30 rounded-full" />
                                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 bg-bg-elevated border border-border text-white text-[9px] rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50 mb-1 shadow-lg">
                                                {hero}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-text-muted italic">No opp picks logged</span>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between sm:justify-end gap-6 flex-shrink-0">
                                    <div className="text-right">
                                      <p className="text-xs font-mono font-bold text-white">{match.teamKills} - {match.oppKills}</p>
                                      <p className="text-[9px] text-text-secondary mt-0.5">{match.duration} mins duration</p>
                                    </div>

                                    {/* Arrow Indicator */}
                                    <span className="text-text-muted hover:text-white transition-colors duration-200 font-mono text-sm leading-none select-none">
                                      {isExpanded ? '▲' : '▼'}
                                    </span>
                                  </div>
                                </div>

                                {/* Expandable Relational Breakdown */}
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="border-t border-border/20 bg-bg-surface/20"
                                    >
                                      <div className="p-4 space-y-6">
                                        
                                        {/* 5 Roster picks + detailed statistics table */}
                                        <div className="space-y-2">
                                          <h5 className="text-[11px] font-bold uppercase text-text-secondary tracking-wider">Roster Performance Details</h5>
                                          <div className="overflow-x-auto border border-border/30 rounded-lg">
                                            <table className="w-full text-left text-xs border-collapse">
                                              <thead>
                                                <tr className="bg-black/35 text-text-muted border-b border-border/40 font-bold uppercase tracking-wider text-[9px]">
                                                  <th className="p-2">Role</th>
                                                  <th className="p-2">Player</th>
                                                  <th className="p-2">Hero</th>
                                                  <th className="p-2 text-center">K/D/A</th>
                                                  <th className="p-2 text-center">Gold</th>
                                                  <th className="p-2 text-center">DPM (Damage)</th>
                                                  <th className="p-2 text-center">Damage Taken</th>
                                                  <th className="p-2 text-center">Tower Dmg</th>
                                                  <th className="p-2 text-center">KP %</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-border/20 text-text-secondary">
                                                {[
                                                  { role: 'EXP', pName: match.expPlayer, hName: match.expHero },
                                                  { role: 'Jungle', pName: match.junglePlayer, hName: match.jungleHero },
                                                  { role: 'Mid', pName: match.midPlayer, hName: match.midHero },
                                                  { role: 'Gold', pName: match.goldPlayer, hName: match.goldHero },
                                                  { role: 'Roam', pName: match.roamPlayer, hName: match.roamHero },
                                                ].map((slot, sIdx) => {
                                                  const linkedRow = playerStats.find(s => s.scrimRecordId === match.id && s.role === slot.role);
                                                  
                                                  return (
                                                    <tr key={sIdx} className="hover:bg-black/10">
                                                      <td className="p-2">
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                                          slot.role === 'EXP' ? 'bg-orange-500/10 text-orange-400' :
                                                          slot.role === 'Jungle' ? 'bg-purple-500/10 text-purple-400' :
                                                          slot.role === 'Mid' ? 'bg-cyan-500/10 text-cyan-400' :
                                                          slot.role === 'Gold' ? 'bg-yellow-500/10 text-yellow-400' :
                                                          'bg-green-500/10 text-green-400'
                                                        }`}>
                                                          {slot.role}
                                                        </span>
                                                      </td>
                                                      <td className="p-2 font-semibold text-white">{slot.pName || 'N/A'}</td>
                                                      <td className="p-2">
                                                        <div className="flex items-center gap-1.5">
                                                          <HeroAvatar name={slot.hName} imageUrl={getHeroImageUrl(slot.hName)} size="xs" />
                                                          <span className="text-white">{slot.hName || 'N/A'}</span>
                                                        </div>
                                                      </td>
                                                      <td className="p-2 text-center font-mono">
                                                        {linkedRow ? `${linkedRow.kills}/${linkedRow.deaths}/${linkedRow.assists}` : '—'}
                                                      </td>
                                                      <td className="p-2 text-center font-mono">
                                                        {linkedRow ? linkedRow.gold.toLocaleString() : '—'}
                                                      </td>
                                                      <td className="p-2 text-center font-mono text-cyan-400">
                                                        {linkedRow ? linkedRow.heroDamage.toLocaleString() : '—'}
                                                      </td>
                                                      <td className="p-2 text-center font-mono text-red-400/80">
                                                        {linkedRow ? linkedRow.damageTaken.toLocaleString() : '—'}
                                                      </td>
                                                      <td className="p-2 text-center font-mono">
                                                        {linkedRow ? linkedRow.towerDamage.toLocaleString() : '—'}
                                                      </td>
                                                      <td className="p-2 text-center font-semibold font-mono text-accent">
                                                        {linkedRow ? `${linkedRow.killParticipation}%` : '—'}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>

                                        {/* Ban drafting grids */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                          {/* Team Bans */}
                                          <div>
                                            <h5 className="text-[10px] font-bold uppercase text-text-secondary tracking-wider mb-2">Team Bans</h5>
                                            <div className="flex flex-wrap gap-1.5">
                                              {match.teamBans?.map((ban, bIdx) => (
                                                <div key={bIdx} className="flex items-center gap-1 bg-black/30 border border-border/20 px-2 py-1 rounded-md text-[10px] text-white">
                                                  <span className="text-red-500 font-bold">X</span> {ban || 'No Ban'}
                                                </div>
                                              )) || <span className="text-[10px] text-text-muted">None</span>}
                                            </div>
                                          </div>

                                          {/* Opponent Bans */}
                                          <div>
                                            <h5 className="text-[10px] font-bold uppercase text-text-secondary tracking-wider mb-2">Opponent Bans</h5>
                                            <div className="flex flex-wrap gap-1.5">
                                              {match.oppBans?.map((ban, bIdx) => (
                                                <div key={bIdx} className="flex items-center gap-1 bg-black/30 border border-border/20 px-2 py-1 rounded-md text-[10px] text-white">
                                                  <span className="text-red-500 font-bold">X</span> {ban || 'No Ban'}
                                                </div>
                                              )) || <span className="text-[10px] text-text-muted">None</span>}
                                            </div>
                                          </div>

                                          {/* Opponent Picks */}
                                          <div>
                                            <h5 className="text-[10px] font-bold uppercase text-text-secondary tracking-wider mb-2">Opponent Picks</h5>
                                            <div className="flex flex-wrap gap-1.5">
                                              {match.oppPicks?.map((pick, pIdx) => (
                                                <div key={pIdx} className="flex items-center gap-1.5 bg-black/30 border border-border/20 px-2 py-1 rounded-md text-[10px] text-white">
                                                  <HeroAvatar name={pick} imageUrl={getHeroImageUrl(pick)} size="xs" />
                                                  {pick || 'No Pick'}
                                                </div>
                                              )) || <span className="text-[10px] text-text-muted">None</span>}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Scrim metadata objectives + notes */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-border/10">
                                          <div className="flex items-center gap-4 text-xs">
                                            <div>
                                              <span className="text-text-muted">First Turtle:</span>{' '}
                                              <span className={`font-semibold ${match.firstTurtle === 'Yes' ? 'text-success' : 'text-danger'}`}>{match.firstTurtle || 'No'}</span>
                                            </div>
                                            <div>
                                              <span className="text-text-muted">First Lord:</span>{' '}
                                              <span className={`font-semibold ${match.firstLord === 'Yes' ? 'text-success' : 'text-danger'}`}>{match.firstLord || 'No'}</span>
                                            </div>
                                            {match.goldDiff10 !== undefined && (
                                              <div>
                                                <span className="text-text-muted">GDiff@10:</span>{' '}
                                                <span className={`font-mono font-bold ${match.goldDiff10 >= 0 ? 'text-success' : 'text-danger'}`}>{match.goldDiff10.toLocaleString()}</span>
                                              </div>
                                            )}
                                          </div>

                                          {match.notes && (
                                            <div className="md:col-span-2 text-xs text-text-secondary bg-black/25 p-3 rounded-lg border border-border/15">
                                              <span className="font-bold text-white block mb-1">Analyst Notes:</span>
                                              {match.notes}
                                            </div>
                                          )}

                                          {/* Delete Record Button */}
                                          <div className="flex items-center justify-end md:col-span-3">
                                            <button
                                              onClick={() => deleteScrimRecord(match.id!)}
                                              className="text-[10px] text-danger/70 hover:text-danger underline transition-colors cursor-pointer"
                                            >
                                              Delete game record
                                            </button>
                                          </div>
                                        </div>

                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

        </motion.div>
      )}

      {/* TAB CONTENT: LOG SCRIM FORM */}
      {activeTab === 'log' && (
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <Card variant="default">
            <form onSubmit={saveManualScrim} className="space-y-8">
              
              {/* Autofill helpers toolbar */}
              <div className="flex flex-wrap items-center justify-between border-b border-border/50 pb-4 gap-4">
                <div>
                  <h3 className="font-heading text-lg font-bold text-white">Log Manual Scrim Record</h3>
                  <p className="text-text-secondary text-xs mt-0.5">Fill out match metadata and roster player statistics relationally.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" type="button" onClick={autoFillRoster}>
                    📋 Autofill Active Roster
                  </Button>
                  <Button variant="secondary" size="sm" type="button" onClick={autoCalculateKPs}>
                    ⚡ Auto-Calculate KP %
                  </Button>
                </div>
              </div>

              {/* Match Metadata Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Match ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 001, Scrim-0531"
                    value={matchId}
                    onChange={(e) => setMatchId(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Week / Stage *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Week 1, Playoffs"
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Opponent *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. APBR, TNC, EVOS"
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Match Name / Context</label>
                  <input
                    type="text"
                    value={matchName}
                    onChange={(e) => setMatchName(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Patch</label>
                  <input
                    type="text"
                    value={patch}
                    onChange={(e) => setPatch(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Side</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSide('Blue')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        side === 'Blue'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                          : 'bg-bg-elevated text-text-secondary border-border hover:bg-bg-surface-hover'
                      }`}
                    >
                      BLUE SIDE
                    </button>
                    <button
                      type="button"
                      onClick={() => setSide('Red')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        side === 'Red'
                          ? 'bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                          : 'bg-bg-elevated text-text-secondary border-border hover:bg-bg-surface-hover'
                      }`}
                    >
                      RED SIDE
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Game Number</label>
                  <input
                    type="number"
                    min="1"
                    value={gameNumber}
                    onChange={(e) => setGameNumber(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Result</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setResult('W')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        result === 'W'
                          ? 'bg-success/20 text-success border-success/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]'
                          : 'bg-bg-elevated text-text-secondary border-border hover:bg-bg-surface-hover'
                      }`}
                    >
                      WIN (W)
                    </button>
                    <button
                      type="button"
                      onClick={() => setResult('L')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        result === 'L'
                          ? 'bg-danger/20 text-danger border-danger/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                          : 'bg-bg-elevated text-text-secondary border-border hover:bg-bg-surface-hover'
                      }`}
                    >
                      LOSS (L)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Duration (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Team Kills</label>
                  <input
                    type="number"
                    min="0"
                    value={teamKills}
                    onChange={(e) => setTeamKills(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Opponent Kills</label>
                  <input
                    type="number"
                    min="0"
                    value={oppKills}
                    onChange={(e) => setOppKills(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Gold Diff @10 mins</label>
                  <input
                    type="number"
                    placeholder="e.g. 1500, -500"
                    value={goldDiff10}
                    onChange={(e) => setGoldDiff10(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">First Turtle Control</label>
                  <select
                    value={firstTurtle}
                    onChange={(e: any) => setFirstTurtle(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  >
                    <option value="">Unknown / None</option>
                    <option value="Yes">Yes (Our Team)</option>
                    <option value="No">No (Opponent)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">First Lord Control</label>
                  <select
                    value={firstLord}
                    onChange={(e: any) => setFirstLord(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  >
                    <option value="">Unknown / None</option>
                    <option value="Yes">Yes (Our Team)</option>
                    <option value="No">No (Opponent)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Tower Difference</label>
                  <input
                    type="number"
                    placeholder="e.g. 4, -2"
                    value={towerDiff}
                    onChange={(e) => setTowerDiff(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Individual Roster & Performance Stats Form Grid */}
              <div className="space-y-4 pt-4 border-t border-border/30">
                <h4 className="font-heading text-sm font-bold text-white flex items-center gap-2">
                  👥 5-Player Individual Statistics & Picks
                </h4>
                
                <div className="space-y-4">
                  {(['EXP', 'Jungle', 'Mid', 'Gold', 'Roam'] as LanePosition[]).map((role) => (
                    <div key={role} className="p-4 rounded-xl bg-black/25 border border-border/20 grid grid-cols-1 lg:grid-cols-10 gap-3 items-end relative">
                      
                      {/* Role label */}
                      <div className="lg:col-span-1">
                        <span className={`px-2.5 py-1 rounded text-xs font-extrabold block text-center border ${
                          role === 'EXP' ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :
                          role === 'Jungle' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
                          role === 'Mid' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' :
                          role === 'Gold' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' :
                          'bg-green-500/15 text-green-400 border-green-500/30'
                        }`}>
                          {role}
                        </span>
                        {/* Fill single player */}
                        <button
                          type="button"
                          onClick={() => handleAutoPlayerFill(role)}
                          className="text-[9px] text-text-muted hover:text-white mt-1 w-full text-center hover:underline"
                        >
                          Fill Default
                        </button>
                      </div>

                      {/* Player autocomplete input */}
                      <div className="lg:col-span-2 relative">
                        <label className="block text-[9px] font-bold uppercase text-text-secondary mb-1">Player *</label>
                        <input
                          type="text"
                          required
                          placeholder="Player Name"
                          value={rosterStats[role].player}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRosterStats(prev => ({ ...prev, [role]: { ...prev[role], player: val } }));
                            setSearchQuery(val);
                          }}
                          onFocus={() => {
                            setFocusedInput({ role, type: 'player' });
                            setSearchQuery(rosterStats[role].player);
                          }}
                          className="w-full px-2 py-1.5 bg-bg-elevated border border-border rounded-md text-xs text-white focus:outline-none focus:border-accent"
                        />
                      </div>

                      {/* Hero autocomplete input */}
                      <div className="lg:col-span-2 relative">
                        <label className="block text-[9px] font-bold uppercase text-text-secondary mb-1">Hero Played *</label>
                        <input
                          type="text"
                          required
                          placeholder="Select Hero"
                          value={rosterStats[role].hero}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRosterStats(prev => ({ ...prev, [role]: { ...prev[role], hero: val } }));
                            setSearchQuery(val);
                          }}
                          onFocus={() => {
                            setFocusedInput({ role, type: 'hero' });
                            setSearchQuery(rosterStats[role].hero);
                          }}
                          className="w-full px-2 py-1.5 bg-bg-elevated border border-border rounded-md text-xs text-white focus:outline-none focus:border-accent"
                        />
                      </div>

                      {/* K / D / A */}
                      <div className="lg:col-span-1 flex gap-1">
                        <div className="flex-1">
                          <label className="block text-[9px] text-center text-text-secondary mb-1">K</label>
                          <input
                            type="number"
                            min="0"
                            value={rosterStats[role].kills}
                            onChange={(e) => setRosterStats(prev => ({ ...prev, [role]: { ...prev[role], kills: Number(e.target.value) } }))}
                            className="w-full p-1 bg-bg-elevated border border-border rounded-md text-xs text-center font-bold text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[9px] text-center text-text-secondary mb-1">D</label>
                          <input
                            type="number"
                            min="0"
                            value={rosterStats[role].deaths}
                            onChange={(e) => setRosterStats(prev => ({ ...prev, [role]: { ...prev[role], deaths: Number(e.target.value) } }))}
                            className="w-full p-1 bg-bg-elevated border border-border rounded-md text-xs text-center font-bold text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[9px] text-center text-text-secondary mb-1">A</label>
                          <input
                            type="number"
                            min="0"
                            value={rosterStats[role].assists}
                            onChange={(e) => setRosterStats(prev => ({ ...prev, [role]: { ...prev[role], assists: Number(e.target.value) } }))}
                            className="w-full p-1 bg-bg-elevated border border-border rounded-md text-xs text-center font-bold text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Gold */}
                      <div className="lg:col-span-1">
                        <label className="block text-[9px] text-text-secondary mb-1">Gold</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 12000"
                          value={rosterStats[role].gold}
                          onChange={(e) => setRosterStats(prev => ({ ...prev, [role]: { ...prev[role], gold: Number(e.target.value) } }))}
                          className="w-full p-1 bg-bg-elevated border border-border rounded-md text-xs font-mono text-center text-white focus:outline-none"
                        />
                      </div>

                      {/* Damage */}
                      <div className="lg:col-span-1">
                        <label className="block text-[9px] text-text-secondary mb-1">Damage</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 45000"
                          value={rosterStats[role].heroDamage}
                          onChange={(e) => setRosterStats(prev => ({ ...prev, [role]: { ...prev[role], heroDamage: Number(e.target.value) } }))}
                          className="w-full p-1 bg-bg-elevated border border-border rounded-md text-xs font-mono text-center text-cyan-400 focus:outline-none"
                        />
                      </div>

                      {/* Damage Taken */}
                      <div className="lg:col-span-1">
                        <label className="block text-[9px] text-text-secondary mb-1">Taken</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 80000"
                          value={rosterStats[role].damageTaken}
                          onChange={(e) => setRosterStats(prev => ({ ...prev, [role]: { ...prev[role], damageTaken: Number(e.target.value) } }))}
                          className="w-full p-1 bg-bg-elevated border border-border rounded-md text-xs font-mono text-center text-red-400 focus:outline-none"
                        />
                      </div>

                      {/* Tower Dmg */}
                      <div className="lg:col-span-1">
                        <label className="block text-[9px] text-text-secondary mb-1">Tower Dmg</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g. 5000"
                          value={rosterStats[role].towerDamage}
                          onChange={(e) => setRosterStats(prev => ({ ...prev, [role]: { ...prev[role], towerDamage: Number(e.target.value) } }))}
                          className="w-full p-1 bg-bg-elevated border border-border rounded-md text-xs font-mono text-center text-white focus:outline-none"
                        />
                      </div>

                      {/* KP % */}
                      <div className="lg:col-span-1">
                        <label className="block text-[9px] text-text-secondary mb-1">KP %</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={rosterStats[role].kp}
                          onChange={(e) => setRosterStats(prev => ({ ...prev, [role]: { ...prev[role], kp: Number(e.target.value) } }))}
                          className="w-full p-1 bg-bg-elevated border border-border rounded-md text-xs font-mono text-center font-bold text-accent focus:outline-none"
                        />
                      </div>

                    </div>
                  ))}
                </div>
              </div>

              {/* Bans & Picks Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-border/30">
                {/* Team Bans */}
                <div>
                  <h4 className="block text-xs font-bold text-text-secondary uppercase mb-2">Team Bans</h4>
                  <div className="space-y-2">
                    {teamBans.map((ban, idx) => (
                      <div key={idx} className="relative">
                        <input
                          type="text"
                          placeholder={`Ban slot ${idx + 1}`}
                          value={ban}
                          onChange={(e) => {
                            const val = e.target.value;
                            const next = [...teamBans]; next[idx] = val; setTeamBans(next);
                            setSearchQuery(val);
                          }}
                          onFocus={() => {
                            setFocusedInput({ type: 'ban', index: idx });
                            setSearchQuery(ban);
                          }}
                          className="w-full px-3 py-1.5 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Opponent Bans */}
                <div>
                  <h4 className="block text-xs font-bold text-text-secondary uppercase mb-2">Opponent Bans</h4>
                  <div className="space-y-2">
                    {oppBans.map((ban, idx) => (
                      <div key={idx} className="relative">
                        <input
                          type="text"
                          placeholder={`Ban slot ${idx + 1}`}
                          value={ban}
                          onChange={(e) => {
                            const val = e.target.value;
                            const next = [...oppBans]; next[idx] = val; setOppBans(next);
                            setSearchQuery(val);
                          }}
                          onFocus={() => {
                            setFocusedInput({ type: 'oppBan', index: idx });
                            setSearchQuery(ban);
                          }}
                          className="w-full px-3 py-1.5 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Opponent Picks */}
                <div>
                  <h4 className="block text-xs font-bold text-text-secondary uppercase mb-2">Opponent Picks</h4>
                  <div className="space-y-2">
                    {oppPicks.map((pick, idx) => (
                      <div key={idx} className="relative">
                        <input
                          type="text"
                          placeholder={`Pick slot ${idx + 1}`}
                          value={pick}
                          onChange={(e) => {
                            const val = e.target.value;
                            const next = [...oppPicks]; next[idx] = val; setOppPicks(next);
                            setSearchQuery(val);
                          }}
                          onFocus={() => {
                            setFocusedInput({ type: 'oppPick', index: idx });
                            setSearchQuery(pick);
                          }}
                          className="w-full px-3 py-1.5 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Scrim Analyst Notes / Draft Remarks</label>
                <textarea
                  placeholder="Insert notes about draft sequence, laning adjustments, key mistakes, or execution review..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                />
              </div>

              {/* Autocomplete floating overlay */}
              <AnimatePresence>
                {focusedInput && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setFocusedInput(null)}
                    className="fixed inset-0 z-40 bg-black/10"
                  />
                )}
              </AnimatePresence>

              {/* Dropdown overlay panel */}
              {focusedInput && (
                <div
                  className="fixed bg-bg-elevated border border-border/80 rounded-lg shadow-2xl p-2 z-50 overflow-y-auto max-h-48 w-64"
                  style={{
                    top: '30%',
                    left: '50%',
                    transform: 'translate(-50%, -30%)',
                  }}
                >
                  <div className="text-[10px] text-text-muted px-2 pb-1 border-b border-border/40 uppercase tracking-wider font-bold mb-1.5 flex justify-between">
                    <span>Select {focusedInput.type}</span>
                    <button type="button" onClick={() => setFocusedInput(null)} className="text-text-muted hover:text-white font-bold">×</button>
                  </div>
                  {filteredOptions.length === 0 ? (
                    <p className="text-[10px] text-text-secondary p-2 text-center">No options found. Type any custom value directly.</p>
                  ) : (
                    filteredOptions.map((opt, oIdx) => (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => selectAutocompleteValue(opt)}
                        className="w-full text-left px-2 py-1 text-xs hover:bg-bg-surface-hover/80 text-white rounded transition-colors"
                      >
                        {opt}
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-border/20">
                <Button variant="secondary" type="button" onClick={() => setActiveTab('overview')}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  💾 Save Scrim Game & Player Stats
                </Button>
              </div>

            </form>
          </Card>
        </motion.div>
      )}

      {/* TAB CONTENT: BULK CSV IMPORT */}
      {activeTab === 'import' && (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="max-w-2xl mx-auto">
          <Card variant="default" className="space-y-6">
            <div>
              <h3 className="font-heading text-lg font-bold text-white">Bulk Excel CSV Data Importer</h3>
              <p className="text-text-secondary text-xs mt-0.5">
                Bulk upload existing historical records from your spreadsheet using the CSV export format.
              </p>
            </div>

            <form onSubmit={handleCSVImport} className="space-y-6">
              {/* Match details uploader */}
              <div className="border-2 border-dashed border-border rounded-xl p-6 bg-black/10 text-center hover:border-accent transition-colors">
                <span className="text-3xl mb-2 block">📄</span>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">SCRIM MATCH INPUT SHEET *</h4>
                <p className="text-[10px] text-text-secondary mb-3">Upload your parsed `sheet_SCRIM_INPUT.csv` matches metadata file.</p>
                <input
                  type="file"
                  accept=".csv"
                  required
                  onChange={(e) => setScrimFile(e.target.files?.[0] || null)}
                  className="mx-auto block text-[10px] text-text-secondary"
                />
                {scrimFile && (
                  <p className="text-xs text-success font-semibold mt-2">✓ Loaded {scrimFile.name}</p>
                )}
              </div>

              {/* Player details uploader */}
              <div className="border-2 border-dashed border-border rounded-xl p-6 bg-black/10 text-center hover:border-accent transition-colors">
                <span className="text-3xl mb-2 block">📊</span>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">PLAYER INPUT STATS SHEET (Optional)</h4>
                <p className="text-[10px] text-text-secondary mb-3">Upload your parsed `sheet_PLAYER_INPUT_STATS.csv` details file.</p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setStatsFile(e.target.files?.[0] || null)}
                  className="mx-auto block text-[10px] text-text-secondary"
                />
                {statsFile && (
                  <p className="text-xs text-success font-semibold mt-2">✓ Loaded {statsFile.name}</p>
                )}
              </div>

              {/* Status report display */}
              {importStatus.message && (
                <div className={`p-4 rounded-lg text-xs ${
                  importStatus.type === 'success' ? 'bg-success/15 text-success border border-success/30' :
                  importStatus.type === 'error' ? 'bg-danger/15 text-danger border border-danger/30' :
                  'bg-accent/10 text-accent border border-accent/20'
                }`}>
                  {importStatus.message}
                </div>
              )}

              {/* Guidelines / Excel spreadsheet fields warning */}
              <div className="bg-bg-surface-hover/30 border border-border/50 rounded-lg p-3 text-[10px] text-text-secondary leading-relaxed">
                <span className="font-bold text-white block mb-1">💡 CSV Formatting Guidelines:</span>
                - Make sure your files are exported with comma-delimiters and standard text fields.<br />
                - Make sure headers match your Excel spreadsheet columns: `Match ID`, `Date`, `Opponent`, `Side`, `Result`, etc.<br />
                - Uploading only the match sheet will auto-fill player stats with default zero parameters. Uploading both ensures robust average damage shares, taken, and GPM calculations.
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="secondary" type="button" onClick={() => setActiveTab('overview')}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  🚀 Start Importing CSV
                </Button>
              </div>

            </form>
          </Card>
        </motion.div>
      )}

    </div>
  );
}
