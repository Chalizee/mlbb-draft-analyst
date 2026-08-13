'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { HERO_DATA } from '@/data/heroData';
import HeroAvatar from '@/components/ui/HeroAvatar';
import {
  buildDraftIntelligence,
  type DraftRecommendationContext,
} from '@/components/scrims/DraftIntelligence';
import {
  makeId,
  type ObjectiveOwner,
  type ScrimGame,
  type ScrimLiveClock,
  type ScrimLiveEvent,
  type ScrimLiveNote,
  type ScrimLiveNoteCategory,
  type ScrimResult,
  type ScrimSide,
  type ScrimSession,
} from '@/lib/scrimDatabase';
import styles from './LiveMatchMode.module.css';

type LiveStage = 'draft' | 'game';
type DraftKind = 'ban' | 'pick';
type HeroRoleFilter = 'All' | 'Tank' | 'Marksman' | 'Fighter' | 'Assassin' | 'Mage' | 'Support';
type DraftField = 'ourBans' | 'enemyBans' | 'ourPicks' | 'enemyPicks';
type GoldMinute = 5 | 10 | 15;

interface LiveMatchModeProps {
  game: ScrimGame;
  opponent: string;
  patch: string;
  sessions: ScrimSession[];
  saveState: string;
  onChange: (game: ScrimGame) => void;
  onExit: () => void;
  onFinish: (game: ScrimGame) => void;
}

interface DraftStep {
  side: ScrimSide;
  kind: DraftKind;
  index: number;
  phase: 1 | 2;
}

const NOTE_CATEGORIES: ScrimLiveNoteCategory[] = [
  'Review',
  'Draft',
  'Rotation',
  'Objective',
  'Teamfight',
  'Mistake',
  'Good Play',
];

// Standard tournament order. The stored arrays remain Our/Enemy and retain
// their original left-to-right order, exactly like the full editor.
const DRAFT_SEQUENCE: DraftStep[] = [
  { side: 'Blue', kind: 'ban', index: 0, phase: 1 },
  { side: 'Red', kind: 'ban', index: 0, phase: 1 },
  { side: 'Blue', kind: 'ban', index: 1, phase: 1 },
  { side: 'Red', kind: 'ban', index: 1, phase: 1 },
  { side: 'Blue', kind: 'ban', index: 2, phase: 1 },
  { side: 'Red', kind: 'ban', index: 2, phase: 1 },
  { side: 'Blue', kind: 'pick', index: 0, phase: 1 },
  { side: 'Red', kind: 'pick', index: 0, phase: 1 },
  { side: 'Red', kind: 'pick', index: 1, phase: 1 },
  { side: 'Blue', kind: 'pick', index: 1, phase: 1 },
  { side: 'Blue', kind: 'pick', index: 2, phase: 1 },
  { side: 'Red', kind: 'pick', index: 2, phase: 1 },
  { side: 'Red', kind: 'ban', index: 3, phase: 2 },
  { side: 'Blue', kind: 'ban', index: 3, phase: 2 },
  { side: 'Red', kind: 'ban', index: 4, phase: 2 },
  { side: 'Blue', kind: 'ban', index: 4, phase: 2 },
  { side: 'Red', kind: 'pick', index: 3, phase: 2 },
  { side: 'Blue', kind: 'pick', index: 3, phase: 2 },
  { side: 'Blue', kind: 'pick', index: 4, phase: 2 },
  { side: 'Red', kind: 'pick', index: 4, phase: 2 },
];

const GOLD_FIELDS = {
  5: { ours: 'ourGold5', enemy: 'enemyGold5', difference: 'goldDiff5' },
  10: { ours: 'ourGold10', enemy: 'enemyGold10', difference: 'goldDiff10' },
  15: { ours: 'ourGold15', enemy: 'enemyGold15', difference: 'goldDiff15' },
} as const;

const SORTED_HEROES = [...HERO_DATA].sort((a, b) =>
  a.name.localeCompare(b.name),
);

const HERO_ROLE_FILTERS: HeroRoleFilter[] = [
  'All',
  'Tank',
  'Marksman',
  'Fighter',
  'Assassin',
  'Mage',
  'Support',
];

const HERO_VISUALS = new Map(
  HERO_DATA.flatMap((hero) => [
    [normalize(hero.name), hero],
    [normalize(hero.slug), hero],
  ]),
);

export function LiveModeButton({ onClick }: { onClick: () => void }) {
  return (
    <button className={styles.launchButton} type="button" onClick={onClick}>
      <i /> Open Live Input
    </button>
  );
}

export default function LiveMatchMode({
  game,
  opponent,
  patch,
  sessions,
  saveState,
  onChange,
  onExit,
  onFinish,
}: LiveMatchModeProps) {
  const [stage, setStage] = useState<LiveStage>(() =>
    completedDraftSteps(game) >= DRAFT_SEQUENCE.length ? 'game' : 'draft',
  );

  function exitToEditor() {
    if (game.liveClock?.startedAt) {
      onChange({
        ...game,
        liveClock: {
          elapsedSeconds: currentElapsed(game.liveClock),
          startedAt: null,
        },
      });
    }
    onExit();
  }

  return (
    <section className={styles.liveShell}>
      <header className={styles.liveHeader}>
        <div>
          <span className={styles.liveBadge}><i /> LIVE INPUT</span>
          <div>
            <h2>Game {game.number} <b>vs {opponent || 'Opponent'}</b></h2>
            <p>Every tap writes to this game&apos;s existing autosave payload.</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.saveBadge} data-state={saveState.toLowerCase()}>
            {saveState}
          </span>
          <button type="button" onClick={exitToEditor}>Full editor</button>
        </div>
      </header>

      <nav className={styles.stageTabs} aria-label="Live match stage">
        <button
          className={stage === 'draft' ? styles.activeTab : ''}
          type="button"
          onClick={() => setStage('draft')}
        >
          <span>01</span>
          Live Draft
          <small>{completedDraftSteps(game)}/20</small>
        </button>
        <button
          className={stage === 'game' ? styles.activeTab : ''}
          type="button"
          onClick={() => setStage('game')}
        >
          <span>02</span>
          Live Console
          <small>
            {game.liveClock?.startedAt
              ? 'RUNNING'
              : formatClock(currentElapsed(game.liveClock))}
          </small>
        </button>
      </nav>

      {stage === 'draft' ? (
        <LiveDraft
          game={game}
          opponent={opponent}
          patch={patch}
          sessions={sessions}
          onChange={onChange}
          onNext={() => setStage('game')}
        />
      ) : (
        <LiveGame
          game={game}
          onChange={onChange}
          onFinish={onFinish}
        />
      )}

      {stage === 'draft' && <QuickNotes game={game} onChange={onChange} />}
    </section>
  );
}

function LiveDraft({
  game,
  opponent,
  patch,
  sessions,
  onChange,
  onNext,
}: {
  game: ScrimGame;
  opponent: string;
  patch: string;
  sessions: ScrimSession[];
  onChange: (game: ScrimGame) => void;
  onNext: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<HeroRoleFilter>('All');
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const nextIndex = nextDraftStep(game);
  const activeStepIndex = selectedStepIndex ?? nextIndex;
  const activeStep = DRAFT_SEQUENCE[activeStepIndex] ?? null;
  const activeField = activeStep ? draftField(activeStep, game.side) : null;
  const currentHero =
    activeStep && activeField ? game[activeField][activeStep.index] ?? '' : '';
  const usedNames = useMemo(() => {
    const values = [
      ...game.ourBans,
      ...game.enemyBans,
      ...game.ourPicks,
      ...game.enemyPicks,
    ];
    return new Set(
      values
        .filter((name) => normalize(name) !== normalize(currentHero))
        .map(normalize),
    );
  }, [currentHero, game.enemyBans, game.enemyPicks, game.ourBans, game.ourPicks]);
  const normalizedQuery = normalize(query);
  const recommendationContext = useMemo<DraftRecommendationContext | null>(
    () =>
      activeStep
        ? {
            owner: activeStep.side === game.side ? 'our' : 'enemy',
            kind: activeStep.kind,
            slot: activeStep.index + 1,
            phase: activeStep.phase,
          }
        : null,
    [activeStep, game.side],
  );
  const intelligence = useMemo(
    () =>
      buildDraftIntelligence(
        sessions,
        game,
        opponent,
        patch,
        recommendationContext,
      ),
    [game, opponent, patch, recommendationContext, sessions],
  );
  const recommendationRanks = useMemo(
    () =>
      new Map(
        intelligence.suggestions.map((suggestion, index) => [
          normalize(suggestion.name),
          { rank: index + 1, suggestion },
        ]),
      ),
    [intelligence.suggestions],
  );
  const visibleHeroes = useMemo(
    () =>
      SORTED_HEROES.filter((hero) => {
        const matchesRole =
          roleFilter === 'All' ||
          hero.role === roleFilter ||
          hero.secondaryRole === roleFilter;
        const matchesQuery =
          !normalizedQuery || heroSearchText(hero).includes(normalizedQuery);
        return matchesRole && matchesQuery;
      }),
    [normalizedQuery, roleFilter],
  );

  function selectHero(heroName: string) {
    if (!activeStep || !activeField) return;
    const values = [...game[activeField]];
    values[activeStep.index] = heroName;
    onChange({
      ...game,
      [activeField]: values,
      players:
        activeField === 'ourPicks'
          ? game.players.map((player) =>
              player.hero && !values.includes(player.hero)
                ? { ...player, hero: '' }
                : player,
            )
          : game.players,
    });
    setSelectedStepIndex(null);
    setQuery('');
  }

  function undoLast() {
    const lastIndex = lastCompletedDraftStep(game);
    if (lastIndex < 0) return;
    const step = DRAFT_SEQUENCE[lastIndex];
    const field = draftField(step, game.side);
    const values = [...game[field]];
    values.splice(step.index, 1);
    onChange({
      ...game,
      [field]: values,
      players:
        field === 'ourPicks'
          ? game.players.map((player) =>
              player.hero && !values.includes(player.hero)
                ? { ...player, hero: '' }
                : player,
            )
          : game.players,
    });
    setSelectedStepIndex(null);
    setQuery('');
  }

  function selectStep(stepIndex: number) {
    const step = DRAFT_SEQUENCE[stepIndex];
    if (!step) return;
    const value = draftStepValue(game, step);
    if (!value && stepIndex !== nextIndex) return;
    setSelectedStepIndex(stepIndex);
    setQuery('');
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function draftSlot(side: ScrimSide, kind: DraftKind, index: number) {
    const stepIndex = DRAFT_SEQUENCE.findIndex(
      (step) => step.side === side && step.kind === kind && step.index === index,
    );
    if (stepIndex < 0) return null;
    const step = DRAFT_SEQUENCE[stepIndex];
    const field = draftField(step, game.side);
    const value = game[field][index] ?? '';
    const isActive = stepIndex === activeStepIndex;
    const isFuture = !value && stepIndex !== nextIndex;
    return (
      <button
        className={styles.boardSlot}
        data-active={isActive}
        data-kind={kind}
        data-side={side.toLowerCase()}
        type="button"
        disabled={isFuture}
        key={`${side}-${kind}-${index}`}
        title={isFuture ? 'Wait for the draft order' : draftStepLabel(step, game.side)}
        onClick={() => selectStep(stepIndex)}
      >
        {value ? (
          <HeroAvatar
            className={styles.boardSlotAvatar}
            name={value}
            imageUrl={heroVisual(value)?.imageUrl}
            size={kind === 'ban' ? 'sm' : 'md'}
          />
        ) : (
          <i>{kind === 'ban' ? 'B' : 'P'}{index + 1}</i>
        )}
        <span>{value || (isActive ? 'SELECT NOW' : 'EMPTY')}</span>
        <small>{draftOwnerLabel(step, game.side)}</small>
      </button>
    );
  }

  const activeTeamName = activeStep
    ? activeStep.side === game.side
      ? 'CHALIZE'
      : opponent || 'OPPONENT'
    : '';

  return (
    <section className={styles.livePanel}>
      <header className={styles.panelHeading}>
        <div>
          <span>LIVE DRAFT BOARD</span>
          <h3>Pick, ban, and read the evidence in one screen</h3>
          <p>Hero pool stays in the center. Recommendations come from your saved scrims.</p>
        </div>
        <SideSwitch side={game.side} onChange={(side) => onChange({ ...game, side })} />
      </header>

      <div className={styles.draftBoard}>
        <div className={styles.banBoard}>
          {(['Blue', 'Red'] as ScrimSide[]).map((side) => (
            <section data-side={side.toLowerCase()} key={side}>
              <header>
                <span>{side} bans</span>
                <strong>{side === game.side ? 'CHALIZE' : opponent || 'OPPONENT'}</strong>
              </header>
              <div>{Array.from({ length: 5 }, (_, index) => draftSlot(side, 'ban', index))}</div>
            </section>
          ))}
        </div>

        <div className={styles.draftTurnBar} data-complete={!activeStep}>
          {activeStep ? (
            <>
              <span>STEP {activeStepIndex + 1} / {DRAFT_SEQUENCE.length}</span>
              <strong>{activeTeamName} · {activeStep.kind.toUpperCase()} {activeStep.index + 1}</strong>
              <small>{activeStep.side} side · Phase {activeStep.phase}</small>
            </>
          ) : (
            <>
              <span>DRAFT COMPLETE</span>
              <strong>All 20 slots recorded</strong>
              <small>Tap any completed slot to correct it</small>
            </>
          )}
        </div>

        <div className={styles.draftBoardMain}>
          {(['Blue', 'Red'] as ScrimSide[]).map((side) => (
            <section
              className={styles.pickColumn}
              data-side={side.toLowerCase()}
              key={side}
            >
              <header>
                <span>{side} picks</span>
                <strong>{side === game.side ? 'US' : 'THEM'}</strong>
              </header>
              <div>{Array.from({ length: 5 }, (_, index) => draftSlot(side, 'pick', index))}</div>
            </section>
          ))}

          <section className={styles.heroPool}>
            <header className={styles.heroPoolToolbar}>
              <div>
                <span>HERO POOL</span>
                <strong>{visibleHeroes.length} heroes</strong>
              </div>
              <input
                ref={inputRef}
                value={query}
                autoComplete="off"
                spellCheck={false}
                placeholder="Search hero…"
                aria-label="Search hero pool"
                onChange={(event) => setQuery(event.target.value)}
              />
            </header>

            <nav className={styles.heroRoleTabs} aria-label="Filter hero roles">
              {HERO_ROLE_FILTERS.map((role) => (
                <button
                  className={roleFilter === role ? styles.selectedHeroRole : ''}
                  type="button"
                  key={role}
                  onClick={() => setRoleFilter(role)}
                >
                  {role}
                </button>
              ))}
            </nav>

            <div className={styles.draftRecommendationBar}>
              <header>
                <div>
                  <span>DATA ASSISTANT</span>
                  <strong>{intelligence.primaryLabel}</strong>
                </div>
                <small>{intelligence.scopeGames} GAME SAMPLE</small>
              </header>
              {intelligence.suggestions.length > 0 ? (
                <div>
                  {intelligence.suggestions.map((suggestion, index) => (
                    <button
                      type="button"
                      key={suggestion.name}
                      disabled={!activeStep || usedNames.has(normalize(suggestion.name))}
                      title={suggestion.reason}
                      onClick={() => selectHero(suggestion.name)}
                    >
                      <b>#{index + 1}</b>
                      <HeroAvatar
                        className={styles.recommendationAvatar}
                        name={suggestion.name}
                        imageUrl={heroVisual(suggestion.name)?.imageUrl}
                        size="xs"
                      />
                      <span>{suggestion.name}</span>
                      <small>{suggestion.reason}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p>Belum ada historical sample yang cocok untuk giliran ini.</p>
              )}
            </div>

            <div className={styles.heroGrid}>
              {visibleHeroes.map((hero) => {
                const key = normalize(hero.name);
                const unavailable = usedNames.has(key);
                const recommended = recommendationRanks.get(key);
                return (
                  <button
                    type="button"
                    data-recommended={Boolean(recommended)}
                    data-used={unavailable}
                    disabled={!activeStep || unavailable}
                    key={hero.name}
                    title={recommended?.suggestion.reason ?? `${hero.role} · ${hero.specialty}`}
                    onClick={() => selectHero(hero.name)}
                  >
                    <span className={styles.heroPortrait}>
                      <HeroAvatar
                        className={styles.heroGridAvatar}
                        name={hero.name}
                        imageUrl={hero.imageUrl}
                        size="md"
                      />
                      {recommended && <b>#{recommended.rank}</b>}
                    </span>
                    <strong>{hero.name}</strong>
                    <small>{recommended ? `n=${recommended.suggestion.sample}` : hero.role}</small>
                  </button>
                );
              })}
            </div>

            <footer className={styles.draftEvidenceFooter}>
              <span>{intelligence.warning}</span>
              {intelligence.threats.length > 0 ? (
                <div>
                  {intelligence.threats.slice(0, 3).map((threat) => (
                    <small key={threat.key}>
                      {threat.playerName || 'Unknown'} · {threat.hero} · n={threat.games}
                    </small>
                  ))}
                </div>
              ) : (
                <small>Opponent memory starts after a full box-score import.</small>
              )}
            </footer>
          </section>
        </div>
      </div>

      {currentHero && activeStep && (
        <div className={styles.replacingNotice}>
          Replacing <strong>{currentHero}</strong> in {draftStepLabel(activeStep, game.side)}.
          Choose another hero from the grid.
        </div>
      )}

      {visibleHeroes.length === 0 && (
        <div className={styles.draftComplete}>
          <span>NO HERO FOUND</span>
          <strong>Try another search or role filter.</strong>
        </div>
      )}

      <footer className={styles.panelActions}>
        <button type="button" disabled={lastCompletedDraftStep(game) < 0} onClick={undoLast}>
          Undo last draft input
        </button>
        <button className={styles.primaryAction} type="button" onClick={onNext}>
          Open in-game controls →
        </button>
      </footer>
    </section>
  );
}

function LiveGame({
  game,
  onChange,
  onFinish,
}: {
  game: ScrimGame;
  onChange: (game: ScrimGame) => void;
  onFinish: (game: ScrimGame) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [markFeedback, setMarkFeedback] = useState('');
  const [goldOpen, setGoldOpen] = useState(false);
  const [lineupOpen, setLineupOpen] = useState(() => needsDraftLineupMapping(game));
  const [lineupDraft, setLineupDraft] = useState<Record<string, string>>(() =>
    buildSuggestedLineup(game),
  );
  const feedbackTimerRef = useRef<number | null>(null);
  const clock = normalizedClock(game.liveClock);
  const running = Boolean(clock.startedAt);
  const elapsed = elapsedAt(clock, now);
  const events = game.liveEvents ?? [];
  const recentEvents = [...events]
    .sort((a, b) => b.elapsedSeconds - a.elapsedSeconds || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (lineupOpen || goldOpen) return;
      const target = event.target as HTMLElement | null;
      if (
        event.repeat ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'SELECT' ||
        target?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const playerIndex = Number(event.key) - 1;
      if (playerIndex >= 0 && playerIndex < game.players.length) {
        event.preventDefault();
        recordPlayerDeath(game.players[playerIndex]);
        return;
      }

      const key = event.key.toLowerCase();
      if (event.code === 'Space') {
        event.preventDefault();
        markMoment();
      } else if (key === 'k') {
        recordOurKill();
      } else if (key === 'q') {
        recordObjective('turtle', 'Us');
      } else if (key === 'w') {
        recordObjective('turtle', 'Opponent');
      } else if (key === 'a') {
        recordObjective('lord', 'Us');
      } else if (key === 's') {
        recordObjective('lord', 'Opponent');
      } else if (key === 'z') {
        recordObjective('tower', 'Us');
      } else if (key === 'x') {
        recordObjective('tower', 'Opponent');
      } else if (key === 'p') {
        toggleClock();
      } else if (key === 'g') {
        setGoldOpen((value) => !value);
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });

  function updateClock(nextElapsed: number, keepRunning = running) {
    onChange({
      ...game,
      liveClock: {
        elapsedSeconds: Math.max(0, Math.round(nextElapsed)),
        startedAt: keepRunning ? new Date().toISOString() : null,
      },
    });
  }

  function toggleClock() {
    if (running) {
      updateClock(elapsed, false);
    } else {
      updateClock(elapsed, true);
    }
  }

  function updateGold(minute: GoldMinute, owner: 'ours' | 'enemy', value: number) {
    const fields = GOLD_FIELDS[minute];
    const ourGold = owner === 'ours' ? value : game[fields.ours] ?? 0;
    const enemyGold = owner === 'enemy' ? value : game[fields.enemy] ?? 0;
    onChange({
      ...game,
      [fields.ours]: ourGold,
      [fields.enemy]: enemyGold,
      [fields.difference]: ourGold - enemyGold,
    });
  }

  function makeLiveEvent(
    event: Omit<ScrimLiveEvent, 'id' | 'elapsedSeconds' | 'createdAt'>,
  ): ScrimLiveEvent {
    return {
      id: makeId('live-event'),
      elapsedSeconds: elapsedAt(normalizedClock(game.liveClock), Date.now()),
      createdAt: new Date().toISOString(),
      ...event,
    };
  }

  function recordPlayerDeath(player: ScrimGame['players'][number]) {
    const liveEvent = makeLiveEvent({
      type: 'player_death',
      owner: 'Opponent',
      playerId: player.id,
      playerName: player.playerName,
      role: player.role,
      hero: player.hero,
    });
    onChange({
      ...game,
      enemyKills: game.enemyKills + 1,
      players: game.players.map((item) =>
        item.id === player.id ? { ...item, deaths: item.deaths + 1 } : item,
      ),
      liveEvents: [...events, liveEvent],
    });
    flashFeedback(`${player.playerName || player.role} death · ${formatClock(liveEvent.elapsedSeconds)}`);
  }

  function recordOurKill() {
    const liveEvent = makeLiveEvent({ type: 'our_kill', owner: 'Us' });
    onChange({
      ...game,
      teamKills: game.teamKills + 1,
      liveEvents: [...events, liveEvent],
    });
    flashFeedback(`Our kill · ${formatClock(liveEvent.elapsedSeconds)}`);
  }

  function recordObjective(
    type: Extract<ScrimLiveEvent['type'], 'turtle' | 'lord' | 'tower'>,
    owner: Exclude<ObjectiveOwner, 'None'>,
  ) {
    const liveEvent = makeLiveEvent({ type, owner });
    const nextGame: ScrimGame = {
      ...game,
      liveEvents: [...events, liveEvent],
    };

    if (type === 'turtle') {
      if (owner === 'Us') nextGame.turtlesFor += 1;
      else nextGame.turtlesAgainst += 1;
      if (nextGame.firstTurtle === 'None') nextGame.firstTurtle = owner;
    } else if (type === 'lord') {
      if (owner === 'Us') nextGame.lordsFor += 1;
      else nextGame.lordsAgainst += 1;
      if (nextGame.firstLord === 'None') nextGame.firstLord = owner;
    } else if (owner === 'Us') {
      nextGame.towersFor += 1;
    } else {
      nextGame.towersAgainst += 1;
    }

    onChange(nextGame);
    flashFeedback(`${owner === 'Us' ? 'Our' : 'Enemy'} ${type} · ${formatClock(liveEvent.elapsedSeconds)}`);
  }

  function markMoment() {
    const markedAt = elapsedAt(normalizedClock(game.liveClock), Date.now());
    const marker: ScrimLiveNote = {
      id: makeId('live-marker'),
      elapsedSeconds: markedAt,
      category: 'Review',
      text: '',
      createdAt: new Date().toISOString(),
    };
    const liveEvent: ScrimLiveEvent = {
      id: makeId('live-event'),
      type: 'review_marker',
      elapsedSeconds: markedAt,
      noteId: marker.id,
      createdAt: new Date().toISOString(),
    };

    onChange({
      ...game,
      liveNotes: [...(game.liveNotes ?? []), marker],
      liveEvents: [...events, liveEvent],
    });
    flashFeedback(`Moment saved · ${formatClock(markedAt)}`);
  }

  function flashFeedback(message: string) {
    setMarkFeedback(message);
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => setMarkFeedback(''), 1_800);
  }

  function undoLastEvent() {
    const lastEvent = events[events.length - 1];
    if (!lastEvent) return;
    const remainingEvents = events.slice(0, -1);
    const nextGame: ScrimGame = { ...game, liveEvents: remainingEvents };

    if (lastEvent.type === 'player_death') {
      nextGame.enemyKills = Math.max(0, game.enemyKills - 1);
      nextGame.players = game.players.map((player) =>
        player.id === lastEvent.playerId
          ? { ...player, deaths: Math.max(0, player.deaths - 1) }
          : player,
      );
    } else if (lastEvent.type === 'our_kill') {
      nextGame.teamKills = Math.max(0, game.teamKills - 1);
    } else if (lastEvent.type === 'turtle') {
      if (lastEvent.owner === 'Us') nextGame.turtlesFor = Math.max(0, game.turtlesFor - 1);
      else nextGame.turtlesAgainst = Math.max(0, game.turtlesAgainst - 1);
      nextGame.firstTurtle = firstEventOwner(remainingEvents, 'turtle');
    } else if (lastEvent.type === 'lord') {
      if (lastEvent.owner === 'Us') nextGame.lordsFor = Math.max(0, game.lordsFor - 1);
      else nextGame.lordsAgainst = Math.max(0, game.lordsAgainst - 1);
      nextGame.firstLord = firstEventOwner(remainingEvents, 'lord');
    } else if (lastEvent.type === 'tower') {
      if (lastEvent.owner === 'Us') nextGame.towersFor = Math.max(0, game.towersFor - 1);
      else nextGame.towersAgainst = Math.max(0, game.towersAgainst - 1);
    } else if (lastEvent.type === 'review_marker' && lastEvent.noteId) {
      nextGame.liveNotes = (game.liveNotes ?? []).filter(
        (note) => note.id !== lastEvent.noteId,
      );
    }

    onChange(nextGame);
    flashFeedback('Last event removed');
  }

  function openLineupEditor() {
    setLineupDraft(buildSuggestedLineup(game));
    setLineupOpen(true);
  }

  function updateLineupDraft(playerId: string, hero: string) {
    setLineupDraft((current) => {
      const previousHero = current[playerId] ?? '';
      const swappedPlayerId = Object.entries(current).find(
        ([id, assignedHero]) => id !== playerId && assignedHero === hero,
      )?.[0];
      return {
        ...current,
        [playerId]: hero,
        ...(swappedPlayerId ? { [swappedPlayerId]: previousHero } : {}),
      };
    });
  }

  function confirmLineup() {
    if (!lineupIsComplete(game, lineupDraft)) return;
    onChange({
      ...game,
      players: game.players.map((player) => ({
        ...player,
        hero: lineupDraft[player.id] ?? player.hero,
      })),
    });
    setLineupOpen(false);
    flashFeedback('Hero buttons ready');
  }

  function finishLiveGame() {
    const finalElapsed = elapsedAt(normalizedClock(game.liveClock), Date.now());
    onFinish({
      ...game,
      durationMinutes:
        finalElapsed > 0
          ? Number((finalElapsed / 60).toFixed(1))
          : game.durationMinutes,
      liveClock: {
        elapsedSeconds: finalElapsed,
        startedAt: null,
      },
    });
  }

  const checkpointDue = nextGoldCheckpoint(game, elapsed);

  return (
    <section className={`${styles.livePanel} ${styles.streamDeckConsole}`}>
      <header className={styles.consoleTopbar}>
        <div className={styles.consoleClock}>
          <button type="button" onClick={() => updateClock(elapsed - 10)}>-10</button>
          <div>
            <span>GAME CLOCK</span>
            <strong>{formatClock(elapsed)}</strong>
          </div>
          <button type="button" onClick={() => updateClock(elapsed + 10)}>+10</button>
          <button className={styles.consoleClockToggle} type="button" onClick={toggleClock}>
            {running ? 'PAUSE' : elapsed > 0 ? 'RESUME' : 'START'} <kbd>P</kbd>
          </button>
        </div>

        <button className={styles.consoleMarker} type="button" onClick={markMoment}>
          <i />
          <span>MARK MOMENT</span>
          <small>Space · {formatClock(elapsed)}</small>
        </button>

        <div className={styles.consoleMatchState}>
          <div className={styles.consoleScore}>
            <span>US</span><strong>{game.teamKills}</strong>
            <i>—</i>
            <strong>{game.enemyKills}</strong><span>THEM</span>
          </div>
          <div className={styles.consoleStateActions}>
            <button
              type="button"
              data-due={Boolean(checkpointDue)}
              onClick={() => setGoldOpen(true)}
            >
              {checkpointDue ? `GOLD @${checkpointDue} DUE` : 'GOLD'} <kbd>G</kbd>
            </button>
            <button type="button" onClick={finishLiveGame}>FINISH</button>
          </div>
        </div>
      </header>

      <div className={styles.consoleMain}>
        <section className={styles.playerDeathDeck}>
          <header>
            <div><span>HERO DEATH KEYS</span><strong>Tap the hero portrait that died</strong></div>
            <button className={styles.editLineupButton} type="button" onClick={openLineupEditor}>
              EDIT HERO LINEUP
            </button>
          </header>
          <div>
            {game.players.map((player, index) => {
              const deathEvents = events.filter(
                (event) => event.type === 'player_death' && event.playerId === player.id,
              ).length;
              return (
                <article className={styles.playerDeathKey} key={player.id}>
                  <button type="button" onClick={() => recordPlayerDeath(player)}>
                    <kbd>{index + 1}</kbd>
                    <HeroAvatar
                      className={styles.consolePlayerAvatar}
                      name={player.hero || player.playerName || player.role}
                      imageUrl={heroVisual(player.hero)?.imageUrl}
                      size="lg"
                    />
                    <strong>{player.hero || 'Hero not set'}</strong>
                    <span>{player.role} · {player.playerName || 'Player'}</span>
                    <b>{deathEvents} LIVE DEATH{deathEvents === 1 ? '' : 'S'}</b>
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.eventControlDeck}>
          <header>
            <div><span>ONE-TAP EVENTS</span><strong>Every tap saves the timestamp</strong></div>
            <small>{markFeedback || `${events.length} saved events`}</small>
          </header>
          <div>
            <button className={styles.killKey} type="button" onClick={recordOurKill}>
              <kbd>K</kbd><span>OUR KILL</span><strong>+1</strong>
            </button>
            <EventKey shortcut="Q" label="OUR TURTLE" value={game.turtlesFor} owner="ours" onClick={() => recordObjective('turtle', 'Us')} />
            <EventKey shortcut="W" label="ENEMY TURTLE" value={game.turtlesAgainst} owner="enemy" onClick={() => recordObjective('turtle', 'Opponent')} />
            <EventKey shortcut="A" label="OUR LORD" value={game.lordsFor} owner="ours" onClick={() => recordObjective('lord', 'Us')} />
            <EventKey shortcut="S" label="ENEMY LORD" value={game.lordsAgainst} owner="enemy" onClick={() => recordObjective('lord', 'Opponent')} />
            <EventKey shortcut="Z" label="OUR TOWER" value={game.towersFor} owner="ours" onClick={() => recordObjective('tower', 'Us')} />
            <EventKey shortcut="X" label="ENEMY TOWER" value={game.towersAgainst} owner="enemy" onClick={() => recordObjective('tower', 'Opponent')} />
            <div className={styles.consoleResultSwitch}>
              {(['Win', 'Loss'] as ScrimResult[]).map((result) => (
                <button
                  className={game.result === result ? styles.selectedResult : ''}
                  data-result={result.toLowerCase()}
                  type="button"
                  key={result}
                  onClick={() => onChange({ ...game, result })}
                >
                  {result}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className={styles.recentEventStrip}>
        <div className={styles.recentEventHeading}>
          <span>RECENT EVENTS</span>
          <button type="button" disabled={events.length === 0} onClick={undoLastEvent}>
            UNDO LAST
          </button>
        </div>
        <div>
          {recentEvents.length === 0 ? (
            <p>Start the timer, then use the big keys. No typing required.</p>
          ) : (
            recentEvents.map((liveEvent) => (
              <article data-owner={liveEvent.owner?.toLowerCase() ?? 'neutral'} key={liveEvent.id}>
                <time>{formatClock(liveEvent.elapsedSeconds)}</time>
                <strong>{liveEventLabel(liveEvent)}</strong>
                <small>{liveEventContext(liveEvent, events)}</small>
              </article>
            ))
          )}
        </div>
      </footer>

      {goldOpen && (
        <div className={styles.goldOverlay} role="dialog" aria-modal="true" aria-label="Gold checkpoints">
          <section>
            <header>
              <div><span>GOLD CHECKPOINTS</span><strong>Enter both totals</strong></div>
              <button type="button" onClick={() => setGoldOpen(false)}>CLOSE</button>
            </header>
            <div className={styles.consoleGoldGrid}>
              {([5, 10, 15] as const).map((minute) => {
                const fields = GOLD_FIELDS[minute];
                const difference = game[fields.difference] ?? 0;
                return (
                  <article key={minute}>
                    <header><strong>@ {minute}</strong><span>{formatSignedNumber(difference)}</span></header>
                    <label><span>OUR GOLD</span><input type="number" min="0" inputMode="numeric" value={game[fields.ours] || ''} onChange={(event) => updateGold(minute, 'ours', Number(event.target.value) || 0)} /></label>
                    <label><span>ENEMY GOLD</span><input type="number" min="0" inputMode="numeric" value={game[fields.enemy] || ''} onChange={(event) => updateGold(minute, 'enemy', Number(event.target.value) || 0)} /></label>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {lineupOpen && (
        <div className={styles.lineupOverlay} role="dialog" aria-modal="true" aria-label="Map draft heroes to players">
          <section>
            <header>
              <div>
                <span>ONE-TIME LINEUP CHECK</span>
                <strong>Match our five draft picks to the players</strong>
                <small>Suggested by lane. Check flex picks before starting the clock.</small>
              </div>
              {!needsDraftLineupMapping(game) && (
                <button type="button" onClick={() => setLineupOpen(false)}>CLOSE</button>
              )}
            </header>
            <div className={styles.lineupMappingGrid}>
              {game.players.map((player) => {
                const hero = lineupDraft[player.id] ?? '';
                return (
                  <article key={player.id}>
                    <HeroAvatar
                      className={styles.lineupHeroAvatar}
                      name={hero || player.role}
                      imageUrl={heroVisual(hero)?.imageUrl}
                      size="lg"
                    />
                    <span>{player.role}</span>
                    <strong>{hero || 'Choose hero'}</strong>
                    <small>{player.playerName || 'Player name not set'}</small>
                    <select
                      aria-label={`Draft hero for ${player.playerName || player.role}`}
                      value={hero}
                      onChange={(event) => updateLineupDraft(player.id, event.target.value)}
                    >
                      <option value="">Choose hero…</option>
                      {uniqueHeroes([...game.ourPicks, hero]).map((heroName) => (
                        <option value={heroName} key={heroName}>{heroName}</option>
                      ))}
                    </select>
                  </article>
                );
              })}
            </div>
            <footer>
              <button type="button" onClick={() => setLineupDraft(buildSuggestedLineup(game))}>
                RESET SUGGESTION
              </button>
              <button
                className={styles.primaryLineupAction}
                type="button"
                disabled={!lineupIsComplete(game, lineupDraft)}
                onClick={confirmLineup}
              >
                USE THESE HERO BUTTONS →
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}

function EventKey({
  shortcut,
  label,
  value,
  owner,
  onClick,
}: {
  shortcut: string;
  label: string;
  value: number;
  owner: 'ours' | 'enemy';
  onClick: () => void;
}) {
  return (
    <button className={styles.eventKey} data-owner={owner} type="button" onClick={onClick}>
      <kbd>{shortcut}</kbd><span>{label}</span><strong>{value}</strong>
    </button>
  );
}

function QuickNotes({
  game,
  onChange,
}: {
  game: ScrimGame;
  onChange: (game: ScrimGame) => void;
}) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<ScrimLiveNoteCategory>('Rotation');
  const [timeOffset, setTimeOffset] = useState(0);
  const [editingId, setEditingId] = useState('');
  const [editText, setEditText] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editCategory, setEditCategory] = useState<ScrimLiveNoteCategory>('Rotation');
  const [now, setNow] = useState(() => Date.now());
  const notes = sortedNotes(game.liveNotes ?? []);
  const timestamp = Math.max(
    0,
    elapsedAt(normalizedClock(game.liveClock), now) + timeOffset,
  );

  useEffect(() => {
    if (!game.liveClock?.startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [game.liveClock?.startedAt]);

  function submitNote(event: FormEvent) {
    event.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    const freshTimestamp = Math.max(
      0,
      elapsedAt(normalizedClock(game.liveClock), Date.now()) + timeOffset,
    );
    const note: ScrimLiveNote = {
      id: makeId('live-note'),
      elapsedSeconds: freshTimestamp,
      category,
      text: clean,
      createdAt: new Date().toISOString(),
    };
    onChange({ ...game, liveNotes: [...(game.liveNotes ?? []), note] });
    setText('');
    setTimeOffset(0);
  }

  function startEditing(note: ScrimLiveNote) {
    setEditingId(note.id);
    setEditText(note.text);
    setEditTime(formatClock(note.elapsedSeconds));
    setEditCategory(note.category);
  }

  function saveEdit(noteId: string) {
    const seconds = parseClock(editTime);
    const clean = editText.trim();
    if (seconds === null || !clean) return;
    onChange({
      ...game,
      liveNotes: (game.liveNotes ?? []).map((note) =>
        note.id === noteId
          ? { ...note, text: clean, elapsedSeconds: seconds, category: editCategory }
          : note,
      ),
    });
    setEditingId('');
  }

  function deleteNote(note: ScrimLiveNote) {
    if (!window.confirm(`Delete note at ${formatClock(note.elapsedSeconds)}?`)) return;
    onChange({
      ...game,
      liveNotes: (game.liveNotes ?? []).filter((item) => item.id !== note.id),
    });
    if (editingId === note.id) setEditingId('');
  }

  return (
    <section className={`${styles.livePanel} ${styles.notesPanel}`}>
      <header className={styles.panelHeading}>
        <div>
          <span>QUICK NOTES</span>
          <h3>Capture context before it disappears</h3>
          <p>Minute follows the game clock. Use ±10s if the event happened slightly earlier.</p>
        </div>
        <strong>{notes.length} NOTES</strong>
      </header>

      <form className={styles.noteComposer} onSubmit={submitNote}>
        <div className={styles.categoryChips}>
          {NOTE_CATEGORIES.map((item) => (
            <button
              className={category === item ? styles.selectedCategory : ''}
              type="button"
              key={item}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className={styles.noteInputRow}>
          <div className={styles.noteTimestamp}>
            <button type="button" onClick={() => setTimeOffset((value) => value - 10)}>-10</button>
            <strong>{formatClock(timestamp)}</strong>
            <button type="button" onClick={() => setTimeOffset((value) => value + 10)}>+10</button>
          </div>
          <input
            value={text}
            placeholder="Type the important moment…"
            onChange={(event) => setText(event.target.value)}
          />
          <button className={styles.addNoteButton} type="submit" disabled={!text.trim()}>
            Save note
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <div className={styles.notesEmpty}>No live notes yet.</div>
      ) : (
        <div className={styles.noteTimeline}>
          {notes.map((note) => (
            <article key={note.id}>
              {editingId === note.id ? (
                <div className={styles.editNoteForm}>
                  <input
                    aria-label="Note timestamp"
                    value={editTime}
                    onChange={(event) => setEditTime(event.target.value)}
                  />
                  <select
                    aria-label="Note category"
                    value={editCategory}
                    onChange={(event) =>
                      setEditCategory(event.target.value as ScrimLiveNoteCategory)
                    }
                  >
                    {NOTE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                  <input
                    aria-label="Note text"
                    value={editText}
                    onChange={(event) => setEditText(event.target.value)}
                  />
                  <button type="button" onClick={() => saveEdit(note.id)}>Save</button>
                  <button type="button" onClick={() => setEditingId('')}>Cancel</button>
                </div>
              ) : (
                <>
                  <time>{formatClock(note.elapsedSeconds)}</time>
                  <span data-category={normalize(note.category)}>{note.category}</span>
                  <p>{note.text || 'Moment marked — add context after the game.'}</p>
                  <div>
                    <button type="button" onClick={() => startEditing(note)}>Edit</button>
                    <button type="button" onClick={() => deleteNote(note)}>Delete</button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function LiveNotesReview({
  notes,
  onChange,
  readOnly = false,
}: {
  notes?: ScrimLiveNote[];
  onChange?: (notes: ScrimLiveNote[]) => void;
  readOnly?: boolean;
}) {
  const ordered = sortedNotes(notes ?? []);
  if (ordered.length === 0) return null;

  function updateMarker(noteId: string, text: string) {
    if (!onChange) return;
    onChange(
      (notes ?? []).map((note) =>
        note.id === noteId ? { ...note, text } : note,
      ),
    );
  }

  function deleteMarker(note: ScrimLiveNote) {
    if (!onChange || !window.confirm(`Delete marker at ${formatClock(note.elapsedSeconds)}?`)) {
      return;
    }
    onChange((notes ?? []).filter((item) => item.id !== note.id));
  }

  return (
    <section className={styles.reviewNotes}>
      <header>
        <span>LIVE TIMELINE</span>
        <small>{ordered.length} timestamped notes</small>
      </header>
      <div>
        {ordered.map((note) =>
          note.category === 'Review' ? (
            <article className={styles.reviewMarker} key={note.id}>
              <time>{formatClock(note.elapsedSeconds)}</time>
              <span>MARKER</span>
              {readOnly || !onChange ? (
                <p>{note.text || 'Moment marked for review.'}</p>
              ) : (
                <div>
                  <input
                    aria-label={`Review note at ${formatClock(note.elapsedSeconds)}`}
                    value={note.text}
                    placeholder="Tulis momennya setelah lihat VOD…"
                    onChange={(event) => updateMarker(note.id, event.target.value)}
                  />
                  <button type="button" onClick={() => deleteMarker(note)}>Delete</button>
                </div>
              )}
            </article>
          ) : (
            <article key={note.id}>
              <time>{formatClock(note.elapsedSeconds)}</time>
              <span>{note.category}</span>
              <p>{note.text}</p>
            </article>
          ),
        )}
      </div>
    </section>
  );
}

export function LiveEventReview({ events }: { events?: ScrimLiveEvent[] }) {
  const ordered = [...(events ?? [])].sort(
    (a, b) => a.elapsedSeconds - b.elapsedSeconds || a.createdAt.localeCompare(b.createdAt),
  );
  if (ordered.length === 0) return null;

  return (
    <section className={styles.reviewNotes}>
      <header>
        <span>RECORDED GAME EVENTS</span>
        <small>{ordered.length} one-tap timestamps</small>
      </header>
      <div>
        {ordered.map((event) => (
          <article key={event.id}>
            <time>{formatClock(event.elapsedSeconds)}</time>
            <span>{event.owner === 'Us' ? 'OUR EVENT' : event.owner === 'Opponent' ? 'ENEMY EVENT' : 'MARKER'}</span>
            <p>
              <strong>{liveEventLabel(event)}</strong>
              {' · '}
              {liveEventContext(event, ordered)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SideSwitch({
  side,
  onChange,
}: {
  side: ScrimSide;
  onChange: (side: ScrimSide) => void;
}) {
  return (
    <div className={styles.sideSwitch}>
      {(['Blue', 'Red'] as ScrimSide[]).map((option) => (
        <button
          className={side === option ? styles.selectedSide : ''}
          data-side={option.toLowerCase()}
          type="button"
          key={option}
          onClick={() => onChange(option)}
        >
          <span>{option}</span>
          <small>{option === 'Blue' ? 'First Pick' : 'Second Pick'}</small>
        </button>
      ))}
    </div>
  );
}

function normalizedClock(clock?: ScrimLiveClock): ScrimLiveClock {
  return {
    elapsedSeconds: Math.max(0, clock?.elapsedSeconds ?? 0),
    startedAt: clock?.startedAt ?? null,
  };
}

function elapsedAt(clock: ScrimLiveClock, now: number) {
  if (!clock.startedAt) return Math.max(0, Math.round(clock.elapsedSeconds));
  const startedAt = new Date(clock.startedAt).getTime();
  if (!Number.isFinite(startedAt)) return Math.max(0, Math.round(clock.elapsedSeconds));
  return Math.max(
    0,
    Math.round(clock.elapsedSeconds + Math.max(0, now - startedAt) / 1_000),
  );
}

function currentElapsed(clock?: ScrimLiveClock) {
  return elapsedAt(normalizedClock(clock), Date.now());
}

function firstEventOwner(
  events: ScrimLiveEvent[],
  type: 'turtle' | 'lord',
): ObjectiveOwner {
  return [...events]
    .filter((event) => event.type === type && event.owner)
    .sort((a, b) => a.elapsedSeconds - b.elapsedSeconds)[0]?.owner ?? 'None';
}

function liveEventLabel(event: ScrimLiveEvent) {
  if (event.type === 'player_death') {
    return `${event.playerName || event.role || 'Player'} died`;
  }
  if (event.type === 'our_kill') return 'Our kill';
  if (event.type === 'review_marker') return 'Review marker';
  return `${event.owner === 'Us' ? 'Our' : 'Enemy'} ${event.type}`;
}

function liveEventContext(event: ScrimLiveEvent, events: ScrimLiveEvent[]) {
  if (event.type === 'player_death') {
    const punishment = events.find(
      (candidate) =>
        (candidate.type === 'turtle' ||
          candidate.type === 'lord' ||
          candidate.type === 'tower') &&
        candidate.owner === 'Opponent' &&
        candidate.elapsedSeconds >= event.elapsedSeconds &&
        candidate.elapsedSeconds - event.elapsedSeconds <= 60,
    );
    if (punishment) return `PRE-${punishment.type.toUpperCase()} DEATH`;
    const traded = events.some(
      (candidate) =>
        candidate.type === 'our_kill' &&
        candidate.elapsedSeconds >= event.elapsedSeconds &&
        candidate.elapsedSeconds - event.elapsedSeconds <= 15,
    );
    return traded ? 'TRADED ≤15S' : event.hero || event.role || 'PLAYER DEATH';
  }
  if (event.type === 'our_kill') {
    const conversion = events.find(
      (candidate) =>
        (candidate.type === 'turtle' ||
          candidate.type === 'lord' ||
          candidate.type === 'tower') &&
        candidate.owner === 'Us' &&
        candidate.elapsedSeconds >= event.elapsedSeconds &&
        candidate.elapsedSeconds - event.elapsedSeconds <= 45,
    );
    return conversion ? `CONVERTED TO ${conversion.type.toUpperCase()}` : 'KILL EVENT';
  }
  if (event.type === 'review_marker') return 'ADD CONTEXT AFTER GAME';
  return event.owner === 'Us' ? 'SECURED' : 'CONCEDED';
}

function nextGoldCheckpoint(game: ScrimGame, elapsedSeconds: number) {
  const checkpoints = [
    { minute: 5 as const, ours: game.ourGold5, enemy: game.enemyGold5 },
    { minute: 10 as const, ours: game.ourGold10, enemy: game.enemyGold10 },
    { minute: 15 as const, ours: game.ourGold15, enemy: game.enemyGold15 },
  ];
  return checkpoints.find(
    (checkpoint) =>
      elapsedSeconds >= checkpoint.minute * 60 &&
      checkpoint.ours === 0 &&
      checkpoint.enemy === 0,
  )?.minute;
}

function formatSignedNumber(value: number) {
  if (value === 0) return 'EVEN';
  return `${value > 0 ? '+' : ''}${value.toLocaleString()}`;
}

function draftField(step: DraftStep, ourSide: ScrimSide): DraftField {
  const ours = step.side === ourSide;
  if (step.kind === 'pick') return ours ? 'ourPicks' : 'enemyPicks';
  return ours ? 'ourBans' : 'enemyBans';
}

function draftStepValue(game: ScrimGame, step: DraftStep) {
  return game[draftField(step, game.side)][step.index]?.trim() ?? '';
}

function nextDraftStep(game: ScrimGame) {
  const index = DRAFT_SEQUENCE.findIndex((step) => !draftStepValue(game, step));
  return index === -1 ? DRAFT_SEQUENCE.length : index;
}

function completedDraftSteps(game: ScrimGame) {
  return DRAFT_SEQUENCE.filter((step) => Boolean(draftStepValue(game, step))).length;
}

function lastCompletedDraftStep(game: ScrimGame) {
  for (let index = DRAFT_SEQUENCE.length - 1; index >= 0; index -= 1) {
    if (draftStepValue(game, DRAFT_SEQUENCE[index])) return index;
  }
  return -1;
}

function draftOwnerLabel(step: DraftStep, ourSide: ScrimSide) {
  return step.side === ourSide ? 'US' : 'THEM';
}

function draftStepLabel(step: DraftStep, ourSide: ScrimSide) {
  const owner = step.side === ourSide ? 'Our' : 'Enemy';
  return `${owner} ${step.kind === 'ban' ? 'Ban' : 'Pick'} ${step.index + 1}`;
}

function heroVisual(name: string) {
  return HERO_VISUALS.get(normalize(name));
}

function heroSearchText(hero: (typeof HERO_DATA)[number]) {
  const aliases = hero.name === 'Zetian' ? 'Wu Zetian' : '';
  const initials = hero.name
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .join('');
  return normalize(`${hero.name} ${hero.slug} ${aliases} ${initials}`);
}

function uniqueHeroes(values: string[]) {
  const heroes = new Map<string, string>();
  values.forEach((value) => {
    const clean = value.trim();
    if (clean) heroes.set(normalize(clean), clean);
  });
  return [...heroes.values()];
}

function buildSuggestedLineup(game: ScrimGame) {
  const picks = uniqueHeroes(game.ourPicks).slice(0, game.players.length);
  const pickNames = new Map(picks.map((hero) => [normalize(hero), hero]));
  const assignments: Record<string, string> = {};
  const used = new Set<string>();

  game.players.forEach((player) => {
    const canonicalHero = pickNames.get(normalize(player.hero));
    if (!canonicalHero || used.has(normalize(canonicalHero))) return;
    assignments[player.id] = canonicalHero;
    used.add(normalize(canonicalHero));
  });

  const remainingHeroes = () =>
    picks.filter((hero) => !used.has(normalize(hero)));
  const unresolvedPlayers = () =>
    game.players.filter((player) => !assignments[player.id]);

  let madeExactMatch = true;
  while (madeExactMatch) {
    madeExactMatch = false;
    unresolvedPlayers().forEach((player) => {
      const candidates = remainingHeroes().filter((hero) =>
        heroFitsScrimRole(hero, player.role),
      );
      if (candidates.length !== 1) return;
      assignments[player.id] = candidates[0];
      used.add(normalize(candidates[0]));
      madeExactMatch = true;
    });
  }

  unresolvedPlayers()
    .sort((a, b) => {
      const aMatches = remainingHeroes().filter((hero) => heroFitsScrimRole(hero, a.role)).length;
      const bMatches = remainingHeroes().filter((hero) => heroFitsScrimRole(hero, b.role)).length;
      return aMatches - bMatches;
    })
    .forEach((player) => {
      const remaining = remainingHeroes();
      const hero = remaining.find((candidate) => heroFitsScrimRole(candidate, player.role)) ?? remaining[0];
      if (!hero) return;
      assignments[player.id] = hero;
      used.add(normalize(hero));
    });

  game.players.forEach((player) => {
    assignments[player.id] ??= player.hero.trim();
  });
  return assignments;
}

function heroFitsScrimRole(heroName: string, role: ScrimGame['players'][number]['role']) {
  const hero = heroVisual(heroName);
  return hero?.laneRecommendation.some(
    (lane) => normalize(String(lane)) === normalize(role),
  ) ?? false;
}

function lineupIsComplete(game: ScrimGame, lineup: Record<string, string>) {
  const picks = new Set(uniqueHeroes(game.ourPicks).map(normalize));
  const assigned = game.players.map((player) => normalize(lineup[player.id] ?? ''));
  return (
    picks.size >= game.players.length &&
    assigned.every(Boolean) &&
    new Set(assigned).size === game.players.length &&
    assigned.every((hero) => picks.has(hero))
  );
}

function needsDraftLineupMapping(game: ScrimGame) {
  const current = Object.fromEntries(
    game.players.map((player) => [player.id, player.hero]),
  );
  return uniqueHeroes(game.ourPicks).length >= game.players.length && !lineupIsComplete(game, current);
}

function sortedNotes(notes: ScrimLiveNote[]) {
  return [...notes].sort(
    (a, b) => a.elapsedSeconds - b.elapsedSeconds || a.createdAt.localeCompare(b.createdAt),
  );
}

function formatClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function parseClock(value: string) {
  const clean = value.trim();
  if (!clean) return null;
  const parts = clean.split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 1) return Math.round(parts[0] * 60);
  if (parts.length !== 2 || parts[1] >= 60) return null;
  return Math.round(parts[0] * 60 + parts[1]);
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
