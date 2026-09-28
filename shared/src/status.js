// A fridge's status for a week. The server decides it; the UI sorts and filters by the same order.

/** @typedef {'alert' | 'warming' | 'gap' | 'no_file' | 'ok'} Status */

/** Worst first. Lists are sorted in this order and the overview chips follow it. */
export const STATUS_ORDER = /** @type {const} */ (['alert', 'warming', 'gap', 'no_file', 'ok']);
