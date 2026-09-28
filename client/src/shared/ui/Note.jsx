// A quiet explanatory line with an icon, e.g. the door-opening and logger-history notes.

import { Icon } from './Icon.jsx';
import styles from './Note.module.css';

/** @param {{ icon: string, children: React.ReactNode }} props */
export function Note({ icon, children }) {
  return (
    <p className={styles.note}>
      <Icon name={icon} size={16} className={styles.icon} />
      <span>{children}</span>
    </p>
  );
}
