import express from 'express';
import crypto from 'crypto';
import type { OnlineOrdersAndCustomerRouterDeps } from './onlineOrdersAndCustomerRouter.ts';
import { customerRepository } from '../repositories/customerRepository.ts';
import { reviewRepository } from '../repositories/reviewRepository.ts';
import { CANONICAL_PACKAGE_COMPOSITIONS } from '../services/packageAndPricingEngine.ts';

export const REMEMBERED_DEVICE_COOKIE = 'choplife_remembered_device';

export const APPROVED_PRODUCT_REVIEW_TAGS = [
  'Great taste',
  'Fresh',
  'Well prepared',
  'Good portion size',
  'Well presented',
  'Good value',
  'Good packaging',
  'As described',
  'Not as expected',
  'Quality concern',
] as const;

export const APPROVED_DELIVERY_REVIEW_TAGS = [
  'Arrived on time',
  'Fast delivery',
  'Order arrived safely',
  'Rider was polite',
  'Good delivery updates',
  'Packaging was secure',
  'Delivery was delayed',
  'Item was missing',
  'Packaging was damaged',
  'Order arrived in poor condition',
] as const;

export const APPROVED_SERVICE_REVIEW_TAGS = [
  'Helpful staff',
  'Friendly service',
  'Professional communication',
  'Quick response',
  'Issue resolved',
  'Easy ordering process',
  'Clear communication',
  'Service improvement needed',
] as const;

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

export function createStorefrontReviewsAndDeviceRouter(
  deps: OnlineOrdersAndCustomerRouterDeps
): express.Router {
  const router = express.Router();
  const { getDb, saveDatabaseSync, logAuditEvent } = deps;

  // =========================================================================
  // 1. GENUINE BESTSELLERS ENDPOINT (Part I3 — Max 3 items, paid & fulfilled only)
  // =========================================================================
  router.get('/api/menu/bestsellers', (req, res) => {
    const db = getDb();
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId.trim() : undefined;
    const requestedLimit = Number(req.query.limit || 3);
    const limit = Math.min(Math.max(1, requestedLimit), 3); // Strictly capped at max 3

    const productsMap: Record<string, any> = db.menuProducts || {};
    const salesByProductId = new Map<
      string,
      { productId: string; quantitySold: number; revenueGenerated: number; orderCount: number }
    >();

    // Aggregate ONLY paid and fulfilled/completed online orders (excluding historical eZee records, cancelled, voided, refunded, unpaid)
    for (const order of Object.values(db.orders || {}) as any[]) {
      if (order.historicalRecord || order.sourceSystem === 'ezee_optimus') continue;
      if (order.paymentStatus !== 'paid') continue;
      if (order.status !== 'completed' && order.status !== 'delivered') continue;
      if (branchId && order.branchId !== branchId) continue;

      for (const item of order.items || []) {
        const pid = item.productId || item.id;
        if (!pid) continue;
        const prod = productsMap[pid];
        if (!prod || prod.status === 'paused' || prod.status === 'archived' || prod.available === false) continue;

        const qty = Number(item.quantity || 0);
        if (qty <= 0) continue;
        const rev = qty * Number(item.price || item.unitPrice || prod.price || 0);
        const existing = salesByProductId.get(pid) || {
          productId: pid,
          quantitySold: 0,
          revenueGenerated: 0,
          orderCount: 0,
        };
        existing.quantitySold += qty;
        existing.revenueGenerated += rev;
        existing.orderCount += 1;
        salesByProductId.set(pid, existing);
      }
    }

    // Also aggregate paid and closed/completed POS checks
    for (const check of Object.values(db.checks || {}) as any[]) {
      if (check.historicalRecord || check.sourceSystem === 'ezee_optimus') continue;
      if (check.paymentStatus !== 'paid') continue;
      if (check.status === 'cancelled' || check.status === 'voided') continue;
      if (branchId && check.branchId !== branchId) continue;
      // Avoid double counting POS checks created automatically for online orders
      if (String(check.id).startsWith('chk-ord-') || check.onlineOrderId) continue;

      for (const item of check.items || []) {
        if (item.status === 'voided' || item.status === 'cancelled') continue;
        const pid = item.productId || item.id;
        if (!pid) continue;
        const prod = productsMap[pid];
        if (!prod || prod.status === 'paused' || prod.status === 'archived' || prod.available === false) continue;

        const qty = Number(item.quantity || 0);
        if (qty <= 0) continue;
        const rev = qty * Number(item.unitPrice || item.price || prod.price || 0);
        const existing = salesByProductId.get(pid) || {
          productId: pid,
          quantitySold: 0,
          revenueGenerated: 0,
          orderCount: 0,
        };
        existing.quantitySold += qty;
        existing.revenueGenerated += rev;
        existing.orderCount += 1;
        salesByProductId.set(pid, existing);
      }
    }

    const ranked = Array.from(salesByProductId.values())
      .sort((a, b) => b.quantitySold - a.quantitySold || b.revenueGenerated - a.revenueGenerated)
      .slice(0, limit)
      .map((entry) => ({
        ...entry,
        product: productsMap[entry.productId],
      }));

    return res.json({
      bestsellers: ranked,
      hasGenuineSalesData: ranked.length > 0,
      maxAllowed: 3,
      mode: ranked.length > 0 ? 'verified_sales' : 'virgin_no_sales',
    });
  });

  // =========================================================================
  // 2. PACKAGE ACCOUNTING 5-VIEW SEPARATION ENDPOINT (Part E5)
  // =========================================================================
  router.get('/api/reports/package-accounting', (req, res) => {
    const db = getDb();
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId.trim() : undefined;
    const productsMap: Record<string, any> = db.menuProducts || {};
    const compMap: Record<string, any> = Array.isArray(CANONICAL_PACKAGE_COMPOSITIONS)
      ? Object.fromEntries(CANONICAL_PACKAGE_COMPOSITIONS.map((c: any) => [c.packageProductId, c]))
      : (CANONICAL_PACKAGE_COMPOSITIONS as any) || {};

    // View 1: Packages, Combos, and Platters Sold
    const packageSalesMap = new Map<
      string,
      { productId: string; name: string; productType: string; unitsSold: number; grossRevenue: number }
    >();
    // View 2: Standalone Menu Items Sold Separately
    const standaloneSalesMap = new Map<
      string,
      { productId: string; name: string; category: string; unitsSold: number; grossRevenue: number }
    >();
    // View 3: Components Included in Packages
    const packageComponentUsageMap = new Map<
      string,
      { componentKey: string; componentName: string; quantityIncludedInPackages: number; unit: string; parentPackages: string[] }
    >();
    // View 5: Packaging Consumption
    const packagingConsumptionMap = new Map<
      string,
      { packagingSkuId: string; packagingName: string; unitsConsumed: number; sourceBreakdown: { fromPackages: number; fromStandaloneFood: number } }
    >();

    const recordSaleItem = (rawItem: any) => {
      const pid = rawItem.productId || rawItem.id;
      const prod = productsMap[pid];
      const qty = Number(rawItem.quantity || 0);
      if (qty <= 0) return;
      const unitPrice = Number(rawItem.price || rawItem.unitPrice || prod?.price || 0);
      const revenue = qty * unitPrice;

      const isPackage = Boolean(
        prod?.isPackage ||
          prod?.isCombo ||
          prod?.productType === 'package' ||
          prod?.productType === 'combo' ||
          prod?.productType === 'platter' ||
          compMap[pid] ||
          (Array.isArray(prod?.components) && prod.components.length > 0)
      );

      if (isPackage) {
        const cur = packageSalesMap.get(pid) || {
          productId: pid,
          name: prod?.name || rawItem.name || pid,
          productType: prod?.productType || 'package',
          unitsSold: 0,
          grossRevenue: 0,
        };
        cur.unitsSold += qty;
        cur.grossRevenue += revenue;
        packageSalesMap.set(pid, cur);

        const canonicalComp = compMap[pid];
        const compLines = canonicalComp?.components || prod?.components || prod?.packageComponents || [];
        for (const line of compLines) {
          const compKey = line.productId || line.componentProductId || line.name;
          const compName = line.name || productsMap[compKey]?.name || compKey;
          const compQty = qty * Number(line.quantity || line.qty || 1);
          const existingComp = packageComponentUsageMap.get(compKey) || {
            componentKey: compKey,
            componentName: compName,
            quantityIncludedInPackages: 0,
            unit: line.unit || 'pcs',
            parentPackages: [],
          };
          existingComp.quantityIncludedInPackages += compQty;
          if (!existingComp.parentPackages.includes(pid)) {
            existingComp.parentPackages.push(pid);
          }
          packageComponentUsageMap.set(compKey, existingComp);
        }

        const pkgSku =
          canonicalComp?.packagingInventoryItemId ||
          prod?.packagingInventoryItemId ||
          prod?.packaging?.inventoryItemId;
        if (pkgSku) {
          const invItem = db.inventory?.[pkgSku];
          const existingPkg = packagingConsumptionMap.get(pkgSku) || {
            packagingSkuId: pkgSku,
            packagingName: invItem?.name || pkgSku,
            unitsConsumed: 0,
            sourceBreakdown: { fromPackages: 0, fromStandaloneFood: 0 },
          };
          existingPkg.unitsConsumed += qty;
          existingPkg.sourceBreakdown.fromPackages += qty;
          packagingConsumptionMap.set(pkgSku, existingPkg);
        }
      } else {
        const cur = standaloneSalesMap.get(pid) || {
          productId: pid,
          name: prod?.name || rawItem.name || pid,
          category: prod?.category || 'food',
          unitsSold: 0,
          grossRevenue: 0,
        };
        cur.unitsSold += qty;
        cur.grossRevenue += revenue;
        standaloneSalesMap.set(pid, cur);
      }
    };

    for (const order of Object.values(db.orders || {}) as any[]) {
      if (order.paymentStatus !== 'paid') continue;
      if (order.status === 'cancelled' || order.status === 'voided') continue;
      if (branchId && order.branchId !== branchId) continue;

      for (const item of order.items || []) {
        recordSaleItem(item);
      }

      const orderPackQty = Number((order as any).packagingQuantity || 0);
      const orderPackSku = (order as any).packagingSkuId || 'inv-pack-400';
      if (orderPackQty > 0) {
        const invItem = db.inventory?.[orderPackSku];
        const existingPkg = packagingConsumptionMap.get(orderPackSku) || {
          packagingSkuId: orderPackSku,
          packagingName: invItem?.name || 'Pack 400',
          unitsConsumed: 0,
          sourceBreakdown: { fromPackages: 0, fromStandaloneFood: 0 },
        };
        existingPkg.unitsConsumed += orderPackQty;
        existingPkg.sourceBreakdown.fromStandaloneFood += orderPackQty;
        packagingConsumptionMap.set(orderPackSku, existingPkg);
      }
    }

    // View 4: Total Physical Component Demand (Standalone + Included in Packages)
    const totalPhysicalDemandMap = new Map<
      string,
      {
        itemKey: string;
        itemName: string;
        standaloneUnits: number;
        includedInPackageUnits: number;
        totalPhysicalUnits: number;
      }
    >();

    for (const st of standaloneSalesMap.values()) {
      totalPhysicalDemandMap.set(st.productId, {
        itemKey: st.productId,
        itemName: st.name,
        standaloneUnits: st.unitsSold,
        includedInPackageUnits: 0,
        totalPhysicalUnits: st.unitsSold,
      });
    }

    for (const pc of packageComponentUsageMap.values()) {
      const existing = totalPhysicalDemandMap.get(pc.componentKey) || {
        itemKey: pc.componentKey,
        itemName: pc.componentName,
        standaloneUnits: 0,
        includedInPackageUnits: 0,
        totalPhysicalUnits: 0,
      };
      existing.includedInPackageUnits += pc.quantityIncludedInPackages;
      existing.totalPhysicalUnits = existing.standaloneUnits + existing.includedInPackageUnits;
      totalPhysicalDemandMap.set(pc.componentKey, existing);
    }

    return res.json({
      branchId: branchId || 'all',
      generatedAt: new Date().toISOString(),
      views: {
        packageSales: Array.from(packageSalesMap.values()),
        standaloneSales: Array.from(standaloneSalesMap.values()),
        packageComponentUsage: Array.from(packageComponentUsageMap.values()),
        totalPhysicalComponentDemand: Array.from(totalPhysicalDemandMap.values()),
        packagingConsumption: Array.from(packagingConsumptionMap.values()),
      },
    });
  });

  // =========================================================================
  // 3. REMEMBERED DEVICE PREFERENCES (Part M1 — Consent-Based Opaque Cookie)
  // =========================================================================
  router.get('/api/customers/device-preference', async (req, res) => {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const rawToken = cookies[REMEMBERED_DEVICE_COOKIE];
      if (!rawToken) {
        return res.json({ remembered: false, preferences: null });
      }
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const device = await customerRepository.getDeviceByHash(tokenHash);
      if (!device || device.isRevoked || !device.consentGiven) {
        return res.json({ remembered: false, preferences: null });
      }
      return res.json({
        remembered: true,
        preferences: {
          preferredBranchId: device.preferredBranchId || 'gra',
          preferredFulfilment: device.preferredFulfilment || 'delivery',
          preferredCategory: device.preferredCategory || null,
          lastSeenAt: device.lastSeenAt,
        },
      });
    } catch {
      return res.json({ remembered: false, preferences: null });
    }
  });

  router.post('/api/customers/device-preference', async (req, res) => {
    try {
      const {
        consentGiven = true,
        preferredBranchId = 'gra',
        preferredFulfilment = 'delivery',
        preferredCategory = null,
      } = req.body || {};

      const cookies = parseCookies(req.headers.cookie);
      let rawToken = cookies[REMEMBERED_DEVICE_COOKIE];

      if (!consentGiven) {
        if (rawToken) {
          const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
          await customerRepository.revokeDevice(tokenHash);
        }
        res.clearCookie(REMEMBERED_DEVICE_COOKIE, { path: '/' });
        return res.json({ success: true, remembered: false });
      }

      if (!rawToken) {
        rawToken = crypto.randomBytes(32).toString('hex');
      }
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await customerRepository.upsertDevicePreference({
        id: `dev-${tokenHash.slice(0, 16)}`,
        deviceTokenHash: tokenHash,
        preferredBranchId: String(preferredBranchId || 'gra'),
        preferredFulfilment: preferredFulfilment === 'pickup' ? 'pickup' : 'delivery',
        preferredCategory: preferredCategory ? String(preferredCategory) : null,
        consentGiven: true,
        isRevoked: false,
        lastSeenAt: new Date(),
        userAgent: String(req.headers['user-agent'] || '').slice(0, 255),
      });

      res.cookie(REMEMBERED_DEVICE_COOKIE, rawToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      });

      return res.json({
        success: true,
        remembered: true,
        preferences: {
          preferredBranchId,
          preferredFulfilment: preferredFulfilment === 'pickup' ? 'pickup' : 'delivery',
          preferredCategory,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to save device preference.' });
    }
  });

  router.delete('/api/customers/device-preference', async (req, res) => {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const rawToken = cookies[REMEMBERED_DEVICE_COOKIE];
      if (rawToken) {
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        await customerRepository.revokeDevice(tokenHash);
      }
      res.clearCookie(REMEMBERED_DEVICE_COOKIE, { path: '/' });
      return res.json({ success: true, remembered: false });
    } catch {
      return res.status(500).json({ error: 'Failed to clear device preference.' });
    }
  });

  // =========================================================================
  // 4. POST-ORDER RATINGS & VERIFIED REVIEWS (Part N)
  // =========================================================================
  router.get('/api/reviews/tags', (_req, res) => {
    res.json({
      productTags: APPROVED_PRODUCT_REVIEW_TAGS,
      deliveryTags: APPROVED_DELIVERY_REVIEW_TAGS,
      serviceTags: APPROVED_SERVICE_REVIEW_TAGS,
    });
  });

  router.get('/api/reviews', async (req, res) => {
    try {
      const branchId = typeof req.query.branchId === 'string' ? req.query.branchId.trim() : undefined;
      const rows = await reviewRepository.getAllApproved(branchId);
      const formatted = rows.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        productId: r.productId,
        customerName: r.isPublicDisplayName ? r.customerName : 'Verified Customer',
        branchId: r.branchId,
        orderType: r.orderType,
        productRating: r.productRating,
        productTags: r.productTags || [],
        deliveryRating: r.deliveryRating,
        deliveryTags: r.deliveryTags || [],
        serviceRating: r.serviceRating,
        serviceTags: r.serviceTags || [],
        rating: r.overallRating,
        comment: r.comment || '',
        verified: true,
        date: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      }));
      return res.json({ reviews: formatted });
    } catch {
      return res.json({ reviews: [] });
    }
  });

  router.get('/api/reviews/eligibility/:orderId', async (req, res) => {
    const db = getDb();
    const { orderId } = req.params;
    const order =
      db.orders[orderId] ||
      Object.values(db.orders).find((o: any) => o.orderNumber === orderId || o.id === orderId);

    if (!order) {
      return res.status(404).json({ eligible: false, reason: 'Order not found.' });
    }

    const isPaid = order.paymentStatus === 'paid';
    const isFulfilled = order.status === 'completed' || order.status === 'delivered';
    const existing = await reviewRepository.getByOrderId(order.id);

    return res.json({
      eligible: isPaid && isFulfilled && existing.length === 0,
      isPaid,
      isFulfilled,
      alreadyReviewed: existing.length > 0,
      orderType: order.orderType || 'delivery',
      branchId: order.branchId,
    });
  });

  router.post('/api/reviews', async (req, res) => {
    try {
      const db = getDb();
      const {
        orderId,
        productId = null,
        customerName,
        customerPhone,
        productRating,
        productTags = [],
        deliveryRating,
        deliveryTags = [],
        serviceRating,
        serviceTags = [],
        comment = '',
        isPublicDisplayName = true,
      } = req.body || {};

      if (!orderId) {
        return res.status(400).json({
          error: 'A completed order reference (orderId) is required to submit a verified review.',
        });
      }

      const order =
        db.orders[orderId] ||
        Object.values(db.orders).find((o: any) => o.orderNumber === orderId || o.id === orderId);

      if (!order) {
        return res.status(404).json({
          error: 'Order not found. Only verified completed Choplife orders can be reviewed.',
        });
      }

      // Server-side verified purchase check (never trust client 'verified: true')
      if (order.paymentStatus !== 'paid' || (order.status !== 'completed' && order.status !== 'delivered')) {
        return res.status(403).json({
          error: 'Only paid and fulfilled (completed or delivered) orders are eligible for verified reviews.',
        });
      }

      // Check duplicate review submission
      const duplicate = await reviewRepository.getByOrderAndProduct(order.id, productId ? String(productId) : null);
      if (duplicate) {
        return res.status(409).json({
          error: 'A review has already been submitted for this order.',
        });
      }

      const validRatings: number[] = [];
      const parseStar = (val: any): number | null => {
        if (val === undefined || val === null || val === '') return null;
        const n = Number(val);
        if (!Number.isInteger(n) || n < 1 || n > 5) return -1;
        return n;
      };

      const pStar = parseStar(productRating);
      const dStar = parseStar(deliveryRating);
      const sStar = parseStar(serviceRating);

      if (pStar === -1 || dStar === -1 || sStar === -1) {
        return res.status(400).json({ error: 'Star ratings must be integers between 1 and 5.' });
      }

      if (pStar) validRatings.push(pStar);
      if (dStar) validRatings.push(dStar);
      if (sStar) validRatings.push(sStar);

      if (validRatings.length === 0) {
        return res.status(400).json({
          error: 'Please provide at least one rating (Product, Delivery, or Customer Service) between 1 and 5 stars.',
        });
      }

      const overallRating = Math.round(validRatings.reduce((a, b) => a + b, 0) / validRatings.length);

      const cleanProductTags = Array.isArray(productTags)
        ? productTags.filter((t) => (APPROVED_PRODUCT_REVIEW_TAGS as readonly string[]).includes(String(t)))
        : [];
      const cleanDeliveryTags = Array.isArray(deliveryTags)
        ? deliveryTags.filter((t) => (APPROVED_DELIVERY_REVIEW_TAGS as readonly string[]).includes(String(t)))
        : [];
      const cleanServiceTags = Array.isArray(serviceTags)
        ? serviceTags.filter((t) => (APPROVED_SERVICE_REVIEW_TAGS as readonly string[]).includes(String(t)))
        : [];

      const reviewId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const resolvedName =
        String(customerName || order.deliveryDetails?.customerName || (order as any).customerName || 'Verified Guest').trim();

      const created = await reviewRepository.create({
        id: reviewId,
        orderId: order.id,
        productId: productId ? String(productId) : null,
        customerId: order.customerId || null,
        customerName: resolvedName,
        customerPhone: String(customerPhone || order.deliveryDetails?.customerPhone || '').trim() || null,
        branchId: order.branchId || 'gra',
        orderType: order.orderType || 'delivery',
        productRating: pStar,
        productTags: cleanProductTags,
        deliveryRating: order.orderType === 'delivery' ? dStar : null,
        deliveryTags: order.orderType === 'delivery' ? cleanDeliveryTags : [],
        serviceRating: sStar,
        serviceTags: cleanServiceTags,
        overallRating,
        comment: String(comment || '').trim().slice(0, 1000) || null,
        verifiedPurchase: true,
        isPublicDisplayName: Boolean(isPublicDisplayName),
        moderationStatus: 'approved',
      });

      (order as any).reviewedAt = new Date().toISOString();
      saveDatabaseSync();

      logAuditEvent(
        resolvedName,
        'customer',
        order.branchId,
        'CUSTOMER_REVIEW_SUBMITTED',
        `Verified post-order review submitted for Order #${order.orderNumber} (Overall: ${overallRating}/5)`
      );

      return res.status(201).json({
        success: true,
        review: {
          id: created.id,
          orderId: created.orderId,
          customerName: created.isPublicDisplayName ? created.customerName : 'Verified Customer',
          branchId: created.branchId,
          productRating: created.productRating,
          productTags: created.productTags,
          deliveryRating: created.deliveryRating,
          deliveryTags: created.deliveryTags,
          serviceRating: created.serviceRating,
          serviceTags: created.serviceTags,
          rating: created.overallRating,
          comment: created.comment,
          verified: true,
          date: created.createdAt instanceof Date ? created.createdAt.toISOString() : new Date().toISOString(),
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to submit review.' });
    }
  });

  return router;
}
