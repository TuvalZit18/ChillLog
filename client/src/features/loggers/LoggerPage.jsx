// Logger detail (docs/design/ui.md, "Screens > Logger detail"): where the logger is, how its
// files are written, moving it, and every place it has been.

import { lazy, Suspense, useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatDate, formatDay } from '../../shared/format/format.js';
import { BackLink } from '../../shared/ui/BackLink.jsx';
import button from '../../shared/ui/button.module.css';
import { Skeleton } from '../../shared/ui/Skeleton.jsx';
import { StateBox } from '../../shared/ui/StateBox.jsx';
import { Toast, useToast } from '../../shared/ui/Toast.jsx';
import { useGetBranchesQuery, useGetLoggerQuery } from './loggersApi.js';
import { DATE_FORMAT_LABELS, historyItems, retriedNote, UNIT_LABELS } from './loggersModel.js';
import styles from './LoggerPage.module.css';

const forms = () => import('./RegistryForms.jsx');
const MoveLoggerDialog = lazy(() => forms().then((m) => ({ default: m.MoveLoggerDialog })));
const LoggerSettingsDialog = lazy(() => forms().then((m) => ({ default: m.LoggerSettingsDialog })));

export function LoggerPage() {
  const { id } = useParams();
  const { data: logger, error, isFetching, refetch } = useGetLoggerQuery(id);
  const { data: branches } = useGetBranchesQuery();
  /** 'move' · 'settings' · null */
  const [dialog, setDialog] = useState(null);
  const [toast, showToast] = useToast();
  const close = () => setDialog(null);

  // A different logger's data may still be cached while this one loads.
  if (!logger || String(logger.id) !== id) {
    if (error) return <LoggerError error={error} onRetry={refetch} retrying={isFetching} />;
    return (
      <div className={styles.page} role="status">
        <span className="visually-hidden">Loading the logger…</span>
        <Skeleton width={110} height={44} />
        <Skeleton width={160} height={30} />
        <Skeleton height={140} />
      </div>
    );
  }

  const { current } = logger;
  const history = historyItems(logger);

  return (
    <div className={styles.page}>
      <BackLink to="/loggers">Loggers</BackLink>

      <header className={styles.head}>
        <p className={styles.eyebrow}>Logger</p>
        {/* .mono on a span, so its 0.92em is of the heading's size, not the page's. */}
        <h1>
          <span className="mono">{logger.code}</span>
        </h1>
      </header>

      <dl className={styles.details}>
        <div>
          <dt>Current fridge</dt>
          <dd>{current ? `${current.branchName} · ${current.fridgeName}` : 'Not in a fridge'}</dd>
        </div>
        <div>
          <dt>In this fridge since</dt>
          <dd className="num">{current ? formatDay(current.fromUtc) : '–'}</dd>
        </div>
        <div>
          <dt>Unit in its files</dt>
          <dd>{UNIT_LABELS[logger.unit]}</dd>
        </div>
        <div>
          <dt>Date format in its files</dt>
          <dd>{DATE_FORMAT_LABELS[logger.dateFormat]}</dd>
        </div>
      </dl>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${button.button} ${button.primary}`}
          onClick={() => setDialog('move')}
          disabled={!branches}
        >
          {current ? 'Move to another fridge' : 'Put in a fridge'}
        </button>
        <button type="button" className={button.button} onClick={() => setDialog('settings')}>
          Change file settings
        </button>
        {current && (
          <Link to={`/fridges/${current.fridgeId}`} className={`${button.button} ${button.link}`}>
            Open fridge
          </Link>
        )}
      </div>

      <section className={styles.section} aria-labelledby="move-history">
        <h2 id="move-history">Move history</h2>
        <div className={styles.card}>
          {history.length === 0 ? (
            <p className="muted">Not placed in a fridge yet.</p>
          ) : (
            <ol className={styles.timeline}>
              {history.map((item) => (
                <li key={item.key} className={item.current ? styles.now : undefined}>
                  <span className={styles.where}>{item.where}</span>
                  <span className={styles.when}>{item.when}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <Suspense fallback={null}>
        {dialog === 'move' && branches && (
          <MoveLoggerDialog
            logger={logger}
            branches={branches}
            onClose={close}
            onMoved={(moved) => {
              close();
              const to = moved.current;
              showToast(
                `${moved.code} moved to ${to.branchName} · ${to.fridgeName} from ${formatDate(to.fromUtc)}.`,
              );
            }}
          />
        )}
        {dialog === 'settings' && (
          <LoggerSettingsDialog
            logger={logger}
            onClose={close}
            onSaved={(saved) => {
              close();
              showToast(['Settings saved.', retriedNote(saved.retried)].filter(Boolean).join(' '));
            }}
          />
        )}
      </Suspense>

      <Toast message={toast} />
    </div>
  );
}

function LoggerError({ error, onRetry, retrying }) {
  const notFound = error.status === 404 || error.status === 400;
  return (
    <div className={styles.page}>
      <BackLink to="/loggers">Loggers</BackLink>
      {notFound ? (
        <StateBox
          icon="info"
          tone="muted"
          title="Logger not found"
          action={
            <Link to="/loggers" className={`${button.button} ${button.primary}`}>
              See all loggers
            </Link>
          }
        >
          This logger isn't in ChillLog. The link may be wrong.
        </StateBox>
      ) : (
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
          Check your connection, then try again. Nothing you uploaded is lost.
        </StateBox>
      )}
    </div>
  );
}
