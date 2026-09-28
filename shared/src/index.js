// Shared between server and client. Schemas and thresholds are added by their feature branches.

/** Loggers record Israel local time; the UI always shows times in it too. */
export const TIME_ZONE = 'Asia/Jerusalem';

export { THRESHOLDS } from './thresholds.js';
export * from './schemas.js';
