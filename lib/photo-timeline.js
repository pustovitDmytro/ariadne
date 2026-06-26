import path from 'node:path';
import { stat } from 'node:fs/promises';
import { readPhotoMetadata } from './exif.js';
import { walkImages } from './walk-images.js';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

const UK_MONTHS = [
  'січ', 'лют', 'бер', 'кві', 'тра', 'чер',
  'лип', 'сер', 'вер', 'жов', 'лис', 'гру',
];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfYear(date) {
  const d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function chooseBucketUnit(spanMs) {
  if (spanMs <= 14 * DAY_MS) return 'day';
  if (spanMs <= 6 * MONTH_MS) return 'week';
  if (spanMs <= 3 * YEAR_MS) return 'month';
  return 'year';
}

function bucketKey(date, unit) {
  switch (unit) {
    case 'day':
      return startOfDay(date).toISOString().slice(0, 10);
    case 'week':
      return startOfWeek(date).toISOString().slice(0, 10);
    case 'month':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    case 'year':
      return String(date.getFullYear());
    default:
      return startOfMonth(date).toISOString().slice(0, 7);
  }
}

function bucketStart(key, unit) {
  switch (unit) {
    case 'day':
    case 'week':
      return new Date(`${key}T00:00:00`);
    case 'month':
      return new Date(`${key}-01T00:00:00`);
    case 'year':
      return new Date(`${key}-01-01T00:00:00`);
    default:
      return new Date(key);
  }
}

function formatBucketLabel(key, unit) {
  const date = bucketStart(key, unit);

  switch (unit) {
    case 'day':
      return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
    case 'week': {
      const end = new Date(date);
      end.setDate(end.getDate() + 6);
      const sameYear = date.getFullYear() === end.getFullYear();
      const startFmt = date.toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'short',
        ...(sameYear ? {} : { year: 'numeric' }),
      });
      const endFmt = end.toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return `${startFmt} – ${endFmt}`;
    }
    case 'month':
      return `${UK_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    case 'year':
      return key;
    default:
      return key;
  }
}

function unitLabel(unit) {
  switch (unit) {
    case 'day':
      return 'день';
    case 'week':
      return 'тиждень';
    case 'month':
      return 'місяць';
    case 'year':
      return 'рік';
    default:
      return unit;
  }
}

function buildBuckets(datedFiles, unit) {
  const bucketFiles = new Map();

  for (const { filePath, date } of datedFiles) {
    const key = bucketKey(date, unit);
    if (!bucketFiles.has(key)) bucketFiles.set(key, []);
    bucketFiles.get(key).push({ filePath, date: date.toISOString() });
  }

  const keys = [...bucketFiles.keys()].sort();
  return keys.map((key) => {
    const files = bucketFiles
      .get(key)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((f) => f.filePath);
    return {
      key,
      label: formatBucketLabel(key, unit),
      count: files.length,
      start: bucketStart(key, unit).toISOString(),
      files,
    };
  });
}

export async function buildPhotoTimeline(rootDir, { onProgress } = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const rootStat = await stat(absoluteRoot).catch(() => null);
  if (!rootStat?.isDirectory()) {
    throw new Error(`Not a directory: ${absoluteRoot}`);
  }

  const imageFiles = await walkImages(absoluteRoot);
  const datedFiles = [];
  const locations = [];
  let exifCount = 0;
  let mtimeCount = 0;
  let geoCount = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const filePath = imageFiles[i];
    try {
      const { date: exifDate, location } = await readPhotoMetadata(filePath);
      let date = exifDate;
      let source = 'exif';

      if (!date) {
        const fileStat = await stat(filePath);
        date = fileStat.mtime;
        source = 'mtime';
        mtimeCount += 1;
      } else {
        exifCount += 1;
      }

      datedFiles.push({ filePath, date, source });

      if (location) {
        geoCount += 1;
        locations.push({
          lat: location.lat,
          lng: location.lng,
          filePath,
        });
      }
    } catch {
      // skip unreadable files
    }
    onProgress?.({ phase: 'dates', current: i + 1, total: imageFiles.length });
  }

  if (!datedFiles.length) {
    return {
      scanPath: absoluteRoot,
      total: 0,
      exifCount: 0,
      mtimeCount: 0,
      geoCount: 0,
      minDate: null,
      maxDate: null,
      spanDays: 0,
      bucketUnit: 'month',
      bucketUnitLabel: unitLabel('month'),
      buckets: [],
      locations: [],
    };
  }

  const timestamps = datedFiles.map((f) => f.date.getTime());
  const minDate = new Date(Math.min(...timestamps));
  const maxDate = new Date(Math.max(...timestamps));
  const spanMs = maxDate - minDate;
  const bucketUnit = chooseBucketUnit(spanMs);
  const buckets = buildBuckets(datedFiles, bucketUnit);

  return {
    scanPath: absoluteRoot,
    total: datedFiles.length,
    exifCount,
    mtimeCount,
    geoCount,
    minDate: minDate.toISOString(),
    maxDate: maxDate.toISOString(),
    spanDays: Math.max(1, Math.round(spanMs / DAY_MS)),
    bucketUnit,
    bucketUnitLabel: unitLabel(bucketUnit),
    buckets,
    locations,
  };
}
