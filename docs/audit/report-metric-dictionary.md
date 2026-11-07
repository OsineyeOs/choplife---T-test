# ChopLife Republic — Executive Report Metric Dictionary & Financial Reconciliation Guide

**Date**: October 22, 2026  
**Timezone Baseline**: `Africa/Lagos` (WAT / UTC+1)  

---

## 1. Core Financial Metrics & Formulas

All financial reporting in ChopLife Republic is calculated in integer kobo internally and formatted in Nigerian Naira (`₦`) for presentation.

| Metric | Code Reference | Formula / Source | Description |
|---|---|---|---|
| **Gross Revenue** | `server_bi.ts` | `SUM(check.total)` for all `status = 'paid'` checks | Total gross monetary value of all closed, settled checks including discounts before deductions. |
| **Discounts & Voids** | `server_bi.ts` | `SUM(check.discountAmount)` | Total authorized discounts (VIP courtesy, management approval, promo codes) applied to paid checks. |
| **Net Revenue** | `server_bi.ts` | `Gross Revenue - Discounts` | Net sales revenue generated across all sales channels (Dine-in, Takeaway, Delivery, Catering). |
| **COGS (Food Cost)** | `server_bi.ts` | `SUM(item.quantity * recipeBOMCost)` | Direct raw material and packaging cost associated with items sold. Target: 32% - 35% of Net Revenue. |
| **Gross Margin (%)** | `server_bi.ts` | `((Net Revenue - COGS) / Net Revenue) * 100` | Percentage of net revenue retained after direct food and material costs. |
| **Labor Cost** | `server_bi.ts` | ~19.2% of Net Revenue | Total payroll, wage allocations, and staff meal allowances across branches. |
| **Utilities & Power** | `server_bi.ts` | ~7.6% of Net Revenue | Diesel generator fuel, public power utility bills, and water supply expenses. |
| **Wastage & Shrinkage**| `server_bi.ts` | `SUM(wastage.totalLossValue)` | Recorded spoilage, expired stock, kitchen prep errors, and damaged inventory. |
| **Net Operating Profit**| `server_bi.ts` | `Gross Profit - Total OPEX` | Final net earnings before corporate tax and depreciation. |
| **Average Order Value** | `server_bi.ts` | `Net Revenue / Total Paid Check Count` | Average revenue generated per customer order transaction. |
| **Sales Per Pax (#Pax)**| `ExecutiveBIDashboard` | `Total Sales / Total Cover Count (#Pax)` | Average spending per guest cover (pax) in dine-in service. |

---

## 2. Reporting Periods & Comparative Analysis

The system provides 5 reporting periods with comparative trend overlays:

1. **Hourly Sales Flow (08:00 – 21:00)**:
   - **Primary Bar/Line**: Today's hourly sales.
   - **Comparative Overlay 1**: Yesterday's hourly sales curve.
   - **Comparative Overlay 2**: Previous Same Day of Week (e.g., Thursday vs Previous Thursday).
2. **Daily Sales Analytics**:
   - **Primary Series**: Current day's performance broken down by shift and category.
   - **Comparison**: Yesterday's equivalent period.
3. **Weekly Sales Analytics**:
   - **Primary Bar Chart**: 7-day bar chart (Fri, Sat, Sun, Mon, Tue, Wed, Thu).
   - **Comparison Line**: Previous Week's 7-day trend line (e.g., ₦5,938,950 total).
4. **Monthly Sales Analytics**:
   - **Primary Bar Chart**: Month-to-date sales by week.
   - **Comparison Line**: Prior month performance.
5. **Yearly Sales Analytics**:
   - **Primary Series**: 12-month annual revenue trend.
   - **Comparison Line**: Previous year total.

---

## 3. Category & Payment Method Reconciliation

Every sales summary report breaks down sales across approved menu categories and verified payment channels:

- **Category Summary**: Bread, Delivery, Drinks, Food, Meat, Packaging, Small Chops, Snacks.
- **Payment Method Summary**:
  - `Card - Access Bank POS`
  - `Cash`
  - `Transfer - GTBank`
  - `Transfer - Moniepoint`
  - `Patron Stored Wallet`
  - `Corporate House Account`

All payment method totals must reconcile exactly to `Total Settled Sales` (`Settled = Total Amount`).
