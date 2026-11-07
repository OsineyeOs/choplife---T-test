# Persistence Dependency Register

| Domain | Current JSON source | Routes/services using it | PostgreSQL repository | Migration status |
| :--- | :--- | :--- | :--- | :--- |
| Organisation | `server_db.ts` | `server/routes/authAndHealthRouter.ts` | `server/repositories/branchRepository.ts` | In Progress |
| Staff | `server_db.ts` | `server/routes/staffAndRbacRouter.ts`, `server/middleware/authAndRbac.ts` | `server/repositories/staffRepository.ts` | In Progress |
| Menu | `server_db.ts` | `server/routes/cmsAndMenuRouter.ts` | `server/repositories/menuRepository.ts` | In Progress |
| POS Checks | `server_db.ts` | `server/routes/posChecksAndOfflineRouter.ts` | `server/repositories/posRepository.ts` (Pending) | Not started |
| Inventory | `server_db.ts` | `server/routes/inventoryItemsRouter.ts` | `server/repositories/inventoryRepository.ts` (Pending) | Not started |
| Orders | `server_db.ts` | `server/routes/onlineOrdersAndCustomerRouter.ts` | `server/repositories/orderRepository.ts` | In Progress |
| Payments | `server_db.ts` | `server/routes/reconciliationRouter.ts`, `server_payments.ts` | `server/repositories/paymentRepository.ts` (Pending) | Not started |
| Financials | `server_db.ts` | `server/routes/financialManagementRouter.ts` | `server/repositories/accountingRepository.ts` (Pending) | Not started |
| Audit Logs | `server_db.ts` | `server/middleware/authAndRbac.ts` | `server/repositories/auditRepository.ts` (Pending) | Not started |
