// Test helper: a logger file in the default format (DD/MM, °C, comma-separated) with a steady
// reading every 15 minutes, for tests about where a week's data ends.

/**
 * Readings (Israel time) from Mon 14 Sep 2026, 00:00 up to and including `lastHour`:45 on
 * `lastDay` September.
 * @param {number} lastDay day of September, 14–20
 * @param {number} lastHour 0–23
 */
export function weekFile(lastDay, lastHour) {
  const rows = [];
  for (let day = 14; day <= lastDay; day++) {
    for (let hour = 0; hour <= (day === lastDay ? lastHour : 23); hour++) {
      for (const minute of ['00', '15', '30', '45']) {
        rows.push(`${day}/09/2026 ${String(hour).padStart(2, '0')}:${minute},3.5`);
      }
    }
  }
  return Buffer.from(`${rows.join('\n')}\n`);
}
