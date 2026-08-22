import 'dotenv/config';
import runner from 'node-pg-migrate';
import path from 'node:path';
import fs from 'node:fs';
function findMigrationsDir(): string {
  const candidate1 = path.resolve(process.cwd(), 'migrations');
  if (fs.existsSync(candidate1)) return candidate1;
  const candidate2 = path.resolve(process.cwd(), '../../migrations');
  if (fs.existsSync(candidate2)) return candidate2;
  const candidate3 = path.resolve(process.cwd(), '../migrations');
  if (fs.existsSync(candidate3)) return candidate3;
  return candidate1;
}

// Also check /etc/basbuddy/.env if present (production server)
const hostEnvPath = '/etc/basbuddy/.env';
if (fs.existsSync(hostEnvPath)) {
  try {
    const envContent = fs.readFileSync(hostEnvPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch {
    // Ignore read errors
  }
}

async function main(): Promise<void> {
  const direction = (process.argv[2] === 'down' ? 'down' : 'up') as 'up' | 'down';
  const migrationsDir = findMigrationsDir();

  let databaseUrl: string | undefined;

  const user = process.env.POSTGRES_USER || 'basbuddy';
  const password = process.env.POSTGRES_PASSWORD;
  const host = process.env.POSTGRES_HOST || '127.0.0.1';
  const port = process.env.POSTGRES_PORT || '5432';
  const db = process.env.POSTGRES_DB || 'basbuddy';

  if (password) {
    databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${db}`;
  } else if (process.env.DATABASE_URL) {
    databaseUrl = process.env.DATABASE_URL;
  } else {
    databaseUrl = `postgresql://${encodeURIComponent(user)}@${host}:${port}/${db}`;
  }

  const maskedUrl = databaseUrl ? databaseUrl.replace(/:([^:@/]+)@/, ':****@') : 'undefined';
  console.log(`[migrate] Target database: ${maskedUrl}`);
  console.log(`[migrate] Running database migrations (${direction})...`);
  console.log(`[migrate] Migrations directory: ${migrationsDir}`);

  await runner({
    databaseUrl,
    dir: migrationsDir,
    direction,
    migrationsTable: 'pgmigrations',
    verbose: true,
  });

  console.log(`[migrate] ✓ Migrations (${direction}) completed successfully.`);
}

main().catch((err) => {
  console.error('[migrate] ✗ Migration failed:', err);
  process.exit(1);
});
