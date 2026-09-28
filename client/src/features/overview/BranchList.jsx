// "All branches": a collapsible row per branch on phones, a card grid from 880px. Both render and
// CSS shows one (display: none also hides the other from screen readers).

import { Link } from 'react-router';
import { Icon } from '../../shared/ui/Icon.jsx';
import { StatusPill } from '../../shared/status/StatusPill.jsx';
import { describeStatus, STATUS_META } from '../../shared/status/status.js';
import styles from './BranchList.module.css';

const fridgeCount = (n) => `${n} ${n === 1 ? 'fridge' : 'fridges'}`;

/**
 * One fridge in a branch. In the narrow desktop cards (`stacked`) the pill always sits under the
 * name, with the compact wording, so every row has the same shape.
 */
function FridgeRow({ fridge, stacked = false }) {
  return (
    <Link
      to={`/fridges/${fridge.fridgeId}`}
      className={`${styles.row} ${stacked ? styles.stacked : ''}`}
    >
      <span className={styles.rowName}>{fridge.fridgeName}</span>
      <StatusPill status={fridge.status} text={describeStatus(fridge, { compact: stacked })} />
    </Link>
  );
}

/** @param {{ branches: ReturnType<typeof import('./overviewModel.js').groupBranches> }} props */
export function BranchList({ branches }) {
  return (
    <>
      <div className={styles.list}>
        {branches.map((branch) => (
          <details key={branch.branchId} className={styles.item}>
            <summary className={styles.summary}>
              <span className={styles.main}>
                <span className={styles.name}>{branch.branchName}</span>
                <span className={styles.count}>{fridgeCount(branch.fridges.length)}</span>
              </span>
              <StatusPill
                status={branch.worst.status}
                text={branch.worst.status === 'ok' ? 'All OK' : describeStatus(branch.worst)}
              />
              <Icon name="chevDown" size={20} className={styles.chevron} />
            </summary>
            {branch.fridges.map((fridge) => (
              <FridgeRow key={fridge.fridgeId} fridge={fridge} />
            ))}
          </details>
        ))}
      </div>

      <div className={styles.grid}>
        {branches.map((branch) => {
          // A branch with a problem takes its worst status's color on the card's edge, and its
          // icon in the header, so the color never stands alone.
          const worst = branch.worst.status === 'ok' ? null : STATUS_META[branch.worst.status];
          return (
            <section
              key={branch.branchId}
              className={`${styles.card} ${worst ? styles.toned : ''}`}
              style={worst ? { '--tone': worst.color } : undefined}
              aria-label={branch.branchName}
            >
              <div className={styles.cardHead}>
                <span className={styles.cardName}>{branch.branchName}</span>
                <span className={styles.cardMeta}>
                  {worst && (
                    <span className={styles.worstIcon}>
                      <Icon name={worst.icon} size={16} />
                      <span className="visually-hidden">Worst: {worst.label}. </span>
                    </span>
                  )}
                  <span className="small muted">{fridgeCount(branch.fridges.length)}</span>
                </span>
              </div>
              {branch.fridges.map((fridge) => (
                <FridgeRow key={fridge.fridgeId} fridge={fridge} stacked />
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
