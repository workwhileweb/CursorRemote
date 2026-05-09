import { spawn } from 'child_process';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import express, { type Application, type Request } from 'express';
import { randomSessionSlug } from './wordlist.js';
import { findFreeTcpPort } from './ports.js';
import { buildCursorLaunchArgs } from './cursor-spawn.js';
import { resolveCursorExecutable } from './cursor-exe.js';
import {
  cleanupStaleLock,
  cdpJsonResponds,
  isPidAlive,
  listSessionNames,
  readLock,
  removeLock,
  scanSession,
  sessionDir,
  waitForCdpJson,
  writeLock,
  type WorkspaceSessionLock,
} from './workspace-lock.js';
import { ensureSessionLicenseFromRoot, sessionHasLicenseFile } from './relay-env.js';
import { killProcessTree } from '../process-kill.js';

const NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

type SessionRelayResult =
  | { ok: true; path: string; url: string; already?: boolean }
  | { ok: false; status: number; error: string };

function relayOpenUrls(req: Pick<Request, 'protocol' | 'get'>, name: string): {
  path: string;
  url: string;
} {
  const host = req.get('host') || '127.0.0.1';
  const base = `${req.protocol}://${host}`;
  const path = `/s/${name}/`;
  return { path, url: `${base}${path.replace(/\/$/, '')}/` };
}

/**
 * Ensure session dir exists, tear down old embedded relay + Cursor from lock,
 * spawn Cursor on a fresh CDP port, start embedded relay, update lock.
 * If relay is already running and CDP responds, returns immediately (open-only).
 */
async function runSessionRelay(
  cwd: string,
  name: string,
  req: Pick<Request, 'protocol' | 'get'>
): Promise<SessionRelayResult> {
  const dataDirAbs = sessionDir(cwd, name);
  mkdirSync(dataDirAbs, { recursive: true });

  const {
    isEmbeddedRelayRunning,
    startEmbeddedRelaySession,
    stopEmbeddedRelaySession,
  } = await import('../embedded-relay.js');

  const prevLock = readLock(cwd, name);
  if (prevLock?.relayEmbedded === true && isEmbeddedRelayRunning(name)) {
    if (await cdpJsonResponds(prevLock.cdpPort)) {
      const { path, url } = relayOpenUrls(req, name);
      console.log(`[launcher] Session "${name}" relay already up — opening UI only`);
      return { ok: true, path, url, already: true };
    }
    console.warn(`[launcher] Session "${name}" embedded relay up but CDP dead — restarting`);
    await stopEmbeddedRelaySession(name);
  }

  if (prevLock?.cursorPid != null && prevLock.cursorPid > 0 && isPidAlive(prevLock.cursorPid)) {
    console.warn(`[launcher] Stopping previous Cursor for session "${name}" (PID ${prevLock.cursorPid})`);
    killProcessTree(prevLock.cursorPid);
  }

  ensureSessionLicenseFromRoot(cwd, dataDirAbs);
  if (!sessionHasLicenseFile(dataDirAbs)) {
    return {
      ok: false,
      status: 400,
      error:
        'No license for this session. Create data/license.key at the project root (same as npm run dev), then try again — it will be copied into the session folder.',
    };
  }

  const exe = resolveCursorExecutable();
  if (!exe) {
    return {
      ok: false,
      status: 500,
      error:
        'Cursor executable not found. Set CURSOR_PATH to Cursor.exe (Windows) or Cursor binary.',
    };
  }

  let cdpPort: number;
  try {
    cdpPort = await findFreeTcpPort(9222);
  } catch (e) {
    return { ok: false, status: 500, error: String(e) };
  }

  const launchArgs = buildCursorLaunchArgs(dataDirAbs, cdpPort);
  const child = spawn(exe, launchArgs, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
    env: { ...process.env },
  });
  child.unref();
  const cursorPid = child.pid ?? null;

  const lock: WorkspaceSessionLock = {
    version: 1,
    name,
    cdpPort,
    cursorPid,
    relayPid: null,
    relayPort: null,
    relayEmbedded: false,
    createdAt: prevLock?.createdAt ?? new Date().toISOString(),
  };
  writeLock(cwd, lock);

  try {
    appendFileSync(
      join(dataDirAbs, 'relay.log'),
      `\n=== session relay ${new Date().toISOString()} cdp=${cdpPort} pid=${cursorPid ?? 'none'} args=${JSON.stringify(launchArgs)} ===\n`,
      'utf-8'
    );
  } catch {
    /* ignore */
  }

  const cdpReady = await waitForCdpJson(cdpPort);
  if (!cdpReady) {
    const msg = `CDP did not respond on port ${cdpPort} within timeout (try closing other Cursor windows or check firewall).`;
    console.error(`[launcher] ${msg}`);
    if (cursorPid != null && cursorPid > 0) {
      try {
        killProcessTree(cursorPid);
      } catch {
        /* ignore */
      }
    }
    try {
      removeLock(cwd, name);
    } catch {
      /* ignore */
    }
    return { ok: false, status: 500, error: msg };
  }

  try {
    await startEmbeddedRelaySession(name, cdpPort, dataDirAbs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[launcher] Embedded relay failed:', msg);
    if (cursorPid != null && cursorPid > 0) {
      try {
        killProcessTree(cursorPid);
      } catch {
        /* ignore */
      }
    }
    try {
      removeLock(cwd, name);
    } catch {
      /* ignore */
    }
    return { ok: false, status: 500, error: msg };
  }

  const next = readLock(cwd, name)!;
  next.relayEmbedded = true;
  next.relayPid = null;
  next.relayPort = null;
  writeLock(cwd, next);

  const { path, url } = relayOpenUrls(req, name);
  return {
    ok: true,
    path,
    url,
  };
}

async function buildRows(cwd: string) {
  const { isEmbeddedRelayRunning } = await import('../embedded-relay.js');
  const names = listSessionNames(cwd);
  const sessions: Array<{
    name: string;
    lock: WorkspaceSessionLock;
    health: string;
    healthDetail: string;
    relayRunning: boolean;
  }> = [];

  for (const name of names) {
    const row = await scanSession(cwd, name, { isEmbeddedRelayRunning });
    if (!row) continue;
    const embeddedRunning =
      row.lock.relayEmbedded === true && isEmbeddedRelayRunning(name);
    const relayRunning =
      embeddedRunning ||
      (row.lock.relayPid != null && row.lock.relayPid > 0 && isPidAlive(row.lock.relayPid));

    sessions.push({
      name: row.name,
      lock: row.lock,
      health: row.health,
      healthDetail: row.healthDetail,
      relayRunning,
    });
  }

  return { sessions };
}

/**
 * Workspace session manager API + optional GET /launcher page registration by caller.
 */
export function mountLauncherApi(app: Application): void {
  const cwd = process.cwd();

  const router = express.Router();

  router.get('/sessions', async (_req, res) => {
    try {
      res.json(await buildRows(cwd));
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.post('/sessions', async (req, res) => {
    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    let name = rawName || randomSessionSlug();
    if (rawName && !NAME_RE.test(rawName)) {
      return res.status(400).json({
        error: 'Name must be lowercase kebab-case, e.g. calm-ocean',
      });
    }
    if (!rawName) {
      for (let i = 0; i < 50; i++) {
        name = randomSessionSlug();
        if (!readLock(cwd, name)) break;
      }
      if (readLock(cwd, name)) {
        return res.status(500).json({ error: 'Could not allocate a unique session name' });
      }
    }
    if (readLock(cwd, name)) {
      return res.status(409).json({
        error: `Session "${name}" already exists — use Start relay to restart Cursor + relay`,
      });
    }

    const result = await runSessionRelay(cwd, name, req);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const lock = readLock(cwd, name);
    res.json({
      name,
      ok: true,
      path: result.path,
      url: result.url,
      already: result.already === true,
      cdpPort: lock?.cdpPort,
      pid: lock?.cursorPid,
    });
  });

  router.post('/sessions/:name/start-relay', async (req, res) => {
    const name = req.params.name;
    if (!NAME_RE.test(name)) return res.status(400).json({ error: 'Bad session name' });

    const result = await runSessionRelay(cwd, name, req);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json({
      ok: true,
      path: result.path,
      url: result.url,
      already: result.already === true,
      relayPid: null,
      embedded: true,
    });
  });

  router.post('/sessions/:name/stop-relay', async (req, res) => {
    const name = req.params.name;
    const lock = readLock(cwd, name);
    if (!lock) return res.status(404).json({ error: 'No session' });

    const { stopEmbeddedRelaySession } = await import('../embedded-relay.js');

    if (lock.relayEmbedded) {
      await stopEmbeddedRelaySession(name);
    } else if (lock.relayPid && lock.relayPid > 0) {
      killProcessTree(lock.relayPid);
    }

    lock.relayPid = null;
    lock.relayPort = null;
    lock.relayEmbedded = false;
    writeLock(cwd, lock);
    res.json({ ok: true });
  });

  router.post('/sessions/:name/stop-cursor', (req, res) => {
    const name = req.params.name;
    const lock = readLock(cwd, name);
    if (!lock) return res.status(404).json({ error: 'No session' });
    if (lock.cursorPid && lock.cursorPid > 0) killProcessTree(lock.cursorPid);
    lock.cursorPid = null;
    writeLock(cwd, lock);
    res.json({ ok: true });
  });

  router.post('/sessions/:name/cleanup-lock', async (req, res) => {
    const { isEmbeddedRelayRunning } = await import('../embedded-relay.js');
    const name = req.params.name;
    const row = await scanSession(cwd, name, { isEmbeddedRelayRunning });
    if (!row) return res.status(404).json({ error: 'No session' });
    if (row.health !== 'inactive') {
      return res.status(400).json({ error: 'Only inactive (CDP down, Cursor gone) can cleanup' });
    }
    const orphanRelay =
      (row.lock.relayEmbedded === true && isEmbeddedRelayRunning(name)) ||
      (row.lock.relayPid != null &&
        row.lock.relayPid > 0 &&
        isPidAlive(row.lock.relayPid));
    if (orphanRelay) {
      return res.status(400).json({ error: 'Stop relay first (orphan relay running)' });
    }
    cleanupStaleLock(cwd, row);
    res.json({ ok: true });
  });

  app.use('/api/launcher', router);
}
