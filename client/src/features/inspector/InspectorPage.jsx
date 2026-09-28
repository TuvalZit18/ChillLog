// Inspector report (docs/design/ui.md, "Screens > Inspector report"): "when did this fridge go
// above five degrees, and for how long?" answered in one sentence, with every time listed, the
// gaps, a CSV for Excel and a way to share it. Filters live in the URL.

import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { THRESHOLDS } from '@chilllog/shared';
import { formatDateTime, formatDurationShort, toIsraelLocal } from '../../shared/format/format.js';
import { StatusPill } from '../../shared/status/StatusPill.jsx';
import button from '../../shared/ui/button.module.css';
import field from '../../shared/ui/field.module.css';
import { Icon } from '../../shared/ui/Icon.jsx';
import { Note } from '../../shared/ui/Note.jsx';
import { Skeleton } from '../../shared/ui/Skeleton.jsx';
import { StateBox } from '../../shared/ui/StateBox.jsx';
import { ExcursionCard } from '../fridge/ExcursionCard.jsx';
import { gapLine } from '../fridge/fridgeText.js';
import { useGetBranchesQuery } from '../loggers/loggersApi.js';
import { useGetInspectorQuery } from './inspectorApi.js';
import { answer, filtersQuery, filtersSearch, readFilters, scopeOf } from './inspectorModel.js';
import styles from './InspectorPage.module.css';

const LIMIT = `${THRESHOLDS.limitC}°C`;

export function InspectorPage() {
  const today = toIsraelLocal(new Date()).slice(0, 10);
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams, today);
  const { query, error: filterError } = filtersQuery(filters);

  const {
    data: branches,
    isError: branchesFailed,
    refetch: refetchBranches,
  } = useGetBranchesQuery();
  const {
    data: report,
    error,
    isFetching,
    refetch,
  } = useGetInspectorQuery(query, { skip: !query });

  function update(changes, { replace = false } = {}) {
    setSearchParams(new URLSearchParams(filtersSearch({ ...filters, ...changes }, today)), {
      replace,
    });
  }

  if (branchesFailed) {
    return (
      <div className={styles.page}>
        <Head />
        <CouldNotLoad onRetry={refetchBranches} />
      </div>
    );
  }
  if (!branches) {
    return (
      <div className={styles.page} role="status">
        <span className="visually-hidden">Loading the inspector report…</span>
        <Head />
        <Skeleton height={160} />
        <Skeleton height={120} />
      </div>
    );
  }

  const scope = scopeOf(filters, branches);
  const branchId = scope.kind === 'all' ? null : scope.branchId;
  const branchFridges = branches.find((b) => b.id === branchId)?.fridges ?? [];
  const named = scope.kind !== 'fridge'; // list rows name their fridge unless it's one fridge

  return (
    <div className={styles.page}>
      <Head />

      <div className={styles.filters}>
        <div className={`${field.field} ${styles.wide}`}>
          <label htmlFor="insp-branch">Branch</label>
          <select
            id="insp-branch"
            value={branchId ?? ''}
            onChange={(e) =>
              update({ branchId: e.target.value ? Number(e.target.value) : null, fridgeId: null })
            }
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className={`${field.field} ${styles.wide}`}>
          <label htmlFor="insp-fridge">Fridge</label>
          <select
            id="insp-fridge"
            value={filters.fridgeId ?? ''}
            disabled={branchId === null}
            onChange={(e) =>
              update({ branchId, fridgeId: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">All fridges</option>
            {branchFridges.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className={field.field}>
          <label htmlFor="insp-from">From</label>
          <input
            id="insp-from"
            type="date"
            value={filters.from}
            max={today}
            onChange={(e) => update({ from: e.target.value }, { replace: true })}
          />
        </div>
        <div className={field.field}>
          <label htmlFor="insp-to">To</label>
          <input
            id="insp-to"
            type="date"
            value={filters.to}
            max={today}
            onChange={(e) => update({ to: e.target.value }, { replace: true })}
          />
        </div>
      </div>

      {filterError ? (
        <p className={styles.card} role="alert">
          {filterError}
        </p>
      ) : !report ? (
        error ? (
          <CouldNotLoad onRetry={refetch} message={error.data?.error} retrying={isFetching} />
        ) : (
          <Skeleton height={140} />
        )
      ) : (
        <div className={styles.results} aria-busy={isFetching}>
          <Answer scope={scope} report={report} filters={filters} />

          {report.excursions.length > 0 && (
            <section className={styles.section} aria-labelledby="every-time">
              <h2 id="every-time">Every time above {LIMIT}</h2>
              <ExcursionTable excursions={report.excursions} />
              <div className={styles.cardsList}>
                {report.excursions.map((e) => (
                  <ExcursionCard
                    key={`${e.fridgeId}-${e.startUtc}`}
                    excursion={e}
                    title={named ? `${e.branchName} · ${e.fridgeName}` : undefined}
                  />
                ))}
              </div>
            </section>
          )}

          <Note icon="info">
            Single readings above {LIMIT}, such as a door opening, are not counted. Gaps in the data
            are listed separately.
          </Note>

          <Gaps report={report} named={named} />

          <Actions query={query} scope={scope} report={report} filters={filters} />
        </div>
      )}
    </div>
  );
}

function Head() {
  return (
    <div className={styles.head}>
      <h1>Inspector report</h1>
      <p className="small muted">When did a fridge go above {LIMIT}, and for how long?</p>
    </div>
  );
}

function CouldNotLoad({ onRetry, message, retrying = false }) {
  return (
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
  );
}

function Answer({ scope, report, filters }) {
  return (
    <div className={styles.answer}>
      <p className={styles.eyebrow}>Answer</p>
      <p className={styles.sentence}>
        {answer({ scope, report, filters }).map((segment, i) =>
          segment.bold ? <b key={i}>{segment.text}</b> : <span key={i}>{segment.text}</span>,
        )}
      </p>
    </div>
  );
}

/** Wide screens: one table row per time above 5°C (cards are shown instead below 720px). */
function ExcursionTable({ excursions }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Branch</th>
            <th scope="col">Fridge</th>
            <th scope="col">Started</th>
            <th scope="col">Ended</th>
            <th scope="col">Duration</th>
            <th scope="col" className={styles.number}>
              Peak °C
            </th>
          </tr>
        </thead>
        <tbody>
          {excursions.map((e) => (
            <tr key={`${e.fridgeId}-${e.startUtc}`}>
              <td>{e.branchName}</td>
              <td>{e.fridgeName}</td>
              <td>{formatDateTime(e.startUtc)}</td>
              <td>{formatDateTime(e.endUtc)}</td>
              <td>{formatDurationShort(e.durationMinutes)}</td>
              <td className={styles.number}>{e.peakC.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Gaps({ report, named }) {
  const withoutData = named ? report.fridgesWithoutData : [];
  if (report.gaps.length === 0 && withoutData.length === 0) return null;
  const who = (item) => (named ? `${item.branchName} · ${item.fridgeName}: ` : '');
  return (
    <section className={styles.section} aria-labelledby="gaps">
      <h2 id="gaps">Gaps in data</h2>
      <ul className={`${styles.card} ${styles.plainList}`}>
        {report.gaps.map((g) => (
          <li key={`${g.fridgeId}-${g.fromUtc}`}>
            <StatusPill status="gap" text={`Gap · ${formatDurationShort(g.minutes)}`} />
            <span>
              {who(g)}
              {gapLine(g)}
            </span>
          </li>
        ))}
        {withoutData.map((f) => (
          <li key={`none-${f.fridgeId}`}>
            <StatusPill status="no_file" text="No readings" />
            <span>
              {f.branchName} · {f.fridgeName}: no readings in this range
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Actions({ query, scope, report, filters }) {
  const [shareStatus, setShareStatus] = useState(null);
  const exportUrl = `/api/inspector/export?${new URLSearchParams(query)}`;
  const canShare = typeof navigator.share === 'function' || Boolean(navigator.clipboard);

  async function share() {
    const text = answer({ scope, report, filters })
      .map((s) => s.text)
      .join('');
    const url = window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'ChillLog inspector report', text, url });
      } catch {
        // Closing the share sheet is not an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus('Link copied');
    } catch {
      setShareStatus("Couldn't copy the link");
    }
    setTimeout(() => setShareStatus(null), 3000);
  }

  return (
    <div className={styles.actions}>
      <a href={exportUrl} download className={`${button.button} ${button.primary}`}>
        <Icon name="download" />
        Export CSV
      </a>
      {canShare && (
        <button type="button" className={button.button} onClick={share}>
          <Icon name="share" />
          Share
        </button>
      )}
      <span className="small muted" role="status">
        {shareStatus}
      </span>
    </div>
  );
}
