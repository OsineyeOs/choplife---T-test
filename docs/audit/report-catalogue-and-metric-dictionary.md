# Choplife Republic — Enterprise Report Catalogue & Metric Dictionary

All 14 canonical reports are served by `/server/routes/enterpriseReportsRouter.ts` (`GET /api/reports/catalogue`, `POST /api/reports/generate`, `POST /api/reports/export`) and rendered in `/src/components/reports/EnterpriseReportsHub.tsx`.

## 1. Canonical Metric Dictionary

| Metric Name | Canonical Formula / Definition | Source Collection / Table |
| :--- | :--- | :--- |
| **Gross Sales** | $\sum (\text{Order Subtotal} + \text{Order Discount})$ for non-cancelled orders in period | `orders` |
| **Discounts** | $\sum (\text{Order Discount})$ for non-cancelled orders in period | `orders` |
| **Packaging Revenue** | $\sum (\text{Order Packaging Fee})$ for non-cancelled orders in period | `orders` |
| **Delivery Fee Revenue** | $\sum (\text{Customer Delivery Fee Snapshot})$ for delivery orders in period | `orders`, `deliveryTasks` |
| **Net Revenue (Excl. Delivery)** | $\sum (\text{Order Subtotal} - \text{Order Discount} + \text{Packaging Fee})$ for non-cancelled, non-refunded orders | `orders` |
| **Total Collected** | $\sum (\text{Order Total})$ for paid, non-cancelled orders in period | `orders`, `payments` |
| **Shift Cash Variance** | $\text{Actual Closing Cash Counted} - (\text{Opening Float} + \text{Cash Sales} - \text{Approved Petty Cash Out})$ | `shifts`, `cashMovements` |
| **Inventory Valuation** | $\sum (\text{Current Stock Qty} \times \text{Unit Cost})$ per SKU and branch | `inventoryItems` |
| **Payroll Net Pay** | $\text{Gross Pay} - (\text{PAYE Tax} + \text{Employee Pension} + \text{Loan Deduction} + \text{Advance Deduction} + \text{Fine/Shortage Deduction})$ | `payrollRuns`, `payrollEntries`, `staff` |
| **Delivery Fee Split Invariant** | $\text{Customer Delivery Fee} = \text{Rider Share Amount} + \text{Company Share Amount}$ | `deliveryTasks`, `orders`, `riderCompensationConfig` |

---

## 2. Canonical Report Catalogue (14 Reports)

| Report ID | Title | Category | Filters Supported | Export Formats | Reconciliation Check |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `report.sales_summary` | Daily / Weekly / Monthly Sales Summary | Sales & Revenue | `branchId`, `startDate`, `endDate`, `channel`, `paymentMethod`, `search` | CSV, XLSX, PDF | Sum of order totals equals KPI `totalCollected` + `unpaidTotal` |
| `report.channel_mix` | Sales by Channel (Storefront, POS, WhatsApp, Pickup) | Sales & Revenue | `branchId`, `startDate`, `endDate` | CSV, XLSX, PDF | Sum of channel `totalRevenue` equals `report.sales_summary` total |
| `report.branch_comparison` | Branch Performance Comparison (GRA, Okabere, Ugbowo) | Sales & Revenue | `startDate`, `endDate` | CSV, XLSX, PDF | Sum of 3 branches equals company-wide revenue |
| `report.product_mix` | Product, Category & Package Sales Mix (PMIX) | Sales & Revenue | `branchId`, `startDate`, `endDate`, `search` | CSV, XLSX, PDF | Item line quantities match order line items |
| `report.payment_methods` | Payment Method Reconciliation (Cash, POS, Transfer, Online) | Cashier, POS & Shift | `branchId`, `startDate`, `endDate`, `paymentMethod` | CSV, XLSX, PDF | Sum of tender totals equals total order value |
| `report.shift_cash_variance` | Cashier Shift & Cash Drawer Variance Report | Cashier, POS & Shift | `branchId`, `startDate`, `endDate`, `search` | CSV, XLSX, PDF | `variance = closingCashActual - expectedCash` |
| `report.discounts_voids_refunds` | Discounts, Voids, Complimentary & Refunds Register | Cashier, POS & Shift | `branchId`, `startDate`, `endDate`, `search` | CSV, XLSX, PDF | Matches cancelled/refunded/discounted orders & audit reason codes |
| `report.inventory_valuation` | Stock on Hand, Reorder Alerts & Inventory Valuation | Inventory & Procurement | `branchId`, `search` | CSV, XLSX, PDF | `stockValue = currentStock * unitCost` |
| `report.wastage_shrinkage` | Wastage, Spoilage, Staff Meals & Stock Variance | Inventory & Procurement | `branchId`, `startDate`, `endDate`, `search` | CSV, XLSX, PDF | Matches `wastageLogs` and negative `stockMovements` |
| `report.supplier_payables` | Supplier Invoices, GRNs & Payables Aging | Inventory & Procurement | `branchId`, `startDate`, `endDate`, `search` | CSV, XLSX, PDF | `outstandingAmount = totalAmount - amountPaid` |
| `report.payroll_register` | Monthly Payroll Register & Bank Disbursement Schedule | Payroll & HR | `branchId`, `search`, `includeUnmaskedBankDetails` | CSV, XLSX, PDF | Sum of `netPay` equals payroll run net disbursement |
| `report.staff_deductions_loans` | Staff Loans, Salary Advances, Shortages & Fines Ledger | Payroll & HR | `branchId`, `search` | CSV, XLSX, PDF | `remainingBalance = principalAmount - totalRepaid` |
| `report.rider_settlement` | Rider & Delivery Fee Split Settlement Report | Dispatch & Riders | `branchId`, `startDate`, `endDate`, `search` | CSV, XLSX, PDF | `customerFee = riderShare + companyShare` on every row |
| `report.security_audit_log` | Privileged Actions, Void Approvals & Export Audit Trail | Security & Audit | `branchId`, `startDate`, `endDate`, `search` | CSV, XLSX, PDF | Captures `REPORT_EXPORTED` and `UNAUTHORIZED_REPORT_ACCESS_BLOCKED` |
