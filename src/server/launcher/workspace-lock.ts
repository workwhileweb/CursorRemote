import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { join, resolve } from 'path';

export const LOCK_BASENAME = 'session.lock';

export interface WorkspaceSessionLock {
  version: 1;
  name: string;
  cdpPort: number;
  cursorPid: number | null;
  relayPid: number | null;
  relayPort: number | null;
  /** When true, relay runs in-process (same Node as main); `relayPid` is null. */
  relayEmbedded?: boolean;
  createdAt: string;
}

export function dataRoot(cwd: string): string {
  return resolve(cwd, 'data');
}

export function sessionDir(cwd: string, name: string): string {
  return join(dataRoot(cwd), name);
}

export function lockPath(cwd: string, name: string): string {
  return join(sessionDir(cwd, name), LOCK_BASENAME);
}

export function readLock(cwd: string, name: string): WorkspaceSessionLock | null {
  const p = lockPath(cwd, name);
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, 'utf-8');
    const j = JSON.parse(raw) as WorkspaceSessionLock;
    if (j.version !== 1 || typeof j.cdpPort !== 'number') return null;
    return j;
  } catch {
    return null;
  }
}

export function writeLock(cwd: string, lock: WorkspaceSessionLock): void {
  const dir = sessionDir(cwd, lock.name);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, LOCK_BASENAME), JSON.stringify(lock, null, 2), 'utf-8');
}

export function removeLock(cwd: string, name: string): void {
  const p = lockPath(cwd, name);
  if (existsSync(p)) rmSync(p);
}

export function listSessionNames(cwd: string): string[] {
  const root = dataRoot(cwd);
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const ent of readdirSync(root, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith('.')) continue;
    if (existsSync(join(root, ent.name, LOCK_BASENAME))) out.push(ent.name);
  }
  return out.sort();
}

export function isPidAlive(pid: number): boolean {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function cdpJsonResponds(port: number, timeoutMs = 1500): Promise<boolean> {
  const url = `http://127.0.0.1:${port}/json`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) return false;
    const text = await r.text();
    return text.includes('webSocketDebuggerUrl') || text.startsWith('[');
  } catch {
    clearTimeout(t);
    return false;
  }
}

export type SessionHealth = 'active' | 'inactive' | 'invalid';

export interface SessionScanRow {
  name: string;
  lock: WorkspaceSessionLock;
  health: SessionHealth;
  healthDetail: string;
}

export async function scanSession(
  cwd: string,
  name: string,
  opts?: { isEmbeddedRelayRunning?: (n: string) => boolean }
): Promise<SessionScanRow | null> {
  const lock = readLock(cwd, name);
  if (!lock) return null;

  const pidRecorded = lock.cursorPid != null && lock.cursorPid > 0;
  const pidOk = pidRecorded ? isPidAlive(lock.cursorPid!) : false;
  const cdpOk = await cdpJsonResponds(lock.cdpPort);
  const embeddedOk =
    lock.relayEmbedded === true && opts?.isEmbeddedRelayRunning?.(name) === true;
  const relayOk =
    embeddedOk ||
    (lock.relayPid != null && lock.relayPid > 0 && isPidAlive(lock.relayPid));

  let health: SessionHealth;
  let detail: string;

  if (cdpOk) {
    health = 'active';
    detail = pidOk ? 'CDP up; Cursor PID alive' : 'CDP up; PID stale or unknown (safe to connect)';
  } else if (!pidOk) {
    health = 'inactive';
    detail = 'CDP down; Cursor not running';
  } else {
    health = 'invalid';
    detail =
      'PID alive but CDP /json failed — port mismatch or stuck process; kill PID or free port';
  }

  if (health === 'inactive' && relayOk) {
    detail += '. Relay process still running — use Stop relay';
  }

  return { name, lock, health, healthDetail: detail };
}

export function cleanupStaleLock(cwd: string, row: SessionScanRow): boolean {
  if (row.health !== 'inactive') return false;
  removeLock(cwd, row.name);
  return true;
}
