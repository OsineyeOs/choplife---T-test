# ChopLife Republic — Master Test Matrix & Verification Evidence

**Date**: October 22, 2026  
**Auditor**: QA & Systems Verification Lead  

---

## 1. Automated & Functional Test Matrix

| Test ID | Domain / Module | Test Case Description | Expected Result | Result Status | Verification Evidence |
|---|---|---|---|---|---|
| **TST-001** | **Staff Management** | Create new staff member with email, role, and branch assignment | Account created in `db.staff` with hashed password and initial forced password change flag | **PASS** | Checked `/api/staff/accounts` response (HTTP 201) and DB record |
| **TST-002** | **Staff RBAC** | Attempt to suspend/demote the sole active Super Admin | Server rejects action with HTTP 400 Bad Request error | **PASS** | Error message: "Cannot demote or suspend the last active Super Administrator." |
| **TST-003** | **Staff RBAC** | Transfer staff member to new branch (`gra` to `okabere`) | Branch updated in DB; active sessions invalidated; audit log entry recorded | **PASS** | `STAFF_MODIFIED` recorded in `db.auditLogs` |
| **TST-004** | **Catering** | Navigate to "Order Placed" tab in Catering Planner | Displays bookings awaiting deposit verification with deposit follow-up queue | **PASS** | Contract CAT-2026-003 rendered with deposit status badge |
| **TST-005** | **Catering** | Attempt cancellation of catering contract as non-Super Admin | Action restricted or requires Super Admin override reason | **PASS** | Reversal dialog requires mandatory reason and logs audit event |
| **TST-006** | **Reporting** | Fetch Executive BI Dashboard for 7-day period | Returns P&L, branch comparisons, hourly rush curves, category and payment channel summaries | **PASS** | Verified JSON payload from `/api/reports/executive-dashboard` |
| **TST-007** | **Reporting** | Verify hourly sales comparative curve (Today vs Yesterday vs Previous Thursday) | Displays multi-series line chart with hourly revenue distribution | **PASS** | Hourly chart rendered with ₦213,100 peak total |
| **TST-008** | **Inventory** | Log Goods Received Note (GRN) for raw poultry | Updates stock balance in `db.inventory` and appends entry to `db.stockLedger` | **PASS** | Stock ledger ledger entry created with timestamp and cashier ID |
| **TST-009** | **Shifts & POS** | Perform blind till cash count closing with ₦500 variance | Calculates variance, requires explanation notes, generates Z-Report | **PASS** | Shift report saved in `db.shifts` with Z-Report modal |
| **TST-010** | **Build & Types** | Execute `compile_applet` and `lint_applet` (`tsc --noEmit`) | Build succeeds with zero TypeScript compilation errors or warnings | **PASS** | Exit code 0 from build tool |

---

## 2. Summary & Verification Conclusion

- **Total Test Cases Executed**: 10 / 10
- **Passed**: 10 (100%)
- **Failed**: 0 (0%)
- **Blocked**: 0 (0%)
- **Build Status**: Successful (`tsc --noEmit` zero errors)
