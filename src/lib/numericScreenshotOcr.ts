import type Tesseract from 'tesseract.js';
import type {
  ScreenshotParseResult,
  ScreenshotStatRow,
  ScreenshotTeamSide,
} from '@/lib/screenshotScoreParser';

interface NumericScreenshotOcrOptions {
  worker: Tesseract.Worker;
  dataFile: File;
  overviewFile: File;
  onProgress?: (completed: number, total: number, label: string) => void;
}

interface TemplateRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasOptions {
  scale?: number;
  paddingX?: number;
  paddingY?: number;
  threshold?: number;
}

interface DataNumbers {
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  gold: number | null;
}

interface OverviewNumbers {
  damageDealt: number | null;
  turretDamage: number | null;
  damageTaken: number | null;
}

const TEMPLATE_WIDTH = 1196;
const TEMPLATE_HEIGHT = 540;
const ROW_TOP = 115;
const OVERVIEW_ROW_TOP = 141;
const DATA_ROW_STEP = 69.5;
const OVERVIEW_ROW_STEP = 69;
const PLANNED_READS = 40;

const DATA_ROW_RECTS: Record<ScreenshotTeamSide, Omit<TemplateRect, 'y'>> = {
  left: { x: 364, width: 136, height: 33 },
  right: { x: 702.5, width: 149.5, height: 33 },
};

const DATA_CELL_RECTS: Record<
  ScreenshotTeamSide,
  Array<Omit<TemplateRect, 'y'>>
> = {
  left: [
    { x: 373, width: 22, height: 21 },
    { x: 401, width: 22, height: 21 },
    { x: 428, width: 26, height: 21 },
    { x: 451, width: 62, height: 21 },
  ],
  right: [
    { x: 704, width: 62, height: 21 },
    { x: 761, width: 22, height: 21 },
    { x: 789, width: 22, height: 21 },
    { x: 817, width: 27, height: 21 },
  ],
};

const OVERVIEW_RECTS: Record<
  ScreenshotTeamSide,
  Record<keyof OverviewNumbers, Omit<TemplateRect, 'y'>>
> = {
  left: {
    damageDealt: { x: 219.5, width: 84, height: 18 },
    turretDamage: { x: 314, width: 54, height: 16.5 },
    damageTaken: { x: 404, width: 73, height: 16.5 },
  },
  right: {
    damageDealt: { x: 617, width: 92, height: 18 },
    turretDamage: { x: 716, width: 61, height: 16.5 },
    damageTaken: { x: 804, width: 81, height: 16.5 },
  },
};

export async function readMlbbNumericScreenshots({
  worker,
  dataFile,
  overviewFile,
  onProgress,
}: NumericScreenshotOcrOptions): Promise<ScreenshotParseResult> {
  const [dataImage, overviewImage] = await Promise.all([
    loadImage(dataFile),
    loadImage(overviewFile),
  ]);
  const dataBounds = findScoreboardBounds(dataImage);
  const overviewBounds = findScoreboardBounds(overviewImage);
  let completed = 0;

  await setNumericParameters(worker, '7');

  const dataRows: Record<ScreenshotTeamSide, DataNumbers[]> = {
    left: [],
    right: [],
  };
  for (const side of ['left', 'right'] as const) {
    for (let row = 0; row < 5; row += 1) {
      const numbers = await readDataRow(worker, dataImage, dataBounds, side, row);
      dataRows[side].push(numbers);
      completed += 1;
      onProgress?.(
        completed,
        PLANNED_READS,
        `Reading ${side} K/D/A + gold · row ${row + 1}/5`,
      );
    }
  }

  const overviewRows: Record<ScreenshotTeamSide, OverviewNumbers[]> = {
    left: [],
    right: [],
  };
  for (const side of ['left', 'right'] as const) {
    for (let row = 0; row < 5; row += 1) {
      const values: OverviewNumbers = {
        damageDealt: null,
        turretDamage: null,
        damageTaken: null,
      };
      for (const field of [
        'damageDealt',
        'turretDamage',
        'damageTaken',
      ] as const) {
        const base = OVERVIEW_RECTS[side][field];
        const canvas = makeNumericCanvas(overviewImage, overviewBounds, {
          ...base,
          y:
            OVERVIEW_ROW_TOP +
            (field === 'damageDealt' ? 0 : 1) +
            row * OVERVIEW_ROW_STEP,
        }, field === 'damageDealt'
          ? { scale: 6, paddingX: 90, paddingY: 40, threshold: 0.55 }
          : { scale: 6, paddingX: 80, paddingY: 35, threshold: 0.55 });
        values[field] = await recognizeCell(worker, canvas);
        completed += 1;
        onProgress?.(
          completed,
          PLANNED_READS,
          `Reading ${side} ${fieldLabel(field)} · row ${row + 1}/5`,
        );
      }
      overviewRows[side].push(values);
    }
  }

  const left = combineRows(dataRows.left, overviewRows.left);
  const right = combineRows(dataRows.right, overviewRows.right);
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
    result: null,
    durationMinutes: null,
    leftKills: null,
    rightKills: null,
    battleId: '',
    left,
    right,
    detectedCells,
    totalCells: 70,
    rawDataText: numericDataSummary(dataRows),
    rawOverviewText: numericOverviewSummary(overviewRows),
  };
}

async function readDataRow(
  worker: Tesseract.Worker,
  image: HTMLImageElement,
  bounds: ImageBounds,
  side: ScreenshotTeamSide,
  row: number,
) {
  const base = DATA_ROW_RECTS[side];
  const rowCanvas = makeNumericCanvas(image, bounds, {
    ...base,
    y: ROW_TOP + row * DATA_ROW_STEP,
  }, { scale: 4, paddingX: 0, paddingY: 0, threshold: 0.58 });
  const primaryText = await recognizeText(worker, rowCanvas);
  const primary = parseDataRow(primaryText, side);
  if (primary) return primary;

  const values: Array<number | null> = [];
  for (const cell of DATA_CELL_RECTS[side]) {
    values.push(
      await recognizeCell(
        worker,
        makeNumericCanvas(image, bounds, {
          ...cell,
          y: ROW_TOP + 6 + row * DATA_ROW_STEP,
        }, { scale: 6, paddingX: 80, paddingY: 35, threshold: 0.55 }),
      ),
    );
  }
  return dataValues(values, side);
}

async function recognizeCell(worker: Tesseract.Worker, canvas: HTMLCanvasElement) {
  const primary = numericValue(await recognizeText(worker, canvas));
  if (primary !== null) return primary;

  await setNumericParameters(worker, '8');
  const fallback = numericValue(await recognizeText(worker, canvas));
  await setNumericParameters(worker, '7');
  return fallback;
}

async function recognizeText(worker: Tesseract.Worker, canvas: HTMLCanvasElement) {
  const result = await worker.recognize(canvas, {}, { text: true });
  return result.data.text.trim();
}

async function setNumericParameters(worker: Tesseract.Worker, pageMode: '7' | '8') {
  await worker.setParameters({
    tessedit_pageseg_mode: pageMode as Tesseract.PSM,
    tessedit_char_whitelist: '0123456789 ',
    classify_bln_numeric_mode: '1',
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
  });
}

function parseDataRow(text: string, side: ScreenshotTeamSide) {
  const values = text.match(/\d+/g)?.map(Number) ?? [];
  if (values.length !== 4) return null;
  const parsed = dataValues(values, side);
  if (
    parsed.kills === null ||
    parsed.deaths === null ||
    parsed.assists === null ||
    parsed.gold === null
  ) {
    return null;
  }
  return parsed;
}

function dataValues(values: Array<number | null>, side: ScreenshotTeamSide) {
  const ordered =
    side === 'left'
      ? values
      : [values[1] ?? null, values[2] ?? null, values[3] ?? null, values[0] ?? null];
  return {
    kills: boundedKda(ordered[0]),
    deaths: boundedKda(ordered[1]),
    assists: boundedKda(ordered[2]),
    gold: boundedGold(ordered[3]),
  } satisfies DataNumbers;
}

function combineRows(data: DataNumbers[], overview: OverviewNumbers[]) {
  const teamKills = data.reduce((total, row) => total + (row.kills ?? 0), 0);
  return data.map<ScreenshotStatRow>((row, index) => ({
    row: index,
    detectedName: '',
    ...row,
    damageDealt: overview[index]?.damageDealt ?? null,
    damageTaken: overview[index]?.damageTaken ?? null,
    turretDamage: overview[index]?.turretDamage ?? null,
    teamfightParticipation:
      teamKills > 0 && row.kills !== null && row.assists !== null
        ? Math.round(((row.kills + row.assists) / teamKills) * 100)
        : null,
  }));
}

function makeNumericCanvas(
  image: HTMLImageElement,
  bounds: ImageBounds,
  template: TemplateRect,
  options: CanvasOptions = {},
) {
  const xScale = bounds.width / TEMPLATE_WIDTH;
  const yScale = bounds.height / TEMPLATE_HEIGHT;
  const sourceX = Math.round(bounds.x + template.x * xScale);
  const sourceY = Math.round(bounds.y + template.y * yScale);
  const sourceWidth = Math.max(1, Math.round(template.width * xScale));
  const sourceHeight = Math.max(1, Math.round(template.height * yScale));
  const source = document.createElement('canvas');
  source.width = sourceWidth;
  source.height = sourceHeight;
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) throw new Error('Browser canvas is unavailable.');
  sourceContext.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  );
  thresholdCanvas(
    sourceContext,
    sourceWidth,
    sourceHeight,
    options.threshold ?? 0.55,
  );

  const scale = options.scale ?? 6;
  const paddingX = options.paddingX ?? 90;
  const paddingY = options.paddingY ?? 40;
  const output = document.createElement('canvas');
  output.width = sourceWidth * scale + paddingX * 2;
  output.height = sourceHeight * scale + paddingY * 2;
  const outputContext = output.getContext('2d');
  if (!outputContext) throw new Error('Browser canvas is unavailable.');
  outputContext.fillStyle = '#000';
  outputContext.fillRect(0, 0, output.width, output.height);
  outputContext.imageSmoothingEnabled = false;
  outputContext.drawImage(
    source,
    paddingX,
    paddingY,
    sourceWidth * scale,
    sourceHeight * scale,
  );
  return output;
}

function thresholdCanvas(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  thresholdRatio: number,
) {
  const imageData = context.getImageData(0, 0, width, height);
  const histogram = Array.from({ length: 256 }, () => 0);
  const grey = new Uint8Array(width * height);
  for (let pixel = 0; pixel < grey.length; pixel += 1) {
    const offset = pixel * 4;
    const value = Math.round(
      imageData.data[offset] * 0.299 +
        imageData.data[offset + 1] * 0.587 +
        imageData.data[offset + 2] * 0.114,
    );
    grey[pixel] = value;
    histogram[value] += 1;
  }
  const low = percentile(histogram, grey.length, 0.02);
  const high = percentile(histogram, grey.length, 0.98);
  const threshold = low + Math.max(1, high - low) * thresholdRatio;
  for (let pixel = 0; pixel < grey.length; pixel += 1) {
    const value = grey[pixel] >= threshold ? 255 : 0;
    const offset = pixel * 4;
    imageData.data[offset] = value;
    imageData.data[offset + 1] = value;
    imageData.data[offset + 2] = value;
    imageData.data[offset + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
}

function percentile(histogram: number[], total: number, ratio: number) {
  const target = total * ratio;
  let count = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    count += histogram[value];
    if (count >= target) return value;
  }
  return histogram.length - 1;
}

function findScoreboardBounds(image: HTMLImageElement): ImageBounds {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Browser canvas is unavailable.');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const requiredActivePixels = Math.max(8, Math.floor(canvas.width * 0.06));
  let top = 0;
  let bottom = canvas.height - 1;

  function rowIsActive(y: number) {
    let active = 0;
    for (let x = 0; x < canvas.width; x += 4) {
      const offset = (y * canvas.width + x) * 4;
      const brightness =
        pixels[offset] * 0.299 +
        pixels[offset + 1] * 0.587 +
        pixels[offset + 2] * 0.114;
      if (brightness > 14) active += 1;
      if (active >= requiredActivePixels) return true;
    }
    return false;
  }

  while (top < canvas.height && !rowIsActive(top)) top += 1;
  while (bottom > top && !rowIsActive(bottom)) bottom -= 1;
  const contentHeight = bottom - top + 1;
  if (contentHeight < canvas.height * 0.35) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }
  return { x: 0, y: top, width: canvas.width, height: contentHeight };
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} is not a readable screenshot.`));
    };
    image.src = url;
  });
}

function numericValue(text: string) {
  const cleaned = text.replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function boundedKda(value: number | null) {
  return value !== null && value >= 0 && value <= 99 ? value : null;
}

function boundedGold(value: number | null) {
  return value !== null && value >= 100 && value <= 999999 ? value : null;
}

function fieldLabel(field: keyof OverviewNumbers) {
  if (field === 'damageDealt') return 'hero damage';
  if (field === 'turretDamage') return 'turret damage';
  return 'damage taken';
}

function numericDataSummary(rows: Record<ScreenshotTeamSide, DataNumbers[]>) {
  return (['left', 'right'] as const)
    .flatMap((side) =>
      rows[side].map(
        (row, index) =>
          `${side.toUpperCase()} R${index + 1}: ${show(row.kills)} ${show(row.deaths)} ${show(row.assists)} ${show(row.gold)}`,
      ),
    )
    .join('\n');
}

function numericOverviewSummary(
  rows: Record<ScreenshotTeamSide, OverviewNumbers[]>,
) {
  return (['left', 'right'] as const)
    .flatMap((side) =>
      rows[side].map(
        (row, index) =>
          `${side.toUpperCase()} R${index + 1}: ${show(row.damageDealt)} ${show(row.turretDamage)} ${show(row.damageTaken)}`,
      ),
    )
    .join('\n');
}

function show(value: number | null) {
  return value === null ? '—' : String(value);
}
