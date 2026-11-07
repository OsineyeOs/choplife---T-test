/**
 * Choplife Republic — System Settings, Configuration & Governance Audit
 * Command: npx tsx scripts/verify_system_configuration.ts
 *
 * Verifies all 10 core administrative domains (Modules A–J):
 * - Financial, Payment & Settlement Configuration
 * - Tax, Tax Groups, Surcharges & Controlled Reasons
 * - Outlet, Branch & Kitchen Routing Operations
 * - Menu, Modifiers & Catalogue Image Audit
 * - Inventory, Purchasing, Vendor & BOM Management
 * - Customer Database & Loyalty Engine
 * - Staff, Roles, Permissions & Security Settings
 * - Notification Providers & Message Templates
 * - Hardware, Printers & Peripherals
 * - QR Codes, Online Ordering & Operational Logs
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail: string = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${testName}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

const BASE_URL = 'http://127.0.0.1:3000';

async function runSystemSettingsAudit() {
  console.log('================================================================================');
  console.log('⚙️  CHOPLIFE REPUBLIC — SYSTEM SETTINGS & GOVERNANCE AUDIT');
  console.log('================================================================================\n');

  // Step 1: Login as Super Admin
  console.log('[1/7] Authenticating as Super Administrator...');
  let adminToken = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrStaffId: 'CL-ADM-001',
        password: 'ChopLife2025!',
      }),
    });
    const data = await res.json();
    assert(res.ok && data.token, 'Super Admin login succeeded with valid session token', `Role: ${data.staff?.role}`);
    adminToken = data.token;
  } catch (err: any) {
    assert(false, 'Super Admin login failed', err.message);
  }

  // Step 2: Login as Frontline Cashier
  console.log('\n[2/7] Authenticating as Cashier for RBAC Security Boundary...');
  let cashierToken = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrStaffId: 'CL-CSH-001',
        password: 'ChopLife2025!',
      }),
    });
    const data = await res.json();
    assert(res.ok && data.token, 'Cashier login succeeded', `Role: ${data.staff?.role}`);
    cashierToken = data.token;
  } catch (err: any) {
    console.log('  ⚠️ Cashier account lookup note:', err.message);
  }

  // Step 3: GET /api/settings — Retrieve full configuration hierarchy
  console.log('\n[3/7] Verifying System Configuration Schema & Masking...');
  let sharedSettings: any = null;
  try {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, 'GET /api/settings returns 200 OK');
    const body = await res.json();
    const settings = body.settings;
    sharedSettings = settings;

    // Module A: Financial & Payments
    assert(Boolean(settings.financial?.paymentMethods?.length > 0), 'Financial payment methods configured', `${settings.financial?.paymentMethods?.length} tenders`);
    assert(Boolean(settings.financial?.settlementAccounts?.length > 0), 'Bank settlement accounts configured');
    assert(Boolean(settings.financial?.accountingMappings?.salesRevenueAccount), 'Chart of Accounts configured', `Rev: ${settings.financial?.accountingMappings?.salesRevenueAccount}`);

    // Module B: Tax & Surcharges
    assert(settings.tax?.defaultVatRatePercent === 7.5, 'VAT rate strictly 7.5% per Nigerian Finance Act', `Current: ${settings.tax?.defaultVatRatePercent}%`);
    assert(settings.tax?.extraCharges?.packagingFeeDefault === 500, 'Takeaway eco-packaging fee configured', `₦${settings.tax?.extraCharges?.packagingFeeDefault}`);
    assert(Boolean(settings.tax?.controlledReasons?.length > 0), 'Controlled reason codes configured');

    // Module C: Outlet & Kitchen Routing
    assert(Boolean(settings.operations?.branchSchedules), 'Branch operating schedules configured');
    assert(Boolean(settings.operations?.kitchenStations?.length > 0), 'KDS preparation routing stations configured');

    // Module E: Inventory & Purchasing
    assert(settings.inventory?.poApprovalThresholdNaira >= 100000, 'Purchase Order supervisory approval limit configured');
    assert(settings.inventory?.unitConversions?.length > 0, 'Standard culinary unit conversions configured');

    // Module F: Customer & Loyalty
    assert(settings.loyalty?.tiers?.length >= 3, 'VIP Loyalty tiers configured (Bronze, Silver, Gold)');
    assert(settings.loyalty?.redemptionValuePerPointNaira > 0, 'Points redemption rate configured');

    // Module G: Security Governance
    assert(settings.security?.passwordPolicy?.minLength >= 8, 'Security policy enforces minimum password length');
    assert(settings.security?.maxFailedLoginAttempts <= 5, 'Account lockout threshold enforced');

    // Module H: Providers
    assert(Boolean(settings.notifications?.smsProvider), 'SMS gateway settings present');
    assert(Boolean(settings.notifications?.emailProvider), 'Email service settings present');
    assert(Boolean(settings.notifications?.whatsappProvider), 'Meta WhatsApp Business settings present');

    // Module I: Hardware
    assert(Boolean(settings.hardware?.customerDisplayMode), 'Customer display mode configured');
  } catch (err: any) {
    assert(false, 'GET /api/settings failed', err.message);
  }

  // Step 4: PUT /api/settings/:section — Updating configuration domains
  console.log('\n[4/7] Testing Authorized Configuration Updates...');
  try {
    const taxUpdateRes = await fetch(`${BASE_URL}/api/settings/tax`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        defaultVatRatePercent: 7.5,
        extraCharges: {
          packagingFeeDefault: 500,
          dineInServiceChargePercent: 0,
          deliveryServiceChargePercent: 0,
        },
        taxInclusivePricing: true,
      }),
    });
    assert(taxUpdateRes.status === 200, 'PUT /api/settings/tax successfully updates tax configuration');

    const finUpdateRes = await fetch(`${BASE_URL}/api/settings/financial`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        paymentMethods: sharedSettings?.financial?.paymentMethods || [],
      }),
    });
    assert(finUpdateRes.status === 200, 'PUT /api/settings/financial successfully updates financial tenders');
  } catch (err: any) {
    assert(false, 'PUT /api/settings updates failed', err.message);
  }

  // Step 5: Provider Handshake Connectivity Checks
  console.log('\n[5/7] Testing Third-Party Gateway Handshake Endpoints...');
  try {
    for (const provider of ['paystack', 'termii', 'resend', 'meta_whatsapp']) {
      const res = await fetch(`${BASE_URL}/api/settings/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      assert(res.status === 200, `POST /api/settings/test-connection for [${provider}] returns status`, `Configured: ${data.configured}`);
    }
  } catch (err: any) {
    assert(false, 'Test-connection endpoint failed', err.message);
  }

  // Step 6: Catalogue Image Audit & QR Codes
  console.log('\n[6/7] Auditing Catalogue Image Completeness & Table QR Directory...');
  try {
    const auditRes = await fetch(`${BASE_URL}/api/settings/catalogue/image-audit`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(auditRes.status === 200, 'GET /api/settings/catalogue/image-audit returns 200 OK');
    const auditData = await auditRes.json();
    assert(auditData.totalProducts > 0, 'Menu items audited successfully', `${auditData.withImages}/${auditData.totalProducts} (${auditData.completenessPercent}%)`);

    const qrRes = await fetch(`${BASE_URL}/api/settings/qr-codes`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(qrRes.status === 200, 'GET /api/settings/qr-codes returns 200 OK');
    const qrData = await qrRes.json();
    assert(qrData.qrCodes?.length > 0, 'Branch table QR URLs generated', `${qrData.qrCodes.length} QR entries`);
  } catch (err: any) {
    assert(false, 'Catalogue image audit / QR directory failed', err.message);
  }

  // Step 7: RBAC Access Control Enforcement
  console.log('\n[7/7] Verifying RBAC Security & Non-Super-Admin Denial...');
  if (cashierToken) {
    try {
      const deniedRes = await fetch(`${BASE_URL}/api/settings/security`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          passwordMinLength: 12,
        }),
      });
      assert(deniedRes.status === 403, 'Cashier blocked from modifying security configuration with HTTP 403 Forbidden');
    } catch (err: any) {
      assert(false, 'RBAC rejection verification failed', err.message);
    }
  } else {
    // Verify unauthenticated request blocked with 401
    const unauthRes = await fetch(`${BASE_URL}/api/settings`, {
      headers: { Authorization: 'Bearer invalid-token-xyz' },
    });
    assert(unauthRes.status === 401 || unauthRes.status === 403, 'Unauthenticated access rejected with HTTP 401/403');
  }

  // Summary
  console.log('\n================================================================================');
  console.log(`SYSTEM SETTINGS AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSystemSettingsAudit().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
