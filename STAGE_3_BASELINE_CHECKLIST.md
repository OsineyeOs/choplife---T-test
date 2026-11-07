# Stage 3 Independent Audit and Baseline Checklist

| Area | Current state | Evidence | Required action |
|---|---|---|---|
| Payment modal | Partially Scaffolded | `src/components/pos/modals/POSPaymentModal.tsx` exists as empty shell; not integrated. | Complete integration with `usePOSPayment.ts` and remove from `StaffPosModal.tsx`. |
| Cart responsibilities | Partially extracted | `usePOSCart.ts` exists. | Verify full cleanup of parent-level cart handling in `StaffPosModal.tsx`. |
| Customer/Loyalty | Partially extracted | `usePOSCustomerLoyalty.ts` exists. | Verify full cleanup of parent-level loyalty handling. |
| Payment-state | Duplicated/Coupled | `StaffPosModal.tsx` holds state and logic for payments, directly using `usePOSPayment` for some parts. | Move state/logic fully into `POSPaymentModal.tsx` or `usePOSPayment.ts`. |
| Printer/Receipt | Coupled to Parent | Logic resides directly in `StaffPosModal.tsx`. | Extract to `POSReceiptModal.tsx` or handle via refined `usePOSPrinter.ts`. |
| Held Tickets | Monolithic | Logic in `StaffPosModal.tsx`. | Consider extraction if scope allows. |
| Regression | Minimal/Existing | Existing tests (if any). | Add focused tests for payment/cart flows. |
