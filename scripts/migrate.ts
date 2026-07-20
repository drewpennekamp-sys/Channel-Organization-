import { migrate } from 'drizzle-orm/neon-http/migrator';
import { db } from '../lib/db/client';

async function main() {
  console.log('Applying migrations from ./drizzle ...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations applied.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
