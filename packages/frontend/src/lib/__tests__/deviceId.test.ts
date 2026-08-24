import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDeviceId, DEVICE_ID_STORAGE_KEY } from '../deviceId.ts';

describe('deviceId helper', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};

    const mockLocalStorage = {
      getItem: vi.fn((key: string) => mockStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStore[key];
      }),
      clear: vi.fn(() => {
        mockStore = {};
      }),
    };

    vi.stubGlobal('window', {
      localStorage: mockLocalStorage,
    });
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('generates, stores, and returns a new UUID when localStorage is empty', () => {
    const id = getDeviceId();
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThanOrEqual(16);
    expect(mockStore[DEVICE_ID_STORAGE_KEY]).toBe(id);
  });

  it('returns existing UUID from localStorage when present', () => {
    const existing = '11111111-2222-4333-8444-555555555555';
    mockStore[DEVICE_ID_STORAGE_KEY] = existing;

    const id = getDeviceId();
    expect(id).toBe(existing);
  });

  it('generates a new UUID if stored value is invalid/too short', () => {
    mockStore[DEVICE_ID_STORAGE_KEY] = 'short';

    const id = getDeviceId();
    expect(id).not.toBe('short');
    expect(id.length).toBeGreaterThanOrEqual(16);
    expect(mockStore[DEVICE_ID_STORAGE_KEY]).toBe(id);
  });

  it('falls back to default dummy UUID when window is undefined', () => {
    vi.stubGlobal('window', undefined);
    const id = getDeviceId();
    expect(id).toBe('00000000-0000-4000-8000-000000000000');
  });
});
