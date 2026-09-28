// Sentences on the fridge page (docs/design/ui.md, "Fridge detail"). Pure functions of the
// GET /api/fridges/:id response, so the wording is tested.

import {
  formatDate,
  formatDateTime,
  formatDay,
  formatTemp,
  formatTime,
} from '../../shared/format/format.js';

/** Door openings: single readings above 5°C, shown but never counted. */
export function doorNote(doorSpikes) {
  if (doorSpikes.length === 0) return null;
  const list = doorSpikes
    .map((s) => `${formatDateTime(s.tsUtc)} · ${formatTemp(s.tempC)}`)
    .join('; ');
  return doorSpikes.length === 1
    ? `One single reading above 5°C ignored as a door opening: ${list}.`
    : `${doorSpikes.length} single readings above 5°C ignored as door openings: ${list}.`;
}

/** "Mon 14 Sep, 02:30 to 04:45", or both dates when the gap crosses midnight. */
export function gapLine(gap) {
  const sameDay = formatDay(gap.fromUtc) === formatDay(gap.toUtc);
  const end = sameDay ? formatTime(gap.toUtc) : formatDateTime(gap.toUtc);
  return `${formatDateTime(gap.fromUtc)} to ${end}`;
}

const END_NOTES = {
  data_ends: 'Still above 5°C at the last reading in the file.',
  gap: 'The readings stop here, so it may have lasted longer.',
};

/** Extra line under a time-above-5°C card, from how it ended (back_in_range needs none). */
export function excursionNote(excursion) {
  return END_NOTES[excursion.endReason] ?? null;
}

/** Which logger was in this fridge when, oldest first. */
export function loggerHistory(placements) {
  if (placements.length === 0) return null;
  return [...placements]
    .sort((a, b) => a.fromUtc.localeCompare(b.fromUtc))
    .map((p) =>
      p.toUtc
        ? `${p.loggerCode} was here from ${formatDate(p.fromUtc)} to ${formatDate(p.toUtc)}.`
        : `${p.loggerCode} has been here since ${formatDate(p.fromUtc)}.`,
    )
    .join(' ');
}
