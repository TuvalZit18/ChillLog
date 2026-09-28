// Loading state for the overview: the page's shape in grey blocks.

import { Skeleton } from '../../shared/ui/Skeleton.jsx';
import styles from './OverviewPage.module.css';

export function OverviewSkeleton() {
  return (
    <div className={styles.page} role="status">
      <span className="visually-hidden">Loading the overview…</span>
      <div className={styles.head}>
        <Skeleton width={260} height={30} />
        <Skeleton width={320} height={18} />
      </div>
      <div className={styles.chips}>
        {[96, 110, 90, 104, 88].map((width, i) => (
          <Skeleton key={i} width={width} height={44} round />
        ))}
      </div>
      <div className={styles.cards}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skeletonCard}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="65%" height={20} />
            <Skeleton width="55%" height={28} round />
          </div>
        ))}
      </div>
    </div>
  );
}
