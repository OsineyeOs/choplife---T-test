
import { loadDatabase } from '../server_db';
import { syncSnapshotToPostgres } from '../server/services/pgPersistenceSync';

async function runReconciliation() {
  console.log('Running reconciliation...');
  const db = loadDatabase();
  const report = await syncSnapshotToPostgres(db, { dryRun: true });
  console.log(JSON.stringify(report, null, 2));
}

runReconciliation().catch(console.error);
