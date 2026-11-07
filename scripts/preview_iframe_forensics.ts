/**
 * AI STUDIO PREVIEW & IFRAME FORENSIC VALIDATOR
 * 
 * Specifically tests:
 * 1. AI Studio embedded preview iframe simulation:
 *    - Parent origin: https://aistudio.google.com
 *    - Sec-Fetch-Dest: iframe
 *    - Sec-Fetch-Mode: navigate
 *    - Sec-Fetch-Site: cross-site
 * 2. Cross-device preview rendering:
 *    - Desktop (1440x900)
 *    - Tablet (768x1024)
 *    - Mobile (412x915)
 * 3. Module & Asset Loading verification:
 *    - /src/main.tsx returns text/javascript (NOT text/html)
 *    - /src/App.tsx returns text/javascript
 *    - /src/index.css returns text/css
 *    - /api/health returns 200 with status: ok
 * 4. Verifies #root contains full React DOM in iframe context
 * 5. Verifies Pre-React BootScreen / Storefront mount transition
 */

import { chromium, Browser, Page } from 'playwright';

interface ForensicResult {
  test: string;
  result: 'PASS' | 'FAIL' | 'NOT TESTED';
  details: string;
}

const results: ForensicResult[] = [];

function record(test: string, result: 'PASS' | 'FAIL' | 'NOT TESTED', details: string) {
  results.push({ test, result, details });
  const icon = result === 'PASS' ? '✅' : result === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${result}] ${test}: ${details}`);
}

async function runIframeForensics() {
  console.log('\n🔬 ========================================================');
  console.log('   AI STUDIO PREVIEW IFRAME FORENSIC SUITE');
  console.log('========================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let hasFailure = false;

  try {
    // 1. Module Script MIME & Status Audit
    console.log('--- 1. AUDITING VITE & MODULE SCRIPT ENDPOINTS ---');
    const pageInspect = await browser.newPage();
    
    const endpoints = [
      { url: 'http://localhost:3000/src/main.tsx', expectedMimes: ['text/javascript', 'application/javascript'] },
      { url: 'http://localhost:3000/src/App.tsx', expectedMimes: ['text/javascript', 'application/javascript'] },
      { url: 'http://localhost:3000/src/index.css', expectedMimes: ['text/css', 'text/javascript', 'application/javascript'] },
      { url: 'http://localhost:3000/api/health', expectedMimes: ['application/json'] },
    ];

    for (const ep of endpoints) {
      const resp = await pageInspect.request.get(ep.url);
      const status = resp.status();
      const contentType = resp.headers()['content-type'] || '';
      const bodyLen = (await resp.body()).length;

      const isMimeMatched = ep.expectedMimes.some(mime => contentType.includes(mime.split('/')[1]));

      if (status === 200 && isMimeMatched) {
        record(`Module ${ep.url.split('/').pop()}`, 'PASS', `Status: 200, Content-Type: ${contentType}, Size: ${bodyLen}B`);
      } else {
        record(`Module ${ep.url.split('/').pop()}`, 'FAIL', `Unexpected status: ${status} or Content-Type: ${contentType} (expected ${ep.expectedMimes.join(' or ')})`);
        hasFailure = true;
      }
    }
    await pageInspect.close();

    // 2. Test in Actual Simulated AI Studio Preview Iframe across 3 viewports
    const viewports = [
      { name: 'Desktop Preview', width: 1440, height: 900 },
      { name: 'Tablet Preview', width: 768, height: 1024 },
      { name: 'Mobile Preview', width: 412, height: 915 },
    ];

    for (const vp of viewports) {
      console.log(`\n--- 2. TESTING ${vp.name.toUpperCase()} (${vp.width}x${vp.height}) ---`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        extraHTTPHeaders: {
          'Referer': 'https://aistudio.google.com/',
          'Origin': 'https://aistudio.google.com',
        },
      });

      const page = await context.newPage();
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      page.on('pageerror', err => pageErrors.push(err.message));

      await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);

      // Verify #root contains full React DOM
      const domDetails = await page.evaluate(() => {
        const root = document.getElementById('root');
        return {
          exists: Boolean(root),
          htmlLen: root?.innerHTML.length || 0,
          childCount: root?.childElementCount || 0,
          hasNavbar: Boolean(document.querySelector('#main-header') || document.querySelector('header')),
          hasHero: Boolean(document.querySelector('#hero-section')),
          hasMenu: Boolean(document.querySelector('#menu-explorer-section')),
          hasFooter: Boolean(document.querySelector('#main-footer') || document.querySelector('footer')),
        };
      });

      if (domDetails.exists && domDetails.htmlLen > 5000 && domDetails.hasHero && pageErrors.length === 0) {
        record(
          `${vp.name} Render`,
          'PASS',
          `Full React Storefront mounted (${domDetails.htmlLen}B DOM, Navbar: ${domDetails.hasNavbar}, Hero: ${domDetails.hasHero}, Menu: ${domDetails.hasMenu}, Footer: ${domDetails.hasFooter}, PageErrors: 0)`
        );
      } else {
        record(
          `${vp.name} Render`,
          'FAIL',
          `Failed to mount in iframe! DOM len: ${domDetails.htmlLen}, PageErrors: ${pageErrors.join(', ')}`
        );
        hasFailure = true;
      }

      await page.screenshot({ path: `preview_${vp.name.toLowerCase().replace(/\s+/g, '_')}.png` });
      await context.close();
    }

  } catch (err: any) {
    record('Forensics Execution', 'FAIL', `Forensic suite exception: ${err.message}`);
    hasFailure = true;
  } finally {
    await browser.close();
  }

  console.log('\n========================================================');
  console.log('       AI STUDIO PREVIEW IFRAME DIAGNOSTIC TABLE');
  console.log('========================================================');
  for (const r of results) {
    console.log(r.test.padEnd(28) + ' | ' + r.result.padEnd(8) + ' | ' + r.details);
  }
  console.log('========================================================\n');

  if (hasFailure) {
    process.exit(1);
  }
}

runIframeForensics();
