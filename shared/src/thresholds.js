// Every detection rule reads its numbers from here, so the server's answers and the UI's
// wording ("above 5°C", "gap of more than 1 hour") can't drift apart. Why each value was
// chosen: NOTES.md, "Detection parameters".

export const THRESHOLDS = Object.freeze({
  /** A reading strictly above this is "above five degrees". */
  limitC: 5,
  /** Readings in a row above the limit that make an excursion. One alone is a door opening. */
  minExcursionReadings: 2,
  /** More than this many minutes between valid readings is a gap. ERR counts as missing. */
  gapMinutes: 60,
  warming: Object.freeze({
    /** Compare the median of the last window with the median of the window before it. */
    windowHours: 24,
    /** A rise of at least this much between the two medians is "slowly warming up". */
    minRiseC: 0.5,
    /** Each window needs readings spanning at least this long, or there's no verdict. */
    minCoverageHours: 12,
  }),
});
