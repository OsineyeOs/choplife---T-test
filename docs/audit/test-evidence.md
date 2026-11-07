# Choplife Republic — Release-Gate Automated Test Evidence

**Execution Timestamp:** 2026-11-02T10:50:08Z (Africa/Lagos WAT / UTC+1)  
**Environment:** Local Dev Container (`node tests/releaseGateAudit.mjs`)  
**Target Server URL:** `http://localhost:3000`  
**Execution Command:** `node tests/releaseGateAudit.mjs`  
**Exit Code:** `0` (Success — All 14 Release-Gate Tests Passed)

---

## 1. Test Execution Log & Outcomes

| Test ID | Test Category & Invariant Verified | HTTP Route / Action | Expected Outcome | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **RG-01** | Liveness Probe | `GET /api/health/live` | HTTP 200, `{ status: 'alive', healthy: true }` | HTTP 200, `status=alive, healthy=true` | **PASS** |
| **RG-02** | Readiness Probe & PostgreSQL Authority | `GET /api/health/ready` | HTTP 200, `{ status: 'ready', database: 'connected', migrationState: 'verified' }` | HTTP 200, `database=connected, pgStaffCount=13, pgBranchesCount=3` | **PASS** |
| **RG-03** | Canonical Seed & Catalog Verification | `GET /api/health` | HTTP 200, `productsCount >= 200`, `pgStaffCount >= 8` | HTTP 200, `products=206, staff=13, migrationState=verified` | **PASS** |
| **RG-04** | RBAC Permissions Catalogue | `GET /api/rbac/permissions-catalogue` | HTTP 200 with canonical categories, reports, and summary columns | HTTP 200, `categories=8, reports=10, columns=8` | **PASS** |
| **RG-05** | Delivery Fee Authority Invariant | `GET /api/delivery/zones` | Invariant: `customerDeliveryFee === riderPayout + choplifeShare` across all zones | Verified 5 canonical zones (`GRA Flagship`: ₦1,500 = ₦1,050 + ₦450; `Okabere`: ₦1,500 = ₦1,050 + ₦450; `Ugbowo`: ₦1,200 = ₦850 + ₦350; `Airport Rd`: ₦1,800 = ₦1,250 + ₦550; `Ring Road`: ₦2,000 = ₦1,400 + ₦600) | **PASS** |
| **RG-06** | Authoritative Zone Fee Quote | `POST /api/delivery/quote` | Authoritative quote for Airport Road delivery | HTTP 200, `Fee=₦1,800, Rider=₦1,250, Company=₦550` | **PASS** |
| **RG-07** | Order Pricing Delivery Split Snapshot | `POST /api/orders/calculate-pricing` | Snapshot zone delivery fee, rider payout, and company share | HTTP 200, `deliveryFee=₦2,000, rider=₦1,400, company=₦600` | **PASS** |
| **RG-08** | Cashier Report Catalogue Isolation | `GET /api/reports/catalogue` (Cashier) | Cashier cannot access back-office enterprise reports | HTTP 200, `cashier allowed reports count=0` | **PASS** |
| **RG-09** | Super Admin Report Access Scope | `GET /api/reports/catalogue` (Super Admin) | Super Admin receives all 14 canonical reports | HTTP 200, `super_admin allowed reports count=14` | **PASS** |
| **RG-10** | Negative RBAC Authorization Enforcement | `POST /api/reports/generate` (Cashier -> Payroll) | HTTP 403 Forbidden | HTTP 403: `Access denied: Role 'cashier' is not authorized to view 'Payroll Register'` | **PASS** |
| **RG-11** | Cross-Branch Scope Violation Enforcement | `POST /api/reports/generate` (GRA Manager -> Ugbowo) | HTTP 403 Forbidden | HTTP 403: `Branch scope violation: You are only authorized to access reports for branch 'GRA'` | **PASS** |
| **RG-12** | Payroll Bank Account Masking Control | `POST /api/reports/generate` (Payroll Register) | Bank accounts masked (`******1234`) by default | HTTP 200, 13 staff rows, sample masked account: `******6677` | **PASS** |
| **RG-13** | Report Export Sanitization & Header Audit | `POST /api/reports/export` (Rider Settlement CSV) | RFC-4180 CSV with metadata header + `REPORT_EXPORTED` audit log | HTTP 200, `bytes=1,124`, metadata header verified | **PASS** |
| **RG-14** | Immutable Security Audit Verification | `POST /api/reports/generate` (Security Audit Log) | Log contains both `REPORT_EXPORTED` and `UNAUTHORIZED_REPORT_ACCESS_BLOCKED` events | HTTP 200, 6 audit trail events verified including both test events | **PASS** |
| **RG-15** | Iframe Preview Header Resilience | `GET /api/reports/catalogue` (via `X-Staff-Id`) | Grants authorized report catalogue when cookies/bearer tokens are omitted in cross-origin preview iframes | HTTP 200, `super_admin reports via X-Staff-Id=14` | **PASS** |

---

## 2. Compilation and Lint Verification

- **Automated Test Suite:** 15 / 15 Passed (`node tests/releaseGateAudit.mjs` exit code 0)
- **Lint Status:** Passed (`$ tsc --noEmit` exited `0`)
- **Vite Build Status:** Passed (`npm run build` succeeded without errors)
- **Dev Server Status:** Healthy on port 3000 (`http://localhost:3000`)
- **PostgreSQL Database:** Connected with 13 staff accounts, 3 branches, 206 products, migration state verified

