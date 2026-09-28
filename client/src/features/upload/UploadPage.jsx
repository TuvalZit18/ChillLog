// Upload (docs/design/ui.md, "Screens > Upload"): choose or drop the week's logger files, then
// see one card per file saying what happened and what, if anything, needs Summer.

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { formatDateTime } from '../../shared/format/format.js';
import button from '../../shared/ui/button.module.css';
import { Skeleton } from '../../shared/ui/Skeleton.jsx';
import { useGetLoggersQuery } from '../loggers/loggersApi.js';
import { DropZone } from './DropZone.jsx';
import { FileCard } from './FileCard.jsx';
import { useGetUploadsQuery, useRetryUploadMutation, useUploadFilesMutation } from './uploadApi.js';
import { checkFiles, summarize, summaryLine, waitingUploads } from './uploadModel.js';
import styles from './UploadPage.module.css';

const OFFLINE = "Couldn't upload. Check your connection, then try again. Nothing was lost.";

export function UploadPage() {
  const { data: uploads } = useGetUploadsQuery();
  const { data: loggerList } = useGetLoggersQuery();
  const loggers = useMemo(() => new Map((loggerList ?? []).map((l) => [l.id, l])), [loggerList]);
  const [uploadFiles] = useUploadFilesMutation();
  const [retryUpload] = useRetryUploadMutation();

  /** idle · working { count } · done { files, atUtc } · problem { message } */
  const [stage, setStage] = useState({ kind: 'idle' });
  const [retrying, setRetrying] = useState(null);
  const [retryErrors, setRetryErrors] = useState({});

  async function send(files) {
    const problem = checkFiles(files);
    if (problem) {
      setStage({ kind: 'problem', message: problem });
      return;
    }
    setStage({ kind: 'working', count: files.length });
    try {
      const result = await uploadFiles(files).unwrap();
      setStage({ kind: 'done', files: result.files, atUtc: new Date().toISOString() });
    } catch (error) {
      setStage({ kind: 'problem', message: error.data?.error ?? OFFLINE });
    }
  }

  /** Put a file's new report in place of its old one (after "Try again" or choosing a logger). */
  function replaceReport(report) {
    setStage((current) =>
      current.kind === 'done'
        ? {
            ...current,
            files: current.files.map((f) => (f.uploadId === report.uploadId ? report : f)),
          }
        : current,
    );
  }

  async function retry(uploadId) {
    setRetrying(uploadId);
    setRetryErrors((errors) => ({ ...errors, [uploadId]: undefined }));
    try {
      replaceReport(await retryUpload(uploadId).unwrap());
    } catch (error) {
      setRetryErrors((errors) => ({
        ...errors,
        [uploadId]: error.data?.error ?? "Couldn't try again. Check your connection.",
      }));
    } finally {
      setRetrying(null);
    }
  }

  const cardProps = (report) => ({
    report,
    loggers,
    onRetry: retry,
    retrying: retrying === report.uploadId,
    retryError: retryErrors[report.uploadId],
  });

  // Files from earlier uploads that still need Summer, minus any shown in this batch.
  const shownIds = new Set(stage.kind === 'done' ? stage.files.map((f) => f.uploadId) : []);
  const waiting = waitingUploads(uploads?.uploads ?? []).filter((u) => !shownIds.has(u.uploadId));

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>Upload logger files</h1>
        <p className="small muted num">
          {uploads?.lastUploadUtc
            ? `Last upload ${formatDateTime(uploads.lastUploadUtc)}`
            : 'Nothing uploaded yet'}
        </p>
      </div>

      {stage.kind === 'problem' && (
        <p className={styles.problem} role="alert">
          {stage.message}
        </p>
      )}

      {(stage.kind === 'idle' || stage.kind === 'problem') && <DropZone onFiles={send} />}

      {stage.kind === 'working' && (
        <div className={styles.working} role="status">
          <Skeleton width={64} height={64} round />
          <h2>
            Reading {stage.count} {stage.count === 1 ? 'file' : 'files'}…
          </h2>
          <p className="muted">Checking dates, units and duplicates.</p>
        </div>
      )}

      {stage.kind === 'done' && (
        <section className={styles.section} aria-labelledby="upload-result">
          <div className={styles.summary}>
            <h2 id="upload-result" className={styles.summaryLine}>
              {summaryLine(summarize(stage.files))}
            </h2>
            <p className="small muted">Uploaded {formatDateTime(stage.atUtc)}</p>
          </div>
          <div className={styles.cards}>
            {stage.files.map((report, i) => (
              <FileCard key={report.uploadId ?? `rejected-${i}`} {...cardProps(report)} />
            ))}
          </div>
          <div className={styles.row}>
            <button
              type="button"
              className={button.button}
              onClick={() => setStage({ kind: 'idle' })}
            >
              Upload more files
            </button>
            <Link to="/" className={`${button.button} ${button.link}`}>
              See the overview
            </Link>
          </div>
        </section>
      )}

      {waiting.length > 0 && stage.kind !== 'working' && (
        <section className={styles.section} aria-labelledby="waiting">
          <h2 id="waiting">Waiting from earlier uploads</h2>
          <div className={styles.cards}>
            {waiting.map((report) => (
              <FileCard key={report.uploadId} {...cardProps(report)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
