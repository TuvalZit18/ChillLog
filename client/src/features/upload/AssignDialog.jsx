// "Which logger is this file from?" (docs/design/ui.md, "Assign logger"): the file's first rows
// as written, a logger select, then Assign and process. The stored copy is used; no re-upload.
// react-hook-form + the shared Zod schema, so the form checks the same rule as the server.

import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assignInput } from '@chilllog/shared';
import button from '../../shared/ui/button.module.css';
import { Dialog, DialogActions } from '../../shared/ui/Dialog.jsx';
import field from '../../shared/ui/field.module.css';
import { Skeleton } from '../../shared/ui/Skeleton.jsx';
import { useAssignUploadMutation, useGetUploadPreviewQuery } from './uploadApi.js';
import { assignIntro, loggerOptions } from './uploadModel.js';
import styles from './AssignDialog.module.css';

/**
 * @param {{ report: object, loggers: object[], onClose: () => void,
 *   onAssigned: (report: object) => void }} props
 */
export function AssignDialog({ report, loggers, onClose, onAssigned }) {
  const titleId = useId();
  const { data: preview, isError: previewFailed } = useGetUploadPreviewQuery(report.uploadId);
  const [assignUpload] = useAssignUploadMutation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(assignInput), defaultValues: { loggerId: '' } });

  async function submit({ loggerId }) {
    try {
      onAssigned(await assignUpload({ uploadId: report.uploadId, loggerId }).unwrap());
    } catch (error) {
      setError('root', {
        message:
          error.data?.error ?? "Couldn't process the file. Check your connection, then try again.",
      });
    }
  }

  return (
    <Dialog titleId={titleId} onClose={onClose}>
      <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
        <div className={styles.intro}>
          <h2 id={titleId}>Which logger is this file from?</h2>
          <p className="small muted">{assignIntro(report)}</p>
        </div>

        <p className={styles.file}>{report.fileName}</p>

        {previewFailed ? (
          <p className="small muted">Couldn't show the first rows of the file.</p>
        ) : !preview ? (
          <Skeleton height={120} />
        ) : (
          <table className={styles.preview}>
            <thead>
              <tr>
                <th scope="col">Time in file</th>
                <th scope="col">Temperature</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, i) => (
                <tr key={i}>
                  <td>{row.time}</td>
                  <td>{row.temp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className={field.field}>
          <label htmlFor="assign-logger">Logger</label>
          <select
            id="assign-logger"
            aria-invalid={errors.loggerId ? true : undefined}
            aria-describedby={errors.loggerId ? 'assign-logger-error' : undefined}
            {...register('loggerId')}
          >
            <option value="">Choose a logger</option>
            {loggerOptions(loggers).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.loggerId && (
            <p id="assign-logger-error" className={field.error}>
              Choose the logger this file is from.
            </p>
          )}
        </div>

        {errors.root && (
          <p className={field.error} role="alert">
            {errors.root.message}
          </p>
        )}

        <DialogActions>
          <button type="button" className={button.button} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className={`${button.button} ${button.primary}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing…' : 'Assign and process'}
          </button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
