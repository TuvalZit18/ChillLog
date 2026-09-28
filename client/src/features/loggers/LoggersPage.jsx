// Loggers (docs/design/ui.md, "Screens > Loggers"): which logger sits in which fridge, set once
// so uploads use it from then on; plus the branches and fridges they go in.

import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';
import button from '../../shared/ui/button.module.css';
import { Icon } from '../../shared/ui/Icon.jsx';
import { Skeleton } from '../../shared/ui/Skeleton.jsx';
import { StateBox } from '../../shared/ui/StateBox.jsx';
import { Toast, useToast } from '../../shared/ui/Toast.jsx';
import { useGetBranchesQuery, useGetLoggersQuery } from './loggersApi.js';
import { loggerRow, retriedNote, sortByCode } from './loggersModel.js';
import styles from './LoggersPage.module.css';

// The forms bring react-hook-form and Zod; load them only when one opens.
const forms = () => import('./RegistryForms.jsx');
const AddLoggerDialog = lazy(() => forms().then((m) => ({ default: m.AddLoggerDialog })));
const AddFridgeDialog = lazy(() => forms().then((m) => ({ default: m.AddFridgeDialog })));
const AddBranchDialog = lazy(() => forms().then((m) => ({ default: m.AddBranchDialog })));

export function LoggersPage() {
  const loggers = useGetLoggersQuery();
  const branches = useGetBranchesQuery();
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

  const list = sortByCode(loggers.data);

  return (
    <div className={styles.page}>
      <Head onAdd={() => setDialog({ kind: 'logger' })} />

      <section className={styles.section} aria-labelledby="logger-list">
        <h2 id="logger-list">
          {list.length} {list.length === 1 ? 'logger' : 'loggers'}
        </h2>
        {list.length === 0 ? (
          <p className={`${styles.card} ${styles.pad} muted`}>
            No loggers yet. Add one with the ID printed on it.
          </p>
        ) : (
          <ul className={styles.card}>
            {list.map((logger) => {
              const row = loggerRow(logger);
              return (
                <li key={logger.id}>
                  <Link to={`/loggers/${logger.id}`} className={styles.row}>
                    <span className={styles.code}>{logger.code}</span>
                    <span className={styles.where}>
                      <span className={logger.current ? undefined : 'muted'}>{row.where}</span>
                      <span className={`${styles.sub} num`}>{row.since}</span>
                    </span>
                    {row.tags.length > 0 && (
                      <span className={styles.tags}>
                        {row.tags.map((tag) => (
                          <span key={tag} className={styles.tag}>
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                    <Icon name="chevRight" className={styles.chevron} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="branch-list">
        <div className={styles.sectionHead}>
          <h2 id="branch-list">Branches and fridges</h2>
          <button
            type="button"
            className={`${button.button} ${button.link}`}
            onClick={() => setDialog({ kind: 'branch' })}
          >
            <Icon name="plus" size={16} />
            Add branch
          </button>
        </div>
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

function Head({ onAdd }) {
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
          Add logger
        </button>
      )}
    </div>
  );
}
