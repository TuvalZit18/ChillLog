import path from 'node:path';

const serverRoot = path.resolve(import.meta.dirname, '..');

/**
 * Runtime configuration from environment variables, with defaults that work on a fresh clone.
 * @typedef {{ port: number, host: string, dataDir: string, clientDist: string }} Config
 * @returns {Config}
 */
export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 3000,
    // Localhost by default; HOST=0.0.0.0 exposes the app on the LAN (unauthenticated).
    host: env.HOST || '127.0.0.1',
    dataDir: env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(serverRoot, 'data'),
    clientDist: path.resolve(serverRoot, '..', 'client', 'dist'),
  };
}
