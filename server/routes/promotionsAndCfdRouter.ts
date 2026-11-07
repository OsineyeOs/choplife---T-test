import express, { Request, Response } from 'express';
import { db } from '../../server_db.ts';
import type { DbPromotion } from '../db/schemaTypes.ts';

export function createPromotionsRouter(): express.Router {
  const router = express.Router();

  const getCfdScreenHandler = (req: Request, res: Response) => {
    try {
      const branchId = (req.query.branchId as string) || 'gra';
      
      // 1. Calculate bestsellers from paid checks / orders
      const salesCounts: Record<string, number> = {};
      const checks = db.checks || {};
      for (const check of Object.values(checks) as any[]) {
        if (check && (check.status === 'paid' || check.paymentStatus === 'paid')) {
          const items = check.items || check.cartItems || [];
          for (const item of items) {
            const prodId = item.productId || item.id;
            if (prodId) {
              salesCounts[prodId] = (salesCounts[prodId] || 0) + (item.quantity || 1);
            }
          }
        }
      }

      const sortedBestSellers = Object.entries(salesCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([productId, count]) => {
          const product = db.menuProducts?.[productId];
          return {
            productId,
            productName: product?.name || productId,
            unitsSold: count,
            price: product?.basePrice || 0,
            image: product?.image || '',
          };
        });

      // 2. Get approved active promotions matching branch
      const now = new Date().toISOString();
      const activePromotions: DbPromotion[] = [];
      
      if (db.promotions) {
        for (const promo of Object.values(db.promotions) as DbPromotion[]) {
          if (
            promo.approvalStatus === 'approved' &&
            promo.status === 'published' &&
            (!promo.branches || promo.branches.length === 0 || promo.branches.includes(branchId) || promo.branches.includes('all'))
          ) {
            // Check start/end dates
            if (promo.startDate <= now && (!promo.endDate || promo.endDate >= now)) {
              // Verify product is still published
              const product = db.menuProducts?.[promo.productId];
              if (product && product.status === 'published') {
                activePromotions.push(promo);
              }
            }
          }
        }
      }

      // 3. Welcome screen configuration
      const welcomeConfig = {
        brandTitle: 'CHOPLIFE REPUBLIC',
        tagline: 'Authentic Nigerian Woodfire Grill & Bar',
        welcomeMessage: 'Welcome to our premium dining & entertainment lounge.',
        hasPromotions: activePromotions.length > 0,
      };

      res.json({
        success: true,
        branchId,
        bestsellers: sortedBestSellers,
        promotions: activePromotions,
        welcomeScreen: welcomeConfig,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  // Support /cfd/display-screen, /cfd/screen, and /cfd-screen
  router.get('/cfd/display-screen', getCfdScreenHandler);
  router.get('/cfd/screen', getCfdScreenHandler);
  router.get('/cfd-screen', getCfdScreenHandler);

  const getPromotionsHandler = (req: Request, res: Response) => {
    try {
      const promotions = Object.values(db.promotions || {});
      res.json({ success: true, promotions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  // Support /promotions
  router.get('/promotions', getPromotionsHandler);

  // POST /api/promotions - Create a new promotion draft
  router.post('/promotions', (req: Request, res: Response) => {
    try {
      const {
        title,
        subtitle,
        productId,
        promotionType,
        discountPercent,
        specialPrice,
        branches,
        startDate,
        endDate,
        badge,
        badgeColor,
        image,
        staffId,
        staffName,
      } = req.body;

      if (!title || !productId || !promotionType) {
        return res.status(400).json({ success: false, error: 'Missing required promotion fields (title, productId, promotionType)' });
      }

      const product = db.menuProducts?.[productId];
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found in menu catalogue' });
      }

      const promoId = `promo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newPromotion: DbPromotion = {
        id: promoId,
        title,
        subtitle,
        productId,
        productName: product.name,
        promotionType,
        discountPercent: discountPercent ? Number(discountPercent) : undefined,
        specialPrice: specialPrice ? Number(specialPrice) : undefined,
        originalPrice: product.basePrice,
        branches: branches || ['all'],
        startDate: startDate || new Date().toISOString(),
        endDate: endDate || undefined,
        badge,
        badgeColor,
        image: image || product.image,
        status: 'draft',
        approvalStatus: 'pending_approval',
        createdByStaffId: staffId || 'system-staff',
        createdByName: staffName || 'System Admin',
        createdAt: new Date().toISOString(),
      };

      if (!db.promotions) db.promotions = {};
      db.promotions[promoId] = newPromotion;

      res.status(201).json({ success: true, promotion: newPromotion });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/promotions/:id/approve - Approve promotion with Segregation of Duties
  router.post('/promotions/:id/approve', (req: Request, res: Response) => {
    try {
      const promoId = req.params.id;
      const { staffId, staffName, role } = req.body;

      const promotion = db.promotions?.[promoId];
      if (!promotion) {
        return res.status(404).json({ success: false, error: 'Promotion not found' });
      }

      // Segregation of Duties: Creator cannot approve their own promotion unless super_admin
      const isSuperAdmin = role === 'super_admin' || role === 'admin' || (db.staff?.[staffId]?.role === 'super_admin');
      if (promotion.createdByStaffId === staffId && !isSuperAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Segregation of Duties Violation: You cannot approve a promotion you created unless you are a Super Administrator.',
        });
      }

      // Verify product is published
      const product = db.menuProducts?.[promotion.productId];
      if (!product || product.status !== 'published') {
        return res.status(400).json({ success: false, error: 'Cannot approve promotion for archived or unpublished product.' });
      }

      promotion.approvalStatus = 'approved';
      promotion.status = 'published';
      promotion.approvedByStaffId = staffId || 'admin-user';
      promotion.approvedByName = staffName || 'Administrator';
      promotion.approvedAt = new Date().toISOString();

      res.json({ success: true, promotion });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/promotions/:id/revoke - Revoke promotion
  router.post('/promotions/:id/revoke', (req: Request, res: Response) => {
    try {
      const promoId = req.params.id;
      const { staffId, staffName, reason } = req.body;

      const promotion = db.promotions?.[promoId];
      if (!promotion) {
        return res.status(404).json({ success: false, error: 'Promotion not found' });
      }

      promotion.approvalStatus = 'revoked';
      promotion.status = 'revoked';
      promotion.revokedByStaffId = staffId || 'admin-user';
      promotion.revokedByName = staffName || 'Administrator';
      promotion.revokedAt = new Date().toISOString();
      promotion.revocationReason = reason || 'Administrative revocation';

      res.json({ success: true, promotion });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

