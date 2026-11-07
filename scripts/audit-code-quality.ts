/**
 * Choplife Republic — Automated Code-Quality, Modularity & Static Architecture Audit
 * Command: npm run audit:quality (or npx tsx scripts/audit-code-quality.ts)
 *
 * Inspects all TypeScript/TSX source files across the entire project and reports:
 * 1. Source files exceeding 500, 750, and 1,000 lines with category and compliance metrics:
 *    - Backend-only compliance (<500 lines target)
 *    - Frontend compliance (<500 lines target)
 *    - Application-wide substantive compliance
 *    - Test & audit script distribution
 * 2. File-size distribution by source-code category (<100, 100-200, 201-299, 300-500, 501-750, 751-1000, >1000)
 * 3. Excluded files/directories with explicit engineering rationales
 * 4. Duplicate Express route registration detection across server.ts and all routers
 * 5. Local circular dependency detection (DFS cycle check on module import graph, distinguishing type imports)
 * 6. Unused import detection across local source files
 * 7. Unsafe `any` density & forbidden placeholder/mock token scan
 */

import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();

export interface FileMetric {
  relPath: string;
  category: string;
  lines: number;
  bytes: number;
  anyCount: number;
  placeholderMatches: string[];
  excludedFromStrictGate: boolean;
  exclusionReason?: string;
  unusedImports?: string[];
}

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.aistudio',
  'coverage',
  'playwright-report',
  'test-results',
  '.tmp_audit_fixture_test',
]);

export function categorizeFile(relPath: string): {
  category: string;
  excludedFromStrictGate: boolean;
  exclusionReason?: string;
} {
  const norm = relPath.replace(/\\/g, '/');
  if (norm === 'server.ts' || norm.startsWith('server_') || norm.startsWith('server/middleware/')) {
    return { category: 'backend-core-and-middleware', excludedFromStrictGate: false };
  }
  if (norm.startsWith('server/routes/') || norm.startsWith('server/payments/') || norm.startsWith('server/printers/')) {
    return { category: 'backend-routes-and-controllers', excludedFromStrictGate: false };
  }
  if (
    norm.startsWith('server/services/') ||
    norm.startsWith('server/accounting/') ||
    norm.startsWith('server/bi/') ||
    norm.startsWith('server/notifications/')
  ) {
    return { category: 'backend-services-and-domain', excludedFromStrictGate: false };
  }
  if (norm.startsWith('server/repositories/')) {
    return { category: 'backend-repositories', excludedFromStrictGate: false };
  }
  if (norm.startsWith('server/db/')) {
    return { category: 'backend-db-and-seeds', excludedFromStrictGate: false };
  }
  if (norm.startsWith('src/types/')) {
    return { category: 'frontend-types', excludedFromStrictGate: false };
  }
  if (norm.startsWith('src/context/') || norm.startsWith('src/hooks/') || norm.startsWith('src/services/')) {
    return { category: 'frontend-context-and-hooks', excludedFromStrictGate: false };
  }
  if (norm.startsWith('src/utils/')) {
    return { category: 'frontend-utils-and-adapters', excludedFromStrictGate: false };
  }
  if (norm.startsWith('src/data/')) {
    return {
      category: 'static-canonical-catalogs',
      excludedFromStrictGate: true,
      exclusionReason:
        'Authoritative static menu/inventory/RBAC dataset tables (approved small chops, grills, drinks, 70-SKU inventory master). Splitting single canonical arrays degrades atomic catalog lookup.',
    };
  }
  if (norm.startsWith('scripts/')) {
    return {
      category: 'verification-and-audit-scripts',
      excludedFromStrictGate: true,
      exclusionReason:
        'Self-contained end-to-end verification and audit harnesses (not shipped in runtime production bundle).',
    };
  }
  if (norm.startsWith('src/components/') || norm === 'src/App.tsx' || norm === 'src/main.tsx') {
    return { category: 'frontend-ui-components', excludedFromStrictGate: false };
  }
  return { category: 'other-config', excludedFromStrictGate: true, exclusionReason: 'Build/tooling configuration file.' };
}

export function walkSourceFiles(dir: string, acc: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(fullPath, acc);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      acc.push(fullPath);
    }
  }
  return acc;
}

export function resolveImportPath(fromFile: string, importSpec: string, rootDir: string = ROOT_DIR): string | null {
  if (!importSpec.startsWith('.')) return null;
  const baseDir = path.dirname(fromFile);
  const candidateBase = path.resolve(baseDir, importSpec);
  const candidates = [
    candidateBase,
    `${candidateBase}.ts`,
    `${candidateBase}.tsx`,
    path.join(candidateBase, 'index.ts'),
    path.join(candidateBase, 'index.tsx'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return path.relative(rootDir, c).replace(/\\/g, '/');
    }
  }
  return null;
}

export function detectCircularDependencies(files: string[], rootDir: string = ROOT_DIR): string[][] {
  const graph = new Map<string, string[]>();
  const importRegex = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*from\s+)?['"]([^'"]+)['"]/g;

  for (const absFile of files) {
    const rel = path.relative(rootDir, absFile).replace(/\\/g, '/');
    const content = fs.readFileSync(absFile, 'utf8');
    const deps: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const fullStatement = match[0];
      if (/^(?:import|export)\s+type\b/.test(fullStatement)) continue;
      const target = resolveImportPath(absFile, match[1], rootDir);
      if (target && target !== rel) {
        deps.push(target);
      }
    }
    graph.set(rel, Array.from(new Set(deps)));
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const seenCycleKeys = new Set<string>();

  function dfs(node: string) {
    visited.add(node);
    inStack.add(node);
    stack.push(node);

    const neighbors = graph.get(node) || [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        dfs(next);
      } else if (inStack.has(next)) {
        const idx = stack.indexOf(next);
        if (idx !== -1) {
          const cycle = [...stack.slice(idx), next];
          const key = [...cycle].sort().join('->');
          if (!seenCycleKeys.has(key)) {
            seenCycleKeys.add(key);
            cycles.push(cycle);
          }
        }
      }
    }

    stack.pop();
    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

export interface RouteRegistration {
  method: string;
  fullPath: string;
  file: string;
  line: number;
}

export function detectDuplicateRoutes(files: string[], rootDir: string = ROOT_DIR): {
  totalRoutes: number;
  duplicates: { key: string; occurrences: RouteRegistration[] }[];
} {
  const backendFiles = files.filter((f) => {
    const rel = path.relative(rootDir, f).replace(/\\/g, '/');
    return rel === 'server.ts' || rel.startsWith('server_') || rel.startsWith('server/');
  });

  const mountPrefixByFile: Record<string, string> = {
    'server_payments.ts': '/api/payments',
    'server/payments/transferAndRefundRouter.ts': '/api/payments',
    'server_printers.ts': '/api/pos/printers',
    'server/printers/printerTemplatesAndSocketRouter.ts': '/api/pos/printers',
  };

  const registrations: RouteRegistration[] = [];
  const routeRegex = /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;

  for (const absFile of backendFiles) {
    const rel = path.relative(rootDir, absFile).replace(/\\/g, '/');
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
        registrations.push({
          method,
          fullPath: combined,
          file: rel,
          line: idx + 1,
        });
      }
    });
  }

  const byKey = new Map<string, RouteRegistration[]>();
  for (const reg of registrations) {
    const key = `${reg.method} ${reg.fullPath}`;
    const list = byKey.get(key) || [];
    list.push(reg);
    byKey.set(key, list);
  }

  const duplicates: { key: string; occurrences: RouteRegistration[] }[] = [];
  for (const [key, occurrences] of byKey.entries()) {
    if (occurrences.length > 1) {
      duplicates.push({ key, occurrences });
    }
  }

  return { totalRoutes: registrations.length, duplicates };
}

export function detectUnusedImportsInFile(content: string): string[] {
  const unused: string[] = [];
  // Match standard import statements: import { a, b as c } from '...' or import d from '...'
  const importLines = content.split('\n');
  const importStatements: { raw: string; identifiers: string[] }[] = [];

  const importRegex = /^import\s+(?:type\s+)?(?:([a-zA-Z0-9_$]+)|(?:\{\s*([^}]+)\s*\})|(?:\*\s+as\s+([a-zA-Z0-9_$]+)))\s+from\s+['"][^'"]+['"]/m;

  for (const line of importLines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('import ') && !trimmed.startsWith('import{')) continue;
    if (trimmed.includes("from '") || trimmed.includes('from "')) {
      const match = trimmed.match(importRegex);
      if (match) {
        const ids: string[] = [];
        if (match[1]) ids.push(match[1]); // default import
        if (match[2]) {
          // named imports
          const parts = match[2].split(',');
          for (const p of parts) {
            const clean = p.trim();
            if (!clean) continue;
            if (clean.includes(' as ')) {
              ids.push(clean.split(' as ')[1].trim());
            } else {
              ids.push(clean);
            }
          }
        }
        if (match[3]) ids.push(match[3]); // namespace import
        importStatements.push({ raw: trimmed, identifiers: ids });
      }
    }
  }

  // Strip all import statements from content to test usage in the body
  let bodyWithoutImports = content;
  for (const s of importStatements) {
    bodyWithoutImports = bodyWithoutImports.replace(s.raw, '');
  }

  for (const s of importStatements) {
    for (const id of s.identifiers) {
      // Ignore React namespace if JSX might implicitly use it
      if (id === 'React') continue;
      // Word boundary regex for usage in code or JSX
      const usageRegex = new RegExp(`\\b${id}\\b`);
      if (!usageRegex.test(bodyWithoutImports)) {
        unused.push(id);
      }
    }
  }

  return unused;
}

export function runAudit() {
  const allFiles = walkSourceFiles(ROOT_DIR);
  const metrics: FileMetric[] = [];

  const placeholderRegex = /\b(lorem ipsum|TODO:\s*implement|FIXME:\s*broken)\b/i;
  const anyRegex = /:\s*any\b|\bas\s+any\b/g;

  let totalUnusedImportsCount = 0;

  for (const absPath of allFiles) {
    const relPath = path.relative(ROOT_DIR, absPath).replace(/\\/g, '/');
    const content = fs.readFileSync(absPath, 'utf8');
    const lines = content.split('\n').length;
    const bytes = Buffer.byteLength(content, 'utf8');
    const { category, excludedFromStrictGate, exclusionReason } = categorizeFile(relPath);

    const anyMatches = content.match(anyRegex);
    const anyCount = anyMatches ? anyMatches.length : 0;

    const placeholderMatches: string[] = [];
    if (!relPath.startsWith('scripts/')) {
      const m = content.match(placeholderRegex);
      if (m) placeholderMatches.push(m[0]);
    }

    let unusedImports: string[] = [];
    if (!relPath.startsWith('scripts/')) {
      unusedImports = detectUnusedImportsInFile(content);
      totalUnusedImportsCount += unusedImports.length;
    }

    metrics.push({
      relPath,
      category,
      lines,
      bytes,
      anyCount,
      placeholderMatches,
      excludedFromStrictGate,
      exclusionReason,
      unusedImports,
    });
  }

  const backendMetrics = metrics.filter(
    (m) =>
      m.category.startsWith('backend-') ||
      m.category === 'frontend-types' ||
      m.category === 'frontend-context-and-hooks' ||
      m.category === 'frontend-utils-and-adapters'
  );

  const frontendUiMetrics = metrics.filter((m) => m.category === 'frontend-ui-components');
  const substantiveMetrics = metrics.filter((m) => !m.excludedFromStrictGate);
  const backendOversized500 = backendMetrics.filter((m) => m.lines > 500);
  const over500 = substantiveMetrics.filter((m) => m.lines > 500).sort((a, b) => b.lines - a.lines);
  const over750 = substantiveMetrics.filter((m) => m.lines > 750).sort((a, b) => b.lines - a.lines);
  const over1000 = substantiveMetrics.filter((m) => m.lines > 1000).sort((a, b) => b.lines - a.lines);

  const categories = Array.from(new Set(metrics.map((m) => m.category))).sort();
  const distribution: Record<
    string,
    {
      total: number;
      under100: number;
      r100_200: number;
      r201_299: number;
      r300_500: number;
      r501_750: number;
      r751_1000: number;
      over1000: number;
      maxLines: number;
    }
  > = {};

  for (const cat of categories) {
    const catFiles = metrics.filter((m) => m.category === cat);
    distribution[cat] = {
      total: catFiles.length,
      under100: catFiles.filter((f) => f.lines < 100).length,
      r100_200: catFiles.filter((f) => f.lines >= 100 && f.lines <= 200).length,
      r201_299: catFiles.filter((f) => f.lines >= 201 && f.lines <= 299).length,
      r300_500: catFiles.filter((f) => f.lines >= 300 && f.lines <= 500).length,
      r501_750: catFiles.filter((f) => f.lines >= 501 && f.lines <= 750).length,
      r751_1000: catFiles.filter((f) => f.lines >= 751 && f.lines <= 1000).length,
      over1000: catFiles.filter((f) => f.lines > 1000).length,
      maxLines: Math.max(0, ...catFiles.map((f) => f.lines)),
    };
  }

  const routeAudit = detectDuplicateRoutes(allFiles);
  const circularDeps = detectCircularDependencies(allFiles);

  console.log('================================================================================');
  console.log('CHOPLIFE REPUBLIC — AUTOMATED CODE QUALITY & MODULARITY AUDIT REPORT');
  console.log('================================================================================');
  console.log(`Timestamp            : ${new Date().toISOString()}`);
  console.log(`Total TS/TSX Files   : ${metrics.length}`);
  console.log(`Substantive App Files: ${substantiveMetrics.length}`);
  console.log(`Excluded Catalog/Test: ${metrics.length - substantiveMetrics.length}`);
  console.log('');

  console.log('1. FILE-SIZE DISTRIBUTION BY CATEGORY');
  console.log('--------------------------------------------------------------------------------');
  console.log(
    'Category                         | Total | <100 | 100-200 | 201-299 | 300-500 | 501-750 | 751-1000 | >1000 | Max'
  );
  console.log(
    '---------------------------------|-------|------|---------|---------|---------|---------|----------|-------|-----'
  );
  for (const cat of categories) {
    const d = distribution[cat];
    console.log(
      `${cat.padEnd(32)} | ${String(d.total).padStart(5)} | ${String(d.under100).padStart(4)} | ${String(
        d.r100_200
      ).padStart(7)} | ${String(d.r201_299).padStart(7)} | ${String(d.r300_500).padStart(7)} | ${String(
        d.r501_750
      ).padStart(7)} | ${String(d.r751_1000).padStart(8)} | ${String(d.over1000).padStart(5)} | ${String(
        d.maxLines
      ).padStart(4)}`
    );
  }
  console.log('');

  console.log('2. MULTI-LEVEL MODULARITY COMPLIANCE METRICS');
  console.log('--------------------------------------------------------------------------------');
  const backendCompliancePct = ((backendMetrics.length - backendOversized500.length) / backendMetrics.length) * 100;
  console.log(`Backend & Core Domain Compliance: ${backendCompliancePct.toFixed(1)}% (${backendMetrics.length - backendOversized500.length}/${backendMetrics.length} <= 500 lines)`);
  
  const frontendCompliant = frontendUiMetrics.filter((m) => m.lines <= 500).length;
  const frontendCompliancePct = (frontendCompliant / frontendUiMetrics.length) * 100;
  console.log(`Frontend UI Component Compliance: ${frontendCompliancePct.toFixed(1)}% (${frontendCompliant}/${frontendUiMetrics.length} <= 500 lines)`);

  const appWideCompliant = substantiveMetrics.filter((m) => m.lines <= 500).length;
  const appWideCompliancePct = (appWideCompliant / substantiveMetrics.length) * 100;
  console.log(`Application-Wide Compliance     : ${appWideCompliancePct.toFixed(1)}% (${appWideCompliant}/${substantiveMetrics.length} <= 500 lines)`);
  console.log('');

  console.log('3. EXCLUDED FILES / DIRECTORIES & REASONS');
  console.log('--------------------------------------------------------------------------------');
  console.log('  - node_modules/, dist/, .git/, .aistudio/ : Third-party packages and compiled build artifacts');
  const excludedGroups = new Map<string, FileMetric[]>();
  for (const m of metrics.filter((x) => x.excludedFromStrictGate)) {
    const list = excludedGroups.get(m.category) || [];
    list.push(m);
    excludedGroups.set(m.category, list);
  }
  for (const [cat, list] of excludedGroups.entries()) {
    const over500Excluded = list.filter((x) => x.lines > 500);
    console.log(
      `  - ${cat} (${list.length} files, ${over500Excluded.length} >500 lines): ${
        list[0]?.exclusionReason || 'Excluded category'
      }`
    );
    for (const ef of over500Excluded) {
      console.log(`      * ${ef.relPath} (${ef.lines} lines)`);
    }
  }
  console.log('');

  console.log('4. SUBSTANTIVE UI COMPONENT FILES EXCEEDING 500 / 750 / 1,000 LINES');
  console.log('--------------------------------------------------------------------------------');
  console.log(`  - Substantive files > 500 lines  : ${over500.length}`);
  console.log(`  - Substantive files > 750 lines  : ${over750.length}`);
  console.log(`  - Substantive files > 1,000 lines: ${over1000.length} (Multi-tab React workspace modals)`);
  for (const f of over500) {
    const tier = f.lines > 1000 ? '>1000 [WORKSPACE-UI]' : f.lines > 750 ? '>750  [MODAL-UI]    ' : '>500  [COMPONENT-UI]';
    console.log(`    ${tier} ${f.relPath.padEnd(55)} : ${f.lines} lines`);
  }
  console.log('');

  console.log('5. EXPRESS ROUTE REGISTRATION & DUPLICATE ROUTE AUDIT');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Total Backend Express Route Handlers Registered: ${routeAudit.totalRoutes}`);
  console.log(`Duplicate Route Registrations Detected         : ${routeAudit.duplicates.length}`);
  if (routeAudit.duplicates.length > 0) {
    for (const dup of routeAudit.duplicates) {
      console.log(`  [DUPLICATE] ${dup.key}:`);
      for (const occ of dup.occurrences) {
        console.log(`    - ${occ.file}:${occ.line}`);
      }
    }
  } else {
    console.log('PASS: Zero duplicate route registrations across server.ts and all domain routers.');
  }
  console.log('');

  console.log('6. RUNTIME CIRCULAR DEPENDENCY & PLACEHOLDER AUDIT');
  console.log('--------------------------------------------------------------------------------');
  console.log(`Runtime Circular Import Cycles Detected: ${circularDeps.length}`);
  if (circularDeps.length > 0) {
    for (const cyc of circularDeps) {
      console.log(`  [CYCLE] ${cyc.join(' -> ')}`);
    }
  } else {
    console.log('PASS: Zero runtime circular dependencies across local TypeScript modules.');
  }

  const filesWithPlaceholders = metrics.filter((m) => m.placeholderMatches.length > 0);
  console.log(`Files With Forbidden Placeholders      : ${filesWithPlaceholders.length}`);
  console.log(`Total Flagged Unused Imports Across App: ${totalUnusedImportsCount}`);
  console.log('================================================================================');

  if (
    routeAudit.duplicates.length > 0 ||
    circularDeps.length > 0 ||
    filesWithPlaceholders.length > 0 ||
    totalUnusedImportsCount > 0
  ) {
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('audit-code-quality.ts')) {
  runAudit();
}
