/**
 * Legacy entry: session manager now lives in the relay web UI (/ → Sessions button, or /launcher).
 * This script opens the default browser to the relay (port from SERVER_PORT or 3000).
 */
import { spawn } from 'child_process';

const port = process.env.SERVER_PORT?.trim() || '3000';
const url = `http://127.0.0.1:${port}/?openLauncher=1`;

console.log('[launcher] Session manager is in the web UI (Sessions button or /launcher).');
console.log(`[launcher] Opening: ${url}`);

try {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
} catch (e) {
  console.warn('[launcher] Could not open browser:', e);
}
