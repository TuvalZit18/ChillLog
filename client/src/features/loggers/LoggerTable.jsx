// The logger list as a table (Logger · Branch · Type of fridge · Since): sortable headers and a
// filter row under them, kept in the URL. On phones (below 720px) the same filters sit above
// compact rows, with a Sort by dropdown. Every row opens that logger.

import { Link, useNavigate, useSearchParams } from 'react-router';
import { formatDate } from '../../shared/format/format.js';
import button from '../../shared/ui/button.module.css';
import field from '../../shared/ui/field.module.css';
import { Icon } from '../../shared/ui/Icon.jsx';
import {
  filterRows,
  nextSort,
  readTableState,
  sortRows,
  tableOptions,
  tableSearch,
  toTableRows,
} from './loggerTableModel.js';
import styles from './LoggerTable.module.css';

// Fixed widths, so the columns don't jump when a filter changes which rows are shown.
const COLUMNS = [
  { key: 'code', label: 'Logger', width: '28%' },
  { key: 'branch', label: 'Branch', width: '26%' },
  { key: 'type', label: 'Type of fridge', width: '26%' },
  { key: 'since', label: 'Since', width: '20%' },
];

const SORT_CHOICES = [
  { value: 'code-asc', label: 'Logger ID, A–Z' },
  { value: 'branch-asc', label: 'Branch, A–Z' },
  { value: 'type-asc', label: 'Type of fridge, A–Z' },
  { value: 'since-desc', label: 'Newest in its fridge' },
  { value: 'since-asc', label: 'Longest in its fridge' },
];

/** @param {{ loggers: object[], branches: object[] }} props GET /api/loggers and /api/branches */
export function LoggerTable({ loggers, branches: allBranches }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const state = readTableState(searchParams);
  const all = toTableRows(loggers);
  const rows = sortRows(filterRows(all, state), state);
  const { branches, types } = tableOptions(allBranches);
  const filtered = state.q !== '' || state.branch !== null || state.type !== null;

  // Typing in the search box replaces the history entry, so Back doesn't step through letters.
  const update = (changes, replace = false) =>
    setSearchParams(new URLSearchParams(tableSearch({ ...state, ...changes })), { replace });
  const clearFilters = () => update({ q: '', branch: null, type: null });

  const search = (id) => (
    <input
      id={id}
      type="search"
      placeholder="Search logger ID"
      aria-label="Filter by logger ID"
      value={state.q}
      onChange={(e) => update({ q: e.target.value }, true)}
    />
  );
  const branchSelect = (id) => (
    <select
      id={id}
      aria-label="Filter by branch"
      value={state.branch ?? ''}
      onChange={(e) => update({ branch: e.target.value || null })}
    >
      <option value="">All branches</option>
      {branches.map((b) => (
        <option key={b} value={b}>
          {b}
        </option>
      ))}
    </select>
  );
  const typeSelect = (id) => (
    <select
      id={id}
      aria-label="Filter by type of fridge"
      value={state.type ?? ''}
      onChange={(e) => update({ type: e.target.value || null })}
    >
      <option value="">All types</option>
      {types.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );

  const noMatch = (
    <>
      No loggers match these filters.{' '}
      <button type="button" className={`${button.button} ${button.link}`} onClick={clearFilters}>
        Clear filters
      </button>
    </>
  );

  const count = filtered
    ? `${rows.length} of ${all.length} loggers`
    : `${all.length} ${all.length === 1 ? 'logger' : 'loggers'}`;

  return (
    <section className={styles.section} aria-labelledby="logger-list">
      <div className={styles.head}>
        <h2 id="logger-list">{count}</h2>
        {filtered && (
          <button
            type="button"
            className={`${button.button} ${button.link}`}
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Phones: the filters and a sort choice above compact rows. */}
      <div className={styles.phoneFilters}>
        <div className={`${field.field} ${styles.phoneSearch}`}>{search('loggers-q-phone')}</div>
        <div className={field.field}>{branchSelect('loggers-branch-phone')}</div>
        <div className={field.field}>{typeSelect('loggers-type-phone')}</div>
        <div className={field.field}>
          <select
            id="loggers-sort-phone"
            aria-label="Sort by"
            value={`${state.sort}-${state.dir}`}
            onChange={(e) => {
              const [sort, dir] = e.target.value.split('-');
              update({ sort, dir });
            }}
          >
            {SORT_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className={`${styles.empty} ${styles.phoneEmpty}`}>{noMatch}</p>
      ) : (
        <ul className={styles.phoneList}>
          {rows.map((row) => (
            <li key={row.id}>
              <Link to={`/loggers/${row.id}`} className={styles.phoneRow}>
                <span className={styles.phoneMain}>
                  <Code row={row} />
                  <Place row={row} />
                </span>
                <Since row={row} />
                <Icon name="chevRight" className={styles.chevron} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* From 720px: the table, with sortable headers and the filter row under them. */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            {COLUMNS.map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLUMNS.map((col) => {
                const active = state.sort === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      className={`${styles.sortButton} ${active ? styles.sorted : ''}`}
                      onClick={() => update(nextSort(state, col.key))}
                    >
                      {col.label}
                      <Icon
                        name={active ? (state.dir === 'asc' ? 'sortAsc' : 'sortDesc') : 'sortBoth'}
                        size={16}
                      />
                    </button>
                  </th>
                );
              })}
            </tr>
            <tr className={styles.filterRow}>
              <td>
                <div className={field.field}>{search('loggers-q')}</div>
              </td>
              <td>
                <div className={field.field}>{branchSelect('loggers-branch')}</div>
              </td>
              <td>
                <div className={field.field}>{typeSelect('loggers-type')}</div>
              </td>
              <td />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className={styles.emptyCell}>
                  {noMatch}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              // The row is clickable with a mouse; the ID link is the keyboard and screen-reader way in.
              <tr
                key={row.id}
                className={styles.bodyRow}
                onClick={() => navigate(`/loggers/${row.id}`)}
              >
                <td>
                  <Link
                    to={`/loggers/${row.id}`}
                    className={styles.codeLink}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Code row={row} />
                  </Link>
                </td>
                <td>
                  {row.branch ? (
                    <span className={styles.branch}>{row.branch}</span>
                  ) : (
                    <span className={styles.none}>Not in a fridge</span>
                  )}
                </td>
                <td>{row.fridge ?? <span className={styles.none}>–</span>}</td>
                <td>
                  <Since row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Code({ row }) {
  return (
    <span className={styles.codeCell}>
      <span className={styles.code}>{row.code}</span>
      {row.tags.map((tag) => (
        <span key={tag} className={styles.tag}>
          {tag}
        </span>
      ))}
    </span>
  );
}

function Place({ row }) {
  return row.branch ? (
    <span className={styles.place}>
      <span className={styles.branch}>{row.branch}</span> · {row.fridge}
    </span>
  ) : (
    <span className={styles.none}>Not in a fridge</span>
  );
}

function Since({ row }) {
  return row.sinceUtc ? (
    <span className={styles.since}>{formatDate(row.sinceUtc)}</span>
  ) : (
    <span className={styles.none}>Spare</span>
  );
}
