/**
 * Choplife Republic — Controlled JSON-to-PostgreSQL Migration & Reconciliation Utility
 *
 * Supported modes:
 *   npx tsx scripts/migrate_json_to_pg.ts --dry-run
 *   npx tsx scripts/migrate_json_to_pg.ts --validate
 *   npx tsx scripts/migrate_json_to_pg.ts --apply
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { syncSnapshotToPostgres } from '../server/services/pgPersistenceSync';

const DB_FILE_PATH = process.env.CHOPLIFE_DB_FILE
  ? path.resolve(process.env.CHOPLIFE_DB_FILE)
  : path.join(process.cwd(), 'data', 'choplife_ops_db.json');

const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

async function runMigration() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isValidateOnly = args.includes('--validate');
  const mode = isDryRun ? 'dry-run' : isValidateOnly ? 'validate' : 'apply';

  console.log(`=== Choplife Republic PostgreSQL Migration Runner [Mode: ${mode.toUpperCase()}] ===`);

  if (!fs.existsSync(DB_FILE_PATH)) {
    console.error(`[ERROR] Source database file not found at ${DB_FILE_PATH}`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(DB_FILE_PATH, 'utf-8');
  const checksum = crypto.createHash('sha256').update(rawContent).digest('hex');
  const snapshot = JSON.parse(rawContent);

  let backupPath: string | undefined;
  if (mode === 'apply') {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    backupPath = path.join(BACKUP_DIR, `choplife_ops_db.pre-pg-migration.backup.json`);
    fs.writeFileSync(backupPath, rawContent, 'utf-8');
    console.log(`[BACKUP VERIFIED] Saved pre-migration backup (${rawContent.length.toLocaleString()} bytes, SHA-256: ${checksum.slice(0, 16)}...) to ${backupPath}`);
  }

  const report = await syncSnapshotToPostgres(snapshot, {
    dryRun: isDryRun,
    checksum,
    fileName: path.relative(process.cwd(), DB_FILE_PATH),
  });
  report.mode = mode;
  report.backupPath = backupPath;

  console.log('\n--- DOMAIN RECORD COUNT RECONCILIATION ---');
  console.table(report.domains);

  console.log('\n--- MONETARY & STOCK RECONCILIATION ---');
  console.table({
    OrdersMonetaryTotal: {
      Source: report.monetaryReconciliation.sourceOrdersTotal,
      PostgreSQL: report.monetaryReconciliation.targetOrdersTotal,
      Matched: report.monetaryReconciliation.matched,
    },
    POSChecksMonetaryTotal: {
      Source: report.monetaryReconciliation.sourceChecksTotal,
      PostgreSQL: report.monetaryReconciliation.targetChecksTotal,
      Matched: report.monetaryReconciliation.matched,
    },
    PhysicalStockUnitsTotal: {
      Source: report.stockReconciliation.sourceTotalStockUnits,
      PostgreSQL: report.stockReconciliation.targetTotalStockUnits,
      Matched: report.stockReconciliation.matched,
    },
  });

  if (!report.allPassed) {
    console.error('\n[MIGRATION RECONCILIATION FAILED] Discrepancies detected.');
    process.exit(1);
  }

  console.log(`\n[SUCCESS] PostgreSQL ${mode.toUpperCase()} completed with 100% domain, monetary, and stock reconciliation.`);
}

runMigration().catch((err) => {
  console.error('[FATAL MIGRATION ERROR]', err);
  process.exit(1);
});
