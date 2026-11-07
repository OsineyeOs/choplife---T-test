
import fs from 'fs';
const DB_PATH = 'data/choplife_ops_db.json';
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

console.log('Before:', db.menuProducts['prod-sc-big-flex']?.status);

for (const productId in db.menuProducts) {
  if (db.menuProducts[productId].status === 'paused') {
    db.menuProducts[productId].status = 'published';
  }
}

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
const updatedDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
console.log('After:', updatedDb.menuProducts['prod-sc-big-flex']?.status);
