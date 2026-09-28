// Status pill: soft background, strong color for icon and text, and always the words, so the
// status never depends on color alone (docs/design/ui.md, "Status system").

import { Icon } from '../ui/Icon.jsx';
import { STATUS_META } from './status.js';
import styles from './StatusPill.module.css';

/**
 * @param {{ status: keyof typeof STATUS_META, text?: string, quiet?: boolean }} props
 *   text defaults to the status word; pass describeStatus(fridge) for the full "word · value".
 *   quiet: no filled background and muted text (the icon keeps its color), for rows where
 *   OK is the norm and only problems should stand out.
 */
export function StatusPill({ status, text, quiet = false }) {
  const meta = STATUS_META[status];
  return (
    <span className={`${styles.pill} ${styles[status]} ${quiet ? styles.quiet : ''}`}>
      <Icon name={meta.icon} size={16} className={styles.icon} />
      <span className="num">{text ?? meta.label}</span>
    </span>
  );
}
