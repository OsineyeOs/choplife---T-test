# ChopLife Republic — Authentication Access Matrix

This document defines the complete access control matrix for all API routes and operational interfaces in ChopLife Republic.

| Route / Endpoint | Interface | Authentication | Permitted Roles | Scope | Data Sensitivity | Current Protection | Remediation / Status | Test Evidence |
|---|---|---|---|---|---|---|---|---|
| `GET /api/health` | Public / System | Public | Public | Global | Public | Health probe | None | Verified |
| `POST /api/auth/staff/login` | Staff / Admin | Public (Rate-limited) | Any active staff | Global | Internal | Scrypt password verification + rate limiting | Secured | Verified |
| `POST /api/auth/staff/logout` | Staff / Admin | Session Cookie / Bearer | Any active staff | Global | Internal | `requireAuth` | Secured | Verified |
| `GET /api/staff/checks` | POS / Staff | Session Cookie / Bearer | `cashier`, `waiter`, `branch_manager`, `super_admin` | Assigned Branch | Confidential | `requireAuth`, `requireRole`, `requireBranchAccess` | Enforced | Verified |
| `POST /api/staff/checks` | POS / Staff | Session Cookie / Bearer | `cashier`, `waiter`, `branch_manager`, `super_admin` | Assigned Branch | Financial | `requireAuth`, `requireRole`, `requireBranchAccess` | Enforced | Verified |
| `GET /api/inventory/items` | Inventory / Store | Session Cookie / Bearer | `storekeeper`, `branch_manager`, `accountant`, `auditor`, `super_admin` | Assigned Branch / Central | Confidential | `requireAuth`, `requireRole`, `requireBranchAccess` | Enforced | Verified |
| `POST /api/inventory/adjust` | Inventory / Store | Session Cookie / Bearer | `branch_manager`, `corporate_admin`, `super_admin` | Assigned Branch | Financial | `requireAuth`, `requireRole` + Threshold checks | Enforced | Verified |
| `POST /api/inventory/transfers` | Inventory / Store | Session Cookie / Bearer | `storekeeper`, `branch_manager`, `super_admin` | Sender/Receiver Branch | Confidential | `requireAuth`, `requireRole` + Two-step confirmation | Enforced | Verified |
| `GET /api/admin/audit-logs` | Admin / Audit | Session Cookie / Bearer | `auditor`, `corporate_admin`, `super_admin` | Global Enterprise | Confidential | `requireAuth`, `requireRole(['auditor', 'corporate_admin', 'super_admin'])` | Enforced | Verified |
| `POST /api/admin/staff` | Admin | Session Cookie / Bearer | `corporate_admin`, `super_admin` | Global | Confidential | `requireAuth`, `requireRole(['corporate_admin', 'super_admin'])` | Enforced | Verified |
