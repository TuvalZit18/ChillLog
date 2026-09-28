// Upload limits, shared so the client can warn before sending (a courtesy on a weak signal)
// while the server enforces the same numbers (the authority).

export const UPLOAD_LIMITS = Object.freeze({
  /** A week of 15-minute readings is about 20 KB; 5 MB leaves room for any logger's format. */
  maxFileBytes: 5 * 1024 * 1024,
  /** 12 branches with a few fridges each is about 40 files a week. */
  maxFiles: 50,
  extensions: Object.freeze(['.csv', '.txt', '.tsv']),
});

/** @param {string} fileName */
export function hasUploadExtension(fileName) {
  const lower = fileName.toLowerCase();
  return UPLOAD_LIMITS.extensions.some((ext) => lower.endsWith(ext));
}
