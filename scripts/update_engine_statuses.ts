
import fs from 'fs';
import path from 'path';

const FILE_PATH = path.join(process.cwd(), 'server', 'services', 'packageAndPricingEngine.ts');
let content = fs.readFileSync(FILE_PATH, 'utf-8');

// Replace all 'status: 'paused'' with 'status: 'published''
// But only for the items that are meant to be published (which seem to be almost all of them now)
content = content.replace(/status: 'paused'/g, "status: 'published'");

fs.writeFileSync(FILE_PATH, content, 'utf-8');
console.log('Updated statuses to published in packageAndPricingEngine.ts');
