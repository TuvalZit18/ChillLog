// "← Overview" / "← Loggers" at the top of a detail page (docs/design/ui.md, "App shell").

import { Link } from 'react-router';
import { Icon } from './Icon.jsx';
import styles from './BackLink.module.css';

/** @param {{ to: string, children: React.ReactNode }} props */
export function BackLink({ to, children }) {
  return (
    <Link to={to} className={styles.back}>
      <Icon name="back" />
      {children}
    </Link>
  );
}
