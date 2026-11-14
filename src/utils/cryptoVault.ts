import type {
  ApiCredentials,
  ChannelSnapshot,
  DailyDeltaRecord,
  NetworkConfig,
  PostDetailedStats,
} from '../types/analytics';

const DB_NAME = 'tg_pulse_vault_v1';
const DB_VERSION = 1;
const STORE_VAULT = 'vault';
const STORE_SNAPSHOTS = 'snapshots';

const SESSION_KEY = 'encrypted_session_v1';
const API_CREDS_KEY = 'api_credentials_v1';
const NETWORK_KEY = 'network_config_v1';
const LS_FALLBACK_PREFIX = 'telescope_vault_fb_';

export type VaultErrorCode =
  | 'PIN_REQUIRED'
  | 'WRONG_PIN'
  | 'SESSION_NOT_FOUND'
  | 'CRYPTO_UNAVAILABLE'
  | 'CORRUPT_VAULT';

export class VaultError extends Error {
  readonly code: VaultErrorCode;

  constructor(code: VaultErrorCode, message: string) {
    super(message);
    this.name = 'VaultError';
    this.code = code;
  }
}

export interface VaultSecretBundle {
  sessionString: string;
  apiCreds?: ApiCredentials;
  network?: NetworkConfig;
}

export interface EncryptedPayload {
  salt: string;
  iv: string;
  ciphertext: string;
  hasPin: boolean;
  savedAt: number;
  formatVersion?: number;
}

const DEFAULT_DEVICE_SECRET = 'tg-pulse-local-device-key-v1';

/**
 * Normalizes Persian (۰-۹) and Arabic-Indic (٠-٩) numerals to ASCII 0-9 and trims whitespace.
 */
export function normalizePinDigits(raw: string): string {
  return raw
    .trim()
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getSubtleCrypto(): SubtleCrypto {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle) {
    throw new VaultError(
      'CRYPTO_UNAVAILABLE',
      'WebCrypto AES-GCM requires a secure context (HTTPS or localhost).',
    );
  }
  return cryptoObj.subtle;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const baseKey = await subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 120_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function parseDecryptedVaultSecret(plaintext: string): VaultSecretBundle {
  const trimmed = plaintext.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        v?: number;
        sessionString?: string;
        apiCreds?: ApiCredentials;
        network?: NetworkConfig;
      };
      if (typeof parsed.sessionString === 'string' && parsed.sessionString.length > 0) {
        return {
          sessionString: parsed.sessionString,
          apiCreds: parsed.apiCreds,
          network: parsed.network,
        };
      }
    } catch {
      // Fallback to raw v1 session string
    }
  }
  return { sessionString: plaintext };
}

export async function encryptVaultBundle(
  bundle: VaultSecretBundle,
  pin?: string,
): Promise<EncryptedPayload> {
  const subtle = getSubtleCrypto();
  const normalizedPin = pin ? normalizePinDigits(pin) : '';
  const hasPin = normalizedPin.length > 0;
  const secret = hasPin ? normalizedPin : DEFAULT_DEVICE_SECRET;

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(secret, salt);

  const envelope = JSON.stringify({
    v: 2,
    sessionString: bundle.sessionString,
    apiCreds: bundle.apiCreds,
    network: bundle.network,
  });
  const encoded = new TextEncoder().encode(envelope);
  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    hasPin,
    savedAt: Date.now(),
    formatVersion: 2,
  };
}

export async function decryptVaultPayload(
  payload: EncryptedPayload,
  pin?: string,
): Promise<VaultSecretBundle> {
  const subtle = getSubtleCrypto();

  if (payload.hasPin) {
    const rawTrimmed = (pin ?? '').trim();
    const normalized = normalizePinDigits(rawTrimmed);
    if (!rawTrimmed && !normalized) {
      throw new VaultError('PIN_REQUIRED', 'PIN_REQUIRED');
    }

    const candidates = normalized && normalized !== rawTrimmed ? [normalized, rawTrimmed] : [normalized];
    const salt = base64ToBytes(payload.salt);
    const iv = base64ToBytes(payload.iv);
    const ciphertext = base64ToBytes(payload.ciphertext);

    for (const candidate of candidates) {
      try {
        const key = await deriveAesKey(candidate, salt);
        const decrypted = await subtle.decrypt(
          { name: 'AES-GCM', iv: iv as BufferSource },
          key,
          ciphertext as BufferSource,
        );
        const text = new TextDecoder().decode(decrypted);
        return parseDecryptedVaultSecret(text);
      } catch {
        // try next normalized variant
      }
    }

    throw new VaultError('WRONG_PIN', 'WRONG_PIN');
  }

  try {
    const salt = base64ToBytes(payload.salt);
    const iv = base64ToBytes(payload.iv);
    const ciphertext = base64ToBytes(payload.ciphertext);
    const key = await deriveAesKey(DEFAULT_DEVICE_SECRET, salt);
    const decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    const text = new TextDecoder().decode(decrypted);
    return parseDecryptedVaultSecret(text);
  } catch {
    throw new VaultError('CORRUPT_VAULT', 'Failed to decrypt locally saved session payload.');
  }
}

let cachedDbPromise: Promise<IDBDatabase> | null = null;

function openVaultDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (cachedDbPromise) return cachedDbPromise;

  cachedDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_VAULT)) {
          db.createObjectStore(STORE_VAULT);
        }
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          db.createObjectStore(STORE_SNAPSHOTS);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          cachedDbPromise = null;
        };
        db.onclose = () => {
          cachedDbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        cachedDbPromise = null;
        reject(req.error ?? new Error('Failed to open IndexedDB'));
      };
      req.onblocked = () => {
        cachedDbPromise = null;
        reject(new Error('IndexedDB open blocked by another connection'));
      };
    } catch (err) {
      cachedDbPromise = null;
      reject(err);
    }
  });

  return cachedDbPromise;
}

function readLocalFallback<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${LS_FALLBACK_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeLocalFallback<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`${LS_FALLBACK_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

function deleteLocalFallback(key: string): void {
  try {
    localStorage.removeItem(`${LS_FALLBACK_PREFIX}${key}`);
  } catch {
    // ignore
  }
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  try {
    const db = await openVaultDb();
    const result = await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
    if (result !== null) return result;
  } catch {
    // fallback to localStorage below
  }

  if (storeName === STORE_VAULT) {
    return readLocalFallback<T>(key);
  }
  return null;
}

async function idbSet<T>(storeName: string, key: string, value: T): Promise<void> {
  if (storeName === STORE_VAULT) {
    // Always mirror encrypted vault records in localStorage fallback for restrictive iframes
    writeLocalFallback(key, value);
  }
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
      const store = tx.objectStore(storeName);
      store.put(value, key);
    });
  } catch (err) {
    if (storeName !== STORE_VAULT) throw err;
  }
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  if (storeName === STORE_VAULT) {
    deleteLocalFallback(key);
  }
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB delete aborted'));
      const store = tx.objectStore(storeName);
      store.delete(key);
    });
  } catch {
    // ignore if db unavailable
  }
}

export async function saveEncryptedSessionBundle(
  bundle: VaultSecretBundle,
  pin?: string,
): Promise<{ hasPin: boolean; savedAt: number }> {
  const payload = await encryptVaultBundle(bundle, pin);
  await idbSet(STORE_VAULT, SESSION_KEY, payload);
  return { hasPin: payload.hasPin, savedAt: payload.savedAt };
}

export async function saveEncryptedSession(
  sessionString: string,
  pin?: string,
): Promise<void> {
  await saveEncryptedSessionBundle({ sessionString }, pin);
}

export async function getSavedSessionMeta(): Promise<{
  exists: boolean;
  hasPin: boolean;
  savedAt?: number;
}> {
  try {
    const payload = await idbGet<EncryptedPayload>(STORE_VAULT, SESSION_KEY);
    if (!payload || !payload.ciphertext) return { exists: false, hasPin: false };
    return { exists: true, hasPin: Boolean(payload.hasPin), savedAt: payload.savedAt };
  } catch {
    return { exists: false, hasPin: false };
  }
}

export async function loadEncryptedSessionBundle(pin?: string): Promise<VaultSecretBundle> {
  const payload = await idbGet<EncryptedPayload>(STORE_VAULT, SESSION_KEY);
  if (!payload || !payload.ciphertext) {
    throw new VaultError('SESSION_NOT_FOUND', 'No saved session found');
  }
  return decryptVaultPayload(payload, pin);
}

export async function loadEncryptedSession(pin?: string): Promise<string | null> {
  const payload = await idbGet<EncryptedPayload>(STORE_VAULT, SESSION_KEY);
  if (!payload) return null;
  const bundle = await decryptVaultPayload(payload, pin);
  return bundle.sessionString;
}

export async function clearSavedSession(): Promise<void> {
  await idbDelete(STORE_VAULT, SESSION_KEY);
}

export async function saveNetworkConfig(config: NetworkConfig): Promise<void> {
  await idbSet(STORE_VAULT, NETWORK_KEY, config);
}

export async function loadNetworkConfig(): Promise<NetworkConfig | null> {
  try {
    return await idbGet<NetworkConfig>(STORE_VAULT, NETWORK_KEY);
  } catch {
    return null;
  }
}

export async function saveApiCredentials(creds: ApiCredentials): Promise<void> {
  await idbSet(STORE_VAULT, API_CREDS_KEY, creds);
}

export async function loadApiCredentials(): Promise<ApiCredentials | null> {
  try {
    return await idbGet<ApiCredentials>(STORE_VAULT, API_CREDS_KEY);
  } catch {
    return null;
  }
}

export interface StoredChannelHistory {
  latestSnapshot: ChannelSnapshot | null;
  dailyDeltas: DailyDeltaRecord[];
  postStatsByPost?: Record<string, PostDetailedStats>;
}

export async function saveChannelSnapshotHistory(
  channelId: number,
  history: StoredChannelHistory,
): Promise<void> {
  await idbSet(STORE_SNAPSHOTS, `ch:${channelId}`, history);
}

export async function loadChannelSnapshotHistory(
  channelId: number,
): Promise<StoredChannelHistory | null> {
  try {
    return await idbGet<StoredChannelHistory>(STORE_SNAPSHOTS, `ch:${channelId}`);
  } catch {
    return null;
  }
}

export async function wipeAllVaultData(): Promise<void> {
  for (const key of [SESSION_KEY, API_CREDS_KEY, NETWORK_KEY]) {
    deleteLocalFallback(key);
  }
  try {
    const db = await openVaultDb();
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_VAULT, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORE_VAULT).clear();
      }),
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORE_SNAPSHOTS).clear();
      }),
    ]);
  } catch {
    // ignore if db unavailable
  }
}
