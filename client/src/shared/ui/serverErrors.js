// Puts an API error onto a react-hook-form form: field problems ("issues", from the server's
// Zod check) next to their fields, anything else (e.g. "A logger called TL-0417 already exists")
// above the buttons. The server checks the same shared schemas, so field names match.

const OFFLINE = "Couldn't save. Check your connection, then try again.";

/**
 * @param {{ data?: { error?: string, issues?: { path: string, message: string }[] } }} error
 *   an RTK Query error
 * @param {(name: string, error: { message: string }) => void} setError from useForm
 * @param {string[]} fields the form's field names
 */
export function applyServerError(error, setError, fields) {
  const issues = (error.data?.issues ?? []).filter((issue) => fields.includes(issue.path));
  for (const issue of issues) setError(issue.path, { message: issue.message });
  if (issues.length === 0) setError('root', { message: error.data?.error ?? OFFLINE });
}
