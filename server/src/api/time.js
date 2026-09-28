import { DateTime } from 'luxon';
import { TIME_ZONE } from '@chilllog/shared';
import { HttpError } from './errors.js';

/**
 * A date or date-time Summer typed, in Israel time ("2026-09-17", "2026-09-17T10:00"), as a UTC
 * ISO string. A date alone means the start of that day.
 * @param {string} text already shape-checked by the shared localDateTime schema
 * @returns {string}
 */
export function localToUtc(text) {
  const local = DateTime.fromISO(text, { zone: TIME_ZONE });
  if (!local.isValid) throw new HttpError(400, `${text} is not a real date.`);
  return local.toUTC().toISO({ suppressMilliseconds: true });
}
