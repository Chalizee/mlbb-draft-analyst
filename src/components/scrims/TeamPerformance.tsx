'use client';

import { useId, useMemo, useState } from 'react';
import HeroAvatar from '@/components/ui/HeroAvatar';
import { HERO_DATA } from '@/data/heroData';
import {
  safeRate,
  scrimDataCompleteness,
  type ScrimGame,
  type ScrimSession,
} from '@/lib/scrimDatabase';
import styles from './TeamPerformance.module.css';

interface TeamPerformanceProps {
  sessions: ScrimSession[];
}

interface TeamGameRecord {
  key: string;
  timestamp: string;
  date: string;
  opponent: string;
  patch: string;
  game: ScrimGame;
}

interface GoldCheckpointSummary {
  minute: 5 | 10 | 15;
  sample: number;
  averageDifference: number;
  leadGames: number;
  behindGames: number;
  tiedGames: number;
  leadRate: number;
}

interface ObjectiveSummary {
  key: 'turtles' | 'lords' | 'towers';
  label: string;
  ours: number;
  theirs: number;
  control: number;
}

interface FirstObjectiveSummary {
  recorded: number;
  ours: number;
  rate: number;
  winsAfterOurs: number;
}

interface SideSummary {
  side: 'Blue' | 'Red';
  games: number;
  wins: number;
  winRate: number;
}

interface DraftHeroSummary {
  name: string;
  picks: number;
  wins: number;
  firstRotation: number;
  priorityWeight: number;
  positions: number[];
}

interface DraftCount {
  name: string;
  count: number;
}

interface DraftPairSummary {
  key: string;
  heroes: [string, string];
  games: number;
  wins: number;
}

interface SideDraftProfile {
  side: 'Blue' | 'Red';
  games: number;
  wins: number;
  draftsRecorded: number;
  openingLabel: string;
  openingPicks: DraftCount[];
  pickPriority: DraftCount[];
  firstPhaseBans: DraftCount[];
}

interface DraftSummary {
  heroes: DraftHeroSummary[];
  ourFirstPhaseBans: DraftCount[];
  enemyFirstPhaseBans: DraftCount[];
  pairs: DraftPairSummary[];
  uniquePicks: number;
  gamesWithDraft: number;
}

interface TeamSnapshot {
  records: TeamGameRecord[];
  games: number;
  wins: number;
  winRate: number;
  averageDuration: number;
  teamKills: number;
  enemyKills: number;
  averageKillDifference: number;
  killShare: number;
  teamDamagePerMinute: number;
  checkpoints: GoldCheckpointSummary[];
  leadGames10: number;
  leadWins10: number;
  leadConversion10: number;
  throwRate10: number;
  behindGames10: number;
  comebackWins10: number;
  comebackRate10: number;
  objectives: ObjectiveSummary[];
  majorObjectiveSample: number;
  majorObjectiveControl: number;
  firstTurtle: FirstObjectiveSummary;
  firstLord: FirstObjectiveSummary;
  sides: SideSummary[];
  draft: DraftSummary;
}

interface RadarMetric {
  key: string;
  label: string;
  raw: string;
  detail: string;
  score: number;
}

interface PatchOption {
  key: string;
  label: string;
  sessions: number;
  games: number;
  latest: string;
}

interface PatchLedgerRow extends PatchOption {
  wins: number;
  winRate: number;
  averageGold10: number | null;
  majorObjectiveControl: number | null;
  leadConversion10: number | null;
}

const ALL_PATCHES = '__all__';
const UNLABELLED_PATCH = '__unlabelled__';
type CoverageScope = 'all' | 'full' | 'legacy';
const numberFormat = new Intl.NumberFormat('en-US');

const HERO_VISUALS = new Map(
  HERO_DATA.flatMap((hero) => [
    [normalizeName(hero.name), hero],
    [normalizeName(hero.slug), hero],
  ]),
);

export default function TeamPerformance({ sessions }: TeamPerformanceProps) {
  const patchOptions = useMemo(() => buildPatchOptions(sessions), [sessions]);
  const [selectedPatch, setSelectedPatch] = useState(ALL_PATCHES);
  const [coverageScope, setCoverageScope] = useState<CoverageScope>('all');
  const activePatch =
    selectedPatch === ALL_PATCHES ||
    patchOptions.some((option) => option.key === selectedPatch)
      ? selectedPatch
      : ALL_PATCHES;
  const filteredSessions = useMemo(
    () =>
      filterSessionsByCoverage(
        filterSessionsByPatch(sessions, activePatch),
        coverageScope,
      ),
    [activePatch, coverageScope, sessions],
  );
  const snapshot = useMemo(
    () => buildTeamSnapshot(filteredSessions),
    [filteredSessions],
  );
  const patchLedger = useMemo(() => buildPatchLedger(sessions), [sessions]);
  const activePatchLabel =
    activePatch === ALL_PATCHES
      ? 'All patches'
      : patchOptions.find((option) => option.key === activePatch)?.label ??
        'All patches';

  return (
    <section className={styles.performance}>
      <header className={styles.heading}>
        <div>
          <p>TEAM PERFORMANCE</p>
          <h2>Read the team through recorded outcomes.</h2>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.patchFilter}>
            <span>PATCH FILTER</span>
            <select
              value={activePatch}
              onChange={(event) => setSelectedPatch(event.target.value)}
            >
              <option value={ALL_PATCHES}>All patches</option>
              {patchOptions.map((option) => (
                <option value={option.key} key={option.key}>
                  {option.label} · {option.games} games
                </option>
              ))}
            </select>
          </label>
          <label className={styles.patchFilter}>
            <span>DATA COVERAGE</span>
            <select
              value={coverageScope}
              onChange={(event) =>
                setCoverageScope(event.target.value as CoverageScope)
              }
            >
              <option value="all">All recorded games</option>
              <option value="full">Full opponent tracking</option>
              <option value="legacy">Legacy / team only</option>
            </select>
          </label>
          <small className={styles.filterSummary}>
            {filteredSessions.length} sessions · {snapshot.games} games
          </small>
        </div>
      </header>

      {snapshot.games === 0 ? (
        <div className={styles.empty}>
          <span>NO TEAM SAMPLE</span>
          <h3>No games match this patch yet.</h3>
          <p>
            Add a patch in Match Input or switch the filter back to All patches.
          </p>
        </div>
      ) : (
        <div className={styles.dashboard}>
          <header className={styles.dashboardHero}>
            <div>
              <span className={styles.scopeBadge}>
                {activePatchLabel} · {coverageLabel(coverageScope)}
              </span>
              <h3>Chalize team sample</h3>
              <p>
                Raw scrim evidence only. Every rate below keeps its recorded
                sample visible.
              </p>
            </div>
            <div className={styles.sampleBadge}>
              <span>RECORDED SAMPLE</span>
              <strong>{snapshot.games}</strong>
              <small>scrim games</small>
            </div>
          </header>

          <TeamScoreGrid snapshot={snapshot} />

          <div className={styles.analysisGrid}>
            <TeamRadarCard snapshot={snapshot} />
            <TeamShapeBreakdown snapshot={snapshot} />
          </div>

          <SideComparison snapshot={snapshot} />
          <EconomyPanel snapshot={snapshot} />
          <ObjectivePanel snapshot={snapshot} />
          <DraftPanel snapshot={snapshot} />
          <PatchLedger rows={patchLedger} />
          <RecentGameLedger records={snapshot.records} />
        </div>
      )}
    </section>
  );
}

function TeamScoreGrid({ snapshot }: { snapshot: TeamSnapshot }) {
  const gold10 = checkpointAt(snapshot, 10);

  return (
    <section className={styles.scoreGrid}>
      <Score
        label="Record"
        value={`${snapshot.wins}-${snapshot.games - snapshot.wins}`}
        detail={`${Math.round(snapshot.winRate)}% win rate`}
      />
      <Score
        label="Average game"
        value={`${snapshot.averageDuration.toFixed(1)}m`}
        detail={`${numberFormat.format(Math.round(snapshot.teamKills))} team kills total`}
      />
      <Score
        label="Gold @10"
        value={
          gold10.sample > 0
            ? formatSigned(gold10.averageDifference)
            : '—'
        }
        detail={`${gold10.sample} recorded games`}
      />
      <Score
        label="Major objective control"
        value={snapshot.majorObjectiveSample > 0 ? `${Math.round(snapshot.majorObjectiveControl)}%` : '—'}
        detail="turtles + lords"
      />
      <Score
        label="Lead conversion @10"
        value={
          snapshot.leadGames10 > 0
            ? `${Math.round(snapshot.leadConversion10)}%`
            : '—'
        }
        detail={`${snapshot.leadGames10} games ahead`}
      />
      <Score
        label="Kill differential"
        value={formatSigned(snapshot.averageKillDifference, 1)}
        detail={`${Math.round(snapshot.killShare)}% kill share`}
      />
    </section>
  );
}

function Score({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className={styles.score}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function TeamRadarCard({ snapshot }: { snapshot: TeamSnapshot }) {
  const metrics = buildTeamRadar(snapshot);

  return (
    <section className={styles.radarCard}>
      <CardHeading
        eyebrow="RECORDED TEAM SHAPE"
        title="Six phases from the selected sample"
        meta="0—100"
      />
      <TeamRadar metrics={metrics} />
      <p className={styles.radarNote}>
        Scores are direct rates from recorded games, not predictions or an
        automatic coach verdict. Draft priorities stay separate below.
      </p>
    </section>
  );
}

function TeamShapeBreakdown({ snapshot }: { snapshot: TeamSnapshot }) {
  const metrics = buildTeamRadar(snapshot);

  return (
    <section className={styles.shapeCard}>
      <CardHeading
        eyebrow="SHAPE BREAKDOWN"
        title="Exact inputs behind the radar"
        meta="RAW DATA"
      />
      <div className={styles.metricBars}>
        {metrics.map((metric) => (
          <div className={styles.metricBar} key={metric.key}>
            <div>
              <span>{metric.label}</span>
              <strong>{metric.raw}</strong>
            </div>
            <div className={styles.barTrack}>
              <i style={{ width: `${metric.score}%` }} />
            </div>
            <small>{metric.detail}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function SideComparison({ snapshot }: { snapshot: TeamSnapshot }) {
  const blue = buildTeamSnapshotFromRecords(
    snapshot.records.filter((record) => record.game.side === 'Blue'),
  );
  const red = buildTeamSnapshotFromRecords(
    snapshot.records.filter((record) => record.game.side === 'Red'),
  );
  const blueGold5 = checkpointAt(blue, 5);
  const redGold5 = checkpointAt(red, 5);
  const blueGold10 = checkpointAt(blue, 10);
  const redGold10 = checkpointAt(red, 10);
  const blueGold15 = checkpointAt(blue, 15);
  const redGold15 = checkpointAt(red, 15);
  const rows: SideMetricRow[] = [
    {
      label: 'Average GD @5',
      blueValue: formatSignedOrDash(blueGold5),
      blueDetail: `${blueGold5.sample} recorded`,
      redValue: formatSignedOrDash(redGold5),
      redDetail: `${redGold5.sample} recorded`,
    },
    {
      label: 'Average GD @10',
      blueValue: formatSignedOrDash(blueGold10),
      blueDetail: `${blueGold10.sample} recorded`,
      redValue: formatSignedOrDash(redGold10),
      redDetail: `${redGold10.sample} recorded`,
    },
    {
      label: 'Average GD @15',
      blueValue: formatSignedOrDash(blueGold15),
      blueDetail: `${blueGold15.sample} recorded`,
      redValue: formatSignedOrDash(redGold15),
      redDetail: `${redGold15.sample} recorded`,
    },
    {
      label: 'First Turtle',
      blueValue:
        blue.firstTurtle.recorded > 0
          ? `${Math.round(blue.firstTurtle.rate)}%`
          : '—',
      blueDetail: `${blue.firstTurtle.ours}/${blue.firstTurtle.recorded} secured`,
      redValue:
        red.firstTurtle.recorded > 0
          ? `${Math.round(red.firstTurtle.rate)}%`
          : '—',
      redDetail: `${red.firstTurtle.ours}/${red.firstTurtle.recorded} secured`,
    },
    {
      label: 'Major objective control',
      blueValue:
        blue.majorObjectiveSample > 0
          ? `${Math.round(blue.majorObjectiveControl)}%`
          : '—',
      blueDetail: `${blue.majorObjectiveSample} total objectives`,
      redValue:
        red.majorObjectiveSample > 0
          ? `${Math.round(red.majorObjectiveControl)}%`
          : '—',
      redDetail: `${red.majorObjectiveSample} total objectives`,
    },
    {
      label: 'Lead conversion @10',
      blueValue:
        blue.leadGames10 > 0 ? `${Math.round(blue.leadConversion10)}%` : '—',
      blueDetail: `${blue.leadWins10}/${blue.leadGames10} leads won`,
      redValue:
        red.leadGames10 > 0 ? `${Math.round(red.leadConversion10)}%` : '—',
      redDetail: `${red.leadWins10}/${red.leadGames10} leads won`,
    },
    {
      label: 'Average kill differential',
      blueValue: blue.games > 0 ? formatSigned(blue.averageKillDifference, 1) : '—',
      blueDetail: `${Math.round(blue.killShare)}% kill share`,
      redValue: red.games > 0 ? formatSigned(red.averageKillDifference, 1) : '—',
      redDetail: `${Math.round(red.killShare)}% kill share`,
    },
  ];

  return (
    <section className={`${styles.sectionCard} ${styles.sideComparison}`}>
      <SectionTitle
        eyebrow="SIDE COMPARISON"
        title="Blue and Red on the same measurement scale"
        meta={`${snapshot.games} SELECTED GAMES`}
      />
      <div className={styles.sideDuel}>
        <SideSummaryCard side="Blue" snapshot={blue} />
        <div className={styles.sideCenter}>
          <span>WIN-RATE DIFFERENCE</span>
          <strong>{formatSideGap(blue, red)}</strong>
          <div className={styles.sideBars}>
            <div>
              <span>BLUE</span>
              <i><b style={{ width: `${blue.winRate}%` }} /></i>
              <strong>{blue.games > 0 ? `${Math.round(blue.winRate)}%` : '—'}</strong>
            </div>
            <div>
              <span>RED</span>
              <i><b style={{ width: `${red.winRate}%` }} /></i>
              <strong>{red.games > 0 ? `${Math.round(red.winRate)}%` : '—'}</strong>
            </div>
          </div>
        </div>
        <SideSummaryCard side="Red" snapshot={red} />
      </div>
      <div className={styles.sideMetricTable}>
        <div className={styles.sideMetricHead}>
          <span>Metric</span>
          <strong>Blue</strong>
          <strong>Red</strong>
        </div>
        {rows.map((row) => (
          <div className={styles.sideMetricRow} key={row.label}>
            <span>{row.label}</span>
            <div>
              <strong>{row.blueValue}</strong>
              <small>{row.blueDetail}</small>
            </div>
            <div>
              <strong>{row.redValue}</strong>
              <small>{row.redDetail}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface SideMetricRow {
  label: string;
  blueValue: string;
  blueDetail: string;
  redValue: string;
  redDetail: string;
}

function SideSummaryCard({
  side,
  snapshot,
}: {
  side: 'Blue' | 'Red';
  snapshot: TeamSnapshot;
}) {
  return (
    <article className={styles.sideSummary} data-side={side.toLowerCase()}>
      <span>{side.toUpperCase()} SIDE</span>
      <strong>{snapshot.games > 0 ? `${Math.round(snapshot.winRate)}%` : '—'}</strong>
      <small>win rate</small>
      <div>
        <b>{snapshot.wins}-{snapshot.games - snapshot.wins}</b>
        <span>{snapshot.games} games</span>
      </div>
    </article>
  );
}

function TeamRadar({ metrics }: { metrics: RadarMetric[] }) {
  const titleId = useId();
  const size = 390;
  const center = size / 2;
  const radius = 116;
  const labelRadius = 153;
  const levels = [20, 40, 60, 80, 100];
  const angleFor = (index: number) =>
    -Math.PI / 2 + (Math.PI * 2 * index) / metrics.length;
  const pointAt = (index: number, value: number, customRadius = radius) => {
    const angle = angleFor(index);
    const scaledRadius = customRadius * (value / 100);
    return {
      x: center + Math.cos(angle) * scaledRadius,
      y: center + Math.sin(angle) * scaledRadius,
    };
  };
  const polygon = (value: number) =>
    metrics
      .map((_, index) => {
        const point = pointAt(index, value);
        return `${point.x},${point.y}`;
      })
      .join(' ');
  const dataPolygon = metrics
    .map((metric, index) => {
      const point = pointAt(index, metric.score);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  return (
    <figure className={styles.radar}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-labelledby={titleId}>
        <title id={titleId}>Selected scrim sample team performance radar</title>
        {levels.map((level) => (
          <polygon
            key={level}
            points={polygon(level)}
            className={level === 100 ? styles.radarOuter : styles.radarGrid}
          />
        ))}
        {metrics.map((metric, index) => {
          const outer = pointAt(index, 100);
          return (
            <line
              key={metric.key}
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              className={styles.radarAxis}
            />
          );
        })}
        <polygon points={dataPolygon} className={styles.radarArea} />
        {metrics.map((metric, index) => {
          const point = pointAt(index, metric.score);
          const label = pointAt(index, 100, labelRadius);
          const anchor =
            label.x < center - 18
              ? 'end'
              : label.x > center + 18
                ? 'start'
                : 'middle';
          return (
            <g key={metric.key}>
              <circle cx={point.x} cy={point.y} r="4" className={styles.radarPoint} />
              <text
                x={label.x}
                y={label.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                className={styles.radarLabel}
              >
                {metric.label}
              </text>
              <text
                x={label.x}
                y={label.y + 13}
                textAnchor={anchor}
                dominantBaseline="middle"
                className={styles.radarValue}
              >
                {Math.round(metric.score)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function EconomyPanel({ snapshot }: { snapshot: TeamSnapshot }) {
  return (
    <section className={styles.sectionCard}>
      <SectionTitle
        eyebrow="ECONOMY & CONVERSION"
        title="Gold checkpoints and what happened from the lead"
        meta="POSITIVE = OUR LEAD"
      />
      <div className={styles.checkpointGrid}>
        {snapshot.checkpoints.map((checkpoint) => (
          <article className={styles.checkpointCard} key={checkpoint.minute}>
            <span>@ {checkpoint.minute} MIN</span>
            <strong
              data-tone={
                checkpoint.averageDifference > 0
                  ? 'positive'
                  : checkpoint.averageDifference < 0
                    ? 'negative'
                    : 'neutral'
              }
            >
              {checkpoint.sample > 0
                ? formatSigned(checkpoint.averageDifference)
                : '—'}
            </strong>
            <small>average gold difference</small>
            <div className={styles.rateRow}>
              <span>{Math.round(checkpoint.leadRate)}% lead rate</span>
              <b>{checkpoint.sample} recorded</b>
            </div>
            <div className={styles.progressTrack}>
              <i style={{ width: `${checkpoint.leadRate}%` }} />
            </div>
            <p>
              {checkpoint.leadGames} ahead · {checkpoint.tiedGames} tied ·{' '}
              {checkpoint.behindGames} behind
            </p>
          </article>
        ))}
      </div>
      <div className={styles.conversionGrid}>
        <ConversionMetric
          label="Lead conversion @10"
          value={
            snapshot.leadGames10 > 0
              ? `${Math.round(snapshot.leadConversion10)}%`
              : '—'
          }
          detail={`${snapshot.leadWins10}-${snapshot.leadGames10 - snapshot.leadWins10} from ${snapshot.leadGames10} leads`}
        />
        <ConversionMetric
          label="Throw rate @10"
          value={
            snapshot.leadGames10 > 0
              ? `${Math.round(snapshot.throwRate10)}%`
              : '—'
          }
          detail={`${snapshot.leadGames10 - snapshot.leadWins10} losses while ahead`}
        />
        <ConversionMetric
          label="Comeback rate @10"
          value={
            snapshot.behindGames10 > 0
              ? `${Math.round(snapshot.comebackRate10)}%`
              : '—'
          }
          detail={`${snapshot.comebackWins10}-${snapshot.behindGames10 - snapshot.comebackWins10} from ${snapshot.behindGames10} deficits`}
        />
        <ConversionMetric
          label="Team damage / min"
          value={numberFormat.format(Math.round(snapshot.teamDamagePerMinute))}
          detail="sum of recorded player damage"
        />
      </div>
    </section>
  );
}

function ConversionMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className={styles.conversionMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ObjectivePanel({ snapshot }: { snapshot: TeamSnapshot }) {
  return (
    <section className={styles.sectionCard}>
      <SectionTitle
        eyebrow="OBJECTIVE CONTROL"
        title="Raw ownership, differentials, and first objective samples"
        meta={`${snapshot.games} GAMES`}
      />
      <div className={styles.objectiveGrid}>
        {snapshot.objectives.map((objective) => {
          const total = objective.ours + objective.theirs;
          return (
            <article className={styles.objectiveCard} key={objective.key}>
              <div>
                <span>{objective.label}</span>
                <b>{total > 0 ? `${Math.round(objective.control)}%` : '—'}</b>
              </div>
              <strong>
                {objective.ours}<i>:</i>{objective.theirs}
              </strong>
              <small>ours · opponent</small>
              <div className={styles.splitTrack}>
                <i style={{ width: `${objective.control}%` }} />
              </div>
              <p>{formatSigned(objective.ours - objective.theirs)} differential</p>
            </article>
          );
        })}
      </div>
      <div className={styles.firstObjectiveGrid}>
        <FirstObjectiveCard label="First Turtle" summary={snapshot.firstTurtle} />
        <FirstObjectiveCard label="First Lord" summary={snapshot.firstLord} />
        {snapshot.sides.map((side) => (
          <article className={styles.firstObjectiveCard} key={side.side}>
            <span>{side.side} side</span>
            <strong>{side.games > 0 ? `${Math.round(side.winRate)}%` : '—'}</strong>
            <small>{side.wins}-{side.games - side.wins} · {side.games} games</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function FirstObjectiveCard({
  label,
  summary,
}: {
  label: string;
  summary: FirstObjectiveSummary;
}) {
  const conversion = safeRate(summary.winsAfterOurs, summary.ours) * 100;

  return (
    <article className={styles.firstObjectiveCard}>
      <span>{label}</span>
      <strong>{summary.recorded > 0 ? `${Math.round(summary.rate)}%` : '—'}</strong>
      <small>
        {summary.ours}/{summary.recorded} secured ·{' '}
        {summary.ours > 0 ? `${Math.round(conversion)}% win after` : 'no win sample'}
      </small>
    </article>
  );
}

function DraftPanel({ snapshot }: { snapshot: TeamSnapshot }) {
  const draft = snapshot.draft;

  return (
    <section className={styles.sectionCard}>
      <SectionTitle
        eyebrow="DRAFT PRIORITY"
        title="Pick order, first-phase bans, and repeated combinations"
        meta={`${draft.gamesWithDraft}/${snapshot.games} DRAFTS RECORDED`}
      />
      {draft.gamesWithDraft === 0 ? (
        <div className={styles.inlineEmpty}>
          Draft tables appear after picks or bans are recorded in Match Input.
        </div>
      ) : (
        <>
          <div className={styles.draftMetaGrid}>
            <ConversionMetric
              label="Unique picks"
              value={String(draft.uniquePicks)}
              detail={`${draft.heroes.reduce((sum, hero) => sum + hero.picks, 0)} total pick entries`}
            />
            <ConversionMetric
              label="Early selections"
              value={String(draft.heroes.reduce((sum, hero) => sum + hero.firstRotation, 0))}
              detail="team pick slots P1—P3"
            />
            <ConversionMetric
              label="Our phase-one bans"
              value={String(draft.ourFirstPhaseBans.reduce((sum, hero) => sum + hero.count, 0))}
              detail="first three ban slots"
            />
            <ConversionMetric
              label="Enemy phase-one bans"
              value={String(draft.enemyFirstPhaseBans.reduce((sum, hero) => sum + hero.count, 0))}
              detail="first three bans against us"
            />
          </div>

          <SideDraftPriority records={snapshot.records} />

          <div className={styles.tableWrap}>
            <table className={styles.priorityTable}>
              <thead>
                <tr>
                  <th>Hero</th>
                  <th>Picks</th>
                  <th>Early selections</th>
                  <th>Pick slots</th>
                  <th>Record</th>
                  <th>WR</th>
                </tr>
              </thead>
              <tbody>
                {draft.heroes.slice(0, 10).map((hero) => {
                  const visual = heroVisual(hero.name);
                  return (
                    <tr key={hero.name}>
                      <td>
                        <div className={styles.heroCell}>
                          <HeroAvatar
                            name={hero.name}
                            imageUrl={visual?.imageUrl}
                            size="sm"
                          />
                          <div>
                            <strong>{hero.name}</strong>
                            <small>{visual?.role ?? 'Recorded pick'}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{hero.picks}</strong>
                        <small>{Math.round(safeRate(hero.picks, snapshot.games) * 100)}% games</small>
                      </td>
                      <td>
                        <strong>{hero.firstRotation}</strong>
                        <small>{Math.round(safeRate(hero.firstRotation, hero.picks) * 100)}% picks</small>
                      </td>
                      <td><span className={styles.slotLine}>{formatPickSlots(hero.positions)}</span></td>
                      <td><strong>{hero.wins}-{hero.picks - hero.wins}</strong></td>
                      <td><b>{Math.round(safeRate(hero.wins, hero.picks) * 100)}%</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.draftEvidenceGrid}>
            <DraftCountList
              title="Our first-phase bans"
              entries={draft.ourFirstPhaseBans}
              games={snapshot.games}
            />
            <DraftCountList
              title="Enemy first-phase bans"
              entries={draft.enemyFirstPhaseBans}
              games={snapshot.games}
            />
            <DraftPairs pairs={draft.pairs} />
          </div>
        </>
      )}
    </section>
  );
}

function SideDraftPriority({ records }: { records: TeamGameRecord[] }) {
  const profiles: SideDraftProfile[] = [
    buildOurSideDraft(records, 'Blue'),
    buildOurSideDraft(records, 'Red'),
  ];

  return (
    <section className={styles.sideDraftSection}>
      <header>
        <div>
          <span>DRAFT BY SIDE</span>
          <h4>Our First Pick vs Second Pick priorities</h4>
        </div>
        <small>PICK ORDER PRESERVED</small>
      </header>
      <div className={styles.sideDraftGrid}>
        {profiles.map((profile) => (
          <article
            className={styles.sideDraftCard}
            data-side={profile.side.toLowerCase()}
            key={profile.side}
          >
            <header>
              <div>
                <span>{profile.side.toUpperCase()} SIDE</span>
                <h5>
                  {profile.side === 'Blue'
                    ? 'We have First Pick'
                    : 'We have Second Pick'}
                </h5>
              </div>
              <div>
                <strong>{profile.wins}-{profile.games - profile.wins}</strong>
                <small>{profile.draftsRecorded}/{profile.games} drafts</small>
              </div>
            </header>

            {profile.games === 0 ? (
              <div className={styles.sideDraftEmpty}>No games on this side.</div>
            ) : (
              <div className={styles.sideDraftLists}>
                <SideDraftList
                  title={profile.openingLabel}
                  entries={profile.openingPicks}
                  games={profile.games}
                />
                <SideDraftList
                  title="ALL PICK PRIORITY"
                  entries={profile.pickPriority}
                  games={profile.games}
                />
                <SideDraftList
                  title="FIRST-PHASE BAN PRIORITY"
                  entries={profile.firstPhaseBans}
                  games={profile.games}
                />
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function SideDraftList({
  title,
  entries,
  games,
}: {
  title: string;
  entries: DraftCount[];
  games: number;
}) {
  return (
    <section className={styles.sideDraftList}>
      <h6>{title}</h6>
      {entries.length === 0 ? (
        <p>No recorded data</p>
      ) : (
        <div>
          {entries.slice(0, 6).map((entry) => {
            const visual = heroVisual(entry.name);
            return (
              <article key={entry.name}>
                <HeroAvatar
                  name={entry.name}
                  imageUrl={visual?.imageUrl}
                  size="xs"
                />
                <span>{entry.name}</span>
                <strong>{entry.count}</strong>
                <small>{Math.round(safeRate(entry.count, games) * 100)}%</small>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DraftCountList({
  title,
  entries,
  games,
}: {
  title: string;
  entries: DraftCount[];
  games: number;
}) {
  const max = entries[0]?.count ?? 0;

  return (
    <section className={styles.evidenceCard}>
      <h5>{title}</h5>
      {entries.length === 0 ? (
        <p>No ban data</p>
      ) : (
        <div className={styles.draftCountList}>
          {entries.slice(0, 6).map((entry) => {
            const visual = heroVisual(entry.name);
            return (
              <div key={entry.name}>
                <HeroAvatar
                  name={entry.name}
                  imageUrl={visual?.imageUrl}
                  size="xs"
                />
                <span>{entry.name}</span>
                <i><b style={{ width: `${safeRate(entry.count, max) * 100}%` }} /></i>
                <strong>{entry.count}</strong>
                <small>{Math.round(safeRate(entry.count, games) * 100)}%</small>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DraftPairs({ pairs }: { pairs: DraftPairSummary[] }) {
  return (
    <section className={styles.evidenceCard}>
      <h5>Repeated pick pairs</h5>
      {pairs.length === 0 ? (
        <p>No pair data</p>
      ) : (
        <div className={styles.pairList}>
          {pairs.slice(0, 6).map((pair) => (
            <article key={pair.key}>
              <div className={styles.pairHeroes}>
                {pair.heroes.map((hero) => {
                  const visual = heroVisual(hero);
                  return (
                    <HeroAvatar
                      key={hero}
                      name={hero}
                      imageUrl={visual?.imageUrl}
                      size="xs"
                    />
                  );
                })}
              </div>
              <span>{pair.heroes.join(' + ')}</span>
              <strong>{pair.wins}-{pair.games - pair.wins}</strong>
              <small>{pair.games}g</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PatchLedger({ rows }: { rows: PatchLedgerRow[] }) {
  return (
    <section className={styles.sectionCard}>
      <SectionTitle
        eyebrow="PATCH LEDGER"
        title="Compare raw team results between recorded patches"
        meta={`${rows.length} PATCH SAMPLES`}
      />
      {rows.length === 0 ? (
        <div className={styles.inlineEmpty}>Add a patch to build this comparison.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.patchTable}>
            <thead>
              <tr>
                <th>Patch</th>
                <th>Sessions</th>
                <th>Games</th>
                <th>Record</th>
                <th>Win rate</th>
                <th>Avg GD @10</th>
                <th>Major obj.</th>
                <th>Lead conv.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td><strong>{row.label}</strong></td>
                  <td>{row.sessions}</td>
                  <td>{row.games}</td>
                  <td><strong>{row.wins}-{row.games - row.wins}</strong></td>
                  <td><b>{Math.round(row.winRate)}%</b></td>
                  <td>{row.averageGold10 === null ? '—' : formatSigned(row.averageGold10)}</td>
                  <td>{row.majorObjectiveControl === null ? '—' : `${Math.round(row.majorObjectiveControl)}%`}</td>
                  <td>{row.leadConversion10 === null ? '—' : `${Math.round(row.leadConversion10)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RecentGameLedger({ records }: { records: TeamGameRecord[] }) {
  return (
    <section className={styles.sectionCard}>
      <SectionTitle
        eyebrow="GAME LEDGER"
        title="Latest games in the selected patch view"
        meta="NEWEST FIRST"
      />
      <div className={styles.tableWrap}>
        <table className={styles.gameTable}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Opponent</th>
              <th>Patch</th>
              <th>Side</th>
              <th>Result</th>
              <th>GD @10</th>
              <th>Turtle</th>
              <th>Lord</th>
              <th>Tower</th>
            </tr>
          </thead>
          <tbody>
            {records.slice(0, 12).map((record) => {
              const gold10 = goldDifference(record.game, 10);
              return (
                <tr key={record.key}>
                  <td>{formatDate(record.date)}</td>
                  <td><strong>{record.opponent || 'Untitled scrim'}</strong><small>Game {record.game.number}</small></td>
                  <td>{record.patch || 'Unlabelled'}</td>
                  <td><span className={styles.sideBadge}>{record.game.side}</span></td>
                  <td>
                    <span className={record.game.result === 'Win' ? styles.win : styles.loss}>
                      {record.game.result.toUpperCase()}
                    </span>
                  </td>
                  <td>{gold10 === null ? '—' : formatSigned(gold10)}</td>
                  <td>{numeric(record.game.turtlesFor)}:{numeric(record.game.turtlesAgainst)}</td>
                  <td>{numeric(record.game.lordsFor)}:{numeric(record.game.lordsAgainst)}</td>
                  <td>{numeric(record.game.towersFor)}:{numeric(record.game.towersAgainst)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CardHeading({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string;
  title: string;
  meta: string;
}) {
  return (
    <div className={styles.cardHeading}>
      <div>
        <p>{eyebrow}</p>
        <h4>{title}</h4>
      </div>
      <span>{meta}</span>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string;
  title: string;
  meta: string;
}) {
  return (
    <div className={styles.sectionTitle}>
      <div>
        <p>{eyebrow}</p>
        <h4>{title}</h4>
      </div>
      <span>{meta}</span>
    </div>
  );
}

function buildTeamSnapshot(sessions: ScrimSession[]): TeamSnapshot {
  const records = buildGameRecords(sessions);
  return buildTeamSnapshotFromRecords(records);
}

function buildTeamSnapshotFromRecords(
  records: TeamGameRecord[],
): TeamSnapshot {
  const games = records.length;
  const wins = records.filter((record) => record.game.result === 'Win').length;
  const minutes = records.reduce(
    (sum, record) => sum + Math.max(numeric(record.game.durationMinutes), 1),
    0,
  );
  const teamKills = records.reduce(
    (sum, record) => sum + numeric(record.game.teamKills),
    0,
  );
  const enemyKills = records.reduce(
    (sum, record) => sum + numeric(record.game.enemyKills),
    0,
  );
  const teamDamage = records.reduce(
    (sum, record) =>
      sum +
      record.game.players.reduce(
        (playerSum, player) => playerSum + numeric(player.damageDealt),
        0,
      ),
    0,
  );
  const checkpoints = ([5, 10, 15] as const).map((minute) =>
    buildGoldCheckpoint(records, minute),
  );
  const gold10Records = records
    .map((record) => ({ record, difference: goldDifference(record.game, 10) }))
    .filter(
      (entry): entry is { record: TeamGameRecord; difference: number } =>
        entry.difference !== null,
    );
  const lead10 = gold10Records.filter((entry) => entry.difference > 0);
  const behind10 = gold10Records.filter((entry) => entry.difference < 0);
  const leadWins10 = lead10.filter(
    (entry) => entry.record.game.result === 'Win',
  ).length;
  const comebackWins10 = behind10.filter(
    (entry) => entry.record.game.result === 'Win',
  ).length;
  const objectives = buildObjectives(records);
  const turtles = objectives.find((objective) => objective.key === 'turtles');
  const lords = objectives.find((objective) => objective.key === 'lords');
  const majorFor = (turtles?.ours ?? 0) + (lords?.ours ?? 0);
  const majorAgainst = (turtles?.theirs ?? 0) + (lords?.theirs ?? 0);

  return {
    records,
    games,
    wins,
    winRate: safeRate(wins, games) * 100,
    averageDuration: safeRate(minutes, games),
    teamKills,
    enemyKills,
    averageKillDifference: safeRate(teamKills - enemyKills, games),
    killShare: safeRate(teamKills, teamKills + enemyKills) * 100,
    teamDamagePerMinute: safeRate(teamDamage, minutes),
    checkpoints,
    leadGames10: lead10.length,
    leadWins10,
    leadConversion10: safeRate(leadWins10, lead10.length) * 100,
    throwRate10: safeRate(lead10.length - leadWins10, lead10.length) * 100,
    behindGames10: behind10.length,
    comebackWins10,
    comebackRate10: safeRate(comebackWins10, behind10.length) * 100,
    objectives,
    majorObjectiveSample: majorFor + majorAgainst,
    majorObjectiveControl: safeRate(majorFor, majorFor + majorAgainst) * 100,
    firstTurtle: buildFirstObjective(records, 'firstTurtle'),
    firstLord: buildFirstObjective(records, 'firstLord'),
    sides: (['Blue', 'Red'] as const).map((side) => buildSide(records, side)),
    draft: buildDraftSummary(records),
  };
}

function buildGameRecords(sessions: ScrimSession[]): TeamGameRecord[] {
  return sessions
    .flatMap((session) =>
      session.games.map((game) => ({
        key: `${session.id}-${game.id}`,
        timestamp: `${session.date || '0000-00-00'}T${session.time || '00:00'}-${String(game.number).padStart(3, '0')}`,
        date: session.date,
        opponent: session.opponent,
        patch: session.patch.trim(),
        game,
      })),
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function buildGoldCheckpoint(
  records: TeamGameRecord[],
  minute: 5 | 10 | 15,
): GoldCheckpointSummary {
  const differences = records
    .map((record) => goldDifference(record.game, minute))
    .filter((value): value is number => value !== null);
  const leadGames = differences.filter((value) => value > 0).length;
  const behindGames = differences.filter((value) => value < 0).length;
  const tiedGames = differences.length - leadGames - behindGames;

  return {
    minute,
    sample: differences.length,
    averageDifference: safeRate(
      differences.reduce((sum, value) => sum + value, 0),
      differences.length,
    ),
    leadGames,
    behindGames,
    tiedGames,
    leadRate: safeRate(leadGames, differences.length) * 100,
  };
}

function goldDifference(
  game: ScrimGame,
  minute: 5 | 10 | 15,
): number | null {
  const fields = {
    5: { ours: game.ourGold5, theirs: game.enemyGold5, stored: game.goldDiff5 },
    10: { ours: game.ourGold10, theirs: game.enemyGold10, stored: game.goldDiff10 },
    15: { ours: game.ourGold15, theirs: game.enemyGold15, stored: game.goldDiff15 },
  }[minute];
  const ours = numeric(fields.ours);
  const theirs = numeric(fields.theirs);
  const stored = numeric(fields.stored);

  if (ours !== 0 || theirs !== 0) return ours - theirs;
  if (stored !== 0) return stored;
  return null;
}

function buildObjectives(records: TeamGameRecord[]): ObjectiveSummary[] {
  const definitions: Array<{
    key: ObjectiveSummary['key'];
    label: string;
    ours: (game: ScrimGame) => number;
    theirs: (game: ScrimGame) => number;
  }> = [
    {
      key: 'turtles',
      label: 'Turtles',
      ours: (game) => numeric(game.turtlesFor),
      theirs: (game) => numeric(game.turtlesAgainst),
    },
    {
      key: 'lords',
      label: 'Lords',
      ours: (game) => numeric(game.lordsFor),
      theirs: (game) => numeric(game.lordsAgainst),
    },
    {
      key: 'towers',
      label: 'Towers',
      ours: (game) => numeric(game.towersFor),
      theirs: (game) => numeric(game.towersAgainst),
    },
  ];

  return definitions.map((definition) => {
    const ours = records.reduce(
      (sum, record) => sum + definition.ours(record.game),
      0,
    );
    const theirs = records.reduce(
      (sum, record) => sum + definition.theirs(record.game),
      0,
    );
    return {
      key: definition.key,
      label: definition.label,
      ours,
      theirs,
      control: safeRate(ours, ours + theirs) * 100,
    };
  });
}

function buildFirstObjective(
  records: TeamGameRecord[],
  field: 'firstTurtle' | 'firstLord',
): FirstObjectiveSummary {
  const recorded = records.filter((record) => record.game[field] !== 'None');
  const ours = recorded.filter((record) => record.game[field] === 'Us');
  return {
    recorded: recorded.length,
    ours: ours.length,
    rate: safeRate(ours.length, recorded.length) * 100,
    winsAfterOurs: ours.filter((record) => record.game.result === 'Win').length,
  };
}

function buildSide(
  records: TeamGameRecord[],
  side: 'Blue' | 'Red',
): SideSummary {
  const sideRecords = records.filter((record) => record.game.side === side);
  const wins = sideRecords.filter((record) => record.game.result === 'Win').length;
  return {
    side,
    games: sideRecords.length,
    wins,
    winRate: safeRate(wins, sideRecords.length) * 100,
  };
}

function buildDraftSummary(records: TeamGameRecord[]): DraftSummary {
  const heroMap = new Map<string, DraftHeroSummary>();
  const ourBanMap = new Map<string, DraftCount>();
  const enemyBanMap = new Map<string, DraftCount>();
  const pairMap = new Map<string, DraftPairSummary>();
  let gamesWithDraft = 0;

  records.forEach((record) => {
    const picks = uniqueHeroes(record.game.ourPicks);
    const hasDraft =
      picks.length > 0 ||
      record.game.ourBans.some((hero) => hero.trim()) ||
      record.game.enemyBans.some((hero) => hero.trim());
    if (hasDraft) gamesWithDraft += 1;

    picks.forEach((name, index) => {
      const key = normalizeName(name);
      const hero = heroMap.get(key) ?? {
        name,
        picks: 0,
        wins: 0,
        firstRotation: 0,
        priorityWeight: 0,
        positions: [0, 0, 0, 0, 0],
      };
      hero.picks += 1;
      hero.wins += record.game.result === 'Win' ? 1 : 0;
      hero.firstRotation += index < 3 ? 1 : 0;
      hero.priorityWeight += Math.max(1, 5 - index);
      if (index < 5) hero.positions[index] += 1;
      heroMap.set(key, hero);
    });

    countDraftValues(record.game.ourBans.slice(0, 3), ourBanMap);
    countDraftValues(record.game.enemyBans.slice(0, 3), enemyBanMap);

    for (let first = 0; first < picks.length; first += 1) {
      for (let second = first + 1; second < picks.length; second += 1) {
        const pairHeroes = [picks[first], picks[second]].sort((a, b) =>
          normalizeName(a).localeCompare(normalizeName(b)),
        ) as [string, string];
        const key = pairHeroes.map(normalizeName).join('|');
        const pair = pairMap.get(key) ?? {
          key,
          heroes: pairHeroes,
          games: 0,
          wins: 0,
        };
        pair.games += 1;
        pair.wins += record.game.result === 'Win' ? 1 : 0;
        pairMap.set(key, pair);
      }
    }
  });

  return {
    heroes: [...heroMap.values()].sort(
      (a, b) =>
        b.priorityWeight - a.priorityWeight ||
        b.picks - a.picks ||
        b.wins - a.wins ||
        a.name.localeCompare(b.name),
    ),
    ourFirstPhaseBans: sortDraftCounts(ourBanMap),
    enemyFirstPhaseBans: sortDraftCounts(enemyBanMap),
    pairs: [...pairMap.values()].sort(
      (a, b) =>
        b.games - a.games ||
        b.wins - a.wins ||
        a.heroes.join(' ').localeCompare(b.heroes.join(' ')),
    ),
    uniquePicks: heroMap.size,
    gamesWithDraft,
  };
}

function buildOurSideDraft(
  records: TeamGameRecord[],
  side: 'Blue' | 'Red',
): SideDraftProfile {
  const sideRecords = records.filter((record) => record.game.side === side);
  const openingSize = side === 'Blue' ? 1 : 2;
  const openingPicks = new Map<string, DraftCount>();
  const pickPriority = new Map<string, DraftCount>();
  const firstPhaseBans = new Map<string, DraftCount>();
  let draftsRecorded = 0;

  sideRecords.forEach((record) => {
    const picks = record.game.ourPicks;
    const bans = record.game.ourBans;
    if (picks.some((hero) => hero.trim()) || bans.some((hero) => hero.trim())) {
      draftsRecorded += 1;
    }
    countDraftValues(picks.slice(0, openingSize), openingPicks);
    countDraftValues(picks, pickPriority);
    countDraftValues(bans.slice(0, 3), firstPhaseBans);
  });

  return {
    side,
    games: sideRecords.length,
    wins: sideRecords.filter((record) => record.game.result === 'Win').length,
    draftsRecorded,
    openingLabel: side === 'Blue' ? 'P1 OPENING PRIORITY' : 'R1—R2 OPENING PRIORITY',
    openingPicks: sortDraftCounts(openingPicks),
    pickPriority: sortDraftCounts(pickPriority),
    firstPhaseBans: sortDraftCounts(firstPhaseBans),
  };
}

function countDraftValues(values: string[], target: Map<string, DraftCount>) {
  uniqueHeroes(values).forEach((name) => {
    const key = normalizeName(name);
    const entry = target.get(key) ?? { name, count: 0 };
    entry.count += 1;
    target.set(key, entry);
  });
}

function sortDraftCounts(values: Map<string, DraftCount>) {
  return [...values.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

function uniqueHeroes(values: string[]) {
  const heroes = new Map<string, string>();
  values.forEach((value) => {
    const name = canonicalHeroName(value);
    if (name) heroes.set(normalizeName(name), name);
  });
  return [...heroes.values()];
}

function buildTeamRadar(snapshot: TeamSnapshot): RadarMetric[] {
  const gold5 = checkpointAt(snapshot, 5);
  const gold10 = checkpointAt(snapshot, 10);
  const gold15 = checkpointAt(snapshot, 15);
  const blue = snapshot.sides.find((side) => side.side === 'Blue');
  const red = snapshot.sides.find((side) => side.side === 'Red');
  const objectiveScores = snapshot.objectives
    .filter((objective) => objective.ours + objective.theirs > 0)
    .map((objective) => objective.control);
  const sideScore =
    (blue?.games ?? 0) > 0 && (red?.games ?? 0) > 0
      ? Math.min(blue?.winRate ?? 0, red?.winRate ?? 0)
      : (blue?.games ?? 0) > 0
        ? blue?.winRate ?? 0
        : red?.winRate ?? 0;
  const earlyScore = meanRecorded([
    gold5.sample > 0 ? gold5.leadRate : null,
    snapshot.firstTurtle.recorded > 0 ? snapshot.firstTurtle.rate : null,
  ]);
  const economyScore = meanRecorded([
    gold10.sample > 0 ? gold10.leadRate : null,
    gold15.sample > 0 ? gold15.leadRate : null,
  ]);
  const objectiveScore = meanRecorded(
    objectiveScores.length > 0 ? objectiveScores : [null],
  );
  const fightScore =
    snapshot.teamKills + snapshot.enemyKills > 0
      ? snapshot.killShare
      : 0;
  const closingScore =
    snapshot.leadGames10 > 0 ? snapshot.leadConversion10 : 0;

  return [
    {
      key: 'early',
      label: 'EARLY',
      raw: `${gold5.sample > 0 ? `${Math.round(gold5.leadRate)}%` : '—'} lead · ${snapshot.firstTurtle.recorded > 0 ? `${Math.round(snapshot.firstTurtle.rate)}%` : '—'} FT`,
      detail: `GD@5 and first Turtle · ${Math.max(gold5.sample, snapshot.firstTurtle.recorded)} recorded`,
      score: clampScore(earlyScore),
    },
    {
      key: 'economy',
      label: 'ECONOMY',
      raw: `${formatSignedOrDash(gold10)} · ${formatSignedOrDash(gold15)}`,
      detail: `average GD@10 / GD@15 · ${gold10.sample}/${gold15.sample} recorded`,
      score: clampScore(economyScore),
    },
    {
      key: 'objective',
      label: 'OBJECTIVE',
      raw:
        snapshot.majorObjectiveSample > 0
          ? `${Math.round(snapshot.majorObjectiveControl)}% major`
          : 'No objective sample',
      detail: 'mean Turtle, Lord, and Tower control rates',
      score: clampScore(objectiveScore),
    },
    {
      key: 'fight',
      label: 'FIGHT',
      raw: `${Math.round(snapshot.killShare)}% kills`,
      detail: `${formatSigned(snapshot.averageKillDifference, 1)} average kill differential`,
      score: clampScore(fightScore),
    },
    {
      key: 'side',
      label: 'SIDE FORM',
      raw: `B ${Math.round(blue?.winRate ?? 0)}% · R ${Math.round(red?.winRate ?? 0)}%`,
      detail: `${blue?.games ?? 0} Blue / ${red?.games ?? 0} Red games`,
      score: clampScore(sideScore),
    },
    {
      key: 'closing',
      label: 'CLOSING',
      raw:
        snapshot.leadGames10 > 0
          ? `${Math.round(snapshot.leadConversion10)}%`
          : 'No lead sample',
      detail: `${snapshot.leadWins10}/${snapshot.leadGames10} wins while ahead @10`,
      score: clampScore(closingScore),
    },
  ];
}

function buildPatchOptions(sessions: ScrimSession[]): PatchOption[] {
  const groups = new Map<string, PatchOption>();
  sessions.forEach((session) => {
    const cleanPatch = session.patch.trim();
    const key = cleanPatch ? normalizeName(cleanPatch) : UNLABELLED_PATCH;
    const timestamp = `${session.date || '0000-00-00'}T${session.time || '00:00'}`;
    const group = groups.get(key) ?? {
      key,
      label: cleanPatch || 'Unlabelled',
      sessions: 0,
      games: 0,
      latest: timestamp,
    };
    group.sessions += 1;
    group.games += session.games.length;
    if (timestamp > group.latest) group.latest = timestamp;
    groups.set(key, group);
  });

  return [...groups.values()].sort((a, b) => {
    if (a.key === UNLABELLED_PATCH) return 1;
    if (b.key === UNLABELLED_PATCH) return -1;
    return b.latest.localeCompare(a.latest) || a.label.localeCompare(b.label);
  });
}

function buildPatchLedger(sessions: ScrimSession[]): PatchLedgerRow[] {
  const options = buildPatchOptions(sessions);
  return options.map((option) => {
    const snapshot = buildTeamSnapshot(filterSessionsByPatch(sessions, option.key));
    const gold10 = checkpointAt(snapshot, 10);
    return {
      ...option,
      wins: snapshot.wins,
      winRate: snapshot.winRate,
      averageGold10: gold10.sample > 0 ? gold10.averageDifference : null,
      majorObjectiveControl:
        snapshot.majorObjectiveSample > 0
          ? snapshot.majorObjectiveControl
          : null,
      leadConversion10:
        snapshot.leadGames10 > 0 ? snapshot.leadConversion10 : null,
    };
  });
}

function filterSessionsByPatch(sessions: ScrimSession[], patchKey: string) {
  if (patchKey === ALL_PATCHES) return sessions;
  return sessions.filter((session) => {
    const cleanPatch = session.patch.trim();
    const key = cleanPatch ? normalizeName(cleanPatch) : UNLABELLED_PATCH;
    return key === patchKey;
  });
}

function filterSessionsByCoverage(
  sessions: ScrimSession[],
  coverage: CoverageScope,
) {
  if (coverage === 'all') return sessions;
  return sessions
    .map((session) => ({
      ...session,
      games: session.games.filter((game) => {
        const full = scrimDataCompleteness(game) === 'Full tracking';
        return coverage === 'full' ? full : !full;
      }),
    }))
    .filter((session) => session.games.length > 0);
}

function coverageLabel(coverage: CoverageScope) {
  if (coverage === 'full') return 'Full tracking';
  if (coverage === 'legacy') return 'Legacy / team only';
  return 'All coverage';
}

function checkpointAt(snapshot: TeamSnapshot, minute: 5 | 10 | 15) {
  return (
    snapshot.checkpoints.find((checkpoint) => checkpoint.minute === minute) ?? {
      minute,
      sample: 0,
      averageDifference: 0,
      leadGames: 0,
      behindGames: 0,
      tiedGames: 0,
      leadRate: 0,
    }
  );
}

function formatPickSlots(positions: number[]) {
  const values = positions
    .map((count, index) => (count > 0 ? `P${index + 1} ×${count}` : ''))
    .filter(Boolean);
  return values.join(' · ') || '—';
}

function formatSigned(value: number, digits = 0) {
  const rounded = Number(value.toFixed(digits));
  const formatted = digits > 0 ? rounded.toFixed(digits) : numberFormat.format(rounded);
  return rounded > 0 ? `+${formatted}` : formatted;
}

function formatSignedOrDash(checkpoint: GoldCheckpointSummary) {
  return checkpoint.sample > 0 ? formatSigned(checkpoint.averageDifference) : '—';
}

function formatSideGap(blue: TeamSnapshot, red: TeamSnapshot) {
  if (blue.games === 0 || red.games === 0) return 'Need both sides';
  const difference = blue.winRate - red.winRate;
  if (Math.abs(difference) < 0.05) return '0 pp';
  return difference > 0
    ? `Blue +${Math.round(difference)} pp`
    : `Red +${Math.round(Math.abs(difference))} pp`;
}

function meanRecorded(values: Array<number | null>) {
  const recorded = values.filter((value): value is number => value !== null);
  return safeRate(
    recorded.reduce((sum, value) => sum + value, 0),
    recorded.length,
  );
}

function clampScore(value: number) {
  return Math.min(100, Math.max(0, value));
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function canonicalHeroName(value: string) {
  const clean = value.trim();
  return normalizeName(clean) === 'wu zetian' ? 'Zetian' : clean;
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function heroVisual(name: string) {
  const hero = HERO_VISUALS.get(normalizeName(canonicalHeroName(name)));
  if (!hero) return null;
  return {
    ...hero,
    imageUrl: `/images/heroes/avatars/${hero.slug}.webp`,
  };
}

function formatDate(value: string) {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  }).format(new Date(`${value}T00:00:00`));
}
