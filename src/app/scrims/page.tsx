'use client';

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import {
  createScrimGame,
  createScrimSession,
  countUnsyncedLocalScrimSessions,
  listScrimSessions,
  migrateLocalScrimSessions,
  playerDerivedStats,
  resolveScrimAccess,
  safeRate,
  saveScrimSession,
  type ObjectiveOwner,
  type ScrimAccess,
  type ScrimGame,
  type ScrimPlayerGame,
  type ScrimResult,
  type ScrimSession,
  type ScrimSide,
  type ScrimStatus,
} from '@/lib/scrimDatabase';
import HeroAutocomplete, {
  PlayerHeroSelect,
} from '@/components/scrims/HeroAutocomplete';

type ScrimView = 'overview' | 'editor' | 'players' | 'opponents';
type SaveState =
  | 'Saved online'
  | 'Saving'
  | 'Local backup'
  | 'Read only'
  | 'Sync failed';

const numberValue = (event: ChangeEvent<HTMLInputElement>) =>
  Number(event.target.value) || 0;

export default function ScrimsPage() {
  const [sessions, setSessions] = useState<ScrimSession[]>([]);
  const [activeSession, setActiveSession] = useState<ScrimSession | null>(null);
  const [activeGameId, setActiveGameId] = useState('');
  const [view, setView] = useState<ScrimView>('overview');
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('Local backup');
  const [reportCopied, setReportCopied] = useState(false);
  const [access, setAccess] = useState<ScrimAccess | null>(null);
  const [localSessionCount, setLocalSessionCount] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [migrationState, setMigrationState] = useState('');

  useEffect(() => {
    let cancelled = false;

    void resolveScrimAccess()
      .then(async (resolvedAccess) => {
        const storedSessions = await listScrimSessions(resolvedAccess);
        const localCount =
          resolvedAccess.mode === 'cloud' && resolvedAccess.canEdit
            ? await countUnsyncedLocalScrimSessions(storedSessions)
            : 0;

        if (cancelled) return;
        setAccess(resolvedAccess);
        setSessions(storedSessions);
        setLocalSessionCount(localCount);
        setHydrated(true);
        setSaveState(
          resolvedAccess.mode === 'cloud'
            ? resolvedAccess.canEdit
              ? 'Saved online'
              : 'Read only'
            : resolvedAccess.mode === 'local'
              ? 'Local backup'
              : 'Read only',
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : 'Could not load scrim data.',
        );
        setHydrated(true);
        setSaveState('Sync failed');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !activeSession || !access || !access.canEdit) return;

    const timer = window.setTimeout(() => {
      void saveScrimSession(activeSession, access)
        .then((target) => {
          setSessions((current) => {
            const remaining = current.filter(
              (item) => item.id !== activeSession.id,
            );
            return [activeSession, ...remaining].sort((a, b) =>
              b.updatedAt.localeCompare(a.updatedAt),
            );
          });
          setSaveState(target === 'cloud' ? 'Saved online' : 'Local backup');
        })
        .catch(() => {
          setSaveState('Sync failed');
        });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [access, activeSession, hydrated]);

  const allGames = useMemo(
    () => sessions.flatMap((session) => session.games),
    [sessions],
  );
  const playerRows = useMemo(() => buildPlayerDashboard(sessions), [sessions]);
  const opponentRows = useMemo(() => buildOpponentDashboard(sessions), [sessions]);

  const activeGame =
    activeSession?.games.find((game) => game.id === activeGameId) ??
    activeSession?.games[0] ??
    null;
  const selectedDraftHeroes = activeGame
    ? [
        ...activeGame.ourPicks,
        ...activeGame.enemyPicks,
        ...activeGame.ourBans,
        ...activeGame.enemyBans,
      ]
    : [];

  function commit(next: ScrimSession) {
    if (access && !access.canEdit) return;
    setSaveState('Saving');
    setReportCopied(false);
    setActiveSession({
      ...next,
      updatedAt: new Date().toISOString(),
    });
  }

  function newSession() {
    if (access && !access.canEdit) return;
    const session = createScrimSession();
    setActiveSession(session);
    setActiveGameId(session.games[0].id);
    setView('editor');
    setSaveState('Saving');
  }

  function openSession(session: ScrimSession) {
    setActiveSession(session);
    setActiveGameId(session.games[0]?.id ?? '');
    setView('editor');
    setSaveState(
      access?.mode === 'cloud'
        ? access.canEdit
          ? 'Saved online'
          : 'Read only'
        : 'Local backup',
    );
  }

  function updateSession<K extends keyof ScrimSession>(
    field: K,
    value: ScrimSession[K],
  ) {
    if (!activeSession) return;
    commit({ ...activeSession, [field]: value });
  }

  function updateGame<K extends keyof ScrimGame>(
    field: K,
    value: ScrimGame[K],
  ) {
    if (!activeSession || !activeGame) return;
    commit({
      ...activeSession,
      games: activeSession.games.map((game) =>
        game.id === activeGame.id ? { ...game, [field]: value } : game,
      ),
    });
  }

  function updateOurPicks(heroes: string[]) {
    if (!activeSession || !activeGame) return;
    commit({
      ...activeSession,
      games: activeSession.games.map((game) =>
        game.id === activeGame.id
          ? {
              ...game,
              ourPicks: heroes,
              players: game.players.map((player) =>
                player.hero && !heroes.includes(player.hero)
                  ? { ...player, hero: '' }
                  : player,
              ),
            }
          : game,
      ),
    });
  }

  function updatePlayer<K extends keyof ScrimPlayerGame>(
    playerId: string,
    field: K,
    value: ScrimPlayerGame[K],
  ) {
    if (!activeSession || !activeGame) return;
    commit({
      ...activeSession,
      games: activeSession.games.map((game) =>
        game.id === activeGame.id
          ? {
              ...game,
              players: game.players.map((player) =>
                player.id === playerId ? { ...player, [field]: value } : player,
              ),
            }
          : game,
      ),
    });
  }

  function addGame(moveToNewGame = true) {
    if (!activeSession) return;
    const game = createScrimGame(activeSession.games.length + 1);
    commit({ ...activeSession, games: [...activeSession.games, game] });
    if (moveToNewGame) setActiveGameId(game.id);
  }

  function saveAndNext() {
    if (!activeSession || !activeGame) return;
    const currentIndex = activeSession.games.findIndex(
      (game) => game.id === activeGame.id,
    );
    const nextGame = activeSession.games[currentIndex + 1];
    if (nextGame) {
      setActiveGameId(nextGame.id);
    } else {
      addGame(true);
    }
  }

  function finishSession() {
    if (!activeSession) return;
    updateSession('status', 'Complete');
  }

  async function migrateLocalData() {
    if (!access?.canEdit) return;

    setMigrationState('Migrating local sessions…');
    try {
      const migrated = await migrateLocalScrimSessions(access);
      const cloudSessions = await listScrimSessions(access);
      setSessions(cloudSessions);
      setMigrationState(
        `${migrated} local session${migrated === 1 ? '' : 's'} copied online.`,
      );
      setLocalSessionCount(0);
      setSaveState('Saved online');
    } catch (error) {
      setMigrationState(
        error instanceof Error ? error.message : 'Migration failed.',
      );
    }
  }

  async function copyReport() {
    if (!activeSession) return;
    await navigator.clipboard.writeText(buildSessionReport(activeSession));
    setReportCopied(true);
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(sessions, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `chalize-scrims-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const totalWins = allGames.filter((game) => game.result === 'Win').length;
  const draftSession = sessions.find((session) => session.status === 'Draft');
  const readOnly = access?.mode === 'cloud' && !access.canEdit;

  if (hydrated && access?.mode === 'blocked') {
    return (
      <div className="page-wrap scrim-page">
        <header className="scrim-header">
          <div>
            <p className="eyebrow">CHALIZE / SECURE WORKSPACE</p>
            <h1>Access is waiting for approval.</h1>
            <p>
              Akun {access.email || 'ini'} sudah login, tetapi belum dimasukkan
              ke workspace tim.
            </p>
          </div>
        </header>
        <div className="empty-panel access-empty">
          <span>NO WORKSPACE ROLE</span>
          <h3>Ask the owner to add this account.</h3>
          <p>
            Setelah role Owner, Editor, atau Viewer diberikan, refresh halaman
            ini untuk membuka data tim.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="page-wrap scrim-page"
      data-read-only={readOnly ? 'true' : 'false'}
    >
      <header className="scrim-header">
        <div>
          <p className="eyebrow">CHALIZE / SCRIM TRACKER</p>
          <h1>Turn every block into evidence.</h1>
          <p>
            Catat per game, lihat performa pemain dan pola lawan, lalu review
            laporan otomatis sebelum dibagikan.
          </p>
        </div>
        <div className="save-indicator" data-state={saveState}>
          <i />
          <span>{saveState}</span>
          <small>
            {access?.mode === 'cloud'
              ? access.workspaceName
              : 'browser storage'}
          </small>
        </div>
      </header>

      {loadError && (
        <div className="workspace-alert danger">
          <strong>Cloud sync could not start.</strong>
          <span>{loadError}</span>
        </div>
      )}

      {access?.mode === 'cloud' && access.canEdit && localSessionCount > 0 && (
        <div className="workspace-alert">
          <div>
            <strong>{localSessionCount} local scrim session found</strong>
            <span>
              Copy data lama ke workspace online. Backup lokal tetap disimpan.
            </span>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={migrateLocalData}
          >
            Migrate to cloud
          </button>
          {migrationState && <small>{migrationState}</small>}
        </div>
      )}

      {readOnly && (
        <div className="workspace-alert viewer-alert">
          <div>
            <strong>Management view · read only</strong>
            <span>
              Hanya session berstatus Shared yang ditampilkan. Data tidak dapat
              diubah dari akun ini.
            </span>
          </div>
        </div>
      )}

      <nav className="scrim-tabs" aria-label="Scrim workspace">
        <TabButton active={view === 'overview'} onClick={() => setView('overview')}>
          Sessions
        </TabButton>
        <TabButton
          active={view === 'editor'}
          onClick={() => activeSession && setView('editor')}
          disabled={!activeSession}
        >
          Match Input
        </TabButton>
        <TabButton active={view === 'players'} onClick={() => setView('players')}>
          Player Performance
        </TabButton>
        <TabButton active={view === 'opponents'} onClick={() => setView('opponents')}>
          Opponent Insights
        </TabButton>
      </nav>

      {view === 'overview' && (
        <section className="scrim-overview">
          <div className="scrim-actions">
            {!readOnly && (
              <button className="primary-button" type="button" onClick={newSession}>
                + New Scrim Session
              </button>
            )}
            {!readOnly && draftSession && (
              <button
                className="secondary-button"
                type="button"
                onClick={() => openSession(draftSession)}
              >
                Resume unfinished
              </button>
            )}
            {sessions.length > 0 && (
              <button
                className="ghost-button"
                type="button"
                onClick={downloadBackup}
              >
                Download backup
              </button>
            )}
          </div>

          <div className="scrim-metric-grid">
            <Metric label="Sessions" value={sessions.length} detail="scrim blocks" />
            <Metric label="Games" value={allGames.length} detail="manually tracked" />
            <Metric
              label="Game record"
              value={`${totalWins}-${allGames.length - totalWins}`}
              detail={`${Math.round(safeRate(totalWins, allGames.length) * 100)}% win rate`}
            />
            <Metric
              label="Opponents"
              value={opponentRows.length}
              detail="playstyles mapped"
            />
          </div>

          <div className="section-heading">
            <div>
              <p className="eyebrow">HISTORY</p>
              <h2>Scrim sessions</h2>
            </div>
            <p>Newest update first. Draft sessions can be resumed anytime.</p>
          </div>

          {!hydrated ? (
            <div className="empty-panel">Loading secure scrim data…</div>
          ) : sessions.length === 0 ? (
            <div className="empty-panel">
              <span>NO SCRIM DATA YET</span>
              <h3>Mulai dari satu scrim block.</h3>
              <p>
                Contoh: 25 Jul · 13:00 · vs ONIC Indonesia · 4 games. Setiap
                perubahan akan tersimpan otomatis.
              </p>
              {!readOnly && (
                <button className="primary-button" type="button" onClick={newSession}>
                  Create first session
                </button>
              )}
            </div>
          ) : (
            <div className="session-list">
              {sessions.map((session) => {
                const wins = session.games.filter(
                  (game) => game.result === 'Win',
                ).length;
                return (
                  <button
                    className="session-card"
                    key={session.id}
                    type="button"
                    onClick={() => openSession(session)}
                  >
                    <div className="session-date">
                      <strong>{formatShortDate(session.date)}</strong>
                      <span>{session.time || '—'}</span>
                    </div>
                    <div className="session-opponent">
                      <small>OPPONENT</small>
                      <strong>{session.opponent || 'Untitled scrim'}</strong>
                      <span>{session.focus || 'No focus note'}</span>
                    </div>
                    <div className="session-record">
                      <small>RECORD</small>
                      <strong>
                        {wins}-{session.games.length - wins}
                      </strong>
                      <span>{session.games.length} games</span>
                    </div>
                    <StatusBadge status={session.status} />
                    <b>→</b>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {view === 'editor' && activeSession && (
        <section className={readOnly ? 'scrim-editor read-only' : 'scrim-editor'}>
          <div className="editor-toolbar">
            <button
              className="back-button"
              type="button"
              onClick={() => setView('overview')}
            >
              ← All sessions
            </button>
            <div>
              <StatusBadge status={activeSession.status} />
              {!readOnly && (
                <select
                  aria-label="Session status"
                  value={activeSession.status}
                  onChange={(event) =>
                    updateSession('status', event.target.value as ScrimStatus)
                  }
                >
                  <option value="Draft">Draft</option>
                  <option value="Complete">Complete</option>
                  <option value="Reviewed">Reviewed</option>
                  <option value="Shared">Shared</option>
                </select>
              )}
            </div>
          </div>

          <div className="form-panel session-setup">
            <div className="panel-title">
              <span>01</span>
              <div>
                <h2>Session setup</h2>
                <p>Satu lawan, satu jadwal, game sebanyak yang dibutuhkan.</p>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Opponent" className="field-wide">
                <input
                  value={activeSession.opponent}
                  placeholder="ONIC Indonesia"
                  onChange={(event) =>
                    updateSession('opponent', event.target.value)
                  }
                />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  value={activeSession.date}
                  onChange={(event) => updateSession('date', event.target.value)}
                />
              </Field>
              <Field label="Start time">
                <input
                  type="time"
                  value={activeSession.time}
                  onChange={(event) => updateSession('time', event.target.value)}
                />
              </Field>
              <Field label="Patch">
                <input
                  value={activeSession.patch}
                  placeholder="1.9.xx"
                  onChange={(event) => updateSession('patch', event.target.value)}
                />
              </Field>
              <Field label="Roster">
                <input
                  value={activeSession.roster}
                  placeholder="Main roster / trial roster"
                  onChange={(event) => updateSession('roster', event.target.value)}
                />
              </Field>
              <Field label="Session focus" className="field-wide">
                <input
                  value={activeSession.focus}
                  placeholder="Early-game setup, new EXP trial, objective control…"
                  onChange={(event) => updateSession('focus', event.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="game-switcher">
            <div>
              {activeSession.games.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  className={activeGame?.id === game.id ? 'active' : ''}
                  onClick={() => setActiveGameId(game.id)}
                >
                  <span>G{game.number}</span>
                  <small className={game.result === 'Win' ? 'win' : 'loss'}>
                    {game.result === 'Win' ? 'W' : 'L'}
                  </small>
                </button>
              ))}
            </div>
            {!readOnly && (
              <button
                className="add-game-button"
                type="button"
                onClick={() => addGame()}
              >
                + Add game
              </button>
            )}
          </div>

          {activeGame && (
            <>
              <div className="form-panel">
                <div className="panel-title">
                  <span>02</span>
                  <div>
                    <h2>Game {activeGame.number}</h2>
                    <p>Score, side, duration, dan objective checkpoints.</p>
                  </div>
                </div>

                <div className="result-strip">
                  <Segmented
                    label="Result"
                    value={activeGame.result}
                    options={['Win', 'Loss']}
                    onChange={(value) => updateGame('result', value as ScrimResult)}
                  />
                  <Segmented
                    label="Side"
                    value={activeGame.side}
                    options={['Blue', 'Red']}
                    onChange={(value) => updateGame('side', value as ScrimSide)}
                  />
                  <Field label="Duration (minutes)">
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={activeGame.durationMinutes}
                      onChange={(event) =>
                        updateGame('durationMinutes', numberValue(event))
                      }
                    />
                  </Field>
                  <Field label="Team kills">
                    <input
                      type="number"
                      min="0"
                      value={activeGame.teamKills}
                      onChange={(event) =>
                        updateGame('teamKills', numberValue(event))
                      }
                    />
                  </Field>
                  <Field label="Enemy kills">
                    <input
                      type="number"
                      min="0"
                      value={activeGame.enemyKills}
                      onChange={(event) =>
                        updateGame('enemyKills', numberValue(event))
                      }
                    />
                  </Field>
                </div>

                <div className="subsection-title">
                  <h3>Objective control</h3>
                  <span>OURS / THEIRS</span>
                </div>
                <div className="objective-grid">
                  <CounterPair
                    label="Turtles"
                    ours={activeGame.turtlesFor}
                    theirs={activeGame.turtlesAgainst}
                    onOurs={(value) => updateGame('turtlesFor', value)}
                    onTheirs={(value) => updateGame('turtlesAgainst', value)}
                  />
                  <CounterPair
                    label="Lords"
                    ours={activeGame.lordsFor}
                    theirs={activeGame.lordsAgainst}
                    onOurs={(value) => updateGame('lordsFor', value)}
                    onTheirs={(value) => updateGame('lordsAgainst', value)}
                  />
                  <CounterPair
                    label="Towers"
                    ours={activeGame.towersFor}
                    theirs={activeGame.towersAgainst}
                    onOurs={(value) => updateGame('towersFor', value)}
                    onTheirs={(value) => updateGame('towersAgainst', value)}
                  />
                  <Field label="First turtle">
                    <ObjectiveSelect
                      value={activeGame.firstTurtle}
                      onChange={(value) => updateGame('firstTurtle', value)}
                    />
                  </Field>
                  <Field label="First lord">
                    <ObjectiveSelect
                      value={activeGame.firstLord}
                      onChange={(value) => updateGame('firstLord', value)}
                    />
                  </Field>
                </div>

                <div className="subsection-title">
                  <h3>Gold difference</h3>
                  <span>POSITIVE = OUR LEAD</span>
                </div>
                <div className="gold-grid">
                  {(
                    [
                      ['goldDiff5', '@ 5 min'],
                      ['goldDiff10', '@ 10 min'],
                      ['goldDiff15', '@ 15 min'],
                    ] as const
                  ).map(([field, label]) => (
                    <Field label={label} key={field}>
                      <input
                        type="number"
                        value={activeGame[field]}
                        onChange={(event) => updateGame(field, numberValue(event))}
                      />
                    </Field>
                  ))}
                </div>
              </div>

              <div className="form-panel">
                <div className="panel-title">
                  <span>03</span>
                  <div>
                    <h2>Draft sequence</h2>
                    <p>
                      Ketik beberapa huruf lalu pilih hero dari database. Urutan
                      chip tetap disimpan untuk membaca pola fase draft.
                    </p>
                  </div>
                </div>
                <div className="draft-input-grid">
                  <HeroAutocomplete
                    key={`our-picks-${activeGame.id}`}
                    label="Our picks (P1 → P5)"
                    value={activeGame.ourPicks}
                    placeholder="Cari Fredrinn, Valentina…"
                    slotPrefix="P"
                    unavailableNames={selectedDraftHeroes}
                    disabled={Boolean(readOnly)}
                    onChange={updateOurPicks}
                  />
                  <HeroAutocomplete
                    key={`enemy-picks-${activeGame.id}`}
                    label="Enemy picks (P1 → P5)"
                    value={activeGame.enemyPicks}
                    placeholder="Cari Joy, Harith…"
                    slotPrefix="P"
                    unavailableNames={selectedDraftHeroes}
                    disabled={Boolean(readOnly)}
                    onChange={(heroes) => updateGame('enemyPicks', heroes)}
                  />
                  <HeroAutocomplete
                    key={`our-bans-${activeGame.id}`}
                    label="Our bans (B1 → B5)"
                    value={activeGame.ourBans}
                    placeholder="Cari Fanny, Zhuxin…"
                    slotPrefix="B"
                    unavailableNames={selectedDraftHeroes}
                    disabled={Boolean(readOnly)}
                    onChange={(heroes) => updateGame('ourBans', heroes)}
                  />
                  <HeroAutocomplete
                    key={`enemy-bans-${activeGame.id}`}
                    label="Enemy bans (B1 → B5)"
                    value={activeGame.enemyBans}
                    placeholder="Cari Lukas, Kalea…"
                    slotPrefix="B"
                    unavailableNames={selectedDraftHeroes}
                    disabled={Boolean(readOnly)}
                    onChange={(heroes) => updateGame('enemyBans', heroes)}
                  />
                </div>
              </div>

              <div className="form-panel player-input-panel">
                <div className="panel-title">
                  <span>04</span>
                  <div>
                    <h2>Player box score</h2>
                    <p>
                      Pilih hero dari Our Picks, lalu isi angka mentah. KDA, KP,
                      GPM, DPM, dan durability dihitung otomatis.
                    </p>
                  </div>
                </div>
                <div className="player-table-wrap">
                  <table className="player-input-table">
                    <thead>
                      <tr>
                        <th>Role / player</th>
                        <th>Hero</th>
                        <th>K</th>
                        <th>D</th>
                        <th>A</th>
                        <th>Gold</th>
                        <th>Damage</th>
                        <th>Taken</th>
                        <th>Turret</th>
                        <th>Auto metrics</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeGame.players.map((player) => {
                        const derived = playerDerivedStats(player, activeGame);
                        return (
                          <tr key={player.id}>
                            <td>
                              <span className="role-label">{player.role}</span>
                              <input
                                value={player.playerName}
                                placeholder={`${player.role} player`}
                                onChange={(event) =>
                                  updatePlayer(
                                    player.id,
                                    'playerName',
                                    event.target.value,
                                  )
                                }
                              />
                            </td>
                            <td>
                              <PlayerHeroSelect
                                value={player.hero}
                                ourPicks={activeGame.ourPicks}
                                unavailableNames={activeGame.players
                                  .filter((item) => item.id !== player.id)
                                  .map((item) => item.hero)
                                  .filter(Boolean)}
                                label={`${player.role} hero`}
                                disabled={Boolean(readOnly)}
                                onChange={(heroName) =>
                                  updatePlayer(
                                    player.id,
                                    'hero',
                                    heroName,
                                  )
                                }
                              />
                            </td>
                            {(['kills', 'deaths', 'assists'] as const).map(
                              (field) => (
                                <td key={field}>
                                  <input
                                    type="number"
                                    min="0"
                                    value={player[field]}
                                    onChange={(event) =>
                                      updatePlayer(
                                        player.id,
                                        field,
                                        numberValue(event),
                                      )
                                    }
                                  />
                                </td>
                              ),
                            )}
                            {(
                              [
                                ['gold', 'Gold'],
                                ['damageDealt', 'Damage'],
                                ['damageTaken', 'Taken'],
                                ['turretDamage', 'Turret'],
                              ] as const
                            ).map(([field]) => (
                              <td key={field}>
                                <input
                                  type="number"
                                  min="0"
                                  value={player[field]}
                                  onChange={(event) =>
                                    updatePlayer(
                                      player.id,
                                      field,
                                      numberValue(event),
                                    )
                                  }
                                />
                              </td>
                            ))}
                            <td>
                              <span>
                                {derived.kda.toFixed(1)} KDA ·{' '}
                                {Math.round(derived.kp)}% KP
                              </span>
                              <small>
                                {Math.round(derived.dpm)} DPM ·{' '}
                                {Math.round(derived.gpm)} GPM
                              </small>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="form-panel">
                <div className="panel-title compact">
                  <span>05</span>
                  <div>
                    <h2>Review notes</h2>
                    <p>Keputusan, pattern, atau konteks yang angka tidak tangkap.</p>
                  </div>
                </div>
                <textarea
                  className="game-notes"
                  value={activeGame.notes}
                  placeholder="Contoh: tempo turun setelah first lord; enemy selalu buka map lewat EXP..."
                  onChange={(event) => updateGame('notes', event.target.value)}
                />
              </div>

              {!readOnly && (
                <div className="editor-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={saveAndNext}
                  >
                    Save game & next →
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={finishSession}
                  >
                    Finish session
                  </button>
                </div>
              )}
            </>
          )}

          <SessionReport
            session={activeSession}
            copied={reportCopied}
            onCopy={copyReport}
            onConclusion={(value) => updateSession('sessionNotes', value)}
            onReviewed={() => updateSession('status', 'Reviewed')}
            onShared={() => updateSession('status', 'Shared')}
            canEdit={!readOnly}
          />
        </section>
      )}

      {view === 'players' && (
        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">PLAYER PERFORMANCE</p>
              <h2>Track impact across scrims</h2>
            </div>
            <p>Box-score indicators only. Use VOD and role context for the decision.</p>
          </div>
          {playerRows.length === 0 ? (
            <div className="empty-panel">
              <h3>No player data yet.</h3>
              <p>Player metrics appear after names and box scores are entered.</p>
            </div>
          ) : (
            <div className="dashboard-table-wrap">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Role</th>
                    <th>Games</th>
                    <th>Record</th>
                    <th>KDA</th>
                    <th>KP</th>
                    <th>DPM</th>
                    <th>GPM</th>
                    <th>Damage taken/min</th>
                    <th>Top heroes</th>
                  </tr>
                </thead>
                <tbody>
                  {playerRows.map((player) => (
                    <tr key={`${player.name}-${player.role}`}>
                      <td><strong>{player.name}</strong></td>
                      <td><span className="role-chip">{player.role}</span></td>
                      <td>{player.games}</td>
                      <td>{player.wins}-{player.games - player.wins}</td>
                      <td>{player.kda.toFixed(2)}</td>
                      <td>{Math.round(player.kp)}%</td>
                      <td>{Math.round(player.dpm)}</td>
                      <td>{Math.round(player.gpm)}</td>
                      <td>{Math.round(player.dtpm)}</td>
                      <td>{player.topHeroes.join(' · ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {view === 'opponents' && (
        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">OPPONENT INSIGHTS</p>
              <h2>Build a living playstyle map</h2>
            </div>
            <p>Draft priorities, objective tendencies, and your record by opponent.</p>
          </div>
          {opponentRows.length === 0 ? (
            <div className="empty-panel">
              <h3>No opponent data yet.</h3>
              <p>Patterns appear after opponent names, drafts, and objectives are saved.</p>
            </div>
          ) : (
            <div className="opponent-grid">
              {opponentRows.map((opponent) => (
                <article className="opponent-card" key={opponent.name}>
                  <div className="opponent-card-head">
                    <div>
                      <small>OPPONENT PROFILE</small>
                      <h3>{opponent.name}</h3>
                    </div>
                    <strong>
                      {opponent.wins}-{opponent.games - opponent.wins}
                    </strong>
                  </div>
                  <div className="opponent-stats">
                    <span>
                      <small>SESSIONS</small>
                      <b>{opponent.sessions}</b>
                    </span>
                    <span>
                      <small>AVG GAME</small>
                      <b>{opponent.averageDuration.toFixed(1)}m</b>
                    </span>
                    <span>
                      <small>THEIR 1ST TURTLE</small>
                      <b>{Math.round(opponent.firstTurtleRate)}%</b>
                    </span>
                  </div>
                  <PatternList label="TOP PICKS" values={opponent.topPicks} />
                  <PatternList label="TOP BANS VS US" values={opponent.topBans} />
                  <PatternList label="OUR PRIORITY VS THEM" values={opponent.ourPicks} />
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function TabButton({
  children,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={active ? 'active' : ''} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`form-field ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <article className="scrim-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function StatusBadge({ status }: { status: ScrimStatus }) {
  return <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>;
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="segmented-field">
      <span>{label}</span>
      <div>
        {options.map((option) => (
          <button
            type="button"
            key={option}
            className={value === option ? 'active' : ''}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function CounterPair({
  label,
  ours,
  theirs,
  onOurs,
  onTheirs,
}: {
  label: string;
  ours: number;
  theirs: number;
  onOurs: (value: number) => void;
  onTheirs: (value: number) => void;
}) {
  return (
    <div className="counter-pair">
      <span>{label}</span>
      <div>
        <input
          aria-label={`${label} for us`}
          type="number"
          min="0"
          value={ours}
          onChange={(event) => onOurs(numberValue(event))}
        />
        <b>:</b>
        <input
          aria-label={`${label} for opponent`}
          type="number"
          min="0"
          value={theirs}
          onChange={(event) => onTheirs(numberValue(event))}
        />
      </div>
    </div>
  );
}

function ObjectiveSelect({
  value,
  onChange,
}: {
  value: ObjectiveOwner;
  onChange: (value: ObjectiveOwner) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as ObjectiveOwner)}
    >
      <option value="None">Not recorded</option>
      <option value="Us">Us</option>
      <option value="Opponent">Opponent</option>
    </select>
  );
}

function SessionReport({
  session,
  copied,
  onCopy,
  onConclusion,
  onReviewed,
  onShared,
  canEdit,
}: {
  session: ScrimSession;
  copied: boolean;
  onCopy: () => void;
  onConclusion: (value: string) => void;
  onReviewed: () => void;
  onShared: () => void;
  canEdit: boolean;
}) {
  const games = session.games;
  const wins = games.filter((game) => game.result === 'Win').length;
  const objectiveFor = games.reduce(
    (sum, game) => sum + game.turtlesFor + game.lordsFor,
    0,
  );
  const objectiveAgainst = games.reduce(
    (sum, game) => sum + game.turtlesAgainst + game.lordsAgainst,
    0,
  );
  const blue = games.filter((game) => game.side === 'Blue');
  const red = games.filter((game) => game.side === 'Red');
  const blueWins = blue.filter((game) => game.result === 'Win').length;
  const redWins = red.filter((game) => game.result === 'Win').length;
  const enemyPicks = topValues(games.flatMap((game) => game.enemyPicks), 4);
  const enemyBans = topValues(games.flatMap((game) => game.enemyBans), 4);

  return (
    <section className="report-panel">
      <div className="report-head">
        <div>
          <p className="eyebrow">AUTO REPORT / REVIEW REQUIRED</p>
          <h2>{session.opponent || 'Untitled session'} review</h2>
          <p>
            Sistem merangkum data yang diinput. Coach tetap memutuskan konteks dan
            apa yang layak dibagikan.
          </p>
        </div>
        <StatusBadge status={session.status} />
      </div>

      <div className="report-summary-grid">
        <Metric
          label="Series"
          value={`${wins}-${games.length - wins}`}
          detail={`${games.length} games`}
        />
        <Metric
          label="Blue side"
          value={`${blueWins}-${blue.length - blueWins}`}
          detail={`${blue.length} games`}
        />
        <Metric
          label="Red side"
          value={`${redWins}-${red.length - redWins}`}
          detail={`${red.length} games`}
        />
        <Metric
          label="Major objectives"
          value={`${objectiveFor}-${objectiveAgainst}`}
          detail="turtles + lords"
        />
      </div>

      <div className="report-patterns">
        <PatternList label="ENEMY PICK PRIORITY" values={enemyPicks} />
        <PatternList label="ENEMY BANS" values={enemyBans} />
      </div>

      <label className="form-field report-conclusion">
        <span>Coach conclusion — added to the report</span>
        <textarea
          value={session.sessionNotes}
          placeholder="What actually mattered? What should the team repeat, fix, or test next?"
          onChange={(event) => onConclusion(event.target.value)}
          readOnly={!canEdit}
        />
      </label>

      <pre>{buildSessionReport(session)}</pre>

      <div className="report-actions">
        <button className="secondary-button" type="button" onClick={onCopy}>
          {copied ? 'Copied ✓' : 'Copy review report'}
        </button>
        {canEdit &&
          session.status !== 'Reviewed' &&
          session.status !== 'Shared' && (
          <button className="primary-button" type="button" onClick={onReviewed}>
            Mark as reviewed
          </button>
        )}
        {canEdit && session.status === 'Reviewed' && (
          <button className="primary-button" type="button" onClick={onShared}>
            Share with management →
          </button>
        )}
        {session.status === 'Shared' && (
          <span className="shared-confirmation">Visible to management ✓</span>
        )}
      </div>
    </section>
  );
}

function PatternList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="pattern-list">
      <span>{label}</span>
      <div>
        {values.length > 0 ? (
          values.map((value) => <b key={value}>{value}</b>)
        ) : (
          <small>No draft data</small>
        )}
      </div>
    </div>
  );
}

function formatShortDate(date: string) {
  if (!date) return 'No date';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  }).format(new Date(`${date}T00:00:00`));
}

function topValues(values: string[], limit: number) {
  const counts = new Map<string, number>();
  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      const key = value.toLowerCase();
      const existing = [...counts.keys()].find(
        (candidate) => candidate.toLowerCase() === key,
      );
      counts.set(existing ?? value, (counts.get(existing ?? value) ?? 0) + 1);
    });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => `${value} ×${count}`);
}

function buildSessionReport(session: ScrimSession) {
  const games = session.games;
  const wins = games.filter((game) => game.result === 'Win').length;
  const blue = games.filter((game) => game.side === 'Blue');
  const red = games.filter((game) => game.side === 'Red');
  const blueWins = blue.filter((game) => game.result === 'Win').length;
  const redWins = red.filter((game) => game.result === 'Win').length;
  const firstTurtles = games.filter((game) => game.firstTurtle !== 'None');
  const ourFirstTurtles = firstTurtles.filter(
    (game) => game.firstTurtle === 'Us',
  ).length;
  const enemyPicks = topValues(games.flatMap((game) => game.enemyPicks), 4);
  const enemyBans = topValues(games.flatMap((game) => game.enemyBans), 4);
  const notes = games
    .filter((game) => game.notes.trim())
    .map((game) => `G${game.number}: ${game.notes.trim()}`);

  return [
    `SCRIM REVIEW — ${session.opponent || 'Untitled opponent'}`,
    `${session.date}${session.time ? ` · ${session.time}` : ''}${session.patch ? ` · Patch ${session.patch}` : ''}`,
    '',
    `Record: ${wins}-${games.length - wins} (${games.length} games)`,
    `Side split: Blue ${blueWins}-${blue.length - blueWins} · Red ${redWins}-${red.length - redWins}`,
    `First turtle: ${ourFirstTurtles}/${firstTurtles.length || 0} recorded games`,
    `Enemy pick priority: ${enemyPicks.join(', ') || 'not recorded'}`,
    `Enemy bans: ${enemyBans.join(', ') || 'not recorded'}`,
    session.focus ? `Session focus: ${session.focus}` : '',
    session.roster ? `Roster: ${session.roster}` : '',
    notes.length ? `\nGame notes:\n${notes.join('\n')}` : '',
    session.sessionNotes ? `\nCoach conclusion:\n${session.sessionNotes}` : '',
    '',
    session.status === 'Shared'
      ? 'Status: shared with management.'
      : session.status === 'Reviewed'
        ? 'Status: reviewed by coach; ready to share.'
        : 'Status: requires coach review before sharing.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

interface PlayerDashboardRow {
  name: string;
  role: string;
  games: number;
  wins: number;
  kda: number;
  kp: number;
  dpm: number;
  gpm: number;
  dtpm: number;
  topHeroes: string[];
}

function buildPlayerDashboard(sessions: ScrimSession[]): PlayerDashboardRow[] {
  const rows = new Map<
    string,
    {
      name: string;
      role: string;
      games: number;
      wins: number;
      kills: number;
      deaths: number;
      assists: number;
      kp: number;
      dpm: number;
      gpm: number;
      dtpm: number;
      heroes: string[];
    }
  >();

  sessions.forEach((session) => {
    session.games.forEach((game) => {
      game.players.forEach((player) => {
        const name = player.playerName.trim();
        if (!name) return;
        const key = `${name.toLowerCase()}-${player.role}`;
        const derived = playerDerivedStats(player, game);
        const row = rows.get(key) ?? {
          name,
          role: player.role,
          games: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          kp: 0,
          dpm: 0,
          gpm: 0,
          dtpm: 0,
          heroes: [],
        };
        row.games += 1;
        row.wins += game.result === 'Win' ? 1 : 0;
        row.kills += player.kills;
        row.deaths += player.deaths;
        row.assists += player.assists;
        row.kp += derived.kp;
        row.dpm += derived.dpm;
        row.gpm += derived.gpm;
        row.dtpm += derived.dtpm;
        if (player.hero.trim()) row.heroes.push(player.hero.trim());
        rows.set(key, row);
      });
    });
  });

  return [...rows.values()]
    .map((row) => ({
      name: row.name,
      role: row.role,
      games: row.games,
      wins: row.wins,
      kda: (row.kills + row.assists) / Math.max(row.deaths, 1),
      kp: row.kp / row.games,
      dpm: row.dpm / row.games,
      gpm: row.gpm / row.games,
      dtpm: row.dtpm / row.games,
      topHeroes: topValues(row.heroes, 3),
    }))
    .sort((a, b) => b.games - a.games || b.dpm - a.dpm);
}

interface OpponentDashboardRow {
  name: string;
  sessions: number;
  games: number;
  wins: number;
  averageDuration: number;
  firstTurtleRate: number;
  topPicks: string[];
  topBans: string[];
  ourPicks: string[];
}

function buildOpponentDashboard(
  sessions: ScrimSession[],
): OpponentDashboardRow[] {
  const groups = new Map<string, ScrimSession[]>();

  sessions.forEach((session) => {
    const name = session.opponent.trim();
    if (!name) return;
    const key = name.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), session]);
  });

  return [...groups.values()]
    .map((group) => {
      const games = group.flatMap((session) => session.games);
      const recordedFirstTurtles = games.filter(
        (game) => game.firstTurtle !== 'None',
      );
      return {
        name: group[0].opponent,
        sessions: group.length,
        games: games.length,
        wins: games.filter((game) => game.result === 'Win').length,
        averageDuration:
          games.reduce((sum, game) => sum + game.durationMinutes, 0) /
          Math.max(games.length, 1),
        firstTurtleRate:
          safeRate(
            recordedFirstTurtles.filter(
              (game) => game.firstTurtle === 'Opponent',
            ).length,
            recordedFirstTurtles.length,
          ) * 100,
        topPicks: topValues(games.flatMap((game) => game.enemyPicks), 5),
        topBans: topValues(games.flatMap((game) => game.enemyBans), 5),
        ourPicks: topValues(games.flatMap((game) => game.ourPicks), 5),
      };
    })
    .sort((a, b) => b.games - a.games);
}
