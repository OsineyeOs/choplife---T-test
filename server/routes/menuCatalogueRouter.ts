import express from 'express';
import type {
  DbStaffAccount,
  DbMenuCategory,
  DbProductItem,
} from '../../server_db.ts';
import type { CmsAndMenuRouterDeps } from './cmsAndMenuRouter.ts';
import {
  validateProductCommercialConfig,
  calculateAuthoritativeItemAndOrderPricing,
  ARCHIVED_PDF_PRODUCT_IDS,
} from '../services/packageAndPricingEngine.ts';

export function createMenuCatalogueRouter(deps: CmsAndMenuRouterDeps): express.Router {
  const router = express.Router();
  const {
    getDb,
    saveDatabaseSync,
    seedCmsAndMenuCatalogue,
    requireAuth,
    hasPermission,
    logAuditEvent,
  } = deps;

  // ==========================================
  // 3.56 MENU & CATEGORY ADMINISTRATION REST API
  // ==========================================
  router.get('/api/categories', (req, res) => {
    const db = getDb();
    db.categories = db.categories || {};
    if (Object.keys(db.categories).length === 0) {
      seedCmsAndMenuCatalogue();
    }
    const channel = req.query.channel as string | undefined;
    let categories = Object.values(db.categories).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    if (channel === 'website' || channel === 'pos') {
      categories = categories.filter((c) => !c.channels || c.channels.includes(channel as any));
    }
    res.json(categories);
  });

  router.post('/api/categories', requireAuth, async (req, res) => {
    const db = getDb();
    const currentStaff = (req as any).staff as DbStaffAccount;
    const isAuthorized =
      currentStaff.role === 'super_admin' ||
      currentStaff.role === 'admin' ||
      currentStaff.role === 'corporate_admin' ||
      currentStaff.role === 'branch_manager' ||
      currentStaff.role === 'menu_manager' ||
      await hasPermission(currentStaff, 'menu.category.manage') ||
      await hasPermission(currentStaff, 'menu.edit');

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges to manage menu categories.' });
    }

    const { name, tag, description, icon, badge, sortOrder, channels, isActive } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    db.categories = db.categories || {};
    const id = (req.body.id || name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')).trim();
    if (db.categories[id]) {
      return res.status(400).json({ error: `A category with id '${id}' already exists.` });
    }

    const newCategory: DbMenuCategory = {
      id,
      name: name.trim(),
      tag: tag?.trim() || '',
      description: description?.trim() || '',
      icon: icon?.trim() || '🍽️',
      badge: badge?.trim() || undefined,
      sortOrder: Number(sortOrder) || Object.keys(db.categories).length + 1,
      channels: Array.isArray(channels) && channels.length > 0 ? channels : ['website', 'pos'],
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      updatedAt: new Date().toISOString(),
    };

    db.categories[id] = newCategory;
    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'CATEGORY_CREATED',
      `Created category: ${newCategory.name} (${newCategory.id})`
    );
    res.status(201).json({ success: true, category: newCategory });
  });

  router.put('/api/categories/:id', requireAuth, async (req, res) => {
    const db = getDb();
    const currentStaff = (req as any).staff as DbStaffAccount;
    const isAuthorized =
      currentStaff.role === 'super_admin' ||
      currentStaff.role === 'admin' ||
      currentStaff.role === 'corporate_admin' ||
      currentStaff.role === 'branch_manager' ||
      currentStaff.role === 'menu_manager' ||
      await hasPermission(currentStaff, 'menu.category.manage') ||
      await hasPermission(currentStaff, 'menu.edit');

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges to edit menu categories.' });
    }

    const { id } = req.params;
    const cat = db.categories?.[id];
    if (!cat) return res.status(404).json({ error: 'Category not found.' });

    const { name, tag, description, icon, badge, sortOrder, channels, isActive } = req.body;
    if (name) cat.name = name.trim();
    if (tag !== undefined) cat.tag = tag.trim();
    if (description !== undefined) cat.description = description.trim();
    if (icon) cat.icon = icon.trim();
    if (badge !== undefined) cat.badge = badge?.trim() || undefined;
    if (sortOrder !== undefined) cat.sortOrder = Number(sortOrder);
    if (Array.isArray(channels)) cat.channels = channels;
    if (isActive !== undefined) cat.isActive = Boolean(isActive);
    cat.updatedAt = new Date().toISOString();

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'CATEGORY_UPDATED',
      `Updated category: ${cat.name} (${cat.id})`
    );
    res.json({ success: true, category: cat });
  });

  router.delete('/api/categories/:id', requireAuth, async (req, res) => {
    const db = getDb();
    const currentStaff = (req as any).staff as DbStaffAccount;
    const isAuthorized =
      currentStaff.role === 'super_admin' ||
      currentStaff.role === 'admin' ||
      currentStaff.role === 'corporate_admin' ||
      currentStaff.role === 'branch_manager' ||
      await hasPermission(currentStaff, 'menu.category.manage');

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges to delete menu categories.' });
    }

    const { id } = req.params;
    const cat = db.categories?.[id];
    if (!cat) return res.status(404).json({ error: 'Category not found.' });

    const assignedProducts = Object.values(db.menuProducts || {}).filter((p) => p.category === id);
    const activeProducts = assignedProducts.filter((p) => p.status !== 'archived');

    if (activeProducts.length > 0 && !req.query.archive) {
      return res.status(409).json({
        error: `Cannot delete category '${cat.name}' because ${activeProducts.length} active product(s) are still assigned to it. Reassign or archive those products first, or deactivate the category.`,
        activeProductCount: activeProducts.length,
      });
    }

    if (assignedProducts.length > 0) {
      cat.isActive = false;
      cat.updatedAt = new Date().toISOString();
      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'CATEGORY_ARCHIVED',
        `Archived category with product references: ${cat.name} (${cat.id})`
      );
      return res.json({
        success: true,
        archived: true,
        category: cat,
        message: `Category '${cat.name}' has been archived (deactivated) to preserve product referential integrity.`,
      });
    }

    delete db.categories[id];
    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'CATEGORY_DELETED',
      `Deleted category: ${cat.name} (${cat.id})`
    );
    res.json({ success: true, archived: false, message: `Category ${id} deleted.` });
  });

  // MENU PRODUCTS ENDPOINTS
  router.get('/api/menu/products', (req, res) => {
    const db = getDb();
    db.menuProducts = db.menuProducts || {};
    if (Object.keys(db.menuProducts).length === 0) {
      seedCmsAndMenuCatalogue();
    }
    const channel = req.query.channel as string | undefined;
    const category = req.query.category as string | undefined;
    const status = req.query.status as string | undefined;
    const includeInactive = req.query.includeInactive as string | undefined;
    let products = Object.values(db.menuProducts);

    if (status && status !== 'all') {
      products = products.filter((p) => p.status === status);
    } else if ((channel === 'website' || channel === 'pos') && includeInactive !== 'true') {
      products = products.filter((p) => (!p.status || p.status === 'published') && (p as any).isActive !== false);
    }

    if (channel === 'website' || channel === 'pos') {
      products = products.filter((p) => {
        if (!p.channels) return true;
        if (Array.isArray(p.channels)) return p.channels.includes(channel as any);
        return Boolean((p.channels as any)[channel]);
      });
    }
    if (category && category !== 'all') {
      products = products.filter((p) => p.category === category);
    }
    res.json(products);
  });

  router.get('/api/menu/products/:id', (req, res) => {
    const db = getDb();
    const p = db.menuProducts?.[req.params.id];
    if (!p) return res.status(404).json({ error: 'Product not found.' });
    res.json(p);
  });

  router.post('/api/menu/pricing-preview', (req, res) => {
    const db = getDb();
    const { items = [], branchId = 'gra', channel = 'pos', orderDiscountPercent, orderDiscountAmount } = req.body || {};
    const result = calculateAuthoritativeItemAndOrderPricing(db, items, {
      branchId,
      channel,
      orderDiscountPercent,
      orderDiscountAmount,
    });
    res.json(result);
  });

  router.post('/api/menu/products', requireAuth, async (req, res) => {
    const db = getDb();
    const currentStaff = (req as any).staff as DbStaffAccount;
    const isAuthorized =
      currentStaff.role === 'super_admin' ||
      currentStaff.role === 'admin' ||
      currentStaff.role === 'corporate_admin' ||
      currentStaff.role === 'branch_manager' ||
      currentStaff.role === 'menu_manager' ||
      await hasPermission(currentStaff, 'menu.create') ||
      await hasPermission(currentStaff, 'menu.edit');

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges to create menu products.' });
    }

    const {
      name,
      category,
      shortDescription,
      longDescription,
      image,
      prepTimeMinutes,
      branchPrices,
      branchAvailability,
      channels,
      status,
      isPopular,
      isFeatured,
      isSpicy,
      isVegetarian,
      packagingCharge,
    } = req.body;
    const rawPrice = req.body.basePrice !== undefined ? req.body.basePrice : req.body.price;
    if (!name || rawPrice === undefined || !category) {
      return res.status(400).json({ error: 'Product name, category, and price are required.' });
    }

    db.menuProducts = db.menuProducts || {};
    const id = (req.body.id || `prod-${name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`).trim();
    if (db.menuProducts[id]) {
      return res.status(400).json({ error: `A product with id '${id}' already exists.` });
    }

    const validation = validateProductCommercialConfig(db, id, req.body);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.errors.join(' '),
        errors: validation.errors,
      });
    }

    const effectiveProductType = req.body.productType || 'standard';
    const hasComponents = Array.isArray(validation.normalizedComponents) && validation.normalizedComponents.length > 0;

    const newProduct: DbProductItem = {
      id,
      name: name.trim(),
      category,
      subcategory: req.body.subcategory,
      basePrice: Number(rawPrice) || 0,
      shortDescription: shortDescription?.trim() || '',
      longDescription: longDescription?.trim() || '',
      image:
        image?.trim() || 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80',
      prepTimeMinutes: Number(prepTimeMinutes) || 20,
      branchPrices: branchPrices || {},
      branchAvailability: branchAvailability || { gra: true, okabere: true, ugbowo: true },
      channels: Array.isArray(channels) && channels.length > 0 ? channels : ['website', 'pos'],
      status: status || 'published',
      isPopular: Boolean(isPopular),
      isFeatured: Boolean(isFeatured),
      isSpicy: Boolean(isSpicy),
      isVegetarian: Boolean(isVegetarian),
      packagingCharge: Number(packagingCharge) || 0,
      productType: effectiveProductType,
      compositionVersion: hasComponents ? 1 : undefined,
      components: validation.normalizedComponents,
      discountConfig: validation.normalizedDiscountConfig,
      wholesalePricing: validation.normalizedWholesalePricing,
      isWholesale: Boolean(req.body.isWholesale || validation.normalizedWholesalePricing?.enabled),
      minOrderQty: req.body.minOrderQty !== undefined
        ? Number(req.body.minOrderQty)
        : validation.normalizedWholesalePricing?.minWholesaleQty,
      wholesaleUnitPrice: req.body.wholesaleUnitPrice !== undefined
        ? Number(req.body.wholesaleUnitPrice)
        : validation.normalizedWholesalePricing?.wholesalePrice,
      promotionRules: validation.normalizedPromotionRules,
      optionGroups: req.body.optionGroups || [],
      availableAddOns: req.body.availableAddOns || [],
      suggestedUpsells: req.body.suggestedUpsells || [],
      updatedAt: new Date().toISOString(),
    };

    db.menuProducts[id] = newProduct;
    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'PRODUCT_CREATED',
      `Created product: ${newProduct.name} (${newProduct.id}, type=${newProduct.productType}, ₦${newProduct.basePrice})`
    );
    res.status(201).json({ success: true, product: newProduct });
  });

  router.put('/api/menu/products/:id', requireAuth, async (req, res) => {
    const db = getDb();
    const currentStaff = (req as any).staff as DbStaffAccount;
    const isAuthorized =
      currentStaff.role === 'super_admin' ||
      currentStaff.role === 'admin' ||
      currentStaff.role === 'corporate_admin' ||
      currentStaff.role === 'branch_manager' ||
      currentStaff.role === 'menu_manager' ||
      await hasPermission(currentStaff, 'menu.edit') ||
      await hasPermission(currentStaff, 'menu.availability.toggle');

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges to edit menu products.' });
    }

    const { id } = req.params;
    const p = db.menuProducts?.[id];
    if (!p) return res.status(404).json({ error: 'Product not found.' });

    const isArchivedPdfPackage = (ARCHIVED_PDF_PRODUCT_IDS as readonly string[]).includes(id);
    const isReactivatingPausedPackage =
      p.status === 'paused' &&
      req.body.status === 'published' &&
      (isArchivedPdfPackage || p.productType === 'package' || p.productType === 'combo' || p.productType === 'platter');

    if (isReactivatingPausedPackage || (isArchivedPdfPackage && req.body.status !== undefined)) {
      const canReactivatePackage =
        currentStaff.role === 'super_admin' ||
        await hasPermission(currentStaff, 'menu.package.reactivate') ||
        (currentStaff.role === 'corporate_admin' && await hasPermission(currentStaff, 'menu.edit'));

      if (!canReactivatePackage) {
        logAuditEvent(
          currentStaff.name,
          currentStaff.role,
          currentStaff.branchId,
          'PACKAGE_REACTIVATION_BLOCKED',
          `Blocked unauthorized attempt to change status of package '${p.name}' (${p.id}) from ${p.status} to ${req.body.status}`
        );
        return res.status(403).json({
          error: 'Forbidden: Only Super Admin or users with explicit package reactivation authority (menu.package.reactivate) can activate or change the status of paused packages.',
        });
      }
    }

    // Section 4.1: For Fish Combo (or any item whose price is not stated in ACHIVED (2).pdf), prevent activation until an authorised price is explicitly confirmed
    if (
      (p as any).priceUnresolvedInArchivedPdf &&
      req.body.status === 'published' &&
      (!req.body.confirmAuthorisedPrice || !(Number(req.body.basePrice ?? req.body.price) > 0))
    ) {
      return res.status(400).json({
        error: `Cannot activate '${p.name}' (${p.id}) because its price was not stated in ACHIVED (2).pdf. Supply an explicit positive basePrice and confirmAuthorisedPrice: true to activate.`,
        code: 'UNRESOLVED_PDF_PRICE',
      });
    }

    const mergedPayload = {
      ...p,
      ...req.body,
      basePrice: req.body.basePrice !== undefined ? req.body.basePrice : (req.body.price !== undefined ? req.body.price : p.basePrice),
    };

    const validation = validateProductCommercialConfig(db, id, mergedPayload);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.errors.join(' '),
        errors: validation.errors,
      });
    }

    const prevStatus = p.status;
    const prevPrice = p.basePrice;

    const {
      name,
      category,
      subcategory,
      basePrice,
      shortDescription,
      longDescription,
      image,
      prepTimeMinutes,
      branchPrices,
      branchAvailability,
      channels,
      status,
      isPopular,
      isFeatured,
      isSpicy,
      isVegetarian,
      packagingCharge,
      optionGroups,
      availableAddOns,
    } = req.body;

    if (name) p.name = name.trim();
    if (category) p.category = category;
    if (subcategory !== undefined) p.subcategory = subcategory;
    const updatePrice = basePrice !== undefined ? basePrice : req.body.price;
    if (updatePrice !== undefined) {
      p.basePrice = Number(updatePrice);
      if (req.body.confirmAuthorisedPrice && Number(updatePrice) > 0) {
        (p as any).priceUnresolvedInArchivedPdf = false;
        delete (p as any).activationBlockedReason;
      }
    }
    if (req.body.priceUnresolvedInArchivedPdf !== undefined) {
      (p as any).priceUnresolvedInArchivedPdf = Boolean(req.body.priceUnresolvedInArchivedPdf);
    }
    if (shortDescription !== undefined) p.shortDescription = shortDescription.trim();
    if (longDescription !== undefined) p.longDescription = longDescription.trim();
    if (image) p.image = image.trim();
    if (prepTimeMinutes !== undefined) p.prepTimeMinutes = Number(prepTimeMinutes);
    if (branchPrices) p.branchPrices = { ...p.branchPrices, ...branchPrices };
    if (branchAvailability) p.branchAvailability = { ...p.branchAvailability, ...branchAvailability };
    if (Array.isArray(channels)) p.channels = channels;
    if (status) p.status = status;
    if (isPopular !== undefined) p.isPopular = Boolean(isPopular);
    if (isFeatured !== undefined) p.isFeatured = Boolean(isFeatured);
    if (isSpicy !== undefined) p.isSpicy = Boolean(isSpicy);
    if (isVegetarian !== undefined) p.isVegetarian = Boolean(isVegetarian);
    if (packagingCharge !== undefined) p.packagingCharge = Number(packagingCharge);
    if (optionGroups) p.optionGroups = optionGroups;
    if (availableAddOns) p.availableAddOns = availableAddOns;
    if (req.body.productType) p.productType = req.body.productType;
    if (req.body.packaging !== undefined) {
      p.packaging = validation.normalizedPackaging;
    }

    if (req.body.components !== undefined) {
      const prevCompJson = JSON.stringify(p.components || []);
      const nextCompJson = JSON.stringify(validation.normalizedComponents || []);
      p.components = validation.normalizedComponents;
      if (prevCompJson !== nextCompJson) {
        p.compositionVersion = (Number(p.compositionVersion) || 1) + 1;
      } else if (!p.compositionVersion && Array.isArray(p.components) && p.components.length > 0) {
        p.compositionVersion = 1;
      }
    }
    if (req.body.discountConfig !== undefined) {
      p.discountConfig = validation.normalizedDiscountConfig;
    }
    if (req.body.wholesalePricing !== undefined) {
      p.wholesalePricing = validation.normalizedWholesalePricing;
      if (validation.normalizedWholesalePricing) {
        p.isWholesale = Boolean(validation.normalizedWholesalePricing.enabled);
        p.minOrderQty = validation.normalizedWholesalePricing.minWholesaleQty;
        p.wholesaleUnitPrice = validation.normalizedWholesalePricing.wholesalePrice;
      }
    }
    if (req.body.isWholesale !== undefined) p.isWholesale = Boolean(req.body.isWholesale);
    if (req.body.minOrderQty !== undefined) p.minOrderQty = Number(req.body.minOrderQty);
    if (req.body.wholesaleUnitPrice !== undefined) p.wholesaleUnitPrice = Number(req.body.wholesaleUnitPrice);
    if (req.body.promotionRules !== undefined) {
      p.promotionRules = validation.normalizedPromotionRules;
    }
    p.updatedAt = new Date().toISOString();

    // Automatically revoke any active/published promotions for this product if paused or archived
    if ((p.status === 'archived' || p.status === 'paused') && db.promotions) {
      for (const promo of Object.values(db.promotions) as any[]) {
        if (promo && promo.productId === id && promo.status === 'published') {
          promo.status = 'revoked';
          promo.approvalStatus = 'revoked';
          promo.revokedByStaffId = currentStaff.id;
          promo.revokedByName = `${currentStaff.name} (${currentStaff.role})`;
          promo.revokedAt = new Date().toISOString();
          promo.revocationReason = `Product '${p.name}' was ${p.status}`;
        }
      }
    }

    saveDatabaseSync();

    const auditAction =
      prevStatus !== p.status
        ? p.status === 'published'
          ? 'PACKAGE_REACTIVATED'
          : 'PACKAGE_DEACTIVATED'
        : prevPrice !== p.basePrice
        ? 'PRODUCT_PRICE_CHANGED'
        : 'PRODUCT_UPDATED';

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      auditAction,
      `Updated product: ${p.name} (${p.id}, status: ${prevStatus}->${p.status}, price: ₦${prevPrice}->₦${p.basePrice}, type=${p.productType || 'standard'}, v=${p.compositionVersion || 1})`
    );
    res.json({ success: true, product: p });
  });

  router.delete('/api/menu/products/:id', requireAuth, async (req, res) => {
    const db = getDb();
    const currentStaff = (req as any).staff as DbStaffAccount;
    const isAuthorized =
      currentStaff.role === 'super_admin' ||
      currentStaff.role === 'admin' ||
      currentStaff.role === 'corporate_admin' ||
      currentStaff.role === 'branch_manager' ||
      await hasPermission(currentStaff, 'menu.edit');

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges to delete menu products.' });
    }

    const { id } = req.params;
    const p = db.menuProducts?.[id];
    if (!p) return res.status(404).json({ error: 'Product not found.' });

    const referencedInOrders = Object.values(db.orders || {}).some(
      (ord: any) =>
        Array.isArray(ord.items) &&
        ord.items.some((it: any) => it.productId === id || it.id === id || it.menuItemId === id || it.name === p.name)
    );
    const referencedInChecks = Object.values(db.checks || {}).some(
      (chk) =>
        Array.isArray(chk.items) &&
        chk.items.some((it) => it.productId === id || (it as any).menuItemId === id || it.name === p.name)
    );
    const referencedInRecipes = Object.values(db.recipes || {}).some(
      (r: any) => r.menuItemId === id || r.productId === id
    );

    if (referencedInOrders || referencedInChecks || referencedInRecipes) {
      p.status = 'archived';
      p.branchAvailability = { gra: false, okabere: false, ugbowo: false };
      p.updatedAt = new Date().toISOString();
      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'PRODUCT_ARCHIVED',
        `Archived product '${p.name}' (${p.id}) instead of hard-deleting to preserve historical order/check/BOM integrity`
      );
      return res.json({
        success: true,
        archived: true,
        product: p,
        message: `Product '${p.name}' is referenced in historical records and has been safely archived.`,
      });
    }

    delete db.menuProducts[id];
    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'PRODUCT_DELETED',
      `Deleted product: ${p.name} (${p.id})`
    );
    res.json({ success: true, archived: false, message: `Product ${id} deleted.` });
  });

  return router;
}

