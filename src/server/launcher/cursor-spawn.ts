import { join } from 'path';

import { ensureSessionProfileLinkedToGlobal } from './cursor-user-profile.js';

const PROFILE_DIRNAME = '.cursor-remote-profile';

/**
 * Per-session profile path passed to `--user-data-dir`. By default this is a **junction** (Windows)
 * or directory **symlink** to your main Cursor user-data directory so login and settings match;
 * set `CURSOR_REMOTE_PROFILE_ISOLATED=1` for an empty folder instead.
 * A distinct path per workspace still helps avoid single-instancing into an unrelated session.
 *
 * @see https://code.visualstudio.com/docs/editor/command-line#_advanced-options
 */
export function getSessionProfileDir(workspaceAbs: string): string {
  return join(workspaceAbs, PROFILE_DIRNAME);
}

/**
 * CLI args for Cursor: profile link (or isolated dir) + CDP + workspace folder (last).
 */
export function buildCursorLaunchArgs(workspaceAbs: string, cdpPort: number): string[] {
  const profileDir = getSessionProfileDir(workspaceAbs);
  ensureSessionProfileLinkedToGlobal(profileDir);
  return [`--user-data-dir=${profileDir}`, `--remote-debugging-port=${cdpPort}`, workspaceAbs];
}
