// One period above 5°C (docs/design/ui.md, "Excursion card"): pill, then Started · Ended ·
// Duration · Peak, and a note when it was still going or the data stopped during it.

import { formatDateTime, formatDurationShort, formatTemp } from '../../shared/format/format.js';
import { StatusPill } from '../../shared/status/StatusPill.jsx';
import { excursionNote } from './fridgeText.js';
import styles from './ExcursionCard.module.css';

/**
 * @param {{ excursion: { startUtc: string, endUtc: string, durationMinutes: number,
 *   peakC: number, endReason: string }, title?: string }} props
 *   title names the fridge where several fridges are listed together (the inspector report)
 */
export function ExcursionCard({ excursion, title }) {
  const duration = formatDurationShort(excursion.durationMinutes);
  const note = excursionNote(excursion);
  return (
    <article className={styles.card}>
      <div className={styles.title}>
        {title && <span className={styles.name}>{title}</span>}
        <StatusPill status="alert" text={`Above 5°C · ${duration}`} />
      </div>
      <dl className={styles.values}>
        <div>
          <dt>Started</dt>
          <dd>{formatDateTime(excursion.startUtc)}</dd>
        </div>
        <div>
          <dt>Ended</dt>
          <dd>{formatDateTime(excursion.endUtc)}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{duration}</dd>
        </div>
        <div>
          <dt>Peak</dt>
          <dd>{formatTemp(excursion.peakC)}</dd>
        </div>
      </dl>
      {note && <p className={styles.note}>{note}</p>}
    </article>
  );
}
