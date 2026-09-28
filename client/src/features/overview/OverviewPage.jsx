// Overview (docs/design/ui.md, "Screens > Overview"): how every fridge did last week and where
// something is wrong. The status filter lives in the URL (?status=alert) so it can be bookmarked.

import { Link, useSearchParams } from 'react-router';
import { formatDateTime, formatDay } from '../../shared/format/format.js';
import { StatusPill } from '../../shared/status/StatusPill.jsx';
import { STATUS_META } from '../../shared/status/status.js';
import button from '../../shared/ui/button.module.css';
import { StateBox } from '../../shared/ui/StateBox.jsx';
import { BranchList } from './BranchList.jsx';
import { BranchNoFileCard, FridgeCard } from './FridgeCard.jsx';
import { OverviewSkeleton } from './OverviewSkeleton.jsx';
import { useGetOverviewQuery } from './overviewApi.js';
import {
  groupBranches,
  needsAttention,
  readStatusFilter,
  sortWorstFirst,
} from './overviewModel.js';
import { StatusChips } from './StatusChips.jsx';
import styles from './OverviewPage.module.css';

const TITLE = 'Every fridge, this week';
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function OverviewPage() {
  const { data, isError, isFetching, refetch } = useGetOverviewQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = readStatusFilter(searchParams.get('status'));

  // Keep showing the last good data if a refresh fails; only an empty screen shows the error.
  if (!data) {
    if (!isError) return <OverviewSkeleton />;
    return (
      <div className={styles.page}>
        <h1>{TITLE}</h1>
        <StateBox
          icon="wifiOff"
          tone="muted"
          title="Couldn't load"
          action={
            <button
              type="button"
              className={`${button.button} ${button.primary}`}
              onClick={refetch}
              disabled={isFetching}
            >
              {isFetching ? 'Trying again…' : 'Retry'}
            </button>
          }
        >
          Check your connection, then try again. Nothing you uploaded is lost.
        </StateBox>
      </div>
    );
  }

  if (!data.lastUploadUtc || data.fridges.length === 0) {
    return (
      <div className={styles.page}>
        <h1>{TITLE}</h1>
        <StateBox
          icon="upload"
          title="No readings yet"
          action={
            <Link to="/upload" className={`${button.button} ${button.primary}`}>
              Upload your first files
            </Link>
          }
        >
          Upload the logger files from your branches. Each fridge will show up here with its
          temperature and status.
        </StateBox>
      </div>
    );
  }

  function toggleFilter(status) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (next.get('status') === status) next.delete('status');
      else next.set('status', status);
      return next;
    });
  }

  const { week, lastUploadUtc, counts, fridges } = data;
  const branches = groupBranches(fridges);

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>{TITLE}</h1>
        <p className="small muted num">
          Readings for {formatDay(week.firstDay)} to {formatDay(week.lastDay)} · Last upload{' '}
          {formatDateTime(lastUploadUtc)}
        </p>
      </div>

      <StatusChips counts={counts} selected={filter} onToggle={toggleFilter} />

      {filter ? (
        <FilteredList
          status={filter}
          fridges={sortWorstFirst(fridges.filter((f) => f.status === filter))}
          onClear={() => toggleFilter(filter)}
        />
      ) : (
        <>
          <NeedsAttention fridges={fridges} />
          <section className={styles.section} aria-labelledby="all-branches">
            <div className={styles.sectionHead}>
              <h2 id="all-branches">All branches</h2>
              <span className="small muted">
                {plural(branches.length, 'branch', 'branches')} · {plural(fridges.length, 'fridge')}
              </span>
            </div>
            <BranchList branches={branches} />
          </section>
        </>
      )}
    </div>
  );
}

function NeedsAttention({ fridges }) {
  const items = needsAttention(fridges);
  return (
    <section className={styles.section} aria-labelledby="needs-attention">
      <div className={styles.sectionHead}>
        <h2 id="needs-attention">Needs attention</h2>
        {items.length > 0 && <span className="small muted">Worst first</span>}
      </div>
      {items.length === 0 ? (
        <div className={styles.allOk}>
          <StatusPill status="ok" text="Every fridge is OK this week" />
        </div>
      ) : (
        <div className={styles.cards}>
          {items.map((item) =>
            item.kind === 'branch' ? (
              <BranchNoFileCard key={`branch-${item.branchId}`} {...item} />
            ) : (
              <FridgeCard key={item.fridge.fridgeId} fridge={item.fridge} />
            ),
          )}
        </div>
      )}
    </section>
  );
}

function FilteredList({ status, fridges, onClear }) {
  return (
    <section className={styles.section} aria-labelledby="filtered">
      <div className={styles.sectionHead}>
        <h2 id="filtered">
          {STATUS_META[status].label} · {plural(fridges.length, 'fridge')}
        </h2>
        <button type="button" className={`${button.button} ${button.link}`} onClick={onClear}>
          Show everything
        </button>
      </div>
      {fridges.length === 0 ? (
        <p className="muted">No fridges with this status this week.</p>
      ) : (
        <div className={styles.cards}>
          {fridges.map((fridge) => (
            <FridgeCard key={fridge.fridgeId} fridge={fridge} />
          ))}
        </div>
      )}
    </section>
  );
}
