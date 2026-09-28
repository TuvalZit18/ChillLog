// Fridge card (docs/design/ui.md, "Fridge card"): branch eyebrow, fridge name, status pill, the
// latest reading and the week's sparkline. The whole card links to the fridge page.

import { Link } from 'react-router';
import { formatDateTime, formatTemp } from '../../shared/format/format.js';
import { StatusPill } from '../../shared/status/StatusPill.jsx';
import { describeStatus } from '../../shared/status/status.js';
import { Sparkline } from './Sparkline.jsx';
import styles from './FridgeCard.module.css';

function latestLine(fridge) {
  if (fridge.latest) {
    // The date and time stay together if the line has to wrap.
    return (
      <>
        Latest {formatTemp(fridge.latest.tempC)} ·{' '}
        <span className={styles.nowrap}>{formatDateTime(fridge.latest.tsUtc)}</span>
      </>
    );
  }
  return fridge.noLogger ? 'No logger in this fridge yet' : 'No readings this week';
}

export function FridgeCard({ fridge }) {
  return (
    <Link to={`/fridges/${fridge.fridgeId}`} className={styles.card}>
      <div className={styles.top}>
        <span className={styles.name}>
          <span className={styles.branch}>{fridge.branchName}</span>
          {fridge.fridgeName}
        </span>
        <StatusPill status={fridge.status} text={describeStatus(fridge)} />
      </div>
      <div className={styles.foot}>
        <span className={styles.latest}>{latestLine(fridge)}</span>
        <Sparkline
          points={fridge.sparkline}
          latestC={fridge.latest?.tempC ?? null}
          status={fridge.status}
        />
      </div>
    </Link>
  );
}

/** One card for a branch that sent no file this week; tapping it lists those fridges. */
export function BranchNoFileCard({ branchName, fridgeCount }) {
  return (
    <Link to={{ search: '?status=no_file' }} className={styles.card}>
      <div className={styles.top}>
        <span className={styles.name}>
          <span className={styles.branch}>{branchName}</span>
          All {fridgeCount} fridges
        </span>
        <StatusPill status="no_file" text="No file this week" />
      </div>
      <div className={styles.foot}>
        <span className={styles.latest}>Ask the branch to send this week's files</span>
      </div>
    </Link>
  );
}
