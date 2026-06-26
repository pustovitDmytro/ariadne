import { open } from 'node:fs/promises';

const EXIF_HEADER = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
const DATE_TAGS = [0x9003, 0x9004, 0x0132];
const EXIF_IFD_POINTER = 0x8769;
const GPS_IFD_POINTER = 0x8825;
const GPS_LATITUDE = 0x0002;
const GPS_LATITUDE_REF = 0x0001;
const GPS_LONGITUDE = 0x0004;
const GPS_LONGITUDE_REF = 0x0003;
const READ_SIZE = 256 * 1024;

function parseExifDateString(str) {
  const match = str.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, y, mo, d, h, mi, s] = match.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, s);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function createTiffReaders(tiff) {
  const le = tiff[0] === 0x49 && tiff[1] === 0x49;
  const be = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!le && !be) return null;

  return {
    read16: le ? (o) => tiff.readUInt16LE(o) : (o) => tiff.readUInt16BE(o),
    read32: le ? (o) => tiff.readUInt32LE(o) : (o) => tiff.readUInt32BE(o),
  };
}

function readTagValue(tiff, entry, read16, read32) {
  const type = read16(entry + 2);
  const len = read32(entry + 4);
  const valueOffset = len > 4 ? read32(entry + 8) : entry + 8;

  if (valueOffset + (type === 5 ? len * 8 : len) > tiff.length) return null;

  switch (type) {
    case 2:
      return tiff.subarray(valueOffset, valueOffset + Math.max(0, len - 1)).toString('ascii');
    case 4:
      return len === 1 ? read32(entry + 8) : read32(valueOffset);
    case 5: {
      const values = [];
      for (let i = 0; i < len; i++) {
        const o = valueOffset + i * 8;
        const num = read32(o);
        const den = read32(o + 4);
        values.push(den ? num / den : 0);
      }
      return values;
    }
    default:
      return null;
  }
}

function readIfdTag(tiff, ifdOffset, targetTag, read16, read32) {
  if (ifdOffset + 2 > tiff.length) return null;

  const count = read16(ifdOffset);
  for (let i = 0; i < count; i++) {
    const entry = ifdOffset + 2 + i * 12;
    if (entry + 12 > tiff.length) break;
    if (read16(entry) !== targetTag) continue;
    return readTagValue(tiff, entry, read16, read32);
  }

  return null;
}

function findTagValueOffset(tiff, ifdOffset, targetTag, read16, read32) {
  const value = readIfdTag(tiff, ifdOffset, targetTag, read16, read32);
  return typeof value === 'number' ? value : null;
}

function readIfdDate(tiff, ifdOffset, read16, read32) {
  for (const tag of DATE_TAGS) {
    const str = readIfdTag(tiff, ifdOffset, tag, read16, read32);
    if (typeof str !== 'string') continue;
    const parsed = parseExifDateString(str);
    if (parsed) return parsed;
  }
  return null;
}

function coordinatesToDecimal(values, ref) {
  if (!Array.isArray(values) || !values.length) return null;

  let decimal;
  if (values.length >= 3) {
    decimal = values[0] + values[1] / 60 + values[2] / 3600;
  } else {
    decimal = values[0];
  }

  if (ref === 'S' || ref === 'W') decimal = -decimal;
  if (!Number.isFinite(decimal)) return null;
  return decimal;
}

function readIfdGps(tiff, ifdOffset, read16, read32) {
  const latValues = readIfdTag(tiff, ifdOffset, GPS_LATITUDE, read16, read32);
  const latRef = readIfdTag(tiff, ifdOffset, GPS_LATITUDE_REF, read16, read32);
  const lngValues = readIfdTag(tiff, ifdOffset, GPS_LONGITUDE, read16, read32);
  const lngRef = readIfdTag(tiff, ifdOffset, GPS_LONGITUDE_REF, read16, read32);

  const lat = coordinatesToDecimal(latValues, latRef);
  const lng = coordinatesToDecimal(lngValues, lngRef);
  if (lat == null || lng == null) return null;
  if (lat === 0 && lng === 0) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return { lat, lng };
}

function parseTiffMetadata(tiff) {
  if (tiff.length < 8) return { date: null, location: null };

  const readers = createTiffReaders(tiff);
  if (!readers) return { date: null, location: null };

  const { read16, read32 } = readers;
  const ifd0Offset = read32(4);

  let date = readIfdDate(tiff, ifd0Offset, read16, read32);
  let location = null;

  const exifIfdOffset = findTagValueOffset(tiff, ifd0Offset, EXIF_IFD_POINTER, read16, read32);
  if (exifIfdOffset != null) {
    if (!date) {
      date = readIfdDate(tiff, exifIfdOffset, read16, read32);
    }

    const gpsIfdOffset = findTagValueOffset(tiff, exifIfdOffset, GPS_IFD_POINTER, read16, read32);
    if (gpsIfdOffset != null) {
      location = readIfdGps(tiff, gpsIfdOffset, read16, read32);
    }
  }

  return { date, location };
}

function extractExifTiff(buffer) {
  if (buffer.length < 4) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) break;

      const marker = buffer[offset + 1];
      if (marker === 0xd9) break;

      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > buffer.length) break;

      if (marker === 0xe1 && length >= 8) {
        const segment = buffer.subarray(offset + 4, offset + 2 + length);
        if (segment.subarray(0, 6).equals(EXIF_HEADER)) {
          return segment.subarray(6);
        }
      }

      offset += 2 + length;
    }
    return null;
  }

  const idx = buffer.indexOf(EXIF_HEADER);
  if (idx === -1) return null;
  return buffer.subarray(idx + 6);
}

export function parseExifFromBuffer(buffer) {
  const tiff = extractExifTiff(buffer);
  if (!tiff) return { date: null, location: null };
  return parseTiffMetadata(tiff);
}

async function readExifBuffer(filePath) {
  const fh = await open(filePath, 'r');
  try {
    const buf = Buffer.alloc(READ_SIZE);
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

export async function readPhotoMetadata(filePath) {
  try {
    const buffer = await readExifBuffer(filePath);
    return parseExifFromBuffer(buffer);
  } catch {
    return { date: null, location: null };
  }
}
