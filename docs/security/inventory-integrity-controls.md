# ChopLife Republic — Inventory Integrity & Anti-Tampering Controls

This document specifies the core inventory integrity and anti-tampering controls implemented across ChopLife Republic's POS, kitchen, store, and reporting modules.

## 1. Core Principles
1. **Single Source of Truth**: All stock levels and inventory mutations are governed by server-side authoritative logic backed by the durable WAL store (`server_db.ts`).
2. **Append-Only Movement Ledger (`db.ledger`)**: Every stock increase, decrease, adjustment, transfer, or receipt is recorded as an immutable ledger transaction capturing:
   - Unique transaction reference and timestamp.
   - Item ID, SKU, name, and location/branch ID.
   - Transaction type (`ADJUSTMENT_INCREASE`, `ADJUSTMENT_DECREASE`, `TRANSFER`, `GRN_RECEIPT`, `POS_SALE`).
   - Quantity delta, absolute quantity, unit cost, and total value.
   - Balance before and balance after.
   - Actor ID, name, and role.
   - Reason or supporting reference notes.
3. **Branch Isolation**: Non-corporate staff cannot modify or view inventory across branches outside their assigned location. Negative stock is strictly blocked at the API validation layer.
4. **Segregation of Duties**: Purchase orders, goods receipt notes (GRN), and physical stock adjustments require distinct authorization roles with supervisory approval thresholds.
