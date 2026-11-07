# ChopLife Republic — CMS Permissions Matrix

| Role | View Content | Create / Edit Content | Publish / Unpublish | Delete / Archive | System Settings |
|---|---|---|---|---|---|
| **Customer / Public** | Published Only | No | No | No | No |
| **Cashier / Waiter / Kitchen** | Read-Only | No | No | No | No |
| **Storekeeper / Inventory** | Read-Only | No | No | No | No |
| **Branch Manager** | Branch Content | Branch Content | Branch Content | Archive Only | Branch Config |
| **Corporate Admin / Super Admin** | Full Access | Full Access | Full Access | Full Access | Full Access |

---
*Enforced via server-side `requireAuth` and `requireRole` middleware.*
