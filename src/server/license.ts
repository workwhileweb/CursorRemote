import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const dataDir = process.env.DATA_DIR ?? resolve(process.cwd(), 'data');
const LICENSE_PATH = join(dataDir, 'license.key');

const STORE_URL = 'https://cursor-remote.com/buy';

const KEY_FORMAT = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const KEY_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Key cố định hợp lệ (checksum `sum % 42 === 0`) — dùng cho test / dev cục bộ. */
export const TEST_LICENSE_KEY = 'QEQD-WWRO-3SH7-GC4O-U66G';

function validateKey(key: string): boolean {
  const trimmed = key.trim().toUpperCase();
  if (!KEY_FORMAT.test(trimmed)) return false;
  const chars = trimmed.replace(/-/g, '');
  const sum = [...chars].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return sum % 42 === 0;
}

/**
 * Sinh key ngẫu nhiên đúng định dạng và cùng quy tắc checksum với `validateKey`.
 */
export function generateRandomLicenseKey(): string {
  for (let attempt = 0; attempt < 10_000; attempt++) {
    let s = '';
    for (let i = 0; i < 20; i++) {
      s += KEY_CHARSET[Math.floor(Math.random() * KEY_CHARSET.length)]!;
    }
    const key = `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}`;
    if (validateKey(key)) return key;
  }
  throw new Error('generateRandomLicenseKey: exhausted attempts');
}

function readStoredKey(): string | null {
  const envKey = process.env.LICENSE_KEY?.trim();
  if (envKey) return envKey;

  try {
    if (existsSync(LICENSE_PATH)) {
      const raw = readFileSync(LICENSE_PATH, 'utf-8');
      const key = raw.trim();
      return key || null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Validate `license.key` inside a given directory (embedded session relays). */
export function isLicenseValidForDataDir(dataDirAbs: string): boolean {
  const p = join(dataDirAbs, 'license.key');
  try {
    if (!existsSync(p)) return false;
    const raw = readFileSync(p, 'utf-8').trim();
    return raw.length > 0 && validateKey(raw);
  } catch {
    return false;
  }
}

/**
 * Validates the stored license key. No prompting - use scripts/dev-wrapper.ts
 * for interactive dev (prompts before starting tsx watch).
 */
export function checkLicense(): void {
  const stored = readStoredKey();
  if (stored && validateKey(stored)) {
    console.log('[license] Thank you for supporting the project.');
    return;
  }
  console.error('[license] No valid license key in data/license.key');
  console.error(`  Get a key: ${STORE_URL}`);
  console.error('  For dev: run "npm run dev" which prompts before starting.');
  process.exit(1);
}
