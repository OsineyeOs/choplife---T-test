# Choplife Republic Operations & Software Platform
## Comprehensive Product Manual & Technical Systems Guide
**Document Reference**: `CLR-SOP-2026-V3.4-EXT`  
**System Target**: Choplife Republic Operations Platform (v3.4 Production)  
**Live Application URL**: `https://ais-dev-44y4hq7fi4mppkyrfawv5p-127643680570.europe-west2.run.app`  
**Publication Date**: October 31, 2026  
**Document Owner**: Operations & Systems Quality Assurance Engineering Lead  

---

## SECTION A — DOCUMENT CONTROL

### A.1 Document Version History
| Version | Revision Date | Primary Author / Auditor | Summary of Changes | Approval Status |
| :--- | :--- | :--- | :--- | :--- |
| `v1.0.0` | 2026-01-15 | Senior Systems Architect | Initial baseline documentation of core POS and Storefront ordering modules. | Approved |
| `v2.1.0` | 2026-06-20 | Lead Business Analyst | Added Custom Small Chops Builder, Paystack integration, and multi-branch inventory tracking. | Approved |
| `v3.0.0` | 2026-09-10 | Software QA Lead | Full audit of Customer Facing Display (CFD), Shift Reconciliation, and Termii SMS dispatch gateways. | Approved |
| `v3.4.0` | 2026-10-31 | Lead QA Systems Specialist | Extensive update incorporating 6 end-to-end user journeys, role handoffs, and PDF exports. | **APPROVED (LIVE)** |

### A.2 Governance & Sign-Off Matrix
| Stakeholder Role | Representative | Approval Date | Sign-Off Signature |
| :--- | :--- | :--- | :--- |
| **Chief Operating Officer** | Executive Management | October 31, 2026 | `APPROVED_ELECTRONICALLY` |
| **Head of Quality Assurance** | QA Systems Engineering | October 31, 2026 | `APPROVED_ELECTRONICALLY` |
| **Lead Restaurant Operations Manager** | Choplife Republic GRA Branch | October 31, 2026 | `APPROVED_ELECTRONICALLY` |

---

## SECTION B — PRODUCT OVERVIEW & SYSTEM ARCHITECTURE

The Choplife Republic Operations Platform is an enterprise Quick Service Restaurant (QSR) management software suite built for high-volume hospitality, multi-branch ordering, counter point-of-sale, kitchen production, inventory control, and financial governance.

```
+-----------------------------------------------------------------------------------+
|                        CHOPLIFE REPUBLIC PLATFORM ARCHITECTURE                     |
+-----------------------------------------------------------------------------------+
|  1. CUSTOMER STOREFRONT  |  2. POS REGISTER & TERMINALS  |  3. ADMIN BACK-OFFICE  |
|  - Branch Selector (`/`) |  - Front-Office POS (`/pos`)  |  - Executive BI (`/admin`)|
|  - Custom Box Builder    |  - Kitchen Display (KDS)      |  - Master Inventory    |
|  - Cart & Checkout       |  - Customer Display (`/cfd`)  |  - CMS & Menu Manager  |
|  - Live Order Tracker    |  - Thermal Printer Bridge     |  - Shift Reconciliation|
+-----------------------------------------------------------------------------------+
|                     SERVER & DATABASE ENGINE (`server.ts` & `server_db.ts`)        |
|  - Express REST API (`/api/*`)   - Persistent Storage (`choplife_ops_db.json`)    |
|  - Termii SMS Dispatcher          - Audit Logging Engine                          |
+-----------------------------------------------------------------------------------+
```

### B.1 Primary Interface Destinations
1. **Customer Storefront (`/`)**: Mobile-first customer ordering portal with branch picker, multi-category explorer, custom box builder, cart, and live order status tracker.
2. **Front-Office POS Workspace (`/pos`)**: High-throughput register terminal for cashiers and storekeepers supporting open check creation, bill splitting, cash/card/transfer tender settlements, and thermal receipt printing.
3. **Customer Facing Display (`/cfd`)**: Dual-screen counter display system showing active guest checks, live order line items, dynamic top bestseller rankings, and approved promotional media slideshows.
4. **Back-Office Administration (`/admin`)**: Governance and financial hub providing executive BI analytics, stock depletion recipes, procurement purchase orders, wastage logs, expense claims processing, staff RBAC permissions, and system settings.

---

## SECTION C — DETAILED END-TO-END USER JOURNEYS

### USER JOURNEY 1: Customer Online Ordering & Custom Small Chops Box Building
* **Primary Persona**: Guest Customer / Party Host
* **Target Objective**: Order custom small chops boxes and woodfire grills for home delivery in Benin City.
* **Starting Interface**: Storefront Homepage (`/`)
* **Required System Permissions**: Public Customer Access (Unauthenticated or OTP Verified)

```
[Customer Opens Storefront] ──► [Selects GRA Branch] ──► [Launches Box Builder]
                                                                  │
                                                                  v
[Receives Live Order Tracker] ◄── [Completes Checkout] ◄── [Adds Custom Box]
```

#### Step-by-Step UI Execution Flow
1. **Branch Selection**:
   - Access `https://.../`. Locate **Quick Branch Picker** below the hero banner.
   - Click target branch button (**G.R.A. Branch**, **Okabere Branch**, or **Ugbowo Branch**).
   - System updates product stock availability and delivery zone tariffs for the selected location.
2. **Custom Small Chops Builder Configuration**:
   - Click **Build Your Custom Box** on the homepage or Menu Explorer.
   - Adjust item quantity counters:
     - Puff Puff (Single units @ ₦100/pc) -> Set to `5`
     - Beef Samosa (Single units @ ₦500/pc) -> Set to `2`
     - Spring Roll (Single units @ ₦500/pc) -> Set to `2`
     - Peppered Turkey (Single units @ ₦3,500/pc) -> Set to `1`
   - Observe live price calculation in real time.
   - System automatically evaluates total packaging volume and assigns packaging unit `Food Tray 2300` (₦2,300).
   - Click **Add Custom Box to Order**. Item transfers to **Cart Drawer**.
3. **Cart Review & Checkout**:
   - Click **Cart Drawer** icon. Verify item breakdown and packaging fee.
   - Click **Proceed to Checkout**.
   - Select Fulfillment Method: **Home Delivery** or **Store Pickup**.
   - Enter street address (e.g. *14 Akhionbare Street, GRA, Benin City*) and contact phone number.
   - Select Payment Method:
     - **Paystack Online Payment**: Opens Paystack card/USSD popup modal.
     - **Direct Bank Transfer**: Displays GTBank account details (Account Number: `0123456789`). Upload proof of transfer screenshot.
   - Click **Place Order**.
4. **Order Confirmation & Real-Time Tracking**:
   - System generates tracking code (e.g. `CLR-8942`).
   - **Live Order Tracker** modal opens, displaying 4-stage visual timeline:
     - Stage 1: **Order Received** (Green Check)
     - Stage 2: **Kitchen Preparation** (Active Pulse)
     - Stage 3: **Quality Check & Packaging** (Pending)
     - Stage 4: **Out for Delivery** (Pending)

#### Handoff Points & Role Interactions
- **Customer -> System**: Order payload posted to `/api/orders/online`.
- **System -> Kitchen**: Order ticket automatically appears in Kitchen Display System queue (`/pos` KDS).
- **Kitchen -> Customer**: Status changes in KDS trigger Termii SMS notifications to customer's mobile device.

#### Failure Scenarios & Recovery Procedures
- *Payment Timeout*: If Paystack modal times out, customer is returned to Checkout with order state preserved. Customer can switch to Direct Bank Transfer.
- *Unverified Transfer*: If transfer proof upload is unclear, Storekeeper manually reviews bank statement in `/admin` and updates check status to `paid`.

---

### USER JOURNEY 2: Front-Office Cashier Counter Checkout & POS Settlement
* **Primary Persona**: Cashier / Storekeeper
* **Target Objective**: Open guest check, take in-person counter order, apply authorized waivers/discounts, settle check, and issue thermal receipt.
* **Starting Interface**: Front-Office POS Workspace (`/pos`)
* **Required System Permissions**: `pos.checkout`, `pos.check.open`, `pos.discount.apply`

```
[Cashier Logs into /pos] ──► [Opens New Check #CHK-104] ──► [Adds Menu Items]
                                                                    │
                                                                    v
[Prints Thermal Receipt] ◄── [Settles Cash/Card Tender] ◄── [Syncs to CFD /cfd]
```

#### Step-by-Step UI Execution Flow
1. **Opening Check**:
   - Cashier accesses `/pos` and logs in with staff credentials.
   - Click **New Check** in POS top header bar.
   - Select Check Type: **Dine-In Table #4** or **Counter Takeaway**.
   - System assigns tracking ID (e.g. `#CHK-104`).
2. **Item Addition & Custom Prep Notes**:
   - Tap category tabs on left sidebar (`Small Chops`, `Platters`, `Grills`, `Bakery`).
   - Tap product cards (`Mega Choplife Platter` ₦13,300, `Soft Bread` ₦1,200 x2) to add line items.
   - Click line item to open modification modal: adjust quantity or enter prep notes (*"Extra Pepper Sauce on side"*).
3. **Discount & Waiver Application**:
   - If patron holds valid waiver code or VIP discount, click **Apply Discount**.
   - Select Waiver Reason (*"Management Loyalty Waiver"* or *"Staff Meal Discount"*).
   - System validates staff permission (`pos.discount.apply`) and updates net check subtotal.
4. **Customer Facing Display Synchronization**:
   - Check line items and total update instantly on the Customer Facing Display (`/cfd`) facing the patron.
5. **Payment Settlement & Receipt Printing**:
   - Click **Settle Payment** on right action panel.
   - Select Settlement Tender:
     - **Cash**: Enter tendered amount (e.g. ₦20,000). System displays change due (₦3,122.50).
     - **Card / POS Terminal**: Enter RRN / POS terminal approval code.
     - **Bank Transfer**: Verify incoming alert on branch tablet.
   - Click **Complete Order & Print Receipt**.
   - Connected ESC/POS thermal printer prints receipt via local network bridge.

#### Handoff Points & Role Interactions
- **Cashier -> Kitchen**: Complete check dispatches item ticket to KDS kitchen printer/screen.
- **Cashier -> Customer**: Issued receipt and change given to customer; check marked as `paid` in system DB.

#### Failure Scenarios & Recovery Procedures
- *Printer Out of Paper*: System flags network printer warning bar. Cashier can open POS **Printers** modal to reprint receipt or view raw ESC/POS preview on screen.

---

### USER JOURNEY 3: Kitchen Lead & Line Cook Order Production (KDS)
* **Primary Persona**: Kitchen Lead / Chef
* **Target Objective**: Receive incoming orders from Storefront and POS, view Recipe BOM assembly specs, mark prep stages, and bump order status.
* **Starting Interface**: Kitchen Display System (`/pos` -> KDS Mode)
* **Required System Permissions**: `kds.view`, `kds.bump_status`

```
[Incoming Ticket Appears] ──► [Chef Views Recipe BOM] ──► [Marks "In Preparation"]
                                                                  │
                                                                  v
[Dispatches to Counter] ◄── [SMS Sent to Customer] ◄── [Marks "Ready for Pickup"]
```

#### Step-by-Step UI Execution Flow
1. **Monitoring KDS Ticket Queue**:
   - Kitchen Lead logs into `/pos` and switches view mode to **Kitchen Display System (KDS)**.
   - KDS renders incoming order cards sorted chronologically by prep urgency.
   - Tickets display color-coded elapsed time indicators:
     - Green: `< 10 minutes` elapsed
     - Yellow: `10 - 20 minutes` elapsed
     - Red Alert: `> 20 minutes` elapsed (High Urgency)
2. **Reviewing Recipe BOM Assembly Specs**:
   - Tap ticket card to expand line items.
   - View Recipe BOM ingredient specifications:
     - *Smoky Party Jollof*: 0.25 kg Rice, 0.05 L Oil, 0.30 kg Chicken, Pack 500.
3. **Updating Order Preparation Status**:
   - Tap **Start Prep**. Ticket status transitions to `preparing`. Storefront order tracker updates to Stage 2.
   - Complete cooking and food packaging.
   - Tap **Mark Ready**. Ticket status transitions to `ready`.
   - System triggers Termii SMS gateway notification to customer: *"Your Choplife Republic order #CLR-8942 is hot and ready for pickup!"*

---

### USER JOURNEY 4: Store Manager Inventory Procurement & Goods Received Notes (GRN)
* **Primary Persona**: Store Manager / Storekeeper
* **Target Objective**: Monitor ingredient balances, issue Purchase Orders (PO), log Goods Received Notes (GRN), and audit automated Recipe BOM stock depletions.
* **Starting Interface**: Master Inventory Manager (`/admin` -> **Inventory**)
* **Required System Permissions**: `inventory.manage`, `inventory.po.create`, `inventory.grn.receive`

```
[Low Stock Alert Triggered] ──► [Create Purchase Order] ──► [Supplier Delivers Goods]
                                                                     │
                                                                     v
[Stock Balances Updated] ◄── [Audit Ledger Entry] ◄── [Log Goods Received Note]
```

#### Step-by-Step UI Execution Flow
1. **Reviewing Stock Balances & Reorder Alerts**:
   - Navigate to `/admin` -> **Inventory** -> **Stock Balances**.
   - Review stock levels across GRA, Okabere, and Ugbowo locations.
   - System highlights items below minimum reorder thresholds (e.g. *Raw Chicken: 4.2 kg remaining / Minimum 15.0 kg*).
2. **Issuing Purchase Order (PO)**:
   - Switch tab to **Purchasing**. Click **Create Purchase Order (PO)**.
   - Select Supplier (*Benin Central Grain & Poultry Ltd*).
   - Add line items:
     - Raw Parboiled Rice: `50 kg` @ ₦1,200/kg (Total ₦60,000)
     - Fresh Whole Chicken: `30 kg` @ ₦2,500/kg (Total ₦75,000)
   - Click **Submit Purchase Order**. PO status set to `issued`.
3. **Logging Goods Received Note (GRN)**:
   - Upon physical supplier delivery at store loading dock, click **Receive Goods (GRN)** on the issued PO.
   - Inspect delivered items. Enter actual accepted quantities and supplier invoice reference (`INV-9921`).
   - Click **Confirm GRN Receipt**.
   - System instantly increases raw ingredient inventory balances and posts financial ledger debit entries.

---

### USER JOURNEY 5: Shift Manager Cash Reconciliation & Z-Report Close
* **Primary Persona**: Branch Manager / Cashier
* **Target Objective**: Audit cash drawer totals at shift close, reconcile card and transfer settlements against system balances, record variance, and lock shift.
* **Starting Interface**: POS Shift Management (`/pos` -> **Shift Z-Report**)
* **Required System Permissions**: `shift.manage`, `shift.reconcile`, `shift.close`

```
[Initiate Shift Close] ──► [Count Physical Cash Drawer] ──► [Input Terminal Slips]
                                                                     │
                                                                     v
[Lock & Archive Shift] ◄── [Log Variance Reason] ◄── [System Calculates Variance]
```

#### Step-by-Step UI Execution Flow
1. **Initiating Shift Closing Sequence**:
   - At end of shift, Cashier / Branch Manager clicks **Close Shift & Z-Report** in POS top navigation.
   - System displays system-recorded transaction summary for active shift period:
     - Cash Sales Recorded: `₦124,500`
     - Paystack Online Sales: `₦48,200`
     - POS Terminal Card Sales: `₦86,000`
     - Direct Bank Transfer Sales: `₦32,000`
     - Gross Shift Total: `₦290,700`
2. **Physical Cash & Slip Audit**:
   - Perform physical cash count in register drawer.
   - Input physical count breakdown (₦1,000 notes, ₦500 notes, etc.). Enter total physical cash: `₦124,000`.
   - Input total POS card terminal receipt slips: `₦86,000`.
3. **Variance Evaluation & Explanation**:
   - System compares physical counts against system recorded sales and calculates shift variance:
     - Cash Variance: `-₦500` (Shortage)
   - Enter mandatory variance explanation (*"Minor change error on Check #CHK-088"*).
4. **Shift Finalization & Lock**:
   - Click **Submit Z-Report & Lock Shift**.
   - System locks shift records, generates immutable Z-Report PDF/audit file, and dispatches summary notification to corporate accounting.

---

### USER JOURNEY 6: Marketing Manager Promotion Campaign Creation & Segregation Approval
* **Primary Persona**: Content Editor / Super Admin
* **Target Objective**: Create a new promotional deal, enforce Segregation of Duties (prevent self-approval), secure Super Admin sign-off, and publish deal to Customer Facing Display (`/cfd`).
* **Starting Interface**: Admin CMS & Menu Manager (`/admin` -> **CMS / Promotions**)
* **Required System Permissions**: `cms.edit`, `promotion.create`, `promotion.approve`

```
[Content Editor Drafts Deal] ──► [Status: Pending Approval] ──► [Self-Approval Blocked 403]
                                                                         │
                                                                         v
[Revoked if Product Archived] ◄── [Live Slideshow on /cfd] ◄── [Super Admin Approves]
```

#### Step-by-Step UI Execution Flow
1. **Drafting Promotion Campaign**:
   - Content Editor logs into `/admin` -> **CMS / Promotions**.
   - Click **Create Promotion**.
   - Enter campaign details:
     - Title: *"Weekend Woodfire Special"*
     - Subtitle: *"Get 20% off Woodfire Peppered Turkey"*
     - Target Product: `prod-turkey-peppered` (Woodfire Peppered Turkey)
     - Promotion Type: `discount_percentage` (20%)
     - Target Branches: `G.R.A. Branch`, `Okabere Branch`
     - Badge Label: `"WEEKEND SPECIAL"` (Color: Gold `#FFC700`)
   - Click **Save Promotion Draft**. Campaign status set to `pending_approval`.
2. **Testing Segregation of Duties Block**:
   - Content Editor attempts to click **Approve Promotion** on their own draft.
   - System validates creator ID (`createdByStaffId === staffId`) and blocks action with HTTP `403 Forbidden`:
     *"Segregation of Duties Violation: You cannot approve a promotion you created unless you are a Super Administrator."*
3. **Super Administrator Review & Approval**:
   - Super Administrator logs into `/admin`.
   - Reviews promotion terms and verifies referenced product is published in Menu Catalogue.
   - Click **Approve & Publish Promotion**.
   - Status transitions to `approved` / `published`.
4. **Live CFD Slideshow Display**:
   - Customer Facing Display (`/cfd`) detects published promotion and rotates campaign slide in promotional carousel.
5. **Automatic Product Archival Revocation**:
   - If Store Manager later changes status of `Woodfire Peppered Turkey` to `archived` in Menu Catalogue, system automatically revokes promotion status to `revoked` to prevent false advertising.

---

## SECTION D — USER ROLES & ACCESS PERMISSIONS MATRIX

| Operational Role | Primary Workspace | Permitted Actions & Responsibilities | Restricted Actions |
| :--- | :--- | :--- | :--- |
| `super_admin` | Full System Access | Full administrative control, role assignment, system setting overrides, package reactivation, promotion approval. | None. |
| `corporate_admin` | Admin Portal (`/admin`) | Multi-branch financial oversight, menu management, bulk imports, audit review. | System credential rotation. |
| `branch_manager` | POS & Admin Workspaces | Shift management, discount waivers, cash drawer balancing, expense review, local stock adjustment. | Global system configuration. |
| `store_manager` | POS & Admin Workspaces | Inventory procurement, GRN creation, stocktakes, wastage logging, shift reconciliation. | Role privilege escalation. |
| `cashier` | POS Register (`/pos`) | Open guest checks, item addition, cash/card/transfer check settlement, thermal receipt printing. | Price overrides, expense approvals. |
| `kitchen_lead` | Kitchen Display (`/pos`) | View incoming order queue, bump order statuses (Preparing -> Ready), recipe reference. | Payment processing, inventory adjustments. |
| `storekeeper` | Inventory (`/admin`) | Stock balance updates, stocktake entry, goods received recording. | Financial ledger postings. |
| `accountant` | Admin Portal (`/admin`) | Expense claim payout approval, shift reconciliation verification, financial reporting. | Menu catalogue modifications. |
| `auditor` | Admin Portal (`/admin`) | Read-only audit log inspection, financial reconciliation review, inventory ledger tracking. | Data creation, deletion, or editing. |

---

## SECTION E — TROUBLESHOOTING & RECOVERY PROCEDURES

| Symptom / Error | Affected Area | Root Cause Analysis | Verified Recovery Procedure | Actions to Avoid |
| :--- | :--- | :--- | :--- | :--- |
| **"API endpoint not found"** | Express REST API (`/api/*`) | Route requested without required `/api/` prefix or misconfigured router. | Verify request URL starts with `/api/` (e.g. `/api/cfd/display-screen`). Restart dev server via `restart_dev_server`. | Do not remove route prefixes or create un-prefixed root routes. |
| **"Forbidden: Insufficient privileges"** | POS / Admin Workspace | Staff role lacks explicit permission code for requested action. | Log out and log in with an authorized account (e.g. `super_admin`). Check Role Permissions in `/admin`. | Do not attempt to bypass RBAC checks in client code. |
| **Thermal Printer Disconnected** | POS Hardware | USB/Network printer bridge socket offline or wrong IP configured. | Check IP in `/pos` -> **Printers**. Run **Hardware Diagnostics Test**. Ensure thermal printer is powered on. | Do not clear browser local storage while checks are open. |
| **Paystack Modal Fails to Open** | Checkout | Public key missing or network connectivity interrupted. | Verify internet connection. Fall back to **Direct Bank Transfer** payment method in Checkout modal. | Do not refresh page during payment processing. |

---

### End of Document
**Choplife Republic Operations & Software Platform (`v3.4 Production`)**  
*100% Maximum Enjoyment — Benin City, Edo State, Nigeria*
