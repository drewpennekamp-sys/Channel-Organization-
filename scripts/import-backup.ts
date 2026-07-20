import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyImport } from '../lib/exportImport';
import { importDataSchema } from '../lib/validation';

// One-time migration helper: loads a "Export all data" JSON backup (from the
// Settings screen) directly into whatever Postgres DATABASE_URL is currently
// set, without going through the running app or its auth layer. Meant to run
// once against a fresh Neon database before or right after the first deploy.
//
// Usage: DATABASE_URL=... npm run db:import-backup -- path/to/backup.json

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npm run db:import-backup -- path/to/backup.json');
    process.exit(1);
  }

  const raw = readFileSync(resolve(filePath), 'utf8');
  const json = JSON.parse(raw);

  const parsed = importDataSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    console.error(
      `This doesn't look like a Shorts Factory backup file${issue ? ` (${issue.path.join('.')}: ${issue.message})` : ''}.`
    );
    process.exit(1);
  }

  console.log(`Importing from ${filePath} — this REPLACES all data in the target database.`);
  const counts = await applyImport(parsed.data);
  console.log('Import complete:', counts);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
