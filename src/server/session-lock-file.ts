import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const LOCK_NAME = 'session.lock';

export interface SessionLockPayload {
  version?: number;
  cursorPid?: number | null;
  [key: string]: unknown;
}

export function sessionLockPath(dataDir: string): string {
  return join(dataDir, LOCK_NAME);
}

export function readSessionLock(dataDir: string): SessionLockPayload | null {
  const p = sessionLockPath(dataDir);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as SessionLockPayload;
  } catch {
    return null;
  }
}

/** Clear recorded Cursor PID after quit (launcher + relay stay in sync). */
export function clearCursorPidInSessionLock(dataDir: string): void {
  const p = sessionLockPath(dataDir);
  if (!existsSync(p)) return;
  try {
    const j = JSON.parse(readFileSync(p, 'utf-8')) as SessionLockPayload;
    j.cursorPid = null;
    writeFileSync(p, JSON.stringify(j, null, 2), 'utf-8');
  } catch {
    /* ignore */
  }
}

export function hasCursorPidInSessionLock(dataDir: string): boolean {
  const lock = readSessionLock(dataDir);
  const pid = lock?.cursorPid;
  return typeof pid === 'number' && pid > 0;
}
