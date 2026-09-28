// "All branches": a collapsible row per branch on phones, a card grid from 880px. Both render and
// CSS shows one (display: none also hides the other from screen readers).

import { Link } from 'react-router';
import { Icon } from '../../shared/ui/Icon.jsx';
import { StatusPill } from '../../shared/status/StatusPill.jsx';
import { describeStatus } from '../../shared/status/status.js';
import styles from './BranchList.module.css';

const fridgeCount = (n) => `${n} ${n === 1 ? 'fridge' : 'fridges'}`;

function FridgeRow({ fridge }) {
  return (
    <Link to={`/fridges/${fridge.fridgeId}`} className={styles.row}>
      <span className={styles.rowName}>{fridge.fridgeName}</span>
      <StatusPill status={fridge.status} text={describeStatus(fridge)} />
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
        {branches.map((branch) => (
          <section
            key={branch.branchId}
            className={`${styles.card} ${branch.worst.status === 'ok' ? '' : styles.hasProblem}`}
            aria-label={branch.branchName}
          >
            <div className={styles.cardHead}>
              <span className={styles.cardName}>{branch.branchName}</span>
              <span className="small muted">{fridgeCount(branch.fridges.length)}</span>
            </div>
            {branch.fridges.map((fridge) => (
              <FridgeRow key={fridge.fridgeId} fridge={fridge} />
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
