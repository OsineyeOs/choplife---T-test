
import fs from 'fs';
const FILE_PATH = 'src/data/approvedSmallChops.ts';
let content = fs.readFileSync(FILE_PATH, 'utf-8');

content = content.replace(/status: 'paused'/g, "status: 'published'");

fs.writeFileSync(FILE_PATH, content, 'utf-8');
console.log('Updated statuses to published in approvedSmallChops.ts');
