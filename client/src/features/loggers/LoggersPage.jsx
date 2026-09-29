// Loggers (docs/design/ui.md, "Screens > Loggers"): which logger sits in which fridge, set once
// so uploads use it from then on; plus the branches and fridges they go in, on a second tab.

import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router';
import button from '../../shared/ui/button.module.css';
import { Icon } from '../../shared/ui/Icon.jsx';
import { Skeleton } from '../../shared/ui/Skeleton.jsx';
import { StateBox } from '../../shared/ui/StateBox.jsx';
import { Toast, useToast } from '../../shared/ui/Toast.jsx';
import { useGetBranchesQuery, useGetLoggersQuery } from './loggersApi.js';
import { LoggerTable } from './LoggerTable.jsx';
import { readTab, retriedNote, tabSearch } from './loggersModel.js';
import styles from './LoggersPage.module.css';

// The forms bring react-hook-form and Zod; load them only when one opens.
const forms = () => import('./RegistryForms.jsx');
const AddLoggerDialog = lazy(() => forms().then((m) => ({ default: m.AddLoggerDialog })));
const AddFridgeDialog = lazy(() => forms().then((m) => ({ default: m.AddFridgeDialog })));
const AddBranchDialog = lazy(() => forms().then((m) => ({ default: m.AddBranchDialog })));

export function LoggersPage() {
  const loggers = useGetLoggersQuery();
  const branches = useGetBranchesQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = readTab(searchParams);
  /** Which dialog is open: { kind: 'logger' } · { kind: 'branch' } · { kind: 'fridge', branch } */
  const [dialog, setDialog] = useState(null);
  const [toast, showToast] = useToast();
  const close = () => setDialog(null);

  if (loggers.isError || branches.isError) {
    return (
      <div className={styles.page}>
        <Head />
        <StateBox
          icon="wifiOff"
          tone="muted"
          title="Couldn't load"
          action={
            <button
              type="button"
              className={`${button.button} ${button.primary}`}
              onClick={() => {
                loggers.refetch();
                branches.refetch();
              }}
            >
              Retry
            </button>
          }
        >
          Check your connection, then try again. Nothing you uploaded is lost.
        </StateBox>
      </div>
    );
  }
  if (!loggers.data || !branches.data) {
    return (
      <div className={styles.page} role="status">
        <span className="visually-hidden">Loading the loggers…</span>
        <Head />
        <Skeleton height={320} />
      </div>
    );
  }

  const tabs = [
    { key: 'loggers', label: 'Loggers', count: loggers.data.length },
    { key: 'branches', label: 'Branches and fridges', count: branches.data.length },
  ];

  return (
    <div className={styles.page}>
      {tab === 'loggers' ? (
        <Head action="Add logger" onAdd={() => setDialog({ kind: 'logger' })} />
      ) : (
        <Head action="Add branch" onAdd={() => setDialog({ kind: 'branch' })} />
      )}

      <Tabs
        tabs={tabs}
        current={tab}
        onChange={(next) => setSearchParams(tabSearch(searchParams, next))}
      />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'loggers' ? (
          loggers.data.length === 0 ? (
            <p className={`${styles.card} ${styles.pad} muted`}>
              No loggers yet. Add one with the ID printed on it.
            </p>
          ) : (
            <LoggerTable loggers={loggers.data} />
          )
        ) : (
          <section className={styles.section} aria-labelledby="branch-list">
            <h2 id="branch-list">
              {branches.data.length} {branches.data.length === 1 ? 'branch' : 'branches'}
            </h2>
            <ul className={styles.card}>
              {branches.data.map((branch) => (
                <li key={branch.id} className={styles.branch}>
                  <span className={styles.where}>
                    <span className={styles.branchName}>{branch.name}</span>
                    <span className={styles.sub}>
                      {branch.fridges.length
                        ? branch.fridges.map((f) => f.name).join(', ')
                        : 'No fridges yet'}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={button.button}
                    onClick={() => setDialog({ kind: 'fridge', branch })}
                  >
                    <Icon name="plus" size={16} />
                    Add fridge<span className="visually-hidden"> in {branch.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <Suspense fallback={null}>
        {dialog?.kind === 'logger' && (
          <AddLoggerDialog
            branches={branches.data}
            onClose={close}
            onAdded={(logger) => {
              close();
              showToast(
                [`${logger.code} added.`, retriedNote(logger.retried)].filter(Boolean).join(' '),
              );
            }}
          />
        )}
        {dialog?.kind === 'fridge' && (
          <AddFridgeDialog
            branch={dialog.branch}
            onClose={close}
            onAdded={(fridge) => {
              close();
              showToast(`${fridge.name} added to ${dialog.branch.name}.`);
            }}
          />
        )}
        {dialog?.kind === 'branch' && (
          <AddBranchDialog
            onClose={close}
            onAdded={(branch) => {
              close();
              showToast(`${branch.name} added.`);
            }}
          />
        )}
      </Suspense>

      <Toast message={toast} />
    </div>
  );
}

function Head({ action, onAdd }) {
  return (
    <div className={styles.head}>
      <div className={styles.titles}>
        <h1>Loggers</h1>
        <p className="small muted">
          Which logger sits in which fridge. Set it once; uploads use it from then on.
        </p>
      </div>
      {onAdd && (
        <button type="button" className={`${button.button} ${button.primary}`} onClick={onAdd}>
          <Icon name="plus" />
          {action}
        </button>
      )}
    </div>
  );
}

/** Two tabs with counts. Arrow keys move between them, as screen-reader users expect of tabs. */
function Tabs({ tabs, current, onChange }) {
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = tabs.findIndex((t) => t.key === current);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    onChange(next.key);
    document.getElementById(`tab-${next.key}`)?.focus();
  };
  return (
    <div role="tablist" aria-label="Show" className={styles.tabs} onKeyDown={onKeyDown}>
      {tabs.map((t) => {
        const selected = t.key === current;
        return (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${t.key}`}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(t.key)}
          >
            {t.label}
            <span className={styles.tabCount}>{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}
