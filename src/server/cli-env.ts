/**
 * Apply CLI flags to `process.env` before `config.ts` loads `dotenv`.
 * Import this module first from `index.ts` (side effects only).
 *
 * Examples:
 *   --cdp-url=http://127.0.0.1:9223
 *   --data-dir=./data/calm-ocean
 *   --server-port=3001
 *   --server-host=127.0.0.1
 */
import { resolve } from 'path';

function apply(): void {
  for (const arg of process.argv.slice(2)) {
    if (arg === '--help' || arg === '-h') {
      console.log(`
CursorRemote server — optional flags (override .env):

  --cdp-url=<url>        CDP endpoint (default http://127.0.0.1:9222)
  --data-dir=<path>      DATA_DIR — license, telegram state, session data
  --server-port=<n>      Web + socket.io port (default 3000)
  --server-host=<addr>   Bind address (default 127.0.0.1)

Example (launcher / multi-session):
  tsx src/server/index.ts --cdp-url=http://127.0.0.1:9224 --data-dir=./data/quiet-bread
`);
      process.exit(0);
    }
    const m = /^--([\w-]+)=(.*)$/.exec(arg);
    if (!m) continue;
    const key = m[1];
    const val = m[2];
    if (!val.length && key !== 'data-dir') continue;

    switch (key) {
      case 'cdp-url':
        process.env.CDP_URL = val;
        break;
      case 'data-dir':
        process.env.DATA_DIR = resolve(val);
        break;
      case 'server-port':
        process.env.SERVER_PORT = val;
        break;
      case 'server-host':
        process.env.SERVER_HOST = val;
        break;
      default:
        break;
    }
  }
}

apply();
