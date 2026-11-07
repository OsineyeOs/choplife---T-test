# Stage 5 Plan: Inventory System Modularisation

## Objective
Further decouple inventory logic from `MasterInventoryManager.tsx` to improve maintainability and testability.

## Strategy
1.  **Independent Audit**: Review the `MasterInventoryManager` and sub-tab components to identify redundant state management or tightly coupled `useApp` interactions.
2.  **Hook Extraction**: Create a dedicated `useInventory` hook (or split by domain: `useInventoryBalances`, `useInventoryPurchasing`, etc.) to move state management out of the UI components.
3.  **State Consolidation**: Evaluate if current `useApp` context usage can be migrated to more focused providers or hooks.
4.  **Verification**: Add or enhance existing tests for the inventory domain to ensure no regressions in state tracking, wastage logging, or purchase order creation.

## Proposed Actions
- [ ] Conduct detailed audit of `MasterInventoryManager.tsx` and sub-tab components.
- [ ] Create `src/hooks/inventory/useInventory.ts` (or similar).
- [ ] Refactor `MasterInventoryManager` to use the new hook(s).
- [ ] Verify functionality (Stocktake, Wastage, Purchasing).
- [ ] Update documentation and stage register.
