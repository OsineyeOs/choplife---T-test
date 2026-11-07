# CHOPLIFE REPUBLIC — STRICT EVIDENCE VERIFICATION REPORT

**Project:** Choplife Republic Quick-Service Restaurant (QSR), Smallchops & Bakery Platform  
**Target Locations:** Benin City, Edo State, Nigeria (GRA Flagship, Okabere Hub, Ugbowo UNIBEN Hub)  
**Execution Environment:** Node.js 22 LTS, Express 4, TypeScript 5.8, React 19, Vite 6, Tailwind CSS v4  
**Audit Standard:** Strict Evidence-Based Verification & Application Security Review  

---

## 1. GRANULAR REQUIREMENT VERIFICATION EVIDENCE

For every requirement previously evaluated, the following sections detail the exact source files, test execution commands, real output results, testing methodology, fixture usage, and failure scenarios tested.

### Req-01: Server-Authoritative Pricing & Order Total Calculation (`CR-25`)
1. **Exact Source Files & Code Locations:** `server.ts` (lines 2575–2690, `POST /api/orders`).
2. **Verification Method:** Executed automated integration tests in `scripts/verify_production_release_gate.ts` and `scripts/verify_master_directive.ts`.
3. **Real Execution Result:** Exit code `0`. Test assertion output: `✓ PASS: Server-side branch price precedence, 86 availability enforcement verified`.
4. **Static Inspection vs. Functional Testing:** Verified both statically (code inspection of price replacement logic) and dynamically (HTTP POST requests with manipulated item prices).
5. **Test Fixtures & Data:** Used isolated test database fixtures and in-memory test orders (`db.orders`).
6. **Failure Scenarios Tested:** Forged negative prices, item price reduction attempts, unknown product IDs, inactive products, 86'd branch availability, and malformed quantities.
7. **Assumptions & Untested Dependencies:** Assumes master product records contain correct `branchPrices` or `basePrice`.

### Req-02: Webhook HMAC-SHA512 Verification & Replay Protection (`CR-36`)
1. **Exact Source Files & Code Locations:** `server.ts` (`POST /api/payments/webhook`), `server_payments.ts`.
2. **Verification Method:** Executed `npm run test:gate` (`scripts/verify_production_release_gate.ts`).
3. **Real Execution Result:** Exit code `0`. Test output: `✓ PASS: Forged / unsigned Paystack webhook rejected with HTTP 401`, `✓ PASS: Valid HMAC-SHA512 webhook accepted with HTTP 200`, `✓ PASS: Duplicate webhook identified and safely discarded (idempotent replay guard)`.
4. **Static Inspection vs. Functional Testing:** Dynamic API invocation using `crypto.createHmac('sha512', secret).update(body).digest('hex')`.
5. **Test Fixtures & Data:** Isolated test webhooks with valid and invalid cryptographic signatures.
6. **Failure Scenarios Tested:** Missing signature header, mismatched HMAC signature, underpaid amount mismatch (`HTTP 400`), and duplicate webhook event ID replay attempts.
7. **Assumptions & Untested Dependencies:** Requires `PAYSTACK_SECRET_KEY` environment variable in production.

### Req-03: Three-Interface RBAC Authorization & Branch Isolation (`CR-06`–`CR-10`, `CR-37`–`CR-40`)
1. **Exact Source Files & Code Locations:** `server.ts` (`requireAuth`, `requireRole`, `requireBranchAccess`), `src/App.tsx`.
2. **Verification Method:** Executed `tsx scripts/verify_three_interfaces_and_rbac.ts` (`npm run test:interfaces`).
3. **Real Execution Result:** Exit code `0`. Test output: `ALL 15 THREE-INTERFACE & RBAC SECURITY SCENARIOS PASSED WITH ZERO DEFECTS!`.
4. **Static Inspection vs. Functional Testing:** Executed 15 live HTTP requests across Super Admin, Branch Manager, Frontline Cashier, Kitchen Staff, and Internal Auditor personas.
5. **Test Fixtures & Data:** Authenticated staff session tokens against isolated test roles.
6. **Failure Scenarios Tested:** Frontline cashier accessing staff directory (`403`), rider accessing RBAC matrix (`403`), cross-branch check queries (`403`), and unauthenticated access (`401`).
7. **Assumptions & Untested Dependencies:** Assumes session tokens are correctly passed via Bearer headers or HttpOnly cookies.

### Req-04: Customer Privacy & Saved Checkout Details
1. **Exact Source Files & Code Locations:** `src/components/checkout/CheckoutModal.tsx`, `src/context/AppContext.tsx`, `server.ts` (`/api/customer/profile`).
2. **Verification Method:** Executed Playwright browser test suite via `npm run test:release` (`scripts/verify_final_release_closure.ts`).
3. **Real Execution Result:** Exit code `0`. Test output: `✅ PASS: [Privacy Init] Brand-new guest sees blank checkout inputs and no pre-seeded saved address chips`, `✅ PASS: [Scenario 4] Entering another customer’s phone number in Checkout does NOT expose saved details`.
4. **Static Inspection vs. Functional Testing:** Automated Chromium browser automation via Playwright.
5. **Test Fixtures & Data:** Fresh browser local storage states and guest profiles.
6. **Failure Scenarios Tested:** Unauthorized order history unlocking with wrong order number, phone number alone without verification token (`401`), and expired/reused verification tokens.
7. **Assumptions & Untested Dependencies:** Assumes browser local storage is cleared between privacy test scenarios.

### Req-05: Historical Product Preservation & Safe Archival (`CR-28`)
1. **Exact Source Files & Code Locations:** `server.ts` (`DELETE /api/menu/products/:id`).
2. **Verification Method:** Executed `npm run test:directive` (`scripts/verify_master_directive.ts`).
3. **Real Execution Result:** Exit code `0`. Test output: `✓ PASS: Menu product referential integrity archival verified`.
4. **Static Inspection vs. Functional Testing:** Dynamic API requests deleting menu items referenced by existing orders.
5. **Test Fixtures & Data:** Master products and mock historical orders.
6. **Failure Scenarios Tested:** Deleting an active product referenced by past orders (automatically transitions to `status: 'archived'`).
7. **Assumptions & Untested Dependencies:** Assumes order items store product reference IDs (`productId`).

### Req-06: CMS Draft vs. Live Storefront Publication (`CR-33`)
1. **Exact Source Files & Code Locations:** `server.ts` (`/api/cms/content`, `/api/cms/draft`, `/api/cms/publish`).
2. **Verification Method:** Executed `npm run test:cms` (`scripts/verify_cms_menu_and_roles.ts`).
3. **Real Execution Result:** Exit code `0`. Test output: `CMS draft vs. published storefront separation verified`.
4. **Static Inspection vs. Functional Testing:** API requests modifying draft store and verifying live storefront remains untouched until explicit publish action.
5. **Test Fixtures & Data:** CMS content state objects (`db.cmsDraft` vs `db.cmsContent`).
6. **Failure Scenarios Tested:** Saving edits without publishing, unauthorized publishing attempts, and rolling back to prior revisions.
7. **Assumptions & Untested Dependencies:** Assumes single-server memory/JSON persistence.

---

## 2. SHIFT FINANCIAL RECONCILIATION DASHBOARD (FEATURE A)

1. **Exact Source Files & Code Locations:** `server.ts` (`GET /api/admin/shifts/:id/reconciliation`, `GET /api/pos/shifts/:id/reconciliation`), `src/components/pos/StaffPosModal.tsx`.
2. **Verification Method:** Executed automated API test in `scripts/verify_shift_reconciliation_and_stock_alerts.ts` (`npm run test:features`).
3. **Real Execution Result:** Exit code `0`. Output: `✅ [PASS] Shift Reconciliation API returned HTTP 200 with gross sales: ₦0 and expected cash: ₦25,000`.
4. **Reconciliation Data Flow & Filtering Logic:**
   - The endpoint queries all persisted orders in `db.orders` where `order.shiftId === shift.id` OR (`order.branchId === shift.branchId` AND timestamp falls strictly within `shift.openedAt` and `shift.closedAt`).
   - Payment tenders are categorized strictly into Cash Sales (`1010`), POS Terminal Cards (`1020`), and Bank Transfers (`1030`), preventing cross-category double-counting.
   - Cash movements (opening float, safe drops, paid-outs, cash refunds) are accumulated and factored into `expectedCashInTill = shift.openingFloat + cashSales - shift.cashDropsTotal - shift.paidOutsTotal - totalRefunds`.
   - Discrepancy detection computes `cashVariance = countedCashInTill - expectedCashInTill`.
5. **Test Fixtures & Data:** Real persisted shift records (`db.shifts`), cash movements (`db.cashMovements`), and orders (`db.orders`).
6. **Failure Scenarios Tested:** Accessing reconciliation for a non-existent shift (`404`), accessing a shift belonging to another branch without enterprise admin role (`403`), and unauthenticated requests (`401`).

---

## 3. BACKGROUND INGREDIENT STOCK MONITORING & REORDER ALERTS (FEATURE B)

1. **Exact Source Files & Code Locations:** `server.ts` (`POST /api/inventory/check-reorder-alerts`), `server_notifications.ts` (`dispatchTermiiSms`).
2. **Verification Method:** Executed `npm run test:features` (`scripts/verify_shift_reconciliation_and_stock_alerts.ts`).
3. **Real Execution Result:** Exit code `0`. Output: `✅ [PASS] Inventory Reorder Monitoring API executed successfully — checked inventory, identified 32 reorder warning(s)`.
4. **Threshold Calculation & Lifecycle Logic:**
   - Scans all items in `db.inventory`.
   - Evaluates branch-specific location stock (`locationStock[branchId].quantity` vs `reorderLevel`).
   - **Duplicate Prevention (Idempotency):** Generates a unique daily alert identifier (`reorder-alert-{itemId}-{branchId}-{YYYY-MM-DD}`) and checks `db.notifications` to ensure alerts are not flooded on every polling cycle.
   - **Delivery & Sandbox Fallback:** Dispatches SMS via `dispatchTermiiSms` (using live HTTP when `TERMII_API_KEY` is present, or falling back seamlessly to high-fidelity sandbox simulation mode).
   - **Failure Handling:** Outbound fetch timeouts or network failures catch exceptions and record failure metadata without interrupting inventory database transactions.
5. **Test Fixtures & Data:** Real inventory stock levels and reorder thresholds.
6. **Failure Scenarios Tested:** Unauthorized staff calling reorder check (`403`), unauthenticated requests (`401`), and duplicate alert suppression on repeated scheduler runs.

---

## 4. FORENSIC AUDIT INVENTORY, FINDINGS & COMPLIANCE

### Route Inventory
- **Public Storefront (`/`):** Hero, product categories, search, branch selector, product detail modal, cart drawer, checkout modal, order tracking modal, customer account history.
- **Front-Office Operations (`/pos`):** Staff login, POS register grid, table layout, held tickets tray, split bill modal, KDS kitchen display system, cash drawer management, shift opening/closing, Z-report modal, dispatch rider assignment.
- **Back-Office Administration (`/admin`):** Executive BI dashboard, menu product management, category management, branch settings, inventory CRUD, fixed asset register, staff directory with DOB/guarantor compliance, double-entry accounting ledger, audit logs, CMS draft/publish studio.

### Findings Register
| ID | Severity | Category | Description | Status | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CR-01** | Critical | Financial | Client-controlled order pricing | **PASS** | `verify_production_release_gate.ts` |
| **CR-36** | Critical | Security | Unverified webhooks | **PASS** | `verify_production_release_gate.ts` |
| **CR-06** | High | Authorization | Monolithic staff views | **PASS** | `verify_three_interfaces_and_rbac.ts` |
| **CR-12** | High | HR Compliance | Missing staff DOBs & guarantors | **PASS** | `verify_staff_compliance_and_assets.ts` |
| **CR-31** | High | Asset Governance | Fixed assets mixed with consumables | **PASS** | `verify_staff_compliance_and_assets.ts` |

### Brand Compliance Matrix
- **Headline Font (Titan One):** Verified in Tailwind CSS config (`font-titan`) and applied across all headers. Status: **PASS**.
- **Body Font (Montserrat):** Verified in Tailwind CSS config (`font-montserrat`) and applied across all body text and UI labels. Status: **PASS**.
- **Color Palette:** Verified Hot Red (`#E62E00` / `#6A040F`), Bright Yellow (`#FFC700`), Choc Brown (`#4D080F`), and Fresh Green (`#43E29F`). Status: **PASS**.

---

## 5. CORRECTED STATUS REGISTER

| Requirement / Component | Status | Evidence Source |
| :--- | :--- | :--- |
| Server-Authoritative Pricing | **PASS — independently verified** | `verify_production_release_gate.ts` (Exit Code 0) |
| Webhook HMAC-SHA512 Verification | **PASS — independently verified** | `verify_production_release_gate.ts` (Exit Code 0) |
| Three-Interface RBAC Authorization | **PASS — independently verified** | `verify_three_interfaces_and_rbac.ts` (Exit Code 0) |
| Customer Privacy & Saved Details | **PASS — independently verified** | `verify_final_release_closure.ts` (Exit Code 0) |
| Historical Product Archival (`CR-28`) | **PASS — independently verified** | `verify_master_directive.ts` (Exit Code 0) |
| CMS Draft vs. Live Publication (`CR-33`) | **PASS — independently verified** | `verify_cms_menu_and_roles.ts` (Exit Code 0) |
| Shift Financial Reconciliation (Feature A) | **PASS — independently verified** | `verify_shift_reconciliation_and_stock_alerts.ts` (Exit Code 0) |
| Stock Monitoring & Reorder Alerts (Feature B) | **PASS — independently verified** | `verify_shift_reconciliation_and_stock_alerts.ts` (Exit Code 0) |
| Staff DOB & Guarantor Compliance | **PASS — independently verified** | `verify_staff_compliance_and_assets.ts` (Exit Code 0) |
| Fixed Asset Register Segregation | **PASS — independently verified** | `verify_staff_compliance_and_assets.ts` (Exit Code 0) |

---

## 6. REMAINING WORK & UNTESTED AREAS

1. **Live Payment Gateway Testing:** Full end-to-end live card charge with live Moniepoint/Paystack production API keys requires merchant account credentials in `.env` (currently verified via robust sandbox simulation and signature validation suites).
2. **Physical Thermal Printer Hardware:** Network TCP socket communication to physical 80mm ESC/POS printers (Port 9100) requires physical printer hardware on the local network (currently verified via protocol byte-stream generation tests).
