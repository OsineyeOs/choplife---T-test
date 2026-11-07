# ChopLife Catering & Commissary Batch Production Specification

**Date**: October 22, 2026  
**Module**: `CateringProductionPlanner.tsx` & `/api/catering`  

---

## 1. Milestone Progression Lifecycle

Catering contracts progress through eight explicit operational and financial milestones:

1. **Enquiry / Quotation**: Initial guest request and menu package selection.
2. **Order Placed**: Customer has committed to the booking, contract registered, deposit pending.
3. **70% Deposit Confirmed**: 70% deposit payment verified by finance or manual receipt logged.
4. **Commissary Batch Scheduled**: Central Store reserves raw materials and schedules kitchen prep.
5. **Prepped & Packaged**: Ingredients portioned, cooked, packaged into Cambros/insulated containers.
6. **Dispatched / Setup Live**: Transported to venue, chafing dishes and VIP warming stations set up.
7. **Completed & Settled**: Event concluded, final 30% balance settled, equipment returned.
8. **Reversed / Cancelled (Restricted)**: Contract cancelled; requires Super Admin permission, reason, and audit logging.

---

## 2. Customer Care Unpaid Deposit Queue

When an order is in the **Order Placed** stage with deposit pending:
- Added to the **Unpaid Deposit Follow-up Queue**.
- Displays client name, phone number, event date, contract value, required 70% deposit, assigned owner, and next follow-up date.
- Customer Care reps log contact attempts ("Called client", "WhatsApp sent", "Payment promised for 24th Oct").
- Automatically escalates overdue follow-ups (>48h before event date) to Branch Manager.

---

## 3. Financial & BOM Calculation Rules

- **Total Contract Value**: `(Cost per Guest * Guest Count) + Setup & Chafing Fee (₦15,000)`.
- **Deposit Requirement**: Exactly 70% of Total Contract Value (`Math.round(totalCost * 0.7)`).
- **Balance Due**: `Total Contract Value - Verified Deposit Paid`.
- **Bill of Materials (BOM)**: Derived from verified recipes in `src/data/menu.ts` scaled by guest count (e.g. 25kg chicken per 100 guests, 1 bag 50kg rice per 100 guests, 20L vegetable oil, packaging bento sets).
