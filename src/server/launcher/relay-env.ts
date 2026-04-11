import { copyFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { dataRoot } from './workspace-lock.js';

/** Ensure session folder has license.key by copying from repo `data/license.key` if missing. */
export function ensureSessionLicenseFromRoot(cwd: string, sessionDataAbs: string): void {
  const dest = join(sessionDataAbs, 'license.key');
  if (existsSync(dest)) return;
  const rootLic = join(dataRoot(cwd), 'license.key');
  if (existsSync(rootLic)) {
    try {
      copyFileSync(rootLic, dest);
    } catch {
      /* ignore */
    }
  }
}

/** True if session dir has a readable license.key (after optional copy from root). */
export function sessionHasLicenseFile(sessionDataAbs: string): boolean {
  const p = join(sessionDataAbs, 'license.key');
  if (!existsSync(p)) return false;
  try {
    const raw = readFileSync(p, 'utf-8').trim();
    return raw.length > 0;
  } catch {
    return false;
  }
}
