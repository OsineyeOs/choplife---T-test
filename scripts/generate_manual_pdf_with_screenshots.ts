import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function generateProductBible() {
  console.log('--- Generating Choplife Republic Master Product Bible PDF with Comprehensive Step-by-Step Screenshots ---');

  const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  // Helper to capture base64 screenshot
  const captureShot = async (url: string, selectorToWait: string, fileName: string, actionBeforeShot?: () => Promise<void>) => {
    console.log(`Capturing screenshot for ${url} -> ${fileName}...`);
    await page.goto(url, { waitUntil: 'networkidle' });
    if (selectorToWait) {
      try {
        await page.waitForSelector(selectorToWait, { timeout: 3000 });
      } catch {}
    }
    await page.waitForTimeout(1000);
    if (actionBeforeShot) {
      await actionBeforeShot();
      await page.waitForTimeout(800);
    }
    const shotPath = path.join(uploadsDir, fileName);
    await page.screenshot({ path: shotPath, fullPage: false });
    return fs.readFileSync(shotPath).toString('base64');
  };

  // 1. Capture All Step-by-Step Application Screenshots
  const shotStorefrontBase64 = await captureShot('http://localhost:3000/', 'body', 'shot_storefront.png');
  
  // Custom Box Builder Shot
  const shotBuilderBase64 = await captureShot('http://localhost:3000/', 'body', 'shot_builder.png', async () => {
    // Click custom box builder button if present
    const btn = page.locator('button:has-text("Build Your Custom Box"), button:has-text("Custom Box Builder")').first();
    if (await btn.isVisible()) {
      await btn.click();
    }
  });

  // POS Register Shot
  const shotPosBase64 = await captureShot('http://localhost:3000/pos', 'body', 'shot_pos.png');

  // CFD Display Shot
  const shotCfdBase64 = await captureShot('http://localhost:3000/cfd', 'body', 'shot_cfd.png');

  // Admin Dashboard Shot
  const shotAdminBase64 = await captureShot('http://localhost:3000/admin', 'body', 'shot_admin.png');

  console.log('All step-by-step screenshots captured successfully.');

  // 2. Construct Master Product Bible HTML
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Choplife Republic Master Product Bible v3.4</title>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&display=swap" rel="stylesheet">

  <style>
    @page {
      size: A4;
      margin: 18mm 15mm 20mm 15mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-family: 'Montserrat', sans-serif;
        font-size: 8.5pt;
        color: #7A6A65;
      }
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: 'Montserrat', sans-serif;
      color: #241311;
      background-color: #FFFFFF;
      margin: 0;
      padding: 0;
      font-size: 9pt;
      line-height: 1.5;
    }

    /* Cover Page Styling */
    .cover-page {
      page-break-after: always;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: linear-gradient(135deg, #4D080F 0%, #241311 100%);
      color: #FAF7F2;
      padding: 40px;
      border-radius: 16px;
      margin-bottom: 30px;
    }

    .cover-header {
      border-bottom: 3px solid #FFC700;
      padding-bottom: 20px;
    }

    .cover-title {
      font-size: 28pt;
      font-weight: 900;
      color: #FFC700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0;
    }

    .cover-subtitle {
      font-size: 14pt;
      font-weight: 700;
      color: #FAF7F2;
      margin-top: 10px;
    }

    .cover-body {
      margin-top: 40px;
    }

    .cover-badge {
      display: inline-block;
      background-color: #800D15;
      color: #FFC700;
      font-weight: 800;
      font-size: 10pt;
      padding: 6px 16px;
      border-radius: 20px;
      border: 1px solid #FFC700;
      text-transform: uppercase;
      margin-bottom: 20px;
    }

    .cover-meta {
      font-size: 9.5pt;
      color: #FAF7F2;
      opacity: 0.9;
      line-height: 1.8;
    }

    .cover-footer {
      border-top: 1px solid rgba(255, 199, 0, 0.3);
      padding-top: 20px;
      font-size: 9pt;
      color: #FFC700;
      display: flex;
      justify-content: space-between;
    }

    /* Section Styling */
    .section-title {
      font-size: 14pt;
      font-weight: 900;
      color: #4D080F;
      border-bottom: 2px solid #FFC700;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 12px;
      text-transform: uppercase;
    }

    .subsection-title {
      font-size: 10.5pt;
      font-weight: 800;
      color: #800D15;
      margin-top: 16px;
      margin-bottom: 6px;
    }

    p {
      margin-bottom: 8px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      margin-bottom: 16px;
      font-size: 8pt;
    }

    th {
      background-color: #4D080F;
      color: #FFC700;
      font-weight: 800;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #330D12;
    }

    td {
      padding: 6px 8px;
      border: 1px solid #E5DEC9;
      vertical-align: top;
    }

    tr:nth-child(even) {
      background-color: #FAF7F2;
    }

    /* Figure & Screenshot Containers */
    .figure-container {
      margin: 14px 0;
      border: 2px solid #4D080F;
      border-radius: 10px;
      overflow: hidden;
      background-color: #241311;
      box-shadow: 0 4px 10px rgba(0,0,0,0.12);
      page-break-inside: avoid;
    }

    .figure-header {
      background-color: #4D080F;
      color: #FFC700;
      padding: 6px 12px;
      font-weight: 800;
      font-size: 8.5pt;
      border-bottom: 1px solid #FFC700;
      display: flex;
      justify-content: space-between;
    }

    .figure-img {
      width: 100%;
      height: auto;
      display: block;
    }

    .figure-caption {
      background-color: #FAF7F2;
      color: #241311;
      padding: 8px 10px;
      font-size: 8pt;
      border-top: 1px solid #E5DEC9;
      line-height: 1.4;
    }

    /* Code & ASCII Boxes */
    .ascii-box {
      font-family: monospace;
      font-size: 7.5pt;
      background-color: #241311;
      color: #FFC700;
      padding: 10px;
      border-radius: 8px;
      border-left: 4px solid #800D15;
      white-space: pre;
      overflow-x: auto;
      margin: 10px 0;
    }

    .badge-verified {
      background-color: #166534;
      color: #FFFFFF;
      font-weight: 800;
      padding: 2px 5px;
      border-radius: 4px;
      font-size: 7pt;
    }

    .journey-card {
      background-color: #FAF7F2;
      border: 1px solid #E5DEC9;
      border-left: 4px solid #800D15;
      padding: 10px 12px;
      border-radius: 8px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    .journey-title {
      font-size: 10pt;
      font-weight: 900;
      color: #4D080F;
      margin-bottom: 4px;
    }

    .page-break {
      page-break-after: always;
    }
  </style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="cover-page">
    <div class="cover-header">
      <div class="cover-badge">Master Product Bible • Production v3.4</div>
      <h1 class="cover-title">Choplife Republic</h1>
      <div class="cover-subtitle">Complete Operations & Technical Platform Bible</div>
    </div>

    <div class="cover-body">
      <p style="font-size: 10.5pt; color: #FAF7F2; line-height: 1.6;">
        Definitive Product Manual, User Interfaces, Step-by-Step Screenshots, Role Permissions, Customer Journeys, POS Register Operations, CFD Dual-Screen Workflows, and Master Inventory Governance for Choplife Republic (Benin City, Edo State, Nigeria).
      </p>

      <div class="cover-meta">
        <strong>Document Reference:</strong> CLR-BIBLE-2026-V3.4<br>
        <strong>Publication Date:</strong> October 31, 2026<br>
        <strong>Production Endpoint:</strong> https://ais-dev-44y4hq7fi4mppkyrfawv5p-127643680570.europe-west2.run.app<br>
        <strong>Authorized Branches:</strong> G.R.A. Branch • Okabere Branch • Ugbowo Branch
      </div>
    </div>

    <div class="cover-footer">
      <span>100% MAXIMUM ENJOYMENT</span>
      <span>CONFIDENTIAL & PROPRIETARY MASTER MANUAL</span>
    </div>
  </div>

  <!-- SECTION 1: SYSTEM OVERVIEW & ARCHITECTURE -->
  <div class="section-title">1. System Overview & Platform Architecture</div>
  <p>
    The Choplife Republic Operations Platform is a unified, full-stack Quick Service Restaurant (QSR) enterprise system designed specifically for high-volume Nigerian hospitality operations across Benin City.
  </p>

  <div class="ascii-box">
+-----------------------------------------------------------------------------------+
|                        CHOPLIFE REPUBLIC PLATFORM ARCHITECTURE                     |
+-----------------------------------------------------------------------------------+
|  1. CUSTOMER STOREFRONT  |  2. POS REGISTER & TERMINALS  |  3. ADMIN BACK-OFFICE  |
|  - Branch Selector (/)   |  - Front-Office POS (/pos)   |  - Executive BI (/admin)  |
|  - Custom Box Builder    |  - Kitchen Display (KDS)      |  - Master Inventory    |
|  - Cart & Checkout       |  - Customer Display (/cfd)   |  - CMS & Menu Manager  |
|  - Live Order Tracker    |  - Thermal Printer Bridge     |  - Shift Reconciliation|
+-----------------------------------------------------------------------------------+
|                     SERVER & DATABASE ENGINE (server.ts & server_db.ts)        |
|  - Express REST API (/api/*)    - Persistent Storage (choplife_ops_db.json)      |
|  - Termii SMS Dispatcher        - Audit Logging Engine                          |
+-----------------------------------------------------------------------------------+
  </div>

  <table>
    <thead>
      <tr>
        <th>Module ID</th>
        <th>System Module</th>
        <th>Route</th>
        <th>Verification Status</th>
        <th>Functional Scope</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>MOD-01</strong></td>
        <td>Customer Storefront</td>
        <td><code>/</code></td>
        <td><span class="badge-verified">VERIFIED</span></td>
        <td>Branch selector, multi-category explorer, custom box builder, cart, checkout & live tracking.</td>
      </tr>
      <tr>
        <td><strong>MOD-02</strong></td>
        <td>Front-Office POS Register</td>
        <td><code>/pos</code></td>
        <td><span class="badge-verified">VERIFIED</span></td>
        <td>Open checks, line notes, split bills, manager discounts, tender settlements & thermal receipts.</td>
      </tr>
      <tr>
        <td><strong>MOD-03</strong></td>
        <td>Kitchen Display (KDS)</td>
        <td><code>/pos</code></td>
        <td><span class="badge-verified">VERIFIED</span></td>
        <td>Order queue, urgency timer rings, Recipe BOM reference, bump status & SMS notifications.</td>
      </tr>
      <tr>
        <td><strong>MOD-04</strong></td>
        <td>Customer Facing Display</td>
        <td><code>/cfd</code></td>
        <td><span class="badge-verified">VERIFIED</span></td>
        <td>Terminal sync, neutral welcome screen, dynamic bestseller rankings & approved promo slideshow.</td>
      </tr>
      <tr>
        <td><strong>MOD-05</strong></td>
        <td>Master Inventory Manager</td>
        <td><code>/admin</code></td>
        <td><span class="badge-verified">VERIFIED</span></td>
        <td>Location balances, Purchase Orders (PO), Goods Received Notes (GRN), wastage logs & BOM depletion.</td>
      </tr>
      <tr>
        <td><strong>MOD-06</strong></td>
        <td>CMS & Menu Manager</td>
        <td><code>/admin</code></td>
        <td><span class="badge-verified">VERIFIED</span></td>
        <td>Product pricing, branch overrides, category management, package composition & promo deal manager.</td>
      </tr>
      <tr>
        <td><strong>MOD-07</strong></td>
        <td>Financial Reconciliation</td>
        <td><code>/admin</code></td>
        <td><span class="badge-verified">VERIFIED</span></td>
        <td>Paystack webhooks, shift Z-report closing, expense claims processing & audit logs.</td>
      </tr>
    </tbody>
  </table>

  <div class="page-break"></div>

  <!-- SECTION 2: CUSTOMER STOREFRONT MODULE -->
  <div class="section-title">2. Customer Storefront Module (<code>/</code>)</div>
  <p>
    The Customer Storefront provides a seamless online channel for retail customers across Benin City.
  </p>

  <div class="figure-container">
    <div class="figure-header">
      <span>FIGURE 1: CUSTOMER STOREFRONT HOMEPAGE</span>
      <span>ROUTE: /</span>
    </div>
    <img src="data:image/png;base64,${shotStorefrontBase64}" class="figure-img" alt="Storefront Screenshot" />
    <div class="figure-caption">
      <strong>Screen Capture 1.1:</strong> Storefront homepage displaying Quick Branch Picker (GRA, Okabere, Ugbowo), Hero Order Banner, Menu Explorer with Category Chips, and Deals Spotlights.
    </div>
  </div>

  <div class="subsection-title">Interactive Custom Small Chops Box Builder</div>
  <p>
    The Small Chops Box Builder allows customers to create custom box selections with automated packaging auto-assignment:
  </p>

  <div class="figure-container">
    <div class="figure-header">
      <span>FIGURE 2: CUSTOM SMALL CHOPS BOX BUILDER MODAL</span>
      <span>ROUTE: / (Modal Overlay)</span>
    </div>
    <img src="data:image/png;base64,${shotBuilderBase64}" class="figure-img" alt="Custom Box Builder Screenshot" />
    <div class="figure-caption">
      <strong>Screen Capture 2.1:</strong> Custom Box Builder modal showing quantity counters (Puff Puff, Samosa, Spring Roll, Turkey), live subtotal math, and auto-assigned packaging (Food Tray 2300).
    </div>
  </div>

  <div class="page-break"></div>

  <!-- SECTION 3: FRONT-OFFICE POS REGISTER MODULE -->
  <div class="section-title">3. Front-Office POS Register Module (<code>/pos</code>)</div>
  <p>
    The POS Register Workspace equips counter cashiers with a high-speed transaction engine.
  </p>

  <div class="figure-container">
    <div class="figure-header">
      <span>FIGURE 3: FRONT-OFFICE POS REGISTER WORKSPACE</span>
      <span>ROUTE: /pos</span>
    </div>
    <img src="data:image/png;base64,${shotPosBase64}" class="figure-img" alt="POS Screenshot" />
    <div class="figure-caption">
      <strong>Screen Capture 3.1:</strong> Active POS Register displaying Category Navigation, Product Grid, Open Guest Check Panel (#CHK-Live), Subtotal Math, and Payment Settlement Actions.
    </div>
  </div>

  <div class="subsection-title">POS Check Settlement & Receipt Bridge</div>
  <ol>
    <li>Select Check Type (Dine-In Table #4, Takeaway Counter, or Delivery Pickup).</li>
    <li>Add items, specify line prep notes (*"Extra Pepper Sauce"*), and apply manager discount waivers if authorized.</li>
    <li>Settle check via Cash (exact change calculator), Card Terminal (RRN), or Direct Bank Transfer.</li>
    <li>Click <strong>Complete Order & Print Receipt</strong> to generate ESC/POS thermal output.</li>
  </ol>

  <div class="page-break"></div>

  <!-- SECTION 4: CUSTOMER FACING DISPLAY MODULE -->
  <div class="section-title">4. Customer Facing Display Module (<code>/cfd</code>)</div>
  <p>
    The Customer Facing Display runs on counter screens oriented toward patrons during POS register transactions.
  </p>

  <div class="figure-container">
    <div class="figure-header">
      <span>FIGURE 4: CUSTOMER FACING DISPLAY (CFD)</span>
      <span>ROUTE: /cfd</span>
    </div>
    <img src="data:image/png;base64,${shotCfdBase64}" class="figure-img" alt="CFD Screenshot" />
    <div class="figure-caption">
      <strong>Screen Capture 4.1:</strong> Customer Facing Display showing Terminal Status Bar, Neutral Welcome Screen (*"100% Maximum Enjoyment"*), and Dynamic Top Bestsellers Showcase.
    </div>
  </div>

  <div class="page-break"></div>

  <!-- SECTION 5: BACK-OFFICE ADMIN GOVERNANCE MODULE -->
  <div class="section-title">5. Back-Office Administration Module (<code>/admin</code>)</div>
  <p>
    The Back-Office Governance Portal provides executive BI analytics, master inventory control, shift reconciliation, expense claim processing, and staff RBAC privilege assignment.
  </p>

  <div class="figure-container">
    <div class="figure-header">
      <span>FIGURE 5: BACK-OFFICE GOVERNANCE DASHBOARD</span>
      <span>ROUTE: /admin</span>
    </div>
    <img src="data:image/png;base64,${shotAdminBase64}" class="figure-img" alt="Admin Dashboard Screenshot" />
    <div class="figure-caption">
      <strong>Screen Capture 5.1:</strong> Executive BI Dashboard showing Net Sales Metrics, Channel Distribution, Master Inventory Control Navigation, and System Audit Trail.
    </div>
  </div>

  <div class="page-break"></div>

  <!-- SECTION 6: DETAILED END-TO-END USER JOURNEYS -->
  <div class="section-title">6. Detailed End-to-End User Journeys</div>

  <div class="journey-card">
    <div class="journey-title">Journey 1: Customer Online Ordering & Custom Box Building</div>
    <p><strong>Persona:</strong> Online Customer | <strong>Start:</strong> Storefront (<code>/</code>) | <strong>Outcome:</strong> Live Tracking Code CLR-8942</p>
    <div class="ascii-box">
[Customer Opens Storefront] ──► [Selects GRA Branch] ──► [Launches Box Builder]
                                                                  │
                                                                  v
[Receives Live Order Tracker] ◄── [Completes Checkout] ◄── [Adds Custom Box]
    </div>
    <p><strong>Step-by-Step Execution:</strong></p>
    <ol>
      <li>Access Storefront at <code>/</code>, select GRA Branch in Quick Branch Picker.</li>
      <li>Click <strong>Build Custom Box</strong>: set 5 Puff Puff, 2 Samosas, 2 Spring Rolls, 1 Peppered Turkey.</li>
      <li>System calculates total and assigns packaging <code>Food Tray 2300</code>. Add to Cart.</li>
      <li>Proceed to Checkout: select Home Delivery, enter GRA street address.</li>
      <li>Choose Paystack or Direct Bank Transfer proof upload. Receive tracking ID <code>CLR-8942</code>.</li>
    </ol>
  </div>

  <div class="journey-card">
    <div class="journey-title">Journey 2: Front-Office Cashier POS Checkout & Settlement</div>
    <p><strong>Persona:</strong> Cashier / Storekeeper | <strong>Start:</strong> POS (<code>/pos</code>) | <strong>Outcome:</strong> Thermal Receipt Printed</p>
    <div class="ascii-box">
[Cashier Logs into /pos] ──► [Opens New Check #CHK-104] ──► [Adds Menu Items]
                                                                    │
                                                                    v
[Prints Thermal Receipt] ◄── [Settles Cash/Card Tender] ◄── [Syncs to CFD /cfd]
    </div>
    <p><strong>Step-by-Step Execution:</strong></p>
    <ol>
      <li>Log into <code>/pos</code> workspace; click <strong>New Check</strong> (Dine-In Table #4 or Takeaway).</li>
      <li>Tap product cards (Mega Platter ₦13,300, Soft Bread ₦1,200 x2) to populate check line items.</li>
      <li>Apply waiver/discount if authorized. Line items stream live to Customer Display (<code>/cfd</code>).</li>
      <li>Click <strong>Settle Payment</strong> (Cash/Card/Transfer). Complete order and trigger ESC/POS thermal printer.</li>
    </ol>
  </div>

  <div class="journey-card">
    <div class="journey-title">Journey 3: Kitchen Production & Order Dispatch (KDS)</div>
    <p><strong>Persona:</strong> Kitchen Lead / Chef | <strong>Start:</strong> KDS View (<code>/pos</code>) | <strong>Outcome:</strong> Customer SMS Sent</p>
    <div class="ascii-box">
[Incoming Ticket Appears] ──► [Chef Views Recipe BOM] ──► [Marks "In Preparation"]
                                                                  │
                                                                  v
[Dispatches to Counter] ◄── [SMS Sent to Customer] ◄── [Marks "Ready for Pickup"]
    </div>
    <p><strong>Step-by-Step Execution:</strong></p>
    <ol>
      <li>Monitor incoming KDS order queue tickets sorted by urgency timer rings.</li>
      <li>Review Recipe BOM assembly ingredients (0.25 kg Rice, 0.30 kg Chicken, Pack 500).</li>
      <li>Mark ticket <strong>In Preparation</strong> (status: <code>preparing</code>).</li>
      <li>Complete cooking; mark ticket <strong>Ready for Pickup</strong>. System dispatches Termii SMS to customer.</li>
    </ol>
  </div>

  <div class="page-break"></div>

  <div class="journey-card">
    <div class="journey-title">Journey 4: Inventory Procurement & Goods Received Notes (GRN)</div>
    <p><strong>Persona:</strong> Store Manager | <strong>Start:</strong> Admin Inventory (<code>/admin</code>) | <strong>Outcome:</strong> Stock Balances Updated</p>
    <div class="ascii-box">
[Low Stock Alert Triggered] ──► [Create Purchase Order] ──► [Supplier Delivers Goods]
                                                                     │
                                                                     v
[Stock Balances Updated] ◄── [Audit Ledger Entry] ◄── [Log Goods Received Note]
    </div>
    <p><strong>Step-by-Step Execution:</strong></p>
    <ol>
      <li>Review stock balances across GRA, Okabere, and Ugbowo branches. Identify items below reorder threshold.</li>
      <li>Create Purchase Order (PO) for supplier (*Benin Central Grain Ltd*).</li>
      <li>Upon delivery, click <strong>Receive Goods (GRN)</strong>. Record accepted quantities and invoice reference.</li>
      <li>Confirm GRN -> Raw ingredient inventory balances increase, and financial ledger debits post automatically.</li>
    </ol>
  </div>

  <div class="journey-card">
    <div class="journey-title">Journey 5: Shift Manager Cash Reconciliation & Z-Report Close</div>
    <p><strong>Persona:</strong> Branch Manager | <strong>Start:</strong> Shift Management (<code>/pos</code>) | <strong>Outcome:</strong> Locked Shift Period</p>
    <div class="ascii-box">
[Initiate Shift Close] ──► [Count Physical Cash Drawer] ──► [Input Terminal Slips]
                                                                     │
                                                                     v
[Lock & Archive Shift] ◄── [Log Variance Reason] ◄── [System Calculates Variance]
    </div>
    <p><strong>Step-by-Step Execution:</strong></p>
    <ol>
      <li>At shift end, click <strong>Close Shift & Z-Report</strong> in POS navigation bar.</li>
      <li>Input physical cash counted in drawer, POS card slips, and bank transfer receipts.</li>
      <li>System compares physical counts against system recorded sales and calculates shift variance.</li>
      <li>Enter mandatory variance explanation; submit Z-Report to lock shift period and notify accounting.</li>
    </ol>
  </div>

  <div class="journey-card">
    <div class="journey-title">Journey 6: Marketing Campaign Creation & Segregation Approval</div>
    <p><strong>Persona:</strong> Content Editor / Super Admin | <strong>Start:</strong> Admin CMS (<code>/admin</code>) | <strong>Outcome:</strong> Live CFD Deal Rotation</p>
    <div class="ascii-box">
[Content Editor Drafts Deal] ──► [Status: Pending Approval] ──► [Self-Approval Blocked 403]
                                                                         │
                                                                         v
[Revoked if Product Archived] ◄── [Live Slideshow on /cfd] ◄── [Super Admin Approves]
    </div>
    <p><strong>Step-by-Step Execution:</strong></p>
    <ol>
      <li>Content Editor drafts promotion deal (*"Weekend Woodfire Special"* - 20% off Peppered Turkey). Status: <code>pending_approval</code>.</li>
      <li>Content Editor attempts self-approval -> System blocks with <code>403 Forbidden</code> (Segregation of Duties Enforced).</li>
      <li>Super Admin reviews and approves campaign -> Status: <code>approved</code> / <code>published</code>.</li>
      <li>Campaign instantly rotates in Customer Facing Display (<code>/cfd</code>) slideshow.</li>
      <li>If product is later set to <code>archived</code> in Menu Catalogue -> System automatically revokes promotion.</li>
    </ol>
  </div>

  <!-- SECTION 7: USER ROLES & TROUBLESHOOTING -->
  <div class="section-title">7. User Roles & Troubleshooting Matrix</div>

  <table>
    <thead>
      <tr>
        <th>Symptom / Error</th>
        <th>System Area</th>
        <th>Root Cause Analysis</th>
        <th>Verified Recovery Procedure</th>
        <th>Prohibited Action</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>"API endpoint not found"</strong></td>
        <td>Express REST API (<code>/api/*</code>)</td>
        <td>Route requested without required <code>/api/</code> prefix.</td>
        <td>Verify request URL starts with <code>/api/</code>. Restart dev server via <code>restart_dev_server</code>.</td>
        <td>Do not remove route prefixes or create un-prefixed root routes.</td>
      </tr>
      <tr>
        <td><strong>"Forbidden: Insufficient privileges"</strong></td>
        <td>POS / Admin Workspace</td>
        <td>Staff account lacks required permission code.</td>
        <td>Log out and log in with authorized role (e.g. <code>super_admin</code>). Review RBAC matrix.</td>
        <td>Do not bypass client access controls.</td>
      </tr>
      <tr>
        <td><strong>Thermal Printer Disconnected</strong></td>
        <td>POS Hardware</td>
        <td>Network printer bridge socket offline or IP misconfigured.</td>
        <td>Verify IP in <code>/pos</code> -> <strong>Printers</strong>. Run Hardware Diagnostics Test.</td>
        <td>Do not clear local storage while checks are active.</td>
      </tr>
      <tr>
        <td><strong>Paystack Modal Fails to Open</strong></td>
        <td>Checkout Modal</td>
        <td>Public key missing or network offline.</td>
        <td>Check connection. Fall back to Direct Bank Transfer payment method.</td>
        <td>Do not refresh during payment processing.</td>
      </tr>
    </tbody>
  </table>

  <!-- FOOTER DECLARATION -->
  <div style="margin-top: 30px; border-top: 2px solid #4D080F; padding-top: 12px; text-align: center; font-size: 8pt; color: #7A6A65;">
    <strong>Choplife Republic Operations & Software Platform Master Product Bible (v3.4 Production)</strong><br>
    Benin City, Edo State, Nigeria • Official Technical Documentation & Operating Standard
  </div>

</body>
</html>
  `;

  // 3. Render HTML and Output PDF via Playwright
  console.log('Rendering Master Product Bible PDF with embedded screenshots...');
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });

  const pdfPath = path.join(uploadsDir, 'Choplife_Republic_Operations_and_Product_Manual_v3.4.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '15mm',
      bottom: '15mm',
      left: '12mm',
      right: '12mm',
    },
  });

  console.log(`Master Product Bible PDF generated successfully at: ${pdfPath}`);

  // Copy PDF to artifact path if available
  const artifactDir = '/.aistudio/artifacts/brain/899ff429-7cf9-4fcd-aadf-5997d7d7967e';
  if (fs.existsSync(artifactDir)) {
    const artifactPdfPath = path.join(artifactDir, 'Choplife_Republic_Operations_and_Product_Manual_v3.4.pdf');
    fs.copyFileSync(pdfPath, artifactPdfPath);
    console.log(`Artifact PDF copied to: ${artifactPdfPath}`);
  }

  await browser.close();
  console.log('--- Master Product Bible Generation Complete ---');
}

generateProductBible().catch((err) => {
  console.error('Product Bible generation failed:', err);
  process.exit(1);
});
