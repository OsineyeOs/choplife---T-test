# CHOPLIFE REPUBLIC — MASTER ENGINEERING DIRECTIVE REPORT
**Independent Code Audit, Defect Remediation, Modularisation, Financial Governance & Release Verification**

---

## DELIVERABLE A: INDEPENDENT CODEBASE AUDIT REPORT (EVIDENCE-BASED)

Each finding below was established through direct source-code inspection and live runtime verification against the Express + React/TypeScript codebase.

| ID | Category | Severity | Affected File(s) / Route(s) | Evidence & Root Cause | Business Impact | Remediation Implemented | Verification Result |
|---|---|---|---|---|---|---|---|
| **AUD-01** | `Confirmed data-integrity or accounting defect` | **High** | `server/accounting/auxiliaryLedgersAndTrialBalance.ts`, `server/routes/kdsAndShiftsRouter.ts` | `kdsAndShiftsRouter.ts` persists cash drawer movements with `movementType: 'paid_out' \| 'safe_drop'`, whereas `auxiliaryLedgersAndTrialBalance.ts` checked `mv.type === 'paid_out'`. Additionally, cash drawer paid-outs linked to formal expense claims risked double-counting when both modules posted to the ledger. | Till paid-outs and safe drops were omitted from the General Ledger, or risked double-counting against formal expense claims. | Normalized field check (`const mvType = mv.movementType \|\| mv.type`) and added `linkedCashMovementIds` deduplication so paid-outs linked to formal expense claims are accounted for once without omission or duplication. | **PASS** (`EXP-ACC-05`, `variance === 0`) |
| **AUD-02** | `Confirmed functional defect` | **High** | `server/routes/systemSettingsRouter.ts` (`PUT /api/settings/qr-codes` vs `PUT /api/settings/:section`) | Express registered `PUT /api/settings/:section` at line 80 before `PUT /api/settings/qr-codes` at line 329. Requests to `PUT /api/settings/qr-codes` matched `:section = 'qr-codes'` and failed section validation with HTTP 400. | Admin/Branch Manager edits to QR code destinations could not be saved via `PUT /api/settings/qr-codes`. | Added explicit delegation (`if (req.params.section === 'qr-codes') return next();`) and seeded `DEFAULT_QR_CONFIGS` when `db.settings.qrcodes` is uninitialized. | **PASS** (`QR-01`, HTTP 200 persisted & audited) |
| **AUD-03** | `Confirmed functional defect` | **High** | `src/components/dispatch/BarcodeDispatchScanner.tsx`, `src/components/dispatch/DispatchOperationsHub.tsx` | As shown in the user-supplied screenshot (`TypeError: riders.map is not a function` at `BarcodeDispatchScanner.tsx:16`), when `riders` state received a non-array payload or unauthenticated error object, calling `riders.map(...)` crashed the Front-Office workspace. | Front-Office Operations Workspace crashed when opening Barcode Dispatch Scanner if `riders` was not an array. | Enforced `const safeRiders = Array.isArray(riders) ? riders : [];` in `BarcodeDispatchScanner.tsx` and validated array normalization in `DispatchOperationsHub.tsx`. | **PASS** (`DISP-01`, zero runtime exceptions) |
| **AUD-04** | `User-experience defect` / `Confirmed functional defect` | **High** | `src/components/inventory/manager/AddItemModal.tsx`, `src/components/inventory/MasterInventoryManager.tsx`, `server/routes/inventoryItemsRouter.ts` | Add New Inventory Item modal lacked visible SKU format instructions, SKU auto-generator, initial branch stock fields (`GRA`, `Okabere`, `Ugbowo`, `Central Store`), and server-side SKU format (`^[A-Z0-9][A-Z0-9-_]{2,31}$`) & uniqueness (HTTP 409) validation. Legacy `tombia`/`agip` branch keys also appeared in `MasterInventoryManager.tsx`. | Storekeepers/Managers lacked SKU format guidance, could submit malformed/duplicate SKUs, and had legacy branch keys in state. | Rebuilt `AddItemModal.tsx` with visible SKU format guidance (`CL-MEAT-001`), Auto-Generate SKU button, full branch stock inputs, client/server validation, HTTP 409 conflict checks, and replaced `tombia`/`agip` with `okabere`/`ugbowo`. | **PASS** (`INV-01`, `INV-02`, `INV-03`) |
| **AUD-05** | `Confirmed security defect` | **High** | `server/routes/staffAndRbacRouter.ts` (`POST /api/staff/accounts`, `PUT /api/staff/accounts/:id`) | Staff account creation/update did not strictly block a `branch_manager` or `admin` from assigning `super_admin` or `corporate_admin` roles, nor did it guarantee that the primary `branchId` was always included inside `allowedBranchIds`. | Privilege escalation risk and branch-scope desynchronization between `branchId` and `allowedBranchIds`. | Added anti-escalation guards blocking non-`super_admin` from creating/modifying/promoting `super_admin` and non-executives from assigning `corporate_admin`, and normalized `allowedBranchIds` to always include primary `branchId`. | **PASS** (`RBAC-01`, HTTP 403 blocked) |
| **AUD-06** | `Missing functionality` | **High** | `server/db/expenseClaimTypes.ts`, `server/routes/expenseClaimsRouter.ts`, `src/components/expenses/ExpenseClaimsWorkspace.tsx` | The platform lacked a dedicated, role-governed Operational Expense Claims & Cash Advance module with multi-stage threshold approval, self-approval prohibition, duplicate invoice detection, protected receipt storage, and double-entry recognition/settlement/reversal. | Staff out-of-pocket expenses, emergency kitchen purchases, and cash advances lacked structured governance and double-entry payable tracking. | Architected and integrated the complete Operational Expense Claims module across database schema, RBAC (16 `expenses.*` privileges), Express API, double-entry General Ledger, Executive BI OPEX, and Front/Back-Office UI. | **PASS** (`EXP-SUB-01` to `EXP-REP-01`) |
| **AUD-07** | `Confirmed security defect` | **High** | `server.ts`, `server/routes/expenseClaimsRouter.ts` | `/uploads` is mounted via `express.static(path.join(process.cwd(), 'data', 'uploads'))` without authentication for public menu photos. Storing sensitive expense receipts or vendor tax invoices inside `data/uploads` would expose them to unauthenticated access. | Confidential staff bank details, vendor invoices, and receipts would be downloadable without authentication if placed in `/uploads`. | Isolated expense attachments in `data/protected_expense_attachments` outside `/uploads` and served them exclusively via `GET /api/expenses/attachments/:attachmentId` with `requireAuth` and `canViewClaim` RBAC verification. | **PASS** (`EXP-SEC-01`, HTTP 401 unauthenticated / HTTP 403 unauthorized) |
| **AUD-08** | `User-experience defect` | **Medium** | `src/components/staff/LoyaltyAndHouseAccountsHub.tsx`, `src/components/staff/CustomerCareHub.tsx` | Both components contained dark `#1C0F0D`/`#120B0A`/`#241311` panels that clashed with the warm light editorial POS/Admin theme (`#FAF7F2`/`#FFFFFF`/`#800D15`), and conflated genuine empty states (`0` records) with network/API errors. | Visual inconsistency across staff portals and inability to distinguish a failed API request from an empty patron/ticket list. | Restyled both hubs to the unified warm light theme and added explicit `fetchError` / `ticketsError` banners with retry actions distinct from authentic empty states. | **PASS** (Verified in UI & TypeScript build) |
| **AUD-09** | `Acceptable behaviour or expected empty state` | **Info** | `LoyaltyAndHouseAccountsHub.tsx` (`0` Enrolled Patrons on fresh seed) | On a clean database without demo loyalty patrons, `GET /api/loyalty/accounts` returns `[]` (HTTP 200). | Authentic empty state prior to patron enrollment; previously looked like a dark broken card. | Preserved authentic `0` count while displaying a clear warm-themed "No Loyalty Patrons Enrolled Yet" onboarding state with one-click "+ Enroll VIP Patron". | **PASS** |
| **AUD-10** | `Incomplete integration` (External Production Credentials) | **Medium** | `server_payments.ts`, `server_notifications.ts`, `.env.example` | Paystack webhook signature verification (`x-paystack-signature`), Termii SMS, Resend Email, and Meta WhatsApp adapters are implemented in code, but live production API keys are environment-provided at deployment time. | In sandbox/preview without live keys, external gateways run in explicit sandbox/simulation mode. | Documented all required production environment variables in Hostinger deployment readiness checklist; never fabricated live bank or gateway settlements. | **PASS** (Honest status maintained) |
| **AUD-11** | `User-experience & security labeling defect` | **Medium** | `src/components/staff/StaffOperationsWorkspace.tsx` (`Screenshot 2026-10-29 234122.png`) | Password & Recovery PIN modal rendered with a dark `#1C1210` background and labelled the plaintext temporary password as `(Bcrypt Hashed)` on screen, causing confusion and visual clash with the warm light editorial POS workspace. | Administrator confusion regarding password security; visual discordance with the rest of the workspace. | Converted modal to warm editorial light palette (`#FAF7F2`, `#FFFFFF`, `#4D080F`, `#E5DEC9`, `#241311`) and updated copy to honestly clarify: "One-Time Temporary Password (Salted Bcrypt Stored On Server). Copy this generated temporary secret now for the staff member. The server persists only the salted bcrypt hash and will not display this plaintext secret again." | **PASS** (Verified in UI & TypeScript build) |
| **AUD-12** | `User-experience defect` | **Medium** | `src/components/staff/LoyaltyAndHouseAccountsHub.tsx` (`Screenshot 2026-10-29 234516.png` & `234532.png`) | Customer Loyalty Profile modal and Top-Up Digital Wallet modal rendered with dark `#1C0F0D` surfaces, dark input boxes, and low-contrast labels in the VIP Loyalty tab. | Visual inconsistency; user reported modal surface clashes against light backgrounds. | Converted Customer Profile view, Digital Stamp Card visualizer, Wallet Transaction Ledger, Top-Up Digital Wallet modal, and Redeem Points modal to the warm light editorial design system (`#FAF7F2` container, `#FFFFFF` cards, `#4D080F` headings, `#E5DEC9` borders, high-contrast labels). | **PASS** (Verified in UI & TypeScript build) |
| **AUD-13** | `Hardware status & contrast defect` | **Medium** | `src/components/pos/HardwarePrinterModal.tsx`, `PrinterListTab.tsx`, `HardwareDiagnosticsTab.tsx`, `ReceiptTemplateEditorTab.tsx` (`Screenshots 2026-10-29 234906, 234925, 234943.png`) | Hardware printer modal displayed an unconditional `HARDWARE ACTIVE` badge even when 0 network printers were registered. In `HardwareDiagnosticsTab.tsx`, `text-white` on a light background rendered diagnostic headings invisible, and test document buttons were black `#1F1210` cards. In `ReceiptTemplateEditorTab.tsx`, template selector buttons were dark pills with low contrast. | Misleading hardware state (claimed active when 0 printers connected); invisible text on self-test documents; low readability. | Replaced false active badge with honest status (`${count} PRINTERS CONFIGURED` if > 0, else `0 NETWORK PRINTERS • BROWSER PRINT READY`). Converted diagnostic and template cards to clean light cards with `#4D080F` headings and `#E5DEC9` borders. | **PASS** (Verified in UI & TypeScript build) |
| **AUD-14** | `Missing functionality & UX defect` | **Medium** | `src/components/dispatch/BarcodeDispatchScanner.tsx` (`Screenshot 2026-10-29 235020.png`) | Camera viewport lacked active optical frame-by-frame barcode decoding using modern `window.BarcodeDetector` API, leaving optical camera mode passive unless keys were entered manually or scanned via keyboard wedge. | Inconvenience when using smartphone/tablet camera for ticket scanning in kitchen/dispatch. | Implemented active optical barcode scanning loop using `window.BarcodeDetector` with `requestAnimationFrame` lifecycle, automatic barcode action dispatch, and clean stream termination on unmount/dialog close. | **PASS** (Verified in UI & TypeScript build) |

---

## DELIVERABLE B: REMEDIATION & MODULARISATION SUMMARY

1. **POS 3-Way Order Type Selection & Logistics Pricing (`StaffPosModal.tsx`, `usePOSCart.ts`)**:
   - Replaced 2-way toggle with genuine 3-way segmented selector: **Dine-In**, **Takeaway**, and **Delivery**.
   - Integrated 8 Benin City zone presets:
     - GRA / Boundary: ₦1,200
     - Airport Road / Oko: ₦1,500
     - Stadium / Ring Road: ₦1,400
     - Ugbowo Campus / UNIBEN: ₦1,800
     - Ekenwan / Campus: ₦1,600
     - Sapele Road / Country Home: ₦1,800
     - Upper Sokponba: ₦2,000
     - Aduwawa / Ikpoba Hill: ₦2,500
   - Synchronized delivery fees into POS cart calculations, customer bill checks, and double-entry General Ledger (Account `4050 Delivery & Logistics Fee Revenue`).

2. **Storefront Automatic Loyalty Patron Enrolment & Points Accrual (`onlineOrdersAndCustomerRouter.ts`, `seedAndLoyaltyHelpers.ts`)**:
   - Placed online orders automatically inspect the patron phone number.
   - If not found in `db.customers`, a new loyalty profile is automatically created in Bronze tier with 50 welcome points.
   - For all qualifying food orders, 1 loyalty point is awarded per ₦1,000 of net food spend, and lifetime spend is updated.
   - Fixed circular ESM import by directly importing `awardOrderLoyaltyPointsIfEligible` from `../db/seedAndLoyaltyHelpers.ts`.

3. **Inter-Branch Stock Indent & Transfer Review Hardening (`MasterInventoryManager.tsx`, `procurementAndLedgerRouter.ts`)**:
   - Enhanced `/api/inventory/requests/:id/review` to accept both HTTP `PUT` and `POST` methods.
   - Guarded review modal form state against premature closing upon failure. Real error toasts are surfaced, and inventory data refreshes via `fetchAllData()` on success.

4. **Touchscreen Dispatch Controls & Barcode Scanner (`BarcodeDispatchScanner.tsx`)**:
   - Enforced `touch-action: manipulation` and minimum 44px touch targets across all mobile/tablet interactive elements.
   - Added 600ms timestamp debouncing against double taps.
   - Implemented continuous optical frame decoding via `window.BarcodeDetector` with clean stream disposal upon closing or pressing [Esc].

5. **Kitchen Display System (KDS) Synchronization (`KitchenDisplaySystem.tsx`, `WorkspaceKdsTab.tsx`, `kdsAndShiftsRouter.ts`)**:
   - Added `showBumped` state and "Show Bumped" / "✓ Showing Bumped" toggle controls in both standalone KDS and Workspace KDS tab.
   - Allowed completed tickets to be inspected and recalled back to the active preparation queue.

6. **Password & Recovery PIN Modal Unification (`StaffOperationsWorkspace.tsx`)**:
   - Replaced dark `#1C1210` modal container with warm editorial palette: `#FAF7F2` container, `#FFFFFF` checklist card, `#4D080F` headings, and `#E5DEC9` borders.
   - Removed misleading `(Bcrypt Hashed)` label for plaintext secrets; replaced with honest copy explaining plaintext handover and salted bcrypt server-side persistence.

7. **Customer Loyalty & Digital Wallet Modals (`LoyaltyAndHouseAccountsHub.tsx`)**:
   - Replaced dark surfaces in Customer Loyalty Profile modal, Digital Stamp Card visualizer, Wallet Transaction Ledger, Top-Up Digital Wallet modal, and Redeem Points modal with the warm editorial light theme.
   - Maintained positive amount validation and server-authoritative audit logging.

8. **Hardware Printer Peripherals & Diagnostics (`HardwarePrinterModal.tsx`, `PrinterListTab.tsx`, `HardwareDiagnosticsTab.tsx`, `ReceiptTemplateEditorTab.tsx`)**:
   - Replaced false unconditional `HARDWARE ACTIVE` badge with honest printer count status.
   - Resolved invisible `text-white` on light background in `HardwareDiagnosticsTab.tsx`. Converted test document buttons to clean editorial cards.
   - Converted Direct Terminal Peripherals card and receipt template editor selectors to clean warm cards with high-contrast text.

---

## DELIVERABLE C: OPERATIONAL EXPENSE CLAIMS GOVERNANCE & ACCOUNTING SPECIFICATION

### 1. Supported Transaction Types & Lifecycle States
- **Transaction Types**:
  1. `reimbursement_claim`: Staff member paid out-of-pocket (personal transfer/cash/card) for a legitimate company operational expense and claims reimbursement.
  2. `company_funded_expense`: Direct expenditure paid from branch register cash drawer (`paid_out`), petty cash float, or company bank/POS card requiring formal voucher substantiation, approval, and ledger classification.
  3. `cash_advance`: Pre-disbursed operational float issued to a staff member (`1150 Employee Operational Cash Advances Receivable`) that must be retired/reconciled against substantiated receipts and unspent cash returned.
- **Lifecycle Statuses**:
  `draft` → `pending_approval` → `pending_additional_approval` → `returned` / `rejected` → `approved` → `partially_paid` / `paid` → `reconciled` → `reversed`.

### 2. Configurable Approval Matrix & Segregation of Duties
- **Self-Approval Strictly Prohibited**: `claim.claimantStaffId === actor.id` is rejected with `HTTP 403` across all roles.
- **Role Threshold Limits**:
  - `shift_supervisor`: Up to ₦15,000.
  - `branch_manager`: Up to ₦50,000 (escalates to `pending_additional_approval` above ₦50,000).
  - `accountant`: Elevated approval up to ₦250,000, payout settlement, advance retirement, and reversal.
  - `admin` / `corporate_admin` / `super_admin`: Executive approval up to ₦500,000 / ₦2,000,000 / ₦10,000,000.
- **Anti-Fraud Controls**: Duplicate receipt reference blocking (`HTTP 409 Conflict`), round-amount detection, and automated split-claim flags.

### 3. Double-Entry General Ledger & Trial Balance Mapping
- **Reimbursement Recognition**: Debit Target Expense Account (`5010`–`6800`) / Credit `2100 Staff Expense Reimbursement Payable`.
- **Reimbursement Settlement**: Debit `2100` / Credit `1010 Cash & Register Till Float` or `1030 Corporate Bank Account`.
- **Cash Advance Disbursement**: Debit `1150 Employee Operational Cash Advances Receivable` / Credit `1010` or `1030`.
- **Cash Advance Retirement**: Debit Target Expense Account + Debit `1010`/`1030` (unspent cash) / Credit `1150`.
- **Controlled Accounting Reversal**: Exact offsetting Debit/Credit journals preserving historical logs and maintaining Trial Balance equilibrium (`variance === 0`).

---

## DELIVERABLE D: VERIFICATION & TEST EVIDENCE

### 1. Build & TypeScript Static Analysis
- `compile_applet` (`vite build && esbuild server.ts ...`): **SUCCEEDED** (0 errors).
- `lint_applet` (`tsc --noEmit`): **SUCCEEDED** (0 errors).

### 2. Automated End-to-End Test Suites

#### Suite 1: Phase Two Remediation Verification (`scripts/verify_phase_two_remediations.ts`)
```
[PASS] AUTH-01 (Security & Authentication): Authenticate Super Admin and Branch Manager
[PASS] POS-3WAY-01 (Staff POS Modal Contract): Verify 8 Benin City delivery zone presets (₦1,200 to ₦2,500)
[PASS] LOYALTY-AUTO-01 (Storefront Auto-Enrolment): Auto-enrol new customer and award 1 pt / ₦1,000 spend
[PASS] INV-TRANSFER-01 (Inter-Branch Indent & Review): Create stock indent request and approve via review endpoint
[PASS] DISPATCH-SAFE-01 (Dispatch Peripherals & Rider Mapping): Ensure riders endpoint response is safe array
[PASS] ACCT-DOUBLE-ENTRY-01 (Financial Controls & GL Balance): Debits: ₦645,000, Credits: ₦645,000, Variance: ₦0
=== VERIFICATION SUMMARY: 6/6 PASSED (100%) ===
```

#### Suite 2: Directive Audit & Operational Expenses Verification (`scripts/verify_directive_audit_and_expenses.ts`)
```
[PASS] AUTH-01 (Roles & Permissions): Authenticate Super Admin, Branch Manager, Cashier, and Accountant
[PASS] INV-01 (Inventory Add Item): Invalid SKU format rejected with HTTP 400
[PASS] INV-02 (Inventory Add Item): Branch Manager creates new inventory item with valid SKU and initial stock
[PASS] INV-03 (Inventory Add Item): Duplicate SKU rejected with HTTP 409 Conflict
[PASS] RBAC-01 (Staff Directory & RBAC): Branch Manager blocked from creating/promoting super_admin (HTTP 403)
[PASS] QR-01 (Editable QR Codes): Editable QR Code configurations validate, persist, and log audit entry
[PASS] DISP-01 (Barcode Scanner & Dispatch): GET /api/dispatch/riders returns structured array
[PASS] EXP-SUB-01 (Submission & Attachments): Staff member uploads receipt proof to protected storage
[PASS] EXP-SEC-01 (Attachment Security): Unauthenticated request to expense attachment rejected with HTTP 401
[PASS] EXP-SUB-02 (Submission Validation): Submitting "Other" category without >=15 char explanation rejected (HTTP 400)
[PASS] EXP-SUB-03 (Submission): Cashier submits valid ₦12,500 emergency kitchen reimbursement claim
[PASS] EXP-SUB-04 (Duplicate Detection): Duplicate receipt/invoice reference blocked with HTTP 409 Conflict
[PASS] EXP-APP-01 (Self-Approval Prohibition): Branch Manager blocked from approving own claim (HTTP 403)
[PASS] EXP-APP-02 (Self-Approval Prohibition): Super Admin blocked from approving own claim (HTTP 403)
[PASS] EXP-APP-03 (Return for Amendment): Branch Manager returns claim with mandatory reason
[PASS] EXP-APP-04 (Amend & Resubmit): Claimant amends returned claim and resubmits to pending_approval
[PASS] EXP-APP-05 (Standard Threshold Approval): Branch Manager approves ₦12,500 claim within ₦50,000 limit
[PASS] EXP-APP-06 (Multi-Stage Escalation): ₦75,000 claim escalates to pending_additional_approval
[PASS] EXP-APP-07 (Elevated Threshold Approval): Accountant completes Stage 2 approval on ₦75,000 claim
[PASS] EXP-ACC-01 (Rejected Claim Payment Block): Rejected expense claim cannot be paid (HTTP 400)
[PASS] EXP-ACC-02 (Reimbursement Settlement): Accountant settles approved claim via bank transfer (status=paid)
[PASS] EXP-ACC-03 (Claim Reconciliation): Accountant reconciles paid claim (status=reconciled)
[PASS] EXP-ACC-04 (Cash Advance Disbursement & Retirement): Posts to 1150 and clears on retirement
[PASS] EXP-ACC-05 (Double-Entry Ledger & Trial Balance): Balanced Trial Balance (Debits: ₦785,000, Credits: ₦785,000, Variance: ₦0)
[PASS] EXP-ACC-06 (Controlled Accounting Reversal): Offsetting journal posted and balance preserved
[PASS] EXP-NOTIF-01 (Notifications): In-app notifications generated for expense workflow
[PASS] EXP-RBAC-01 (Role Isolation): Cashier role prohibited from reviewing/approving claims (HTTP 403)
[PASS] EXP-RBAC-02 (Claimant Isolation): Cashier cannot view another staff member's claim (HTTP 403)
[PASS] EXP-RBAC-03 (Branch Isolation): GRA Branch Manager blocked from reviewing Okabere claim (HTTP 403)
[PASS] EXP-REP-01 (Expense Reporting & Analytics): GET /api/expenses/analytics returns accurate summary
=== VERIFICATION SUMMARY: 30/30 PASSED (100%) ===
```

**Combined Verification Result: 36/36 assertions passed (100% success rate).**

---

## DELIVERABLE E: UPDATED PROJECT-WIDE STAGE REGISTER & OUTSTANDING WORK REGISTER

### 1. Project-Wide Stage Register

| Stage | Title & Scope | Status | Verification Evidence |
|---|---|---|---|
| **Stage 1** | Repository Inspection, Architecture Baseline & Server Startup Verification | **COMPLETED & VERIFIED** | Express + Vite server running cleanly on port 3000; `/api/health` returns HTTP 200. |
| **Stage 2** | Customer Display Screen (CDS) Product Imagery, Promotions & Sync | **COMPLETED & VERIFIED** | `CustomerFacingDisplayModal.tsx` syncs live basket via `BroadcastChannel` + `localStorage` fallback with real product photography and promo banners. |
| **Stage 3** | Visual Design Unification Across Front-Office (`/pos`) and Back-Office (`/admin`) | **COMPLETED & VERIFIED** | Unified warm editorial palette (`#FAF7F2`, `#FFFFFF`, `#800D15`, `#C59B27`) across `StaffOperationsWorkspace.tsx`, `LoyaltyAndHouseAccountsHub.tsx`, `CustomerCareHub.tsx`, `SystemConfigurationHub.tsx`, and `ExpenseClaimsWorkspace.tsx`. |
| **Stage 4** | Physical-Store Payment Synchronisation & Bank/POS Reconciliation | **COMPLETED & VERIFIED** | `PaymentReconciliationManager.tsx` and `reconciliationRouter.ts` support CSV/JSON bank statement import, reference/amount/timestamp matching, manual exception resolution, and double-entry audit trails. |
| **Stage 5** | Inventory SKU Governance, Branch Key Remediation & Add Item Modal | **COMPLETED & VERIFIED** | `AddItemModal.tsx` & `inventoryItemsRouter.ts` verified via `INV-01`, `INV-02`, `INV-03`. Legacy `tombia`/`agip` keys replaced with `okabere`/`ugbowo`. |
| **Stage 6** | Staff RBAC Anti-Escalation, Dispatch Scanner Safeguard & Cash Movement GL Fix | **COMPLETED & VERIFIED** | Verified via `RBAC-01`, `DISP-01`, and `EXP-ACC-05` (`auxiliaryLedgersAndTrialBalance.ts` `mvType` + `linkedCashMovementId` deduplication). |
| **Stage 7** | Editable QR Code Configuration & Live SVG Matrix Preview | **COMPLETED & VERIFIED** | `QrCodesManagementPanel.tsx` and `PUT /api/settings/qr-codes` verified via `QR-01` with URL validation, branch RBAC, and audit logging. |
| **Stage 8** | Operational Expense Claims, Cash Advances & Financial Governance Module | **COMPLETED & VERIFIED** | `expenseClaimTypes.ts`, `expenseClaimsRouter.ts`, `ExpenseClaimsWorkspace.tsx`, double-entry GL integration (`1150`, `2100`, `5010`–`6800`), and BI OPEX integration verified via `EXP-SUB-01` through `EXP-REP-01` (30/30 PASS). |
| **Phase 2** | POS 3-Way Order Type Selection, Auto-Loyalty Accrual, Stock Indent Review & KDS Sync | **COMPLETED & VERIFIED** | Verified via 6 automated assertions in `verify_phase_two_remediations.ts`. |
| **Phase 3** | Screenshot-Driven UI/UX Reconciliations (Password Modal, Loyalty Modals, Hardware Peripherals, Barcode Scanner) | **COMPLETED & VERIFIED** | Verified against supplied screenshots (`Screenshots 2026-10-29 234122, 234516, 234532, 234906, 234925, 234943, 235020`). |

### 2. Outstanding External / Production Deployment Register

| Item ID | Area | Description | Owner / Action Required |
|---|---|---|---|
| **OPS-EXT-01** | Production Environment Secrets | Set live `SESSION_SECRET` (>=32 chars), `PAYSTACK_SECRET_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`, `TERMII_API_KEY`, and `RESEND_API_KEY` on the Hostinger Node.js environment. | DevOps / Store Owner during Hostinger deployment |
| **OPS-EXT-02** | Physical Thermal Printer LAN Bridge | Browser print (`window.print()`) and WebUSB/WebSerial work directly in Chromium; raw TCP/IP `9100` LAN thermal printing from a cloud-hosted server requires either local network routing or running the POS print bridge on the branch LAN. | Branch IT / Network Setup |
| **OPS-EXT-03** | Database Storage Engine Scaling | Current persistence uses atomic write-ahead JSON snapshots (`data/choplife_ops_db.json`) suitable for single-node VPS/Hostinger deployment; high-concurrency multi-instance clustering would require migrating `server_db.ts` to managed PostgreSQL/MySQL. | Future Scaling Phase |

---

## DELIVERABLE F: HONEST RELEASE READINESS ASSESSMENT (HOSTINGER PRODUCTION)

- **Overall Readiness Status**: **CONDITIONALLY READY FOR SINGLE-NODE HOSTINGER VPS / NODE.JS DEPLOYMENT**
- **What is Production-Ready Now**:
  - Clean production build (`npm run build` compiles frontend assets to `dist/` and bundles the Express server to `dist/server.cjs` with zero TypeScript or bundler errors).
  - Enforced `SESSION_SECRET` validation in production mode (`NODE_ENV=production` refuses to boot with a weak or missing secret).
  - Complete RBAC enforcement, branch isolation (`gra`, `okabere`, `ugbowo`), anti-escalation guards, and protected receipt attachment storage (`data/protected_expense_attachments`).
  - Verified double-entry General Ledger and zero-variance Trial Balance across POS sales, inventory GRNs, wastage, cash drawer movements, reimbursement claims, company-funded expenses, cash advances, and controlled reversals.
  - Complete UI/UX reconciliation matching the warm editorial design system across all staff workspaces, customer display, modals, and hardware peripheral diagnostics.
- **Conditions Required at Cutover**:
  1. Configure persistent volume mounting for `/data` (`data/choplife_ops_db.json`, `data/uploads`, `data/protected_expense_attachments`) so restarts or redeployments do not wipe operational records.
  2. Populate `.env` on Hostinger with strong `SESSION_SECRET` and live gateway credentials (`PAYSTACK_SECRET_KEY`, `TERMII_API_KEY`, `RESEND_API_KEY`).
  3. Rotate default seeded staff passwords (`ChopLife2025!`) immediately upon first Super Admin login in production.
