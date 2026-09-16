// ─── fetchRealtimeFeed ────────────────────────────────────────────────────────
// Downloads the GTFS-RT protobuf from data.gov.my.
// Returns a Buffer for decoding with gtfs-realtime-bindings along with telemetry metrics.

export interface RealtimeFeedResult {
  buffer: Buffer;
  latencyMs: number;
  httpStatus: number;
}

export async function fetchRealtimeFeed(url: string): Promise<RealtimeFeedResult> {
  const start = Date.now();
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BasBuddy/1.0 (github.com/farisdanish/basbuddy)',
      Accept: 'application/x-protobuf, application/octet-stream, */*',
    },
  });

  const latencyMs = Date.now() - start;

  if (!response.ok) {
    const err = new Error(
      `[fetch] GTFS-RT request failed: HTTP ${response.status} ${response.statusText} — URL: ${url}`,
    ) as Error & { httpStatus?: number; latencyMs?: number };
    err.httpStatus = response.status;
    err.latencyMs = latencyMs;
    throw err;
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    latencyMs,
    httpStatus: response.status,
  };
}

