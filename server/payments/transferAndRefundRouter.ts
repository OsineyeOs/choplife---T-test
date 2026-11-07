import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import {
  awardOrderLoyaltyPointsIfEligible,
  reverseOrderLoyaltyPointsIfAwarded,
} from '../../server_db.ts';
import type { PaymentRouterDeps } from '../../server_payments.ts';

export function createTransferAndRefundRouter(deps: PaymentRouterDeps): Router {
  const router = Router();
  const { getDb, saveDatabaseSync, getSessionFromRequest, logAuditEvent } = deps;

  // 5. Customer Bank Transfer Reference Submission (Sets status to reconciliation_required — NEVER auto-marks paid)
  router.post('/api/payments/submit-transfer', (req: Request, res: Response) => {
    const db = getDb();
    const { orderId, orderNumber, transferReference, payerName, payerBank, amountClaimed } = req.body || {};

    if (!transferReference || typeof transferReference !== 'string' || transferReference.trim().length < 4) {
      return res.status(400).json({ error: 'A valid bank transfer session ID or reference (min 4 characters) is required.' });
    }

    let order = orderId ? db.orders?.[orderId] : undefined;
    if (!order && orderNumber) {
      order = Object.values(db.orders || {}).find((o: any) => o.orderNumber === orderNumber);
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found for bank transfer submission.' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(409).json({ error: 'Order is already confirmed as paid.' });
    }

    const cleanTransferRef = transferReference.trim();
    db.paymentTransactions = db.paymentTransactions || {};

    // Prevent reusing a transfer reference across different orders
    const duplicateRefOrder = Object.values(db.orders || {}).find(
      (o: any) =>
        o.id !== order.id &&
        (o.paymentReference === cleanTransferRef || o.transferSubmission?.transferReference === cleanTransferRef)
    ) as any;
    if (duplicateRefOrder) {
      return res.status(409).json({
        error: `Transfer reference '${cleanTransferRef}' has already been submitted for another order (${duplicateRefOrder.orderNumber}).`,
      });
    }

    const now = new Date().toISOString();
    const submission = {
      transferReference: cleanTransferRef,
      payerName: (payerName || order.deliveryDetails?.customerName || 'Customer').trim(),
      payerBank: (payerBank || 'Customer Bank').trim(),
      amountClaimed: Number(amountClaimed || order.total || 0),
      submittedAt: now,
      reconciliationStatus: 'reconciliation_required' as const,
    };

    order.paymentMethod = 'bank_transfer';
    order.paymentStatus = 'reconciliation_required';
    order.paymentReference = cleanTransferRef;
    order.transferSubmission = submission;
    order.updatedAt = now;

    db.paymentTransactions[cleanTransferRef] = {
      reference: cleanTransferRef,
      orderId: order.id,
      orderNumber: order.orderNumber,
      branchId: order.branchId || 'gra',
      amountNaira: Number(order.total || 0),
      amountKobo: Math.round(Number(order.total || 0) * 100),
      currency: 'NGN',
      paymentMethod: 'bank_transfer',
      status: 'reconciliation_required',
      payerName: submission.payerName,
      payerBank: submission.payerBank,
      createdAt: now,
      updatedAt: now,
    };

    saveDatabaseSync();
    logAuditEvent(
      submission.payerName,
      'online_customer',
      order.branchId || 'gra',
      'BANK_TRANSFER_SUBMITTED',
      `Customer submitted bank transfer ref '${cleanTransferRef}' (${submission.payerBank}) for Order #${order.orderNumber} (₦${Number(order.total).toLocaleString()}) — awaiting cashier/finance reconciliation.`
    );

    return res.status(200).json({
      success: true,
      paymentStatus: 'reconciliation_required',
      message: 'Transfer reference recorded. Your order payment is pending finance/cashier bank alert confirmation.',
      order,
    });
  });

  // 6. Staff Bank Transfer Confirmation / Rejection Endpoint (Audited Finance/Cashier Action)
  router.post('/api/payments/confirm-transfer', async (req: Request, res: Response) => {
    const db = getDb();
    const session = await getSessionFromRequest(req);
    const staff = session ? db.staff?.[session.staffId] : null;

    if (!staff) {
      return res.status(401).json({ error: 'Authentication required to reconcile bank transfers.' });
    }

    const allowedRoles = ['cashier', 'accountant', 'branch_manager', 'corporate_admin', 'super_admin', 'admin'];
    if (!allowedRoles.includes(staff.role)) {
      return res.status(403).json({
        error: `Forbidden: Role '${staff.role}' is not authorized to confirm or reject bank transfers.`,
      });
    }

    const { orderId, orderNumber, transferReference, decision = 'confirm', notes } = req.body || {};
    let order = orderId ? db.orders?.[orderId] : undefined;
    if (!order && orderNumber) {
      order = Object.values(db.orders || {}).find((o: any) => o.orderNumber === orderNumber);
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found for bank transfer confirmation.' });
    }

    if (staff.role === 'branch_manager' || staff.role === 'cashier') {
      const allowed = staff.allowedBranchIds || [staff.branchId];
      if (order.branchId && !allowed.includes(order.branchId) && staff.branchId !== order.branchId) {
        return res.status(403).json({ error: `Cannot reconcile bank transfers for another branch (${order.branchId}).` });
      }
    }

    const effectiveRef = (transferReference || order.paymentReference || order.transferSubmission?.transferReference || '').trim();
    if (!effectiveRef) {
      return res.status(400).json({ error: 'Transfer reference is required to reconcile bank transfer.' });
    }

    const now = new Date().toISOString();
    db.paymentTransactions = db.paymentTransactions || {};

    if (decision === 'reject') {
      order.paymentStatus = 'failed';
      order.updatedAt = now;
      if (order.transferSubmission) {
        order.transferSubmission.reconciliationStatus = 'rejected';
        order.transferSubmission.reconciledByStaffId = staff.id;
        order.transferSubmission.reconciledByName = staff.name;
        order.transferSubmission.reconciledAt = now;
        order.transferSubmission.notes = notes || 'Transfer not received in bank statement';
      }
      if (db.paymentTransactions[effectiveRef]) {
        db.paymentTransactions[effectiveRef].status = 'failed';
        db.paymentTransactions[effectiveRef].updatedAt = now;
      }
      saveDatabaseSync();
      logAuditEvent(
        staff.name,
        staff.role,
        order.branchId || staff.branchId,
        'BANK_TRANSFER_REJECTED',
        `Rejected bank transfer ref '${effectiveRef}' for Order #${order.orderNumber}. Reason: ${notes || 'Unverified deposit'}`
      );
      return res.json({
        success: true,
        paymentStatus: 'failed',
        message: `Bank transfer '${effectiveRef}' marked as unverified/failed.`,
        order,
      });
    }

    // Confirm bank transfer
    order.paymentStatus = 'paid';
    order.paymentMethod = 'bank_transfer';
    order.paymentReference = effectiveRef;
    order.paymentVerificationSource = 'staff_bank_reconciliation';
    order.paidAt = now;
    order.updatedAt = now;
    if (order.transferSubmission) {
      order.transferSubmission.reconciliationStatus = 'confirmed';
      order.transferSubmission.reconciledByStaffId = staff.id;
      order.transferSubmission.reconciledByName = staff.name;
      order.transferSubmission.reconciledAt = now;
      order.transferSubmission.notes = notes || 'Verified against bank credit alert';
    }

    const checkId = `chk-${order.id}`;
    if (db.checks?.[checkId]) {
      db.checks[checkId].paymentStatus = 'paid';
      db.checks[checkId].status = 'paid';
      db.checks[checkId].paidAt = now;
      db.checks[checkId].paymentMethod = 'bank_transfer';
      db.checks[checkId].settledByStaffId = staff.id;
      db.checks[checkId].settledByName = staff.name;
    }

    db.paymentTransactions[effectiveRef] = {
      ...(db.paymentTransactions[effectiveRef] || {
        reference: effectiveRef,
        orderId: order.id,
        orderNumber: order.orderNumber,
        branchId: order.branchId || 'gra',
        createdAt: now,
      }),
      amountNaira: Number(order.total || 0),
      amountKobo: Math.round(Number(order.total || 0) * 100),
      currency: 'NGN',
      paymentMethod: 'bank_transfer',
      status: 'paid',
      verificationSource: 'staff_bank_reconciliation',
      reconciledByStaffId: staff.id,
      reconciledByName: staff.name,
      verifiedAt: now,
      updatedAt: now,
    };

    awardOrderLoyaltyPointsIfEligible(db, order, now);
    saveDatabaseSync();

    logAuditEvent(
      staff.name,
      staff.role,
      order.branchId || staff.branchId,
      'BANK_TRANSFER_CONFIRMED',
      `Confirmed bank transfer ref '${effectiveRef}' for Order #${order.orderNumber} (₦${Number(order.total).toLocaleString()})`
    );

    return res.json({
      success: true,
      paymentStatus: 'paid',
      message: `Bank transfer '${effectiveRef}' confirmed and Order #${order.orderNumber} marked paid.`,
      order,
    });
  });

  // 7. Authoritative Refund & Reversal Ledger Endpoint
  router.get('/api/payments/refunds', async (req: Request, res: Response) => {
    const db = getDb();
    const session = await getSessionFromRequest(req);
    const staff = session ? db.staff?.[session.staffId] : null;
    if (!staff) {
      return res.status(401).json({ error: 'Authentication required to view refund ledger.' });
    }
    const allowedRoles = ['accountant', 'auditor', 'branch_manager', 'corporate_admin', 'super_admin', 'admin'];
    if (!allowedRoles.includes(staff.role)) {
      return res.status(403).json({ error: 'Insufficient privileges to view refund ledger.' });
    }
    db.refunds = db.refunds || {};
    let list = Object.values(db.refunds);
    if (staff.role === 'branch_manager') {
      list = list.filter((r: any) => r.branchId === staff.branchId);
    }
    return res.json(list);
  });

  router.post('/api/payments/refund', async (req: Request, res: Response) => {
    const db = getDb();
    const session = await getSessionFromRequest(req);
    const staff = session ? db.staff?.[session.staffId] : null;
    if (!staff) {
      return res.status(401).json({ error: 'Authentication required to authorize a payment refund.' });
    }

    const allowedRoles = ['accountant', 'branch_manager', 'corporate_admin', 'super_admin', 'admin'];
    if (!allowedRoles.includes(staff.role)) {
      return res.status(403).json({
        error: `Forbidden: Role '${staff.role}' is not authorized to issue payment refunds.`,
      });
    }

    const { orderId, orderNumber, amount, reason } = req.body || {};
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ error: 'A mandatory audit reason is required to process a refund.' });
    }

    let order = orderId ? db.orders?.[orderId] : undefined;
    if (!order && orderNumber) {
      order = Object.values(db.orders || {}).find((o: any) => o.orderNumber === orderNumber);
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found for refund.' });
    }

    if (staff.role === 'branch_manager' && order.branchId !== staff.branchId) {
      return res.status(403).json({ error: `Branch Manager can only refund orders belonging to '${staff.branchId}'.` });
    }

    if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'partially_refunded') {
      return res.status(409).json({
        error: `Cannot refund Order #${order.orderNumber} because its current paymentStatus is '${order.paymentStatus}'. Only paid orders can be refunded.`,
      });
    }

    db.refunds = db.refunds || {};
    const existingRefundsForOrder = Object.values(db.refunds).filter((r: any) => r.orderId === order.id) as any[];
    const alreadyRefunded = existingRefundsForOrder.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
    const orderTotal = Number(order.total || 0);
    const maxRefundable = Math.max(0, orderTotal - alreadyRefunded);

    if (maxRefundable <= 0) {
      return res.status(409).json({
        error: `Order #${order.orderNumber} has already been refunded in full (₦${alreadyRefunded.toLocaleString()}).`,
      });
    }

    const refundAmount = amount !== undefined ? Number(amount) : maxRefundable;
    if (Number.isNaN(refundAmount) || refundAmount <= 0 || refundAmount > maxRefundable) {
      return res.status(400).json({
        error: `Invalid refund amount ₦${refundAmount}. Maximum refundable balance is ₦${maxRefundable.toLocaleString()}.`,
      });
    }

    const now = new Date().toISOString();
    const refundId = `ref-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const isFullRefund = Math.abs(alreadyRefunded + refundAmount - orderTotal) < 0.01;

    const refundRecord = {
      id: refundId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      branchId: order.branchId || 'gra',
      paymentReference: order.paymentReference || null,
      orderTotal,
      amount: refundAmount,
      totalRefundedToDate: alreadyRefunded + refundAmount,
      isFullRefund,
      reason: reason.trim(),
      processedByStaffId: staff.id,
      processedByName: staff.name,
      processedByRole: staff.role,
      createdAt: now,
    };

    db.refunds[refundId] = refundRecord;
    order.refundedAmount = alreadyRefunded + refundAmount;
    order.refundedAt = now;
    order.updatedAt = now;

    if (isFullRefund) {
      order.paymentStatus = 'refunded';
      order.status = 'cancelled';
      const checkId = `chk-${order.id}`;
      if (db.checks?.[checkId]) {
        db.checks[checkId].paymentStatus = 'refunded';
        db.checks[checkId].status = 'voided';
        db.checks[checkId].voidedAt = now;
      }
      reverseOrderLoyaltyPointsIfAwarded(db, order, now);
    } else {
      order.paymentStatus = 'partially_refunded';
    }

    saveDatabaseSync();
    logAuditEvent(
      staff.name,
      staff.role,
      order.branchId || staff.branchId,
      'PAYMENT_REFUNDED',
      `Processed ${isFullRefund ? 'FULL' : 'PARTIAL'} refund of ₦${refundAmount.toLocaleString()} for Order #${order.orderNumber}. Reason: ${reason.trim()}`
    );

    return res.status(200).json({
      success: true,
      refund: refundRecord,
      paymentStatus: order.paymentStatus,
      order,
    });
  });

  return router;
}
