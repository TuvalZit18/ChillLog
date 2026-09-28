// Status pill: soft background, strong color for icon and text, and always the words, so the
// status never depends on color alone (docs/design/ui.md, "Status system").

import { Icon } from '../ui/Icon.jsx';
import { STATUS_META } from './status.js';
import styles from './StatusPill.module.css';

/**
 * @param {{ status: keyof typeof STATUS_META, text?: string }} props
 *   text defaults to the status word; pass describeStatus(fridge) for the full "word · value"
 */
export function StatusPill({ status, text }) {
  const meta = STATUS_META[status];
  return (
    <span className={`${styles.pill} ${styles[status]}`}>
      <Icon name={meta.icon} size={16} className={styles.icon} />
      <span className="num">{text ?? meta.label}</span>
    </span>
  );
}
