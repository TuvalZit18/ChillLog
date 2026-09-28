import { RegistryError } from '../registry/registry.js';
import { IngestError } from '../ingest/ingest.js';

/** An error whose message is safe and useful to show Summer as-is. */
export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {{ path: string, message: string }[]} [issues] per-field problems, for forms
   */
  constructor(status, message, issues) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.issues = issues;
  }
}

/**
 * Parses `data` with a shared Zod schema, or throws a 400 listing what needs fixing.
 * @template T
 * @param {import('zod').ZodType<T>} schema
 * @param {unknown} data
 * @returns {T}
 */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw new HttpError(
    400,
    'Some fields need fixing.',
    result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  );
}

// Domain error codes → HTTP status. Codes not listed here are server faults (500).
const STATUS_BY_CODE = {
  not_found: 404,
  duplicate: 409,
  invalid_move: 409,
  already_processed: 409,
};

/**
 * The one place errors become responses. Express 5 routes thrown and rejected errors here.
 * It must keep four parameters: that's how Express tells an error handler apart.
 */
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, issues: err.issues });
  }
  if ((err instanceof RegistryError || err instanceof IngestError) && STATUS_BY_CODE[err.code]) {
    return res.status(STATUS_BY_CODE[err.code]).json({ error: err.message, code: err.code });
  }
  // Body-parser errors (bad JSON, body too large) carry their own 4xx status.
  if (err.expose && err.status >= 400 && err.status < 500) {
    const message =
      err.type === 'entity.parse.failed' ? 'The request body is not valid JSON.' : err.message;
    return res.status(err.status).json({ error: message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
}
