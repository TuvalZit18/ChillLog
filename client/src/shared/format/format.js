// Display formats (docs/design/ui.md, "Copy and formats"). The API speaks ISO UTC; everything is
// shown in Israel time with the built-in Intl API, so a viewer abroad sees the files' times.

import { TIME_ZONE } from '@chilllog/shared';

export { formatDurationLong } from '@chilllog/shared';

// Built from parts rather than a locale's pattern: en-GB writes "Sept", and locales differ in
// punctuation. h23 keeps midnight as 00 (some engines write 24 with hour12: false).
const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** @param {string} value ISO UTC timestamp, or a plain Israel date 'YYYY-MM-DD' */
function parts(value) {
  // A plain date parses as UTC midnight, which is 02:00 or 03:00 the same day in Israel.
  return Object.fromEntries(
    partsFormatter.formatToParts(new Date(value)).map((p) => [p.type, p.value]),
  );
}

/** "Mon 14 Sep, 06:45" */
export function formatDateTime(value) {
  const p = parts(value);
  return `${p.weekday} ${p.day} ${p.month}, ${p.hour}:${p.minute}`;
}

/** "Mon 14 Sep" */
export function formatDay(value) {
  const p = parts(value);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "14 Sep" */
export function formatDate(value) {
  const p = parts(value);
  return `${p.day} ${p.month}`;
}

const oneDecimal = (n) => (Math.round(n * 10) / 10).toFixed(1);

/** "7.1°C" */
export function formatTemp(tempC) {
  return `${oneDecimal(tempC)}°C`;
}

/** "+0.8°" */
export function formatTempChange(deltaC) {
  const text = oneDecimal(deltaC);
  return `${deltaC > 0 && text !== '0.0' ? '+' : ''}${text}°`;
}

/** "2d 9h 15m", "2h 15m", "45 min" */
export function formatDurationShort(minutes) {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  return [days && `${days}d`, hours && `${hours}h`, mins && `${mins}m`].filter(Boolean).join(' ');
}
