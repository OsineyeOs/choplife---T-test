import bcrypt from 'bcryptjs';
import {
  INITIAL_CANONICAL_INVENTORY,
  INITIAL_SUPPLIERS,
  INITIAL_RECIPES_BOM,
  INITIAL_STOCK_REQUESTS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_GOODS_RECEIPT_NOTES,
  INITIAL_STOCK_LEDGER,
  INITIAL_WASTAGE_RECORDS,
} from '../../src/data/inventoryMaster.ts';
import { DEFAULT_STANDARD_ROLES } from '../../src/data/rbacCatalogue.ts';
import { MENU_CATEGORIES, MASTER_PRODUCTS } from '../../src/data/menu.ts';
import { ARTICLES_LIST } from '../../src/data/articles.ts';
import { CANONICAL_PACKAGE_COMPOSITIONS } from '../services/packageAndPricingEngine.ts';
import type { DbDatabase, DbTable } from './schemaTypes.ts';
import {
  DEFAULT_STAFF_ACCOUNTS,
  DEFAULT_RIDERS,
  AUTHORITATIVE_BRANCHES,
  CANONICAL_FIXED_ASSETS,
  DEFAULT_RECEIPT_TEMPLATES,
} from './canonicalSeeds.ts';

export function generateInitialTables(): Record<string, DbTable> {
  const tables: Record<string, DbTable> = {};
  const branches = ['gra', 'okabere', 'ugbowo'];

  for (const branchId of branches) {
    // 12 Main Dining Tables
    for (let i = 1; i <= 12; i++) {
      const numStr = i < 10 ? `0${i}` : `${i}`;
      const id = `tbl-${branchId}-${numStr}`;
      tables[id] = {
        id,
        branchId,
        tableNumber: `Table ${numStr}`,
        area: 'Main Dining',
        capacity: i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2,
        status: 'available',
        guestCount: 0,
        updatedAt: new Date().toISOString(),
      };
    }

    // 4 VIP Lounge Booths
    for (let i = 1; i <= 4; i++) {
      const id = `tbl-${branchId}-vip-${i}`;
      tables[id] = {
        id,
        branchId,
        tableNumber: `VIP Lounge ${i}`,
        area: 'VIP Lounge',
        capacity: 8,
        status: 'available',
        guestCount: 0,
        updatedAt: new Date().toISOString(),
      };
    }

    // 6 Outdoor Terrace Tables
    for (let i = 1; i <= 6; i++) {
      const id = `tbl-${branchId}-terrace-${i}`;
      tables[id] = {
        id,
        branchId,
        tableNumber: `Terrace ${i}`,
        area: 'Outdoor Terrace',
        capacity: 4,
        status: 'available',
        guestCount: 0,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  return tables;
}

export function seedInitialDataForDb(db: DbDatabase): void {
  db.tables = generateInitialTables();
  for (const item of INITIAL_CANONICAL_INVENTORY) {
    db.inventory[item.id] = JSON.parse(JSON.stringify(item));
  }
  for (const sup of INITIAL_SUPPLIERS) {
    db.suppliers[sup.id] = JSON.parse(JSON.stringify(sup));
  }
  for (const rec of INITIAL_RECIPES_BOM) {
    db.recipes[rec.id] = JSON.parse(JSON.stringify(rec));
  }
  if (process.env.ENABLE_DEMO_DATA === 'true') {
    for (const req of INITIAL_STOCK_REQUESTS) {
      db.requests[req.id] = JSON.parse(JSON.stringify(req));
    }
    for (const po of INITIAL_PURCHASE_ORDERS) {
      db.purchaseOrders[po.id] = JSON.parse(JSON.stringify(po));
    }
    for (const grn of INITIAL_GOODS_RECEIPT_NOTES) {
      db.goodsReceiptNotes[grn.id] = JSON.parse(JSON.stringify(grn));
    }
    db.ledger = JSON.parse(JSON.stringify(INITIAL_STOCK_LEDGER));
    db.wastage = JSON.parse(JSON.stringify(INITIAL_WASTAGE_RECORDS));
  }
  seedRolesForDb(db);
  seedStaffAccountsForDb(db);
  seedCmsAndMenuCatalogueForDb(db);
  seedFixedAssetsForDb(db);
}

export function seedRolesForDb(db: DbDatabase): void {
  db.roles = db.roles || {};
  let added = 0;
  for (const role of DEFAULT_STANDARD_ROLES) {
    if (!db.roles[role.id]) {
      db.roles[role.id] = JSON.parse(JSON.stringify(role));
      added++;
    } else if (role.isSystem) {
      const currentPrivs = new Set(db.roles[role.id].privileges || []);
      for (const p of role.privileges) {
        currentPrivs.add(p);
      }
      db.roles[role.id].privileges = Array.from(currentPrivs);
    }
  }
  if (added > 0) {
    console.log(`[DB] Initialized ${added} canonical ChopLife access control roles.`);
  }
}

function hashPasswordHelper(password: string): { hash: string; salt: string } {
  return {
    hash: bcrypt.hashSync(password, 10),
    salt: '',
  };
}

export function seedStaffAccountsForDb(db: DbDatabase): void {
  const defaultPw = 'ChopLife2025!';
  const defaultAccounts = DEFAULT_STAFF_ACCOUNTS;
  const { hash, salt } = hashPasswordHelper(defaultPw);

  for (const acc of defaultAccounts) {
    const existingKey = Object.keys(db.staff).find(
      (k) => db.staff[k].staffId === acc.staffId || db.staff[k].workEmail.toLowerCase() === acc.workEmail.toLowerCase() || k === acc.id
    );
    const existing = existingKey ? db.staff[existingKey] : null;
    const pinHash =
      existing?.pinHash && String(existing.pinHash).startsWith('$2')
        ? existing.pinHash
        : acc.pin
        ? bcrypt.hashSync(acc.pin, 8)
        : null;

    if (!existing) {
      db.staff[acc.id] = {
        ...acc,
        passwordHash: hash,
        pinHash,
        salt,
      };
    } else {
      existing.pinHash = pinHash;
      existing.staffId = acc.staffId;
      existing.workEmail = acc.workEmail;
      existing.name = acc.name;
      existing.role = acc.role;
      existing.branchId = acc.branchId;
      existing.passwordHash = hash;
      existing.salt = salt;
      existing.status = 'active';
      (existing as any).failedLoginAttempts = 0;
      (existing as any).lockoutUntil = null;
      if (acc.dateOfBirth) existing.dateOfBirth = acc.dateOfBirth;
      if (acc.guarantorName) existing.guarantorName = acc.guarantorName;
      if (acc.guarantorPhone) existing.guarantorPhone = acc.guarantorPhone;
      if (acc.guarantorRelationship) existing.guarantorRelationship = acc.guarantorRelationship;
      if (acc.guarantorAddress) existing.guarantorAddress = acc.guarantorAddress;
      if (acc.guarantorWorkplace) existing.guarantorWorkplace = acc.guarantorWorkplace;
    }
  }

  for (const s of Object.values(db.staff)) {
    delete (s as any).pin;
  }

  for (const rider of DEFAULT_RIDERS) {
    if (!db.riders[rider.id]) {
      db.riders[rider.id] = rider;
    }
  }
}

export function seedBranchesForDb(db: DbDatabase): void {
  db.branches = db.branches || {};
  for (const branch of AUTHORITATIVE_BRANCHES) {
    if (!db.branches[branch.id]) {
      db.branches[branch.id] = JSON.parse(JSON.stringify(branch));
    } else {
      db.branches[branch.id].address = branch.address;
      db.branches[branch.id].phone = branch.phone;
      db.branches[branch.id].whatsappNumber = branch.whatsappNumber;
      db.branches[branch.id].name = branch.name;
      db.branches[branch.id].shortName = branch.shortName;
      db.branches[branch.id].latitude = branch.latitude;
      db.branches[branch.id].longitude = branch.longitude;
      db.branches[branch.id].openingHours = branch.openingHours;
      db.branches[branch.id].dineInHours = branch.dineInHours;
      db.branches[branch.id].deliveryHours = branch.deliveryHours;
      db.branches[branch.id].bakeryHours = branch.bakeryHours;
      db.branches[branch.id].staffHours = branch.staffHours;
    }
  }
}

export function seedFixedAssetsForDb(db: DbDatabase): void {
  db.assets = db.assets || {};
  let added = 0;
  for (const asset of CANONICAL_FIXED_ASSETS) {
    if (!db.assets[asset.id]) {
      db.assets[asset.id] = JSON.parse(JSON.stringify(asset));
      added++;
    }
  }
  if (added > 0) {
    console.log(`[DB] Initialized ${added} fixed assets in segregated Asset Register.`);
  }
}

export function seedReceiptTemplatesForDb(db: DbDatabase): void {
  db.receiptTemplates = db.receiptTemplates || {};
  for (const [key, tmpl] of Object.entries(DEFAULT_RECEIPT_TEMPLATES)) {
    if (!db.receiptTemplates[key]) {
      db.receiptTemplates[key] = JSON.parse(JSON.stringify(tmpl));
    }
  }
}

export function hashWalletPin(pin: string): string {
  const cleanPin = String(pin || '').trim();
  if (!cleanPin) {
    throw new Error('Wallet PIN cannot be empty.');
  }
  return bcrypt.hashSync(cleanPin, 10);
}

export function verifyWalletPin(pin: string, customer: any): boolean {
  if (!customer || !customer.walletPinHash) return false;
  const cleanPin = String(pin || '').trim();
  if (!cleanPin) return false;

  try {
    return bcrypt.compareSync(cleanPin, customer.walletPinHash);
  } catch {
    return false;
  }
}

export function sanitizeCustomerRecord(customer: any): any {
  if (!customer || typeof customer !== 'object') return customer;
  const { walletPin, walletPinHash, ...safe } = customer;
  return {
    ...safe,
    hasWalletPin: Boolean(walletPinHash || walletPin),
  };
}

/**
 * Authoritative Choplife Republic Loyalty Rule:
 * Every ₦1,000 of qualifying net food/beverage spend earns 1 Point.
 * Delivery fees are excluded from point accrual, and discounts are deducted before point calculation.
 */
export function calculateLoyaltyPoints(
  input:
    | {
        subtotal?: number;
        discount?: number;
        discountAmount?: number;
        deliveryFee?: number;
        total?: number;
      }
    | number
): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) return 0;
    return Math.floor(input / 1000);
  }
  if (!input || typeof input !== 'object') return 0;

  const discount = Math.max(0, Number(input.discount ?? input.discountAmount ?? 0) || 0);
  const deliveryFee = Math.max(0, Number(input.deliveryFee ?? 0) || 0);
  const hasExplicitSubtotal = input.subtotal !== undefined && input.subtotal !== null && Number(input.subtotal) > 0;

  const qualifyingSpend = hasExplicitSubtotal
    ? Math.max(0, Number(input.subtotal) - discount)
    : Math.max(0, Number(input.total ?? 0) - deliveryFee - discount);

  return Math.floor(qualifyingSpend / 1000);
}

export function awardOrderLoyaltyPointsIfEligible(dbInstance: any, orderOrCheck: any, nowIso?: string): number {
  if (!dbInstance || !orderOrCheck) return 0;
  if (orderOrCheck.loyaltyPointsAwardedAt) {
    return Number(orderOrCheck.loyaltyPointsEarned || 0);
  }

  const rawPhone = String(
    orderOrCheck.customerPhone || orderOrCheck.deliveryDetails?.customerPhone || ''
  ).replace(/[^0-9]/g, '');
  const custId = orderOrCheck.customerId || orderOrCheck.paymentDetails?.customerId;

  let customer = custId ? dbInstance.customers?.[custId] : null;
  if (!customer && rawPhone.length >= 8) {
    customer = Object.values(dbInstance.customers || {}).find((c: any) => {
      const cPhone = String(c.phone || '').replace(/[^0-9]/g, '');
      return cPhone.length >= 8 && cPhone.slice(-10) === rawPhone.slice(-10);
    });
  }

  const earned = calculateLoyaltyPoints(orderOrCheck);
  const ts = nowIso || new Date().toISOString();
  orderOrCheck.loyaltyPointsEarned = earned;
  orderOrCheck.loyaltyPointsAwardedAt = ts;

  // Auto-enrol storefront patron if not registered
  if (!customer && rawPhone.length >= 8) {
    const custName = orderOrCheck.customerName || orderOrCheck.deliveryDetails?.customerName || 'Online Patron';
    const custEmail = orderOrCheck.customerEmail || orderOrCheck.deliveryDetails?.customerEmail || undefined;
    const newId = `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    customer = {
      id: newId,
      name: custName,
      phone: String(orderOrCheck.customerPhone || orderOrCheck.deliveryDetails?.customerPhone || rawPhone).trim(),
      email: custEmail,
      tier: 'bronze',
      loyaltyPoints: 0,
      lifetimeSpend: 0,
      walletBalance: 0,
      stampCount: 0,
      totalVisits: 0,
      preferredBranchId: orderOrCheck.branchId || 'gra',
      createdAt: ts,
      updatedAt: ts,
      autoEnrolledFromStorefront: true,
    };
    dbInstance.customers = dbInstance.customers || {};
    dbInstance.customers[newId] = customer;
  }

  if (customer) {
    orderOrCheck.loyaltyCustomerId = customer.id;
    customer.loyaltyPoints = Math.max(0, Number(customer.loyaltyPoints || 0) + earned);
    customer.lifetimeSpend = Number(customer.lifetimeSpend || 0) + Number(orderOrCheck.total || 0);
    customer.totalVisits = Number(customer.totalVisits || 0) + 1;
    customer.updatedAt = ts;
  }
  return earned;
}

export function reverseOrderLoyaltyPointsIfAwarded(dbInstance: any, orderOrCheck: any, nowIso?: string): number {
  if (!dbInstance || !orderOrCheck) return 0;
  if (!orderOrCheck.loyaltyPointsAwardedAt || orderOrCheck.loyaltyPointsReversedAt) {
    return 0;
  }

  const earned = Math.max(0, Number(orderOrCheck.loyaltyPointsEarned || 0));
  const ts = nowIso || new Date().toISOString();
  orderOrCheck.loyaltyPointsReversedAt = ts;

  const custId = orderOrCheck.loyaltyCustomerId || orderOrCheck.customerId || orderOrCheck.paymentDetails?.customerId;
  const customer = custId ? dbInstance.customers?.[custId] : null;
  if (customer && earned > 0) {
    customer.loyaltyPoints = Math.max(0, Number(customer.loyaltyPoints || 0) - earned);
  }
  return earned;
}

export function seedCmsAndMenuCatalogueForDb(db: DbDatabase): void {
  db.categories = db.categories || {};
  db.menuProducts = db.menuProducts || {};
  db.inventory = db.inventory || {};
  db.recipes = db.recipes || {};

  // Ensure canonical inventory items exist in db
  for (const inv of INITIAL_CANONICAL_INVENTORY) {
    if (!db.inventory[inv.id]) {
      db.inventory[inv.id] = JSON.parse(JSON.stringify(inv));
    }
  }

  // Ensure canonical recipes exist in db
  for (const rec of INITIAL_RECIPES_BOM) {
    if (!db.recipes[rec.id]) {
      db.recipes[rec.id] = JSON.parse(JSON.stringify(rec));
    }
  }

  if (Object.keys(db.categories).length === 0) {
    MENU_CATEGORIES.forEach((cat, idx) => {
      db.categories[cat.id] = {
        id: cat.id,
        name: cat.name,
        tag: cat.tag,
        description: cat.description,
        icon: cat.icon,
        badge: cat.badge,
        sortOrder: idx + 1,
        channels: ['website', 'pos'],
        isActive: true,
        updatedAt: new Date().toISOString(),
      };
    });
    console.log(`[DB] Initialized ${Object.keys(db.categories).length} menu categories.`);
  }

  if (Object.keys(db.menuProducts).length === 0) {
    MASTER_PRODUCTS.forEach((p) => {
      db.menuProducts[p.id] = {
        id: p.id,
        name: p.name,
        shortDescription: p.shortDescription || '',
        longDescription: p.longDescription || '',
        category: p.category,
        subcategory: p.subcategory,
        image: p.image,
        basePrice: p.basePrice,
        branchPrices: p.branchPrices || {},
        branchAvailability: p.branchAvailability || { gra: true, okabere: true, ugbowo: true },
        prepTimeMinutes: p.prepTimeMinutes || 20,
        isPopular: Boolean(p.isPopular),
        isFeatured: Boolean(p.isFeatured),
        isNewProduct: Boolean(p.isNewProduct),
        isSpicy: Boolean(p.isSpicy),
        isVegetarian: Boolean(p.isVegetarian),
        packagingCharge: p.packagingCharge || 0,
        channels: p.channels || ['website', 'pos'],
        status: p.status || 'published',
        productType: p.productType || (Array.isArray(p.components) && p.components.length > 0 ? 'package' : 'standard'),
        compositionVersion: p.compositionVersion || (Array.isArray(p.components) && p.components.length > 0 ? 1 : undefined),
        components: p.components ? JSON.parse(JSON.stringify(p.components)) : undefined,
        discountConfig: p.discountConfig ? JSON.parse(JSON.stringify(p.discountConfig)) : undefined,
        wholesalePricing: p.wholesalePricing ? JSON.parse(JSON.stringify(p.wholesalePricing)) : undefined,
        isWholesale: p.isWholesale,
        minOrderQty: p.minOrderQty,
        wholesaleUnitPrice: p.wholesaleUnitPrice,
        promotionRules: p.promotionRules ? JSON.parse(JSON.stringify(p.promotionRules)) : undefined,
        optionGroups: p.optionGroups || [],
        availableAddOns: p.availableAddOns || [],
        suggestedUpsells: p.suggestedUpsells || [],
        updatedAt: new Date().toISOString(),
      };
    });
    console.log(`[DB] Initialized ${Object.keys(db.menuProducts).length} menu products.`);
  } else {
    // Reconcile persisted products with canonical package compositions, bread wholesale pricing, and images
    MASTER_PRODUCTS.forEach((p) => {
      const existing = db.menuProducts[p.id];
      if (!existing) {
        db.menuProducts[p.id] = {
          id: p.id,
          name: p.name,
          shortDescription: p.shortDescription || '',
          longDescription: p.longDescription || '',
          category: p.category,
          subcategory: p.subcategory,
          image: p.image,
          basePrice: p.basePrice,
          branchPrices: p.branchPrices || {},
          branchAvailability: p.branchAvailability || { gra: true, okabere: true, ugbowo: true },
          prepTimeMinutes: p.prepTimeMinutes || 20,
          isPopular: Boolean(p.isPopular),
          isFeatured: Boolean(p.isFeatured),
          isNewProduct: Boolean(p.isNewProduct),
          isSpicy: Boolean(p.isSpicy),
          isVegetarian: Boolean(p.isVegetarian),
          packagingCharge: p.packagingCharge || 0,
          channels: p.channels || ['website', 'pos'],
          status: p.status || 'published',
          productType: p.productType || (Array.isArray(p.components) && p.components.length > 0 ? 'package' : 'standard'),
          compositionVersion: p.compositionVersion || (Array.isArray(p.components) && p.components.length > 0 ? 1 : undefined),
          components: p.components ? JSON.parse(JSON.stringify(p.components)) : undefined,
          wholesalePricing: p.wholesalePricing ? JSON.parse(JSON.stringify(p.wholesalePricing)) : undefined,
          isWholesale: p.isWholesale,
          minOrderQty: p.minOrderQty,
          wholesaleUnitPrice: p.wholesaleUnitPrice,
          optionGroups: p.optionGroups || [],
          availableAddOns: p.availableAddOns || [],
          suggestedUpsells: p.suggestedUpsells || [],
          updatedAt: new Date().toISOString(),
        };
        return;
      }
      if (
        String(existing.image || '').includes('photo-1541592106381-b31e9677c0e5') ||
        p.category === 'packaging'
      ) {
        existing.image = p.image;
      }

      // Canonical package composition & ACHIVED (2).pdf reconciliation
      const canonical = CANONICAL_PACKAGE_COMPOSITIONS[p.id];
      if (canonical) {
        existing.productType = canonical.productType;
        existing.compositionVersion = canonical.compositionVersion;
        existing.components = JSON.parse(JSON.stringify(canonical.components));
        if (canonical.packaging) {
          existing.packaging = JSON.parse(JSON.stringify(canonical.packaging));
        }
        if (canonical.basePrice !== undefined) {
          existing.basePrice = canonical.basePrice;
        }
        if (canonical.name) {
          existing.name = canonical.name;
        }
        if (canonical.priceUnresolvedInArchivedPdf) {
          (existing as any).priceUnresolvedInArchivedPdf = true;
          (existing as any).activationBlockedReason = canonical.activationBlockedReason;
        }
        if (canonical.packagingUnspecifiedInArchivedPdf) {
          (existing as any).packagingUnspecifiedInArchivedPdf = true;
        }
        if (canonical.status === 'paused' && (existing as any).archivedPdfReconciledVersion !== 6) {
          existing.status = 'paused';
          existing.isPopular = false;
          existing.isFeatured = false;
          (existing as any).archivedPdfReconciledVersion = 6;
        } else if (canonical.status === 'published' && (existing as any).archivedPdfReconciledVersion !== 6) {
          existing.status = 'published';
          (existing as any).archivedPdfReconciledVersion = 6;
        }
      } else if (Array.isArray(p.components) && p.components.length > 0) {
        if (!Array.isArray(existing.components) || existing.components.length === 0 || (p.compositionVersion && (existing.compositionVersion || 0) < p.compositionVersion)) {
          existing.productType = p.productType || 'package';
          existing.compositionVersion = p.compositionVersion || 1;
          existing.components = JSON.parse(JSON.stringify(p.components));
        }
        if (p.packaging) {
          existing.packaging = JSON.parse(JSON.stringify(p.packaging));
        }
      }

      // Ensure packaging SKUs have accurate basePrice and name
      if (p.category === 'packaging') {
        existing.basePrice = p.basePrice;
        existing.name = p.name;
      }

      // Protect 2000 Mini Pack price and composition
      if (p.id === 'prod-sc-2000-mini') {
        existing.basePrice = 2000;
      }

      // Ensure Schweppes description matches canonical text
      if (p.id === 'prod-drink-schweppes') {
        existing.shortDescription = p.shortDescription;
      }

      if (p.wholesalePricing && !existing.wholesalePricing) {
        existing.wholesalePricing = JSON.parse(JSON.stringify(p.wholesalePricing));
      }
      if (p.isWholesale !== undefined && existing.isWholesale === undefined) {
        existing.isWholesale = p.isWholesale;
        existing.minOrderQty = p.minOrderQty;
        existing.wholesaleUnitPrice = p.wholesaleUnitPrice;
      }
    });
  }

  if (db.cmsContent && Array.isArray(db.cmsContent.articles)) {
    db.cmsContent.articles = db.cmsContent.articles.map((art: any) => ({
      ...art,
      content: Array.isArray(art.content)
        ? art.content.map((para: string) => para.replace(/Ch[a]pman/gi, 'Zobo'))
        : art.content,
    }));
  }

  if (!db.cmsContent) {
    db.cmsContent = {
      hero: {
        badge: 'AUTHENTIC BENIN CITY CUISINE',
        headline: 'ENJOY YOURSELF, IS THAT TOO MUCH TO ASK?',
        subheadline: 'Crispy golden spring rolls, loaded monster shawarma, party firewood jollof, and charcoal suya platters — freshly prepared across our Benin City hubs.',
        ctaPrimaryText: 'Explore Our Menu',
        ctaSecondaryText: 'Find Closest Branch',
        announcementTicker: "🔥 Benin City's No. 1 Chops & Grills — Fast 30-min Delivery to GRA, Airport Rd, Ugbowo & Ring Road!",
        isTickerActive: true,
      },
      contactInfo: {
        primaryPhone: '+234 815 817 7897',
        whatsappNumber: '+234 815 817 7897',
        email: 'orders@choplife.ng',
        headOfficeAddress: '8a Okogo Street, Opposite Wesley Hotel, Off Akhionbare, G.R.A., Benin City, Edo State',
        openingHours: 'Mon–Sat: 8:00 AM – 7:00 PM | Sun: 8:00 AM – 7:00 PM',
      },
      banners: [
        {
          id: 'banner-party-packs',
          title: 'Weekend Party Platters & Mini Munch Boxes',
          subtitle: 'Pre-order for weddings, birthdays and celebrations. 100% freshly fried.',
          ctaText: 'Build Custom Box',
          ctaLink: '#small-chops',
          badge: 'Signature',
          imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
          active: true,
          order: 1,
        },
        {
          id: 'banner-bromate-free',
          title: '100% Clean Bromate-Free Bread',
          subtitle: 'Baked fresh every morning with whole eggs and full-cream milk.',
          ctaText: 'Order Bakery',
          ctaLink: '#bakery',
          badge: 'Fresh Daily',
          imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
          active: true,
          order: 2,
        },
      ],
      articles: ARTICLES_LIST.map((art) => ({
        id: art.id,
        slug: art.slug,
        title: art.title,
        subtitle: art.subtitle,
        summary: art.summary,
        content: art.content,
        category: art.category,
        author: art.author,
        readTime: art.readTime,
        publishedDate: art.publishedDate,
        image: art.image,
        tags: art.tags,
        published: true,
        updatedAt: new Date().toISOString(),
      })),
      status: 'published',
      updatedAt: new Date().toISOString(),
      updatedBy: 'System Super Admin',
    };
    console.log('[DB] Initialized canonical CMS content and editorial stories.');
  }
}
