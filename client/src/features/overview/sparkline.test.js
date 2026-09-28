// The fridge card's 7-day sparkline. Points are the API's 3-hour buckets with min and max.

import { describe, expect, it } from 'vitest';
import { SPARK, sparklineGeometry } from './sparkline.js';

const bucket = (minC, maxC = minC) => ({ tsUtc: '2026-09-21T00:00:00Z', minC, maxC });
const empty = { tsUtc: '2026-09-21T00:00:00Z', minC: null, maxC: null };

describe('sparklineGeometry', () => {
  it('breaks the line at "a gap of a couple of hours" instead of drawing across it', () => {
    const { paths } = sparklineGeometry([bucket(3), bucket(3.2), empty, bucket(3.1)]);
    expect(paths).toHaveLength(2);
  });

  it('draws nothing for a week with no readings', () => {
    const { paths, end } = sparklineGeometry([empty, empty]);
    expect(paths).toEqual([]);
    expect(end).toBeNull();
  });

  it('keeps a single high reading visible: the band reaches up to the bucket maximum', () => {
    const flat = sparklineGeometry([bucket(3), bucket(3), bucket(3)]);
    const spike = sparklineGeometry([bucket(3), bucket(3, 7.5), bucket(3)]);
    const topOf = (path) =>
      Math.min(...[...path.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map((m) => +m[1]));
    expect(topOf(spike.paths[0])).toBeLessThan(topOf(flat.paths[0]));
  });

  it('uses one fixed 1–8°C scale so cards compare, clamping anything outside it', () => {
    const { paths } = sparklineGeometry([bucket(20), bucket(-3)]);
    const [left, right] = [SPARK.pad, SPARK.width - SPARK.pad];
    const [top, bottom] = [SPARK.pad, SPARK.height - SPARK.pad];
    // 20°C pinned to the top edge, -3°C to the bottom; band out along max, back along min.
    expect(paths[0]).toBe(`M${left} ${top}L${right} ${bottom}L${right} ${bottom}L${left} ${top}Z`);
  });

  it('puts the 5°C line and the end dot at the right height', () => {
    const { limitY, end } = sparklineGeometry([bucket(3), bucket(4)], { latestC: 8 });
    const plotHeight = SPARK.height - 2 * SPARK.pad;
    expect(limitY).toBeCloseTo(SPARK.height - SPARK.pad - (4 / 7) * plotHeight, 1);
    expect(end).toEqual({ x: SPARK.width - SPARK.pad, y: SPARK.pad });
  });
});
