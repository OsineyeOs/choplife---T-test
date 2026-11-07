# Choplife Republic — Role-by-Report & Export Access Matrix

Enforced server-side in `/server/routes/enterpriseReportsRouter.ts` (`resolveReportActor`, `canActorAccessReport`) and reflected in `/src/components/reports/EnterpriseReportsHub.tsx`.

## 1. Role-by-Report & Branch Scope Matrix

| Report ID | Super Admin / CEO (`super_admin`) | General Manager (`general_manager`) | Accountant / Finance (`accountant`) | HR / Payroll (`hr_admin`) | Auditor (`auditor`) | Branch Manager (`branch_manager`, `manager`) | Storekeeper / Procurement (`inventory_manager`, `procurement_officer`) | Shift Supervisor (`shift_supervisor`) | Cashier / Kitchen / Rider (`cashier`, `kitchen`, `rider`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `report.sales_summary` | All Branches (View + Export) | All Branches (View + Export) | All Branches (View + Export) | Denied (`403`) | All Branches (Read-Only + Export) | Assigned Branch Only | Denied (`403`) | Assigned Branch Only | Denied (`403`) |
| `report.channel_mix` | All Branches (View + Export) | All Branches (View + Export) | All Branches (View + Export) | Denied (`403`) | All Branches (Read-Only + Export) | Assigned Branch Only | Denied (`403`) | Denied (`403`) | Denied (`403`) |
| `report.branch_comparison` | All Branches (View + Export) | All Branches (View + Export) | All Branches (View + Export) | Denied (`403`) | All Branches (Read-Only + Export) | Denied (`403`) | Denied (`403`) | Denied (`403`) | Denied (`403`) |
| `report.product_mix` | All Branches (View + Export) | All Branches (View + Export) | All Branches (View + Export) | Denied (`403`) | All Branches (Read-Only + Export) | Assigned Branch Only | Assigned Branch Only | Denied (`403`) | Denied (`403`) |
| `report.payment_methods` | All Branches (View + Export) | All Branches (View + Export) | All Branches (View + Export) | Denied (`403`) | All Branches (Read-Only + Export) | Assigned Branch Only | Denied (`403`) | Assigned Branch Only | Denied (`403`) |
| `report.shift_cash_variance` | All Branches (View + Export) | All Branches (View + Export) | All Branches (View + Export) | Denied (`403`) | All Branches (Read-Only + Export) | Assigned Branch Only | Denied (`403`) | Assigned Branch Only | Denied (`403`) |
| `report.discounts_voids_refunds` | All Branches (View + Export) | All Branches (View + Export) | All Branches (View + Export) | Denied (`403`) | All Branches (Read-Only + Export) | Assigned Branch Only | Denied (`403`) | Assigned Branch Only | Denied (`403`) |
| `report.inventory_valuation` | All Branches (View + Export) | All Branches (View + Export) | All Branches (View + Export) | Denied (`403`) | All Branches (Read-Only + Export) | Assigned Branch Only | Assigned Branch Only | Denied (`403`) | Denied (`403`) |
| `report.wastage_shrinkage` | All Branches (View + Export) | All Branches (View + Export) | All Branches (View + Export) | Denied (`403`) | All Branches (Read-Only + Export) | Assigned Branch Only | Assigned Branch Only | Denied (`403`) | Denied (`403`) |
| `report.supplier_payables` | All Branches (View + Export) | All Branches (View + Export) | All Branches (View + Export) | Denied (`403`) | All Branches (Read-Only + Export) | Assigned Branch Only | Assigned Branch Only | Denied (`403`) | Denied (`403`) |
| `report.payroll_register` | All Branches (View + Export + Unmask Bank) | All Branches (View + Export) | All Branches (View + Export + Unmask Bank) | All Branches (View + Export + Unmask Bank) | All Branches (Masked Bank Only) | Denied (`403`) | Denied (`403`) | Denied (`403`) | Denied (`403`) |
| `report.staff_deductions_loans` | All Branches (View + Export) | All Branches (View + Export) | All Branches (View + Export) | All Branches (View + Export) | All Branches (Read-Only + Export) | Denied (`403`) | Denied (`403`) | Denied (`403`) | Denied (`403`) |
| `report.rider_settlement` | All Branches (View + Export) | All Branches (View + Export) | All Branches (View + Export) | All Branches (View + Export) | All Branches (Read-Only + Export) | Assigned Branch Only | Denied (`403`) | Denied (`403`) | Denied (`403`) |
| `report.security_audit_log` | All Branches (View + Export) | All Branches (View + Export) | Denied (`403`) | Denied (`403`) | All Branches (Read-Only + Export) | Denied (`403`) | Denied (`403`) | Denied (`403`) | Denied (`403`) |

---

## 2. Sensitive-Data & Export Security Controls

1. **Bank Account Masking (`maskBankAccount`):**
   - By default, all payroll register views and exports mask employee bank account numbers to `******1234`.
   - Unmasked bank account numbers require both `includeUnmaskedBankDetails: true` AND an actor with role `super_admin`, `accountant`, `hr_admin`, or `payroll.disburse` privilege.
2. **Spreadsheet Formula-Injection Prevention (`sanitizeSpreadsheetCell`):**
   - Any string cell starting with `=`, `+`, `-`, `@`, `\t`, or `\r` is prefixed with a single quote (`'`) before CSV or XLSX serialization.
3. **Immutable Export Audit Logging:**
   - Every successful export appends a `REPORT_EXPORTED` event to `db.auditLogs` recording `staffId`, `staffName`, `staffRole`, `reportId`, `format`, `branchScope`, `rowCount`, `includeUnmaskedBankDetails`, and `timestamp`.
   - Every unauthorized report generation or export attempt returns HTTP `403` and appends an `UNAUTHORIZED_REPORT_ACCESS_BLOCKED` or `UNAUTHORIZED_REPORT_EXPORT_BLOCKED` event to `db.auditLogs`.
