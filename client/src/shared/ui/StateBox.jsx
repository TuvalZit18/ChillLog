// Full-width message card for empty and error states (docs/design/ui.md, "States").

import { Icon } from './Icon.jsx';
import styles from './StateBox.module.css';

/**
 * @param {{ icon: string, title: string, children: React.ReactNode, action?: React.ReactNode,
 *   tone?: 'accent' | 'muted' }} props
 */
export function StateBox({ icon, title, children, action, tone = 'accent' }) {
  return (
    <div className={`${styles.box} ${styles[tone]}`}>
      <div className={styles.icon}>
        <Icon name={icon} size={30} />
      </div>
      <h2>{title}</h2>
      <p className={styles.text}>{children}</p>
      {action}
    </div>
  );
}
