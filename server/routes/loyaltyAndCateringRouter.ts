import { Router, RequestHandler } from 'express';
import crypto from 'crypto';
import {
  db,
  saveDatabaseSync,
  DbStaffAccount,
  hashWalletPin,
  verifyWalletPin,
  sanitizeCustomerRecord,
  calculateLoyaltyPoints,
} from '../../server_db';
import { createCateringAndHouseAccountsRouter } from './cateringAndHouseAccountsRouter';
import { createLoyaltyStampCardSubRouter } from './loyaltyStampCardSubRouter.ts';
import { supervisorAuthService } from '../services/supervisorAuthService';

export interface LoyaltyAndCateringRouterDeps {
  requireAuth: RequestHandler;
  requireBranchAccess: RequestHandler;
  requireRole: (roles: string[]) => RequestHandler;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    description: string
  ) => any;
  hasPermission: (staff: DbStaffAccount, permissionCode: string) => Promise<boolean>;
}

export function createLoyaltyAndCateringRouter(deps: LoyaltyAndCateringRouterDeps): Router {
  const router = Router();
  const { requireAuth, logAuditEvent, hasPermission } = deps;

  router.get('/api/customers', requireAuth, (req, res) => {
    const { search, tier, branchId } = req.query;
    let list = Object.values(db.customers || {});

    if (search && typeof search === 'string') {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (c: any) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }

    if (tier && typeof tier === 'string' && tier !== 'all') {
      list = list.filter((c: any) => c.tier === tier);
    }

    if (branchId && typeof branchId === 'string' && branchId !== 'all') {
      list = list.filter((c: any) => c.preferredBranchId === branchId || c.preferredBranchId === 'all');
    }

    const totalMembers = Object.keys(db.customers || {}).length;
    const totalWalletLiability = Object.values(db.customers || {}).reduce(
      (sum: number, c: any) => sum + Number(c.walletBalance || 0),
      0
    );
    const totalPointsOutstanding = Object.values(db.customers || {}).reduce(
      (sum: number, c: any) => sum + Number(c.loyaltyPoints || 0),
      0
    );
    const totalLifetimeSpend = Object.values(db.customers || {}).reduce(
      (sum: number, c: any) => sum + Number(c.lifetimeSpend || 0),
      0
    );

    res.json({
      customers: list.map((c: any) => sanitizeCustomerRecord(c)),
      stats: {
        totalMembers,
        totalWalletLiability,
        totalPointsOutstanding,
        totalLifetimeSpend,
      },
    });
  });

  router.post('/api/customers', requireAuth, async (req, res) => {
    const currentStaff = (req as any).staff as DbStaffAccount;
    const { name, phone, email, preferredBranchId = 'gra', walletPin, notes, birthday } = req.body;

    if (!(await hasPermission(currentStaff, 'crm.customers.manage')) && !['super_admin', 'corporate_admin', 'branch_manager', 'accountant'].includes(currentStaff.role)) {
      return res.status(403).json({ error: 'Access denied: CRM management requires crm.customers.manage privilege.' });
    }

    if (!walletPin) {
      return res.status(400).json({ error: 'Wallet PIN is required for new customer registration.' });
    }

    if (!name || !phone) {
      return res.status(400).json({ error: 'Customer name and phone number are required.' });
    }

    const existing = Object.values(db.customers || {}).find((c: any) => c.phone.trim() === phone.trim());
    if (existing) {
      return res.status(400).json({ error: `A customer with phone ${phone} is already registered (${existing.name}).` });
    }

    const customerId = `cust-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const newCustomer = {
      id: customerId,
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : undefined,
      tier: 'bronze',
      loyaltyPoints: 50,
      lifetimeSpend: 0,
      visitCount: 0,
      lastVisitDate: new Date().toISOString(),
      walletBalance: 0,
      walletPinHash: hashWalletPin(walletPin),
      stampCount: 0,
      stampsRedeemedTotal: 0,
      preferredBranchId,
      notes: notes || '',
      status: 'active',
      birthday: birthday || '',
      createdAt: new Date().toISOString(),
    };

    db.customers = db.customers || {};
    db.customers[customerId] = newCustomer;
    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'CUSTOMER_REGISTERED',
      `Registered new customer ${newCustomer.name} (${newCustomer.phone}) with 50 bonus points.`
    );

    res.json({ success: true, customer: sanitizeCustomerRecord(newCustomer) });
  });

  router.get('/api/customers/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const customer = (db.customers || {})[id];
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    const transactions = (db.walletTransactions || [])
      .filter((tx: any) => tx.customerId === id)
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ customer: sanitizeCustomerRecord(customer), transactions });
  });

  router.put('/api/customers/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;

    if (!(await hasPermission(currentStaff, 'crm.customers.manage')) && !['super_admin', 'corporate_admin', 'branch_manager', 'accountant'].includes(currentStaff.role)) {
      return res.status(403).json({ error: 'Access denied: CRM management requires crm.customers.manage privilege.' });
    }
    const customer = (db.customers || {})[id];
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    const { name, phone, email, notes, preferredBranchId, status, tier, walletPin, birthday } = req.body;
    if (name) customer.name = name.trim();
    if (phone) customer.phone = phone.trim();
    if (email !== undefined) customer.email = email.trim();
    if (notes !== undefined) customer.notes = notes;
    if (preferredBranchId) customer.preferredBranchId = preferredBranchId;
    if (status) customer.status = status;
    if (tier) customer.tier = tier;
    if (walletPin) {
      customer.walletPinHash = hashWalletPin(walletPin);
      delete customer.walletPin;
    }
    if (birthday !== undefined) customer.birthday = birthday;

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'CUSTOMER_UPDATED',
      `Updated profile for customer ${customer.name} (${customer.id})`
    );

    res.json({ success: true, customer: sanitizeCustomerRecord(customer) });
  });

  router.post('/api/customers/:id/topup', requireAuth, async (req, res) => {
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;

    if (!(await hasPermission(currentStaff, 'wallet.topup')) && !['super_admin', 'corporate_admin', 'branch_manager', 'accountant'].includes(currentStaff.role)) {
      return res.status(403).json({ error: 'Access denied: Wallet top-up requires wallet.topup privilege.' });
    }
    const customer = (db.customers || {})[id];
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    const { amount, paymentMethod = 'pos_terminal', reference, note } = req.body;
    const topUpAmount = Number(amount);
    if (isNaN(topUpAmount) || topUpAmount <= 0) {
      return res.status(400).json({ error: 'A positive top-up amount is required.' });
    }

    let bonusAmount = 0;
    if (topUpAmount >= 20000) {
      bonusAmount = Math.floor(topUpAmount * 0.05);
    }

    const prevBal = Number(customer.walletBalance || 0);
    const totalCredit = topUpAmount + bonusAmount;
    const newBal = prevBal + totalCredit;
    customer.walletBalance = newBal;

    const now = new Date().toISOString();
    const txId = `wtx-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const tx = {
      id: txId,
      customerId: customer.id,
      customerName: customer.name,
      type: 'top_up',
      amount: topUpAmount,
      bonusAmount,
      previousBalance: prevBal,
      newBalance: newBal,
      paymentMethod,
      reference: reference || `TOPUP-${Date.now().toString().slice(-6)}`,
      branchId: currentStaff.branchId || 'gra',
      staffName: currentStaff.name,
      timestamp: now,
      note: note || (bonusAmount > 0 ? `Included ₦${bonusAmount.toLocaleString()} (5%) reload bonus` : 'Wallet deposit'),
    };

    db.walletTransactions = db.walletTransactions || [];
    db.walletTransactions.push(tx);
    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'WALLET_TOPUP',
      `Credited ₦${totalCredit.toLocaleString()} to ${customer.name}'s wallet. Method: ${paymentMethod}`
    );

    res.json({ success: true, customer: sanitizeCustomerRecord(customer), transaction: tx });
  });

  router.post('/api/customers/:id/verify-pin', requireAuth, (req, res) => {
    const { id } = req.params;
    const customer = (db.customers || {})[id];
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    const { pin } = req.body;
    const valid = verifyWalletPin(pin, customer);
    res.json({ success: valid, verified: valid, customerName: customer.name, walletBalance: customer.walletBalance });
  });

  router.post(['/api/customers/:id/charge-wallet', '/api/customers/:id/wallet/charge'], requireAuth, async (req, res) => {
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const customer = (db.customers || {})[id];
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    const { amount, subtotal, discount, deliveryFee, orderId, orderNumber, note, pin, supervisorPin } = req.body;
    const chargeAmount = Number(amount);
    if (isNaN(chargeAmount) || chargeAmount <= 0) {
      return res.status(400).json({ error: 'A positive charge amount is required.' });
    }

    if (orderId) {
      const duplicateOrderCharge = (db.walletTransactions || []).find(
        (wtx: any) => wtx.customerId === customer.id && wtx.orderId === orderId && (wtx.type === 'spend' || wtx.type === 'debit_order')
      );
      if (duplicateOrderCharge) {
        return res.status(409).json({
          error: `Duplicate wallet charge blocked: order '${orderId}' has already been debited.`,
          transaction: duplicateOrderCharge,
        });
      }
    }

    const pinVerified = verifyWalletPin(pin, customer);
    const isManager = ['store_manager', 'branch_manager', 'super_admin', 'corporate_admin'].includes(currentStaff.role) && Boolean(req.body.managerOverride);
    const supervisor = supervisorPin 
        ? await supervisorAuthService.verifySupervisorPin(currentStaff, currentStaff.branchId, supervisorPin, 'wallet.charge', logAuditEvent)
        : null;
    const isSupervisorOverride = Boolean(supervisor);

    if (!pinVerified && !isSupervisorOverride && !isManager) {
      return res.status(403).json({
        error: 'Customer wallet authorization failed: Invalid wallet PIN.',
      });
    }

    const prevBal = Number(customer.walletBalance || 0);
    if (prevBal < chargeAmount) {
      return res.status(400).json({
        error: `Insufficient wallet balance. Customer has ₦${prevBal.toLocaleString()}, required ₦${chargeAmount.toLocaleString()}.`,
        walletBalance: prevBal,
      });
    }

    const newBal = prevBal - chargeAmount;
    customer.walletBalance = newBal;
    customer.lifetimeSpend = Number(customer.lifetimeSpend || 0) + chargeAmount;
    customer.totalLifetimeSpend = Number(customer.totalLifetimeSpend || 0) + chargeAmount;
    customer.totalOrdersCount = Number(customer.totalOrdersCount || 0) + 1;
    const earnedPts = calculateLoyaltyPoints({
      subtotal: subtotal !== undefined ? Number(subtotal) : undefined,
      discount: discount !== undefined ? Number(discount) : 0,
      deliveryFee: deliveryFee !== undefined ? Number(deliveryFee) : 0,
      total: chargeAmount,
    });
    customer.loyaltyPoints = Number(customer.loyaltyPoints || 0) + earnedPts;

    const now = new Date().toISOString();
    const tx = {
      id: `wtx-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      customerId: customer.id,
      customerName: customer.name,
      type: 'spend',
      amount: chargeAmount,
      earnedPoints: earnedPts,
      previousBalance: prevBal,
      newBalance: newBal,
      reference: orderNumber || `POS-ORD-${Date.now().toString().slice(-6)}`,
      orderId,
      branchId: currentStaff.branchId || 'gra',
      staffName: currentStaff.name,
      timestamp: now,
      note: note || `POS Order Payment #${orderNumber || ''}`,
    };

    db.walletTransactions = db.walletTransactions || [];
    db.walletTransactions.push(tx);
    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'WALLET_PURCHASE',
      `Charged ₦${chargeAmount.toLocaleString()} to ${customer.name}'s wallet for order ${orderNumber || ''}. New Balance: ₦${newBal.toLocaleString()}`
    );

    res.json({ success: true, customer: sanitizeCustomerRecord(customer), transaction: tx, earnedPoints: earnedPts });
  });

  router.post('/api/customers/:id/wallet/refund', requireAuth, async (req, res) => {
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;

    if (!(await hasPermission(currentStaff, 'wallet.refund')) && !['super_admin', 'corporate_admin', 'accountant'].includes(currentStaff.role)) {
      return res.status(403).json({ error: 'Access denied: Wallet refunds require wallet.refund privilege.' });
    }
    const customer = (db.customers || {})[id];
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    const { transactionId, orderId, reason } = req.body;
    const originalTx = (db.walletTransactions || []).find(
      (wtx: any) =>
        wtx.customerId === customer.id &&
        (wtx.type === 'spend' || wtx.type === 'debit_order') &&
        ((transactionId && wtx.id === transactionId) || (orderId && wtx.orderId === orderId))
    );
    if (!originalTx) {
      return res.status(404).json({ error: 'Original wallet spend transaction not found.' });
    }
    if ((originalTx as any).refundedAt) {
      return res.status(409).json({ error: 'This wallet transaction has already been refunded.' });
    }

    const now = new Date().toISOString();
    const refundAmt = Number(originalTx.amount || 0);
    const ptsToReverse =
      typeof (originalTx as any).earnedPoints === 'number'
        ? Number((originalTx as any).earnedPoints)
        : calculateLoyaltyPoints(refundAmt);

    const prevBal = Number(customer.walletBalance || 0);
    const newBal = prevBal + refundAmt;
    customer.walletBalance = newBal;
    customer.loyaltyPoints = Math.max(0, Number(customer.loyaltyPoints || 0) - ptsToReverse);
    customer.lifetimeSpend = Math.max(0, Number(customer.lifetimeSpend || 0) - refundAmt);
    (originalTx as any).refundedAt = now;

    const refundTx = {
      id: `wtx-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      customerId: customer.id,
      customerName: customer.name,
      type: 'refund',
      amount: refundAmt,
      reversedPoints: ptsToReverse,
      previousBalance: prevBal,
      newBalance: newBal,
      reference: `REF-${originalTx.reference || originalTx.id}`,
      orderId: originalTx.orderId,
      branchId: currentStaff.branchId || 'gra',
      staffName: currentStaff.name,
      timestamp: now,
      note: reason || `Refund of wallet spend ${originalTx.reference || originalTx.id}`,
    };

    db.walletTransactions.push(refundTx);
    saveDatabaseSync();

    res.json({
      success: true,
      customer: sanitizeCustomerRecord(customer),
      transaction: refundTx,
      reversedPoints: ptsToReverse,
    });
  });

  router.use(createLoyaltyStampCardSubRouter(deps));

  router.use(createCateringAndHouseAccountsRouter(deps));

  return router;
}
