// Temperature chart (docs/design/ui.md, "Temperature chart"). Lazy-loaded: Recharts is the
// app's biggest dependency and only this screen needs it (architecture §8).
// Each bucket is drawn as a thin band from its minimum to its maximum (never an average, which
// would hide a spike), broken where there are no readings, because a line across missing data
// looks like "the fridge was fine".

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link } from 'react-router';
import { THRESHOLDS } from '@chilllog/shared';
import { formatDurationShort } from '../../shared/format/format.js';
import button from '../../shared/ui/button.module.css';
import { chartSummary, noLoggerUntil, readout, timeTicks, yDomain, yTicks } from './chartModel.js';
import styles from './FridgeChart.module.css';

const DAY_MS = 86_400_000;
const LIMIT = THRESHOLDS.limitC;
const PROMPT = 'Touch or hover the chart to read a value';
const label = (value, position, fill, extra = {}) => ({
  value,
  position,
  fill,
  fontSize: 12,
  fontWeight: 600,
  ...extra,
});

/** Tells the page which point the Tooltip is on (mouse and touch alike); draws nothing. */
function ActivePoint({ active, label: t, onChange }) {
  useEffect(() => {
    onChange(active ? t : null);
  }, [active, t, onChange]);
  return null;
}

/** @param {{ fridge: object }} props the GET /api/fridges/:id response */
export default function FridgeChart({ fridge }) {
  const { range, series, excursions, gaps, doorSpikes, placements } = fridge;
  const [activeT, setActiveT] = useState(null);

  const from = Date.parse(range.fromUtc);
  const to = Date.parse(range.toUtc);
  const share = (a, b) => (Math.min(b, to) - Math.max(a, from)) / (to - from);
  const clampX = (iso) => Math.min(to, Math.max(from, Date.parse(iso)));

  const data = useMemo(
    () =>
      series.points.map((p) => ({
        t: Date.parse(p.tsUtc),
        band: p.minC === null ? null : [p.minC, p.maxC],
        point: p,
      })),
    [series.points],
  );
  const byT = useMemo(() => new Map(data.map((d) => [d.t, d.point])), [data]);
  const ticks = timeTicks(range.fromUtc, range.toUtc);
  const tickLabel = new Map(ticks.map((t) => [t.ms, t.label]));
  const domain = yDomain(series.points, doorSpikes);
  const [yLo, yHi] = domain;
  const noLogger = noLoggerUntil(placements, range);
  const hasReadings = series.points.some((p) => p.minC !== null);
  const summary = chartSummary(fridge);
  const activePoint = activeT === null ? null : byT.get(activeT);

  if (!hasReadings) {
    return (
      <div className={styles.card}>
        <div className={styles.empty} role="img" aria-label={summary}>
          <p>No readings for this fridge in this range.</p>
          {fridge.weekStatus?.status === 'no_file' && (
            <>
              <p>Last week's file hasn't been uploaded yet.</p>
              <Link to="/upload" className={button.button}>
                Go to Upload
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  // A thin bar near the bottom of the plot marks each gap.
  const gapY1 = yLo + (yHi - yLo) * 0.04;
  const gapY2 = gapY1 + (yHi - yLo) * 0.025;
  const labelDoors = doorSpikes.length <= 3 && to - from <= 8 * DAY_MS;

  return (
    <div className={styles.card}>
      <p className={styles.readout}>{activePoint ? readout(activePoint) : PROMPT}</p>
      <div className={styles.chart} role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" />
            <XAxis
              type="number"
              dataKey="t"
              domain={[from, to]}
              ticks={ticks.map((t) => t.ms)}
              tickFormatter={(v) => tickLabel.get(v) ?? ''}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--line)' }}
              allowDataOverflow
            />
            <YAxis
              domain={domain}
              ticks={yTicks(domain)}
              tickFormatter={(v) => (v === LIMIT ? '' : `${v}°`)}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={38}
              allowDataOverflow
            />

            {noLogger && (
              <ReferenceArea
                x1={from}
                x2={Date.parse(noLogger)}
                fill="var(--sunken)"
                fillOpacity={1}
                label={
                  share(from, Date.parse(noLogger)) > 0.3
                    ? label('No logger in this fridge yet', 'center', 'var(--muted)', {
                        fontWeight: 400,
                      })
                    : undefined
                }
              />
            )}

            {excursions.map((e) => (
              <ReferenceArea
                key={e.startUtc}
                x1={clampX(e.startUtc)}
                x2={clampX(e.endUtc)}
                fill="var(--band)"
                fillOpacity={1}
                label={
                  share(Date.parse(e.startUtc), Date.parse(e.endUtc)) > 0.2
                    ? label(
                        `Above ${LIMIT}°C · ${formatDurationShort(e.durationMinutes)}`,
                        'insideTopLeft',
                        'var(--alert)',
                      )
                    : undefined
                }
              />
            ))}

            <ReferenceLine
              y={LIMIT}
              stroke="var(--alert)"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={label(`${LIMIT}°C`, 'left', 'var(--alert)', { fontWeight: 700 })}
            />

            <Area
              dataKey="band"
              type="linear"
              stroke="var(--accent)"
              strokeWidth={1.7}
              fill="var(--accent)"
              fillOpacity={0.3}
              connectNulls={false}
              dot={false}
              activeDot={{
                r: 4.5,
                fill: 'var(--accent)',
                stroke: 'var(--surface)',
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />

            {gaps.map((g) => (
              <ReferenceArea
                key={g.fromUtc}
                x1={clampX(g.fromUtc)}
                x2={clampX(g.toUtc)}
                y1={gapY1}
                y2={gapY2}
                fill="var(--gap)"
                fillOpacity={1}
                label={
                  share(Date.parse(g.fromUtc), Date.parse(g.toUtc)) > 0.08
                    ? label(`Gap ${formatDurationShort(g.minutes)}`, 'top', 'var(--gap)')
                    : undefined
                }
              />
            ))}

            {doorSpikes.map((d) => {
              const x = Date.parse(d.tsUtc);
              return (
                <ReferenceDot
                  key={d.tsUtc}
                  x={x}
                  y={d.tempC}
                  r={5}
                  fill="var(--surface)"
                  stroke="var(--warm)"
                  strokeWidth={2}
                  label={
                    labelDoors
                      ? label(
                          'Door opening, ignored',
                          share(from, x) > 0.6 ? 'left' : 'right',
                          'var(--warm)',
                        )
                      : undefined
                  }
                />
              );
            })}

            <Tooltip
              content={<ActivePoint onChange={setActiveT} />}
              cursor={{ stroke: 'var(--ink)', strokeOpacity: 0.35 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <ul className={styles.legend} aria-label="Chart key">
        <li>
          <i className={`${styles.key} ${styles.keyLine}`} />
          Temperature
        </li>
        <li>
          <i className={`${styles.key} ${styles.keyLimit}`} />
          {LIMIT}°C limit
        </li>
        {excursions.length > 0 && (
          <li>
            <i className={`${styles.key} ${styles.keyBand}`} />
            Above {LIMIT}°C
          </li>
        )}
        {gaps.length > 0 && (
          <li>
            <i className={`${styles.key} ${styles.keyGap}`} />
            Gap
          </li>
        )}
        {doorSpikes.length > 0 && (
          <li>
            <i className={`${styles.key} ${styles.keyDoor}`} />
            Door opening
          </li>
        )}
        {noLogger && (
          <li>
            <i className={`${styles.key} ${styles.keyNoLogger}`} />
            No logger yet
          </li>
        )}
      </ul>
    </div>
  );
}
