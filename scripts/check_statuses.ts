
import fs from 'fs';
const db = JSON.parse(fs.readFileSync('data/choplife_ops_db.json', 'utf-8'));
console.log('Turkey Fest status:', db.menuProducts['prod-sc-turkey-fest']?.status);
console.log('Fish Combo status:', db.menuProducts['prod-qsr-combo-fish']?.status);
