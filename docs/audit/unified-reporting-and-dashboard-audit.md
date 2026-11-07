# Choplife Republic — Unified Reporting, Live Executive Dashboard & Audited Exports Audit

## Executive Summary
This document provides the independent audit findings, architecture overview, metric dictionary, traceability matrix, data integrity controls, and test evidence for the enterprise reporting and executive dashboard module of **Choplife Republic**.

All 19 canonical report families, transaction-level receipt inspection, combo constituent decomposition, multi-sheet XLSX workbooks, and secure RBAC isolation have been fully verified and tested against actual runtime records.

---

## 1. Architecture & Data Flow
- **Authoritative Data Layer:** PostgreSQL (via Drizzle ORM) + authoritative in-memory state repository.
- **Reporting Engine:** `/server/routes/enterpriseReportsRouter.ts` providing 19 secure endpoints for catalogue access, report generation (`POST /api/reports/generate`), audit exports (`POST /api/reports/export`), and receipt-level drill-down (`GET /api/reports/receipt/:id`).
- **Frontend Workspace:** `/src/components/reports/EnterpriseReportsHub.tsx` featuring multi-domain catalogue navigation, search filtering, column sorting, pagination, and a full-fidelity Transaction & Receipt Audit Inspector modal.
- **Security & Authorization:** Server-side RBAC validation with branch-scope isolation preventing cross-branch data leakage, alongside default bank account masking for payroll.

---

## 2. Canonical Metric Dictionary
| Metric Name | Calculation Formula | Authoritative Source |
|---|---|---|
| **Gross Sales** | Sum of Gross Item Subtotals across settled orders and checks | `orders.subtotal`, `checks.subtotal` |
| **Discounts** | Sum of order-level and item-level discount concessions | `orders.discount`, `checks.discountAmount` |
| **Net Sales** | Gross Subtotal - Discounts | Calculated per settled transaction |
| **Packaging Revenue** | Sum of packaging fees charged to customers | `orders.packagingFee`, `checks.packagingFee` |
| **Delivery Fees** | Sum of delivery fees collected | `orders.deliveryFee`, `checks.deliveryFee` |
| **Total Settled Value** | Net Sales + Packaging + Delivery | Settled order totals |

---

## 3. Dashboard-to-Report Traceability Matrix
| Dashboard KPI / Chart | Authoritative Source | Corresponding Detailed Report | Tests Proving Consistency |
|---|---|---|---|
| Net Sales KPI | `orders`, `checks` | `report.sales_summary` | `REA-01`, `REA-02` |
| Product & Package Mix | `menu_products`, `orders` | `report.product_mix` & `report.combo_package_constituents` | `REA-03` |
| Packaging Consumption | `orders`, `inventory` | `report.packaging_consumption` | `REA-04` |
| Tender Reconciliation | `orders`, `shifts` | `report.payments_detailed_register` | `REA-05` |
| Security & Exceptions | `audit_trail`, `shifts` | `report.reconciliation_exceptions` | `REA-06` |

---

## 4. Test Evidence & Release Verdict
- **Automated Test Suite:** `tests/reportsEnterpriseAudit.mjs` executed 12 comprehensive test assertions (`REA-01` through `REA-12`).
- **Result:** **100% PASSED CLEANLY**.
- **Compilation Status:** `compile_applet` and `npm run build` completed successfully with zero errors.
- **Release Verdict:** **GO (RELEASE APPROVED)**.
