# ChopLife Republic — Staff Role & Granular Permission Access Control Matrix

**Date**: October 22, 2026  
**Security Standard**: Strict Backend Role-Based Access Control (RBAC)  

---

## 1. Role Hierarchy Overview

ChopLife Republic enforces a 10-tier Role-Based Access Control model enforced server-side via `requireAuth`, `requireRole`, and `requireBranchAccess` middleware in `server.ts`.

| Role Key | Display Name | Authority Scope |
|---|---|---|
| `super_admin` | Super Administrator | Enterprise-wide unlimited control across all branches, staff management, system config, financial reversals. |
| `corporate_admin` | Corporate / General Management | Multi-branch operational overview, executive reports, high-level approvals. |
| `accountant` | Finance / Accountant | Financial reconciliation, P&L views, payment audit reports, tax & settlement settings. |
| `auditor` | Auditor | Read-only access across all operational records, inventory ledgers, and security audit logs. |
| `branch_manager` | Branch Manager | Full operational authority over assigned branch (POS, shifts, local staff supervision, stock requests). |
| `supervisor` | Assistant Manager / Supervisor | Shift oversight, discount approvals, void authorizations within assigned branch. |
| `cashier` | Cashier / Head Cashier | POS bill creation, cash drawer management, payment receipt, shift opening/closing. |
| `customer_care` | Customer Care Representative | Order investigation, ticket management, customer communication, refund requests. |
| `kitchen_lead` | Kitchen Lead / Chef | Kitchen Display System (KDS) ticket management, recipe BOM tracking, station prep. |
| `storekeeper` | Storekeeper / Inventory Manager | Stock receiving (GRN), issuing, branch transfers, wastage logging, physical counts. |
| `rider` | Dispatch / Delivery Rider | Order dispatch pickup, delivery status updates, customer proof-of-delivery. |

---

## 2. Granular Permissions Matrix

| Permission Identifier | Description | `super_admin` | `corporate_admin` | `accountant` | `auditor` | `branch_manager` | `cashier` | `customer_care` | `kitchen_lead` | `storekeeper` | `rider` |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `staff.view` | View staff list | ✓ | ✓ | ✓ | ✓ | ✓ | - | - | - | - | - |
| `staff.create` | Add new staff account | ✓ | ✓ | - | - | - | - | - | - | - | - |
| `staff.update` | Edit staff details | ✓ | ✓ | - | - | - | - | - | - | - | - |
| `staff.activate` | Activate staff account | ✓ | ✓ | - | - | - | - | - | - | - | - |
| `staff.deactivate` | Deactivate/suspend staff | ✓ | ✓ | - | - | - | - | - | - | - | - |
| `staff.archive` | Archive former staff | ✓ | - | - | - | - | - | - | - | - | - |
| `staff.reset_password` | Trigger password reset | ✓ | ✓ | - | - | - | - | - | - | - | - |
| `reports.view_all` | Enterprise-wide BI | ✓ | ✓ | ✓ | ✓ | - | - | - | - | - | - |
| `reports.view_branch` | Branch sales reports | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | - | - | - |
| `reports.export` | Export CSV/PDF reports | ✓ | ✓ | ✓ | ✓ | ✓ | - | - | - | - | - |
| `finance.reconcile` | Reconcile drawer/bank | ✓ | ✓ | ✓ | ✓ | ✓ | - | - | - | - | - |
| `finance.adjust` | Post financial adjustment| ✓ | - | ✓ | - | - | - | - | - | - | - |
| `orders.view` | View POS checks | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | ✓ |
| `orders.cancel` | Void/cancel order check | ✓ | ✓ | - | - | ✓ | - | - | - | - | - |
| `refunds.request` | Initiate refund request | ✓ | ✓ | ✓ | - | ✓ | - | ✓ | - | - | - |
| `refunds.approve` | Finalize refund payment | ✓ | ✓ | ✓ | - | - | - | - | - | - | - |
| `catering.create` | Book catering contract | ✓ | ✓ | - | - | ✓ | ✓ | ✓ | - | - | - |
| `catering.schedule` | Schedule batch BOM | ✓ | ✓ | - | - | ✓ | - | - | ✓ | - | - |
| `catering.reverse` | Cancel/reverse contract | ✓ | - | - | - | - | - | - | - | - | - |
| `inventory.receive` | Log GRN stock receipt | ✓ | ✓ | - | - | ✓ | - | - | - | ✓ | - |
| `inventory.issue` | Issue stock to kitchen | ✓ | ✓ | - | - | ✓ | - | - | ✓ | ✓ | - |
| `inventory.transfer` | Transfer stock | ✓ | ✓ | - | - | ✓ | - | - | - | ✓ | - |
| `inventory.adjust` | Stock count adjustment | ✓ | ✓ | - | - | ✓ | - | - | - | ✓ | - |
| `shifts.open` | Open register shift | ✓ | ✓ | - | - | ✓ | ✓ | - | - | - | - |
| `shifts.close` | Close shift & Z-Report | ✓ | ✓ | - | - | ✓ | ✓ | - | - | - | - |
| `audit.view` | Access security audit log| ✓ | ✓ | ✓ | ✓ | - | - | - | - | - | - |

---

## 3. Critical Safeguards

1. **Last Super Administrator Lock**: System rejects any request to deactivate, demote, or archive the last active Super Admin.
2. **Session Revocation**: Changing a staff member's role or status immediately invalidates active session tokens (`db.sessions`).
3. **Transaction Attribution Preservation**: Deactivating or archiving a staff member retains their name and staff ID on all historical checks, payments, Z-reports, and audit logs.
