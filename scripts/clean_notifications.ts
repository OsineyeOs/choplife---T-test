import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'choplife_ops_db.json');
if (fs.existsSync(dbPath)) {
  const raw = fs.readFileSync(dbPath, 'utf-8');
  const db = JSON.parse(raw);
  
  // Wipe test notifications and stock alerts
  db.notifications = {};
  db.stockAlerts = {};
  
  // Ensure promotions object exists
  if (!db.promotions) {
    db.promotions = {};
  }
  
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
  console.log('[CLEAN] Successfully wiped notifications and stock alerts and ensured promotions.');
}
