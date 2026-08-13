export type ScreenshotTeamSide = 'left' | 'right';

export interface ScreenshotStatRow {
  row: number;
  detectedName: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  gold: number | null;
  damageDealt: number | null;
  damageTaken: number | null;
  turretDamage: number | null;
  teamfightParticipation: number | null;
}

export interface ScreenshotParseResult {
  result: 'Win' | 'Loss' | null;
  durationMinutes: number | null;
  leftKills: number | null;
  rightKills: number | null;
  battleId: string;
  left: ScreenshotStatRow[];
  right: ScreenshotStatRow[];
  detectedCells: number;
  totalCells: number;
  rawDataText: string;
  rawOverviewText: string;
}

interface OcrWord {
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
  text: string;
}

interface Scale {
  x: number;
  y: number;
}

const TEMPLATE_WIDTH = 1196;
const TEMPLATE_HEIGHT = 540;
const ROW_Y = [139, 208, 277, 346, 415];

export function parseMlbbScoreScreenshots({
  dataTsv,
  dataText,
  overviewTsv,
  overviewText,
  width,
  height,
}: {
  dataTsv: string;
  dataText: string;
  overviewTsv: string;
  overviewText: string;
  width: number;
  height: number;
}): ScreenshotParseResult {
  const scale = {
    x: width / TEMPLATE_WIDTH,
    y: height / TEMPLATE_HEIGHT,
  };
  const dataWords = parseTsv(dataTsv);
  const overviewWords = parseTsv(overviewTsv);
  const left = buildRows('left', dataWords, overviewWords, scale);
  const right = buildRows('right', dataWords, overviewWords, scale);
  const score = parseScore(dataWords, scale);
  const durationMinutes = parseDuration(`${dataText}\n${overviewText}`);
  const battleId = parseBattleId(`${dataText}\n${overviewText}`);
  const detectedCells = [...left, ...right].reduce(
    (total, row) =>
      total +
      [
        row.kills,
        row.deaths,
        row.assists,
        row.gold,
        row.damageDealt,
        row.damageTaken,
        row.turretDamage,
      ].filter((value) => value !== null).length,
    0,
  );

  return {
    result: /\bvictory\b/i.test(`${dataText}\n${overviewText}`)
      ? 'Win'
      : /\bdefeat\b/i.test(`${dataText}\n${overviewText}`)
        ? 'Loss'
        : null,
    durationMinutes,
    leftKills: score.left,
    rightKills: score.right,
    battleId,
    left,
    right,
    detectedCells,
    totalCells: 70,
    rawDataText: dataText.trim(),
    rawOverviewText: overviewText.trim(),
  };
}

function buildRows(
  side: ScreenshotTeamSide,
  dataWords: OcrWord[],
  overviewWords: OcrWord[],
  scale: Scale,
): ScreenshotStatRow[] {
  return ROW_Y.map((templateY, row) => {
    const y = templateY * scale.y;
    const dataBand = wordsInBand(dataWords, y, 36 * scale.y);
    const overviewBand = wordsInBand(overviewWords, y, 36 * scale.y);
    const kdaRange =
      side === 'left'
        ? [368 * scale.x, 446 * scale.x]
        : [748 * scale.x, 840 * scale.x];
    const kda = parseKda(
      dataBand.filter((word) => centerX(word) >= kdaRange[0] && centerX(word) <= kdaRange[1]),
    );
    const nameRange =
      side === 'left'
        ? [224 * scale.x, 368 * scale.x]
        : [872 * scale.x, 1033 * scale.x];
    const detectedName = parseName(
      dataBand.filter(
        (word) => centerX(word) >= nameRange[0] && centerX(word) <= nameRange[1],
      ),
    );
    const targets =
      side === 'left'
        ? {
            gold: 470,
            damage: 255,
            turret: 344,
            taken: 430,
            participation: 548,
          }
        : {
            gold: 727,
            damage: 645,
            turret: 725,
            taken: 820,
            participation: 930,
          };
    const rawY = (142 + row * 69) * scale.y;
    const percentageY = (158 + row * 69) * scale.y;

    return {
      row,
      detectedName,
      kills: kda[0],
      deaths: kda[1],
      assists: kda[2],
      gold: nearestInteger(dataBand, targets.gold * scale.x, y, 42 * scale.x),
      damageDealt: nearestInteger(
        overviewBand,
        targets.damage * scale.x,
        rawY,
        53 * scale.x,
      ),
      turretDamage: nearestInteger(
        overviewBand,
        targets.turret * scale.x,
        rawY,
        48 * scale.x,
      ),
      damageTaken: nearestInteger(
        overviewBand,
        targets.taken * scale.x,
        rawY,
        52 * scale.x,
      ),
      teamfightParticipation: nearestPercentage(
        overviewBand,
        targets.participation * scale.x,
        percentageY,
        55 * scale.x,
      ),
    };
  });
}

function parseTsv(tsv: string): OcrWord[] {
  return tsv
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split('\t'))
    .filter((columns) => columns.length >= 12 && columns[0] === '5')
    .map((columns) => ({
      left: Number(columns[6]) || 0,
      top: Number(columns[7]) || 0,
      width: Number(columns[8]) || 0,
      height: Number(columns[9]) || 0,
      confidence: Number(columns[10]) || 0,
      text: columns.slice(11).join('\t').trim(),
    }))
    .filter((word) => word.text && word.confidence >= 0);
}

function wordsInBand(words: OcrWord[], y: number, radius: number) {
  return words.filter((word) => Math.abs(centerY(word) - y) <= radius);
}

function nearestInteger(
  words: OcrWord[],
  targetX: number,
  targetY: number,
  maxXDistance: number,
) {
  const candidates = words
    .map((word) => ({ word, value: parseInteger(word.text) }))
    .filter(
      (candidate): candidate is { word: OcrWord; value: number } =>
        candidate.value !== null &&
        !candidate.word.text.includes('%') &&
        Math.abs(centerX(candidate.word) - targetX) <= maxXDistance,
    )
    .sort(
      (a, b) =>
        scorePosition(a.word, targetX, targetY) -
          scorePosition(b.word, targetX, targetY) ||
        b.value - a.value,
    );
  return candidates[0]?.value ?? null;
}

function nearestPercentage(
  words: OcrWord[],
  targetX: number,
  targetY: number,
  maxXDistance: number,
) {
  const candidates = words
    .map((word) => ({ word, value: parsePercentage(word.text) }))
    .filter(
      (candidate): candidate is { word: OcrWord; value: number } =>
        candidate.value !== null &&
        Math.abs(centerX(candidate.word) - targetX) <= maxXDistance,
    )
    .filter(
      (candidate) =>
        candidate.word.text.includes('%') ||
        Math.abs(centerY(candidate.word) - targetY) <= 9,
    )
    .sort(
      (a, b) =>
        scorePosition(a.word, targetX, targetY) -
        scorePosition(b.word, targetX, targetY),
    );
  return candidates[0]?.value ?? null;
}

function parseKda(words: OcrWord[]): [number | null, number | null, number | null] {
  const text = words
    .sort((a, b) => a.left - b.left)
    .map((word) => word.text)
    .join(' ')
    .replace(/[Oo]/g, '0');
  const groups = text.match(/\d+/g) ?? [];

  if (groups.length >= 3) {
    return [bounded(groups[0]), bounded(groups[1]), bounded(groups[2])];
  }
  if (groups.length === 2) {
    if (groups[1].length >= 2) {
      return [bounded(groups[0]), bounded(groups[1][0]), bounded(groups[1].slice(1))];
    }
    if (groups[0].length >= 2) {
      return [bounded(groups[0][0]), bounded(groups[0].slice(1)), bounded(groups[1])];
    }
  }
  if (groups.length === 1) {
    const digits = groups[0];
    if (digits.length === 3) {
      return [bounded(digits[0]), bounded(digits[1]), bounded(digits[2])];
    }
    if (digits.length >= 4) {
      return [bounded(digits[0]), bounded(digits[1]), bounded(digits.slice(2))];
    }
  }

  const positioned = words
    .map((word) => ({ word, value: parseInteger(word.text) }))
    .filter(
      (entry): entry is { word: OcrWord; value: number } => entry.value !== null,
    )
    .sort((a, b) => a.word.left - b.word.left)
    .slice(0, 3)
    .map((entry) => entry.value);
  return [positioned[0] ?? null, positioned[1] ?? null, positioned[2] ?? null];
}

function parseName(words: OcrWord[]) {
  const parts = words
    .sort((a, b) => a.left - b.left)
    .map((word) => word.text.replace(/[^A-Za-z0-9_-]+/g, ''))
    .filter((part) => part && /[A-Za-z]/.test(part))
    .filter((part) => !['SRG', 'orc'].includes(part));
  return parts.join(' ').trim();
}

function parseScore(words: OcrWord[], scale: Scale) {
  const candidates = words
    .filter(
      (word) =>
        centerY(word) < 90 * scale.y &&
        centerX(word) > 330 * scale.x &&
        centerX(word) < 830 * scale.x,
    )
    .map((word) => ({ word, value: parseInteger(word.text) }))
    .filter(
      (entry): entry is { word: OcrWord; value: number } =>
        entry.value !== null && entry.value <= 99,
    )
    .sort((a, b) => a.word.left - b.word.left);
  return {
    left: candidates[0]?.value ?? null,
    right: candidates[candidates.length - 1]?.value ?? null,
  };
}

function parseDuration(text: string) {
  const matches = [...text.matchAll(/(?:duration|masa)?\s*(\d{1,2})\s*:\s*(\d{2})/gi)];
  const candidate = matches.find((match) => Number(match[1]) <= 60) ?? matches[0];
  if (!candidate) return null;
  const minutes = Number(candidate[1]);
  const seconds = Number(candidate[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds > 59) {
    return null;
  }
  return Number((minutes + seconds / 60).toFixed(1));
}

function parseBattleId(text: string) {
  return text.match(/\b8\d{14,19}\b/)?.[0] ?? '';
}

function parseInteger(value: string) {
  const hasRealDigit = /\d/.test(value);
  if (!hasRealDigit && !/^[Oo]$/.test(value.trim())) return null;
  const cleaned = value
    .replace(/[Oo]/g, '0')
    .replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercentage(value: string) {
  const parsed = parseInteger(value);
  if (parsed === null || parsed > 100) return null;
  return parsed;
}

function bounded(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 99 ? parsed : null;
}

function scorePosition(word: OcrWord, x: number, y: number) {
  return Math.abs(centerX(word) - x) * 1.4 + Math.abs(centerY(word) - y);
}

function centerX(word: OcrWord) {
  return word.left + word.width / 2;
}

function centerY(word: OcrWord) {
  return word.top + word.height / 2;
}
