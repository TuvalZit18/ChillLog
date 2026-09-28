// Native <dialog> (docs/design/ui.md, "Dialog"): showModal() gives focus trapping, Escape to
// close and a backdrop. A bottom sheet on phones, centred up to 520px on larger screens.
// Render it only while it should be open; it opens when it mounts.

import { useEffect, useRef } from 'react';
import styles from './Dialog.module.css';

/**
 * @param {{ titleId: string, onClose: () => void, children: React.ReactNode }} props
 *   titleId is the id of the dialog's heading, which names it for screen readers
 */
export function Dialog({ titleId, onClose, children }) {
  const ref = useRef(null);

  // No close() on cleanup: unmounting removes the open dialog from the page and its top layer,
  // and a close() here would fire "close" (and onClose) when StrictMode re-runs the effect.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      // Escape closes the native dialog; tell the owner so its state matches.
      onClose={onClose}
      // A click on the <dialog> itself (not its content) is a click on the backdrop.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className={styles.body}>
        <span className={styles.grab} aria-hidden="true" />
        {children}
      </div>
    </dialog>
  );
}

/** The dialog's buttons row: primary action on the right; full-width buttons on phones. */
export function DialogActions({ children }) {
  return <div className={styles.actions}>{children}</div>;
}
