// 112×36 sparkline for a fridge card: the week's readings, the dashed 5°C line and an end dot in
// the status color. Decorative; the card's text carries the same facts.

import { STATUS_META } from '../../shared/status/status.js';
import { SPARK, sparklineGeometry } from './sparkline.js';
import styles from './Sparkline.module.css';

/** @param {{ points: Array<{ minC: number | null, maxC: number | null }>, latestC: number | null,
 *   status: keyof typeof STATUS_META }} props */
export function Sparkline({ points, latestC, status }) {
  const { paths, limitY, end } = sparklineGeometry(points, { latestC });
  if (paths.length === 0) return null;
  return (
    <svg
      className={styles.spark}
      width={SPARK.width}
      height={SPARK.height}
      viewBox={`0 0 ${SPARK.width} ${SPARK.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <line className={styles.limit} x1="0" x2={SPARK.width} y1={limitY} y2={limitY} />
      {paths.map((d, i) => (
        <path key={i} className={styles.line} d={d} />
      ))}
      <circle cx={end.x} cy={end.y} r="3" fill={STATUS_META[status].color} />
    </svg>
  );
}
