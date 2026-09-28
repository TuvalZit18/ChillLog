// Fridge page (docs/design/ui.md, "Screens > Fridge detail"): one fridge over a range, with the
// time above 5°C, gaps, door openings and logger history. The range lives in the URL.

import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { formatDateTime, formatDurationShort, formatTemp } from '../../shared/format/format.js';
import { StatusPill } from '../../shared/status/StatusPill.jsx';
import { describeStatus } from '../../shared/status/status.js';
import { BackLink } from '../../shared/ui/BackLink.jsx';
import button from '../../shared/ui/button.module.css';
import { Note } from '../../shared/ui/Note.jsx';
import { Skeleton } from '../../shared/ui/Skeleton.jsx';
import { StateBox } from '../../shared/ui/StateBox.jsx';
import { ExcursionCard } from './ExcursionCard.jsx';
import { useGetFridgeQuery } from './fridgeApi.js';
import { doorNote, gapLine, loggerHistory } from './fridgeText.js';
import { RangePicker } from './RangePicker.jsx';
import { rangeQuery, rangeSearch, readRange } from './rangeModel.js';
import styles from './FridgePage.module.css';

const DEFAULT_RANGE = readRange(new URLSearchParams());

export function FridgePage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const range = readRange(searchParams);
  const rangeError = rangeQuery(range, new Date()).error;

  // While a custom range is half filled in or backwards, keep showing the fridge from the last
  // good range instead of sending the server a request it would reject.
  const [shownRange, setShownRange] = useState(rangeError ? DEFAULT_RANGE : range);
  if (!rangeError && rangeSearch(range) !== rangeSearch(shownRange)) setShownRange(range);

  const { data, currentData, error, isFetching, refetch } = useGetFridgeQuery({
    id,
    range: shownRange,
  });
  // A new range keeps the old results on screen while loading; a different fridge doesn't.
  const fridge = currentData ?? (data && String(data.fridge.id) === id ? data : undefined);

  function changeRange(next, { replace = false } = {}) {
    setSearchParams(new URLSearchParams(rangeSearch(next)), { replace });
  }

  if (!fridge) {
    if (!error) return <FridgeSkeleton />;
    return <FridgeError error={error} onRetry={refetch} retrying={isFetching} />;
  }

  const { weekStatus, latest, currentLogger } = fridge;
  const history = loggerHistory(fridge.placements);
  const doors = doorNote(fridge.doorSpikes);

  return (
    <div className={styles.page}>
      <BackLink to="/">Overview</BackLink>

      <header className={styles.head}>
        <p className={styles.eyebrow}>{fridge.fridge.branchName}</p>
        <h1>{fridge.fridge.name}</h1>
        {weekStatus && <StatusPill status={weekStatus.status} text={describeStatus(weekStatus)} />}
        <p className="small muted num">
          Logger <span className="mono">{currentLogger?.loggerCode ?? 'none'}</span> ·{' '}
          {latest
            ? `Latest ${formatTemp(latest.tempC)} · ${formatDateTime(latest.tsUtc)}`
            : 'No readings yet'}
        </p>
      </header>

      <RangePicker range={range} onChange={changeRange} />

      {rangeError ? (
        <p className={styles.rangeError} role="alert">
          {rangeError}
        </p>
      ) : (
        <div className={styles.content} aria-busy={isFetching}>
          {doors && <Note icon="info">{doors}</Note>}

          <section className={styles.section} aria-labelledby="above-limit">
            <h2 id="above-limit">Time above 5°C</h2>
            {fridge.excursions.length === 0 ? (
              <div className={styles.card}>
                <StatusPill status="ok" text="None in this range" />
              </div>
            ) : (
              <div className={styles.list}>
                {fridge.excursions.map((excursion) => (
                  <ExcursionCard key={excursion.startUtc} excursion={excursion} />
                ))}
              </div>
            )}
          </section>

          {(fridge.gaps.length > 0 || fridge.errCount > 0) && (
            <section className={styles.section} aria-labelledby="gaps">
              <h2 id="gaps">Gaps in data</h2>
              <ul className={`${styles.card} ${styles.plainList}`}>
                {fridge.gaps.map((gap) => (
                  <li key={gap.fromUtc}>
                    <StatusPill status="gap" text={`Gap · ${formatDurationShort(gap.minutes)}`} />
                    <span>{gapLine(gap)}</span>
                  </li>
                ))}
                {fridge.errCount > 0 && (
                  <li>
                    <span className={styles.tag}>ERR</span>
                    <span>
                      {fridge.errCount} unreadable {fridge.errCount === 1 ? 'reading' : 'readings'}{' '}
                      skipped
                    </span>
                  </li>
                )}
              </ul>
            </section>
          )}

          {history && (
            <Note icon="history">
              <b>Logger history.</b> {history}
            </Note>
          )}

          <Link
            to={`/inspector?fridgeId=${fridge.fridge.id}`}
            className={`${button.button} ${button.primary} ${styles.inspector}`}
          >
            Inspector report for this fridge
          </Link>
        </div>
      )}
    </div>
  );
}

function FridgeSkeleton() {
  return (
    <div className={styles.page} role="status">
      <span className="visually-hidden">Loading the fridge…</span>
      <Skeleton width={110} height={44} />
      <div className={styles.head}>
        <Skeleton width={120} height={14} />
        <Skeleton width={220} height={30} />
        <Skeleton width={200} height={28} round />
      </div>
      <Skeleton height={240} />
    </div>
  );
}

function FridgeError({ error, onRetry, retrying }) {
  if (error.status === 404) {
    return (
      <div className={styles.page}>
        <BackLink to="/">Overview</BackLink>
        <StateBox
          icon="info"
          tone="muted"
          title="Fridge not found"
          action={
            <Link to="/" className={`${button.button} ${button.primary}`}>
              Go to the overview
            </Link>
          }
        >
          This fridge isn't in ChillLog. It may have been removed, or the link is wrong.
        </StateBox>
      </div>
    );
  }
  // The server explains request problems (e.g. a range over a year) in error.data.error.
  const message = error.data?.error;
  return (
    <div className={styles.page}>
      <BackLink to="/">Overview</BackLink>
      <StateBox
        icon="wifiOff"
        tone="muted"
        title="Couldn't load"
        action={
          <button
            type="button"
            className={`${button.button} ${button.primary}`}
            onClick={onRetry}
            disabled={retrying}
          >
            {retrying ? 'Trying again…' : 'Retry'}
          </button>
        }
      >
        {message ?? 'Check your connection, then try again. Nothing you uploaded is lost.'}
      </StateBox>
    </div>
  );
}
