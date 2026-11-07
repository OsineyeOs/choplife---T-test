/**
 * Choplife Republic — Package & Platter Accounting Verification Script
 * Exercises the exact required business logic scenario:
 * - 3 platters (each containing 4 samosas and 2 spring rolls)
 * - 5 individual samosas
 * Reconciles:
 *   - Standalone unit sales: 5 samosas, 0 spring rolls, 0 platters
 *   - Included in packages: 12 samosas, 6 spring rolls, 0 platters
 *   - Packages sold: 3 platters
 *   - Total unit demand: 17 samosas, 6 spring rolls, 3 packages
 * Verifies correct inventory consumption (17 samosas, 6 spring rolls) and zero revenue double-counting.
 */

interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  components?: Array<{ productId: string; name: string; quantity: number; unitPrice: number }>;
}

function expandOrderItems(items: OrderItem[]): {
  packagesSold: Record<string, number>;
  standaloneUnitsSold: Record<string, number>;
  includedInPackages: Record<string, number>;
  totalUnitDemand: Record<string, number>;
  totalRevenue: number;
} {
  const packagesSold: Record<string, number> = {};
  const standaloneUnitsSold: Record<string, number> = {};
  const includedInPackages: Record<string, number> = {};
  let totalRevenue = 0;

  for (const item of items) {
    totalRevenue += item.unitPrice * item.quantity;
    if (item.components && item.components.length > 0) {
      packagesSold[item.productId] = (packagesSold[item.productId] || 0) + item.quantity;
      for (const comp of item.components) {
        const compQty = comp.quantity * item.quantity;
        includedInPackages[comp.productId] = (includedInPackages[comp.productId] || 0) + compQty;
      }
    } else {
      standaloneUnitsSold[item.productId] = (standaloneUnitsSold[item.productId] || 0) + item.quantity;
    }
  }

  const allKeys = new Set([...Object.keys(standaloneUnitsSold), ...Object.keys(includedInPackages)]);
  const totalUnitDemand: Record<string, number> = {};
  for (const k of allKeys) {
    totalUnitDemand[k] = (standaloneUnitsSold[k] || 0) + (includedInPackages[k] || 0);
  }

  return {
    packagesSold,
    standaloneUnitsSold,
    includedInPackages,
    totalUnitDemand,
    totalRevenue,
  };
}

function runPackageVerification() {
  console.log('================================================================');
  console.log('CHOPLIFE REPUBLIC — PACKAGE & PLATTER ACCOUNTING VERIFICATION');
  console.log('================================================================');

  const platterComponentDefinition = [
    { productId: 'prod-samosa', name: 'Crispy Samosa', quantity: 4, unitPrice: 500 },
    { productId: 'prod-spring-roll', name: 'Spring Roll', quantity: 2, unitPrice: 600 },
  ];

  const orderItems: OrderItem[] = [
    {
      productId: 'prod-platter-special',
      name: 'Small Chops Special Platter',
      quantity: 3,
      unitPrice: 5000,
      components: platterComponentDefinition,
    },
    {
      productId: 'prod-samosa',
      name: 'Crispy Samosa',
      quantity: 5,
      unitPrice: 500,
    },
  ];

  const results = expandOrderItems(orderItems);

  console.log('\n--- EXPANSION RESULTS ---');
  console.log('Packages Sold (Platters):', results.packagesSold);
  console.log('Standalone Units Sold (Individual Samosas):', results.standaloneUnitsSold);
  console.log('Included in Packages (Samosas & Spring Rolls):', results.includedInPackages);
  console.log('Total Unit Demand:', results.totalUnitDemand);
  console.log('Total Revenue:', results.totalRevenue);

  assert(results.packagesSold['prod-platter-special'] === 3, 'Exactly 3 platters sold as packages');
  assert(results.standaloneUnitsSold['prod-samosa'] === 5, 'Exactly 5 samosas sold individually');
  assert(results.includedInPackages['prod-samosa'] === 12, 'Exactly 12 samosas included in packages (3 * 4)');
  assert(results.includedInPackages['prod-spring-roll'] === 6, 'Exactly 6 spring rolls included in packages (3 * 2)');
  assert(results.totalUnitDemand['prod-samosa'] === 17, 'Total samosa demand is exactly 17 (12 + 5)');
  assert(results.totalUnitDemand['prod-spring-roll'] === 6, 'Total spring roll demand is exactly 6');
  assert(results.totalRevenue === 3 * 5000 + 5 * 500, 'Total revenue equals package revenue + individual item revenue without double counting');

  console.log('\n================================================================');
  console.log('ALL PACKAGE ACCOUNTING & RECONCILIATION ASSERTIONS PASSED (100%)');
  console.log('================================================================');
}

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  console.log(`  [PASS] ${message}`);
}

runPackageVerification();
