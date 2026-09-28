// Chip for filters and date ranges: a 44px pill; the selected one is aria-pressed with a ring.

import styles from './Chip.module.css';

/** @param {{ pressed: boolean, onClick: () => void, children: React.ReactNode }} props */
export function Chip({ pressed, onClick, children }) {
  return (
    <button type="button" className={styles.chip} aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

/** A row of chips that wraps; label names the group for screen readers. */
export function ChipGroup({ label, children }) {
  return (
    <div className={styles.group} role="group" aria-label={label}>
      {children}
    </div>
  );
}
