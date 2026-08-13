'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import { HERO_DATA } from '@/data/heroData';
import {
  SCRIM_ROLES,
  makeId,
  type ScrimGame,
  type ScrimOpponentPlayerGame,
  type ScrimRole,
} from '@/lib/scrimDatabase';
import {
  parseMlbbScoreScreenshots,
  type ScreenshotParseResult,
  type ScreenshotStatRow,
  type ScreenshotTeamSide,
} from '@/lib/screenshotScoreParser';
import styles from './ScreenshotBoxScoreImporter.module.css';

interface ScreenshotBoxScoreImporterProps {
  game: ScrimGame;
  disabled?: boolean;
  onApply: (game: ScrimGame) => void;
}

interface ReviewRow extends ScreenshotStatRow {
  key: string;
  role: ScrimRole | '';
  playerName: string;
  hero: string;
}

interface ReviewState {
  parsed: ScreenshotParseResult;
  ourSide: ScreenshotTeamSide;
  ourRows: ReviewRow[];
  opponentRows: ReviewRow[];
}

type NumericField =
  | 'kills'
  | 'deaths'
  | 'assists'
  | 'gold'
  | 'damageDealt'
  | 'damageTaken'
  | 'turretDamage'
  | 'teamfightParticipation';

const HERO_NAMES = HERO_DATA.map((hero) => hero.name).sort((a, b) =>
  a.localeCompare(b),
);

export default function ScreenshotBoxScoreImporter({
  game,
  disabled = false,
  onApply,
}: ScreenshotBoxScoreImporterProps) {
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [overviewFile, setOverviewFile] = useState<File | null>(null);
  const [ourSide, setOurSide] = useState<ScreenshotTeamSide>('left');
  const [review, setReview] = useState<ReviewState | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);
  const reading = progress > 0 && progress < 100;
  const duplicateRoles = useMemo(() => {
    if (!review) return new Set<ScrimRole>();
    const counts = new Map<ScrimRole, number>();
    review.ourRows.forEach((row) => {
      if (row.role) counts.set(row.role, (counts.get(row.role) ?? 0) + 1);
    });
    return new Set(
      [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([role]) => role),
    );
  }, [review]);
  const canApply = Boolean(
    review &&
      review.ourRows.every((row) => row.role) &&
      duplicateRoles.size === 0,
  );

  async function readScreenshots() {
    if (!dataFile || !overviewFile) return;
    setError('');
    setApplied(false);
    setReview(null);
    setProgress(1);
    setProgressLabel('Preparing OCR engine…');
    const urls: string[] = [];

    try {
      const tesseract = await import('tesseract.js');
      const worker = await tesseract.createWorker('eng', tesseract.OEM.LSTM_ONLY, {
        logger(message) {
          const base = progressLabelFor(message.status);
          if (base) setProgressLabel(base);
          if (message.status === 'recognizing text') {
            setProgress((current) =>
              current < 48
                ? 8 + Math.round(message.progress * 39)
                : 52 + Math.round(message.progress * 43),
            );
          }
        },
      });
      await worker.setParameters({
        tessedit_pageseg_mode: tesseract.PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1',
        user_defined_dpi: '150',
      });

      const dataUrl = URL.createObjectURL(dataFile);
      const overviewUrl = URL.createObjectURL(overviewFile);
      urls.push(dataUrl, overviewUrl);
      const dimensions = await imageDimensions(dataUrl);
      setProgressLabel('Reading K/D/A and gold screenshot…');
      const dataResult = await worker.recognize(
        dataUrl,
        { rotateAuto: true },
        { text: true, tsv: true },
      );
      setProgress(51);
      setProgressLabel('Reading damage overview screenshot…');
      const overviewResult = await worker.recognize(
        overviewUrl,
        { rotateAuto: true },
        { text: true, tsv: true },
      );
      await worker.terminate();

      const parsed = parseMlbbScoreScreenshots({
        dataTsv: dataResult.data.tsv ?? '',
        dataText: dataResult.data.text ?? '',
        overviewTsv: overviewResult.data.tsv ?? '',
        overviewText: overviewResult.data.text ?? '',
        width: dimensions.width,
        height: dimensions.height,
      });
      setReview(buildReview(parsed, ourSide, game));
      setProgress(100);
      setProgressLabel('OCR finished. Verify every highlighted field.');
    } catch (caught) {
      setProgress(0);
      setProgressLabel('');
      setError(
        caught instanceof Error
          ? caught.message
          : 'The screenshots could not be read.',
      );
    } finally {
      urls.forEach((url) => URL.revokeObjectURL(url));
    }
  }

  function changeSide(side: ScreenshotTeamSide) {
    setOurSide(side);
    setReview((current) =>
      current ? buildReview(current.parsed, side, game) : current,
    );
    setApplied(false);
  }

  function updateRow(
    owner: 'ours' | 'opponent',
    rowKey: string,
    field: keyof ReviewRow,
    value: ReviewRow[keyof ReviewRow],
  ) {
    setReview((current) => {
      if (!current) return current;
      const key = owner === 'ours' ? 'ourRows' : 'opponentRows';
      return {
        ...current,
        [key]: current[key].map((row) =>
          row.key === rowKey ? { ...row, [field]: value } : row,
        ),
      };
    });
    setApplied(false);
  }

  function applyPreview() {
    if (!review || !canApply) return;
    const leftIsOurs = review.ourSide === 'left';
    const ourKills = leftIsOurs
      ? review.parsed.leftKills
      : review.parsed.rightKills;
    const enemyKills = leftIsOurs
      ? review.parsed.rightKills
      : review.parsed.leftKills;
    const nextPlayers = game.players.map((player) => {
      const row = review.ourRows.find((candidate) => candidate.role === player.role);
      if (!row) return player;
      return {
        ...player,
        playerName: row.playerName.trim() || player.playerName,
        hero: row.hero.trim() || player.hero,
        kills: row.kills ?? player.kills,
        deaths: row.deaths ?? player.deaths,
        assists: row.assists ?? player.assists,
        gold: row.gold ?? player.gold,
        damageDealt: row.damageDealt ?? player.damageDealt,
        damageTaken: row.damageTaken ?? player.damageTaken,
        turretDamage: row.turretDamage ?? player.turretDamage,
        teamfightParticipation:
          row.teamfightParticipation ?? player.teamfightParticipation ?? null,
      };
    });
    const opponentPlayers: ScrimOpponentPlayerGame[] = review.opponentRows.map(
      (row, index) => ({
        id: game.opponentPlayers?.[index]?.id ?? makeId('opponent-player'),
        playerName: row.playerName.trim(),
        role: row.role || null,
        hero: row.hero.trim(),
        kills: row.kills,
        deaths: row.deaths,
        assists: row.assists,
        gold: row.gold,
        damageDealt: row.damageDealt,
        damageTaken: row.damageTaken,
        turretDamage: row.turretDamage,
        teamfightParticipation: row.teamfightParticipation,
        notes: game.opponentPlayers?.[index]?.notes ?? '',
      }),
    );
    const ourStatsComplete = review.ourRows.every(
      (row) => row.role && row.playerName.trim() && row.hero.trim() && hasFullStats(row),
    );
    const opponentStatsComplete = review.opponentRows.every(
      (row) => row.playerName.trim() && row.hero.trim() && hasFullStats(row),
    );

    onApply({
      ...game,
      result: review.parsed.result ?? game.result,
      durationMinutes: review.parsed.durationMinutes ?? game.durationMinutes,
      teamKills: ourKills ?? game.teamKills,
      enemyKills: enemyKills ?? game.enemyKills,
      players: nextPlayers,
      opponentPlayers,
      importMeta: {
        source: 'Screenshot',
        importedAt: new Date().toISOString(),
        battleId: review.parsed.battleId || game.importMeta?.battleId,
        dataScreenshotName: dataFile?.name,
        overviewScreenshotName: overviewFile?.name,
        ourStatsComplete,
        opponentStatsComplete,
        verified: true,
      },
    });
    setApplied(true);
  }

  return (
    <section className={styles.importer}>
      <header className={styles.heading}>
        <div>
          <span>SEMI-AUTO SCREENSHOT IMPORT</span>
          <h3>Two screenshots. One verified box score.</h3>
          <p>
            Upload Data (K/D/A + gold) and Overall (damage) from the same game.
            Nothing is saved until you press Apply verified data.
          </p>
        </div>
        <span className={styles.safetyBadge}>PREVIEW FIRST</span>
      </header>

      <div className={styles.setupGrid}>
        <FileDrop
          label="1 · DATA SCREEN"
          hint="K/D/A, gold, result and duration"
          file={dataFile}
          disabled={disabled || reading}
          onChange={(file) => {
            setDataFile(file);
            setReview(null);
            setProgress(0);
          }}
        />
        <FileDrop
          label="2 · OVERALL SCREEN"
          hint="Hero damage, turret, taken, participation"
          file={overviewFile}
          disabled={disabled || reading}
          onChange={(file) => {
            setOverviewFile(file);
            setReview(null);
            setProgress(0);
          }}
        />
        <div className={styles.sidePicker}>
          <span>OUR TEAM POSITION</span>
          <div>
            <button
              type="button"
              className={ourSide === 'left' ? styles.activeSide : ''}
              onClick={() => changeSide('left')}
              disabled={disabled || reading}
            >
              Blue / left
            </button>
            <button
              type="button"
              className={ourSide === 'right' ? styles.activeSide : ''}
              onClick={() => changeSide('right')}
              disabled={disabled || reading}
            >
              Red / right
            </button>
          </div>
          <small>Choose screen position, not draft side.</small>
        </div>
      </div>

      <div className={styles.readBar}>
        <button
          type="button"
          disabled={disabled || reading || !dataFile || !overviewFile}
          onClick={() => void readScreenshots()}
        >
          {reading ? 'Reading screenshots…' : 'Read both screenshots'}
        </button>
        <div>
          <span style={{ width: `${progress}%` }} />
        </div>
        <small>{progressLabel || 'OCR runs only when both files are selected.'}</small>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {review && (
        <div className={styles.review}>
          <header>
            <div>
              <span>VERIFY BEFORE APPLY</span>
              <h4>
                {review.parsed.result ?? 'Result?'} ·{' '}
                {review.parsed.durationMinutes?.toFixed(1) ?? '—'} min ·{' '}
                {review.parsed.detectedCells}/{review.parsed.totalCells} numeric cells detected
              </h4>
            </div>
            <small>
              {review.parsed.battleId
                ? `Battle ID ${review.parsed.battleId}`
                : 'Battle ID not detected — pair files manually'}
            </small>
          </header>

          <ReviewTeam
            label="OUR TEAM"
            rows={review.ourRows}
            heroChoices={game.ourPicks.length > 0 ? game.ourPicks : HERO_NAMES}
            duplicateRoles={duplicateRoles}
            disabled={disabled}
            onChange={(rowKey, field, value) =>
              updateRow('ours', rowKey, field, value)
            }
          />
          <ReviewTeam
            label="OPPONENT"
            rows={review.opponentRows}
            heroChoices={game.enemyPicks.length > 0 ? game.enemyPicks : HERO_NAMES}
            duplicateRoles={new Set<ScrimRole>()}
            disabled={disabled}
            opponent
            onChange={(rowKey, field, value) =>
              updateRow('opponent', rowKey, field, value)
            }
          />

          <footer className={styles.applyBar}>
            <div>
              <strong>
                {duplicateRoles.size > 0
                  ? 'Fix duplicate team roles first.'
                  : !review.ourRows.every((row) => row.role)
                    ? 'Assign all five team roles first.'
                    : 'Uncertain OCR cells may be left blank; existing values are preserved.'}
              </strong>
              <small>
                Hero portraits cannot be trusted from OCR, so confirm heroes from the saved draft.
              </small>
            </div>
            <button type="button" disabled={!canApply || disabled} onClick={applyPreview}>
              {applied ? 'Applied ✓' : 'Apply verified data'}
            </button>
          </footer>

          <details className={styles.rawOcr}>
            <summary>OCR troubleshooting text</summary>
            <pre>{review.parsed.rawDataText}\n\n{review.parsed.rawOverviewText}</pre>
          </details>
        </div>
      )}
    </section>
  );
}

function FileDrop({
  label,
  hint,
  file,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className={styles.fileDrop}>
      <span>{label}</span>
      <strong>{file?.name ?? 'Choose screenshot'}</strong>
      <small>{hint}</small>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={disabled}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function ReviewTeam({
  label,
  rows,
  heroChoices,
  duplicateRoles,
  disabled,
  opponent = false,
  onChange,
}: {
  label: string;
  rows: ReviewRow[];
  heroChoices: string[];
  duplicateRoles: Set<ScrimRole>;
  disabled: boolean;
  opponent?: boolean;
  onChange: (
    rowKey: string,
    field: keyof ReviewRow,
    value: ReviewRow[keyof ReviewRow],
  ) => void;
}) {
  return (
    <section className={styles.teamReview} data-team={opponent ? 'opponent' : 'ours'}>
      <header>
        <strong>{label}</strong>
        <small>{opponent ? 'ENEMY BOX SCORE' : 'MAP TO CHALIZE ROSTER'}</small>
      </header>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Player</th>
              <th>Hero</th>
              <th>K</th>
              <th>D</th>
              <th>A</th>
              <th>Gold</th>
              <th>Damage</th>
              <th>Taken</th>
              <th>Turret</th>
              <th>TFP%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <select
                    aria-label={`${label} row ${row.row + 1} role`}
                    value={row.role}
                    data-warning={row.role && duplicateRoles.has(row.role)}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange(row.key, 'role', event.target.value as ScrimRole | '')
                    }
                  >
                    <option value="">—</option>
                    {SCRIM_ROLES.map((role) => <option key={role}>{role}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    aria-label={`${label} row ${row.row + 1} player`}
                    value={row.playerName}
                    placeholder={row.detectedName || 'Verify name'}
                    disabled={disabled}
                    onChange={(event) => onChange(row.key, 'playerName', event.target.value)}
                  />
                </td>
                <td>
                  <select
                    aria-label={`${label} row ${row.row + 1} hero`}
                    value={row.hero}
                    disabled={disabled}
                    onChange={(event) => onChange(row.key, 'hero', event.target.value)}
                  >
                    <option value="">Verify hero…</option>
                    {heroChoices.map((hero) => <option key={hero}>{hero}</option>)}
                  </select>
                </td>
                {(
                  [
                    'kills',
                    'deaths',
                    'assists',
                    'gold',
                    'damageDealt',
                    'damageTaken',
                    'turretDamage',
                    'teamfightParticipation',
                  ] as NumericField[]
                ).map((field) => (
                  <td key={field}>
                    <NullableNumberInput
                      value={row[field]}
                      label={`${label} row ${row.row + 1} ${field}`}
                      disabled={disabled}
                      onChange={(value) => onChange(row.key, field, value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NullableNumberInput({
  value,
  label,
  disabled,
  onChange,
}: {
  value: number | null;
  label: string;
  disabled: boolean;
  onChange: (value: number | null) => void;
}) {
  function change(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    onChange(raw === '' ? null : Math.max(0, Number(raw) || 0));
  }

  return (
    <input
      type="number"
      min="0"
      inputMode="numeric"
      aria-label={label}
      value={value ?? ''}
      placeholder="—"
      data-missing={value === null}
      disabled={disabled}
      onChange={change}
    />
  );
}

function buildReview(
  parsed: ScreenshotParseResult,
  ourSide: ScreenshotTeamSide,
  game: ScrimGame,
): ReviewState {
  const ourParsed = ourSide === 'left' ? parsed.left : parsed.right;
  const opponentParsed = ourSide === 'left' ? parsed.right : parsed.left;
  const ourRows = matchOurRows(ourParsed, game);
  const opponentRows: ReviewRow[] = opponentParsed.map((row, index) => ({
    ...row,
    key: `opponent-${index}`,
    role: (game.opponentPlayers?.[index]?.role ?? '') as ScrimRole | '',
    playerName:
      row.detectedName || game.opponentPlayers?.[index]?.playerName || '',
    hero: game.opponentPlayers?.[index]?.hero ?? '',
  }));
  return { parsed, ourSide, ourRows, opponentRows };
}

function matchOurRows(rows: ScreenshotStatRow[], game: ScrimGame): ReviewRow[] {
  const assignedRoles = new Set<ScrimRole>();
  const matches = rows.map((row, index) => {
    const ranked = game.players
      .filter((player) => player.playerName.trim() && !assignedRoles.has(player.role))
      .map((player) => ({
        player,
        score: nameSimilarity(row.detectedName, player.playerName),
      }))
      .sort((a, b) => b.score - a.score);
    const match = ranked[0]?.score >= 0.42 ? ranked[0].player : null;
    if (match) assignedRoles.add(match.role);
    return {
      ...row,
      key: `ours-${index}`,
      role: match?.role ?? ('' as const),
      playerName: match?.playerName ?? row.detectedName,
      hero: match?.hero ?? '',
    };
  });

  const unmatchedRows = matches.filter((row) => !row.role);
  const unmatchedPlayers = game.players.filter(
    (player) => !assignedRoles.has(player.role),
  );
  if (unmatchedRows.length === 1 && unmatchedPlayers.length === 1) {
    unmatchedRows[0].role = unmatchedPlayers[0].role;
    unmatchedRows[0].playerName = unmatchedPlayers[0].playerName;
    unmatchedRows[0].hero = unmatchedPlayers[0].hero;
  }
  return matches;
}

function nameSimilarity(detected: string, known: string) {
  const left = normalizeName(detected);
  const right = normalizeName(known);
  if (!left || !right) return 0;
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }
  const distance = editDistance(left, right);
  return 1 - distance / Math.max(left.length, right.length, 1);
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:srg|orc)\b/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function hasFullStats(row: ReviewRow) {
  return [
    row.kills,
    row.deaths,
    row.assists,
    row.gold,
    row.damageDealt,
    row.damageTaken,
    row.turretDamage,
  ].every((value) => value !== null);
}

function progressLabelFor(status: string) {
  if (status === 'loading tesseract core') return 'Loading OCR core…';
  if (status === 'loading language traineddata') return 'Loading English OCR model…';
  if (status === 'initializing api') return 'Initializing screenshot reader…';
  if (status === 'recognizing text') return 'Scanning scoreboard rows…';
  return '';
}

function imageDimensions(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('The first screenshot is not a readable image.'));
    image.src = url;
  });
}
