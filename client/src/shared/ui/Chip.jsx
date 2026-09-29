// Chip for filters and date ranges: a 44px pill; the selected one is aria-pressed with a ring.

import styles from './Chip.module.css';

/**
 * @param {{ pressed: boolean, onClick: () => void, tone?: string, children: React.ReactNode }} props
 *   tone: a color (e.g. the chip's status color) for the border on hover; grey when not given
 */
export function Chip({ pressed, onClick, tone, children }) {
  return (
    <button
      type="button"
      className={styles.chip}
      style={tone ? { '--chip-tone': tone } : undefined}
      aria-pressed={pressed}
      onClick={onClick}
    >
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
