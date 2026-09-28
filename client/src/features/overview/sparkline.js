// Geometry for the fridge card's 7-day sparkline (docs/design/ui.md, "Sparkline").
// Each 3-hour bucket is drawn as a thin band from its minimum to its maximum, so a single high
// reading still shows; a bucket with no reading breaks the line, because a line drawn across
// missing data looks like "the fridge was fine".

import { THRESHOLDS } from '@chilllog/shared';

/** Size in px and the fixed temperature scale, shared by every card so they compare. */
export const SPARK = Object.freeze({ width: 112, height: 36, pad: 3, minC: 1, maxC: 8 });

const round = (n) => Math.round(n * 10) / 10;

/**
 * @param {Array<{ minC: number | null, maxC: number | null }>} points
 * @param {{ latestC?: number | null }} [options] the latest reading, for the end dot's height
 * @returns {{ paths: string[], limitY: number, end: { x: number, y: number } | null }}
 */
export function sparklineGeometry(points, { latestC = null } = {}) {
  const { width, height, pad, minC, maxC } = SPARK;
  const x = (i) =>
    points.length < 2 ? width / 2 : pad + (i * (width - 2 * pad)) / (points.length - 1);
  const y = (c) => {
    const clamped = Math.min(maxC, Math.max(minC, c));
    return height - pad - ((clamped - minC) / (maxC - minC)) * (height - 2 * pad);
  };

  // Runs of buckets that have readings; a bucket without any ends the run.
  const runs = [];
  let run = [];
  points.forEach((p, i) => {
    if (p.minC === null || p.maxC === null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push({ x: round(x(i)), top: round(y(p.maxC)), bottom: round(y(p.minC)) });
    }
  });
  if (run.length) runs.push(run);

  // Out along the maximums, back along the minimums.
  const paths = runs.map((r) => {
    const out = r.map((p, k) => `${k ? 'L' : 'M'}${p.x} ${p.top}`).join('');
    const back = [...r]
      .reverse()
      .map((p) => `L${p.x} ${p.bottom}`)
      .join('');
    return `${out}${back}Z`;
  });

  const last = runs.at(-1)?.at(-1);
  const end = last ? { x: last.x, y: latestC === null ? last.top : round(y(latestC)) } : null;
  return { paths, limitY: round(y(THRESHOLDS.limitC)), end };
}
