// Loading placeholder block in --sunken with a slow pulse (off with prefers-reduced-motion).

import styles from './Skeleton.module.css';

/** @param {{ width?: string | number, height: string | number, round?: boolean }} props */
export function Skeleton({ width = '100%', height, round = false }) {
  return (
    <div
      className={`${styles.block} ${round ? styles.round : ''}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
