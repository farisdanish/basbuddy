import type { Request, Response, NextFunction } from 'express';
import { DEVICE_ID_HEADER } from '@basbuddy/shared';

// Plausible UUID regex / identifier pattern (accepts standard v4 UUIDs or 16-128 char alphanumeric-dashed strings)
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const FALLBACK_DEVICE_ID_REGEX = /^[a-zA-Z0-9_-]{16,128}$/;

/**
 * Middleware ensuring an incoming request has a valid `x-device-id` header.
 * Skips preflight OPTIONS requests to allow clean CORS handshakes.
 * Attaches the validated ID to `res.locals.deviceId`.
 */
export function requireDeviceId(req: Request, res: Response, next: NextFunction): void {
  // Allow CORS preflight requests to pass through untouched
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const headerValue = req.header(DEVICE_ID_HEADER) ?? req.header('x-device-id');

  if (!headerValue || typeof headerValue !== 'string' || !headerValue.trim()) {
    res.status(400).json({
      error: 'missing_device_id',
      message: 'x-device-id header is required',
    });
    return;
  }

  const trimmed = headerValue.trim();

  if (!UUID_REGEX.test(trimmed) && !FALLBACK_DEVICE_ID_REGEX.test(trimmed)) {
    res.status(400).json({
      error: 'invalid_device_id',
      message: 'x-device-id header must be a valid UUID',
    });
    return;
  }

  res.locals['deviceId'] = trimmed;
  (req as unknown as { deviceId: string }).deviceId = trimmed;
  next();
}
