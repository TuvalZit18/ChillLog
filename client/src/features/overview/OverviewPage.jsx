// Overview (docs/design/ui.md, "Screens > Overview"): how every fridge did last week and where
// something is wrong. The status, branch and type filters live in the URL
// (?status=alert&branch=4&type=Display) so a view can be bookmarked or shared.

import { Link, useSearchParams } from 'react-router';
import { formatDateTime, formatDay } from '../../shared/format/format.js';
import { StatusPill } from '../../shared/status/StatusPill.jsx';
import button from '../../shared/ui/button.module.css';
import { StateBox } from '../../shared/ui/StateBox.jsx';
import { useGetBranchesQuery } from '../loggers/loggersApi.js';
import { BranchList } from './BranchList.jsx';
import { BranchNoFileCard, FridgeCard } from './FridgeCard.jsx';
import { OverviewSkeleton } from './OverviewSkeleton.jsx';
import { useGetOverviewQuery } from './overviewApi.js';
import {
  countByStatus,
  filterFridges,
  groupBranches,
  needsAttention,
  placeFilterOptions,
  readPlaceFilter,
  readStatusFilter,
} from './overviewModel.js';
import { PlaceFilters } from './PlaceFilters.jsx';
import { StatusChips } from './StatusChips.jsx';
import styles from './OverviewPage.module.css';

const TITLE = 'Every fridge, this week';
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function OverviewPage() {
  const { data, isError, isFetching, refetch } = useGetOverviewQuery();
  // The filters list the branches in the database, including one with no fridges yet.
  const { data: allBranches = [] } = useGetBranchesQuery();
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

  /** Set or clear URL filters, keeping the others. */
  function setParams(changes) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [name, value] of Object.entries(changes)) {
        if (value === null) next.delete(name);
        else next.set(name, value);
      }
      return next;
    });
  }

  function toggleFilter(status) {
    setParams({ status: filter === status ? null : status });
  }

  const { week, lastUploadUtc } = data;
  // Branch and Type set the chip counts; the chip (status) then narrows both sections the same
  // way, so Needs attention and the branch cards always show the same fridges.
  const place = readPlaceFilter(searchParams);
  const inPlace = filterFridges(data.fridges, place);
  const fridges = filterFridges(inPlace, { branchId: null, type: null, status: filter });
  const narrowed = place.branchId !== null || place.type !== null || filter !== null;
  const branches = groupBranches(fridges);
  const clearAll = () => setParams({ branch: null, type: null, status: null });
  const chosenBranch = allBranches.find((b) => b.id === place.branchId);

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>{TITLE}</h1>
        <p className="small muted num">
          Readings for {formatDay(week.firstDay)} to {formatDay(week.lastDay)} · Last upload{' '}
          {formatDateTime(lastUploadUtc)}
        </p>
      </div>

      <StatusChips counts={countByStatus(inPlace)} selected={filter} onToggle={toggleFilter} />

      <PlaceFilters
        {...placeFilterOptions(allBranches, place)}
        branchId={place.branchId}
        type={place.type}
        onChange={(name, value) => setParams({ [name]: value })}
        onClear={() => setParams({ branch: null, type: null })}
      />

      {fridges.length === 0 ? (
        <div className={styles.allOk}>
          {chosenBranch?.fridges.length === 0 ? (
            <p>
              {chosenBranch.name} has no fridges yet.{' '}
              <Link to="/loggers?tab=branches">Add them in Setup</Link>.
            </p>
          ) : (
            <p>No fridges match these filters.</p>
          )}
          <button type="button" className={`${button.button} ${button.link}`} onClick={clearAll}>
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <NeedsAttention fridges={fridges} narrowed={narrowed} />
          <section className={styles.section} aria-labelledby="all-branches">
            <div className={styles.sectionHead}>
              <h2 id="all-branches">{narrowed ? 'Branches' : 'All branches'}</h2>
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

function NeedsAttention({ fridges, narrowed }) {
  const items = needsAttention(fridges);
  const allOk = narrowed
    ? 'Every fridge in this view is OK this week'
    : 'Every fridge is OK this week';
  return (
    <section className={styles.section} aria-labelledby="needs-attention">
      <div className={styles.sectionHead}>
        <h2 id="needs-attention">Needs attention</h2>
        {items.length > 0 && <span className="small muted">Worst first</span>}
      </div>
      {items.length === 0 ? (
        <div className={styles.allOk}>
          <StatusPill status="ok" text={allOk} />
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
