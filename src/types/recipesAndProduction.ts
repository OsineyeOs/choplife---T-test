import type { InventoryLocationId } from './inventoryAndProcurement';

export interface RecipeIngredient {
  ingredientItemId: string; // Reference to InventoryItem.id
  ingredientName: string;
  quantity: number; // in recipeUnit
  unit: string; // "g", "ml", "pcs"
  wastePercentage: number; // e.g. 5% trim waste
  costPerRecipeUnit: number;
  calculatedCost: number;
}

export interface RecipeBOM {
  id: string; // e.g. "recipe-shawarma-chicken-sp"
  menuProductId: string; // Reference to Product.id
  menuProductName: string;
  category?: string;
  version: string; // e.g. "v1.2"
  effectiveDate: string;
  yieldPortions: number; // e.g. 1 portion
  ingredients: RecipeIngredient[];
  totalCostPerPortion: number;
  prepInstructions?: string;
  isCurrentActiveVersion: boolean;
  createdByStaffId: string;
  createdAt: string;
}

export interface ProductionBatch {
  id: string; // e.g. "mfg-1725283921"
  batchNumber: string; // e.g. "MFG-000054"
  productionLocation: InventoryLocationId; // e.g. 'gra' or 'general_store'
  recipeId: string;
  targetProductItemId: string;
  targetProductName: string;
  plannedQuantity: number;
  actualQuantityYielded: number;
  unit: string;
  ingredientsUsed: {
    itemId: string;
    itemName: string;
    expectedQty: number;
    actualQty: number;
    unit: string;
  }[];
  startedAt: string;
  completedAt?: string;
  producedByStaffId: string;
  producedByName: string;
  status: 'planned' | 'in_prep' | 'completed' | 'cancelled';
  notes?: string;
}

export interface VarianceAnalysisItem {
  itemId: string;
  itemName: string;
  sku: string;
  locationId: InventoryLocationId;
  openingStock: number;
  purchasesReceipts: number;
  transfersIn: number;
  transfersOut: number;
  wastageLogged: number;
  adjustments: number;
  theoreticalPOSConsumption: number;
  expectedClosingStock: number;
  actualPhysicalStock: number;
  quantityVariance: number;
  unitCost: number;
  costVarianceNaira: number;
  variancePercentage: number;
  efficiencyScore: number;
  status: 'healthy' | 'investigate' | 'critical_shortage';
}
