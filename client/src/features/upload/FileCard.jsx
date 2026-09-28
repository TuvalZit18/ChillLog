// One uploaded file's result (docs/design/ui.md, "Upload file card"): round status icon, word,
// file name, where it belongs, what happened, and the one action that helps, if any.

import { Link } from 'react-router';
import button from '../../shared/ui/button.module.css';
import { Icon } from '../../shared/ui/Icon.jsx';
import { fileKind, fileLines, fileWhere } from './uploadModel.js';
import styles from './FileCard.module.css';

const KINDS = {
  added: { word: 'Added', icon: 'ok' },
  notes: { word: 'Added, with notes', icon: 'info' },
  duplicate: { word: 'Already uploaded', icon: 'dup' },
  held: { word: 'Held back', icon: 'alert' },
  help: { word: 'Needs your help', icon: 'help' },
  rejected: { word: 'Not uploaded', icon: 'nofile' },
};

/**
 * @param {{ report: object, loggers: Map<number, object>,
 *   onRetry: (uploadId: number) => void, retrying: boolean, retryError?: string,
 *   onChooseLogger?: (report: object) => void }} props
 */
export function FileCard({ report, loggers, onRetry, retrying, retryError, onChooseLogger }) {
  const kind = fileKind(report);
  const { word, icon } = KINDS[kind];
  const fridgeId = loggers.get(report.loggerId)?.current?.fridgeId;
  const where = fileWhere(report, loggers);

  return (
    <article className={`${styles.card} ${styles[kind]}`}>
      <span className={styles.icon}>
        <Icon name={icon} size={20} />
      </span>
      <div className={styles.body}>
        <span className={styles.word}>{word}</span>
        <span className={styles.file}>{report.fileName}</span>
        {where && <span className="small muted">{where}</span>}
        <ul className={styles.lines}>
          {fileLines(report).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {retryError && (
          <p className={styles.error} role="alert">
            {retryError}
          </p>
        )}

        {(kind === 'added' || kind === 'notes') && fridgeId && (
          <Link to={`/fridges/${fridgeId}`} className={`${button.button} ${styles.action}`}>
            Open fridge
          </Link>
        )}
        {kind === 'held' && (
          <div className={styles.actions}>
            {report.loggerId && (
              <Link to={`/loggers/${report.loggerId}`} className={button.button}>
                Open logger settings
              </Link>
            )}
            <button
              type="button"
              className={button.button}
              onClick={() => onRetry(report.uploadId)}
              disabled={retrying}
            >
              {retrying ? 'Trying again…' : 'Try again'}
            </button>
          </div>
        )}
        {kind === 'help' && onChooseLogger && (
          <button
            type="button"
            className={`${button.button} ${button.primary} ${styles.action}`}
            onClick={() => onChooseLogger(report)}
          >
            Choose logger
          </button>
        )}
      </div>
    </article>
  );
}
