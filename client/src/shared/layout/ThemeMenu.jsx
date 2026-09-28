// Theme button in the top bar. A native popover (closes on outside tap and Escape, returns focus
// to the button) holding three plain buttons; the current choice is pressed and checked.

import { useId, useRef, useState } from 'react';
import { applyTheme, readTheme, saveTheme } from '../../app/theme.js';
import { Icon } from '../ui/Icon.jsx';
import styles from './ThemeMenu.module.css';

const OPTIONS = [
  { value: 'system', label: 'System', icon: 'themeSystem' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

export function ThemeMenu() {
  const [theme, setTheme] = useState(readTheme);
  const menuId = useId();
  const menuRef = useRef(null);
  const current = OPTIONS.find((option) => option.value === theme);

  function choose(value) {
    setTheme(value);
    applyTheme(value);
    saveTheme(value);
    menuRef.current?.hidePopover();
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        popoverTarget={menuId}
        aria-label={`Theme: ${current.label}`}
      >
        <Icon name={current.icon} size={20} />
      </button>
      <div id={menuId} ref={menuRef} popover="auto" className={styles.menu}>
        <p className={styles.heading}>Theme</p>
        <ul className={styles.list}>
          {OPTIONS.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                className={styles.option}
                aria-pressed={theme === option.value}
                onClick={() => choose(option.value)}
              >
                <Icon name={option.icon} />
                <span className={styles.label}>{option.label}</span>
                {theme === option.value && <Icon name="check" className={styles.check} />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
