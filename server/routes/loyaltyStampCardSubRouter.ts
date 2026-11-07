import { Router } from 'express';
import crypto from 'crypto';
import { db, saveDatabaseSync, DbStaffAccount, sanitizeCustomerRecord } from '../../server_db.ts';
import type { LoyaltyAndCateringRouterDeps } from './loyaltyAndCateringRouter.ts';

export function createLoyaltyStampCardSubRouter(deps: LoyaltyAndCateringRouterDeps): Router {
  const router = Router();
  const { requireAuth, logAuditEvent } = deps;

  router.post(['/api/customers/:id/redeem-points', '/api/customers/:id/loyalty/redeem'], requireAuth, (req, res) => {
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const customer = (db.customers || {})[id];
    if (!customer) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    const { pointsToRedeem, idempotencyKey } = req.body;
    const pts = Number(pointsToRedeem);
    if (isNaN(pts) || pts <= 0 || !Number.isInteger(pts) || pts > 100000) {
      res.status(400).json({ error: 'Please specify a valid positive integer point amount to redeem (up to 100,000 pts).' });
      return;
    }

    if (idempotencyKey) {
      const existingRedemption = (db.walletTransactions || []).find(
        (wtx: any) =>
          wtx.customerId === customer.id &&
          wtx.type === 'points_conversion' &&
          wtx.idempotencyKey === String(idempotencyKey)
      );
      if (existingRedemption) {
        res.status(409).json({
          error: 'Duplicate loyalty point redemption request blocked (idempotencyKey already processed).',
          transaction: existingRedemption,
        });
        return;
      }
    }

    if (Number(customer.loyaltyPoints || 0) < pts) {
      res.status(400).json({
        error: `Insufficient loyalty points. Customer has ${customer.loyaltyPoints || 0} points, tried to redeem ${pts}.`,
      });
      return;
    }

    const creditValue = pts * 10;
    customer.loyaltyPoints = Number(customer.loyaltyPoints || 0) - pts;
    const prevBal = Number(customer.walletBalance || 0);
    const newBal = prevBal + creditValue;
    customer.walletBalance = newBal;

    const now = new Date().toISOString();
    const tx = {
      id: `wtx-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      customerId: customer.id,
      customerName: customer.name,
      type: 'points_conversion',
      amount: creditValue,
      pointsRedeemed: pts,
      idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined,
      previousBalance: prevBal,
      newBalance: newBal,
      branchId: currentStaff.branchId || 'gra',
      staffName: currentStaff.name,
      timestamp: now,
      note: `Converted ${pts} loyalty points to ₦${creditValue.toLocaleString()} wallet credit`,
    };

    db.walletTransactions = db.walletTransactions || [];
    db.walletTransactions.push(tx);
    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'LOYALTY_POINTS_REDEEMED',
      `${customer.name} redeemed ${pts} points for ₦${creditValue.toLocaleString()} wallet credit.`
    );

    res.json({ success: true, customer: sanitizeCustomerRecord(customer), transaction: tx, creditValue });
  });

  router.post('/api/customers/:id/redeem-stamp', requireAuth, (req, res) => {
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const customer = (db.customers || {})[id];
    if (!customer) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    if (Number(customer.stampCount || 0) < 10) {
      res.status(400).json({
        error: `Customer has ${customer.stampCount || 0}/10 stamps. 10 stamps are required to claim the complimentary reward.`,
      });
      return;
    }

    customer.stampCount = 0;
    customer.stampsRedeemedTotal = (customer.stampsRedeemedTotal || 0) + 1;

    const rewardCredit = 4000;
    const prevBal = Number(customer.walletBalance || 0);
    const newBal = prevBal + rewardCredit;
    customer.walletBalance = newBal;

    const now = new Date().toISOString();
    const tx = {
      id: `wtx-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      customerId: customer.id,
      customerName: customer.name,
      type: 'bonus',
      amount: rewardCredit,
      previousBalance: prevBal,
      newBalance: newBal,
      branchId: currentStaff.branchId || 'gra',
      staffName: currentStaff.name,
      timestamp: now,
      note: '10-Stamp Card milestone reward: ₦4,000 complimentary meal bonus credit',
    };

    db.walletTransactions = db.walletTransactions || [];
    db.walletTransactions.push(tx);
    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'STAMP_CARD_REDEEMED',
      `${customer.name} completed 10 stamps! Awarded ₦4,000 meal bonus credit.`
    );

    res.json({ success: true, customer, transaction: tx, rewardCredit });
  });

  return router;
}
