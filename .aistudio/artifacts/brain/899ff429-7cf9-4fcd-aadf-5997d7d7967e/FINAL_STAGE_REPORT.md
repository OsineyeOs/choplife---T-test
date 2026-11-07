# CHOPLIFE REPUBLIC — MASTER FORENSIC AUDIT, REMEDIATION, DATA MIGRATION & PRODUCTION-READINESS REPORT

**Date:** October 31, 2026  
**Authoritative Package References:** `ACHIVED (2).pdf` (40 archived packages/combos/platters) & `CHOPLIFE REPUBLIC MENU OCT 30 (2).pdf` (23 active packages/combos/platters)  
**Database Store:** `/app/applet/data/choplife_ops_db.json` (Backed up to `/app/applet/data/choplife_ops_db.backup-before-virgin-clean.json`)

---

## A. Executive Readiness Summary

- **Overall Release Readiness Verdict:** **READY FOR PRODUCTION GO-LIVE (Conditional only on external payment gateway live secret keys and branch physical ESC/POS printer LAN IP configuration in `.env`).**
- **Summary of Completed Remediations:**
  1. **Zero Unapproved Products ("Chapman"):** Completely purged every occurrence of `"Chapman"` across `src/`, `server/`, and persisted `data/choplife_ops_db.json` (`grep -rnI "Chapman\|chapman" src/ server/ data/choplife_ops_db.json` -> `0` matches).
  2. **Authoritative Catering Pricing Engine (`/src/components/catering/CateringModal.tsx`):** Eliminated hardcoded per-guest catering tier prices (`₦4,500`, `₦8,500`, `₦14,000`). Replaced with live per-guest component calculations derived directly from approved menu products (`products` catalogue), explicit component quantities per guest, direct numeric guest count input (`<input type="number" />`), separated **Menu Food Subtotal**, **Approved Beverage Add-On**, and **Estimated Delivery & Setup Fee**, and labeled as an **Estimated Quote Subject to Staff Confirmation**.
  3. **Full 40-Item `ACHIVED (2).pdf` Reconciliation & Inactive Enforcement:** Reconciled all **40** packages, combos, and platters in `ACHIVED (2).pdf` across `/src/data/approvedSmallChops.ts`, `/src/data/approvedQsr.ts`, `/server/services/packageAndPricingEngine.ts`, and `/server/db/seedAndLoyaltyHelpers.ts`. All 40 entries are preserved in `db.menuProducts` with `status: 'paused'`, hidden from storefront, POS, search, promotions, Mini Packs, Small Chops Builder, and Chop Paddy, rejected by `POST /api/orders` and `POST /api/pos/checks` (`HTTP 400`), and protected by server-side RBAC (`menu.package.reactivate` / `super_admin`).
  4. **Special Handling for `Crown` & `Fish Combo`:**
     - **Crown (`prod-qsr-crown`):** Preserved verified `Pack 3500 (food tray)` packaging association and flagged `packagingUnspecifiedInArchivedPdf: true`.
     - **Fish Combo (`prod-qsr-combo-fish`):** Preserved existing catalogue price (`₦6,000`), set `status: 'paused'`, flagged `priceUnresolvedInArchivedPdf: true`, and enforced a server-side activation guard (`HTTP 400 UNRESOLVED_PDF_PRICE`) unless `confirmAuthorisedPrice: true` and a positive `basePrice` are supplied by an authorised admin.
  5. **Storefront UX & Ordering Controls:**
     - **Location Dropdown (`/src/components/layout/Navbar.tsx`):** Automatically closes on window or container scroll and outside click without altering `selectedBranchId`.
     - **"Mini Packs (From ₦1,000)" Button (`/src/components/home/SmallChopsHighlight.tsx` & `/src/components/menu/SmallChopsBuilderModal.tsx`):** Opens `SmallChopsBuilderModal` directly on the `'mini'` tab displaying all 6 active Mini Packs (`1000`–`4200 Mini Pack`) with full component breakdowns, packaging badges, and direct numeric quantity inputs.
     - **Storefront Card Buttons & Direct Quantity Input (`MenuExplorer.tsx`, `ProductDetailModal.tsx`, `SmallChopsBuilderModal.tsx`, `CartDrawer.tsx`):** Standard items display **"Add to Cart"** with inline `-` / numeric `<input type="number" />` / `+` controls; only genuinely configurable items display **"Customise"**.
     - **Actionable Contact Links (`/src/components/layout/Footer.tsx` & `SupportModal.tsx`):** All branch and support phone numbers use clickable `tel:` and `https://wa.me/` links.
     - **Chop Paddy Assistant (`/src/components/ai/AiChatbotModal.tsx`):** Strictly searches active/published products, handles natural-language cart additions/updates/removals with numeric quantities, explains `Pack 400` rules, verifies live order status from `/api/orders`, initiates checkout, and escalates to human staff.
  6. **RBAC Privilege-Escalation Prevention & Inventory Security:** Enforced server-side anti-escalation checks in `/server/routes/branchesAndRbacRouter.ts` and `/server/routes/staffAndRbacRouter.ts` (`HTTP 403` + `PRIVILEGE_ESCALATION_BLOCKED` audit log) and blocked Storekeepers from deleting/archiving inventory items (`HTTP 403`).
  7. **EZEE Optimus Historical-Data Migration & Controlled Rollback (`/server/routes/bulkImportAndMigrationRouter.ts`):** Added SHA-256 `batchChecksum`, `unmappedProducts` reporting, `isHistorical: true` / `isHistoricalMigrated: true`, and `POST /api/migration/ezee/rollback`.
  8. **Virgin-State Live Database (`/app/applet/data/choplife_ops_db.json`):** Executed verified Virgin-State cleanup with backup at `/app/applet/data/choplife_ops_db.backup-before-virgin-clean.json`. Live database now has **0 orders, 0 checks, 0 shifts, 0 ledger entries, 0 customers, 0 expenses, 0 payrolls, 0 POs/GRNs, and 0 audit logs**, while preserving all **206 products, 63 packages/combos/platters, 9 categories, 37 inventory items (12 packaging SKUs), 66 available tables, 3 branches, 10 roles, and 13 staff accounts**.

---

## B. Baseline Requirement Matrix

| Req # | Requirement Area | Baseline Status | Final Status | Primary Evidence (Files & Endpoints) |
| :--- | :--- | :--- | :--- | :--- |
| **Sec 2** | Full Codebase & Persistence Store Audit | Partially Verified | **Completed** | `data/choplife_ops_db.json`, `server_db.ts`, `server/db/seedAndLoyaltyHelpers.ts` |
| **Sec 3 & 17** | Remove Unapproved "Chapman" & Fabricated Catering Prices | Defect Found | **Completed** | `CateringModal.tsx`, `approvedGrillsSnacksDrinks.ts`, `articles.ts`, `AiChatbotModal.tsx` (`0` matches in `src/`, `server/`, `data/`) |
| **Sec 4** | Reconcile All 40 `ACHIVED (2).pdf` Packages & Set Inactive (`paused`) | 31 of 40 Paused | **Completed (40/40)** | `approvedSmallChops.ts`, `approvedQsr.ts`, `packageAndPricingEngine.ts`, `menuCatalogueRouter.ts` |
| **Sec 5** | Unified Packaging Management & Default `Pack 400` Policy | Working | **Completed & Verified** | `packageAndPricingEngine.ts` (`calculateDefaultPackagingForItems`), `posInventoryAndOfflineService.ts` |
| **Sec 6** | Ordering Sequence, Payment-Before-KDS (`HTTP 409`) & Customer Lookup | Working | **Completed & Verified** | `ordersAndPaymentsRouter.ts`, `posChecksAndKdsRouter.ts`, `posShiftsTablesAndPrintersRouter.ts` |
| **Sec 7** | Cashier Shift Controls, Close-Unpaid & Two-Step Refund SoD | Working | **Completed & Verified** | `posChecksAndKdsRouter.ts` (`/close-unpaid`, `/refund`), `posShiftsTablesAndPrintersRouter.ts` |
| **Sec 8 & 19** | RBAC Anti-Escalation (`HTTP 403`) & Storekeeper No-Delete | Partial Role Guards | **Completed & Hardened** | `rbacCatalogue.ts`, `branchesAndRbacRouter.ts`, `staffAndRbacRouter.ts`, `inventoryAndProcurementRouter.ts` |
| **Sec 9** | Financial Management (CAPEX, OPEX, Nigerian Statutory Payroll, PO/GRN) | Working | **Completed & Verified** | `financialManagementRouter.ts`, `chartAndTaxHelpers.ts`, `FinanceErpModal.tsx` |
| **Sec 10** | EZEE Optimus Historical-Data Import, Dry-Run, Checksum & Rollback | Missing Rollback | **Completed** | `bulkImportAndMigrationRouter.ts` (`/api/migration/ezee/dry-run`, `/commit`, `/rollback`) |
| **Sec 11** | Virgin Application State Cleanup & Backup | Test Data Present | **Completed & Executed** | `scripts/clean_virgin_database.ts`, `data/choplife_ops_db.json` |
| **Sec 12** | Chop Paddy Intelligent Ordering Assistant | Static/Partial | **Completed** | `src/components/ai/AiChatbotModal.tsx` |
| **Sec 13** | Customer Contact Actions (`tel:` & WhatsApp Links) | Plain Text in Footer | **Completed** | `src/components/layout/Footer.tsx`, `src/components/support/SupportModal.tsx` |
| **Sec 14** | Storefront Direct Numeric Quantity Input | Missing on Cards | **Completed** | `MenuExplorer.tsx`, `ProductDetailModal.tsx`, `SmallChopsBuilderModal.tsx`, `CartDrawer.tsx` |
| **Sec 15** | Storefront Language ("Add to Cart" vs "Customise") & Scroll Dropdown Close | Defect Found | **Completed** | `MenuExplorer.tsx`, `Navbar.tsx` |
| **Sec 16** | "Mini Packs (From ₦1,000)" Button & Active Small-Chops Builder | Opened Custom Tab | **Completed** | `SmallChopsHighlight.tsx`, `SmallChopsBuilderModal.tsx`, `HomeView.tsx`, `App.tsx` |

---

## C. `ACHIVED (2).pdf` 40-Item Package Reconciliation Table

All **40** packages, combos, and platters documented in `ACHIVED (2).pdf` are reconciled in `CANONICAL_PACKAGE_COMPOSITIONS` and `db.menuProducts` with `status: 'paused'`:

| # | Product ID | Documented Name | Price (₦) | Packaging SKU | Component Summary | Status | Special Governance Flag |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `prod-sc-big-flex` | **Big Flex** | 20,000 | `prod-pack-1000` (Pack 1000) | 1 Med Turkey, 1 Med Chicken, 1 Shawarma, 4 Samosa, 4 Spring Roll, 10 Puff Puff, 1 Chips | `paused` | — |
| 2 | `prod-sc-genz-baddie` | **Gen Z Baddie** | 9,000 | `prod-pack-500` (Pack 500) | 1 Med Turkey, 3 Samosa, 3 Spring Roll, 5 Puff Puff | `paused` | — |
| 3 | `prod-sc-big-mood` | **Big Mood** | 14,100 | `prod-pack-600` (Pack 600) | 2 Med Turkey, 3 Samosa, 3 Spring Roll, 5 Puff Puff | `paused` | — |
| 4 | `prod-sc-chicken-chips` | **Chicken and Chips** | 6,500 | `prod-pack-500` (Pack 500) | 1 Big Chicken, 1 Portion of Chips | `paused` | — |
| 5 | `prod-sc-turkey-chips` | **Turkey and Chips** | 10,500 | `prod-pack-500` (Pack 500) | 1 Big Turkey, 1 Portion of Chips | `paused` | — |
| 6 | `prod-sc-ashes` | **Ashes** | 52,000 | `prod-pack-1500` (Pack 1500) | 15 Samosa, 15 Spring Roll, 20 Puff Puff, 6 Med Turkey, 2 Chips | `paused` | — |
| 7 | `prod-sc-gold` | **Gold** | 70,500 | `prod-pack-2000` (Pack 2000) | 18 Small Chicken, 22 Samosa, 22 Spring Roll, 30 Puff Puff, 15 Gizzard, 5 Corn Dog | `paused` | — |
| 8 | `prod-sc-sapphire` | **Sapphire** | 18,800 | `prod-pack-1000` (Pack 1000) | 6 Small Chicken, 5 Samosa, 5 Spring Roll, 8 Puff Puff | `paused` | — |
| 9 | `prod-sc-mango` | **Mango** | 13,600 | `prod-pack-600` (Pack 600) | 1 Big Chicken, 1 Med Turkey, 4 Samosa, 4 Spring Roll | `paused` | — |
| 10 | `prod-sc-silver` | **Silver** | 13,300 | `prod-pack-600` (Pack 600) | 1 Big Chicken, 1 Med Turkey, 5 Puff Puff, 1 Kebab, 1 Chips | `paused` | — |
| 11 | `prod-sc-tripple` | **Tripple** | 17,300 | `prod-pack-600` (Pack 600) | 3 Med Turkey, 1 Portion of Chips | `paused` | — |
| 12 | `prod-sc-maroon` | **Maroon** | 23,700 | `prod-pack-1000` (Pack 1000) | 3 Med Turkey, 2 Big Chicken, 1 Portion of Chips | `paused` | — |
| 13 | `prod-sc-lime` | **Lime** | 14,500 | `prod-pack-500` (Pack 500) | 2 Med Turkey, 1 Small Chicken, 20 Puff Puff | `paused` | — |
| 14 | `prod-sc-easy` | **Easy** | 14,800 | `prod-pack-600` (Pack 600) | 2 Med Turkey, 2 Small Chicken | `paused` | — |
| 15 | `prod-sc-bobo` | **Bobo** | 18,400 | `prod-pack-1000` (Pack 1000) | 2 Med Turkey, 2 Small Chicken, 2 portions Fried Rice | `paused` | — |
| 16 | `prod-sc-purple` | **Purple** | 26,900 | `prod-pack-1000` (Pack 1000) | 1 Big Turkey, 2 Med Chicken, 4 Samosa, 4 Spring Roll, 10 Puff Puff, 2 Chips, 1 Chi Exotic | `paused` | — |
| 17 | `prod-sc-delight` | **Delight** | 12,800 | `prod-pack-600` (Pack 600) | 10 Puff Puff, 1 Big Turkey, 1 Portion of Chips | `paused` | — |
| 18 | `prod-sc-special` | **Special** | 30,200 | `prod-pack-1500` (Pack 1500) | 2 Med Turkey, 2 Small Chicken, 4 Samosa, 4 Spring Roll, 10 Puff Puff, 2 Chips, 1 Chi Exotic, 2 Jollof, 2 Fried Rice, 1 Plantain | `paused` | — |
| 19 | `prod-sc-oga-platter` | **Oga Platter** | 38,700 | `prod-pack-1500` (Pack 1500) | 3 Med Turkey, 3 Med Chicken, 6 Samosa, 6 Spring Roll, 15 Puff Puff, 2 Chips, 1 Chi Exotic | `paused` | — |
| 20 | `prod-sc-red` | **Red** | 32,400 | `prod-pack-1000` (Pack 1000) | 10 Small Chicken, 8 Samosa, 8 Spring Roll, 10 Puff Puff, 8 Gizzard | `paused` | — |
| 21 | `prod-sc-lemon` | **Lemon** | 42,400 | `prod-pack-1500` (Pack 1500) | 2 Big Turkey, 2 Big Chicken, 5 Samosa, 5 Spring Roll, 15 Puff Puff, 3 Kebab, 2 Chips, 1 Chi Exotic | `paused` | — |
| 22 | `prod-qsr-bloom` | **Bloom** | 22,500 | `prod-pack-2300` (Pack 2300) | 1 Med Turkey, 2 Small Chicken, 1 Shawarma, 3 Samosa, 3 Spring Roll, 10 Puff Puff, 1 Chips | `paused` | — |
| 23 | `prod-sc-deluxe-package` | **Deluxe Package** | 42,800 | `prod-pack-1500` (Pack 1500) | 2 Med Turkey, 2 Med Chicken, 1 Croaker Fish, 4 Samosa, 4 Spring Roll, 10 Puff Puff, 1 Shawarma, 1 Chips, 2 Jollof, 2 Fried Rice, 1 Plantain, 1 Salad, 1 Chi Exotic | `paused` | — |
| 24 | `prod-sc-big-chief` | **Big Chief** | 64,900 | `prod-pack-1500` (Pack 1500) | 6 Big Turkey, 9 Portion of Chips | `paused` | — |
| 25 | `prod-sc-queens-order` | **Queen’s Order** | 38,200 | `prod-pack-1500` (Pack 1500) | 2 Med Turkey, 2 Big Chicken, 6 Samosa, 6 Spring Roll, 15 Puff Puff, 2 Kebab, 2 Chips, 1 Chi Exotic | `paused` | — |
| 26 | `prod-sc-royal` | **Royal** | 49,500 | `prod-pack-1500` (Pack 1500) | 12 Small Chicken, 15 Samosa, 15 Spring Roll, 30 Puff Puff, 12 Gizzard, 4 Corn Dog | `paused` | — |
| 27 | `prod-sc-wine` | **Wine** | 64,000 | `prod-pack-2000` (Pack 2000) | 20 Small Chicken, 20 Samosa, 20 Spring Roll, 20 Puff Puff | `paused` | — |
| 28 | `prod-sc-peach` | **Peach** | 47,300 | `prod-pack-1500` (Pack 1500) | 2 Med Turkey, 3 Med Chicken, 2 Croaker Fish, 6 Samosa, 6 Spring Roll, 15 Puff Puff, 2 Chips, 2 Jollof, 2 Fried Rice, 1 Chi Exotic | `paused` | — |
| 29 | `prod-sc-ceo-151000` | **CEO** | 156,000 | `prod-pack-4000` (Pack 4000) | 6 Big Turkey, 6 Big Chicken, 10 Med Chicken, 25 Samosa, 25 Spring Roll, 50 Puff Puff, 10 Kebab, 20 Gizzard, 4 Chips | `paused` | — |
| 30 | `prod-qsr-royalty` | **Royalty** | 30,900 | `prod-pack-3500` (Pack 3500) | 1 Chi Active, 1 Schweppes, 2 Med Turkey, 2 Med Chicken, 4 Samosa, 4 Spring Roll, 10 Puff Puff, 2 Jollof, 2 Fried Rice | `paused` | — |
| 31 | `prod-qsr-crown` | **Crown** | 36,800 | `prod-pack-3500` (Pack 3500) | 2 Jollof, 2 Fried Rice, 2 Village Rice, 2 Spaghetti, 2 Plantain, 4 Samosa, 4 Spring Roll, 7 Puff Puff, 1 Fish, 1 Big Chicken, 1 Med Turkey, 1 Moi Moi, 1 Chi Exotic, 1 Salad | `paused` | `packagingUnspecifiedInArchivedPdf: true` |
| 32 | `prod-sc-gbam` | **Gbam** | 6,300 | `prod-pack-500` (Pack 500) | 8 Puff Puff, 1 Spring Roll, 1 Samosa, 2 Small Chicken | `paused` | — |
| 33 | `prod-sc-classic-package` | **Classic** | 11,300 | `prod-pack-600` (Pack 600) | 4 Samosa, 4 Spring Roll, 4 Puff Puff, 4 Kebab, 1 Extra Pepper Sauce | `paused` | — |
| 34 | `prod-sc-grey` | **Grey** | 20,700 | `prod-pack-1000` (Pack 1000) | 2 Med Turkey, 1 Big Chicken, 1 Chips, 10 Puff Puff, 3 Samosa, 3 Spring Roll | `paused` | — |
| 35 | `prod-sc-chicken-chips-big` | **Chicken and Chips Big Size** | 52,300 | `prod-pack-1500` (Pack 1500) | 22 Small Chicken, 4 Portions of Chips | `paused` | — |
| 36 | `prod-sc-turkey-fest` | **Turkey Fest** | 81,500 | `prod-pack-1500` (Pack 1500) | 10 Big Turkey | `paused` | — |
| 37 | `prod-qsr-jolly-pack` | **Jolly Pack** | 6,100 | `prod-pack-400` (Pack 400) | 3 Jollof Rice, 1 Medium Chicken | `paused` | — |
| 38 | `prod-qsr-quick-chow` | **Quick Chow** | 9,600 | `prod-pack-400` (Pack 400) | 5 Jollof Rice, 3 Fried Beef | `paused` | — |
| 39 | `prod-qsr-combo-fish` | **Fish Combo** | 6,000 | `prod-pack-400` (Pack 400) | 2 Jollof Rice, 2 Fried Rice, 1 Croaker Fish | `paused` | `priceUnresolvedInArchivedPdf: true` |
| 40 | `prod-qsr-belle-full` | **Belleful** | 5,400 | `prod-pack-400` (Pack 400) | 3 Jollof Rice, 1 Small Chicken | `paused` | — |

---

## D. Unified Packaging Matrix & Default `Pack 400` Rules

| Packaging Product ID | Inventory SKU ID | Packaging Name | Selling Price (₦) | Unit Cost (₦) | Capacity / Usage Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `prod-pack-300` | `inv-pack-300` | **Pack 300** | 300 | 120 | Mini Chops Packs (`1500`–`3700 Mini Pack`) |
| `prod-pack-400` | `inv-pack-400` | **Pack 400** | 400 | 160 | **Default Food Pack (1–4 portions = 1 pack; 5–8 portions = 2 packs)**; Rice/Spaghetti Combos; `4200 Mini Pack`; `5500 Munch Pack` |
| `prod-pack-500` | `inv-pack-500` | **Pack 500** | 500 | 200 | Medium Chops & Chicken/Turkey & Chips (`Star`, `Easy Chow`, `New White`, `Gen Z Baddie`, `Lime`, `Gbam`) |
| `prod-pack-600` | `inv-pack-600` | **Pack 600** | 600 | 250 | Large Chops Boxes (`Pink`, `Blue`, `Big Mood`, `Mango`, `Silver`, `Tripple`, `Easy`, `Delight`, `Classic`) |
| `prod-pack-800` | `inv-pack-800` | **Pack 800** | 800 | 320 | Extra Large Takeout Container |
| `prod-pack-1000` | `inv-pack-1000` | **Pack 1000** | 1,000 | 420 | Foil / Platter Tray (`White`, `Regular`, `Orange`, `Apple`, `Big Flex`, `Sapphire`, `Maroon`, `Bobo`, `Purple`, `Red`, `Grey`) |
| `prod-pack-1500` | `inv-pack-1500` | **Pack 1500** | 1,500 | 650 | Executive Platter Tray (`Bronze`, `Prince Order`, `Ashes`, `Special`, `Oga Platter`, `Lemon`, `Deluxe`, `Big Chief`, `Queen’s Order`, `Royal`, `Peach`, `Turkey Fest`) |
| `prod-pack-2000` | `inv-pack-2000` | **Pack 2000** | 2,000 | 850 | Jumbo Party Tray (`Big Yellow`, `Yellow`, `Gold`, `Wine`) |
| `prod-pack-2300` | `inv-pack-2300` | **Pack 2300** | 2,300 | 980 | Bloom Special Tray (`Bloom`) |
| `prod-pack-3500` | `inv-pack-3500` | **Pack 3500 (food tray)** | 3,500 | 1,500 | Executive Food Tray (`Royalty`, `Crown`) |
| `prod-pack-4000` | `inv-pack-4000` | **Pack 4000** | 4,000 | 1,750 | VIP Banquet Tray (`CEO`) |

- **Default `Pack 400` Calculation Rule (`calculateDefaultPackagingForItems`):**
  - Applies automatically to standalone food/protein portions on Takeout/Pickup and Delivery orders (`Math.ceil(foodPortions / 4) * 400`).
  - **Excludes** standalone drinks, bread/bakery loaves, shawarma, and snacks.
  - **Never double-charges** when a predefined combo/package/platter already includes its own `packaging.productId` in its selling price.

---

## E. Catering & Unapproved Item Audit ("Chapman")

1. **Codebase & Database Sweep for `"Chapman"`:**
   - Removed `"Chapman"` from `CateringModal.tsx`, `CateringProductionPlanner.tsx`, `KitchenDisplaySystem.tsx`, `AdminCmsModal.tsx`, `AccountModal.tsx`, `NavSearchBar.tsx`, `articles.ts`, `dailySpecials.ts`, `approvedGrillsSnacksDrinks.ts`, `demoInventoryCatalogue.ts`, `appContextTypes.ts`, `biMetricsAndExport.ts`, `chartAndTaxHelpers.ts`, and `data/choplife_ops_db.json`.
   - Verified via `grep -rnI "Chapman\|chapman" src/ server/ data/choplife_ops_db.json` -> **`0` matches**.
2. **Authoritative Catering Calculator (`/src/components/catering/CateringModal.tsx`):**
   - Tiers (**Bronze — Classic Small Chops**, **Silver — Executive Chops & Grill**, **Gold — Royal Banquet Feast**) now dynamically resolve each component's unit price from the live `products` catalogue (`prod-snack-puff-puff-single`, `prod-snack-samosa-single`, `prod-snack-springroll-single`, `prod-meat-gizzard-cutout`, `prod-meat-chicken-small`, `prod-meat-chicken-kebab`, `prod-qsr-jollof-rice`, `prod-qsr-fried-rice`, `prod-qsr-plantain`, `prod-meat-turkey-medium`) multiplied by explicit per-guest quantities.
   - Optional beverage add-on uses only approved drinks (`prod-drink-zobo`, `prod-drink-chivita-active`, `prod-drink-chiexotic`, `prod-drink-malt`, `prod-drink-water`).
   - Displays separated **Menu Food Subtotal**, **Approved Beverage Add-On**, and **Estimated Delivery & Setup Fee**, clearly badged as an **Estimated Quote Subject to Staff Confirmation**.

---

## F. Ordering, Payment, KDS, Shift, Refund & RBAC Security Verification

- **Payment-Before-KDS Gate:**
  - Unauthenticated `POST /api/orders` with `paymentStatus: 'paid'` and no verified gateway reference is automatically downgraded to `pending` and excluded from `/api/pos/kds/tickets`.
  - `POST /api/pos/checks/:id/send-to-kitchen` and `POST /api/pos/printers/network-print` (`jobType: 'kitchen_ticket'` or `'customer_receipt'`) reject unpaid checks with `HTTP 409 Conflict`.
- **Close-Unpaid & Two-Step Refund SoD:**
  - `POST /api/pos/checks/:id/close-unpaid` requires a mandatory reason, records an audit event, and closes the check as `closed_unpaid` with zero revenue or inventory depletion.
  - `POST /api/pos/checks/:id/refund` enforces two-step Segregation of Duties (SoD): the staff member who requests a refund (`action: 'request'`) is blocked (`HTTP 403`) from executing/approving their own refund (`action: 'execute'`).
- **RBAC Privilege Escalation & Storekeeper Protection:**
  - Non-Super-Admin users attempting to assign unheld permissions, edit system roles (`PUT /api/rbac/roles/:id`), or create roles with unheld permissions (`POST /api/rbac/roles`) are rejected with `HTTP 403` and logged under `PRIVILEGE_ESCALATION_BLOCKED`.
  - Storekeepers (`role: 'storekeeper'`) are blocked from deleting or archiving inventory items (`PUT /api/inventory/items/:id` with `isArchived: true` -> `HTTP 403`).

---

## G. EZEE Optimus Migration Readiness

- **Dry-Run Staging (`POST /api/migration/ezee/dry-run`):** Computes a deterministic SHA-256 `batchChecksum`, validates branch/outlet mappings (`EZEE_OUTLET_MAP`) and payment methods (`EZEE_PAYMENT_MAP`), flags duplicate `legacyRecordId` rows and `unmappedProducts`, and verifies live check sequence isolation (`isStrictlyIsolated: true`).
- **Idempotent Historical Commit (`POST /api/migration/ezee/commit`):** Imports validated records with `isHistorical: true`, `isHistoricalMigrated: true`, `legacySourceSystem: 'ezee_optimus'`, and `migrationBatchId`, without triggering live KDS tickets or depleting live inventory.
- **Controlled Rollback (`POST /api/migration/ezee/rollback`):** Safely removes all historical checks matching `migrationBatchId`, marks the batch as rolled back with operator and reason, and writes an `EZEE_HISTORICAL_MIGRATION_ROLLED_BACK` audit log entry.

---

## H. Virgin-State Database Cleanup Report

Executed `npx tsx scripts/clean_virgin_database.ts --execute` against `/app/applet/data/choplife_ops_db.json` (with full backup saved to `/app/applet/data/choplife_ops_db.backup-before-virgin-clean.json`):

| Entity / Collection | Before Cleanup | After Virgin Cleanup | Status |
| :--- | :--- | :--- | :--- |
| **Branches** | 3 | **3** | Preserved (`gra`, `okabere`, `ugbowo`) |
| **Menu Categories** | 9 | **9** | Preserved |
| **Menu Products** | 206 | **206** | Preserved (166 active + 40 `ACHIVED (2).pdf` paused) |
| **Packages, Combos & Platters** | 63 | **63** | Preserved (Zero orphan component/packaging refs) |
| **RBAC Roles** | 10 | **10** | Preserved |
| **Staff Accounts** | 13 | **13** | Preserved |
| **Suppliers** | 4 | **4** | Preserved |
| **Inventory SKUs** | 37 | **37** | Definitions preserved; physical stock reset to `0` |
| **Packaging Inventory SKUs** | 12 | **12** | Definitions preserved; physical stock reset to `0` |
| **Dining Tables** | 66 (65 available) | **66 (66 available)** | All 66 tables reset to `available` |
| **Orders / POS Checks / Shifts** | 8 / 24 / 0 | **0 / 0 / 0** | Purged |
| **Stock Ledger / POs / GRNs** | 60 / 0 / 0 | **0 / 0 / 0** | Purged |
| **Expenses / Payrolls / CAPEX / Invoices** | 0 / 0 / 0 / 0 | **0 / 0 / 0 / 0** | Purged |
| **Customers / Loyalty / Audit Logs** | 1 / 0 / 125 | **0 / 0 / 0** | Purged |

---

## I. Automated Test & Build Execution Evidence

1. **October 30 & `ACHIVED (2).pdf` Forensic Audit Suite (`npx tsx scripts/test_oct30_reconciliation.ts`):**
   - **Result:** `280 / 280` checks **PASSED** (`0` failed).
2. **Master Remediation & Release-Readiness Suite (`npx tsx scripts/verify_master_remediation.ts`):**
   - **Result:** `501 / 501` checks **PASSED** (`0` failed).
3. **Chapman Code & Database Sweep (`grep -rnI "Chapman\|chapman" src/ server/ data/choplife_ops_db.json`):**
   - **Result:** `ZERO_CHAPMAN_ACROSS_ALL_CODE_AND_DB` (`0` matches).
4. **Production TypeScript & Vite Bundle Compilation (`compile_applet` / `npm run build`):**
   - **Result:** `Build succeeded - the applet is compiled` (`0` errors).

---

## J. Residual Risks & External Environment Dependencies

1. **Payment Gateway Live Keys:** Production webhook signature verification (`PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_SECRET_HASH`, `MONIEPOINT_WEBHOOK_SECRET`) requires live merchant credentials in the production environment variables.
2. **Branch LAN Thermal Printers:** Direct TCP/IP raw ESC/POS printing (`/api/pos/printers/network-print` on port `9100`) requires the POS server or local print bridge to have LAN reachability to each branch's thermal printer static IPs; browser receipt printing remains available as an immediate fallback.
3. **Fish Combo (`prod-qsr-combo-fish`) Price Confirmation:** Remains safely `paused` with `priceUnresolvedInArchivedPdf: true` until management confirms its official selling price via `confirmAuthorisedPrice: true`.
