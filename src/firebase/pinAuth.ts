export const DEFAULT_ADMIN_PIN_6 = '123456';
export const DEFAULT_USER_PIN_6 = '000000';

// Precomputed SHA-256 hex digests for default 6-digit PINs:
// 123456 -> 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
// 000000 -> e3b0c442... no, SHA-256('000000') computed dynamically too, let's compute dynamically when needed
export interface PinHashes {
  adminPinHash: string;
  userPinHash: string;
}

const STORAGE_KEY = 'lab_pin_hashes_v1';

export function isValidPin6(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export async function hashPin6(pin: string): Promise<string> {
  if (!isValidPin6(pin)) {
    throw new Error('รหัส PIN ต้องเป็นตัวเลข 6 หลักเท่านั้น');
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

let cachedDefaults: PinHashes | null = null;

export async function getDefaultPinHashes(): Promise<PinHashes> {
  if (cachedDefaults) return cachedDefaults;
  const [adminPinHash, userPinHash] = await Promise.all([
    hashPin6(DEFAULT_ADMIN_PIN_6),
    hashPin6(DEFAULT_USER_PIN_6),
  ]);
  cachedDefaults = { adminPinHash, userPinHash };
  return cachedDefaults;
}

export function getCachedPinHashes(): PinHashes | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PinHashes>;
    if (
      typeof parsed.adminPinHash === 'string' &&
      /^[a-f0-9]{64}$/.test(parsed.adminPinHash) &&
      typeof parsed.userPinHash === 'string' &&
      /^[a-f0-9]{64}$/.test(parsed.userPinHash)
    ) {
      return {
        adminPinHash: parsed.adminPinHash,
        userPinHash: parsed.userPinHash,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function setCachedPinHashes(hashes: PinHashes): void {
  try {
    if (
      /^[a-f0-9]{64}$/.test(hashes.adminPinHash) &&
      /^[a-f0-9]{64}$/.test(hashes.userPinHash)
    ) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hashes));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function resolveActivePinHashes(override?: PinHashes | null): Promise<PinHashes> {
  if (override) return override;
  const cached = getCachedPinHashes();
  if (cached) return cached;
  return getDefaultPinHashes();
}

export async function verifyPin6(
  pin: string,
  hashes?: PinHashes | null
): Promise<'admin' | 'user' | null> {
  if (!isValidPin6(pin)) return null;
  const [candidateHash, activeHashes] = await Promise.all([
    hashPin6(pin),
    resolveActivePinHashes(hashes),
  ]);
  if (candidateHash === activeHashes.adminPinHash) return 'admin';
  if (candidateHash === activeHashes.userPinHash) return 'user';
  return null;
}

export async function verifyAdminPin6(
  pin: string,
  hashes?: PinHashes | null
): Promise<boolean> {
  if (!isValidPin6(pin)) return false;
  const [candidateHash, activeHashes] = await Promise.all([
    hashPin6(pin),
    resolveActivePinHashes(hashes),
  ]);
  return candidateHash === activeHashes.adminPinHash;
}
