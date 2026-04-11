import { spawn } from 'child_process';

/** Best-effort kill process tree (Windows: taskkill /T /F). */
export function killProcessTree(pid: number): void {
  if (pid <= 0) return;
  if (process.platform === 'win32') {
    const p = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    p.unref();
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        /* ignore */
      }
    }
  }
}
