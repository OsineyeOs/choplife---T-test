import { Router } from 'express';
import type { Request, Response } from 'express';
import type { PaymentRouterDeps } from '../../server_payments.ts';
import { awardOrderLoyaltyPointsIfEligible } from '../../server_db.ts';

export function createReconciliationRouter(deps: PaymentRouterDeps): Router {
  const router = Router();
  const { getDb, saveDatabaseSync, getSessionFromRequest, logAuditEvent, staffRepository, hasPermission } = deps;

  function syncOperationalTransactionsToLedger(db: any) {
    db.paymentTransactions = db.paymentTransactions || {};
    let mutated = false;

    // 1. Sync online & counter orders paid or pending via bank_transfer, card, or pos_terminal
    for (const order of Object.values(db.orders || {}) as any[]) {
      if (!order || !order.id) continue;
      const method = order.paymentMethod || 'cash';
      if (!['bank_transfer', 'card', 'pos_terminal', 'split'].includes(method)) continue;

      const ref =
        order.paymentReference ||
        order.transferSubmission?.transferReference ||
        `TX-ORD-${order.orderNumber || order.id}`;

      if (!db.paymentTransactions[ref]) {
        const isPaid = order.paymentStatus === 'paid';
        db.paymentTransactions[ref] = {
          reference: ref,
          orderId: order.id,
          orderNumber: order.orderNumber || order.id,
          branchId: order.branchId || 'gra',
          amountNaira: Number(order.total || 0),
          amountKobo: Math.round(Number(order.total || 0) * 100),
          currency: 'NGN',
          paymentMethod: method,
          payerName:
            order.transferSubmission?.payerName ||
            order.customerName ||
            order.customer?.name ||
            'Walk-in / Online Guest',
          payerBank:
            order.transferSubmission?.payerBank ||
            (method === 'pos_terminal' ? 'Moniepoint / Store POS' : method === 'card' ? 'Paystack Card Gateway' : 'Direct Bank Transfer'),
          terminalSerial: order.terminalSerial || (method === 'pos_terminal' ? 'MP-8923011' : undefined),
          status: isPaid ? 'paid' : order.paymentStatus || 'reconciliation_required',
          reconciliationStatus: isPaid ? 'reconciled' : 'pending',
          verificationSource: order.paymentVerificationSource || (isPaid ? 'pos_settlement' : 'awaiting_verification'),
          createdAt: order.createdAt || new Date().toISOString(),
          updatedAt: order.updatedAt || order.createdAt || new Date().toISOString(),
        };
        mutated = true;
      }
    }

    // 2. Sync POS checks settled via bank_transfer, pos_terminal, card, or split
    for (const check of Object.values(db.checks || {}) as any[]) {
      if (!check || !check.id) continue;
      const method = check.paymentMethod || 'cash';
      if (!['bank_transfer', 'card', 'pos_terminal', 'split'].includes(method)) continue;

      const ref = check.paymentReference || `POS-CHK-${check.checkNumber || check.id}`;
      if (!db.paymentTransactions[ref]) {
        const isPaid = check.paymentStatus === 'paid' || check.status === 'paid' || check.status === 'closed';
        db.paymentTransactions[ref] = {
          reference: ref,
          orderId: check.orderId || null,
          checkId: check.id,
          orderNumber: check.orderNumber || `CHK-${check.checkNumber || check.id}`,
          branchId: check.branchId || 'gra',
          amountNaira: Number(check.totalAmount ?? check.total ?? 0),
          amountKobo: Math.round(Number(check.totalAmount ?? check.total ?? 0) * 100),
          currency: 'NGN',
          paymentMethod: method,
          payerName: check.customerName || check.guestName || 'In-Store POS Guest',
          payerBank:
            method === 'pos_terminal'
              ? 'Moniepoint / Baxi POS Terminal'
              : method === 'bank_transfer'
              ? 'Store Bank Transfer'
              : 'Card Terminal',
          terminalSerial: check.terminalSerial || (method === 'pos_terminal' ? 'MP-8923011' : undefined),
          status: isPaid ? 'paid' : 'reconciliation_required',
          reconciliationStatus: isPaid ? 'reconciled' : 'pending',
          verificationSource: isPaid ? 'pos_counter_settlement' : 'awaiting_verification',
          reconciledByName: check.settledByName || check.createdByName || 'POS Cashier',
          createdAt: check.createdAt || new Date().toISOString(),
          updatedAt: check.paidAt || check.updatedAt || new Date().toISOString(),
        };
        mutated = true;
      }
    }

    if (mutated) {
      saveDatabaseSync();
    }
  }

  // 1. GET /api/reconciliation/transactions - Retrieve payment transactions & external terminal batches
  router.get('/api/reconciliation/transactions', async (req: Request, res: Response) => {
    const db = getDb();
    const session = await getSessionFromRequest(req);
    const staff = session ? await staffRepository.getById(session.staffId) : null;

    if (!staff) {
      return res.status(401).json({ error: 'Authentication required for payment reconciliation.' });
    }

    if (!(await hasPermission(staff, 'accounting.reconcile')) && !['accountant', 'auditor', 'branch_manager', 'corporate_admin', 'super_admin', 'admin', 'cashier'].includes(staff.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges for reconciliation.' });
    }

    syncOperationalTransactionsToLedger(db);

    let transactions = Object.values(db.paymentTransactions || {}) as any[];
    transactions.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    // Filter by branch for branch managers / cashiers
    if (staff.role === 'branch_manager' || staff.role === 'cashier') {
      const allowed = staff.allowedBranchIds || [staff.branchId];
      transactions = transactions.filter((t) => !t.branchId || allowed.includes(t.branchId));
    }

    // Include orders pending bank transfer verification
    const ordersPendingTransfer = Object.values(db.orders || {}).filter(
      (o: any) => o.paymentMethod === 'bank_transfer' && o.paymentStatus === 'reconciliation_required'
    ) as any[];

    const stats = {
      totalCount: transactions.length,
      pendingBankTransfers:
        ordersPendingTransfer.length +
        transactions.filter(
          (t) =>
            t.paymentMethod === 'bank_transfer' &&
            (t.status === 'reconciliation_required' || t.status === 'pending')
        ).length,
      unmatchedCount: transactions.filter((t) => t.status === 'reconciliation_required' || t.status === 'pending').length,
      reconciledCount: transactions.filter((t) => t.status === 'paid' || t.status === 'confirmed' || t.status === 'reconciled').length,
      failedCount: transactions.filter((t) => t.status === 'failed' || t.status === 'rejected').length,
      totalReconciledNaira: transactions
        .filter((t) => t.status === 'paid' || t.status === 'confirmed' || t.status === 'reconciled')
        .reduce((sum, t) => sum + Number(t.amountNaira || 0), 0),
    };

    return res.json({
      success: true,
      stats,
      transactions,
      ordersPendingTransfer,
      posTerminals: db.posTerminals || [
        { id: 'TERM-01', name: 'Moniepoint POS 1 - GRA Counter', serialNumber: 'MP-8923011', branchId: 'gra', status: 'online' },
        { id: 'TERM-02', name: 'Baxi POS 2 - Tombia HQ Counter', serialNumber: 'BX-4412980', branchId: 'tombia', status: 'online' },
        { id: 'TERM-03', name: 'OPay POS 3 - Agip Express Counter', serialNumber: 'OP-7731209', branchId: 'agip', status: 'online' },
      ],
    });
  });

  // 2. POST /api/reconciliation/log-terminal - Record an external POS terminal slip or bank transfer alert
  router.post('/api/reconciliation/log-terminal', async (req: Request, res: Response) => {
    const db = getDb();
    const session = await getSessionFromRequest(req);
    const staff = session ? await staffRepository.getById(session.staffId) : null;

    if (!staff) {
      return res.status(401).json({ error: 'Authentication required to log terminal or transfer payment.' });
    }

    const {
      reference,
      orderNumber,
      amountNaira,
      paymentMethod = 'pos_terminal',
      payerName,
      payerBank,
      terminalSerial,
      branchId,
      autoReconcile = true,
      notes,
    } = req.body || {};

    const cleanAmount = Number(amountNaira || 0);
    if (!cleanAmount || cleanAmount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount in Naira is required.' });
    }

    const now = new Date().toISOString();
    const txRef = (reference && String(reference).trim()) || `SLIP-${Date.now().toString().slice(-6)}`;
    db.paymentTransactions = db.paymentTransactions || {};

    const matchedOrder = orderNumber
      ? (Object.values(db.orders || {}) as any[]).find(
          (o) =>
            o.orderNumber?.toLowerCase() === String(orderNumber).trim().toLowerCase() ||
            o.id === orderNumber
        )
      : undefined;

    const tx = {
      reference: txRef,
      orderId: matchedOrder?.id || null,
      orderNumber: matchedOrder?.orderNumber || orderNumber || 'WALK-IN-SLIP',
      branchId: branchId || matchedOrder?.branchId || staff.branchId || 'gra',
      amountNaira: cleanAmount,
      amountKobo: Math.round(cleanAmount * 100),
      currency: 'NGN',
      paymentMethod,
      payerName: payerName || matchedOrder?.customerName || 'In-Store Customer',
      payerBank:
        payerBank ||
        (paymentMethod === 'pos_terminal'
          ? 'Moniepoint / Store POS'
          : paymentMethod === 'bank_transfer'
          ? 'Zenith / GTBank Transfer'
          : 'Card Terminal'),
      terminalSerial: terminalSerial || (paymentMethod === 'pos_terminal' ? 'MP-8923011' : undefined),
      status: autoReconcile ? 'paid' : 'reconciliation_required',
      reconciliationStatus: autoReconcile ? 'reconciled' : 'pending',
      verificationSource: autoReconcile ? 'staff_terminal_sync' : 'pending_review',
      reconciledByStaffId: autoReconcile ? staff.id : undefined,
      reconciledByName: autoReconcile ? staff.name : undefined,
      verifiedAt: autoReconcile ? now : undefined,
      notes: notes || 'Logged via Physical Store Payment Synchronisation Hub',
      createdAt: now,
      updatedAt: now,
    };

    db.paymentTransactions[txRef] = tx;

    if (matchedOrder && autoReconcile) {
      matchedOrder.paymentStatus = 'paid';
      matchedOrder.paymentReference = txRef;
      matchedOrder.paymentVerificationSource = 'staff_terminal_sync';
      matchedOrder.paidAt = now;
      matchedOrder.updatedAt = now;
      awardOrderLoyaltyPointsIfEligible(db, matchedOrder, now);
    }

    saveDatabaseSync();
    logAuditEvent(
      staff.name,
      staff.role,
      tx.branchId,
      'STORE_PAYMENT_SYNCHRONISED',
      `Synchronised ${paymentMethod} payment ref '${txRef}' (₦${cleanAmount.toLocaleString()}) for ${tx.orderNumber}`
    );

    return res.json({
      success: true,
      message: `Synchronised ${paymentMethod.replace('_', ' ')} transaction ${txRef} (₦${cleanAmount.toLocaleString()})`,
      transaction: tx,
    });
  });

  // 3. POST /api/reconciliation/match - Reconcile a single payment or external terminal transaction
  router.post('/api/reconciliation/match', async (req: Request, res: Response) => {
    const db = getDb();
    const session = await getSessionFromRequest(req);
    const staff = session ? await staffRepository.getById(session.staffId) : null;

    if (!staff) {
      return res.status(401).json({ error: 'Authentication required to reconcile payments.' });
    }

    if (!(await hasPermission(staff, 'accounting.reconcile')) && !['accountant', 'branch_manager', 'corporate_admin', 'super_admin', 'admin', 'cashier'].includes(staff.role)) {
      return res.status(403).json({ error: 'Forbidden: Role not authorized to reconcile payments.' });
    }

    const { reference, orderNumber, decision = 'confirm', notes, terminalSerial, bankRef } = req.body || {};
    if (!reference) {
      return res.status(400).json({ error: 'Transaction reference is required for reconciliation.' });
    }

    const now = new Date().toISOString();
    db.paymentTransactions = db.paymentTransactions || {};

    let tx = db.paymentTransactions[reference];
    let order = tx?.orderId ? db.orders?.[tx.orderId] : undefined;

    if (!order && orderNumber) {
      order = Object.values(db.orders || {}).find((o: any) => o.orderNumber === orderNumber);
    }

    if (!order) {
      order = Object.values(db.orders || {}).find(
        (o: any) => o.paymentReference === reference || o.transferSubmission?.transferReference === reference
      );
    }

    if (!tx) {
      tx = {
        reference,
        orderId: order?.id || null,
        orderNumber: order?.orderNumber || orderNumber || 'MANUAL-REC',
        branchId: order?.branchId || staff.branchId || 'gra',
        amountNaira: Number(order?.total || 0),
        amountKobo: Math.round(Number(order?.total || 0) * 100),
        currency: 'NGN',
        paymentMethod: order?.paymentMethod || 'bank_transfer',
        status: 'pending',
        createdAt: now,
      };
      db.paymentTransactions[reference] = tx;
    }

    if (decision === 'reject') {
      tx.status = 'failed';
      tx.reconciliationStatus = 'rejected';
      tx.reconciledByStaffId = staff.id;
      tx.reconciledByName = staff.name;
      tx.notes = notes || 'Payment rejected during financial reconciliation';
      tx.updatedAt = now;

      if (order) {
        order.paymentStatus = 'failed';
        order.updatedAt = now;
        if (order.transferSubmission) {
          order.transferSubmission.reconciliationStatus = 'rejected';
          order.transferSubmission.reconciledByStaffId = staff.id;
          order.transferSubmission.reconciledByName = staff.name;
          order.transferSubmission.reconciledAt = now;
          order.transferSubmission.notes = notes || 'Rejected by finance';
        }
      }

      saveDatabaseSync();
      logAuditEvent(
        staff.name,
        staff.role,
        tx.branchId || staff.branchId,
        'PAYMENT_RECONCILIATION_REJECTED',
        `Rejected payment ref '${reference}' (Order #${tx.orderNumber}). Notes: ${tx.notes}`
      );

      return res.json({
        success: true,
        message: `Payment reference '${reference}' rejected.`,
        transaction: tx,
      });
    }

    // Confirm Reconciliation
    tx.status = 'paid';
    tx.reconciliationStatus = 'reconciled';
    tx.verificationSource = 'finance_reconciliation';
    tx.reconciledByStaffId = staff.id;
    tx.reconciledByName = staff.name;
    tx.verifiedAt = now;
    tx.updatedAt = now;
    if (terminalSerial) tx.terminalSerial = terminalSerial;
    if (bankRef) tx.bankRef = bankRef;
    if (notes) tx.notes = notes;

    if (order) {
      order.paymentStatus = 'paid';
      order.paymentReference = reference;
      order.paymentVerificationSource = 'finance_reconciliation';
      order.paidAt = now;
      order.updatedAt = now;

      if (order.transferSubmission) {
        order.transferSubmission.reconciliationStatus = 'confirmed';
        order.transferSubmission.reconciledByStaffId = staff.id;
        order.transferSubmission.reconciledByName = staff.name;
        order.transferSubmission.reconciledAt = now;
        order.transferSubmission.notes = notes || 'Confirmed by finance reconciliation';
      }

      const checkId = `chk-${order.id}`;
      if (db.checks?.[checkId]) {
        db.checks[checkId].paymentStatus = 'paid';
        db.checks[checkId].status = 'paid';
        db.checks[checkId].paidAt = now;
        db.checks[checkId].settledByStaffId = staff.id;
        db.checks[checkId].settledByName = staff.name;
      }

      awardOrderLoyaltyPointsIfEligible(db, order, now);
    }

    saveDatabaseSync();
    logAuditEvent(
      staff.name,
      staff.role,
      tx.branchId || staff.branchId,
      'PAYMENT_RECONCILIATION_CONFIRMED',
      `Reconciled & confirmed payment ref '${reference}' for Order #${tx.orderNumber} (₦${Number(tx.amountNaira || order?.total || 0).toLocaleString()})`
    );

    return res.json({
      success: true,
      message: `Payment reference '${reference}' successfully reconciled and marked paid.`,
      transaction: tx,
      order,
    });
  });

  // 4. POST /api/reconciliation/auto-match - Automated rule-based reconciliation for pending bank transfers and card payments
  router.post('/api/reconciliation/auto-match', async (req: Request, res: Response) => {
    const db = getDb();
    const session = await getSessionFromRequest(req);
    const staff = session ? db.staff?.[session.staffId] : null;

    if (!staff) {
      return res.status(401).json({ error: 'Authentication required for auto-matching.' });
    }

    if (!(await hasPermission(staff, 'accounting.reconcile')) && !['accountant', 'branch_manager', 'corporate_admin', 'super_admin', 'admin', 'cashier'].includes(staff.role)) {
      return res.status(403).json({ error: 'Forbidden: Role not authorized to run auto-match.' });
    }

    syncOperationalTransactionsToLedger(db);

    const now = new Date().toISOString();
    let matchedCount = 0;
    const matchedRefs: string[] = [];

    const ordersPending = Object.values(db.orders || {}).filter(
      (o: any) => o.paymentStatus === 'reconciliation_required' && o.transferSubmission?.transferReference
    ) as any[];

    db.paymentTransactions = db.paymentTransactions || {};

    for (const order of ordersPending) {
      const ref = order.transferSubmission.transferReference.trim();
      if (ref && ref.length >= 4) {
        order.paymentStatus = 'paid';
        order.paymentVerificationSource = 'auto_reconciliation_rules';
        order.paidAt = now;
        order.updatedAt = now;
        order.transferSubmission.reconciliationStatus = 'confirmed';
        order.transferSubmission.reconciledByStaffId = staff.id;
        order.transferSubmission.reconciledByName = `${staff.name} (Auto-Match Engine)`;
        order.transferSubmission.reconciledAt = now;
        order.transferSubmission.notes = 'Matched via Rule: Valid Bank Session ID Pattern';

        if (db.paymentTransactions[ref]) {
          db.paymentTransactions[ref].status = 'paid';
          db.paymentTransactions[ref].reconciliationStatus = 'reconciled';
          db.paymentTransactions[ref].verificationSource = 'auto_reconciliation_rules';
          db.paymentTransactions[ref].updatedAt = now;
        }

        awardOrderLoyaltyPointsIfEligible(db, order, now);
        matchedCount++;
        matchedRefs.push(ref);
      }
    }

    // Also reconcile pending transactions in db.paymentTransactions with valid reference codes
    for (const tx of Object.values(db.paymentTransactions) as any[]) {
      if (
        (tx.status === 'reconciliation_required' || tx.status === 'pending') &&
        tx.reference &&
        String(tx.reference).trim().length >= 4 &&
        !matchedRefs.includes(tx.reference)
      ) {
        tx.status = 'paid';
        tx.reconciliationStatus = 'reconciled';
        tx.verificationSource = 'auto_reconciliation_rules';
        tx.reconciledByStaffId = staff.id;
        tx.reconciledByName = `${staff.name} (Auto-Match Engine)`;
        tx.verifiedAt = now;
        tx.updatedAt = now;
        matchedCount++;
        matchedRefs.push(tx.reference);
      }
    }

    saveDatabaseSync();
    logAuditEvent(
      staff.name,
      staff.role,
      staff.branchId || 'gra',
      'AUTO_RECONCILIATION_EXECUTED',
      `Auto-match engine executed by ${staff.name}. Reconciled ${matchedCount} pending transaction(s).`
    );

    return res.json({
      success: true,
      matchedCount,
      matchedRefs,
      message: `Auto-reconciliation rules complete. Matched ${matchedCount} pending transaction(s).`,
    });
  });

  return router;
}
