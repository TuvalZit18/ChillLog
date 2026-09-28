// App shell (docs/design/ui.md, "App shell"): top bar, then the 4 main tabs as a bottom bar on
// phones and a left sidebar from 880px. Only the main area scrolls.

import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Icon } from '../ui/Icon.jsx';
import { ThemeMenu } from './ThemeMenu.jsx';
import styles from './AppShell.module.css';

const TABS = [
  { to: '/', label: 'Overview', icon: 'navOverview', end: true },
  { to: '/upload', label: 'Upload', icon: 'navUpload' },
  { to: '/inspector', label: 'Inspector', icon: 'navInspector' },
  { to: '/loggers', label: 'Loggers', icon: 'navLoggers' },
];

export function AppShell() {
  const mainRef = useRef(null);
  const { pathname } = useLocation();

  // The main area is the scroller, not the window, so reset it by hand on each new screen.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className={styles.layout}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <Icon name="thermometer" size={22} />
          <span>ChillLog</span>
        </div>
        <ThemeMenu />
      </header>

      <nav className={styles.nav} aria-label="Main">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={styles.navItem}>
            <span className={styles.navIcon}>
              <Icon name={tab.icon} size={22} />
            </span>
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <main ref={mainRef} className={styles.main}>
        <div className={styles.view}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
