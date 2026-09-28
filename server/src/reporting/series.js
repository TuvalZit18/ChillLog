// Chart data. Long ranges are downsampled on the server so a phone gets a few hundred points,
// not thousands. Each bucket keeps its minimum and maximum, never an average: averaging would
// smooth away a short spike, and a hidden peak is a false "all clear".

const MINUTE = 60_000;

/** Bucket sizes to choose from, smallest first. 15 minutes is the loggers' own interval. */
const BUCKET_MINUTES = [15, 30, 60, 120, 180, 360, 720, 1440];
export const MAX_POINTS = 300;

/**
 * The smallest bucket size that keeps the range within MAX_POINTS buckets.
 * @param {string} fromUtc
 * @param {string} toUtc
 */
export function chooseBucketMinutes(fromUtc, toUtc) {
  const rangeMinutes = (Date.parse(toUtc) - Date.parse(fromUtc)) / MINUTE;
  return BUCKET_MINUTES.find((size) => rangeMinutes / size <= MAX_POINTS) ?? BUCKET_MINUTES.at(-1);
}

/**
 * Readings grouped into equal buckets from `fromUtc`. A bucket with no valid reading has
 * null min and max, so the chart breaks its line there instead of drawing across missing data.
 * ERR readings count as missing.
 * @param {import('../normalize/normalize.js').Reading[]} readings sorted by time
 * @param {{ fromUtc: string, toUtc: string, bucketMinutes: number }} options
 * @returns {{ tsUtc: string, minC: number | null, maxC: number | null }[]}
 */
export function bucketize(readings, { fromUtc, toUtc, bucketMinutes }) {
  const from = Date.parse(fromUtc);
  const size = bucketMinutes * MINUTE;
  const count = Math.ceil((Date.parse(toUtc) - from) / size);
  const buckets = Array.from({ length: count }, (_, i) => ({
    tsUtc: new Date(from + i * size).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    minC: null,
    maxC: null,
  }));
  for (const r of readings) {
    if (r.isErr || r.tempC === null) continue;
    const bucket = buckets[Math.floor((Date.parse(r.tsUtc) - from) / size)];
    if (!bucket) continue; // outside the range
    bucket.minC = bucket.minC === null ? r.tempC : Math.min(bucket.minC, r.tempC);
    bucket.maxC = bucket.maxC === null ? r.tempC : Math.max(bucket.maxC, r.tempC);
  }
  return buckets;
}
