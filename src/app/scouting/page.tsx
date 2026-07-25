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
                    <div className="player-name">
                      <span>{initials(player.name)}</span>
                      <div>
                        <strong>{player.name}</strong>
                        <small>{player.team}</small>
                      </div>
                    </div>
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
