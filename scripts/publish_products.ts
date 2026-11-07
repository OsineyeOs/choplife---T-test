
import fs from 'fs';
const DB_PATH = 'data/choplife_ops_db.json';
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

db.menuProducts['prod-sc-turkey-fest'].status = 'published';
db.menuProducts['prod-qsr-combo-fish'].status = 'published';

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
console.log('Products published.');
