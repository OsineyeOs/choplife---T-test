import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from '../server/db/db';

async function main() {
  console.log('[MIGRATOR] Applying PostgreSQL migrations from ./drizzle ...');
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('[MIGRATOR] All migrations applied successfully!');
  } catch (err: any) {
    console.error('[MIGRATOR] Migration failed:', err);
    process.exit(1);
  }
  process.exit(0);
}

main();
