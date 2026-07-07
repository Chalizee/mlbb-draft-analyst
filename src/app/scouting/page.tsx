'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import SearchInput from '@/components/ui/SearchInput';
import Tabs from '@/components/ui/Tabs';
import HeroAvatar from '@/components/ui/HeroAvatar';
import Modal from '@/components/ui/Modal';
import RadarChart from '@/components/ui/RadarChart';
import { useHeroStore } from '@/stores/heroStore';
import { db } from '@/lib/db';
import {
  parseCSV,
  processMDLScoutingCSVs,
  syncMDLDataToDB,
  findHeroByName,
  type MDLScoutingData,
  type MDLPlayerScouting,
  type MDLTeamScouting,
  type MDLPlayerHero
} from '@/lib/csvParser';
import type { ScrimRecord } from '@/types';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
};

interface DraftReportEntry {
  matchId: string;
  date?: string;
  opponent?: string;
  side?: string;
  result?: string;
  bans: string[];
  picks: string[];
  oppBans: string[];
  oppPicks: string[];
}

export default function ScoutingPage() {
  const { heroes, loadHeroes } = useHeroStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Raw CSV strings (fallback or manual upload)
  const [playerSummaryCsv, setPlayerSummaryCsv] = useState<string | null>(null);
  const [teamSummaryCsv, setTeamSummaryCsv] = useState<string | null>(null);
  const [teamRosterCsv, setTeamRosterCsv] = useState<string | null>(null);
  const [mostPlayedHeroCsv, setMostPlayedHeroCsv] = useState<string | null>(null);

  // Manual File Upload states
  const [playerFile, setPlayerFile] = useState<File | null>(null);
  const [teamFile, setTeamFile] = useState<File | null>(null);
  const [logsFile, setLogsFile] = useState<File | null>(null);
  const [importerTab, setImporterTab] = useState<'auto' | 'manual'>('auto');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const handleManualParse = async () => {
    if (!playerFile || !teamFile) {
      setError('Please select both Player Summary and Team Summary CSV files.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const playerText = await readFileAsText(playerFile);
      const teamText = await readFileAsText(teamFile);
      const logsText = logsFile ? await readFileAsText(logsFile) : '';

      setPlayerSummaryCsv(playerText);
      setTeamSummaryCsv(teamText);
      setTeamRosterCsv(logsText);
      setMostPlayedHeroCsv('');

      const parsed = processMDLScoutingCSVs(
        playerText,
        teamText,
        logsText,
        '',
        heroes
      );

      setData(parsed);
      
      // Set initial selections
      if (parsed.players.length > 0) setSelectedPlayer(parsed.players[0]);
      if (parsed.teams.length > 0) setSelectedTeam(parsed.teams[0]);
      
      setSuccess(`Successfully parsed scouting database from uploaded files! Loaded ${parsed.players.length} players and ${parsed.teams.length} teams.`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to parse manual CSV uploads. Please verify the file formats.');
    } finally {
      setLoading(false);
    }
  };

  // Parsed MDL Scouting Data
  const [data, setData] = useState<MDLScoutingData | null>(null);
  const [eventName, setEventName] = useState<string>('');
  const [isSynced, setIsSynced] = useState(false);

  // Navigation
  const [activeTab, setActiveTab] = useState('player-dashboard');

  // Search & Selector states
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerRoleFilter, setPlayerRoleFilter] = useState('all');
  const [selectedPlayer, setSelectedPlayer] = useState<MDLPlayerScouting | null>(null);

  const [teamSearch, setTeamSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<MDLTeamScouting | null>(null);
  const [isDraftReportOpen, setIsDraftReportOpen] = useState(false);
  const [draftReportMatches, setDraftReportMatches] = useState<DraftReportEntry[]>([]);
  const [draftReportLoading, setDraftReportLoading] = useState(false);

  const [heroSearch, setHeroSearch] = useState('');
  const [leaderboardRole, setLeaderboardRole] = useState<string>('all');

  useEffect(() => {
    loadHeroes();
  }, [loadHeroes]);

  const normalizeDraftLabel = (value?: string) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const splitDraftItems = (value?: string): string[] => {
    if (!value) return [];
    return value
      .split(/[;,/]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => !['none', 'n/a', 'na'].includes(item.toLowerCase()));
  };

  const fetchDraftReportMatches = useCallback(async (teamName: string) => {
    setDraftReportLoading(true);

    try {
      if (teamSummaryCsv) {
        const rows = parseCSV(teamSummaryCsv);
        if (rows.length >= 2) {
          const headers = rows[0].map((header) => header.trim());
          const teamIdx = headers.findIndex((header) => ['team', 'team name'].includes(header.toLowerCase()));
          const enemyTeamIdx = headers.findIndex((header) => ['enemy team', 'opponent', 'opponent team'].includes(header.toLowerCase()));
          const matchIdIdx = headers.findIndex((header) => ['match id', 'matchid', 'match id#', 'battle code', 'id'].includes(header.toLowerCase()));
          const dateIdx = headers.findIndex((header) => ['date'].includes(header.toLowerCase()));
          const sideIdx = headers.findIndex((header) => ['side'].includes(header.toLowerCase()));
          const resultIdx = headers.findIndex((header) => ['result'].includes(header.toLowerCase()));
          const pickIdx = headers.findIndex((header) => ['pick', 'picks', 'picked heroes', 'picked hero'].includes(header.toLowerCase()));
          const banIdx = headers.findIndex((header) => ['team ban', 'team bans', 'ban', 'bans'].includes(header.toLowerCase()));

          const reportRows = rows.slice(1)
            .map((row) => {
              const matchId = row[matchIdIdx]?.trim() || '';
              if (!matchId) return null;

              const teamNameValue = row[teamIdx]?.trim() || '';
              const enemyTeamValue = row[enemyTeamIdx]?.trim() || '';
              const normalizedTarget = normalizeDraftLabel(teamName);
              const normalizedTeam = normalizeDraftLabel(teamNameValue);
              const normalizedEnemy = normalizeDraftLabel(enemyTeamValue);
              const targetIsTeamSide = normalizedTarget && normalizedTeam === normalizedTarget;
              const targetIsEnemySide = normalizedTarget && normalizedEnemy === normalizedTarget;

              if (!targetIsTeamSide && !targetIsEnemySide) {
                return null;
              }

              const reportedOpponent = targetIsTeamSide ? enemyTeamValue : teamNameValue;
              const selectedTeamSide = targetIsTeamSide ? 'team' : 'enemy';

              const teamBanColumns = headers.reduce<number[]>((acc, header, index) => {
                const normalizedHeader = header.toLowerCase();
                if (normalizedHeader.includes('ban') && !normalizedHeader.includes('opp') && !normalizedHeader.includes('enemy')) {
                  acc.push(index);
                }
                return acc;
              }, []);

              const opponentBanColumns = headers.reduce<number[]>((acc, header, index) => {
                const normalizedHeader = header.toLowerCase();
                if (normalizedHeader.includes('ban') && (normalizedHeader.includes('opp') || normalizedHeader.includes('enemy') || normalizedHeader.includes('other'))) {
                  acc.push(index);
                }
                return acc;
              }, []);

              const teamPickColumns = headers.reduce<number[]>((acc, header, index) => {
                const normalizedHeader = header.toLowerCase();
                if (normalizedHeader.includes('pick') && !normalizedHeader.includes('opp') && !normalizedHeader.includes('enemy')) {
                  acc.push(index);
                }
                return acc;
              }, []);

              const opponentPickColumns = headers.reduce<number[]>((acc, header, index) => {
                const normalizedHeader = header.toLowerCase();
                if (normalizedHeader.includes('pick') && (normalizedHeader.includes('opp') || normalizedHeader.includes('enemy') || normalizedHeader.includes('other'))) {
                  acc.push(index);
                }
                return acc;
              }, []);

              const teamBans = [...new Set(teamBanColumns.flatMap((index) => splitDraftItems(row[index])))]
                .filter((value) => value && value.toLowerCase() !== 'none');
              const opponentBans = [...new Set(opponentBanColumns.flatMap((index) => splitDraftItems(row[index])))]
                .filter((value) => value && value.toLowerCase() !== 'none');
              const teamPicks = [...new Set(teamPickColumns.flatMap((index) => splitDraftItems(row[index])))]
                .filter((value) => value && value.toLowerCase() !== 'none');
              const opponentPicks = [...new Set(opponentPickColumns.flatMap((index) => splitDraftItems(row[index])))]
                .filter((value) => value && value.toLowerCase() !== 'none');

              const resolvedBans = selectedTeamSide === 'team' ? teamBans : opponentBans;
              const resolvedOppBans = selectedTeamSide === 'team' ? opponentBans : teamBans;
              const resolvedPicks = selectedTeamSide === 'team' ? teamPicks : opponentPicks;
              const resolvedOppPicks = selectedTeamSide === 'team' ? opponentPicks : teamPicks;

              return {
                matchId,
                date: row[dateIdx]?.trim(),
                opponent: reportedOpponent || undefined,
                side: row[sideIdx]?.trim(),
                result: row[resultIdx]?.trim(),
                bans: resolvedBans.length > 0 ? resolvedBans : splitDraftItems(row[banIdx]),
                oppBans: resolvedOppBans,
                picks: resolvedPicks.length > 0 ? resolvedPicks : splitDraftItems(row[pickIdx]),
                oppPicks: resolvedOppPicks,
              } as DraftReportEntry;
            })
            .filter((row): row is DraftReportEntry => Boolean(row));

          if (reportRows.length > 0) {
            reportRows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            setDraftReportMatches(reportRows);
            setDraftReportLoading(false);
            return;
          }
        }
      }

      if (typeof window !== 'undefined' && 'indexedDB' in window) {
        const records = (await db.table('scrimRecords').toArray()) as ScrimRecord[];
        const targetKey = normalizeDraftLabel(teamName);
        const reportRows = records
          .filter((record) => {
            const opponentKey = normalizeDraftLabel(record.opponent);
            const matchKey = normalizeDraftLabel(record.match);
            const matchIdKey = normalizeDraftLabel(record.matchId);
            return !targetKey || opponentKey === targetKey || matchKey.includes(targetKey) || opponentKey.includes(targetKey) || matchIdKey.includes(targetKey);
          })
          .map((record) => ({
            matchId: record.matchId || record.match || 'Match',
            date: record.date,
            opponent: record.opponent,
            side: record.side,
            result: record.result,
            bans: (record.teamBans || []).filter(Boolean),
            oppBans: (record.oppBans || []).filter(Boolean),
            picks: [record.expHero, record.jungleHero, record.midHero, record.goldHero, record.roamHero].filter(Boolean),
            oppPicks: (record.oppPicks || []).filter(Boolean),
          }))
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        setDraftReportMatches(reportRows);
      } else {
        setDraftReportMatches([]);
      }
    } catch (err) {
      console.error(err);
      setDraftReportMatches([]);
    } finally {
      setDraftReportLoading(false);
    }
  }, [teamSummaryCsv]);

  useEffect(() => {
    if (isDraftReportOpen) {
      void fetchDraftReportMatches(selectedTeam?.name || '');
    }
  }, [selectedTeam, isDraftReportOpen, fetchDraftReportMatches]);

  const getHeroImageUrl = (name: string, id?: number) => {
    if (!name) return undefined;
    
    // First try to find by exact ID if available
    if (id !== undefined) {
      const byId = heroes.find(h => h.id === id);
      if (byId) return byId.imageUrl;
    }
    
    // Fall back to robust matching logic used by the parser
    const matched = findHeroByName(name, heroes);
    return matched?.imageUrl;
  };

  const renderHeroPickIcon = (heroName: string, key: string) => {
    const imageUrl = getHeroImageUrl(heroName);
    return (
      <div key={key} className="flex flex-col items-center gap-2 min-w-[48px]">
        <HeroAvatar
          imageUrl={imageUrl}
          name={heroName}
          size="sm"
          className="border border-border/40 bg-bg-surface"
        />
        <span className="text-[10px] text-center text-text-secondary leading-tight break-words max-w-[72px]">{heroName}</span>
      </div>
    );
  };

  // Open a compact, print-optimized window for draft report (compact layout)
  const printDraftReport = () => {
    if (typeof window === 'undefined') return;
    const preview = document.getElementById('draft-report-preview');
    if (!preview) {
      alert('Preview not found — please open the Draft Report modal first.');
      return;
    }

    // Clone preview and inline computed styles so printed output matches exactly
    const clone = preview.cloneNode(true) as HTMLElement;
    const origElems = Array.from(preview.querySelectorAll<HTMLElement>('*'));
    const cloneElems = Array.from(clone.querySelectorAll<HTMLElement>('*'));
    for (let i = 0; i < origElems.length; i++) {
      const o = origElems[i];
      const c = cloneElems[i];
      if (!c) continue;
      try {
        const cs = window.getComputedStyle(o);
        let cssText = '';
        for (let j = 0; j < cs.length; j++) {
          const prop = cs[j];
          cssText += `${prop}:${cs.getPropertyValue(prop)};`;
        }
        c.setAttribute('style', cssText);
      } catch (e) {
        // ignore computed style errors for some elements
      }
    }

    // Remove scrolling/max-height constraints in the clone so all content is visible for printing
    clone.classList.add('print-expanded');
    const cloneAll = Array.from(clone.querySelectorAll<HTMLElement>('*')) as HTMLElement[];
    cloneAll.forEach((c) => {
      try {
        c.style.overflow = 'visible';
        c.style.overflowY = 'visible';
        c.style.overflowX = 'visible';
        c.style.maxHeight = 'none';
        c.style.height = 'auto';
      } catch (e) {
        // ignore
      }
    });

    // Remove class attributes from cloned nodes so tailwind max-height/overflow classes don't reapply
    try {
      clone.removeAttribute('class');
      cloneAll.forEach((c) => c.removeAttribute('class'));
    } catch (e) {
      // ignore
    }

    // Also inline root computed styles for body/font fallback
    const docStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join('\n');

    // Preserve root/body classes (e.g., Tailwind's dark mode) and body background/font styles
    const rootClass = document.documentElement.className || '';
    const bodyClass = document.body.className || '';
    let bodyInline = '';
    try {
      const bcs = window.getComputedStyle(document.body);
      const props = ['background-color', 'color', 'font-family', 'font-size', 'line-height'];
      bodyInline = props.map(p => `${p}: ${bcs.getPropertyValue(p)};`).join(' ');
    } catch (e) {
      bodyInline = '';
    }

    const printScript = `
      function waitImagesAndPrint(){
        const imgs = Array.from(document.images);
        if(imgs.length===0){ window.print(); return; }
        let loaded = 0; const total = imgs.length;
        const check = ()=>{ loaded++; if(loaded>=total) window.print(); };
        imgs.forEach(img=>{ if(img.complete) check(); else { img.addEventListener('load', check); img.addEventListener('error', check); } });
        setTimeout(()=>{ if(loaded<total) window.print(); }, 1500);
      }
      window.onload = function(){ setTimeout(waitImagesAndPrint, 50); };
    `;

    const extraPrintCss = `<style>@media print{ .print-expanded *{max-height:none !important; overflow:visible !important;} .wrap{display:block;} .match-row{page-break-inside:auto;break-inside:auto;} }</style>`;

    const html = `<!doctype html><html class="${rootClass}"><head><meta charset="utf-8"/><title>Draft Report</title>${docStyles}${extraPrintCss}<style>@media print{@page{margin:12mm}}</style></head><body class="${bodyClass}" style="${bodyInline}">${clone.outerHTML}<script>${printScript}</script></body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    } else {
      alert('Unable to open print window. Please allow popups for this site.');
    }
  };

  // Fetch MDL ID S12 dynamic Google sheet data
  const handleFetchLiveGoogleData = useCallback(async () => {
    Promise.resolve().then(() => {
      setLoading(true);
      setError(null);
    });
    try {
      let res: any = null;

      try {
        const response = await fetch('/api/scouting/import?source=google');
        res = await response.json().catch(() => null);
      } catch (networkErr) {
        console.warn('[Scouting] Network error reaching API:', networkErr);
      }

      if (res && res.success) {
        // Show a soft notice if the data source was empty (no Google, no local files)
        if (res.source === 'empty') {
          Promise.resolve().then(() => {
            setError(res.notice || 'No data source available. Please upload CSV files manually using the buttons below.');
            setLoading(false);
          });
          return;
        }

        const parsed = processMDLScoutingCSVs(
          res.playerSummaryCsv || '',
          res.teamSummaryCsv || '',
          res.teamRosterCsv || '',
          res.mostPlayedHeroCsv || '',
          heroes
        );
        Promise.resolve().then(() => {
          setData(parsed);
          // Seed initial selection
          if (parsed.players.length > 0) setSelectedPlayer(parsed.players[0]);
          if (parsed.teams.length > 0) setSelectedTeam(parsed.teams[0]);
          if (res.source === 'google') {
            setSuccess('Loaded live scouting CSV data successfully!');
          } else {
            setSuccess(`Loaded from ${res.source === 'local-fallback' || res.source === 'local-playoff-priority' ? 'local CSV files' : 'local data'}.`);
          }
        });
      } else {
        // API returned success:false or res is null — soft error, no crash
        const msg = res?.error || res?.message || 'Could not load scouting data. Please upload CSV files manually.';
        Promise.resolve().then(() => {
          setError(msg);
        });
      }
    } catch (err) {
      console.error('[Scouting] Unexpected error:', err);
      Promise.resolve().then(() => {
        setError('Could not load scouting data. Please upload CSV files manually using the buttons below.');
      });
    } finally {
      Promise.resolve().then(() => {
        setLoading(false);
      });
    }
  }, [heroes]);

  // Auto-Fetch live Google Sheets data on mount
  useEffect(() => {
    if (heroes.length > 0 && !data) {
      handleFetchLiveGoogleData();
    }
  }, [heroes, data, handleFetchLiveGoogleData]);

  // Local auto-detector from Downloads folder
  const handleAutoDetectLocal = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/scouting/import?source=local');
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Expected MDL CSVs not found in local Downloads folder.');
      }
      const res = await response.json();
      if (res.success) {
        setPlayerSummaryCsv(res.playerSummaryCsv);
        setTeamSummaryCsv(res.teamSummaryCsv);
        setTeamRosterCsv(res.teamRosterCsv);
        setMostPlayedHeroCsv(res.mostPlayedHeroCsv);

        const parsed = processMDLScoutingCSVs(
          res.playerSummaryCsv,
          res.teamSummaryCsv,
          res.teamRosterCsv,
          res.mostPlayedHeroCsv,
          heroes
        );
        setData(parsed);

        if (parsed.players.length > 0) setSelectedPlayer(parsed.players[0]);
        if (parsed.teams.length > 0) setSelectedTeam(parsed.teams[0]);

        setSuccess('Auto-detected and parsed local scouting CSV sheets from Downloads!');
      } else {
        throw new Error(res.error || 'Local auto-detect failed.');
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Local files not found.');
    } finally {
      setLoading(false);
    }
  };

  // Sync scouting aggregates directly to Dexie DB
  const handleSyncToDB = async () => {
    if (!data) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await syncMDLDataToDB(data);
      setIsSynced(true);
      setSuccess(
        `Database synced successfully! Added ${result.syncedOpponents} Turkish teams, ${result.syncedPlayers} pro rosters, and ${result.syncedStats} player-hero confidence metrics into Draft Analyst IndexedDB.`
      );
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Dexie sync failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPlayerSummaryCsv(null);
    setTeamSummaryCsv(null);
    setTeamRosterCsv(null);
    setMostPlayedHeroCsv(null);
    setData(null);
    setIsSynced(false);
    setError(null);
    setSuccess(null);
    setSelectedPlayer(null);
    setSelectedTeam(null);
  };

  // ────────────────────────────────────────────────
  // UI Tab Panels
  // ────────────────────────────────────────────────

  // Tab 1: Circular Progress Gauge for scores
  const renderScoreGauge = (score: number, title: string) => {
    const radius = 32;
    const stroke = 6;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <div className="flex items-center gap-4 bg-bg-surface border border-border p-4 rounded-xl shadow-md">
        <div className="relative flex items-center justify-center">
          <svg className="transform -rotate-90 w-20 h-20">
            {/* Background track */}
            <circle
              stroke="var(--color-border)"
              fill="transparent"
              strokeWidth={stroke}
              r={normalizedRadius}
              cx={radius + stroke}
              cy={radius + stroke}
            />
            {/* Progress layer */}
            <circle
              className="transition-all duration-500 ease-out"
              stroke="currentColor"
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset }}
              r={normalizedRadius}
              cx={radius + stroke}
              cy={radius + stroke}
            />
          </svg>
          <div className="absolute font-heading font-extrabold text-lg text-text-primary">
            {score.toFixed(1)}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase font-mono text-text-muted tracking-wider">{title}</p>
          <h4 className="font-heading font-extrabold text-sm text-text-primary mt-0.5">Scouting Rating</h4>
        </div>
      </div>
    );
  };

  // Modern Progress Bar component for radar attributes
  const renderAttributeBar = (label: string, value: number, max = 100, color = 'bg-accent') => {
    const percent = Math.min((value / max) * 100, 100);
    return (
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-text-secondary">{label}</span>
          <span className="font-mono text-text-primary font-bold">{value.toFixed(1)}</span>
        </div>
        <div className="h-2 bg-bg-elevated rounded-full overflow-hidden border border-border/50">
          <div
            className={`h-full ${color} rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  };

  // Render comparative side wins horizontal slider
  const renderSideComparisonSlider = (blueWR: number, redWR: number, blueMat: number, redMat: number) => {
    return (
      <div className="space-y-3 p-4 bg-bg-surface border border-border rounded-xl">
        <div className="flex justify-between font-heading font-bold text-xs uppercase tracking-wider text-text-muted">
          <span>Blue Side WR</span>
          <span>Red Side WR</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-heading font-extrabold text-sm text-blue-side">{blueWR.toFixed(1)}%</span>
          <div className="flex-1 h-3 bg-bg-elevated rounded-full overflow-hidden flex border border-border">
            <div
              className="h-full bg-blue-side rounded-l-full transition-all duration-500"
              style={{ width: `${blueWR / (blueWR + redWR || 1) * 100}%` }}
            />
            <div
              className="h-full bg-red-side rounded-r-full transition-all duration-500"
              style={{ width: `${redWR / (blueWR + redWR || 1) * 100}%` }}
            />
          </div>
          <span className="font-heading font-extrabold text-sm text-red-side">{redWR.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between text-[10px] text-text-muted font-mono">
          <span>{blueMat} Matches</span>
          <span>{redMat} Matches</span>
        </div>
      </div>
    );
  };

  // Render the Importer fallback if offline / no data
  const renderImporterView = () => (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <Card variant="elevated" className="overflow-hidden relative max-w-2xl mx-auto border-accent/20">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-blue-side to-red-side" />
        <div className="p-6 text-center space-y-6">
          <div className="space-y-2 mb-4">
            <h2 className="font-heading text-2xl font-bold text-text-primary">Connect Scouting Database</h2>
            <p className="text-text-secondary text-sm max-w-md mx-auto">
              Import, sync, or manually upload custom regional CSV sheets to analyze player hero pools, macro scores, and stage splits.
            </p>
          </div>

          {/* Connection tabs */}
          <div className="flex gap-2 p-1 bg-bg-surface-hover border border-border/60 rounded-xl max-w-sm mx-auto mb-6">
            <button
              onClick={() => setImporterTab('auto')}
              className={`flex-1 py-2 text-xs font-heading font-extrabold rounded-lg transition-all cursor-pointer ${
                importerTab === 'auto'
                  ? 'bg-accent text-white shadow-md glow-accent/20'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              ⚡ Local & Live Sync
            </button>
            <button
              onClick={() => setImporterTab('manual')}
              className={`flex-1 py-2 text-xs font-heading font-extrabold rounded-lg transition-all cursor-pointer ${
                importerTab === 'manual'
                  ? 'bg-accent text-white shadow-md glow-accent/20'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              📁 Manual CSV Uploads
            </button>
          </div>

          {importerTab === 'auto' ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 max-w-sm mx-auto">
                <Button
                  variant="primary"
                  onClick={handleFetchLiveGoogleData}
                  disabled={loading}
                  className="h-12 w-full flex items-center justify-center gap-2 glow-accent shadow-lg text-white font-bold"
                >
                  {loading ? 'Initializing Connection...' : '⚡ Fetch MPL TR Live Data'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleAutoDetectLocal}
                  disabled={loading}
                  className="h-11 w-full flex items-center justify-center gap-2 font-semibold"
                >
                  📥 Check Local Downloads folder
                </Button>
              </div>

              <div className="text-[10px] text-text-muted leading-relaxed font-mono">
                Downloads path: C:\Users\wahid\Downloads\<br />
                Required: MPL TR PLAYER.csv & MPL TR TEAM.csv
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-left max-w-md mx-auto">
              {/* Player CSV Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-heading font-bold text-text-secondary">Player Summary CSV (Required)</label>
                <div className="relative group border border-dashed border-border hover:border-accent/40 rounded-xl p-4 bg-bg-surface-hover/30 hover:bg-bg-surface-hover/60 transition-all flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">👤</span>
                    <div className="text-left">
                      <p className="text-xs font-bold text-text-primary">
                        {playerFile ? playerFile.name : 'Select player summary sheet...'}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {playerFile ? `${(playerFile.size / 1024).toFixed(1)} KB` : 'Format: Player, Player No., Games Played...'}
                      </p>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setPlayerFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {playerFile && <span className="text-success text-xs font-bold font-mono">✓</span>}
                </div>
              </div>

              {/* Team CSV Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-heading font-bold text-text-secondary">Team Summary CSV (Required)</label>
                <div className="relative group border border-dashed border-border hover:border-accent/40 rounded-xl p-4 bg-bg-surface-hover/30 hover:bg-bg-surface-hover/60 transition-all flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🛡️</span>
                    <div className="text-left">
                      <p className="text-xs font-bold text-text-primary">
                        {teamFile ? teamFile.name : 'Select team summary sheet...'}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {teamFile ? `${(teamFile.size / 1024).toFixed(1)} KB` : 'Format: Team, Games Played, Win Ratio%...'}
                      </p>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setTeamFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {teamFile && <span className="text-success text-xs font-bold font-mono">✓</span>}
                </div>
              </div>

              {/* Raw Logs CSV Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-heading font-bold text-text-secondary">Raw Match Logs CSV (Optional - highly recommended for hero pools!)</label>
                <div className="relative group border border-dashed border-border hover:border-accent/40 rounded-xl p-4 bg-bg-surface-hover/30 hover:bg-bg-surface-hover/60 transition-all flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📊</span>
                    <div className="text-left">
                      <p className="text-xs font-bold text-text-primary">
                        {logsFile ? logsFile.name : 'Select raw match log sheet...'}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {logsFile ? `${(logsFile.size / 1024).toFixed(1)} KB` : 'Format: Battle Code, Map, Stage, Player, Hero...'}
                      </p>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setLogsFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {logsFile && <span className="text-success text-xs font-bold font-mono">✓</span>}
                </div>
              </div>

              {/* Process button */}
              <Button
                variant="primary"
                onClick={handleManualParse}
                disabled={loading || !playerFile || !teamFile}
                className="h-12 w-full flex items-center justify-center gap-2 glow-accent shadow-lg text-white mt-6 font-bold"
              >
                {loading ? 'Processing Database...' : '⚡ Process & Scout Region'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );

  // Tab 1: Render Player Hub View
  const renderPlayerTab = () => {
    if (!data) return null;

    // Filter players
    const filteredPlayers = data.players.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(playerSearch.toLowerCase()) || p.team.toLowerCase().includes(playerSearch.toLowerCase());
      const matchRole = playerRoleFilter === 'all' || p.role.toLowerCase() === playerRoleFilter.toLowerCase();
      return matchSearch && matchRole;
    });

    const lanes = [
      { id: 'all', label: 'All Lanes' },
      { id: 'exp', label: 'EXP' },
      { id: 'jungle', label: 'Jungle' },
      { id: 'mid', label: 'Mid' },
      { id: 'gold', label: 'Gold' },
      { id: 'roam', label: 'Roam' }
    ];

    const getRoleColor = (roleStr: string): 'Tank' | 'Fighter' | 'Assassin' | 'Mage' | 'Marksman' | 'Support' => {
      const r = roleStr.toUpperCase();
      if (r === 'JUNGLE') return 'Assassin';
      if (r === 'MID') return 'Mage';
      if (r === 'ROAM') return 'Tank';
      if (r === 'EXP') return 'Fighter';
      return 'Marksman';
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left selector panel */}
        <Card variant="default" className="lg:col-span-1 max-h-[700px] overflow-y-auto pr-2 flex flex-col border-border/60">
          <SearchInput
            placeholder="Search player or team..."
            value={playerSearch}
            onChange={setPlayerSearch}
            className="mb-3"
          />
          {/* Lane recommendation filtering pills */}
          <div className="flex flex-wrap gap-1 mb-3 pb-2 border-b border-border/40">
            {lanes.map((l) => (
              <button
                key={l.id}
                onClick={() => setPlayerRoleFilter(l.id)}
                className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md transition-all cursor-pointer
                  ${playerRoleFilter === l.id ? 'bg-accent/20 border border-accent text-white' : 'bg-bg-elevated border border-border text-text-muted hover:text-text-secondary'}
                `}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5 overflow-y-auto flex-1 scrollbar-thin">
            {filteredPlayers.map((p) => (
              <button
                key={`${p.name}@${p.team}`}
                onClick={() => setSelectedPlayer(p)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer group
                  ${
                    selectedPlayer?.name === p.name && selectedPlayer?.team === p.team
                      ? 'bg-accent/15 border-accent text-white font-bold shadow-sm shadow-accent/5'
                      : 'bg-bg-surface border-border/50 text-text-secondary hover:text-text-primary hover:border-border-bright hover:bg-bg-surface-hover/50'
                  }
                `}
              >
                <div>
                  <h4 className="font-heading font-extrabold text-sm group-hover:text-white transition-colors">{p.name}</h4>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-mono mt-0.5">{p.team} — {p.role}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-heading font-extrabold text-accent">{p.scoutingScore.toFixed(1)}</p>
                  <p className="text-[9px] text-text-muted font-mono">{p.winRate.toFixed(1)}% WR</p>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Right Details Panel */}
        <div className="lg:col-span-3">
          {selectedPlayer ? (
            <motion.div initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              {/* Back to Team & Teammates Quick Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1.5 pb-2 border-b border-border/20">
                <button
                  onClick={() => {
                    const matchedTeam = data?.teams.find(t => t.name.toLowerCase() === selectedPlayer.team.toLowerCase());
                    if (matchedTeam) {
                      setSelectedTeam(matchedTeam);
                      setActiveTab('team-dashboard');
                    }
                  }}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary hover:text-white transition-all cursor-pointer bg-bg-surface border border-border hover:border-accent/40 px-3 py-1.5 rounded-lg shadow-sm"
                >
                  ⬅ Back to {selectedPlayer.team} Team
                </button>
                
                {data && (
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                    <span className="text-[10px] font-mono text-text-muted mr-1 select-none">Quick Roster Switcher:</span>
                    {data.players
                      .filter(p => p.team.toLowerCase() === selectedPlayer.team.toLowerCase())
                      .map(p => (
                        <button
                          key={p.name}
                          onClick={() => setSelectedPlayer(p)}
                          className={`px-2.5 py-1 text-[10px] font-heading font-extrabold rounded-md transition-all cursor-pointer border
                            ${p.name === selectedPlayer.name
                              ? 'bg-accent/15 border-accent text-accent'
                              : 'bg-bg-surface border-border text-text-muted hover:text-text-secondary hover:border-border-bright'}`}
                        >
                          {p.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Header profile card */}
              <Card variant="elevated" className="relative overflow-hidden border-border/80 bg-bg-surface/90">
                <div className="absolute top-0 bottom-0 left-0 w-2.5 bg-gradient-to-b from-accent to-blue-side" />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent/20 to-blue-side/20 border border-accent/40 flex items-center justify-center font-heading font-extrabold text-2xl text-accent shadow-inner">
                      {selectedPlayer.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-heading font-black text-2xl text-text-primary tracking-tight">{selectedPlayer.name}</h2>
                        
                        {/* Interactive Role Selector Dropdown */}
                        <div className="relative inline-block">
                          <select
                            value={selectedPlayer.role.toUpperCase()}
                            onChange={(e) => {
                              const newRole = e.target.value;
                              setSelectedPlayer({
                                ...selectedPlayer,
                                role: newRole
                              });
                              if (data) {
                                const updatedPlayers = data.players.map(p => 
                                  p.name === selectedPlayer.name && p.team === selectedPlayer.team
                                    ? { ...p, role: newRole }
                                    : p
                                );
                                setData({
                                  ...data,
                                  players: updatedPlayers
                                });
                              }
                            }}
                            className="bg-bg-elevated border border-border hover:border-accent/40 text-[10px] text-accent font-mono uppercase tracking-wider px-2.5 py-1 rounded-full focus:outline-none focus:border-accent cursor-pointer transition-all hover:bg-bg-surface-hover/80"
                          >
                            <option value="EXP">EXP Lane</option>
                            <option value="JUNGLE">Jungle</option>
                            <option value="MID">Mid Lane</option>
                            <option value="GOLD">Gold Lane</option>
                            <option value="ROAM">Roam</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary flex-wrap">
                        <span className="font-semibold text-white">{selectedPlayer.team}</span>
                        <span className="text-text-muted">•</span>
                        <span className="bg-bg-elevated border border-border px-2 py-0.5 rounded-full text-[10px] text-accent font-medium">{selectedPlayer.playstyleTag}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="text-center bg-bg-surface px-4 py-2 rounded-xl border border-border">
                      <p className="text-[9px] text-text-muted font-mono uppercase tracking-wider">Record</p>
                      <p className="text-sm font-extrabold font-heading text-text-primary">{selectedPlayer.wins}W - {selectedPlayer.matches - selectedPlayer.wins}L</p>
                    </div>
                    <div className="text-center bg-accent/10 px-4 py-2 rounded-xl border border-accent/30">
                      <p className="text-[9px] text-accent font-mono uppercase tracking-wider">Win Rate</p>
                      <p className="text-sm font-extrabold font-heading text-accent">{selectedPlayer.winRate.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Attributes vs Splits Column */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Visual Attributes Radar Chart */}
                <Card variant="default" className="flex flex-col items-center justify-center space-y-4">
                  <h3 className="font-heading font-extrabold text-base text-text-primary tracking-tight w-full text-left">Scouting Shape (6 Attributes)</h3>
                  <RadarChart data={selectedPlayer.attributes} size={320} />
                </Card>

                {/* Score and Splits */}
                <div className="space-y-6">
                  {renderScoreGauge(selectedPlayer.scoutingScore, 'Overall Score')}
                  
                  {renderSideComparisonSlider(selectedPlayer.blueWR, selectedPlayer.redWR, selectedPlayer.blueMatches, selectedPlayer.redMatches)}

                  {/* Stage Splits */}
                  <Card variant="default" className="space-y-4">
                    <h3 className="font-heading font-extrabold text-sm text-text-primary">Event Stage Splits</h3>
                    <div className="space-y-3">
                      {/* Group Stage */}
                      <div className="flex justify-between items-center bg-bg-surface/50 border border-border/40 p-3 rounded-lg text-xs">
                        <div>
                          <p className="font-bold text-text-primary">Group Stage</p>
                          <p className="text-[10px] text-text-muted font-mono mt-0.5">{selectedPlayer.groupStage.matches} Matches</p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-text-secondary">{selectedPlayer.groupStage.wr.toFixed(1)}% WR</p>
                          <p className="text-[9px] text-text-muted font-mono">{selectedPlayer.groupStage.wins} Wins</p>
                        </div>
                      </div>

                      {/* Progressive Round */}
                      <div className="flex justify-between items-center bg-bg-surface/50 border border-border/40 p-3 rounded-lg text-xs">
                        <div>
                          <p className="font-bold text-text-primary">Progressive Round</p>
                          <p className="text-[10px] text-text-muted font-mono mt-0.5">{selectedPlayer.progressiveRound.matches} Matches</p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-text-secondary">{selectedPlayer.progressiveRound.wr.toFixed(1)}% WR</p>
                          <p className="text-[9px] text-text-muted font-mono">{selectedPlayer.progressiveRound.wins} Wins</p>
                        </div>
                      </div>

                      {/* Playoffs */}
                      <div className="flex justify-between items-center bg-bg-surface/50 border border-border/40 p-3 rounded-lg text-xs">
                        <div>
                          <p className="font-bold text-text-primary">Playoffs</p>
                          <p className="text-[10px] text-text-muted font-mono mt-0.5">{selectedPlayer.playoffs.matches} Matches</p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-text-secondary">{selectedPlayer.playoffs.wr.toFixed(1)}% WR</p>
                          <p className="text-[9px] text-text-muted font-mono">{selectedPlayer.playoffs.wins} Wins</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Dota-style Versatility Analysis Dashboard */}
              {selectedPlayer.versatilityDetails && (
                <Card variant="default" className="space-y-5 border-border bg-bg-surface/85 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 font-mono text-[9px] text-text-muted bg-bg-elevated rounded-bl-xl border-l border-b border-border">
                    ANALYST-GRADE RATING
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🏆</span>
                      <h3 className="font-heading font-extrabold text-base text-text-primary tracking-tight">Hero Versatility Breakdown (Dota-Style)</h3>
                    </div>
                    <p className="text-text-muted text-[11px]">
                      A highly multi-dimensional performance assessment based on playstyle spread, role flexing, stability, and meta viability.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    {/* 5-bar breakdown */}
                    <div className="md:col-span-3 space-y-3.5 pr-0 md:pr-6 border-r-0 md:border-r border-border/40">
                      {/* 1. Breadth */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-text-secondary font-medium">1. Pool Breadth (Valid Heroes: {selectedPlayer.versatilityDetails.validPoolSize})</span>
                          <span className="font-mono text-accent font-bold">{selectedPlayer.versatilityDetails.breadthScore}</span>
                        </div>
                        <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden border border-border/30">
                          <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${selectedPlayer.versatilityDetails.breadthScore}%` }} />
                        </div>
                      </div>

                      {/* 2. Archetype */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-text-secondary font-medium">2. Archetype Diversity ({selectedPlayer.versatilityDetails.distinctArchetypes} Playstyles)</span>
                          <span className="font-mono text-yellow-500 font-bold">{selectedPlayer.versatilityDetails.archetypeScore}</span>
                        </div>
                        <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden border border-border/30">
                          <div className="h-full bg-yellow-500 rounded-full transition-all duration-500" style={{ width: `${selectedPlayer.versatilityDetails.archetypeScore}%` }} />
                        </div>
                      </div>

                      {/* 3. Stability */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-text-secondary font-medium">3. Performance Stability</span>
                          <span className="font-mono text-green-500 font-bold">{selectedPlayer.versatilityDetails.stabilityScore}</span>
                        </div>
                        <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden border border-border/30">
                          <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${selectedPlayer.versatilityDetails.stabilityScore}%` }} />
                        </div>
                      </div>

                      {/* 4. Flexibility */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-text-secondary font-medium">4. Draft Flexibility (Win-con/Flex)</span>
                          <span className="font-mono text-purple-500 font-bold">{selectedPlayer.versatilityDetails.flexScore}</span>
                        </div>
                        <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden border border-border/30">
                          <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${selectedPlayer.versatilityDetails.flexScore}%` }} />
                        </div>
                      </div>

                      {/* 5. Meta Adaptability */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-text-secondary font-medium">5. Meta Adaptability (Tier S/A Picks)</span>
                          <span className="font-mono text-cyan-500 font-bold">{selectedPlayer.versatilityDetails.metaScore}</span>
                        </div>
                        <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden border border-border/30">
                          <div className="h-full bg-cyan-500 rounded-full transition-all duration-500" style={{ width: `${selectedPlayer.versatilityDetails.metaScore}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Threat analysis (Draft Tax / Ban Power) */}
                    <div className="md:col-span-2 flex flex-col justify-between p-4 bg-bg-surface-hover/20 rounded-xl border border-border/60">
                      <div className="space-y-1">
                        <h4 className="text-[10px] uppercase font-mono text-text-muted tracking-wider">Draft Tax Threat Assessment</h4>
                        <div className="flex items-center gap-1.5 mt-2">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <span 
                              key={i} 
                              className={`text-base transition-all ${i < selectedPlayer.versatilityDetails!.draftTax ? 'text-red-500 filter drop-shadow-[0_0_2px_rgba(239,68,68,0.5)] animate-pulse' : 'text-text-muted opacity-20'}`}
                            >
                              🚫
                            </span>
                          ))}
                        </div>
                        <h3 className="font-heading font-black text-sm text-text-primary mt-2">
                          {selectedPlayer.versatilityDetails.draftTax === 4 ? 'Elite Unbannable Threat' : 
                           selectedPlayer.versatilityDetails.draftTax === 3 ? 'High Ban Priority Threat' : 
                           selectedPlayer.versatilityDetails.draftTax === 2 ? 'Situational Ban Target' : 
                           'Low Ban Priority (OTP)'}
                        </h3>
                        <p className="text-[10px] text-text-secondary leading-relaxed mt-1">
                          {selectedPlayer.versatilityDetails.draftTax === 4 ? 'This player requires 4 target bans to limit. Hard to ban out in competitive MLBB drafts.' :
                           selectedPlayer.versatilityDetails.draftTax === 3 ? 'This player requires at least 3 direct target bans. Absorbs draft pressure well.' :
                           selectedPlayer.versatilityDetails.draftTax === 2 ? 'This player can be restricted with 1-2 situational bans.' :
                           'This player relies heavily on one or two comfort picks. Easily targeted and banned out in the first phase.'}
                        </p>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-border/30 flex justify-between items-center text-[10px] font-mono text-text-muted">
                        <span>Comfort Dependency</span>
                        <span className={`font-bold ${selectedPlayer.versatilityDetails.draftTax === 4 ? 'text-success' : selectedPlayer.versatilityDetails.draftTax === 1 ? 'text-danger' : 'text-warning'}`}>
                          {selectedPlayer.versatilityDetails.draftTax === 4 ? 'Low' : 
                           selectedPlayer.versatilityDetails.draftTax === 3 ? 'Moderate' : 
                           selectedPlayer.versatilityDetails.draftTax === 2 ? 'High' : 
                           'Very High (OTP)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Player Analytical Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-bg-surface border border-border p-3 rounded-xl text-center shadow-sm">
                  <p className="text-[9px] text-text-muted font-mono uppercase tracking-wider">Avg KDA</p>
                  <h4 className="font-heading font-extrabold text-lg text-text-primary mt-1">{selectedPlayer.kda.toFixed(2)}</h4>
                  <p className="text-[9px] text-text-muted font-mono mt-0.5">
                    {selectedPlayer.avgKills.toFixed(1)} / {selectedPlayer.avgDeaths.toFixed(1)} / {selectedPlayer.avgAssists.toFixed(1)}
                  </p>
                </div>
                <div className="bg-bg-surface border border-border p-3 rounded-xl text-center shadow-sm">
                  <p className="text-[9px] text-text-muted font-mono uppercase tracking-wider">Gold Share%</p>
                  <h4 className="font-heading font-extrabold text-lg text-accent mt-1">{selectedPlayer.goldShare.toFixed(1)}%</h4>
                  <p className="text-[9px] text-text-muted font-mono mt-0.5">
                    GPM: {selectedPlayer.gpm.toFixed(0)}
                  </p>
                </div>
                <div className="bg-bg-surface border border-border p-3 rounded-xl text-center shadow-sm">
                  <p className="text-[9px] text-text-muted font-mono uppercase tracking-wider">Damage Share%</p>
                  <h4 className="font-heading font-extrabold text-lg text-red-side mt-1">{selectedPlayer.damageShare.toFixed(1)}%</h4>
                  <p className="text-[9px] text-text-muted font-mono mt-0.5">
                    DPM: {selectedPlayer.dpm.toFixed(0)}
                  </p>
                </div>
                <div className="bg-bg-surface border border-border p-3 rounded-xl text-center shadow-sm">
                  <p className="text-[9px] text-text-muted font-mono uppercase tracking-wider">Damage Taken%</p>
                  <h4 className="font-heading font-extrabold text-lg text-green-500 mt-1">{selectedPlayer.damageTakenShare.toFixed(1)}%</h4>
                  <p className="text-[9px] text-text-muted font-mono mt-0.5">
                    DTPM: {selectedPlayer.dtpm.toFixed(0)}
                  </p>
                </div>
              </div>

              {/* Hero Pool Database */}
              <Card variant="default">
                <h3 className="font-heading font-extrabold text-base text-text-primary tracking-tight mb-4">Comfort Hero Pool</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border text-[10px] font-mono uppercase tracking-wider text-text-muted">
                        <th className="py-2.5 px-3">Hero</th>
                        <th className="py-2.5 px-3 text-center">Matches</th>
                        <th className="py-2.5 px-3 text-center">Win Rate</th>
                        <th className="py-2.5 px-3 text-center">Avg KDA</th>
                        <th className="py-2.5 px-3 text-center">GPM</th>
                        <th className="py-2.5 px-3 text-center">DPM</th>
                        <th className="py-2.5 px-3 text-center">Dmg Taken</th>
                        <th className="py-2.5 px-3 text-center">KP%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPlayer.heroes.length > 0 ? (
                        selectedPlayer.heroes.map((hStat) => (
                          <tr key={hStat.heroName} className="border-b border-border/40 hover:bg-bg-surface-hover/30 transition-colors">
                            <td className="py-3 px-3 flex items-center gap-2.5">
                              <HeroAvatar imageUrl={getHeroImageUrl(hStat.heroName, hStat.heroId)} name={hStat.heroName} size="xs" />
                              <span className="font-semibold text-white">{hStat.heroName}</span>
                            </td>
                            <td className="py-3 px-3 text-center text-text-secondary font-mono">{hStat.matches}</td>
                            <td className={`py-3 px-3 text-center font-extrabold font-mono ${hStat.winRate >= 60 ? 'text-success' : hStat.winRate < 45 ? 'text-danger' : 'text-text-primary'}`}>
                              {hStat.winRate.toFixed(1)}%
                            </td>
                            <td className="py-3 px-3 text-center text-text-secondary font-mono">{hStat.kda.toFixed(2)}</td>
                            <td className="py-3 px-3 text-center text-text-secondary font-mono">{hStat.gpm}</td>
                            <td className="py-3 px-3 text-center text-text-secondary font-mono">{hStat.dpm}</td>
                            <td className="py-3 px-3 text-center text-text-secondary font-mono">{hStat.dtm}</td>
                            <td className="py-3 px-3 text-center text-text-secondary font-mono">{hStat.kp.toFixed(1)}%</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-text-muted font-mono">
                            No played heroes stats registered.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          ) : (
            <Card className="h-64 flex items-center justify-center text-text-muted">
              Select a pro player to view detailed scouting cards.
            </Card>
          )}
        </div>
      </div>
    );
  };

  // Tab 2: Render Team Scouting View
  const renderTeamTab = () => {
    if (!data) return null;

    const filteredTeams = data.teams.filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase()));

    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left selector list */}
        <Card variant="default" className="lg:col-span-1 max-h-[500px] overflow-y-auto pr-2 flex flex-col border-border/60">
          <SearchInput
            placeholder="Search team..."
            value={teamSearch}
            onChange={setTeamSearch}
            className="mb-3"
          />
          <div className="space-y-1.5 overflow-y-auto flex-1 scrollbar-thin">
            {filteredTeams.map((t) => (
              <button
                key={t.name}
                onClick={() => setSelectedTeam(t)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer
                  ${
                    selectedTeam?.name === t.name
                      ? 'bg-accent/15 border-accent text-white font-bold'
                      : 'bg-bg-surface border-border/50 text-text-secondary hover:text-text-primary hover:border-border-bright'
                  }
                `}
              >
                <div>
                  <h4 className="font-heading font-extrabold text-sm">{t.name}</h4>
                  <p className="text-[10px] text-text-muted tracking-wider uppercase font-mono mt-0.5">{t.roster.length} Active Roster</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-heading font-bold text-accent">{t.scoutingScore.toFixed(1)}</p>
                  <p className="text-[9px] text-text-muted font-mono">{t.winRate.toFixed(1)}% WR</p>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Right Details Panel */}
        <div className="lg:col-span-3">
          {selectedTeam ? (
            <motion.div initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              {/* Header profile card */}
              <Card variant="elevated" className="relative overflow-hidden border-border/80">
                <div className="absolute top-0 bottom-0 left-0 w-2.5 bg-gradient-to-b from-accent to-red-side" />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div>
                    <h2 className="font-heading font-black text-2xl text-text-primary tracking-tight">{selectedTeam.name}</h2>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                      <span className="font-semibold text-white">{eventName || 'Scouting Event'}</span>
                      <span className="text-text-muted">•</span>
                      <span className="bg-bg-elevated border border-border px-2 py-0.5 rounded-full text-[10px] text-accent font-medium">{selectedTeam.playstyleTag}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <div className="text-center bg-bg-surface px-4 py-2 rounded-xl border border-border">
                      <p className="text-[9px] text-text-muted font-mono uppercase tracking-wider">Record</p>
                      <p className="text-sm font-extrabold font-heading text-text-primary">{selectedTeam.wins}W - {selectedTeam.matches - selectedTeam.wins}L</p>
                    </div>
                    <div className="text-center bg-accent/10 px-4 py-2 rounded-xl border border-accent/30">
                      <p className="text-[9px] text-accent font-mono uppercase tracking-wider">Win Rate</p>
                      <p className="text-sm font-extrabold font-heading text-accent">{selectedTeam.winRate.toFixed(1)}%</p>
                    </div>
                    <Button
                      variant="secondary"
                      className="h-10 text-xs"
                      onClick={() => {
                        setIsDraftReportOpen(true);
                        void fetchDraftReportMatches(selectedTeam.name);
                      }}
                    >
                      🖨️ Draft Report
                    </Button>
                  </div>
                </div>
              </Card>

              <Modal
                isOpen={isDraftReportOpen}
                onClose={() => setIsDraftReportOpen(false)}
                title={`Draft Ban / Pick Report — ${selectedTeam?.name || 'Imported Scrims'}`}
                maxWidth="max-w-4xl"
              >
                <div id="draft-report-preview" className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-text-secondary">Print-ready draft bans and picks from the team match CSV you uploaded in Scouting Portal.</p>
                      <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider mt-1">Uses Match ID + ban/pick columns from the uploaded team summary CSV, with scrim data only as fallback.</p>
                    </div>
                    <Button variant="primary" className="h-10 text-xs" onClick={printDraftReport}>
                      🖨️ Print Report
                    </Button>
                  </div>

                  {draftReportLoading ? (
                    <div className="rounded-xl border border-border/60 bg-bg-surface p-5 text-sm text-text-secondary">Loading draft report...</div>
                  ) : draftReportMatches.length > 0 ? (
                    <div className="max-h-[70vh] overflow-y-auto space-y-3 pr-1">
                      {draftReportMatches.map((record, index) => (
                        <div key={`${record.matchId}-${index}`} className="rounded-xl border border-border/60 bg-bg-surface p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border/40">
                            <div>
                              <p className="font-heading font-extrabold text-sm text-text-primary">{record.matchId || 'Match'}</p>
                              <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">{record.date || 'No date'} • {record.opponent || selectedTeam?.name || 'Imported Match'}</p>
                            </div>
                            <Badge label={record.result || 'N/A'} size="sm" />
                          </div>

                          <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <div className="rounded-2xl border border-border/50 bg-bg-elevated/60 p-4">
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <p className="text-[10px] uppercase tracking-widest font-mono text-text-muted">Team Draft</p>
                                  <p className="text-sm font-bold text-text-primary mt-1">{selectedTeam?.name || 'Your Team'}</p>
                                </div>
                                <span className="text-[10px] uppercase tracking-wider text-text-secondary">{record.side || 'Side Unknown'}</span>
                              </div>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider font-mono text-text-muted mb-2">Bans</p>
                                  <div className="flex flex-wrap gap-2">
                                    {record.bans.length > 0 ? (
                                      record.bans.map((ban, banIndex) => renderHeroPickIcon(ban, `${record.matchId}-team-ban-${banIndex}`))
                                    ) : (
                                      <span className="text-[11px] text-text-muted">No bans found</span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider font-mono text-text-muted mb-2">Picks</p>
                                  <div className="flex flex-wrap gap-2">
                                    {record.picks.length > 0 ? (
                                      record.picks.map((pick, pickIndex) => renderHeroPickIcon(pick, `${record.matchId}-team-pick-${pickIndex}`))
                                    ) : (
                                      <span className="text-[11px] text-text-muted">No picks found</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-border/50 bg-bg-elevated/60 p-4">
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <p className="text-[10px] uppercase tracking-widest font-mono text-text-muted">Opponent Draft</p>
                                  <p className="text-sm font-bold text-text-primary mt-1">{record.opponent || 'Opponent'}</p>
                                </div>
                                <span className="text-[10px] uppercase tracking-wider text-text-secondary">{record.side ? (record.side === 'Blue' ? 'Second Pick' : 'First Pick') : 'Draft Side'}</span>
                              </div>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider font-mono text-text-muted mb-2">Bans</p>
                                  <div className="flex flex-wrap gap-2">
                                    {record.oppBans.length > 0 ? (
                                      record.oppBans.map((ban, banIndex) => renderHeroPickIcon(ban, `${record.matchId}-opp-ban-${banIndex}`))
                                    ) : (
                                      <span className="text-[11px] text-text-muted">No bans found</span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider font-mono text-text-muted mb-2">Picks</p>
                                  <div className="flex flex-wrap gap-2">
                                    {record.oppPicks.length > 0 ? (
                                      record.oppPicks.map((pick, pickIndex) => renderHeroPickIcon(pick, `${record.matchId}-opp-pick-${pickIndex}`))
                                    ) : (
                                      <span className="text-[11px] text-text-muted">No picks found</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/70 bg-bg-surface/70 p-6 text-sm text-text-secondary">
                      No saved draft ban/pick history was found for this team yet. Import scrim metadata first from the Scrims page.
                    </div>
                  )}
                </div>
              </Modal>

              {/* Attributes vs Splits Column */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Team Attributes progress bars */}
                <Card variant="default" className="space-y-4">
                  <h3 className="font-heading font-extrabold text-base text-text-primary tracking-tight">Team Attributes (6-axis Score)</h3>
                  <div className="space-y-3.5">
                    {renderAttributeBar('Tempo (Macro Speeds)', selectedTeam.attributes.tempo, 100, 'bg-yellow-500')}
                    {renderAttributeBar('Damage (Team Fight DPM)', selectedTeam.attributes.damage, 100, 'bg-red-side')}
                    {renderAttributeBar('Durability (Taken Share)', selectedTeam.attributes.durability, 100, 'bg-green-500')}
                    {renderAttributeBar('Objective (Towers & Lords)', selectedTeam.attributes.objective, 100, 'bg-orange-500')}
                    {renderAttributeBar('Team Fight (Avg KP & Kills)', selectedTeam.attributes.teamFight, 100, 'bg-purple-500')}
                    {renderAttributeBar('Versatility (Distinct Heroes)', selectedTeam.attributes.versatility, 100, 'bg-cyan-500')}
                  </div>
                </Card>

                {/* Score Gauge & Splits */}
                <div className="space-y-6">
                  {renderScoreGauge(selectedTeam.scoutingScore, 'Team Rating')}

                  {renderSideComparisonSlider(selectedTeam.blueWR, selectedTeam.redWR, selectedTeam.blueMatches, selectedTeam.redMatches)}

                  {/* Stage Splits */}
                  <Card variant="default" className="space-y-4">
                    <h3 className="font-heading font-extrabold text-sm text-text-primary">League Stage Splits</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center bg-bg-surface/50 border border-border/40 p-3 rounded-lg text-xs">
                        <div>
                          <p className="font-bold text-text-primary">Group Stage</p>
                          <p className="text-[10px] text-text-muted font-mono mt-0.5">{selectedTeam.groupStage.matches} Matches</p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-text-secondary">{selectedTeam.groupStage.wr.toFixed(1)}% WR</p>
                          <p className="text-[9px] text-text-muted font-mono">{selectedTeam.groupStage.wins} Wins</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center bg-bg-surface/50 border border-border/40 p-3 rounded-lg text-xs">
                        <div>
                          <p className="font-bold text-text-primary">Progressive Round</p>
                          <p className="text-[10px] text-text-muted font-mono mt-0.5">{selectedTeam.progressiveRound.matches} Matches</p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-text-secondary">{selectedTeam.progressiveRound.wr.toFixed(1)}% WR</p>
                          <p className="text-[9px] text-text-muted font-mono">{selectedTeam.progressiveRound.wins} Wins</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center bg-bg-surface/50 border border-border/40 p-3 rounded-lg text-xs">
                        <div>
                          <p className="font-bold text-text-primary">Playoffs</p>
                          <p className="text-[10px] text-text-muted font-mono mt-0.5">{selectedTeam.playoffs.matches} Matches</p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-text-secondary">{selectedTeam.playoffs.wr.toFixed(1)}% WR</p>
                          <p className="text-[9px] text-text-muted font-mono">{selectedTeam.playoffs.wins} Wins</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Aggregate stats table */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-bg-surface border border-border p-3 rounded-xl text-center shadow-sm">
                  <p className="text-[9px] text-text-muted font-mono uppercase tracking-wider">Team GPM</p>
                  <h4 className="font-heading font-extrabold text-lg text-text-primary mt-1">{selectedTeam.teamGpm.toFixed(0)}</h4>
                  <p className="text-[8px] text-text-muted font-mono mt-0.5">Gold Accumulation</p>
                </div>
                <div className="bg-bg-surface border border-border p-3 rounded-xl text-center shadow-sm">
                  <p className="text-[9px] text-text-muted font-mono uppercase tracking-wider">Team Damage DPM</p>
                  <h4 className="font-heading font-extrabold text-lg text-red-side mt-1">{selectedTeam.teamDamage.toFixed(0)}</h4>
                  <p className="text-[8px] text-text-muted font-mono mt-0.5">Average output</p>
                </div>
                <div className="bg-bg-surface border border-border p-3 rounded-xl text-center shadow-sm">
                  <p className="text-[9px] text-text-muted font-mono uppercase tracking-wider">Avg Towers</p>
                  <h4 className="font-heading font-extrabold text-lg text-orange-500 mt-1">{selectedTeam.avgTowers.toFixed(1)}</h4>
                  <p className="text-[8px] text-text-muted font-mono mt-0.5">Destruction per game</p>
                </div>
                <div className="bg-bg-surface border border-border p-3 rounded-xl text-center shadow-sm">
                  <p className="text-[9px] text-text-muted font-mono uppercase tracking-wider">Turtles & Lords</p>
                  <h4 className="font-heading font-extrabold text-lg text-green-500 mt-1">
                    {selectedTeam.avgTurtles.toFixed(1)} / {selectedTeam.avgLords.toFixed(1)}
                  </h4>
                  <p className="text-[8px] text-text-muted font-mono mt-0.5">Objective averages</p>
                </div>
              </div>

              {/* Roster profiles */}
              <Card variant="default">
                <h3 className="font-heading font-extrabold text-base text-text-primary tracking-tight mb-4">Team Roster</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedTeam.roster.map((player) => (
                    <div
                      key={player.playerName}
                      onClick={() => {
                        // Quick switch to Player Hub and select the player
                        const mappedPlayer = data.players.find(
                          (p) => p.name.toLowerCase() === player.playerName.toLowerCase() && p.team.toLowerCase() === selectedTeam.name.toLowerCase()
                        );
                        if (mappedPlayer) {
                          setSelectedPlayer(mappedPlayer);
                          setActiveTab('player-dashboard');
                        }
                      }}
                      className="bg-bg-surface/60 hover:bg-bg-surface border border-border hover:border-accent/40 p-3.5 rounded-xl transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-heading font-extrabold text-sm text-text-primary group-hover:text-white transition-colors">
                            {player.playerName}
                          </h4>
                          <p className="text-[9px] text-text-muted uppercase tracking-wider font-mono mt-0.5">{player.role}</p>
                        </div>
                        <Badge label={player.scoutingScore.toFixed(1)} size="sm" />
                      </div>
                      <div className="mt-3 flex justify-between items-center text-[10px] text-text-muted">
                        <span>Win Rate: <span className="font-bold text-text-secondary">{player.winRate.toFixed(1)}%</span></span>
                        <span>{player.matches} Matches</span>
                      </div>
                      <div className="mt-2 text-[9px] bg-bg-elevated px-2 py-0.5 rounded text-accent font-medium inline-block">
                        {player.playstyleTag}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          ) : (
            <Card className="h-64 flex items-center justify-center text-text-muted">
              Select a team to display pro configurations.
            </Card>
          )}
        </div>
      </div>
    );
  };

  // Tab 3: Leaderboards & Analytics
  const renderLeaderboardsTab = () => {
    if (!data) return null;

    const filteredHeroes = data.heroes.filter((h) => h.name.toLowerCase().includes(heroSearch.toLowerCase()));
    
    // Dynamic qualification threshold: min games is 25% of most active player's games, or at least 3 games
    const maxPlayerMatches = data.players.length > 0 ? Math.max(...data.players.map(p => p.matches), 1) : 1;
    const minMatchesRequired = Math.max(3, Math.round(maxPlayerMatches * 0.25));

    // Dynamic Role-Filtered Player Leaderboard with sample size threshold filter
    const top5PlayersForRole = data.players
      .filter((p) => p.matches >= minMatchesRequired)
      .filter((p) => leaderboardRole === 'all' || p.role.toUpperCase() === leaderboardRole.toUpperCase())
      .slice(0, 5);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Players by Scouting Score */}
          <Card variant="default" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/30">
              <div>
                <h3 className="font-heading font-extrabold text-base text-text-primary tracking-tight">Top 5 Players (Scouting Leaderboard)</h3>
                <p className="text-[9px] text-text-muted font-mono mt-0.5">* Requires min. {minMatchesRequired} matches played to qualify</p>
              </div>
              
              {/* Role Filter Pills */}
              <div className="flex flex-wrap gap-1">
                {['all', 'EXP', 'JUNGLE', 'MID', 'GOLD', 'ROAM'].map((role) => (
                  <button
                    key={role}
                    onClick={() => setLeaderboardRole(role)}
                    className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer
                      ${leaderboardRole === role 
                        ? 'bg-accent/20 border border-accent text-white shadow-sm' 
                        : 'bg-bg-elevated border border-border/80 text-text-muted hover:text-text-secondary hover:border-border'}`}
                  >
                    {role === 'all' ? 'ALL' : role}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              {top5PlayersForRole.length > 0 ? (
                top5PlayersForRole.map((player, idx) => (
                  <div
                    key={`${player.name}@${player.team}`}
                    onClick={() => {
                      setSelectedPlayer(player);
                      setActiveTab('player-dashboard');
                    }}
                    className="flex items-center justify-between p-3 bg-bg-surface hover:bg-bg-surface-hover/30 border border-border hover:border-accent/40 rounded-xl transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-xs text-text-muted w-5">#{idx + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                        {player.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-heading font-bold text-xs text-white leading-none mb-1">{player.name}</h4>
                        <p className="text-[9px] text-text-muted font-mono">{player.team} — {player.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-heading font-black text-accent">{player.scoutingScore.toFixed(1)}</p>
                      <p className="text-[9px] text-text-muted font-mono">{player.winRate.toFixed(1)}% WR</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-text-muted font-mono text-xs">
                  No active players found for this role.
                </div>
              )}
            </div>
          </Card>

          {/* Top Teams by Scouting Score */}
          <Card variant="default" className="space-y-4">
            <h3 className="font-heading font-extrabold text-base text-text-primary tracking-tight">Top 5 Teams (League Leaderboard)</h3>
            <div className="space-y-2.5">
              {data.teams.slice(0, 5).map((team, idx) => (
                <div
                  key={team.name}
                  onClick={() => {
                    setSelectedTeam(team);
                    setActiveTab('team-dashboard');
                  }}
                  className="flex items-center justify-between p-3 bg-bg-surface hover:bg-bg-surface-hover/30 border border-border hover:border-accent/40 rounded-xl transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-xs text-text-muted w-5">#{idx + 1}</span>
                    <div className="w-8 h-8 rounded-lg bg-red-side/10 border border-red-side/20 flex items-center justify-center text-xs font-bold text-red-side">
                      {team.name.slice(0, 3)}
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-white leading-none mb-1">{team.name}</h4>
                      <p className="text-[9px] text-text-muted font-mono">{team.playstyleTag}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-heading font-black text-red-side">{team.scoutingScore.toFixed(1)}</p>
                    <p className="text-[9px] text-text-muted font-mono">{team.winRate.toFixed(1)}% WR</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Most Played Hero list */}
        <Card variant="default" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <h3 className="font-heading font-extrabold text-base text-text-primary tracking-tight">Hero Tournament Presence</h3>
            <SearchInput
              placeholder="Search hero..."
              value={heroSearch}
              onChange={setHeroSearch}
              className="w-full sm:w-64 text-xs"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-[9px] font-mono uppercase tracking-wider text-text-muted">
                  <th className="py-2.5 px-3">Hero</th>
                  <th className="py-2.5 px-3 text-center">Role</th>
                  <th className="py-2.5 px-3 text-center">Matches Played</th>
                  <th className="py-2.5 px-3 text-center">Wins</th>
                  <th className="py-2.5 px-3 text-center">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {filteredHeroes.length > 0 ? (
                  filteredHeroes.map((hero) => (
                    <tr key={hero.name} className="border-b border-border/40 hover:bg-bg-surface-hover/30 transition-colors">
                      <td className="py-2.5 px-3 flex items-center gap-2.5">
                        <HeroAvatar imageUrl={getHeroImageUrl(hero.name, hero.heroId)} name={hero.name} size="xs" />
                        <span className="font-semibold text-white">{hero.name}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge role={hero.role} size="sm" />
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-text-secondary">{hero.picks}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-text-secondary">{hero.wins}</td>
                      <td className={`py-2.5 px-3 text-center font-extrabold font-mono ${hero.winRate >= 55 ? 'text-success' : hero.winRate < 45 ? 'text-danger' : 'text-text-primary'}`}>
                        {hero.winRate}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-text-muted font-mono">
                      No hero presence statistics matched your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const renderDashboardView = () => {
    if (!data) return null;

    return (
      <div className="space-y-6">
        {/* Dynamic header stats control bar */}
        <Card variant="elevated" className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-bg-surface/90 border-border/60">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <h2 className="font-heading font-extrabold text-lg text-text-primary tracking-tight">
                {eventName ? `${eventName} Scouting` : 'Esports Scouting Portal'}
              </h2>
              <p className="text-text-secondary text-xs">
                Parsed {data.players.length} active players across {data.teams.length} professional league teams.
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="secondary" className="flex-1 sm:flex-none h-10 text-xs" onClick={() => setIsUploadModalOpen(true)}>📁 Import CSV</Button>
            <Button variant="secondary" className="flex-1 sm:flex-none h-10 text-xs" onClick={handleReset}>Clear Cache</Button>
            <Button
              variant="primary"
              disabled={loading || isSynced}
              className={`flex-1 sm:flex-none h-10 text-xs ${isSynced ? 'bg-success/20 border-success/30 text-success cursor-default hover:bg-success/20' : 'glow-accent text-white font-bold'}`}
              onClick={handleSyncToDB}
            >
              {isSynced ? '✓ Synced to DB' : 'Sync to Local Database'}
            </Button>
          </div>
        </Card>

        {/* Custom tabs */}
        <div className="flex justify-start">
          <Tabs
            tabs={[
              { id: 'player-dashboard', label: '👤 Player Dashboard' },
              { id: 'team-dashboard', label: '🛡️ Team Dashboard' },
              { id: 'leaderboards', label: '📈 Leaderboards & Insights' }
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Tab hydration routing */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'player-dashboard' && renderPlayerTab()}
            {activeTab === 'team-dashboard' && renderTeamTab()}
            {activeTab === 'leaderboards' && renderLeaderboardsTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Title block */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-start pb-4 border-b border-border/20">
        <div>
          <h1 className="font-heading text-3xl font-black mb-1 tracking-tight">
            League <span className="gradient-text">Scouting Portal</span>
          </h1>
          <p className="text-text-secondary text-sm">
            Import, analyze, and sync pro tournament databases in high-fidelity dashboards.
          </p>
        </div>
        {data && (
          <Button
            variant="secondary"
            className="flex items-center gap-1.5 text-xs h-9"
            onClick={handleFetchLiveGoogleData}
            disabled={loading}
          >
            🔄 Sync Live
          </Button>
        )}
      </motion.div>

      {/* Notifications */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-danger/10 border border-danger/30 text-danger p-4 rounded-xl text-xs flex items-center justify-between shadow-lg font-mono">
              <span>⚠️ {error}</span>
              <button onClick={() => setError(null)} className="font-bold cursor-pointer opacity-70 hover:opacity-100 px-2 text-sm">×</button>
            </div>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-success/10 border border-success/30 text-success p-4 rounded-xl text-xs flex items-center justify-between shadow-lg">
              <span>✓ {success}</span>
              <button onClick={() => setSuccess(null)} className="font-bold cursor-pointer opacity-70 hover:opacity-100 px-2 text-sm">×</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary view block */}
      {data ? renderDashboardView() : renderImporterView()}

      {/* Manual File Importer Modal */}
      <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Import Regional CSV Sheets">
        <div className="space-y-4 text-left">
          <p className="text-text-secondary text-xs mb-2">
            Upload custom regional CSV sheets to analyze player hero pools, macro scores, and stage splits.
          </p>
          
          {/* Player CSV Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-heading font-bold text-text-secondary">Player Summary CSV (Required)</label>
            <div className="relative group border border-dashed border-border hover:border-accent/40 rounded-xl p-3 bg-bg-surface-hover/30 hover:bg-bg-surface-hover/60 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">👤</span>
                <div className="text-left">
                  <p className="text-[11px] font-bold text-text-primary">
                    {playerFile ? playerFile.name : 'Select player summary...'}
                  </p>
                  <p className="text-[9px] text-text-muted">
                    {playerFile ? `${(playerFile.size / 1024).toFixed(1)} KB` : 'Format: Player, Player No., Games Played...'}
                  </p>
                </div>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setPlayerFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {playerFile && <span className="text-success text-xs font-bold font-mono">✓</span>}
            </div>
          </div>

          {/* Team CSV Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-heading font-bold text-text-secondary">Team Summary CSV (Required)</label>
            <div className="relative group border border-dashed border-border hover:border-accent/40 rounded-xl p-3 bg-bg-surface-hover/30 hover:bg-bg-surface-hover/60 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">🛡️</span>
                <div className="text-left">
                  <p className="text-[11px] font-bold text-text-primary">
                    {teamFile ? teamFile.name : 'Select team summary...'}
                  </p>
                  <p className="text-[9px] text-text-muted">
                    {teamFile ? `${(teamFile.size / 1024).toFixed(1)} KB` : 'Format: Team, Games Played, Win Ratio%...'}
                  </p>
                </div>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setTeamFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {teamFile && <span className="text-success text-xs font-bold font-mono">✓</span>}
            </div>
          </div>

          {/* Raw Logs CSV Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-heading font-bold text-text-secondary">Raw Match Logs CSV (Optional — recommended!)</label>
            <div className="relative group border border-dashed border-border hover:border-accent/40 rounded-xl p-3 bg-bg-surface-hover/30 hover:bg-bg-surface-hover/60 transition-all flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">📊</span>
                <div className="text-left">
                  <p className="text-[11px] font-bold text-text-primary">
                    {logsFile ? logsFile.name : 'Select raw logs...'}
                  </p>
                  <p className="text-[9px] text-text-muted">
                    {logsFile ? `${(logsFile.size / 1024).toFixed(1)} KB` : 'Format: Battle Code, Map, Stage, Player, Hero...'}
                  </p>
                </div>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setLogsFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {logsFile && <span className="text-success text-xs font-bold font-mono">✓</span>}
            </div>
          </div>

          {/* Process button */}
          <Button
            variant="primary"
            onClick={async () => {
              await handleManualParse();
              setIsUploadModalOpen(false);
            }}
            disabled={loading || !playerFile || !teamFile}
            className="h-10 w-full flex items-center justify-center gap-2 glow-accent shadow-lg text-white mt-4 font-bold text-xs"
          >
            {loading ? 'Processing...' : '⚡ Process & Scout Region'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
