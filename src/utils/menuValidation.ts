import { MASTER_PRODUCTS, DEALS_LIST } from '../data/menu';
import { Product, Deal } from '../types';

export interface ValidationIssue {
  type: 'duplicate_id' | 'missing_field' | 'unapproved_price' | 'forbidden_term' | 'invalid_combo' | 'invalid_category' | 'wholesale_mismatch';
  severity: 'error' | 'warning';
  itemId: string;
  itemName: string;
  message: string;
  category?: string;
}

export interface ValidationReport {
  timestamp: string;
  totalProductsChecked: number;
  totalDealsChecked: number;
  totalIssuesFound: number;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
  isClean: boolean;
  categoryCounts: Record<string, number>;
}

const VALID_CATEGORIES = new Set([
  'food',
  'protein',
  'snacks',
  'drinks',
  'small-chops',
  'bakery',
  'packaging',
  'events',
]);

export function validateMenuData(products: Product[] = MASTER_PRODUCTS, deals: Deal[] = DEALS_LIST): ValidationReport {
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();
  const categoryCounts: Record<string, number> = {};

  // 1. Check for Duplicate IDs, Missing Fields, Categories & Forbidden Terms in Products
  products.forEach((product) => {
    // Category tally
    categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;

    // Duplicate check
    if (seenIds.has(product.id)) {
      issues.push({
        type: 'duplicate_id',
        severity: 'error',
        itemId: product.id,
        itemName: product.name,
        category: product.category,
        message: `Duplicate product ID encountered: "${product.id}"`,
      });
    }
    seenIds.add(product.id);

    // Required fields check
    if (!product.name || !product.category || product.basePrice === undefined || product.basePrice === null) {
      issues.push({
        type: 'missing_field',
        severity: 'error',
        itemId: product.id,
        itemName: product.name || 'Unnamed item',
        category: product.category,
        message: `Product is missing required core fields (name, category, or basePrice)`,
      });
    }

    if (!product.image) {
      issues.push({
        type: 'missing_field',
        severity: 'warning',
        itemId: product.id,
        itemName: product.name,
        category: product.category,
        message: `Product has no image URL defined`,
      });
    }

    // Category standardisation
    if (product.category && !VALID_CATEGORIES.has(product.category)) {
      issues.push({
        type: 'invalid_category',
        severity: 'error',
        itemId: product.id,
        itemName: product.name,
        category: product.category,
        message: `Category "${product.category}" does not match approved schema (food, protein, snacks, drinks, small-chops, bakery, packaging, events)`,
      });
    }

    // Wholesale consistency check
    if (product.isWholesale) {
      if (!product.minOrderQty || !product.wholesaleUnitPrice) {
        issues.push({
          type: 'wholesale_mismatch',
          severity: 'warning',
          itemId: product.id,
          itemName: product.name,
          category: product.category,
          message: `Wholesale product missing minOrderQty or wholesaleUnitPrice definition`,
        });
      } else {
        const calculatedBase = product.minOrderQty * product.wholesaleUnitPrice;
        if (Math.abs(calculatedBase - product.basePrice) > 10) {
          issues.push({
            type: 'wholesale_mismatch',
            severity: 'warning',
            itemId: product.id,
            itemName: product.name,
            category: product.category,
            message: `Base price (₦${product.basePrice}) differs from minOrderQty (${product.minOrderQty}) × wholesaleUnitPrice (₦${product.wholesaleUnitPrice}) = ₦${calculatedBase}`,
          });
        }
      }
    }

    // Forbidden terminology checks (VIP, HALAL CERTIFIED, HALAL)
    const combinedText = `${product.name} ${product.shortDescription || ''} ${product.longDescription || ''} ${product.subcategory || ''}`.toLowerCase();
    if (combinedText.includes('halal certified') || combinedText.includes('halal')) {
      issues.push({
        type: 'forbidden_term',
        severity: 'error',
        itemId: product.id,
        itemName: product.name,
        category: product.category,
        message: `Product contains forbidden text referencing "HALAL" or "HALAL CERTIFIED"`,
      });
    }
    
    // Check for word boundary "vip" to avoid matching words like "living" or "serving"
    if (/\bvip\b/i.test(combinedText)) {
      issues.push({
        type: 'forbidden_term',
        severity: 'error',
        itemId: product.id,
        itemName: product.name,
        category: product.category,
        message: `Product contains forbidden terminology "VIP"`,
      });
    }
  });

  // 2. Check Deals / Combos
  deals.forEach((deal) => {
    if (seenIds.has(deal.id)) {
      issues.push({
        type: 'duplicate_id',
        severity: 'error',
        itemId: deal.id,
        itemName: deal.title,
        message: `Duplicate ID encountered in deals list: "${deal.id}"`,
      });
    }
    seenIds.add(deal.id);

    const combinedDealText = `${deal.title} ${deal.badge} ${deal.tagline} ${deal.description} ${(deal.itemsIncluded || []).join(' ')}`.toLowerCase();
    if (/\bvip\b/i.test(combinedDealText)) {
      issues.push({
        type: 'forbidden_term',
        severity: 'error',
        itemId: deal.id,
        itemName: deal.title,
        message: `Deal contains forbidden terminology "VIP"`,
      });
    }
    if (combinedDealText.includes('halal')) {
      issues.push({
        type: 'forbidden_term',
        severity: 'error',
        itemId: deal.id,
        itemName: deal.title,
        message: `Deal contains forbidden text "HALAL"`,
      });
    }

    // Mathematical combo verification
    if (deal.components && deal.components.length > 0) {
      const sumComponentPrices = deal.components.reduce(
        (sum, comp) => sum + comp.unitPrice * comp.quantity,
        0
      );
      if (Math.abs(sumComponentPrices - deal.originalPrice) > 50) {
        issues.push({
          type: 'invalid_combo',
          severity: 'warning',
          itemId: deal.id,
          itemName: deal.title,
          message: `Calculated component sum (₦${sumComponentPrices.toLocaleString()}) does not match originalPrice (₦${deal.originalPrice.toLocaleString()})`,
        });
      }

      // Check savings calculation
      const calculatedSavings = deal.originalPrice - deal.dealPrice;
      if (Math.abs(calculatedSavings - deal.savings) > 50) {
        issues.push({
          type: 'invalid_combo',
          severity: 'warning',
          itemId: deal.id,
          itemName: deal.title,
          message: `Calculated savings (₦${calculatedSavings.toLocaleString()}) does not match deal.savings (₦${deal.savings.toLocaleString()})`,
        });
      }
    }
  });

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    timestamp: new Date().toISOString(),
    totalProductsChecked: products.length,
    totalDealsChecked: deals.length,
    totalIssuesFound: issues.length,
    errorCount,
    warningCount,
    issues,
    isClean: errorCount === 0,
    categoryCounts,
  };
}
