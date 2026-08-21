import AdmZip from 'adm-zip';

// ─── unzipFeed ────────────────────────────────────────────────────────────────
// Extracts the GTFS ZIP in memory and returns a map of { filename → rawCsvString }.
// Only extracts .txt files (the GTFS text files); skips any other entries.

export function unzipFeed(buffer: Buffer): Record<string, string> {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const files: Record<string, string> = {};

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.name; // basename only
    if (!name.endsWith('.txt')) continue;

    files[name] = entry.getData().toString('utf-8');
  }

  return files;
}
