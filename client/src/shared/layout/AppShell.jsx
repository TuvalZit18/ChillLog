// App shell (docs/design/ui.md, "App shell"): top bar, then the 4 main tabs as a bottom bar on
// phones and a left sidebar from 880px. Only the main area scrolls.

import { useEffect, useRef } from 'react';
import { Link, matchPath, Outlet, useLocation } from 'react-router';
import { Icon } from '../ui/Icon.jsx';
import { ThemeMenu } from './ThemeMenu.jsx';
import styles from './AppShell.module.css';

// `paths` are the screens that belong to each tab: the fridge page sits under Overview.
const TABS = [
  { to: '/', label: 'Overview', icon: 'navOverview', paths: ['/', '/fridges/*'] },
  { to: '/upload', label: 'Upload', icon: 'navUpload', paths: ['/upload/*'] },
  { to: '/inspector', label: 'Inspector', icon: 'navInspector', paths: ['/inspector/*'] },
  // Setup: loggers, branches and fridges (the URL stays /loggers, where it opens).
  { to: '/loggers', label: 'Setup', icon: 'navSetup', paths: ['/loggers/*'] },
];

const isActive = (tab, pathname) => tab.paths.some((path) => matchPath(path, pathname));

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
          <Link
            key={tab.to}
            to={tab.to}
            className={styles.navItem}
            aria-current={isActive(tab, pathname) ? 'page' : undefined}
          >
            <span className={styles.navIcon}>
              <Icon name={tab.icon} size={22} />
            </span>
            {tab.label}
          </Link>
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
