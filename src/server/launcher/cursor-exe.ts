import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Resolve path to Cursor / VS Code-based app for `--remote-debugging-port`.
 * Override with env `CURSOR_PATH` or `CURSOR_EXECUTABLE`.
 */
export function resolveCursorExecutable(): string | null {
  const fromEnv = process.env.CURSOR_PATH ?? process.env.CURSOR_EXECUTABLE;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA;
    if (local) {
      const p = join(local, 'Programs', 'cursor', 'Cursor.exe');
      if (existsSync(p)) return p;
    }
    const p86 = process.env['ProgramFiles(x86)'];
    if (p86) {
      const p = join(p86, 'Cursor', 'Cursor.exe');
      if (existsSync(p)) return p;
    }
  }

  if (process.platform === 'darwin') {
    const p = '/Applications/Cursor.app/Contents/MacOS/Cursor';
    if (existsSync(p)) return p;
  }

  if (process.platform === 'linux') {
    const candidates = ['/usr/share/cursor/cursor', '/opt/Cursor/cursor', '/usr/bin/cursor'];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
  }

  return null;
}
