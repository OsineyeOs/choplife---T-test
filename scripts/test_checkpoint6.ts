import fs from 'fs';
import path from 'path';
import { safeParseApiResponse } from '../src/utils/apiResponseParser';

async function runVerification() {
  console.log('=== CHOPLIFE CHECKPOINT 6 FINAL VERIFICATION SUITE ===');
  let hasFailures = false;

  // 1. SOURCE CHECKS: Drizzle Journal 0005 & Snapshots
  console.log('\n[SECTION 1: SOURCE CHECKS]');
  const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
  if (!fs.existsSync(journalPath)) {
    console.error(' [FAIL] Drizzle journal missing');
    hasFailures = true;
  } else {
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    const entry0005 = journal.entries.find((e: any) => e.idx === 5);
    if (!entry0005) {
      console.error(' [FAIL] Migration 0005 entry missing from journal');
      hasFailures = true;
    } else {
      console.log(` [PASS] Migration 0005 registered in journal (${entry0005.tag})`);
    }
  }

  const snapshot0005Path = path.join(process.cwd(), 'drizzle', 'meta', '0005_snapshot.json');
  if (!fs.existsSync(snapshot0005Path)) {
    console.error(' [FAIL] 0005_snapshot.json file missing');
    hasFailures = true;
  } else {
    console.log(' [PASS] 0005_snapshot.json present');
  }

  // 2. PARSER CHECKS: Safe API Response Parser
  console.log('\n[SECTION 2: SAFE API PARSER CHECKS]');
  const jsonMockRes = new Response(JSON.stringify({ status: 'ok', data: [1, 2, 3] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  const parsedJson = await safeParseApiResponse(jsonMockRes);
  if (parsedJson.ok && Array.isArray(parsedJson.data.data)) {
    console.log(' [PASS] safeParseApiResponse correctly parsed valid JSON response');
  } else {
    console.error(' [FAIL] safeParseApiResponse failed to parse JSON response');
    hasFailures = true;
  }

  const htmlMockRes = new Response('<!doctype html><html><body>SPA Shell</body></html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
  const parsedHtml = await safeParseApiResponse(htmlMockRes);
  if (!parsedHtml.ok && parsedHtml.error?.includes('non-JSON response')) {
    console.log(' [PASS] safeParseApiResponse correctly intercepted HTML response without throwing SyntaxError');
  } else {
    console.error(' [FAIL] safeParseApiResponse failed to handle HTML response safely');
    hasFailures = true;
  }

  // 3. DATABASE REPOSITORY CHECKS (PostgreSQL)
  console.log('\n[SECTION 3: DATABASE & REPOSITORY CHECKS]');
  {
    try {
      await import('../server/repositories/staffRepository');
      const { sessionRepository } = await import('../server/repositories/sessionRepository');
      const { auditRepository } = await import('../server/repositories/auditRepository');

      const testAuditId = `audit-test-${Date.now()}`;
      const [inserted] = await auditRepository.log({
        id: testAuditId,
        staffId: 'staff-admin-001',
        staffName: 'Admin User',
        staffRole: 'super_admin',
        branchId: 'gra',
        action: 'VERIFICATION_TEST',
        details: 'Audit log metadata verification',
        metadata: { verifier: 'checkpoint6' },
      });
      if (inserted && inserted.id === testAuditId) {
        console.log(' [PASS] Audit repository insert with metadata succeeded');
      } else {
        console.error(' [FAIL] Audit repository insert failed');
        hasFailures = true;
      }

      const testToken = `sess-test-${Date.now()}`;
      const [newSess] = await sessionRepository.create({
        id: testToken,
        token: testToken,
        staffId: 'staff-admin-001',
        role: 'super_admin',
        branchId: 'gra',
        expiresAt: new Date(Date.now() + 3600000),
        lastActivity: new Date(),
      });
      if (newSess && newSess.token === testToken) {
        console.log(' [PASS] Session repository creation succeeded');
        await sessionRepository.delete(testToken);
        const checkDel = await sessionRepository.getByToken(testToken);
        if (!checkDel) {
          console.log(' [PASS] Session revocation succeeded');
        } else {
          console.error(' [FAIL] Session revocation failed');
          hasFailures = true;
        }
      } else {
        console.error(' [FAIL] Session repository creation failed');
        hasFailures = true;
      }
    } catch (err: any) {
      console.error(' [FAIL] Database test error:', err.message);
      hasFailures = true;
    }
  }

  console.log('\n=================================================');
  if (hasFailures) {
    console.error('=== VERIFICATION SUITE FAILED ===');
    process.exit(1);
  } else {
    console.log('=== VERIFICATION SUITE PASSED ALL CHECKS ===');
    process.exit(0);
  }
}

runVerification().catch((err) => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
