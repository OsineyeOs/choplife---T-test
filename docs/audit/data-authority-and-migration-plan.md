# Choplife Republic — Data Authority & Migration Plan

## 1. Current vs. Target Data Authority Architecture

| Domain | Previous State | Target & Implemented State | Authority Guarantee |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Connection & Schema** | `initializePostgreSQLDatabase()` called asynchronously at import time; `saveDatabaseSync()` swallowed PG sync errors via `.catch(() => {})`. | `await initializePostgreSQLDatabase()` executes before HTTP server listen in `startServer()`; `saveDatabaseSync()` logs `[DB-AUTHORITY]` errors explicitly; `/api/health/ready` verifies live Drizzle ORM queries against `staff` and `branches` tables. | PostgreSQL schema + transactional snapshot synchronization verified on startup and readiness probes. |
| **Canonical Menu & Recipes** | 206 canonical menu items and 44 recipe BOMs seeded via `seedCanonicalMenuAndRecipes(db)`. | Non-destructive idempotent upsert on startup; `/api/health` verifies `productsCount >= 200` and `recipesCount >= 40`. | Zero destructive resets; existing orders and price overrides preserved. |
| **Delivery Zones & Rider Fee Splits** | Split across `cmsContent.deliveryZones` (`₦700`), `riderCompensationConfig.externalRiderZoneSplits` (`₦1,200–₦2,000`), and static `branches.ts`. | Unified in `/server/services/deliveryFeeAuthorityService.ts`: `ensureCanonicalDeliveryZones(db)` synchronizes `cmsContent.deliveryZones` and `riderCompensationConfig.externalRiderZoneSplits` with `customerDeliveryFee = riderShareAmount + companyShareAmount`. | Single source of truth for storefront checkout, POS delivery orders, dispatch tasks, and rider settlement payroll. |
| **RBAC Roles & Privileges** | `RolePermissionManager.tsx` fetched unimplemented `/api/rbac/permissions-catalogue` (404). | `GET /api/rbac/permissions-catalogue` in `branchesAndRbacRouter.ts` serves canonical categories, reports, and order summary columns backed by `db.rbacRoles` and `db.staffRoles`. | Deterministic server-enforced RBAC across API routes and UI workspaces. |
| **Enterprise Reports & Audit Trail** | Ad-hoc client exports without server-side RBAC check or export audit log. | `POST /api/reports/generate` and `POST /api/reports/export` read directly from authoritative domain collections (`orders`, `shifts`, `inventoryItems`, `payrollRuns`, `staffLoans`, `deliveryTasks`, `auditLogs`) and append immutable `REPORT_EXPORTED` / `UNAUTHORIZED_REPORT_ACCESS_BLOCKED` records to `db.auditLogs`. | Every report generation and export is server-scoped, sanitized, and audited. |

---

## 2. Safe Migration & Cutover Procedure

1. **Pre-Cutover Verification:**
   - Startup executes `await initializePostgreSQLDatabase()` in `/server.ts`, creating/verifying PostgreSQL tables (`branches`, `staff`, `products`, `orders`, `order_items`, `payments`, `inventory_items`, `stock_movements`, `payroll_runs`, `payroll_entries`, `staff_loans`, `audit_logs`, `app_state_snapshots`) with `CREATE TABLE IF NOT EXISTS` and idempotent column migrations.
2. **Canonical Data Reconciliation:**
   - `ensureCanonicalDeliveryZones(db)` reconciles any legacy `₦700` placeholder delivery zones with the canonical 5-zone Benin City schedule (`GRA Core`, `Okabere / Upper Sapele Road`, `Ugbowo / UNIBEN / Ekosodin`, `Airport Road / Adesuwa / Ihama`, `Ring Road / Akpakpava / Forestry`) without deleting custom active zones.
3. **Readiness Gate:**
   - Deployment readiness is gated on `GET /api/health/ready` returning HTTP `200` with `status: "ready"`, `pgDatabaseConnected: true`, `staffCount >= 8`, and `branchesCount >= 3`.

---

## 3. Rollback Plan

- All schema and data migrations are strictly additive and idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, non-destructive zone and product upserts).
- If a rollback is required, the previous application container revision can be restored immediately without schema incompatibility or data loss in PostgreSQL or `server_database.json`.
