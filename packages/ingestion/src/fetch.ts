// ─── fetchStaticFeed ──────────────────────────────────────────────────────────
// Downloads the GTFS static ZIP from data.gov.my.
// No API key required; the endpoint is publicly accessible.
// Rate limit: 4 req/min across ALL requests to data.gov.my — the ingestion
// script counts as one of those. Run daily, not more often.

export async function fetchStaticFeed(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      // Identify ourselves; good practice even for open endpoints
      'User-Agent': 'BasBuddy/1.0 (github.com/your-handle/basbuddy)',
    },
  });

  if (!response.ok) {
    throw new Error(
      `[fetch] GTFS static feed request failed: HTTP ${response.status} ${response.statusText} — URL: ${url}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
