/**
 * Choplife Republic — Automated Printer & Peripheral Hardware Verification Suite
 * Verifies truthfulness, socket handling, template rendering, and API contracts.
 */

import fs from 'fs';
import path from 'path';
import { renderReceiptHtml, renderReceiptEscPos, generateSampleReceiptData } from '../src/utils/receiptRenderer';
import { BRANCHES } from '../src/data/branches';

const BASE_URL = 'http://localhost:3000';
const DB_FILE_PATH = path.join(process.cwd(), 'data', 'choplife_ops_db.json');

async function runTests() {
  const initialDbSnapshot = fs.existsSync(DB_FILE_PATH)
    ? JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf-8'))
    : null;
  let staffHeaders: Record<string, string> | null = null;
  try {
  console.log('====================================================');
  console.log('CHOPLIFE REPUBLIC — PRINTER & HARDWARE AUDIT SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} — ${detail || 'Assertion failed'}`);
      failed++;
    }
  }

  // 1. Template Rendering Pipeline Tests
  console.log('\n[TEST GROUP 1: Authoritative Receipt Pipeline]');
  const docTypes = ['customer_receipt', 'kitchen_kot', 'grill_kot', 'bar_kot', 'bill_check', 'shift_z_report'] as const;
  
  for (const docType of docTypes) {
    const sample = generateSampleReceiptData(docType);
    const html = renderReceiptHtml({ documentType: docType, order: sample, paperWidth: '80mm' });
    const escposBytes = renderReceiptEscPos({ documentType: docType, order: sample, paperWidth: '80mm' });

    assert(html.length > 100, `HTML render for ${docType} has valid content (${html.length} chars)`);
    assert(escposBytes.length > 20, `ESC/POS byte buffer for ${docType} generated (${escposBytes.length} bytes)`);
    assert(!html.includes('Warri'), `HTML render for ${docType} contains NO Warri references`);
    assert(!html.includes('0802-CHOP-RIDER'), `HTML render for ${docType} contains NO placeholder rider phone`);
  }

  // Check Benin City branch presence in rendered output
  const custSample = generateSampleReceiptData('customer_receipt');
  custSample.branchId = 'gra';
  const graHtml = renderReceiptHtml({ documentType: 'customer_receipt', order: custSample, paperWidth: '80mm' });
  assert(graHtml.includes('GRA') && graHtml.includes('Benin City'), 'GRA branch renders authentic Benin City address');

  // 2. Authentication Enforcement for Hardware Peripheral APIs
  console.log('\n[TEST GROUP 2: Security & Session Protection for Printer Endpoints]');
  const unauthRes = await fetch(`${BASE_URL}/api/pos/printers/templates`);
  assert(unauthRes.status === 401, 'Unauthenticated request to /api/pos/printers/templates is rejected with HTTP 401');

  // Authenticate as authorized staff
  const loginRes = await fetch(`${BASE_URL}/api/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emailOrStaffId: 'oluwaseun.osineye@gmail.com',
      password: 'ChopLife2025!',
    }),
  });
  const loginData = await loginRes.json();
  assert(loginRes.ok && loginData.token, 'Staff authentication successful for hardware test session');

  staffHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${loginData.token}`,
  };

  // 3. REST API: Receipt Templates Endpoint
  console.log('\n[TEST GROUP 3: Receipt Templates CRUD API]');
  try {
    const tmplRes = await fetch(`${BASE_URL}/api/pos/printers/templates`, { headers: staffHeaders });
    assert(tmplRes.ok, 'GET /api/pos/printers/templates returns HTTP 200');
    const tmplData = await tmplRes.json();
    const templates = tmplData.templates || tmplData;
    assert(Array.isArray(templates) && templates.length === 6, `Exactly 6 authoritative default templates returned (got ${templates?.length})`);
    
    const custTmpl = templates.find((t: any) => t.id === 'tmpl-cust-receipt');
    assert(
      custTmpl && (custTmpl.brandName === 'CHOPLIFE REPUBLIC' || custTmpl.headerTitle === 'CHOPLIFE REPUBLIC'),
      'Default customer template has canonical header title'
    );

    // Test template update
    const updateRes = await fetch(`${BASE_URL}/api/pos/printers/templates/tmpl-cust-receipt`, {
      method: 'PUT',
      headers: staffHeaders,
      body: JSON.stringify({
        ...custTmpl,
        footerMessage: 'Thank you for choosing Choplife Republic!',
      }),
    });
    assert(updateRes.ok, 'PUT /api/pos/printers/templates/:id updates template successfully');

    // Test template reset
    const resetRes = await fetch(`${BASE_URL}/api/pos/printers/templates/tmpl-cust-receipt/reset`, {
      method: 'POST',
      headers: staffHeaders,
    });
    assert(resetRes.ok, 'POST /api/pos/printers/templates/:id/reset restores official defaults');
  } catch (err: any) {
    assert(false, 'Receipt Templates API execution', err.message);
  }

  // 4. REST API: Printer Fleet Management
  console.log('\n[TEST GROUP 4: Printer Fleet Management API]');
  let testPrinterId: string | null = null;
  try {
    const fleetRes = await fetch(`${BASE_URL}/api/pos/printers`, { headers: staffHeaders });
    assert(fleetRes.ok, 'GET /api/pos/printers returns HTTP 200');
    const fleetData = await fleetRes.json();
    const fleet = fleetData.printers || fleetData;
    assert(Array.isArray(fleet), 'Printers fleet returned as array');

    // Register a new test printer
    const createRes = await fetch(`${BASE_URL}/api/pos/printers`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        name: 'Automated QA Suya Station',
        role: 'bakery',
        ip: '192.168.1.205',
        port: 9100,
        paperWidth: '80mm',
        autoCut: true,
      }),
    });
    assert(createRes.ok, 'POST /api/pos/printers creates printer profile');
    const createdData = await createRes.json();
    const created = createdData.printer || createdData;
    testPrinterId = created.id;
    assert(created.id && created.name === 'Automated QA Suya Station', 'Created printer contains assigned ID and name');

    // Toggle printer enabled
    const toggleRes = await fetch(`${BASE_URL}/api/pos/printers/${testPrinterId}/toggle`, {
      method: 'POST',
      headers: staffHeaders,
    });
    assert(toggleRes.ok, 'POST /api/pos/printers/:id/toggle succeeds');
    const toggled = await toggleRes.json();
    assert(toggled.enabled === false, 'Printer state toggled to false');

    // Clean up test printer
    const deleteRes = await fetch(`${BASE_URL}/api/pos/printers/${testPrinterId}`, {
      method: 'DELETE',
      headers: staffHeaders,
    });
    assert(deleteRes.ok, 'DELETE /api/pos/printers/:id successfully removes printer');
  } catch (err: any) {
    assert(false, 'Printer Fleet API execution', err.message);
  }

  // 5. Truthful Network Ping (No Fake Spoolers / Fake Successes)
  console.log('\n[TEST GROUP 5: Truthful Network Ping & Socket Checks]');
  try {
    // Ping an unreachable internal IP
    const pingRes = await fetch(`${BASE_URL}/api/pos/printers/network-ping`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({ ip: '192.168.254.254', port: 9100 }),
    });
    assert(pingRes.ok, 'POST /api/pos/printers/network-ping handles unreachable IP gracefully');
    const pingData = await pingRes.json();
    assert(pingData.online === false, 'Truthfully reports online: false for unreachable IP (no fake online)');

    // Rejection of invalid IP format
    const badIpRes = await fetch(`${BASE_URL}/api/pos/printers/network-ping`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({ ip: 'invalid..ip.address', port: 9100 }),
    });
    assert(badIpRes.status === 400, 'Rejects malformed IP addresses with HTTP 400');
  } catch (err: any) {
    assert(false, 'Network Ping verification', err.message);
  }

  // 6. Raw ESC/POS Print Endpoint & Guards
  console.log('\n[TEST GROUP 6: Raw ESC/POS Socket Stream & Guards]');
  try {
    // Reject invalid hex
    const badHexRes = await fetch(`${BASE_URL}/api/pos/printers/network-print`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({ ip: '127.0.0.1', port: 9100, hexData: 'NOT_HEX_DATA' }),
    });
    assert(badHexRes.status === 400, 'Rejects invalid hex string with HTTP 400');

    // Reject oversized payload (>64KB hex)
    const giantHex = '1B40'.repeat(20000); // 80KB
    const giantRes = await fetch(`${BASE_URL}/api/pos/printers/network-print`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({ ip: '127.0.0.1', port: 9100, hexData: giantHex }),
    });
    assert(giantRes.status === 400, 'Rejects oversized ESC/POS payload with HTTP 400');

    // Truthful socket reporting on unreachable target (returns 504 / 502, NOT success)
    const socketFailRes = await fetch(`${BASE_URL}/api/pos/printers/network-print`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({ ip: '192.168.254.254', port: 9100, hexData: '1B40' }),
    });
    assert(
      socketFailRes.status === 504 || socketFailRes.status === 502,
      `Truthful failure code on unreachable socket (got HTTP ${socketFailRes.status}, no fake 200)`
    );
    const failBody = await socketFailRes.json();
    assert(failBody.success === false, 'failBody.success is false');
  } catch (err: any) {
    assert(false, 'Raw ESC/POS verification', err.message);
  }

  // 7. Cash Drawer Kick Audit
  console.log('\n[TEST GROUP 7: Cash Drawer Kick Audit Endpoint]');
  try {
    const drawerRes = await fetch(`${BASE_URL}/api/pos/printers/kick-drawer`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({ reason: 'QA Drawer Pulse Test' }),
    });
    assert(drawerRes.ok, 'POST /api/pos/printers/kick-drawer returns HTTP 200');
    const drawerData = await drawerRes.json();
    assert(drawerData.success === true && drawerData.pulseCommandHex === '1014010101', 'Returns valid ESC/POS pulse hex for RJ11 drawer');
  } catch (err: any) {
    assert(false, 'Cash drawer kick test', err.message);
  }

  console.log('\n====================================================');
  console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
  } finally {
    if (initialDbSnapshot && staffHeaders) {
      await fetch(`${BASE_URL}/api/admin/db/reload`, {
        method: 'POST',
        headers: staffHeaders,
        body: JSON.stringify({ snapshot: initialDbSnapshot }),
      }).catch(() => {});
    }
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
