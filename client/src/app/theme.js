// Theme choice: System (follow the device), Light or Dark (docs/design/ui.md, "Theme").
// System = no attribute on <html>; Light/Dark = data-theme on <html>. The tiny script in
// index.html applies the saved choice before the app loads, so the page never flashes.

const STORAGE_KEY = 'chilllog.theme';

/** @typedef {'system' | 'light' | 'dark'} Theme */

/** @returns {Theme} */
export function readTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

/** @param {Theme} theme */
export function saveTheme(theme) {
  try {
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage is off (private mode, blocked site data): the choice lasts until the page closes.
  }
}

/** @param {Theme} theme */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}
