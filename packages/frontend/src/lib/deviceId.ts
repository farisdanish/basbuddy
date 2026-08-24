export const DEVICE_ID_STORAGE_KEY = 'basbuddy_device_id';

/**
 * Generates a random RFC 4122 v4 compliant UUID string.
 * Uses crypto.randomUUID() when available, falling back to a Math.random generator.
 */
function generateUUID(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    try {
      return globalThis.crypto.randomUUID();
    } catch {
      // Fall through to fallback
    }
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns the persistent device ID for this client instance.
 * Reads from localStorage if present; otherwise creates, stores, and returns a new UUID.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return '00000000-0000-4000-8000-000000000000';
  }

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && typeof existing === 'string' && existing.trim().length >= 16) {
      return existing.trim();
    }

    const newId = generateUUID();
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, newId);
    return newId;
  } catch (err) {
    console.warn('[deviceId] Failed accessing localStorage, generating temporary UUID:', err);
    return generateUUID();
  }
}
