// "All branches": a collapsible row per branch on phones, a card grid from 880px. Both render and
// CSS shows one (display: none also hides the other from screen readers).

import { Link } from 'react-router';
import { Icon } from '../../shared/ui/Icon.jsx';
import { StatusPill } from '../../shared/status/StatusPill.jsx';
import { describeStatus, STATUS_META } from '../../shared/status/status.js';
import { glowCard } from '../../shared/ui/glowCard.js';
import { branchSummary } from './overviewModel.js';
import styles from './BranchList.module.css';

const fridgeCount = (n) => `${n} ${n === 1 ? 'fridge' : 'fridges'}`;

/** One fridge in a branch, on the phone list: name and full pill side by side. */
function FridgeRow({ fridge }) {
  return (
    <Link to={`/fridges/${fridge.fridgeId}`} className={styles.row}>
      <span className={styles.rowName}>{fridge.fridgeName}</span>
      <StatusPill status={fridge.status} text={describeStatus(fridge)} />
    </Link>
  );
}

/**
 * One fridge in a narrow desktop card (Laws of UX: Von Restorff, Selective Attention). An OK
 * fridge is one quiet line ("Walk-in ✓ OK · 3.3°C"); a problem gets its own filled pill on a line
 * of its own, so the few problems stand out from the many OK rows.
 */
function CardRow({ fridge }) {
  const ok = fridge.status === 'ok';
  return (
    <Link
      to={`/fridges/${fridge.fridgeId}`}
      className={`${styles.row} ${ok ? styles.quietRow : styles.stacked}`}
    >
      <span className={styles.rowName}>{fridge.fridgeName}</span>
      <StatusPill
        status={fridge.status}
        text={describeStatus(fridge, { compact: true })}
        quiet={ok}
      />
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
          // A branch with a problem takes its worst status's color on the card's edge; the header
          // says what's wrong in words ("1 alert, 1 gap · 3 fridges") next to that status's icon,
          // so neither the color nor the icon has to be decoded.
          const problem = branch.worst.status !== 'ok';
          const meta = STATUS_META[branch.worst.status];
          return (
            <section
              key={branch.branchId}
              className={`${styles.card} ${glowCard(branch.worst.status).className}`}
              // --tone for every status: the header's icon uses it too (green when all is OK).
              style={{ '--tone': meta.color }}
              aria-label={branch.branchName}
            >
              <div className={styles.cardHead}>
                <span className={styles.cardName}>{branch.branchName}</span>
                <span className={`${styles.cardSummary} ${problem ? styles.summaryProblem : ''}`}>
                  <Icon name={meta.icon} size={16} className={styles.summaryIcon} />
                  {branchSummary(branch)}
                </span>
              </div>
              {branch.fridges.map((fridge) => (
                <CardRow key={fridge.fridgeId} fridge={fridge} />
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
