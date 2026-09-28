// Toast (docs/design/ui.md, "Components"): a plain sentence in a dark pill near the bottom,
// above the tab bar, gone after about 3 seconds. role="status" so screen readers announce it.

import { useCallback, useEffect, useState } from 'react';
import styles from './Toast.module.css';

const SHOW_MS = 3200;

/** @returns {[string | null, (message: string) => void]} the message and a function to show one */
export function useToast() {
  const [message, setMessage] = useState(null);
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [message]);
  return [message, useCallback((text) => setMessage(text), [])];
}

/** @param {{ message: string | null }} props */
export function Toast({ message }) {
  return (
    <div className={styles.region} role="status">
      {message && <p className={styles.toast}>{message}</p>}
    </div>
  );
}
