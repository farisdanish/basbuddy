// ─── fetchRealtimeFeed ────────────────────────────────────────────────────────
// Downloads the GTFS-RT protobuf from data.gov.my.
// Returns a Buffer for decoding with gtfs-realtime-bindings.

export async function fetchRealtimeFeed(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BasBuddy/1.0 (github.com/your-handle/basbuddy)',
      Accept: 'application/x-protobuf, application/octet-stream, */*',
    },
  });

  if (!response.ok) {
    throw new Error(
      `[fetch] GTFS-RT request failed: HTTP ${response.status} ${response.statusText} — URL: ${url}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
