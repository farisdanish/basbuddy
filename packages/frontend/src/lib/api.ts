// ─── API fetch wrapper ────────────────────────────────────────────────────────
// All API calls from the frontend go through here.
// Base URL defaults to '' (same origin) — the Vite dev proxy forwards /api/* to
// the API server at localhost:3001.

import { DEVICE_ID_HEADER } from '@basbuddy/shared';
import { getDeviceId } from './deviceId.ts';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      [DEVICE_ID_HEADER]: getDeviceId(),
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let errBody: { error?: string; message?: string } = {};
    try { errBody = await res.json() as typeof errBody; } catch { /* ignore */ }
    throw new Error(
      errBody.message ?? errBody.error ?? `HTTP ${res.status} ${res.statusText}`,
    );
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const apiGet = <T>(path: string) => request<T>(path);

export const apiPost = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const apiDelete = (path: string) =>
  request<void>(path, { method: 'DELETE' });
