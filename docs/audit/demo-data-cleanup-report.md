# ChopLife Republic — Demo Data Cleanup & Source-of-Truth Report

**Date**: October 22, 2026  
**Auditor**: Senior Database Architect & Application Security Lead  

---

## 1. Classification & Audit Policy

All data within ChopLife Republic's persistent state (`server_db.ts` / `choplife.db`) was audited and classified into three distinct categories:
1. **Confirmed Demo / Test Data**: Mock orders, fake staff logins with default passwords, test reviews.
2. **Confirmed Genuine Business Data**: Approved branch configurations (GRA Flagship, Okabere, Ugbowo), verified storefront menu items (`src/data/menu.ts`), official branch operating schedules, and real payment gateway settings (Paystack / Moniepoint / Access Bank).
3. **Uncertain / Ambiguous Records**: Preserved without deletion; flagged for administrative review to prevent loss of historical transaction attribution.

---

## 2. Cleanup Actions Summary

| Data Entity | Previous State | Action Taken | Current Authoritative Source |
|---|---|---|---|
| **Staff Accounts** | Static in-memory mock users | Migrated to persisted `db.staff` table in `server_db.ts` with scrypt hashed passwords and scrypt salt verification | `db.staff` persistent database |
| **Sales & POS Checks** | Hardcoded sample checks in UI state | Generated dynamically from persistent `db.checks` table with real-time audit logs | `db.checks` persistent database |
| **Catering Contracts** | Component-level static array | Stored and updated in `db.catering` with server API `/api/catering` synchronization | `db.catering` persistent database |
| **Inventory & Stock Balances** | Loose arrays in UI files | Unified into `db.inventory` with immutable transaction stock ledger (`db.stockLedger`) | `db.inventory` & `db.stockLedger` |
| **Branch Configurations** | Static references | Configured in `src/data/branches.ts` with operating hours in `Africa/Lagos` WAT | `src/data/branches.ts` & `db.branches` |
| **Menu Catalogue & BOM** | Static JSON | Authoritative menu in `src/data/menu.ts` linked to recipe ingredient BOMs | `src/data/menu.ts` |

---

## 3. Fallback Elimination & Empty State Verification

To enforce absolute data integrity, all fallback logic that previously generated artificial data when an API returned an empty array was removed from operational views:
- **Empty Orders**: Displays an honest empty state ("No Active Checks for this Branch") with a button to open a new table or check.
- **Empty Inventory**: Displays "No Stock Items Found in Category" with an option to add an item or perform a stock receipt.
- **Empty Tickets**: Displays "No Open Customer Care Tickets" with a button to log a ticket.

---
*Signed by Database Integrity Lead — ChopLife Republic.*
