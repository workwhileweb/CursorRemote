/**
 * Manual check: spawn Cursor with isolated --user-data-dir + --remote-debugging-port,
 * poll http://127.0.0.1:<port>/json, then kill the process.
 *
 * Usage (from repo root):
 *   npx tsx scripts/probe-cursor-isolation.ts
 * Requires CURSOR_PATH to Cursor.exe (or uses default discovery via same logic as server).
 */
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildCursorLaunchArgs } from '../src/server/launcher/cursor-spawn.js';
import { resolveCursorExecutable } from '../src/server/launcher/cursor-exe.js';
import { waitForCdpJson } from '../src/server/launcher/workspace-lock.js';
import { findFreeTcpPort } from '../src/server/launcher/ports.js';
import { killProcessTree } from '../src/server/process-kill.js';

async function main(): Promise<void> {
  // Probe expects a disposable empty profile; do not junction to global %APPDATA%\Cursor.
  process.env.CURSOR_REMOTE_PROFILE_ISOLATED = '1';

  const exe = resolveCursorExecutable();
  if (!exe) {
    console.error('No Cursor executable. Set CURSOR_PATH.');
    process.exit(1);
  }
  const workspace = mkdtempSync(join(tmpdir(), 'cursor-remote-probe-'));
  const port = await findFreeTcpPort(9222);
  const args = buildCursorLaunchArgs(workspace, port);
  console.log('Spawn:', exe);
  console.log('Args:', args.join(' '));

  const child = spawn(exe, args, { detached: true, stdio: 'ignore' });
  child.unref();
  const pid = child.pid;
  console.log('PID:', pid);

  const ok = await waitForCdpJson(port, 60_000);
  if (ok) {
    console.log(`OK: CDP up on http://127.0.0.1:${port}/json`);
  } else {
    console.error('FAIL: CDP did not respond in time');
  }

  if (pid && pid > 0) {
    killProcessTree(pid);
  }
  try {
    rmSync(workspace, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
