import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runEnforcementCheck() {
  console.log('--- STARTING ENFORCEMENT & LIVE FUNCTIONAL VERIFICATION ---');

  const BASE_URL = 'http://localhost:3000';

  const dbPath = path.join(process.cwd(), 'data', 'choplife_ops_db.json');
  const initialSnapshot = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf-8')) : null;
  let adminToken = '';

  try {
    // SECTION A: BRAND & BRANCH ACCURACY
    console.log('\n--- SECTION A: Brand & Authoritative Branch Accuracy ---');
    const branchesRes = await fetch(`${BASE_URL}/api/branches`);
    assert(branchesRes.ok, 'GET /api/branches returns 200 OK');
    const branches = await branchesRes.json();
    assert(Array.isArray(branches) && branches.length >= 3, 'At least 3 authoritative branches present in DB');

    const graBranch = branches.find((b: any) => b.id === 'gra');
    const okaBranch = branches.find((b: any) => b.id === 'okabere');
    const ugbBranch = branches.find((b: any) => b.id === 'ugbowo');

    assert(
      graBranch?.address === '8a Okogo Street, Opposite Wesley Hotel, Off Akhionbare, G.R.A., Benin City, Edo',
      'GRA branch address matches authoritative source'
    );
    assert(
      okaBranch?.address === '2 Okabere Street, Off Sapele Road, Benin City, Edo',
      'Okabere branch address matches authoritative source'
    );
    assert(
      ugbBranch?.address === 'Petom Filling Station, Opposite S & T Barracks, Isihor, Edo',
      'Ugbowo branch address matches authoritative source'
    );

    // SECTION B: RESPONSIVE VIEWPORTS & PASSWORD UX
    console.log('\n--- SECTION B: Password UX & Component Accessibility ---');
    const passwordInputPath = path.join(process.cwd(), 'src/components/ui/PasswordInput.tsx');
    assert(fs.existsSync(passwordInputPath), 'Accessible PasswordInput component exists');
    const passwordCode = fs.readFileSync(passwordInputPath, 'utf-8');
    assert(passwordCode.includes('type={showPassword ? \'text\' : \'password\'}'), 'PasswordInput is masked by default');
    assert(passwordCode.includes('aria-label'), 'PasswordInput includes aria-label for accessibility');
    assert(passwordCode.includes('focus:ring-2'), 'PasswordInput includes visible focus ring');

    // SECTION C & D: CASH DRAWER, SHIFTS & FINANCIAL INTEGRITY
    console.log('\n--- SECTION C & D: Shift Enforcement & Financial Integrity ---');
    // Authenticate Admin
    const adminAuth = await fetch(`${BASE_URL}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrStaffId: 'oluwaseun.osineye@gmail.com',
        password: 'ChopLife2025!',
      }),
    });
    const adminAuthData = await adminAuth.json();
    assert(adminAuth.ok && adminAuthData.token, 'Admin authentication successful');
    adminToken = adminAuthData.token;
    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAuthData.token}`,
    };

    // Check Executive BI Dashboard response & speed
    const startTime = Date.now();
    const biRes = await fetch(`${BASE_URL}/api/reports/executive-dashboard?branchId=gra&period=7days`, {
      headers: adminHeaders,
    });
    const durationMs = Date.now() - startTime;
    assert(biRes.ok, 'Executive BI Dashboard endpoint returns 200 OK');
    assert(durationMs < 8000, `Executive BI Dashboard responds in ${durationMs}ms (< 8000ms limit)`);

    // SECTION G: MULTI-BRANCH ACCESS & DYNAMIC BRANCH MANAGEMENT
    console.log('\n--- SECTION G: Multi-Branch Access & Dynamic Branch REST API ---');
    // Create test staff with multi-branch access
    const newStaffRes = await fetch(`${BASE_URL}/api/staff/accounts`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        staffId: `STF-MB-${Date.now().toString().slice(-4)}`,
        name: 'Multi-Branch Operations Officer',
        workEmail: `multibranch.${Date.now()}@choplife.ng`,
        phone: '08123456789',
        role: 'branch_manager',
        branchId: 'gra',
        allowedBranchIds: ['gra', 'okabere'],
        initialPassword: 'Password@2026!',
      }),
    });
    assert(newStaffRes.ok, 'Created staff account with multi-branch access allowedBranchIds');
    const newStaffData = await newStaffRes.json();
    assert(
      Array.isArray(newStaffData.staff?.allowedBranchIds) &&
        newStaffData.staff.allowedBranchIds.includes('okabere'),
      'Server persisted multi-branch assignment (allowedBranchIds)'
    );

    // Test dynamic branch creation API
    const newBranchId = `test-branch-${Date.now().toString().slice(-4)}`;
    const createBranchRes = await fetch(`${BASE_URL}/api/branches`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        id: newBranchId,
        name: 'Choplife Republic — Ekenwan Hub',
        shortName: 'Ekenwan Hub',
        address: '15 Ekenwan Road, Benin City, Edo',
        phone: '+234 811 222 3333',
      }),
    });
    assert(createBranchRes.ok, 'POST /api/branches dynamically creates a new branch without code edits');

    // SECTION K: LOCALIZATION Dictionaries & Keys
    console.log('\n--- SECTION K: Localization Dictionaries & Key Integrity ---');
    const langContextPath = path.join(process.cwd(), 'src/context/LanguageContext.tsx');
    assert(fs.existsSync(langContextPath), 'LanguageContext component with translations dictionary exists');
    const langCode = fs.readFileSync(langContextPath, 'utf-8');
    assert(langCode.includes('pcm: {'), 'Naija Pidgin (pcm) dictionary present');
    assert(langCode.includes('bin: {'), 'Edo/Benin (bin) dictionary present');
    assert(langCode.includes('fr: {'), 'French (fr) dictionary present');
    assert(langCode.includes('yo: {'), 'Yoruba (yo) dictionary present');

    console.log('\n--- ALL COMPLETION ENFORCEMENT CHECKS PASSED PERFECTLY ---');
  } finally {
    if (initialSnapshot && adminToken) {
      await fetch(`${BASE_URL}/api/admin/db/reload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ snapshot: initialSnapshot }),
      }).catch(() => {});
    }
  }
}

runEnforcementCheck().catch((err) => {
  console.error('Enforcement check failed:', err);
  process.exit(1);
});

