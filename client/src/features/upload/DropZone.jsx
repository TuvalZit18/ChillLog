// "Choose files" area (docs/design/ui.md, "Upload"): a native file input, so phones open their
// own picker; on desktop the same area also takes dropped files.

import { useId, useState } from 'react';
import { UPLOAD_LIMITS } from '@chilllog/shared';
import button from '../../shared/ui/button.module.css';
import { Icon } from '../../shared/ui/Icon.jsx';
import styles from './DropZone.module.css';

const ACCEPT = [...UPLOAD_LIMITS.extensions, 'text/csv', 'text/plain'].join(',');

/** @param {{ onFiles: (files: File[]) => void }} props */
export function DropZone({ onFiles }) {
  const [over, setOver] = useState(false);
  const inputId = useId();

  return (
    <label
      htmlFor={inputId}
      className={`${styles.drop} ${over ? styles.over : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles([...e.dataTransfer.files]);
      }}
    >
      <span className={styles.icon}>
        <Icon name="upload" size={28} />
      </span>
      <span className={styles.wideOnly}>Drop CSV files here</span>
      <span className={`${button.button} ${button.primary}`} aria-hidden="true">
        Choose files
      </span>
      <span className="small muted">CSV files from the loggers. You can pick many at once.</span>
      <input
        id={inputId}
        type="file"
        multiple
        accept={ACCEPT}
        aria-label="Choose logger files to upload"
        className="visually-hidden"
        onChange={(e) => {
          onFiles([...e.target.files]);
          e.target.value = ''; // so choosing the same file again still counts as a change
        }}
      />
    </label>
  );
}
