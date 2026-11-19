export const DEFAULT_ADMIN_PIN_6 = '123456';
export const DEFAULT_USER_PIN_6 = '000000';

// Precomputed SHA-256 hex digests for default 6-digit PINs:
// 123456 -> 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
// 000000 -> e3b0c442... no, SHA-256('000000') computed dynamically too, let's compute dynamically when needed
export interface ExtraAdminPin {
  id: string;
  name: string;
  pinHash: string;
  updatedAt: string;
}

export interface PinHashes {
  adminPinHash: string;
  userPinHash: string;
  extraAdmins?: ExtraAdminPin[];
}

const STORAGE_KEY = 'lab_pin_hashes_v1';

export function isValidPin6(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export function sanitizeExtraAdmins(raw: unknown): ExtraAdminPin[] {
  if (!Array.isArray(raw)) return [];
  const result: ExtraAdminPin[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id.trim() : '';
    const name = typeof obj.name === 'string' ? obj.name.trim().slice(0, 120) : '';
    const pinHash = typeof obj.pinHash === 'string' ? obj.pinHash.trim() : '';
    const updatedAt =
      typeof obj.updatedAt === 'string' && obj.updatedAt.length >= 10 && obj.updatedAt.length <= 40
        ? obj.updatedAt
        : new Date().toISOString();

    if (
      /^[a-zA-Z0-9_-]{1,128}$/.test(id) &&
      name.length >= 1 &&
      /^[a-f0-9]{64}$/.test(pinHash)
    ) {
      result.push({ id, name, pinHash, updatedAt });
      if (result.length >= 4) break;
    }
  }
  return result;
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
  cachedDefaults = { adminPinHash, userPinHash, extraAdmins: [] };
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
        extraAdmins: sanitizeExtraAdmins(parsed.extraAdmins),
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
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          adminPinHash: hashes.adminPinHash,
          userPinHash: hashes.userPinHash,
          extraAdmins: sanitizeExtraAdmins(hashes.extraAdmins),
        })
      );
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

export async function verifyPin6Detailed(
  pin: string,
  hashes?: PinHashes | null
): Promise<{ role: 'admin' | 'user'; adminId?: string; adminName?: string } | null> {
  if (!isValidPin6(pin)) return null;
  const [candidateHash, activeHashes] = await Promise.all([
    hashPin6(pin),
    resolveActivePinHashes(hashes),
  ]);
  if (candidateHash === activeHashes.adminPinHash) {
    return { role: 'admin' };
  }
  const matchedExtra = (activeHashes.extraAdmins || []).find((a) => a.pinHash === candidateHash);
  if (matchedExtra) {
    return { role: 'admin', adminId: matchedExtra.id, adminName: matchedExtra.name };
  }
  if (candidateHash === activeHashes.userPinHash) {
    return { role: 'user' };
  }
  return null;
}

export async function verifyPin6(
  pin: string,
  hashes?: PinHashes | null
): Promise<'admin' | 'user' | null> {
  const res = await verifyPin6Detailed(pin, hashes);
  return res ? res.role : null;
}

export async function verifyAdminPin6Detailed(
  pin: string,
  hashes?: PinHashes | null
): Promise<{ ok: boolean; adminId?: string; adminName?: string }> {
  if (!isValidPin6(pin)) return { ok: false };
  const [candidateHash, activeHashes] = await Promise.all([
    hashPin6(pin),
    resolveActivePinHashes(hashes),
  ]);
  if (candidateHash === activeHashes.adminPinHash) {
    return { ok: true };
  }
  const matchedExtra = (activeHashes.extraAdmins || []).find((a) => a.pinHash === candidateHash);
  if (matchedExtra) {
    return { ok: true, adminId: matchedExtra.id, adminName: matchedExtra.name };
  }
  return { ok: false };
}

export async function verifyAdminPin6(
  pin: string,
  hashes?: PinHashes | null
): Promise<boolean> {
  const res = await verifyAdminPin6Detailed(pin, hashes);
  return res.ok;
}
