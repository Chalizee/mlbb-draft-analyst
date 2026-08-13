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
import DraftIntelligence from '@/components/scrims/DraftIntelligence';
import {
  makeId,
  type ObjectiveOwner,
  type ScrimGame,
  type ScrimLiveClock,
  type ScrimLiveNote,
  type ScrimLiveNoteCategory,
  type ScrimResult,
  type ScrimSide,
  type ScrimSession,
} from '@/lib/scrimDatabase';
import styles from './LiveMatchMode.module.css';

type LiveStage = 'draft' | 'game';
type DraftKind = 'ban' | 'pick';
type DraftField = 'ourBans' | 'enemyBans' | 'ourPicks' | 'enemyPicks';
type CounterField =
  | 'teamKills'
  | 'enemyKills'
  | 'turtlesFor'
  | 'turtlesAgainst'
  | 'lordsFor'
  | 'lordsAgainst'
  | 'towersFor'
  | 'towersAgainst';
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
          In Game
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

      {stage === 'draft' ? (
        <QuickNotes game={game} onChange={onChange} />
      ) : (
        <details className={styles.optionalNotes}>
          <summary>
            Optional detailed note
            <small>{game.liveNotes?.length ?? 0} timeline entries</small>
          </summary>
          <QuickNotes game={game} onChange={onChange} />
        </details>
      )}
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
  const suggestions = useMemo(
    () =>
      normalizedQuery
        ? SORTED_HEROES.filter((hero) => {
            if (usedNames.has(normalize(hero.name))) return false;
            return heroSearchText(hero).includes(normalizedQuery);
          }).slice(0, 10)
        : [],
    [normalizedQuery, usedNames],
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
    window.requestAnimationFrame(() => inputRef.current?.focus());
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

  return (
    <section className={styles.livePanel}>
      <header className={styles.panelHeading}>
        <div>
          <span>DRAFT CAPTURE</span>
          <h3>Follow the highlighted slot</h3>
          <p>Tap a completed slot to correct it. Future slots stay locked to protect order.</p>
        </div>
        <SideSwitch side={game.side} onChange={(side) => onChange({ ...game, side })} />
      </header>

      <div className={styles.draftProgress}>
        {DRAFT_SEQUENCE.map((step, index) => {
          const field = draftField(step, game.side);
          const value = game[field][step.index] ?? '';
          const isFutureForTeam = !value && step.index > game[field].length;
          const isActive = index === activeStepIndex;
          const owner = step.side === game.side ? 'our' : 'enemy';
          return (
            <button
              className={isActive ? styles.activeDraftStep : ''}
              data-owner={owner}
              data-kind={step.kind}
              type="button"
              disabled={isFutureForTeam}
              key={`${step.side}-${step.kind}-${step.index}`}
              title={draftStepLabel(step, game.side)}
              onClick={() => {
                setSelectedStepIndex(index);
                setQuery('');
                window.requestAnimationFrame(() => inputRef.current?.focus());
              }}
            >
              <small>{step.phase === 1 ? 'P1' : 'P2'}</small>
              {value ? (
                <HeroAvatar
                  name={value}
                  imageUrl={heroVisual(value)?.imageUrl}
                  size="xs"
                />
              ) : (
                <i>{step.kind === 'ban' ? 'B' : 'P'}{step.index + 1}</i>
              )}
              <span>{value || draftOwnerLabel(step, game.side)}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.nextDraftCard}>
        {activeStep ? (
          <>
            <div className={styles.nextLabel}>
              <span>NEXT INPUT</span>
              <strong>{draftStepLabel(activeStep, game.side)}</strong>
              {currentHero && <small>Replacing {currentHero}</small>}
            </div>
            <div className={styles.heroSearch}>
              <input
                ref={inputRef}
                value={query}
                autoComplete="off"
                spellCheck={false}
                placeholder="Type 2–3 letters…"
                aria-label={`Choose hero for ${draftStepLabel(activeStep, game.side)}`}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && suggestions[0]) {
                    event.preventDefault();
                    selectHero(suggestions[0].name);
                  }
                }}
              />
              <div className={styles.heroSuggestions}>
                {suggestions.map((hero) => (
                  <button type="button" key={hero.name} onClick={() => selectHero(hero.name)}>
                    <HeroAvatar name={hero.name} imageUrl={hero.imageUrl} size="sm" />
                    <span>{hero.name}</span>
                    <small>{hero.role}</small>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className={styles.draftComplete}>
            <span>DRAFT COMPLETE</span>
            <strong>All 20 slots recorded.</strong>
          </div>
        )}
      </div>

      <DraftIntelligence
        sessions={sessions}
        game={game}
        opponent={opponent}
        patch={patch}
        context={
          activeStep
            ? {
                owner: activeStep.side === game.side ? 'our' : 'enemy',
                kind: activeStep.kind,
                slot: activeStep.index + 1,
                phase: activeStep.phase,
              }
            : null
        }
      />

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
  const feedbackTimerRef = useRef<number | null>(null);
  const clock = normalizedClock(game.liveClock);
  const running = Boolean(clock.startedAt);
  const elapsed = elapsedAt(clock, now);

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

  function changeCounter(field: CounterField, delta: number) {
    const nextValue = Math.max(0, game[field] + delta);
    const nextGame: ScrimGame = { ...game, [field]: nextValue };
    const turtleField = field === 'turtlesFor' || field === 'turtlesAgainst';
    const lordField = field === 'lordsFor' || field === 'lordsAgainst';

    if (delta > 0 && turtleField && game.firstTurtle === 'None') {
      nextGame.firstTurtle = field === 'turtlesFor' ? 'Us' : 'Opponent';
    }
    if (delta > 0 && lordField && game.firstLord === 'None') {
      nextGame.firstLord = field === 'lordsFor' ? 'Us' : 'Opponent';
    }
    if (
      delta < 0 &&
      turtleField &&
      nextGame.turtlesFor + nextGame.turtlesAgainst === 0
    ) {
      nextGame.firstTurtle = 'None';
    }
    if (
      delta < 0 &&
      lordField &&
      nextGame.lordsFor + nextGame.lordsAgainst === 0
    ) {
      nextGame.firstLord = 'None';
    }
    onChange(nextGame);
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

  function markMoment() {
    const markedAt = elapsedAt(normalizedClock(game.liveClock), Date.now());
    const marker: ScrimLiveNote = {
      id: makeId('live-marker'),
      elapsedSeconds: markedAt,
      category: 'Review',
      text: '',
      createdAt: new Date().toISOString(),
    };

    onChange({
      ...game,
      liveNotes: [...(game.liveNotes ?? []), marker],
    });
    setMarkFeedback(`Saved at ${formatClock(markedAt)}`);
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => setMarkFeedback(''), 1_800);
  }

  function undoLastMarker() {
    const notes = game.liveNotes ?? [];
    let markerIndex = -1;
    for (let index = notes.length - 1; index >= 0; index -= 1) {
      if (notes[index].category === 'Review') {
        markerIndex = index;
        break;
      }
    }
    if (markerIndex < 0) return;
    onChange({
      ...game,
      liveNotes: notes.filter((_, index) => index !== markerIndex),
    });
    setMarkFeedback('Last marker removed');
  }

  const reviewMarkers = (game.liveNotes ?? []).filter(
    (note) => note.category === 'Review',
  );
  const lastReviewMarker = reviewMarkers[reviewMarkers.length - 1];

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

  return (
    <section className={styles.livePanel}>
      <div className={styles.gameTopGrid}>
        <article className={styles.clockCard}>
          <span>GAME CLOCK</span>
          <strong>{formatClock(elapsed)}</strong>
          <div>
            <button type="button" onClick={() => updateClock(elapsed - 10)}>-10s</button>
            <button className={styles.clockToggle} type="button" onClick={toggleClock}>
              {running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start game'}
            </button>
            <button type="button" onClick={() => updateClock(elapsed + 10)}>+10s</button>
          </div>
          <small>Timestamp notes follows this clock.</small>
        </article>

        <article className={styles.momentCard} data-saved={Boolean(markFeedback)}>
          <span>ONE-TAP REVIEW MARKER</span>
          <strong>See something important?</strong>
          <button type="button" onClick={markMoment}>
            <i /> MARK MOMENT
            <small>{formatClock(elapsed)}</small>
          </button>
          <footer>
            <span>
              {markFeedback ||
                (lastReviewMarker
                  ? `Last marker ${formatClock(lastReviewMarker.elapsedSeconds)}`
                  : 'No marker yet')}
            </span>
            <button
              type="button"
              disabled={!lastReviewMarker}
              onClick={undoLastMarker}
            >
              Undo
            </button>
          </footer>
        </article>

        <article className={styles.resultCard}>
          <span>GAME STATE</span>
          <div className={styles.resultSwitch}>
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
          <CounterControl
            label="Kills"
            ours={game.teamKills}
            enemy={game.enemyKills}
            onOurs={(delta) => changeCounter('teamKills', delta)}
            onEnemy={(delta) => changeCounter('enemyKills', delta)}
          />
        </article>
      </div>

      <section className={styles.controlSection}>
        <header>
          <div>
            <span>ONE-TAP OBJECTIVES</span>
            <h3>Tap the team that secured it</h3>
          </div>
          <small>FIRST TURTLE / LORD SET AUTOMATICALLY</small>
        </header>
        <div className={styles.objectiveControls}>
          <CounterControl
            label="Turtles"
            ours={game.turtlesFor}
            enemy={game.turtlesAgainst}
            first={game.firstTurtle}
            onOurs={(delta) => changeCounter('turtlesFor', delta)}
            onEnemy={(delta) => changeCounter('turtlesAgainst', delta)}
          />
          <CounterControl
            label="Lords"
            ours={game.lordsFor}
            enemy={game.lordsAgainst}
            first={game.firstLord}
            onOurs={(delta) => changeCounter('lordsFor', delta)}
            onEnemy={(delta) => changeCounter('lordsAgainst', delta)}
          />
          <CounterControl
            label="Towers"
            ours={game.towersFor}
            enemy={game.towersAgainst}
            onOurs={(delta) => changeCounter('towersFor', delta)}
            onEnemy={(delta) => changeCounter('towersAgainst', delta)}
          />
        </div>
      </section>

      <section className={styles.controlSection}>
        <header>
          <div>
            <span>GOLD CHECKPOINTS</span>
            <h3>Enter both total gold values</h3>
          </div>
          <small>DIFFERENCE CALCULATED AUTOMATICALLY</small>
        </header>
        <div className={styles.liveGoldGrid}>
          {([5, 10, 15] as const).map((minute) => {
            const fields = GOLD_FIELDS[minute];
            const difference = game[fields.difference] ?? 0;
            return (
              <article key={minute}>
                <header>
                  <strong>@ {minute} MIN</strong>
                  <span data-tone={difference > 0 ? 'lead' : difference < 0 ? 'behind' : 'even'}>
                    {difference === 0 ? 'EVEN' : `${difference > 0 ? '+' : ''}${difference}`}
                  </span>
                </header>
                <label>
                  <span>OUR GOLD</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={game[fields.ours] || ''}
                    placeholder="e.g. 15200"
                    onChange={(event) =>
                      updateGold(minute, 'ours', Number(event.target.value) || 0)
                    }
                  />
                </label>
                <label>
                  <span>ENEMY GOLD</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={game[fields.enemy] || ''}
                    placeholder="e.g. 14800"
                    onChange={(event) =>
                      updateGold(minute, 'enemy', Number(event.target.value) || 0)
                    }
                  />
                </label>
              </article>
            );
          })}
        </div>
      </section>

      <footer className={styles.finishBar}>
        <div>
          <span>FINISH LIVE CAPTURE</span>
          <small>Timer stops and duration is copied to the full editor.</small>
        </div>
        <button type="button" onClick={finishLiveGame}>Finish & review game →</button>
      </footer>
    </section>
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

function CounterControl({
  label,
  ours,
  enemy,
  first,
  onOurs,
  onEnemy,
}: {
  label: string;
  ours: number;
  enemy: number;
  first?: ObjectiveOwner;
  onOurs: (delta: number) => void;
  onEnemy: (delta: number) => void;
}) {
  return (
    <article className={styles.counterControl}>
      <header>
        <strong>{label}</strong>
        {first && first !== 'None' && <small>1st · {first}</small>}
      </header>
      <div>
        <button type="button" data-team="ours" onClick={() => onOurs(1)}>
          <span>OUR +1</span>
          <strong>{ours}</strong>
        </button>
        <button type="button" data-team="enemy" onClick={() => onEnemy(1)}>
          <span>ENEMY +1</span>
          <strong>{enemy}</strong>
        </button>
      </div>
      <footer>
        <button type="button" disabled={ours === 0} onClick={() => onOurs(-1)}>Undo ours</button>
        <button type="button" disabled={enemy === 0} onClick={() => onEnemy(-1)}>Undo enemy</button>
      </footer>
    </article>
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
