import { createServer } from 'net';

export async function isTcpPortFree(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createServer();
    s.once('error', () => resolve(false));
    s.listen(port, host, () => {
      s.close(() => resolve(true));
    });
  });
}

/** First port in [start, start + maxSpan) that is free to bind. */
export async function findFreeTcpPort(start: number, maxSpan = 200): Promise<number> {
  for (let p = start; p < start + maxSpan; p++) {
    if (await isTcpPortFree(p)) return p;
  }
  throw new Error(`No free TCP port in range ${start}-${start + maxSpan - 1}`);
}
