// Wording shared by the server (CSV export) and the client (inspector answer), so both say a
// duration the same way. Copy rules: docs/design/ui.md, "Copy and formats".

/**
 * The long form of a duration, for the inspector: "2 days 9 h 15 min", "1 day", "45 min".
 * @param {number} minutes
 */
export function formatDurationLong(minutes) {
  const total = Math.round(minutes);
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  const parts = [];
  if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (hours) parts.push(`${hours} h`);
  if (mins || parts.length === 0) parts.push(`${mins} min`);
  return parts.join(' ');
}
