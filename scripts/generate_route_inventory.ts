/**
 * Choplife Republic — Route Inventory Generator
 * Command: npx tsx scripts/generate_route_inventory.ts
 */

import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();

interface RouteEntry {
  method: string;
  path: string;
  file: string;
  line: number;
}

const mountPrefixByFile: Record<string, string> = {
  'server_payments.ts': '/api/payments',
  'server/payments/transferAndRefundRouter.ts': '/api/payments',
  'server_printers.ts': '/api/pos/printers',
  'server/printers/printerTemplatesAndSocketRouter.ts': '/api/pos/printers',
};

function walkBackendFiles(dir: string, acc: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkBackendFiles(full, acc);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const rel = path.relative(ROOT_DIR, full).replace(/\\/g, '/');
      if (rel === 'server.ts' || rel.startsWith('server/') || rel.startsWith('server_')) {
        acc.push(full);
      }
    }
  }
  return acc;
}

function extractRoutes(): RouteEntry[] {
  const backendFiles = walkBackendFiles(ROOT_DIR);
  const routeRegex = /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  const entries: RouteEntry[] = [];

  for (const absFile of backendFiles) {
    const rel = path.relative(ROOT_DIR, absFile).replace(/\\/g, '/');
    const prefix = mountPrefixByFile[rel] || '';
    const lines = fs.readFileSync(absFile, 'utf8').split('\n');

    lines.forEach((lineText, idx) => {
      routeRegex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = routeRegex.exec(lineText)) !== null) {
        const method = match[1].toUpperCase();
        const rawPath = match[2];
        const combined =
          prefix && !rawPath.startsWith('/api')
            ? `${prefix}${rawPath === '/' ? '' : rawPath}`
            : rawPath;
        entries.push({
          method,
          path: combined,
          file: rel,
          line: idx + 1,
        });
      }
    });
  }

  return entries.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

function run() {
  const routes = extractRoutes();
  const mdLines = [
    `# Authoritative Express Route Inventory (${routes.length} Endpoints)`,
    '',
    '| # | Method | Endpoint Path | Owning Module | Source Line |',
    '|---|---|---|---|---|',
    ...routes.map((r, i) => `| ${i + 1} | \`${r.method}\` | \`${r.path}\` | \`${r.file}\` | ${r.line} |`),
  ];
  const outPath = path.join(ROOT_DIR, 'public', 'EXPRESS_ROUTE_INVENTORY.md');
  fs.writeFileSync(outPath, mdLines.join('\n'), 'utf8');
  console.log(`Saved ${routes.length} routes to ${outPath}`);
}

run();
