import {
  existsSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from 'fs';
import { homedir } from 'os';
import { dirname, join, normalize, resolve } from 'path';

/** Absolute path to the main Cursor user-data directory (login, settings, extensions). */
const ENV_GLOBAL_OVERRIDE = 'CURSOR_GLOBAL_USER_DATA_DIR';
/** Set to `1` / `true` to use an empty per-workspace folder instead of linking to global (e.g. probes, debugging). */
const ENV_ISOLATED = 'CURSOR_REMOTE_PROFILE_ISOLATED';

export function getGlobalCursorUserDataDir(): string {
  const override = process.env[ENV_GLOBAL_OVERRIDE]?.trim();
  if (override) {
    return resolve(override);
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) {
      return resolve(join(appData, 'Cursor'));
    }
  } else if (process.platform === 'darwin') {
    return resolve(join(homedir(), 'Library', 'Application Support', 'Cursor'));
  }
  return resolve(join(homedir(), '.config', 'Cursor'));
}

export function isIsolatedProfileForced(): boolean {
  const v = process.env[ENV_ISOLATED]?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function resolveLinkTarget(linkPath: string): string {
  const raw = readlinkSync(linkPath);
  return resolve(dirname(linkPath), raw);
}

function samePath(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

/**
 * Ensures `profileAbs` (…/workspace/.cursor-remote-profile) reuses the global Cursor profile:
 * Windows: NTFS **junction** to the global user-data dir; macOS/Linux: directory symlink.
 * Falls back to a normal empty directory if isolated mode is set, global path is missing, or the
 * existing path is a non-empty real directory (user data preserved; not replaced).
 */
export function ensureSessionProfileLinkedToGlobal(profileAbs: string): void {
  if (isIsolatedProfileForced()) {
    mkdirSync(profileAbs, { recursive: true });
    return;
  }

  const globalAbs = getGlobalCursorUserDataDir();
  if (!existsSync(globalAbs)) {
    mkdirSync(profileAbs, { recursive: true });
    return;
  }

  const target = resolve(globalAbs);

  if (existsSync(profileAbs)) {
    try {
      const linked = resolveLinkTarget(profileAbs);
      if (samePath(linked, target)) {
        return;
      }
      unlinkSync(profileAbs);
    } catch {
      const children = readdirSync(profileAbs);
      if (children.length === 0) {
        rmSync(profileAbs, { recursive: true });
      } else {
        console.warn(
          `[cursor-remote] ${profileAbs} is a non-empty directory; not replacing with link to global profile. ` +
            `Remove it to use your main Cursor login, or set ${ENV_ISOLATED}=1 for an isolated profile.`
        );
        return;
      }
    }
  }

  const parent = dirname(profileAbs);
  mkdirSync(parent, { recursive: true });

  if (process.platform === 'win32') {
    symlinkSync(target, profileAbs, 'junction');
  } else {
    symlinkSync(target, profileAbs, 'dir');
  }
}
