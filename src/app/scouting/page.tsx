'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  analyzeScoutingCSVs,
  overridePlayerRole,
  type PlayerScoutingProfile,
  type ScoutingReport,
  type ScoutingRole,
  type TeamScoutingProfile,
} from '@/lib/scoutingEngine';

type View = 'players' | 'compare' | 'teams' | 'quality';

interface SavedWorkspace {
  report: ScoutingReport;
  playerFileName: string;
  teamFileName: string;
}

const STORAGE_KEY = 'chalize-scouting-workspace-v1';
const ROLES: Array<'ALL' | ScoutingRole> = ['ALL', 'EXP', 'JUNGLE', 'MID', 'GOLD', 'ROAM'];

export default function ScoutingPage() {
  const [workspace, setWorkspace] = useState<SavedWorkspace | null>(null);
  const [playerFile, setPlayerFile] = useState<File | null>(null);
  const [teamFile, setTeamFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('players');
  const [role, setRole] = useState<'ALL' | ScoutingRole>('ALL');
  const [team, setTeam] = useState('ALL');
  const [query, setQuery] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [activePlayerId, setActivePlayerId] = useState('');

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) setWorkspace(JSON.parse(saved) as SavedWorkspace);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const report = workspace?.report ?? null;
  const teamOptions = useMemo(
    () => (report ? report.teams.map((item) => item.name).sort() : []),
    [report],
  );

  const filteredPlayers = useMemo(() => {
    if (!report) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return report.players.filter((player) => {
      const matchesRole = role === 'ALL' || player.role === role;
      const matchesTeam = team === 'ALL' || player.team === team;
      const matchesQuery =
        !normalizedQuery ||
        player.name.toLowerCase().includes(normalizedQuery) ||
        player.team.toLowerCase().includes(normalizedQuery) ||
        player.heroes.some((hero) => hero.name.toLowerCase().includes(normalizedQuery));
      return matchesRole && matchesTeam && matchesQuery;
    });
  }, [report, role, team, query]);

  const comparePlayers = useMemo(
    () =>
      selectedPlayers
        .map((id) => report?.players.find((player) => player.id === id))
        .filter((player): player is PlayerScoutingProfile => Boolean(player)),
    [report, selectedPlayers],
  );

  const activePlayer = useMemo(
    () => report?.players.find((player) => player.id === activePlayerId) ?? null,
    [report, activePlayerId],
  );

  const activeTeam = useMemo(() => {
    if (!report) return null;
    return (
      report.teams.find((item) => item.name === selectedTeam) ??
      report.teams[0] ??
      null
    );
  }, [report, selectedTeam]);

  async function processFiles() {
    if (!playerFile || !teamFile) return;
    setIsProcessing(true);
    setError('');

    try {
      const [playerText, teamText] = await Promise.all([
        playerFile.text(),
        teamFile.text(),
      ]);
      const nextReport = analyzeScoutingCSVs(playerText, teamText);
      const nextWorkspace: SavedWorkspace = {
        report: nextReport,
        playerFileName: playerFile.name,
        teamFileName: teamFile.name,
      };
      setWorkspace(nextWorkspace);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextWorkspace));
      setSelectedPlayers([]);
      setSelectedTeam(nextReport.teams[0]?.name ?? '');
      setActivePlayerId('');
      setView('players');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'CSV gagal diproses.');
    } finally {
      setIsProcessing(false);
    }
  }

  function clearWorkspace() {
    setWorkspace(null);
    setPlayerFile(null);
    setTeamFile(null);
    setSelectedPlayers([]);
    setSelectedTeam('');
    setActivePlayerId('');
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function toggleCompare(playerId: string) {
    setSelectedPlayers((current) => {
      if (current.includes(playerId)) return current.filter((id) => id !== playerId);
      if (current.length >= 3) return [...current.slice(1), playerId];
      return [...current, playerId];
    });
  }

  function changePlayerRole(playerId: string, nextRole: ScoutingRole) {
    setWorkspace((current) => {
      if (!current) return current;
      const nextWorkspace = {
        ...current,
        report: overridePlayerRole(current.report, playerId, nextRole),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextWorkspace));
      return nextWorkspace;
    });
  }

  if (!report) {
    return (
      <div className="page-wrap">
        <PageHeader
          eyebrow="SCOUTING WORKSPACE"
          title="Turn tournament exports into player evidence."
          description="Upload the two official CSV exports. The analysis runs locally in your browser and is never shared automatically."
        />

        <section className="import-panel">
          <div className="import-copy">
            <span className="status-pill">
              <span className="status-dot" />
              LOCAL PROCESSING
            </span>
            <h2>Import one completed tournament</h2>
            <p>
              Start with the player match record and team match record from the same
              tournament. Raw match data becomes the source of truth.
            </p>
            <div className="import-rules">
              <Rule index="01" text="Player Match Record CSV" />
              <Rule index="02" text="Team Match Record CSV" />
              <Rule index="03" text="Review data quality before trusting rankings" />
            </div>
          </div>

          <div className="upload-stack">
            <FileDrop
              label="Player Match Record"
              helper="Player, Hero, KDA, GPM, DPM, shares"
              file={playerFile}
              onChange={(event) => setPlayerFile(event.target.files?.[0] ?? null)}
            />
            <FileDrop
              label="Team Match Record"
              helper="Team result, side, picks, bans, objectives"
              file={teamFile}
              onChange={(event) => setTeamFile(event.target.files?.[0] ?? null)}
            />

            {error && <div className="error-banner">{error}</div>}

            <button
              type="button"
              className="primary-button"
              disabled={!playerFile || !teamFile || isProcessing}
              onClick={processFiles}
            >
              {isProcessing ? 'Processing match records…' : 'Build scouting workspace'}
            </button>
            <p className="privacy-note">
              Files stay on this device. Nothing is uploaded, sent, or published.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <div className="workspace-head">
        <PageHeader
          eyebrow="SCOUTING WORKSPACE"
          title={report.meta.tournaments[0] || 'Tournament scouting report'}
          description={`${report.meta.matches} games processed from ${workspace?.playerFileName ?? 'player records'} and ${workspace?.teamFileName ?? 'team records'}.`}
        />
        <button type="button" className="secondary-button" onClick={clearWorkspace}>
          Replace data
        </button>
      </div>

      <section className="stat-strip" aria-label="Dataset summary">
        <Stat label="Games" value={report.meta.matches} />
        <Stat label="Players" value={report.meta.players} />
        <Stat label="Teams" value={report.meta.teams} />
        <Stat label="Heroes" value={report.meta.heroes} />
        <Stat
          label="Quality flags"
          value={report.quality.filter((issue) => issue.severity === 'warning').length}
          tone="warning"
        />
      </section>

      <div className="workspace-tabs" role="tablist" aria-label="Scouting views">
        <Tab active={view === 'players'} onClick={() => setView('players')}>
          Player board
        </Tab>
        <Tab active={view === 'compare'} onClick={() => setView('compare')}>
          Compare <span className="tab-count">{selectedPlayers.length}/3</span>
        </Tab>
        <Tab active={view === 'teams'} onClick={() => setView('teams')}>
          Team & draft
        </Tab>
        <Tab active={view === 'quality'} onClick={() => setView('quality')}>
          Data quality
        </Tab>
      </div>

      {view === 'players' && (
        <PlayerBoard
          players={filteredPlayers}
          role={role}
          team={team}
          query={query}
          teams={teamOptions}
          selectedPlayers={selectedPlayers}
          onRoleChange={setRole}
          onTeamChange={setTeam}
          onQueryChange={setQuery}
          onOpenPlayer={setActivePlayerId}
          onToggleCompare={toggleCompare}
          onOpenCompare={() => setView('compare')}
        />
      )}

      {view === 'compare' && (
        <CompareView
          players={comparePlayers}
          allPlayers={report.players}
          selectedPlayers={selectedPlayers}
          onToggle={toggleCompare}
          onBack={() => setView('players')}
        />
      )}

      {view === 'teams' && (
        <TeamView
          teams={report.teams}
          activeTeam={activeTeam}
          contestedHeroes={report.contestedHeroes}
          selectedTeam={activeTeam?.name ?? ''}
          onSelectTeam={setSelectedTeam}
        />
      )}

      {view === 'quality' && (
        <QualityView report={report} onRoleChange={changePlayerRole} />
      )}

      {activePlayer && (
        <PlayerProfileDrawer
          player={activePlayer}
          allPlayers={report.players}
          isSelected={selectedPlayers.includes(activePlayer.id)}
          onToggleCompare={() => toggleCompare(activePlayer.id)}
          onClose={() => setActivePlayerId('')}
        />
      )}
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function FileDrop({
  label,
  helper,
  file,
  onChange,
}: {
  label: string;
  helper: string;
  file: File | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className={`file-drop ${file ? 'file-drop-ready' : ''}`}>
      <input type="file" accept=".csv,text/csv" onChange={onChange} />
      <span className="file-index">{file ? '✓' : 'CSV'}</span>
      <span>
        <strong>{file?.name ?? label}</strong>
        <small>{file ? `${formatBytes(file.size)} ready` : helper}</small>
      </span>
      <span className="file-action">{file ? 'Change' : 'Choose file'}</span>
    </label>
  );
}

function Rule({ index, text }: { index: string; text: string }) {
  return (
    <div className="import-rule">
      <span>{index}</span>
      <p>{text}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'warning';
}) {
  return (
    <div className={`stat-cell ${tone ? `stat-${tone}` : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={active ? 'workspace-tab active' : 'workspace-tab'}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PlayerBoard({
  players,
  role,
  team,
  query,
  teams,
  selectedPlayers,
  onRoleChange,
  onTeamChange,
  onQueryChange,
  onOpenPlayer,
  onToggleCompare,
  onOpenCompare,
}: {
  players: PlayerScoutingProfile[];
  role: 'ALL' | ScoutingRole;
  team: string;
  query: string;
  teams: string[];
  selectedPlayers: string[];
  onRoleChange: (role: 'ALL' | ScoutingRole) => void;
  onTeamChange: (team: string) => void;
  onQueryChange: (value: string) => void;
  onOpenPlayer: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onOpenCompare: () => void;
}) {
  return (
    <section>
      <div className="filter-row">
        <div className="role-filter" aria-label="Filter by role">
          {ROLES.map((item) => (
            <button
              key={item}
              type="button"
              className={role === item ? 'filter-chip active' : 'filter-chip'}
              onClick={() => onRoleChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="filter-fields">
          <select value={team} onChange={(event) => onTeamChange(event.target.value)}>
            <option value="ALL">All teams</option>
            {teams.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={query}
            placeholder="Search player, team, or hero"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
      </div>

      <div className="table-card">
        <div className="table-explainer">
          <div>
            <p className="eyebrow">ROLE-ADJUSTED RANKING</p>
            <h2>{players.length} player profiles</h2>
          </div>
          <p>
            Win rate and KDA are shown, but they do not directly determine Impact.
          </p>
        </div>

        <div className="table-scroll">
          <table className="player-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Role</th>
                <th>Impact</th>
                <th>Confidence</th>
                <th>Games</th>
                <th>WR</th>
                <th>KDA</th>
                <th>Signal</th>
                <th aria-label="Add to comparison" />
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr key={player.id}>
                  <td className="rank-cell">{index + 1}</td>
                  <td>
                    <button
                      type="button"
                      className="player-name player-name-button"
                      onClick={() => onOpenPlayer(player.id)}
                      aria-label={`Open full profile for ${player.name}`}
                    >
                      <span>{initials(player.name)}</span>
                      <div>
                        <strong>{player.name}</strong>
                        <small>{player.team} · View profile</small>
                      </div>
                    </button>
                  </td>
                  <td><RoleBadge role={player.role} /></td>
                  <td><Score value={player.impactScore} /></td>
                  <td><Confidence value={player.confidence} /></td>
                  <td>{player.matches}</td>
                  <td>{player.winRate}%</td>
                  <td>{player.kda}</td>
                  <td><SignalBadge signal={player.signal} /></td>
                  <td>
                    <button
                      type="button"
                      className={
                        selectedPlayers.includes(player.id)
                          ? 'compare-toggle selected'
                          : 'compare-toggle'
                      }
                      aria-label={`Compare ${player.name}`}
                      onClick={() => onToggleCompare(player.id)}
                    >
                      {selectedPlayers.includes(player.id) ? '✓' : '+'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPlayers.length > 0 && (
        <button type="button" className="compare-dock" onClick={onOpenCompare}>
          Compare {selectedPlayers.length} selected player{selectedPlayers.length > 1 ? 's' : ''}
          <span>→</span>
        </button>
      )}
    </section>
  );
}

function CompareView({
  players,
  allPlayers,
  selectedPlayers,
  onToggle,
  onBack,
}: {
  players: PlayerScoutingProfile[];
  allPlayers: PlayerScoutingProfile[];
  selectedPlayers: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
}) {
  if (players.length === 0) {
    return (
      <section className="empty-state">
        <span>↔</span>
        <h2>Select up to three players</h2>
        <p>Use the plus button on the Player Board to build a comparison.</p>
        <button type="button" className="primary-button compact" onClick={onBack}>
          Open player board
        </button>
      </section>
    );
  }

  return (
    <section>
      <div className="compare-picker">
        <div>
          <p className="eyebrow">SIDE-BY-SIDE</p>
          <h2>Compare role context, not just totals</h2>
        </div>
        <select
          value=""
          onChange={(event) => {
            if (event.target.value) onToggle(event.target.value);
          }}
        >
          <option value="">Add player…</option>
          {allPlayers
            .filter((player) => !selectedPlayers.includes(player.id))
            .map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} · {player.team} · {player.role}
              </option>
            ))}
        </select>
      </div>

      <div className="compare-grid">
        {players.map((player) => (
          <article key={player.id} className="compare-card">
            <button
              type="button"
              className="remove-compare"
              onClick={() => onToggle(player.id)}
              aria-label={`Remove ${player.name}`}
            >
              ×
            </button>
            <div className="compare-player-head">
              <span className="large-initials">{initials(player.name)}</span>
              <div>
                <h3>{player.name}</h3>
                <p>{player.team} · {player.role} · {player.matches} games</p>
              </div>
            </div>
            <div className="compare-score">
              <div>
                <strong>{player.impactScore}</strong>
                <span>Adjusted impact</span>
              </div>
              <SignalBadge signal={player.signal} />
            </div>
            <MetricBar label="Confidence" value={player.confidence} suffix="%" />
            <MetricBar label="Damage efficiency" value={player.percentiles.damageEfficiency} />
            <MetricBar label="Teamfight activity" value={player.percentiles.teamwork} />
            <MetricBar label="Survival" value={player.percentiles.survival} />
            <MetricBar label="Versatility" value={player.percentiles.versatility} />

            <dl className="detail-grid">
              <MetricDetail label="WR" value={`${player.winRate}%`} />
              <MetricDetail label="KDA" value={player.kda} />
              <MetricDetail label="GPM" value={player.metrics.gpm} />
              <MetricDetail label="DPM" value={player.metrics.dpm} />
              <MetricDetail label="KP" value={`${player.metrics.kp}%`} />
              <MetricDetail label="Hero pool" value={player.heroPool} />
            </dl>

            <div className="hero-pool">
              <span>Most played</span>
              <div>
                {player.heroes.slice(0, 5).map((hero) => (
                  <span key={hero.name}>
                    {hero.name} <small>{hero.games}</small>
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

type PlayerProfileTab = 'overview' | 'heroes' | 'matches';
type PercentileKey = keyof PlayerScoutingProfile['percentiles'];

const PROFILE_METRICS: Array<{
  key: PercentileKey;
  label: string;
  short: string;
}> = [
  { key: 'farm', label: 'Farm output', short: 'Farm' },
  { key: 'damage', label: 'Damage output', short: 'Damage' },
  {
    key: 'damageEfficiency',
    label: 'Damage efficiency',
    short: 'Efficiency',
  },
  { key: 'survival', label: 'Survival', short: 'Survival' },
  { key: 'teamwork', label: 'Teamfight activity', short: 'Teamwork' },
  { key: 'pressure', label: 'Building pressure', short: 'Pressure' },
  { key: 'frontline', label: 'Frontline load', short: 'Frontline' },
  { key: 'control', label: 'Control contribution', short: 'Control' },
  { key: 'healing', label: 'Healing output', short: 'Healing' },
  { key: 'objective', label: 'Objective activity', short: 'Objective' },
  { key: 'versatility', label: 'Hero versatility', short: 'Versatility' },
  { key: 'lowResource', label: 'Low-resource value', short: 'Low resource' },
];

const ROLE_PROFILE_METRICS: Record<ScoutingRole, PercentileKey[]> = {
  EXP: [
    'damageEfficiency',
    'frontline',
    'survival',
    'teamwork',
    'pressure',
    'versatility',
    'objective',
  ],
  JUNGLE: [
    'objective',
    'farm',
    'teamwork',
    'damageEfficiency',
    'survival',
    'versatility',
  ],
  MID: [
    'teamwork',
    'damageEfficiency',
    'control',
    'damage',
    'survival',
    'versatility',
  ],
  GOLD: [
    'damage',
    'damageEfficiency',
    'pressure',
    'survival',
    'farm',
    'versatility',
  ],
  ROAM: [
    'teamwork',
    'control',
    'frontline',
    'lowResource',
    'survival',
    'healing',
    'versatility',
  ],
};

function PlayerProfileDrawer({
  player,
  allPlayers,
  isSelected,
  onToggleCompare,
  onClose,
}: {
  player: PlayerScoutingProfile;
  allPlayers: PlayerScoutingProfile[];
  isSelected: boolean;
  onToggleCompare: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<PlayerProfileTab>('overview');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const rolePeers = allPlayers
    .filter((candidate) => candidate.role === player.role)
    .sort((a, b) => b.impactScore - a.impactScore);
  const overallRank =
    [...allPlayers]
      .sort((a, b) => b.impactScore - a.impactScore)
      .findIndex((candidate) => candidate.id === player.id) + 1;
  const roleRank =
    rolePeers.findIndex((candidate) => candidate.id === player.id) + 1;
  const scoreGap = Number((player.impactScore - player.surfaceScore).toFixed(1));
  const relevantMetrics = ROLE_PROFILE_METRICS[player.role].map((key) => ({
    key,
    label:
      PROFILE_METRICS.find((metric) => metric.key === key)?.label ?? key,
    value: player.percentiles[key],
  }));
  const sortedMetrics = [...relevantMetrics].sort((a, b) => b.value - a.value);
  const strengths = sortedMetrics.slice(0, 3);
  const watchouts = [...sortedMetrics].reverse().slice(0, 2);

  return (
    <div
      className="player-profile-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="player-profile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${player.name} scouting profile`}
      >
        <header className="profile-hero">
          <button
            type="button"
            className="profile-close"
            aria-label="Close player profile"
            onClick={onClose}
          >
            ×
          </button>
          <div className="profile-identity">
            <span className="profile-avatar">{initials(player.name)}</span>
            <div>
              <div className="profile-kicker">
                <RoleBadge role={player.role} />
                <SignalBadge signal={player.signal} />
              </div>
              <h2>{player.name}</h2>
              <p>
                {player.team} · {player.playerCode || 'No player code'} ·{' '}
                {player.matches} games
              </p>
            </div>
          </div>

          <div className="profile-actions">
            <span>
              Ranked <b>#{roleRank}</b> of {rolePeers.length} {player.role}
              <small>#{overallRank} overall impact</small>
            </span>
            <button
              type="button"
              className={isSelected ? 'secondary-button selected' : 'secondary-button'}
              onClick={onToggleCompare}
            >
              {isSelected ? '✓ Added to compare' : '+ Add to compare'}
            </button>
          </div>
        </header>

        <nav className="profile-tabs" aria-label="Player profile sections">
          <button
            type="button"
            className={tab === 'overview' ? 'active' : ''}
            onClick={() => setTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={tab === 'heroes' ? 'active' : ''}
            onClick={() => setTab('heroes')}
          >
            Hero pool <span>{player.heroes.length}</span>
          </button>
          <button
            type="button"
            className={tab === 'matches' ? 'active' : ''}
            onClick={() => setTab('matches')}
          >
            Match log <span>{player.matchHistory?.length ?? 0}</span>
          </button>
        </nav>

        <div className="profile-content">
          {tab === 'overview' && (
            <PlayerOverview
              player={player}
              scoreGap={scoreGap}
              relevantMetrics={relevantMetrics}
              strengths={strengths}
              watchouts={watchouts}
            />
          )}
          {tab === 'heroes' && <PlayerHeroPool player={player} />}
          {tab === 'matches' && <PlayerMatchLog player={player} />}
        </div>
      </aside>
    </div>
  );
}

function PlayerOverview({
  player,
  scoreGap,
  relevantMetrics,
  strengths,
  watchouts,
}: {
  player: PlayerScoutingProfile;
  scoreGap: number;
  relevantMetrics: Array<{ key: PercentileKey; label: string; value: number }>;
  strengths: Array<{ key: PercentileKey; label: string; value: number }>;
  watchouts: Array<{ key: PercentileKey; label: string; value: number }>;
}) {
  return (
    <>
      <section className="profile-score-grid">
        <ProfileScore
          label="Adjusted impact"
          value={player.impactScore}
          helper="Role-specific output"
          tone="accent"
        />
        <ProfileScore
          label="Surface score"
          value={player.surfaceScore}
          helper="WR + KDA perception"
        />
        <ProfileScore
          label="Impact gap"
          value={`${scoreGap > 0 ? '+' : ''}${scoreGap}`}
          helper="Impact minus surface"
          tone={scoreGap >= 10 ? 'accent' : scoreGap <= -12 ? 'warning' : undefined}
        />
        <ProfileScore
          label="Confidence"
          value={`${player.confidence}%`}
          helper={`${player.roleConfidence}% role certainty`}
        />
      </section>

      <section className={`profile-read profile-read-${player.signal.toLowerCase()}`}>
        <div>
          <span>SCOUTING SIGNAL</span>
          <h3>{signalHeadline(player.signal)}</h3>
          <p>{signalExplanation(player, scoreGap)}</p>
        </div>
        <div className="profile-risk">
          <span>RESOURCE DEPENDENCY</span>
          <strong>{riskLabel(player.dependencyRisk)}</strong>
          <small>{player.dependencyRisk}/100 review risk</small>
        </div>
      </section>

      <div className="profile-two-column">
        <section className="profile-section">
          <div className="profile-section-head">
            <div>
              <p className="eyebrow">ROLE SCORECARD</p>
              <h3>Against other {player.role} players</h3>
            </div>
            <span>Percentile</span>
          </div>
          <div className="profile-role-bars">
            {relevantMetrics.map((metric) => (
              <MetricBar
                key={metric.key}
                label={metric.label}
                value={metric.value}
              />
            ))}
          </div>
        </section>

        <section className="profile-section profile-scout-notes">
          <div className="profile-section-head">
            <div>
              <p className="eyebrow">FAST READ</p>
              <h3>Where to investigate</h3>
            </div>
          </div>
          <div className="scout-note-group positive">
            <span>STRONGEST ROLE SIGNALS</span>
            {strengths.map((metric) => (
              <p key={metric.key}>
                <b>{Math.round(metric.value)}th</b>
                {metric.label}
              </p>
            ))}
          </div>
          <div className="scout-note-group caution">
            <span>REVIEW ON VOD / TRIAL</span>
            {watchouts.map((metric) => (
              <p key={metric.key}>
                <b>{Math.round(metric.value)}th</b>
                {metric.label}
              </p>
            ))}
          </div>
          <p className="profile-disclaimer">
            These are investigation cues, not a final player verdict.
          </p>
        </section>
      </div>

      <section className="profile-section">
        <div className="profile-section-head">
          <div>
            <p className="eyebrow">FULL BOX SCORE</p>
            <h3>Output, resource, and teamfight profile</h3>
          </div>
          <span>{player.matches} game sample</span>
        </div>
        <div className="profile-stat-grid">
          <ProfileStat label="Record" value={`${player.wins}-${player.matches - player.wins}`} />
          <ProfileStat label="Win rate" value={`${player.winRate}%`} />
          <ProfileStat label="KDA" value={player.kda} />
          <ProfileStat
            label="Avg K / D / A"
            value={`${player.avgKills} / ${player.avgDeaths} / ${player.avgAssists}`}
          />
          <ProfileStat label="Kill participation" value={`${player.metrics.kp}%`} />
          <ProfileStat label="Gold / min" value={player.metrics.gpm} />
          <ProfileStat label="Damage / min" value={player.metrics.dpm} />
          <ProfileStat label="Damage taken / min" value={player.metrics.dtpm} />
          <ProfileStat label="Building damage / min" value={player.metrics.buildingDpm} />
          <ProfileStat label="Gold share" value={`${player.metrics.goldShare}%`} />
          <ProfileStat label="Damage share" value={`${player.metrics.damageShare}%`} />
          <ProfileStat
            label="Damage taken share"
            value={`${player.metrics.damageTakenShare}%`}
          />
          <ProfileStat
            label="Damage efficiency"
            value={`${signed(player.metrics.damageEfficiency)} pts`}
          />
          <ProfileStat
            label="Control / min"
            value={`${player.metrics.controlPerMinute}s`}
          />
          <ProfileStat label="Heal / min" value={player.metrics.healPerMinute} />
          <ProfileStat
            label="Objectives / game"
            value={player.metrics.objectivesPerGame}
          />
          <ProfileStat label="Hero pool" value={player.heroPool} />
          <ProfileStat
            label="Versatility index"
            value={player.metrics.versatility}
          />
        </div>
      </section>
    </>
  );
}

function PlayerHeroPool({ player }: { player: PlayerScoutingProfile }) {
  const totalGames = Math.max(player.matches, 1);

  return (
    <section className="profile-section">
      <div className="profile-section-head">
        <div>
          <p className="eyebrow">HERO POOL</p>
          <h3>{player.heroPool} heroes across {player.matches} games</h3>
        </div>
        <span>{player.metrics.versatility} versatility</span>
      </div>

      <div className="hero-pool-summary">
        {player.heroes.slice(0, 5).map((hero, index) => (
          <article key={hero.name}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <strong>{hero.name}</strong>
              <small>
                {hero.games} games · {Math.round((hero.games / totalGames) * 100)}% share
              </small>
            </div>
            <b>{hero.winRate}%</b>
          </article>
        ))}
      </div>

      <div className="profile-table-wrap">
        <table className="profile-data-table">
          <thead>
            <tr>
              <th>Hero</th>
              <th>Games</th>
              <th>Record</th>
              <th>WR</th>
              <th>KDA</th>
              <th>Avg K / D / A</th>
              <th>KP</th>
              <th>GPM</th>
              <th>DPM</th>
              <th>DTPM</th>
              <th>Building</th>
            </tr>
          </thead>
          <tbody>
            {player.heroes.map((hero) => (
              <tr key={hero.name}>
                <td><strong>{hero.name}</strong></td>
                <td>{hero.games}</td>
                <td>{hero.wins}-{hero.games - hero.wins}</td>
                <td>{hero.winRate}%</td>
                <td>{hero.kda ?? '—'}</td>
                <td>
                  {hero.avgKills == null
                    ? 'Re-import required'
                    : `${hero.avgKills} / ${hero.avgDeaths} / ${hero.avgAssists}`}
                </td>
                <td>{hero.kp == null ? '—' : `${hero.kp}%`}</td>
                <td>{hero.gpm ?? '—'}</td>
                <td>{hero.dpm ?? '—'}</td>
                <td>{hero.dtpm ?? '—'}</td>
                <td>{hero.buildingDpm ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {player.heroes.some((hero) => hero.kda == null) && (
        <div className="profile-refresh-note">
          Re-import the two CSVs once to unlock the expanded per-hero metrics.
        </div>
      )}
    </section>
  );
}

function PlayerMatchLog({ player }: { player: PlayerScoutingProfile }) {
  const matches = player.matchHistory ?? [];

  if (matches.length === 0) {
    return (
      <section className="profile-empty">
        <span>↻</span>
        <h3>Re-import CSVs to build the match log</h3>
        <p>
          Your saved workspace was created before per-game profiles existed.
          Replace the data once and this tab will show every match.
        </p>
      </section>
    );
  }

  return (
    <section className="profile-section">
      <div className="profile-section-head">
        <div>
          <p className="eyebrow">MATCH LOG</p>
          <h3>Every game behind the profile</h3>
        </div>
        <span>{matches.length} rows</span>
      </div>
      <div className="profile-table-wrap">
        <table className="profile-data-table match-log-table">
          <thead>
            <tr>
              <th>Date / stage</th>
              <th>Opponent</th>
              <th>Side</th>
              <th>Result</th>
              <th>Hero</th>
              <th>K / D / A</th>
              <th>KDA</th>
              <th>KP</th>
              <th>GPM</th>
              <th>DPM</th>
              <th>DTPM</th>
              <th>Gold share</th>
              <th>Damage share</th>
              <th>Building</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match, index) => (
              <tr key={`${match.battleCode}-${index}`}>
                <td>
                  <strong>{formatProfileDate(match.date)}</strong>
                  <small>{match.stage || match.tournament || '—'}</small>
                </td>
                <td>{match.opponent || '—'}</td>
                <td><span className={`side-chip ${match.side.toLowerCase()}`}>{match.side}</span></td>
                <td>
                  <span className={match.win ? 'result-chip win' : 'result-chip loss'}>
                    {match.win ? 'WIN' : 'LOSS'}
                  </span>
                </td>
                <td><strong>{match.hero}</strong></td>
                <td>{match.kills} / {match.deaths} / {match.assists}</td>
                <td>{match.kda}</td>
                <td>{match.kp}%</td>
                <td>{match.gpm}</td>
                <td>{match.dpm}</td>
                <td>{match.dtpm}</td>
                <td>{match.goldShare}%</td>
                <td>{match.damageShare}%</td>
                <td>{match.buildingDpm}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProfileScore({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: 'accent' | 'warning';
}) {
  return (
    <article className={`profile-score ${tone ? `tone-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function ProfileStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function signalHeadline(signal: PlayerScoutingProfile['signal']) {
  if (signal === 'UNDERVALUED') return 'Production is ahead of reputation.';
  if (signal === 'CONTEXT_BOOSTED') return 'Surface numbers need more context.';
  return 'Surface and adjusted impact broadly agree.';
}

function signalExplanation(player: PlayerScoutingProfile, gap: number) {
  if (player.signal === 'UNDERVALUED') {
    return `Adjusted impact is ${Math.abs(gap)} points above the WR/KDA surface score. Prioritize VOD review and a role-specific trial.`;
  }
  if (player.signal === 'CONTEXT_BOOSTED') {
    return `The WR/KDA surface score is ${Math.abs(gap)} points ahead of adjusted role impact. Check team strength, resource allocation, and repeatability.`;
  }
  return `The impact gap is ${signed(gap)} points. Use the role scorecard to find the clearest strengths and limitations.`;
}

function riskLabel(value: number) {
  if (value >= 55) return 'High';
  if (value >= 25) return 'Medium';
  return 'Low';
}

function signed(value: number) {
  return `${value > 0 ? '+' : ''}${value}`;
}

function formatProfileDate(value: string) {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  }).format(parsed);
}

function TeamView({
  teams,
  activeTeam,
  contestedHeroes,
  selectedTeam,
  onSelectTeam,
}: {
  teams: TeamScoutingProfile[];
  activeTeam: TeamScoutingProfile | null;
  contestedHeroes: ScoutingReport['contestedHeroes'];
  selectedTeam: string;
  onSelectTeam: (team: string) => void;
}) {
  if (!activeTeam) return null;

  return (
    <section className="team-layout">
      <div>
        <div className="compare-picker">
          <div>
            <p className="eyebrow">TEAM PROFILE</p>
            <h2>{activeTeam.name}</h2>
          </div>
          <select value={selectedTeam} onChange={(event) => onSelectTeam(event.target.value)}>
            {teams.map((team) => (
              <option key={team.name} value={team.name}>{team.name}</option>
            ))}
          </select>
        </div>

        <div className="team-stat-grid">
          <MetricDetail label="Games" value={activeTeam.matches} />
          <MetricDetail label="Win rate" value={`${activeTeam.winRate}%`} />
          <MetricDetail label="Blue WR" value={`${activeTeam.blueWinRate}%`} />
          <MetricDetail label="Red WR" value={`${activeTeam.redWinRate}%`} />
          <MetricDetail label="Avg kills" value={activeTeam.avgKills} />
          <MetricDetail label="Draft heroes" value={activeTeam.draftDiversity} />
        </div>

        <div className="draft-grid">
          <DraftList title="First-phase picks" items={activeTeam.firstPhasePicks} />
          <DraftList title="First-phase bans" items={activeTeam.firstPhaseBans} />
          <DraftList title="All picks" items={activeTeam.topPicks} />
          <DraftList title="All bans" items={activeTeam.topBans} />
        </div>
      </div>

      <aside className="contested-card">
        <p className="eyebrow">TOURNAMENT META</p>
        <h3>Most contested heroes</h3>
        <div className="contested-list">
          {contestedHeroes.slice(0, 12).map((hero, index) => (
            <div key={hero.name}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{hero.name}</strong>
              <small>{hero.picks}P · {hero.bans}B</small>
              <b>{hero.presence}</b>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function QualityView({
  report,
  onRoleChange,
}: {
  report: ScoutingReport;
  onRoleChange: (playerId: string, role: ScoutingRole) => void;
}) {
  const warnings = report.quality.filter((issue) => issue.severity === 'warning');
  const roleReviews = report.players.filter((player) => player.roleConfidence < 60);
  return (
    <section className="quality-layout">
      <article className="quality-score-card">
        <span className="quality-mark">{warnings.length === 0 ? 'A' : warnings.length <= 2 ? 'B' : 'C'}</span>
        <div>
          <p className="eyebrow">IMPORT HEALTH</p>
          <h2>{warnings.length === 0 ? 'Ready to review' : 'Usable with flags'}</h2>
          <p>
            Rankings remain reviewable. Warnings are surfaced instead of silently changing the source.
          </p>
        </div>
      </article>

      <div className="quality-list">
        {report.quality.map((issue) => (
          <article key={issue.title} className={`quality-item ${issue.severity}`}>
            <span>{issue.severity === 'warning' ? '!' : 'i'}</span>
            <div>
              <h3>{issue.title}</h3>
              <p>{issue.detail}</p>
            </div>
            <strong>{issue.count}</strong>
          </article>
        ))}
      </div>

      <article className="method-note">
        <p className="eyebrow">HOW TO READ THE SCORE</p>
        <h3>Impact is not a reputation score.</h3>
        <p>
          Players are benchmarked only against the same inferred role. Win rate and KDA
          form the visible “surface score,” while adjusted impact uses role-specific
          efficiency, activity, pressure, objectives, and sample confidence.
        </p>
        <p>
          “Context boosted” means surface stats run meaningfully ahead of adjusted impact.
          It is a review flag—not proof that a player is overrated.
        </p>
      </article>

      {roleReviews.length > 0 && (
        <article className="role-review-card">
          <div>
            <p className="eyebrow">MANUAL REVIEW</p>
            <h3>Confirm uncertain roles</h3>
            <p>Changing a role recalculates every same-role benchmark immediately.</p>
          </div>
          <div className="role-review-list">
            {roleReviews.map((player) => (
              <div key={player.id}>
                <span>
                  <strong>{player.name}</strong>
                  <small>{player.team} · {player.roleConfidence}% inferred</small>
                </span>
                <select
                  value={player.role}
                  aria-label={`Role for ${player.name}`}
                  onChange={(event) =>
                    onRoleChange(player.id, event.target.value as ScoutingRole)
                  }
                >
                  {ROLES.filter((item): item is ScoutingRole => item !== 'ALL').map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}

function RoleBadge({ role }: { role: ScoutingRole }) {
  return <span className={`role-badge role-${role.toLowerCase()}`}>{role}</span>;
}

function Score({ value }: { value: number }) {
  return (
    <span className="impact-score">
      <b>{value}</b>
      <i style={{ width: `${value}%` }} />
    </span>
  );
}

function Confidence({ value }: { value: number }) {
  const label = value >= 80 ? 'High' : value >= 55 ? 'Med' : 'Low';
  return <span className={`confidence confidence-${label.toLowerCase()}`}>{label} · {value}%</span>;
}

function SignalBadge({ signal }: { signal: PlayerScoutingProfile['signal'] }) {
  const labels = {
    UNDERVALUED: 'Undervalued',
    BALANCED: 'Balanced',
    CONTEXT_BOOSTED: 'Context boosted',
  };
  return <span className={`signal signal-${signal.toLowerCase()}`}>{labels[signal]}</span>;
}

function MetricBar({
  label,
  value,
  suffix = ' pct',
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="metric-bar">
      <div><span>{label}</span><strong>{Math.round(value)}{suffix}</strong></div>
      <i><b style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></i>
    </div>
  );
}

function MetricDetail({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DraftList({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; count: number }>;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <article className="draft-list">
      <h3>{title}</h3>
      {items.map((item, index) => (
        <div key={item.name}>
          <span>{index + 1}</span>
          <strong>{item.name}</strong>
          <i><b style={{ width: `${(item.count / max) * 100}%` }} /></i>
          <small>{item.count}</small>
        </div>
      ))}
    </article>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function initials(name: string) {
  const clean = name.replace(/[^a-zA-Z0-9]/g, '');
  return clean.slice(0, 2).toUpperCase() || 'P';
}
