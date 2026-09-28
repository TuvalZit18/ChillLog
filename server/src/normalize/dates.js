import { IANAZone } from 'luxon';

// 14/09/2026 06:30 · 14.09.26 06:30:15 · 09/14/2026 6:30 PM  (day/month order decided per file)
const SLASHED =
  /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?$/i;
// 2026-09-14 06:30 · 2026-09-14T06:30:00Z · 2026-09-14T06:30:00+03:00
const ISO =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @typedef {{ year: number, month: number, day: number, hour: number, minute: number,
 *   second: number, offsetMinutes: number | null }} TimestampParts
 *   offsetMinutes is set only when the file states the offset itself (ISO with Z or ±hh:mm).
 */

export function looksLikeTimestamp(text) {
  return SLASHED.test(text) || ISO.test(text);
}

/**
 * Day/month order for a file: any first number above 12 means DD/MM, any second number above 12
 * means MM/DD. Null when every date could be read either way (or there are no slashed dates).
 * @param {string[]} cells
 * @returns {'DD/MM' | 'MM/DD' | null}
 */
export function detectDateFormat(cells) {
  let mmdd = false;
  for (const cell of cells) {
    const m = SLASHED.exec(cell);
    if (!m) continue;
    if (Number(m[1]) > 12) return 'DD/MM';
    if (Number(m[2]) > 12) mmdd = true;
  }
  return mmdd ? 'MM/DD' : null;
}

/**
 * @param {string} text
 * @param {'DD/MM' | 'MM/DD'} dateFormat
 * @returns {TimestampParts | null} null when it isn't a real date and time
 */
export function parseTimestamp(text, dateFormat) {
  let parts;
  const iso = ISO.exec(text);
  if (iso) {
    parts = {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
      hour: Number(iso[4]),
      minute: Number(iso[5]),
      second: Number(iso[6] ?? 0),
      offsetMinutes: parseOffset(iso[7]),
    };
  } else {
    const m = SLASHED.exec(text);
    if (!m) return null;
    const [a, b] = [Number(m[1]), Number(m[2])];
    let hour = Number(m[4]);
    if (m[7]) {
      if (hour < 1 || hour > 12) return null;
      hour = (hour % 12) + (m[7].toUpperCase() === 'PM' ? 12 : 0);
    }
    parts = {
      year: m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]),
      month: dateFormat === 'DD/MM' ? b : a,
      day: dateFormat === 'DD/MM' ? a : b,
      hour,
      minute: Number(m[5]),
      second: Number(m[6] ?? 0),
      offsetMinutes: null,
    };
  }
  return isRealTime(parts) ? parts : null;
}

function parseOffset(text) {
  if (!text) return null;
  if (text.toUpperCase() === 'Z') return 0;
  const sign = text[0] === '-' ? -1 : 1;
  const digits = text.slice(1).replace(':', '');
  return sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2)));
}

function isRealTime(p) {
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  return (
    d.getUTCFullYear() === p.year &&
    d.getUTCMonth() === p.month - 1 &&
    d.getUTCDate() === p.day &&
    p.hour <= 23 &&
    p.minute <= 59 &&
    p.second <= 59
  );
}

function toIso(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Returns a converter from local wall-clock times in `zone` to UTC ISO strings, for one file.
 *
 * When the clocks go back, one local hour happens twice. The converter keeps both: the first
 * time it sees such a wall-clock time in the file it takes the earlier instant (summer time),
 * the second time the later one. This relies on the logger writing that hour in the order it
 * recorded it. Times skipped when the clocks go forward don't exist and return null.
 *
 * @param {string} zone IANA zone, e.g. 'Asia/Jerusalem'
 * @returns {(parts: TimestampParts) => string | null}
 */
export function createUtcConverter(zone) {
  const tz = IANAZone.create(zone);
  const repeatedSeen = new Map();
  return (p) => {
    const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    if (p.offsetMinutes !== null) return toIso(wall - p.offsetMinutes * 60_000);

    // The instants whose local time in this zone is `wall`: usually one, two in the repeated hour.
    const offsets = new Set([-DAY_MS, 0, DAY_MS].map((d) => tz.offset(wall + d)));
    const candidates = [...offsets]
      .map((offset) => wall - offset * 60_000)
      .filter((ms) => tz.offset(ms) * 60_000 === wall - ms)
      .sort((x, y) => x - y);

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return toIso(candidates[0]);
    const seen = repeatedSeen.get(wall) ?? 0;
    repeatedSeen.set(wall, seen + 1);
    return toIso(candidates[Math.min(seen, 1)]);
  };
}
