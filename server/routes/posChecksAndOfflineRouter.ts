import { Router } from 'express';
import crypto from 'crypto';
import {
  verifyWalletPin,
  calculateLoyaltyPoints,
} from '../../server_db.ts';
import type {
  DbDatabase,
  DbStaffAccount,
  DbCheck,
  DbCheckItem,
} from '../../server_db.ts';
import {
  createOrderInventoryDepleter,
  createOrderInventoryReverser,
  createPosOfflineAndTableTransferRouter,
} from '../services/posInventoryAndOfflineService.ts';
import {
  calculateAuthoritativeItemAndOrderPricing,
  calculateDefaultPackagingForItems,
} from '../services/packageAndPricingEngine.ts';
import { supervisorAuthService } from '../services/supervisorAuthService';

export { createOrderInventoryDepleter, createOrderInventoryReverser };

// Removed: verifySupervisorPinForBranch legacy helper.


export function getNextLiveCheckNumber(db: DbDatabase): string {
  const liveChecks = Object.values(db.checks || {}).filter(
    (c: any) => !c?.isHistoricalMigrated && c?.legacySourceSystem !== 'ezee_optimus'
  );
  let maxSeq = liveChecks.length;
  for (const c of liveChecks) {
    const m = String(c?.checkNumber || '').match(/^CHK-(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
    }
  }
  return `CHK-${String(maxSeq + 1).padStart(5, '0')}`;
}

export function buildDeterministicEqualShares(
  totalToSplit: number,
  ways: number,
  existingPaidShares: any[] = []
) {
  const cleanWays = Math.max(1, Math.min(20, Math.floor(Number(ways) || 1)));
  const paidSum = existingPaidShares.reduce((s, sh) => s + Number(sh.paidAmount || 0), 0);
  const remainingPool = Math.max(0, Math.round(totalToSplit - paidSum));
  const unpaidCount = Math.max(1, cleanWays - existingPaidShares.length);
  const baseShare = Math.floor(remainingPool / unpaidCount);
  const remainder = remainingPool - baseShare * unpaidCount;

  const shares: any[] = [...existingPaidShares];
  for (let i = 0; i < unpaidCount; i++) {
    const shareIdx = shares.length + 1;
    const alloc = i === 0 ? baseShare + remainder : baseShare;
    shares.push({
      shareId: `shr-${shareIdx}`,
      shareIndex: shareIdx,
      label: cleanWays === 1 ? `Guest 1 (Full Bill)` : `Guest ${shareIdx}`,
      allocatedAmount: alloc,
      paidAmount: 0,
      remainingAmount: alloc,
      status: 'unpaid',
      paymentRefs: [],
    });
  }
  return shares;
}

export function createPosChecksAndOfflineRouter(deps: {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  requireAuth: any;
  requireBranchAccess: any;
  depleteInventoryForOrder: (
    items: DbCheckItem[],
    branchId: string,
    orderRef: string,
    staff: DbStaffAccount
  ) => void;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    details: string,
    metadata?: Record<string, any>
  ) => void;
  reverseInventoryForOrder?: (
    orderRef: string,
    branchId: string,
    staff: any,
    reason?: string
  ) => any;
  staffRepository?: any;
}): Router {
  const router = Router();
  const {
    getDb,
    saveDatabaseSync,
    requireAuth,
    requireBranchAccess,
    depleteInventoryForOrder,
    logAuditEvent,
    reverseInventoryForOrder,
  } = deps;

  router.get('/api/pos/checks', requireAuth, requireBranchAccess, (req, res) => {
    const db = getDb();
    const { branchId, status, includeHistorical } = req.query;
    let list = Object.values(db.checks);

    if (includeHistorical !== 'true') {
      list = list.filter((c: any) => !c.isHistoricalMigrated);
    }
    if (branchId && branchId !== 'all') {
      list = list.filter((c) => c.branchId === branchId);
    }
    if (status) {
      list = list.filter((c) => c.status === status);
    }

    res.json(list.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()));
  });

  router.get('/api/pos/checks/:id', requireAuth, (req, res) => {
    const db = getDb();
    const currentStaff = (req as any).staff as DbStaffAccount;
    const check = db.checks[req.params.id];
    if (!check) return res.status(404).json({ error: 'Check not found.' });

    const isGlobalStaff = ['super_admin', 'corporate_admin', 'auditor'].includes(currentStaff.role);
    if (!isGlobalStaff && check.branchId !== currentStaff.branchId) {
      return res.status(403).json({ error: 'Access denied: Check belongs to another branch.' });
    }

    res.json(check);
  });

  router.post('/api/pos/checks', requireAuth, async (req, res) => {
    const db = getDb();
    const currentStaff = (req as any).staff as DbStaffAccount;
    if (currentStaff.role === 'auditor') {
      return res.status(403).json({ error: 'Access denied: Auditor role is strictly read-only.' });
    }
    const isGlobal = ['super_admin', 'corporate_admin', 'auditor'].includes(currentStaff.role);
    const targetBranch = isGlobal ? (req.body.branchId || currentStaff.branchId) : currentStaff.branchId;

    const {
      id,
      tableId,
      tableNumber,
      checkType,
      orderType,
      customerName = 'Walk-in Customer',
      customerPhone,
      guestCount = 1,
      items = [],
      discountAmount = 0,
      discountPercent = 0,
      discountReason,
      supervisorPin,
      packagingFee,
      customPackagingSkuId,
      requestCustomPackagingApproval = false,
      deliveryFee = 0,
      deliveryAddress,
      deliveryZone,
      landmark,
      riderId,
      riderName,
      notes,
      amendPaidCheck = false,
    } = req.body;

    const existingCheck = id ? db.checks[id] : undefined;
    const isManager = ['store_manager', 'branch_manager', 'super_admin', 'corporate_admin'].includes(currentStaff.role);

    if (existingCheck && (existingCheck.status === 'paid' || existingCheck.paymentStatus === 'paid')) {
      if (!amendPaidCheck) {
        return res.status(409).json({
          error: `Check ${existingCheck.checkNumber} is already paid and cannot be modified without supervisor amendment authorization.`,
        });
      }
      const supervisor = isManager
        ? currentStaff
        : await supervisorAuthService.verifySupervisorPin(currentStaff, targetBranch, supervisorPin, 'pos.check.amend', logAuditEvent);
      if (!supervisor) {
        return res.status(403).json({
          error: 'Amending a paid check requires a Manager role or valid Supervisor PIN.',
        });
      }
    }

    // Reject inactive/paused products before creating or updating check
    db.menuProducts = db.menuProducts || {};
    for (const it of items) {
      const rawLookupId = String(it.productId || it.menuItemId || it.id || '').trim();
      const catalogProduct =
        db.menuProducts[rawLookupId] ||
        Object.values(db.menuProducts).find(
          (mp) => mp.id === rawLookupId || (it.name && mp.name.toLowerCase() === String(it.name).trim().toLowerCase())
        );

      if (catalogProduct && ((catalogProduct.status && catalogProduct.status !== 'published') || (catalogProduct as any).isActive === false)) {
        return res.status(400).json({
          error: `Item '${catalogProduct.name}' is currently inactive (${catalogProduct.status || 'paused'}) and unavailable for ordering.`,
        });
      }
    }

    // Mandatory Order-Type Validation
    const rawOrderType = String(checkType || orderType || existingCheck?.checkType || '').trim().toLowerCase();
    const normalizedTypeMap: Record<string, 'dine_in' | 'takeaway' | 'delivery'> = {
      dine_in: 'dine_in',
      'dine-in': 'dine_in',
      dinein: 'dine_in',
      takeaway: 'takeaway',
      takeout: 'takeaway',
      pickup: 'takeaway',
      delivery: 'delivery',
    };
    const resolvedCheckType = normalizedTypeMap[rawOrderType];
    if (!resolvedCheckType) {
      return res.status(400).json({
        error: "Order type selection is mandatory before creating a check: choose 'dine_in', 'takeaway' (or 'pickup'), or 'delivery'.",
      });
    }

    const checkId = id || `chk-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const isNew = !db.checks[checkId];

    // Dine-in Table Availability & Association Enforcement
    let resolvedTableId: string | undefined = undefined;
    let resolvedTableNumber: string | undefined = undefined;

    if (resolvedCheckType === 'dine_in') {
      const requestedTableId = String(tableId || existingCheck?.tableId || '').trim();
      const requestedTableNum = String(tableNumber || existingCheck?.tableNumber || '').trim();
      if (!requestedTableId && !requestedTableNum) {
        return res.status(400).json({
          error: 'Dine-in orders require selecting an available table before proceeding.',
        });
      }

      const branchTables = Object.values(db.tables || {}).filter((t: any) => t.branchId === targetBranch);
      const cleanRequestedNum = requestedTableNum.replace(/^table\s*/i, '').trim().toLowerCase();

      const matchedTable: any =
        (requestedTableId && db.tables[requestedTableId] && db.tables[requestedTableId].branchId === targetBranch
          ? db.tables[requestedTableId]
          : null) ||
        branchTables.find((t: any) => {
          const tNumClean = String(t.tableNumber || '').replace(/^table\s*/i, '').trim().toLowerCase();
          return (
            t.id === requestedTableId ||
            String(t.tableNumber || '').toLowerCase() === requestedTableNum.toLowerCase() ||
            `table ${tNumClean}` === requestedTableNum.toLowerCase() ||
            (cleanRequestedNum && tNumClean === cleanRequestedNum)
          );
        });

      if (!matchedTable) {
        return res.status(400).json({
          error: `Selected table '${requestedTableNum || requestedTableId}' was not found in branch '${targetBranch}'. Please choose a valid dining table.`,
        });
      }

      // Check if table is occupied by another open check or marked unavailable
      const isSameCheckOnTable =
        matchedTable.currentCheckId === checkId ||
        (existingCheck && existingCheck.tableId === matchedTable.id);

      const conflictingOpenCheck = Object.values(db.checks || {}).find(
        (c: any) =>
          c.id !== checkId &&
          c.branchId === targetBranch &&
          c.checkType === 'dine_in' &&
          (c.status === 'open' || c.status === 'sent_to_kitchen' || c.status === 'partially_paid') &&
          !c.isHistoricalMigrated &&
          (c.tableId === matchedTable.id ||
            (c.tableNumber &&
              String(c.tableNumber).replace(/^table\s*/i, '').trim().toLowerCase() ===
                String(matchedTable.tableNumber).replace(/^table\s*/i, '').trim().toLowerCase()))
      );

      if ((!isSameCheckOnTable && matchedTable.status !== 'available') || conflictingOpenCheck) {
        return res.status(409).json({
          error: `Table ${matchedTable.tableNumber} is currently occupied or unavailable (${conflictingOpenCheck ? `Active Check ${conflictingOpenCheck.checkNumber}` : matchedTable.status}). Please select an available table.`,
        });
      }

      // If switching tables on an existing check, release previous table
      if (existingCheck?.tableId && existingCheck.tableId !== matchedTable.id && db.tables[existingCheck.tableId]) {
        db.tables[existingCheck.tableId].status = 'available';
        db.tables[existingCheck.tableId].currentCheckId = undefined;
        db.tables[existingCheck.tableId].guestCount = 0;
        db.tables[existingCheck.tableId].updatedAt = new Date().toISOString();
      }

      resolvedTableId = matchedTable.id;
      resolvedTableNumber = String(matchedTable.tableNumber).toLowerCase().startsWith('table')
        ? matchedTable.tableNumber
        : `Table ${matchedTable.tableNumber}`;
    } else {
      // Takeaway or Delivery: never occupy a dining table; release old table if converted from dine-in
      if (existingCheck?.tableId && db.tables[existingCheck.tableId]) {
        db.tables[existingCheck.tableId].status = 'available';
        db.tables[existingCheck.tableId].currentCheckId = undefined;
        db.tables[existingCheck.tableId].guestCount = 0;
        db.tables[existingCheck.tableId].updatedAt = new Date().toISOString();
      }
      resolvedTableId = undefined;
      resolvedTableNumber = undefined;
    }

    const pricingCalc = calculateAuthoritativeItemAndOrderPricing(db, items, {
      branchId: targetBranch,
      channel: 'pos',
      orderDiscountPercent: discountPercent,
      orderDiscountAmount: discountAmount,
    });

    if (pricingCalc.validationErrors.length > 0) {
      return res.status(400).json({
        error: pricingCalc.validationErrors.join(' '),
        errors: pricingCalc.validationErrors,
      });
    }

    const validatedItems = pricingCalc.items;
    const subtotal = pricingCalc.subtotalAfterItemDiscounts;

    const supervisorForPackaging = isManager ? currentStaff : await supervisorAuthService.verifySupervisorPin(currentStaff, targetBranch, supervisorPin, 'pos.packaging.override', logAuditEvent);
    const hasCustomPackagingRequest = Boolean(customPackagingSkuId) || packagingFee !== undefined;
    const isCustomPackagingApproved = Boolean(supervisorForPackaging) && hasCustomPackagingRequest;

    const packagingCalc = calculateDefaultPackagingForItems(db, validatedItems, {
      orderType: resolvedCheckType,
      customPackagingFee:
        isCustomPackagingApproved && packagingFee !== undefined
          ? Number(packagingFee)
          : packagingFee !== undefined && !requestCustomPackagingApproval
          ? Number(packagingFee)
          : undefined,
      customPackagingSkuId: isCustomPackagingApproved ? customPackagingSkuId : undefined,
    });

    const packagingRequirementStatus: 'STANDARD' | 'AWAITING_PACKAGING_APPROVAL' | 'CUSTOM_APPROVED' =
      requestCustomPackagingApproval && !isCustomPackagingApproved
        ? 'AWAITING_PACKAGING_APPROVAL'
        : isCustomPackagingApproved
        ? 'CUSTOM_APPROVED'
        : ((existingCheck as any)?.packagingRequirementStatus || 'STANDARD');

    const validPackagingFee = packagingCalc.packagingFee;
    const validDeliveryFee = resolvedCheckType === 'delivery' ? Math.max(0, Number(deliveryFee) || 0) : 0;

    const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
    const amt = pricingCalc.orderDiscountAmount;

    if ((pct > 10 || amt > 2000) && !isManager) {
      const supervisor = await supervisorAuthService.verifySupervisorPin(currentStaff, targetBranch, supervisorPin, 'pos.discount.override', logAuditEvent);

      if (!supervisor) {
        return res.status(403).json({
          error: 'Discounts exceeding 10% or ₦2,000 require a valid Manager Supervisor PIN.',
        });
      }

      logAuditEvent(
        supervisor.name,
        supervisor.role,
        targetBranch,
        'DISCOUNT_OVERRIDE_APPROVED',
        `Manager approved ${pct}% (₦${amt.toLocaleString()}) discount on check for ${customerName}. Reason: ${discountReason || 'VIP courtesy'}`
      );
    }

    const total = Math.max(0, subtotal - amt + validPackagingFee + validDeliveryFee);
    const existingPaid = Number(existingCheck?.amountPaid || 0);
    if (existingPaid > total && !amendPaidCheck) {
      return res.status(400).json({
        error: `Cannot reduce check total (₦${total.toLocaleString()}) below amount already paid (₦${existingPaid.toLocaleString()}).`,
      });
    }

    const remainingBalance = Math.max(0, total - existingPaid);
    const isAlreadySettled = existingCheck && (existingCheck.status === 'paid' || existingCheck.paymentStatus === 'paid');

    const check: DbCheck = {
      ...(existingCheck || {}),
      id: checkId,
      checkNumber: existingCheck?.checkNumber || getNextLiveCheckNumber(db),
      branchId: targetBranch,
      tableId: resolvedTableId,
      tableNumber: resolvedTableNumber,
      checkType: resolvedCheckType,
      status: isAlreadySettled && remainingBalance === 0
        ? 'paid'
        : existingPaid > 0 && remainingBalance > 0
        ? 'partially_paid'
        : (existingCheck?.status || 'open'),
      customerName: customerName || (resolvedCheckType === 'delivery' ? 'Delivery Customer' : resolvedCheckType === 'takeaway' ? 'Takeaway Customer' : 'Walk-in Customer'),
      customerPhone: customerPhone || (existingCheck as any)?.customerPhone,
      guestCount: Math.max(1, Number(guestCount) || 1),
      items: validatedItems,
      subtotal,
      discountAmount: amt,
      discountPercent: pct,
      discountReason: discountReason || (pricingCalc.itemLevelDiscountTotal > 0 ? 'Package/Tier Discount' : undefined),
      packagingFee: validPackagingFee,
      deliveryFee: validDeliveryFee,
      total,
      amountPaid: existingPaid,
      remainingBalance,
      paymentStatus: isAlreadySettled && remainingBalance === 0
        ? 'paid'
        : existingPaid > 0 && remainingBalance > 0
        ? 'partially_paid'
        : (existingCheck?.paymentStatus || 'unpaid'),
      openedAt: existingCheck?.openedAt || new Date().toISOString(),
      openedByStaffId: existingCheck?.openedByStaffId || currentStaff.id,
      openedByName: existingCheck?.openedByName || currentStaff.name,
      notes,
    };
    (check as any).packagingSkuId = packagingCalc.packagingSkuId;
    (check as any).packagingQuantity = packagingCalc.packagingQuantity;
    (check as any).packagingRequirementStatus = packagingRequirementStatus;
    (check as any).grossSubtotalBeforeItemDiscounts = pricingCalc.grossSubtotalBeforeItemDiscounts;
    (check as any).itemLevelDiscountTotal = pricingCalc.itemLevelDiscountTotal;
    (check as any).appliedPromotions = pricingCalc.appliedPromotions;
    if (existingPaid > total) {
      (check as any).overpaidRefundDue = existingPaid - total;
    }

    if (resolvedCheckType === 'delivery') {
      (check as any).deliveryAddress = deliveryAddress ?? (existingCheck as any)?.deliveryAddress ?? '';
      (check as any).deliveryZone = deliveryZone ?? (existingCheck as any)?.deliveryZone ?? 'Standard';
      (check as any).landmark = landmark ?? (existingCheck as any)?.landmark ?? '';
      if (riderId !== undefined) (check as any).riderId = riderId;
      if (riderName !== undefined) (check as any).riderName = riderName;
    }

    if (check.splitConfig && Array.isArray(check.splitConfig.shares)) {
      const paidShares = check.splitConfig.shares.filter((sh) => sh.status === 'paid' || sh.paidAmount > 0);
      check.splitConfig.shares = buildDeterministicEqualShares(
        total,
        Math.max(check.splitConfig.guestCount || 2, paidShares.length + 1),
        paidShares
      );
      check.splitConfig.updatedAt = new Date().toISOString();
    }

    // If amending an already-depleted check, reverse previous BOM depletion and re-deplete with final confirmed quantities
    if (amendPaidCheck && existingCheck && (existingCheck.inventoryDepletedAt || (db as any).processedDepletionRefs?.[existingCheck.checkNumber])) {
      if (typeof reverseInventoryForOrder === 'function') {
        reverseInventoryForOrder(existingCheck.checkNumber, targetBranch, currentStaff, 'Post-payment quantity amendment');
      }
      depleteInventoryForOrder(validatedItems, targetBranch, check.checkNumber, currentStaff);
      check.inventoryDepletedAt = new Date().toISOString();
    }

    db.checks[checkId] = check;

    if (resolvedCheckType === 'dine_in' && resolvedTableId && db.tables[resolvedTableId]) {
      if (check.status !== 'paid') {
        db.tables[resolvedTableId].status = 'ordering';
        db.tables[resolvedTableId].currentCheckId = checkId;
        db.tables[resolvedTableId].guestCount = check.guestCount;
        db.tables[resolvedTableId].updatedAt = new Date().toISOString();
      }
    }

    // If this is a delivery check with items or rider info, synchronize delivery task so rider can be assigned even before meal is ready
    if (resolvedCheckType === 'delivery' && (validatedItems.length > 0 || riderId || deliveryAddress)) {
      const isWholesaleBread =
        Boolean(req.body.isWholesaleDelivery) ||
        validatedItems.some((it: any) => Boolean(it.isWholesaleApplied));
      const existingTask = db.deliveryTasks[checkId];
      const nowIso = new Date().toISOString();
      const pickupPin = existingTask?.pickupAuthorizationCode || String(Math.floor(1000 + Math.random() * 9000));
      const nextRiderId = riderId || existingTask?.riderId;
      const nextRiderName = riderName || existingTask?.riderName || (nextRiderId && db.riders[nextRiderId]?.name);
      const taskRecord: any = {
        ...(existingTask || {}),
        id: checkId,
        orderId: check.orderId || checkId,
        checkId: check.id,
        orderNumber: check.checkNumber,
        branchId: targetBranch,
        customerName: check.customerName || 'Delivery Customer',
        customerPhone: check.customerPhone || '0800-000-0000',
        deliveryAddress: (check as any).deliveryAddress || 'Pending Delivery Address',
        deliveryZone: (check as any).deliveryZone || 'Standard',
        landmark: (check as any).landmark || '',
        orderTotal: check.total,
        paymentMethod: check.paymentStatus === 'paid' ? (check.paymentMethod || 'pos_terminal') : 'cash_on_delivery',
        paymentStatus: check.paymentStatus,
        codAmountDue: check.paymentStatus === 'paid' ? 0 : check.remainingBalance,
        codAmountCollected: existingTask?.codAmountCollected || 0,
        status: existingTask?.status && existingTask.status !== 'pending'
          ? existingTask.status
          : nextRiderId
          ? 'assigned'
          : 'pending',
        riderId: nextRiderId,
        riderName: nextRiderName,
        assignedAt: nextRiderId ? (existingTask?.assignedAt || nowIso) : existingTask?.assignedAt,
        cashReconciled: existingTask?.cashReconciled || false,
        pickupAuthorizationCode: pickupPin,
        notes: check.notes || '',
        dispatchType: isWholesaleBread ? 'wholesale_bread' : 'restaurant_meal',
        isWholesaleBread,
        itemsSummary: validatedItems.map((it: any) => ({
          productId: it.productId,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          isWholesaleApplied: Boolean(it.isWholesaleApplied),
        })),
      };
      db.deliveryTasks[checkId] = taskRecord;
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      isNew ? 'ORDER_CREATED' : 'ORDER_EDITED',
      `${isNew ? 'Opened' : 'Updated'} check ${check.checkNumber} (${check.tableNumber || check.checkType}) Total: ₦${total}`
    );

    res.json({ success: true, check });
  });

  // Supervisor / Manager Custom Packaging Override on a POS Check
  router.post('/api/pos/checks/:id/packaging-override', requireAuth, async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { customPackagingSkuId, customPackagingFee, supervisorPin, reason = 'Manager packaging override' } = req.body || {};
    const currentStaff = (req as any).staff as DbStaffAccount;
    const check = db.checks[id];
    if (!check) return res.status(404).json({ error: 'Check not found.' });

    const isManager = ['store_manager', 'branch_manager', 'super_admin', 'corporate_admin'].includes(currentStaff.role);
    const supervisor = isManager ? currentStaff : await supervisorAuthService.verifySupervisorPin(currentStaff, check.branchId, supervisorPin, 'pos.packaging.override', logAuditEvent);
    if (!supervisor) {
      return res.status(403).json({
        error: 'Custom packaging override requires Manager role or a valid Supervisor PIN.',
      });
    }

    const packagingCalc = calculateDefaultPackagingForItems(db, check.items || [], {
      orderType: check.checkType,
      customPackagingSkuId,
      customPackagingFee: customPackagingFee !== undefined ? Number(customPackagingFee) : undefined,
    });

    const now = new Date().toISOString();
    check.packagingFee = packagingCalc.packagingFee;
    (check as any).packagingSkuId = packagingCalc.packagingSkuId;
    (check as any).packagingQuantity = packagingCalc.packagingQuantity;
    (check as any).packagingRequirementStatus = 'CUSTOM_APPROVED';
    (check as any).packagingApprovedBy = supervisor.name;
    (check as any).packagingApprovedAt = now;
    check.total = Math.max(0, Number(check.subtotal || 0) - Number(check.discountAmount || 0) + packagingCalc.packagingFee + Number(check.deliveryFee || 0));
    check.remainingBalance = Math.max(0, check.total - Number(check.amountPaid || 0));

    saveDatabaseSync();
    logAuditEvent(
      supervisor.name,
      supervisor.role,
      check.branchId,
      'PACKAGING_OVERRIDE_APPROVED',
      `Approved custom packaging (${packagingCalc.packagingSkuName} @ ₦${packagingCalc.packagingFee.toLocaleString()}) on check ${check.checkNumber}. Reason: ${reason}`
    );

    return res.json({ success: true, check, packagingCalc });
  });

  // Direct Quantity Entry & Post-Payment Quantity Amendment Endpoint
  router.put('/api/pos/checks/:id/items/:itemId/quantity', requireAuth, async (req, res) => {
    const db = getDb();
    const { id, itemId } = req.params;
    const { quantity, supervisorPin, reason } = req.body;
    const currentStaff = (req as any).staff as DbStaffAccount;
    if (currentStaff.role === 'auditor') {
      return res.status(403).json({ error: 'Access denied: Auditor role is strictly read-only.' });
    }

    const check = db.checks[id];
    if (!check) return res.status(404).json({ error: 'Check not found.' });

    const parsedQty = Number(quantity);
    if (
      quantity === undefined ||
      quantity === null ||
      String(quantity).trim() === '' ||
      !Number.isFinite(parsedQty) ||
      parsedQty < 0 ||
      !Number.isInteger(parsedQty) ||
      parsedQty > 10000
    ) {
      return res.status(400).json({
        error: `Invalid quantity '${quantity}': must be a whole number between 0 and 10,000.`,
      });
    }

    const isPaid = check.status === 'paid' || check.paymentStatus === 'paid';
    const isManager = ['store_manager', 'branch_manager', 'super_admin', 'corporate_admin'].includes(currentStaff.role);
    if (isPaid && !isManager) {
      const supervisor = await supervisorAuthService.verifySupervisorPin(currentStaff, check.branchId, supervisorPin, 'pos.quantity.amend', logAuditEvent);
      if (!supervisor) {
        return res.status(403).json({
          error: 'Modifying item quantities on an already-paid check requires Manager role or valid Supervisor PIN.',
        });
      }
    }

    const paidItems = (check.items || []).filter((it: any) => !it.isPromoReward);
    const targetIdx = paidItems.findIndex((it: any) => it.id === itemId || it.productId === itemId);
    if (targetIdx === -1) {
      return res.status(404).json({ error: `Item '${itemId}' not found on check ${check.checkNumber}.` });
    }

    const oldQty = paidItems[targetIdx].quantity;
    const itemName = paidItems[targetIdx].name;

    if (parsedQty === 0) {
      if (isPaid && paidItems.length <= 1) {
        return res.status(400).json({
          error: 'Cannot remove the last item on a paid check via quantity entry; use check void/refund instead.',
        });
      }
      paidItems.splice(targetIdx, 1);
    } else {
      paidItems[targetIdx] = {
        ...paidItems[targetIdx],
        quantity: parsedQty,
      };
    }

    const pricingCalc = calculateAuthoritativeItemAndOrderPricing(db, paidItems, {
      branchId: check.branchId,
      channel: 'pos',
      orderDiscountPercent: check.discountPercent || 0,
      orderDiscountAmount: check.discountAmount || 0,
    });

    if (pricingCalc.validationErrors.length > 0) {
      return res.status(400).json({
        error: pricingCalc.validationErrors.join(' '),
        errors: pricingCalc.validationErrors,
      });
    }

    const subtotal = pricingCalc.subtotalAfterItemDiscounts;
    const amt = pricingCalc.orderDiscountAmount;

    // Recompute packaging fee dynamically unless custom packaging was explicitly approved
    if ((check as any).packagingRequirementStatus !== 'CUSTOM_APPROVED') {
      const packCalc = calculateDefaultPackagingForItems(db, pricingCalc.items, {
        orderType: check.checkType,
      });
      check.packagingFee = packCalc.packagingFee;
      (check as any).packagingSkuId = packCalc.packagingSkuId;
      (check as any).packagingQuantity = packCalc.packagingQuantity;
    }

    const total = Math.max(0, subtotal - amt + (check.packagingFee || 0) + (check.deliveryFee || 0));
    const existingPaid = Number(check.amountPaid || 0);

    check.items = pricingCalc.items;
    check.subtotal = subtotal;
    check.discountAmount = amt;
    check.total = total;
    (check as any).grossSubtotalBeforeItemDiscounts = pricingCalc.grossSubtotalBeforeItemDiscounts;
    (check as any).itemLevelDiscountTotal = pricingCalc.itemLevelDiscountTotal;
    (check as any).appliedPromotions = pricingCalc.appliedPromotions;

    if (total >= existingPaid) {
      check.remainingBalance = total - existingPaid;
      (check as any).overpaidRefundDue = 0;
      if (existingPaid > 0 && check.remainingBalance > 0) {
        check.status = 'partially_paid';
        check.paymentStatus = 'partially_paid';
      } else if (existingPaid > 0 && check.remainingBalance === 0) {
        check.status = 'paid';
        check.paymentStatus = 'paid';
      }
    } else {
      check.remainingBalance = 0;
      (check as any).overpaidRefundDue = existingPaid - total;
    }

    // If inventory was already depleted on this check, reverse and re-deplete with the final confirmed quantity
    if (check.inventoryDepletedAt || (db as any).processedDepletionRefs?.[check.checkNumber]) {
      if (typeof reverseInventoryForOrder === 'function') {
        reverseInventoryForOrder(
          check.checkNumber,
          check.branchId,
          currentStaff,
          reason || `Quantity updated for ${itemName}: ${oldQty} -> ${parsedQty}`
        );
      }
      depleteInventoryForOrder(check.items, check.branchId, check.checkNumber, currentStaff);
      check.inventoryDepletedAt = new Date().toISOString();
    }

    (check as any).quantityAmendments = Array.isArray((check as any).quantityAmendments)
      ? (check as any).quantityAmendments
      : [];
    (check as any).quantityAmendments.push({
      itemId,
      itemName,
      oldQuantity: oldQty,
      newQuantity: parsedQty,
      newCheckTotal: total,
      amendedWhilePaid: isPaid,
      amendedByStaffId: currentStaff.id,
      amendedByName: currentStaff.name,
      timestamp: new Date().toISOString(),
      reason: reason || 'Direct POS quantity entry',
    });

    // Sync corresponding order and delivery task if present
    const linkedOrder = check.orderId ? db.orders[check.orderId] : Object.values(db.orders || {}).find((o: any) => o.orderNumber === check.checkNumber);
    if (linkedOrder) {
      linkedOrder.items = check.items as any;
      linkedOrder.subtotal = check.subtotal;
      linkedOrder.packagingFee = check.packagingFee;
      linkedOrder.discount = check.discountAmount;
      linkedOrder.total = check.total;
      linkedOrder.updatedAt = new Date().toISOString();
    }
    const linkedTask = db.deliveryTasks[check.id] || (linkedOrder ? db.deliveryTasks[linkedOrder.id] : undefined);
    if (linkedTask) {
      linkedTask.orderTotal = check.total;
      if (linkedTask.paymentMethod === 'cash_on_delivery') {
        linkedTask.codAmountDue = check.remainingBalance;
      }
      (linkedTask as any).itemsSummary = check.items.map((it: any) => ({
        productId: it.productId,
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        isWholesaleApplied: Boolean(it.isWholesaleApplied),
      }));
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      check.branchId,
      isPaid ? 'POST_PAYMENT_QUANTITY_AMENDED' : 'ORDER_EDITED',
      `Updated quantity of '${itemName}' on check ${check.checkNumber} from ${oldQty} to ${parsedQty} (New Total: ₦${total.toLocaleString()})`
    );

    res.json({
      success: true,
      check,
      oldQuantity: oldQty,
      newQuantity: parsedQty,
    });
  });

  // Configure or Re-Calculate Split-Bill Shares on an Active / Partially Paid Check
  router.post('/api/pos/checks/:id/split', requireAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const check = db.checks[id];

    if (!check) return res.status(404).json({ error: 'Check not found.' });
    if (check.status === 'paid' || check.paymentStatus === 'paid') {
      return res.status(409).json({ error: `Check ${check.checkNumber} is already paid in full.` });
    }

    const {
      mode = 'equal',
      guestCount = 1,
      customShares,
      itemAllocations,
      confirmZeroShareWaiver = false,
      zeroWaiverReason = '',
    } = req.body;
    const existingShares = Array.isArray(check.splitConfig?.shares) ? check.splitConfig!.shares : [];
    const lockedPaidShares = existingShares.filter((sh) => sh.paidAmount > 0);
    const alreadyPaidSum = lockedPaidShares.reduce((s, sh) => s + Number(sh.paidAmount || 0), 0);
    const unpaidBalanceToAllocate = Math.max(0, check.total - alreadyPaidSum);

    let newShares: any[] = [];

    if ((mode === 'custom' || mode === 'custom_amount') && Array.isArray(customShares) && customShares.length > 0) {
      const requestedUnpaidSum = customShares.reduce(
        (s: number, c: any) => s + Math.max(0, Math.round(Number(c.amount ?? c.allocatedAmount ?? 0))),
        0
      );
      if (requestedUnpaidSum !== unpaidBalanceToAllocate) {
        return res.status(400).json({
          error: `Custom share amounts sum to ₦${requestedUnpaidSum.toLocaleString()}, which does not equal the remaining unpaid balance of ₦${unpaidBalanceToAllocate.toLocaleString()}.`,
        });
      }

      const zeroShares = customShares.filter((c: any) => Math.round(Number(c.amount ?? c.allocatedAmount ?? 0)) <= 0);
      if (zeroShares.length > 0 && !confirmZeroShareWaiver) {
        return res.status(400).json({
          error: `Zero-value guest share detected (${zeroShares.map((z: any, i: number) => z.label || `Guest ${i + 1}`).join(', ')} has ₦0 allocated). A guest cannot be automatically marked paid with ₦0. Allocate a positive amount, reduce the guest count, or explicitly confirm a Zero-Contribution Waiver.`,
          code: 'ZERO_SHARE_REQUIRES_WAIVER',
          zeroShareCount: zeroShares.length,
        });
      }

      newShares = [
        ...lockedPaidShares,
        ...customShares.map((c: any, idx: number) => {
          const shareIndex = lockedPaidShares.length + idx + 1;
          const alloc = Math.max(0, Math.round(Number(c.amount ?? c.allocatedAmount ?? 0)));
          const isWaivedZero = alloc === 0 && Boolean(confirmZeroShareWaiver);
          return {
            shareId: c.shareId || `shr-${shareIndex}`,
            shareIndex,
            label: c.label || `Guest ${shareIndex}`,
            allocatedAmount: alloc,
            paidAmount: 0,
            remainingAmount: alloc,
            status: isWaivedZero ? 'waived_zero' : 'unpaid',
            waivedZeroMeta: isWaivedZero
              ? {
                  confirmedByStaffId: currentStaff.id,
                  confirmedByName: currentStaff.name,
                  reason: String(zeroWaiverReason || 'Cashier confirmed zero-contribution guest reallocation').trim(),
                  timestamp: new Date().toISOString(),
                }
              : undefined,
            paymentRefs: [],
          };
        }),
      ];
    } else if (mode === 'items' && Array.isArray(itemAllocations) && itemAllocations.length > 0) {
      // Allocate items to guests and distribute packaging/delivery/discounts proportionally
      const rawGuestTotals = itemAllocations.map((g: any) => {
        const itemIds: string[] = Array.isArray(g.itemIds) ? g.itemIds : [];
        const itemsSum = check.items
          .filter((it) => itemIds.includes(it.id))
          .reduce((s, it) => s + Number(it.totalPrice || 0), 0);
        return { label: g.label, itemIds, itemsSum };
      });
      const rawSum = rawGuestTotals.reduce((s, g) => s + g.itemsSum, 0);
      if (rawSum <= 0) {
        return res.status(400).json({ error: 'At least one item must be assigned when splitting by items.' });
      }
      const zeroItemGuests = rawGuestTotals.filter((g) => g.itemsSum <= 0);
      if (zeroItemGuests.length > 0 && !confirmZeroShareWaiver) {
        return res.status(400).json({
          error: `Every guest in an itemized split must have at least one item assigned (${zeroItemGuests.map((z) => z.label).join(', ')} has ₦0). Assign items, reduce the guest count, or confirm a Zero-Contribution Waiver.`,
          code: 'ZERO_SHARE_REQUIRES_WAIVER',
        });
      }
      let allocatedRunning = 0;
      const builtUnpaid = rawGuestTotals.map((g, idx) => {
        const shareIndex = lockedPaidShares.length + idx + 1;
        const alloc =
          idx === rawGuestTotals.length - 1
            ? Math.max(0, unpaidBalanceToAllocate - allocatedRunning)
            : Math.round((g.itemsSum / rawSum) * unpaidBalanceToAllocate);
        allocatedRunning += alloc;
        const isWaivedZero = alloc === 0 && Boolean(confirmZeroShareWaiver);
        return {
          shareId: `shr-${shareIndex}`,
          shareIndex,
          label: g.label || `Guest ${shareIndex}`,
          allocatedAmount: alloc,
          paidAmount: 0,
          remainingAmount: alloc,
          status: isWaivedZero ? 'waived_zero' : 'unpaid',
          itemIds: g.itemIds,
          paymentRefs: [],
        };
      });
      newShares = [...lockedPaidShares, ...builtUnpaid];
    } else {
      const totalWays = Math.max(lockedPaidShares.length + 1, Math.min(20, Math.floor(Number(guestCount) || 1)));
      newShares = buildDeterministicEqualShares(check.total, totalWays, lockedPaidShares);
      const zeroEqualShares = newShares.filter((sh) => sh.paidAmount === 0 && sh.allocatedAmount <= 0);
      if (zeroEqualShares.length > 0 && unpaidBalanceToAllocate > 0) {
        return res.status(400).json({
          error: `Cannot split ₦${unpaidBalanceToAllocate.toLocaleString()} across ${totalWays} guests because some shares would be ₦0.`,
        });
      }
    }

    check.splitConfig = {
      mode,
      guestCount: newShares.length,
      shares: newShares,
      updatedAt: new Date().toISOString(),
    };
    check.amountPaid = alreadyPaidSum;
    check.remainingBalance = unpaidBalanceToAllocate;

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      check.branchId,
      'CHECK_SPLIT_CONFIGURED',
      `Configured ${mode} split (${newShares.length} shares) on check ${check.checkNumber} (Total: ₦${check.total.toLocaleString()}, Unpaid: ₦${unpaidBalanceToAllocate.toLocaleString()})`
    );

    res.json({ success: true, check });
  });

  router.post('/api/pos/checks/:id/send-to-kitchen', requireAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const check = db.checks[id];

    if (!check) return res.status(404).json({ error: 'Check not found.' });

    if ((check as any).packagingRequirementStatus === 'AWAITING_PACKAGING_APPROVAL') {
      return res.status(409).json({
        error: `Check ${check.checkNumber} is currently held in AWAITING_PACKAGING_APPROVAL and cannot be sent to KDS until custom packaging is approved.`,
      });
    }

    if (check.paymentStatus !== 'paid') {
      return res.status(409).json({
        error: `PAYMENT_REQUIRED_BEFORE_KDS: Check ${check.checkNumber} is unpaid (${check.paymentStatus || 'unpaid'}). Payment must be confirmed before kitchen tickets can be released to KDS.`,
      });
    }

    const now = new Date().toISOString();
    if (check.status !== 'partially_paid' && check.status !== 'paid') {
      check.status = 'sent_to_kitchen';
    }
    check.items.forEach((it) => {
      if (it.status === 'pending') {
        it.status = 'sent_to_kitchen';
        it.sentToKitchenAt = now;
      }
    });

    if (check.tableId && db.tables[check.tableId] && check.status !== 'paid') {
      db.tables[check.tableId].status = 'kitchen_prep';
      db.tables[check.tableId].updatedAt = now;
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'STATUS_CHANGED',
      `Sent check ${check.checkNumber} to kitchen (${check.items.length} items)`
    );

    res.json({ success: true, check });
  });

  router.post('/api/pos/checks/:id/pay', requireAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const {
      paymentMethod = 'cash',
      paymentDetails = {},
      shiftId,
      activeShiftId,
      shareId,
      amountToPay,
      tenders,
      idempotencyKey,
    } = req.body;
    const check = db.checks[id];

    if (!check) return res.status(404).json({ error: 'Check not found.' });

    if (check.status === 'voided' || (check.status as string) === 'closed_unpaid' || (check.status as string) === 'refunded') {
      return res.status(409).json({
        error: `Check ${check.checkNumber} is ${check.status} and cannot accept payment.`,
      });
    }

    if ((check as any).packagingRequirementStatus === 'AWAITING_PACKAGING_APPROVAL') {
      return res.status(409).json({
        error: `Check ${check.checkNumber} is awaiting manager approval for custom packaging before settlement and KDS release.`,
      });
    }

    if (!Array.isArray(check.payments)) {
      check.payments = [];
    }

    // 1. Server-side idempotency guard against duplicate submissions
    const effectiveIdempotencyKey = idempotencyKey || paymentDetails?.idempotencyKey;
    if (effectiveIdempotencyKey) {
      const existingPayment = check.payments.find((p) => p.idempotencyKey === effectiveIdempotencyKey);
      if (existingPayment) {
        return res.json({
          success: true,
          idempotentReplay: true,
          check,
          payment: existingPayment,
        });
      }
    }

    if (check.status === 'paid' || check.paymentStatus === 'paid') {
      return res.status(409).json({
        error: `Check ${check.checkNumber} has already been settled and paid in full.`,
        check,
      });
    }

    const currentAmountPaid = check.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const currentRemainingBalance = Math.max(0, check.total - currentAmountPaid);

    // 2. If splitWays is provided in paymentDetails and check doesn't have splitConfig yet, initialize equal split
    if (paymentDetails?.splitWays && Number(paymentDetails.splitWays) >= 2 && !check.splitConfig) {
      const shares = buildDeterministicEqualShares(check.total, Number(paymentDetails.splitWays), []);
      check.splitConfig = {
        mode: 'equal',
        guestCount: shares.length,
        shares,
        updatedAt: new Date().toISOString(),
      };
    }

    // 3. Determine target share (if paying a specific guest share) and target payment amount
    const targetShareId = shareId || paymentDetails?.shareId;
    let targetShare: any = null;
    if (targetShareId && check.splitConfig && Array.isArray(check.splitConfig.shares)) {
      targetShare = check.splitConfig.shares.find((sh) => sh.shareId === targetShareId);
      if (!targetShare) {
        return res.status(404).json({ error: `Split share ${targetShareId} not found on check ${check.checkNumber}.` });
      }
      if (targetShare.status === 'paid' || targetShare.remainingAmount <= 0) {
        return res.status(409).json({
          error: `${targetShare.label} (${targetShare.shareId}) has already been paid.`,
          check,
        });
      }
    }

    const defaultDueForThisOperation = targetShare
      ? Number(targetShare.remainingAmount)
      : amountToPay !== undefined && Number(amountToPay) > 0
      ? Math.min(currentRemainingBalance, Math.round(Number(amountToPay)))
      : currentRemainingBalance;

    // 4. Normalize payment tenders (supports single payment, legacy 'split' cash+pos, or multi-tender array)
    interface NormalizedTender {
      method: 'cash' | 'pos_terminal' | 'bank_transfer' | 'wallet' | 'house_account';
      amount: number;
      cashTendered?: number;
      changeGiven?: number;
      reference?: string;
      customerId?: string;
      walletPin?: string;
      managerOverride?: boolean;
      houseAccountId?: string;
      authorizedSigner?: string;
      department?: string;
    }

    const normalizedTenders: NormalizedTender[] = [];

    if (Array.isArray(tenders) && tenders.length > 0) {
      for (const t of tenders) {
        const amt = Math.round(Number(t.amount || 0));
        if (amt <= 0) continue;
        const m = (t.method || 'cash') as NormalizedTender['method'];
        const cashTend = m === 'cash' ? Math.max(amt, Math.round(Number(t.cashTendered || amt))) : undefined;
        normalizedTenders.push({
          method: m,
          amount: amt,
          cashTendered: cashTend,
          changeGiven: cashTend !== undefined ? Math.max(0, cashTend - amt) : 0,
          reference: t.reference || t.posRrn || t.transferRef,
          customerId: t.customerId || paymentDetails?.customerId,
          walletPin: t.walletPin || paymentDetails?.walletPin,
          managerOverride: Boolean(t.managerOverride ?? paymentDetails?.managerOverride),
          houseAccountId: t.houseAccountId || paymentDetails?.houseAccountId,
          authorizedSigner: t.authorizedSigner || paymentDetails?.authorizedSigner,
          department: t.department || paymentDetails?.department,
        });
      }
    } else if (paymentMethod === 'split') {
      const cashPart = Math.max(0, Math.round(Number(paymentDetails.splitCashAmount || 0)));
      const posPart = Math.max(0, Math.round(Number(paymentDetails.splitPosAmount || 0)));
      const transferPart = Math.max(0, Math.round(Number(paymentDetails.splitTransferAmount || 0)));
      const totalSplitParts = cashPart + posPart + transferPart;

      if (totalSplitParts < defaultDueForThisOperation) {
        return res.status(400).json({
          error: `Split tender components (₦${totalSplitParts.toLocaleString()}) are less than the amount due (₦${defaultDueForThisOperation.toLocaleString()}).`,
        });
      }

      const appliedCash = Math.min(cashPart, Math.max(0, defaultDueForThisOperation - posPart - transferPart));
      if (appliedCash > 0) {
        normalizedTenders.push({
          method: 'cash',
          amount: appliedCash,
          cashTendered: cashPart,
          changeGiven: Math.max(0, cashPart - appliedCash),
          reference: 'SPLIT-CASH',
        });
      }
      if (posPart > 0) {
        normalizedTenders.push({
          method: 'pos_terminal',
          amount: posPart,
          reference: paymentDetails.posRrn || `POS-SPL-${Date.now().toString().slice(-6)}`,
        });
      }
      if (transferPart > 0) {
        normalizedTenders.push({
          method: 'bank_transfer',
          amount: transferPart,
          reference: paymentDetails.transferRef || `TRF-SPL-${Date.now().toString().slice(-6)}`,
        });
      }
    } else {
      const m = (paymentMethod || 'cash') as NormalizedTender['method'];
      const amt = defaultDueForThisOperation;
      const rawCashTendered = Number(paymentDetails.cashTendered || amt);
      if (m === 'cash' && rawCashTendered < amt) {
        return res.status(400).json({
          error: `Cash tendered (₦${rawCashTendered.toLocaleString()}) is less than the amount payable (₦${amt.toLocaleString()}).`,
        });
      }
      normalizedTenders.push({
        method: m,
        amount: amt,
        cashTendered: m === 'cash' ? Math.max(amt, rawCashTendered) : undefined,
        changeGiven: m === 'cash' ? Math.max(0, rawCashTendered - amt) : 0,
        reference:
          m === 'pos_terminal'
            ? paymentDetails.posRrn || paymentDetails.reference || `POS-${Date.now().toString().slice(-6)}`
            : m === 'bank_transfer'
            ? paymentDetails.transferRef || paymentDetails.reference || `TRF-${Date.now().toString().slice(-6)}`
            : paymentDetails.reference,
        customerId: paymentDetails.customerId,
        walletPin: paymentDetails.walletPin,
        managerOverride: Boolean(paymentDetails.managerOverride),
        houseAccountId: paymentDetails.houseAccountId,
        authorizedSigner: paymentDetails.authorizedSigner,
        department: paymentDetails.department,
      });
    }

    const totalAppliedThisPayment = normalizedTenders.reduce((s, t) => s + t.amount, 0);
    if (totalAppliedThisPayment <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than ₦0.' });
    }
    if (totalAppliedThisPayment > currentRemainingBalance) {
      return res.status(400).json({
        error: `Payment amount (₦${totalAppliedThisPayment.toLocaleString()}) exceeds remaining check balance (₦${currentRemainingBalance.toLocaleString()}).`,
      });
    }
    if (targetShare && totalAppliedThisPayment > targetShare.remainingAmount) {
      return res.status(400).json({
        error: `Payment amount (₦${totalAppliedThisPayment.toLocaleString()}) exceeds ${targetShare.label} remaining share balance (₦${targetShare.remainingAmount.toLocaleString()}).`,
      });
    }

    // 5. Strictly Validate Shift Requirement for Cash (no client-side bypassShiftCheck allowed), Wallet Balance/PIN, and Corporate House Account Credit Limits
    const hasCashComponent = normalizedTenders.some((t) => t.method === 'cash' && t.amount > 0);
    const effectiveShiftId = shiftId || activeShiftId;
    const activeShift = effectiveShiftId
      ? db.shifts[effectiveShiftId]
      : Object.values(db.shifts).find((s) => s.branchId === check.branchId && s.status === 'open');

    if (hasCashComponent && !activeShift) {
      return res.status(400).json({
        error: 'NO_ACTIVE_SHIFT: An active shift register must be opened on this branch before accepting cash payments.',
        requiresShift: true,
        branchId: check.branchId,
      });
    }

    for (const t of normalizedTenders) {
      if (t.method === 'wallet') {
        if (!t.customerId) {
          return res.status(400).json({ error: 'Customer ID or account selection is required for Digital Wallet payments.' });
        }
        const cust = db.customers[t.customerId];
        if (!cust) {
          return res.status(404).json({ error: 'Customer account not found for wallet debit.' });
        }
        if (cust.status !== 'active') {
          return res.status(400).json({ error: 'Customer wallet account is suspended or inactive.' });
        }
        if (Number(cust.walletBalance || 0) < t.amount) {
          return res.status(400).json({
            error: `Insufficient wallet balance. Available: ₦${Number(cust.walletBalance || 0).toLocaleString()}, Required: ₦${t.amount.toLocaleString()}`,
            availableBalance: cust.walletBalance,
          });
        }
        const isManagerOverride =
          ['store_manager', 'branch_manager', 'super_admin', 'corporate_admin'].includes(currentStaff.role) &&
          Boolean(t.managerOverride);
        if (!verifyWalletPin(t.walletPin || '', cust) && !isManagerOverride) {
          return res.status(400).json({ error: 'Invalid or missing 4-digit customer security PIN.' });
        }
      }

      if (t.method === 'house_account') {
        if (!t.houseAccountId) {
          return res.status(400).json({ error: 'Corporate House Account selection is required.' });
        }
        const hAcc = db.houseAccounts[t.houseAccountId];
        if (!hAcc) {
          return res.status(404).json({ error: 'Corporate House Account not found.' });
        }
        if (hAcc.status !== 'active') {
          return res.status(400).json({ error: 'This corporate house account is on hold or inactive.' });
        }
        const projectedBalance = Number(hAcc.currentBalance || 0) + t.amount;
        if (projectedBalance > hAcc.creditLimit) {
          return res.status(400).json({
            error: `Credit limit exceeded. Current Balance: ₦${hAcc.currentBalance.toLocaleString()}, Charge: ₦${t.amount.toLocaleString()}, Credit Limit: ₦${hAcc.creditLimit.toLocaleString()}`,
            creditLimit: hAcc.creditLimit,
            currentBalance: hAcc.currentBalance,
          });
        }
      }
    }

    // 6. Execute Tendering, Persist Payment Records, Update Share & Check Balances
    const now = new Date().toISOString();
    const recordedPayments: any[] = [];

    for (let idx = 0; idx < normalizedTenders.length; idx++) {
      const t = normalizedTenders[idx];
      const pmtId = `pmt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${idx}`;
      const pmtRecord = {
        id: pmtId,
        idempotencyKey: effectiveIdempotencyKey && idx === 0 ? effectiveIdempotencyKey : undefined,
        shareId: targetShare?.shareId,
        shareLabel: targetShare?.label,
        method: t.method,
        amount: t.amount,
        cashTendered: t.cashTendered,
        changeGiven: t.changeGiven,
        reference: t.reference || `${t.method.toUpperCase()}-${check.checkNumber}`,
        confirmedByStaffId: currentStaff.id,
        confirmedByName: currentStaff.name,
        confirmationMethod: t.method === 'cash' ? 'physical_till_count' : 'operator_reference_verified',
        timestamp: now,
      };
      check.payments.push(pmtRecord);
      recordedPayments.push(pmtRecord);

      // Wallet Debit
      if (t.method === 'wallet' && t.customerId && db.customers[t.customerId]) {
        const cust = db.customers[t.customerId];
        const prevBal = Number(cust.walletBalance || 0);
        const newBal = prevBal - t.amount;
        cust.walletBalance = newBal;

        db.walletTransactions.push({
          id: `wtx-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          customerId: cust.id,
          customerName: cust.name,
          type: 'debit_order',
          amount: t.amount,
          previousBalance: prevBal,
          newBalance: newBal,
          orderId: check.checkNumber,
          checkId: check.id,
          branchId: check.branchId,
          staffName: currentStaff.name,
          timestamp: now,
          note: `Settled ${targetShare ? `${targetShare.label} on ` : ''}check ${check.checkNumber} via digital wallet`,
        });
      }

      // House Account Charge
      if (t.method === 'house_account' && t.houseAccountId && db.houseAccounts[t.houseAccountId]) {
        const hAcc = db.houseAccounts[t.houseAccountId];
        hAcc.currentBalance = Number(hAcc.currentBalance || 0) + t.amount;
        db.houseAccountCharges.push({
          id: `hchg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          accountId: hAcc.id,
          companyName: hAcc.companyName,
          checkId: check.id,
          checkNumber: check.checkNumber,
          amount: t.amount,
          authorizedSigner: t.authorizedSigner || 'Authorized Representative',
          department: t.department || 'General Hospitality',
          branchId: check.branchId,
          timestamp: now,
          staffName: currentStaff.name,
          status: 'unbilled',
          notes: paymentDetails.notes || `Charged ${targetShare ? `${targetShare.label} ` : ''}to house account by ${currentStaff.name}`,
        });
      }

      // Active Shift Register Update
      if (activeShift) {
        if (t.method === 'cash') {
          activeShift.totalCashSales += t.amount;
          activeShift.expectedCashInTill += t.amount;
          db.cashMovements.push({
            id: `cm-${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${idx}`,
            shiftId: activeShift.id,
            branchId: check.branchId,
            timestamp: now,
            movementType: 'cash_sale',
            amount: t.amount,
            reason: `Cash payment for ${check.checkNumber}${targetShare ? ` (${targetShare.label})` : ''}`,
            staffId: currentStaff.id,
            staffName: currentStaff.name,
            recipientOrRef: check.checkNumber,
          });
        } else if (t.method === 'pos_terminal') {
          activeShift.totalPosSales += t.amount;
        } else if (t.method === 'bank_transfer') {
          activeShift.totalTransferSales += t.amount;
        }
      }
    }

    // Update target share if applicable
    if (targetShare) {
      targetShare.paidAmount = Number(targetShare.paidAmount || 0) + totalAppliedThisPayment;
      targetShare.remainingAmount = Math.max(0, targetShare.allocatedAmount - targetShare.paidAmount);
      targetShare.status = targetShare.remainingAmount === 0 ? 'paid' : 'partially_paid';
      targetShare.paidAt = now;
      targetShare.paymentRefs = [
        ...(targetShare.paymentRefs || []),
        ...recordedPayments.map((p) => p.reference),
      ];
    } else if (check.splitConfig && Array.isArray(check.splitConfig.shares)) {
      let pool = totalAppliedThisPayment;
      for (const sh of check.splitConfig.shares) {
        if (pool <= 0) break;
        if (sh.remainingAmount > 0) {
          const take = Math.min(sh.remainingAmount, pool);
          sh.paidAmount += take;
          sh.remainingAmount -= take;
          sh.status = sh.remainingAmount === 0 ? 'paid' : 'partially_paid';
          if (sh.remainingAmount === 0) sh.paidAt = now;
          pool -= take;
        }
      }
    }

    // Recompute check totals
    const newAmountPaid = check.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const newRemainingBalance = Math.max(0, check.total - newAmountPaid);
    check.amountPaid = newAmountPaid;
    check.remainingBalance = newRemainingBalance;

    // Synchronize splitPayments array for Double-Entry General Ledger
    check.splitPayments = check.payments.map((p) => ({
      method: p.method,
      amount: p.amount,
      reference: p.reference,
      shareId: p.shareId,
    }));

    const distinctMethods = Array.from(new Set(check.payments.map((p) => p.method)));
    check.paymentMethod = distinctMethods.length > 1 ? 'split' : (distinctMethods[0] || paymentMethod);
    check.paymentDetails = {
      ...(check.paymentDetails || {}),
      ...paymentDetails,
      lastPaymentAt: now,
      amountPaid: newAmountPaid,
      remainingBalance: newRemainingBalance,
    };

    const isFullyPaid = newRemainingBalance === 0;

    if (isFullyPaid) {
      check.status = 'paid';
      check.paymentStatus = 'paid';
      check.closedAt = now;
      check.paidAt = now;
      check.closedByStaffId = currentStaff.id;
      check.closedByName = currentStaff.name;
      check.settledByStaffId = currentStaff.id;
      check.settledByName = currentStaff.name;

      // Release pending items to KDS upon full payment confirmation
      check.items.forEach((it) => {
        if (it.status === 'pending') {
          it.status = 'sent_to_kitchen';
          it.sentToKitchenAt = now;
        }
      });

      if (activeShift) {
        activeShift.totalOrders += 1;
      }

      if (check.tableId && db.tables[check.tableId]) {
        db.tables[check.tableId].status = 'available';
        db.tables[check.tableId].currentCheckId = undefined;
        db.tables[check.tableId].guestCount = 0;
        db.tables[check.tableId].updatedAt = now;
      }

      // Sync linked online order status if present
      if (check.orderId && db.orders[check.orderId]) {
        db.orders[check.orderId].paymentStatus = 'paid';
        if (db.orders[check.orderId].status === 'pending_payment' || db.orders[check.orderId].status === 'confirmed') {
          db.orders[check.orderId].status = 'preparing';
        }
        db.orders[check.orderId].updatedAt = now;
      }

      // Loyalty points & BOM inventory depletion happen ONCE when check is settled in full
      const customerToReward =
        (paymentDetails.customerId ? db.customers[paymentDetails.customerId] : null) ||
        (check.customerPhone ? Object.values(db.customers).find((c: any) => c.phone === check.customerPhone) : null);

      if (customerToReward && !(check as any).loyaltyPointsAwardedAt) {
        customerToReward.visitCount = (customerToReward.visitCount || 0) + 1;
        customerToReward.lifetimeSpend = (customerToReward.lifetimeSpend || 0) + check.total;
        customerToReward.lastVisitDate = now;

        const pointsEarned = calculateLoyaltyPoints(check);
        customerToReward.loyaltyPoints = (customerToReward.loyaltyPoints || 0) + pointsEarned;
        (check as any).loyaltyPointsEarned = pointsEarned;
        (check as any).loyaltyPointsAwardedAt = now;
        (check as any).loyaltyCustomerId = customerToReward.id;

        if (check.total >= 3000 && (customerToReward.stampCount || 0) < 10) {
          customerToReward.stampCount = (customerToReward.stampCount || 0) + 1;
        }

        if (customerToReward.lifetimeSpend >= 1000000) customerToReward.tier = 'platinum';
        else if (customerToReward.lifetimeSpend >= 500000) customerToReward.tier = 'gold';
        else if (customerToReward.lifetimeSpend >= 200000) customerToReward.tier = 'silver';
        else customerToReward.tier = 'bronze';
      }

      if (!check.inventoryDepletedAt) {
        depleteInventoryForOrder(check.items, check.branchId, check.checkNumber, currentStaff);
        check.inventoryDepletedAt = now;
      }
    } else {
      check.status = 'partially_paid';
      check.paymentStatus = 'partially_paid';
      if (check.tableId && db.tables[check.tableId]) {
        db.tables[check.tableId].status = 'payment_pending';
        db.tables[check.tableId].updatedAt = now;
      }
    }

    if (check.checkType === 'delivery') {
      const taskKey = (check.orderId && db.deliveryTasks[check.orderId]) ? check.orderId : check.id;
      const existingTask = db.deliveryTasks[taskKey];
      const isWholesaleBread = (check.items || []).some((it: any) => Boolean(it.isWholesaleApplied));
      const pickupPin = existingTask?.pickupAuthorizationCode || String(Math.floor(1000 + Math.random() * 9000));
      const nextRiderId = (check as any).riderId || paymentDetails?.riderId || existingTask?.riderId;
      const nextRiderName =
        (check as any).riderName ||
        paymentDetails?.riderName ||
        existingTask?.riderName ||
        (nextRiderId && db.riders[nextRiderId]?.name);
      db.deliveryTasks[taskKey] = {
        ...(existingTask || {}),
        id: taskKey,
        orderId: check.orderId || check.id,
        checkId: check.id,
        orderNumber: check.checkNumber,
        branchId: check.branchId,
        customerName: check.customerName || 'Delivery Customer',
        customerPhone: check.customerPhone || '0800-000-0000',
        deliveryAddress: (check as any).deliveryAddress || existingTask?.deliveryAddress || 'Customer Delivery Address',
        deliveryZone: (check as any).deliveryZone || existingTask?.deliveryZone || 'Standard',
        landmark: (check as any).landmark || existingTask?.landmark || '',
        orderTotal: check.total,
        paymentMethod: isFullyPaid ? (check.paymentMethod || 'pos_terminal') : 'cash_on_delivery',
        paymentStatus: check.paymentStatus,
        codAmountDue: isFullyPaid ? 0 : check.remainingBalance,
        codAmountCollected: existingTask?.codAmountCollected || 0,
        status: existingTask?.status && existingTask.status !== 'pending'
          ? existingTask.status
          : nextRiderId
          ? 'assigned'
          : 'pending',
        riderId: nextRiderId,
        riderName: nextRiderName,
        assignedAt: nextRiderId ? (existingTask?.assignedAt || now) : existingTask?.assignedAt,
        cashReconciled: isFullyPaid ? true : Boolean(existingTask?.cashReconciled),
        pickupAuthorizationCode: pickupPin,
        notes: check.notes || existingTask?.notes || '',
        dispatchType: isWholesaleBread ? 'wholesale_bread' : 'restaurant_meal',
        isWholesaleBread,
        itemsSummary: (check.items || []).map((it: any) => ({
          productId: it.productId,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          isWholesaleApplied: Boolean(it.isWholesaleApplied),
        })),
      } as any;
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      isFullyPaid ? 'PAYMENT_CONFIRMED' : 'PARTIAL_PAYMENT_RECORDED',
      `${isFullyPaid ? 'Settled' : 'Recorded partial payment on'} check ${check.checkNumber}${targetShare ? ` (${targetShare.label})` : ''}: Paid ₦${totalAppliedThisPayment.toLocaleString()} (Cumulative Paid: ₦${newAmountPaid.toLocaleString()} / ₦${check.total.toLocaleString()}, Remaining: ₦${newRemainingBalance.toLocaleString()})`
    );

    res.json({
      success: true,
      check,
      paymentsRecorded: recordedPayments,
      amountPaid: newAmountPaid,
      remainingBalance: newRemainingBalance,
      isFullyPaid,
    });
  });

  // Close Unpaid Check Workflow (No Revenue Recognized, No Inventory Depleted, Releases Table, Full Audit Trail)
  router.post('/api/pos/checks/:id/close-unpaid', requireAuth, async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { reason, supervisorPin } = req.body || {};
    const currentStaff = (req as any).staff as DbStaffAccount;
    if (currentStaff.role === 'auditor') {
      return res.status(403).json({ error: 'Access denied: Auditor role is strictly read-only.' });
    }

    const check = db.checks[id];
    if (!check) return res.status(404).json({ error: 'Check not found.' });

    const trimmedReason = String(reason || '').trim();
    if (!trimmedReason) {
      return res.status(400).json({ error: 'A mandatory reason is required to close an unpaid check.' });
    }

    if (check.status === 'paid' || check.paymentStatus === 'paid' || Number(check.amountPaid || 0) > 0) {
      return res.status(409).json({
        error: `Check ${check.checkNumber} already has recorded payments (₦${Number(check.amountPaid || 0).toLocaleString()}). Use void or refund workflow instead of close-unpaid.`,
      });
    }

    const isManager = ['store_manager', 'branch_manager', 'super_admin', 'corporate_admin'].includes(currentStaff.role);
    if (!isManager && supervisorPin) {
      const sup = await supervisorAuthService.verifySupervisorPin(
        currentStaff,
        check.branchId,
        supervisorPin,
        'pos.item.void',
        deps.logAuditEvent
      );
      if (!sup) {
        return res.status(403).json({ error: 'Invalid Supervisor PIN for closing unpaid check.' });
      }
    }

    const now = new Date().toISOString();
    check.status = 'closed_unpaid' as any;
    check.paymentStatus = 'unpaid';
    check.closedAt = now;
    check.closedByStaffId = currentStaff.id;
    check.closedByName = currentStaff.name;
    (check as any).closedUnpaidReason = trimmedReason;

    if (check.tableId && db.tables[check.tableId]) {
      db.tables[check.tableId].status = 'available';
      db.tables[check.tableId].currentCheckId = undefined;
      db.tables[check.tableId].guestCount = 0;
      db.tables[check.tableId].updatedAt = now;
    }

    if (check.orderId && db.orders[check.orderId]) {
      db.orders[check.orderId].status = 'cancelled';
      db.orders[check.orderId].updatedAt = now;
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      check.branchId,
      'CHECK_CLOSED_UNPAID',
      `Closed unpaid check ${check.checkNumber} (₦0 revenue, 0 inventory depleted). Reason: ${trimmedReason}`
    );

    return res.json({ success: true, check });
  });

  router.post('/api/pos/checks/:id/void', requireAuth, async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { reason, supervisorPin } = req.body || {};
    const currentStaff = (req as any).staff as DbStaffAccount;
    if (currentStaff.role === 'auditor') {
      return res.status(403).json({ error: 'Access denied: Auditor role is strictly read-only.' });
    }
    const check = db.checks[id];
    if (!check) return res.status(404).json({ error: 'Check not found.' });

    const trimmedReason = String(reason || '').trim();
    if (!trimmedReason) {
      return res.status(400).json({ error: 'A mandatory reason is required to void a check.' });
    }

    const isManager = ['store_manager', 'branch_manager', 'super_admin', 'corporate_admin'].includes(currentStaff.role);
    const supervisor = isManager 
      ? currentStaff 
      : await supervisorAuthService.verifySupervisorPin(
          currentStaff, 
          check.branchId, 
          supervisorPin, 
          'pos.item.void', 
          deps.logAuditEvent
        );
    if (!supervisor && (check.status === 'paid' || check.paymentStatus === 'paid' || check.status === 'sent_to_kitchen')) {
      return res.status(403).json({ error: 'Only managers or staff with a valid Supervisor PIN can void sent or settled checks.' });
    }

    const now = new Date().toISOString();
    check.status = 'voided';
    (check as any).voidedAt = now;
    (check as any).voidedByStaffId = currentStaff.id;
    (check as any).voidedByName = currentStaff.name;
    (check as any).voidReason = trimmedReason;

    if (check.tableId && db.tables[check.tableId]) {
      db.tables[check.tableId].status = 'available';
      db.tables[check.tableId].currentCheckId = undefined;
      db.tables[check.tableId].guestCount = 0;
      db.tables[check.tableId].updatedAt = now;
    }

    if (check.inventoryDepletedAt || (db as any).processedDepletionRefs?.[check.checkNumber]) {
      if (typeof reverseInventoryForOrder === 'function') {
        reverseInventoryForOrder(check.checkNumber, check.branchId, currentStaff, trimmedReason);
      }
    }

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      check.branchId,
      'CHECK_VOIDED',
      `Voided check ${check.checkNumber}. Reason: ${trimmedReason}`
    );
    res.json({ success: true, check });
  });

  // Hardened Two-Step Refund with RBAC, Segregation of Duties (SoD), and Prepared-vs-Unprepared Stock Restoration Control
  router.post('/api/pos/checks/:id/refund', requireAuth, async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const {
      reason,
      supervisorPin,
      action = 'execute',
      restoreUnpreparedInventory = false,
      preparedItemsWastage = true,
    } = req.body || {};
    const currentStaff = (req as any).staff as DbStaffAccount;
    if (currentStaff.role === 'auditor') {
      return res.status(403).json({ error: 'Access denied: Auditor role is strictly read-only.' });
    }
    const check = db.checks[id];
    if (!check) return res.status(404).json({ error: 'Check not found.' });

    const trimmedReason = String(reason || (check as any).refundRequest?.reason || '').trim();
    if (!trimmedReason) {
      return res.status(400).json({ error: 'A mandatory refund reason is required.' });
    }

    const now = new Date().toISOString();
    const isManagerOrFinance = ['store_manager', 'branch_manager', 'super_admin', 'corporate_admin', 'accountant', 'finance_officer'].includes(currentStaff.role);
    const supervisor = isManagerOrFinance 
      ? currentStaff 
      : await supervisorAuthService.verifySupervisorPin(
          currentStaff, 
          check.branchId, 
          supervisorPin, 
          'pos.item.void', 
          deps.logAuditEvent
        );

    // Step 1: Request refund (can be initiated by cashier or manager)
    if (action === 'request') {
      (check as any).refundRequest = {
        requestedByStaffId: currentStaff.id,
        requestedByName: currentStaff.name,
        requestedByRole: currentStaff.role,
        requestedAt: now,
        reason: trimmedReason,
        restoreUnpreparedInventory: Boolean(restoreUnpreparedInventory),
        status: 'pending_approval',
      };
      (check as any).refundStatus = 'refund_requested';
      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        check.branchId,
        'REFUND_REQUESTED',
        `Requested refund for check ${check.checkNumber} (₦${Number(check.total || 0).toLocaleString()}). Reason: ${trimmedReason}`
      );
      return res.json({
        success: true,
        status: 'refund_requested',
        check,
      });
    }

    // Step 2: Approve / Execute refund — strictly requires Manager/Finance role or Supervisor PIN
    if (!supervisor) {
      return res.status(403).json({
        error: 'Executing a refund requires a Manager/Finance role or valid Supervisor PIN.',
      });
    }

    // Segregation of Duties (SoD): if a refund request exists, the approver cannot be the same non-super_admin user who requested it
    const pendingReq = (check as any).refundRequest;
    if (
      pendingReq &&
      pendingReq.requestedByStaffId === supervisor.id &&
      supervisor.role !== 'super_admin'
    ) {
      return res.status(403).json({
        error: 'Segregation of Duties violation: The staff member who requested the refund cannot approve their own refund request.',
      });
    }

    check.status = 'refunded' as any;
    check.paymentStatus = 'refunded' as any;
    (check as any).refundStatus = 'refunded';
    (check as any).refundedAt = now;
    (check as any).refundedByStaffId = supervisor.id;
    (check as any).refundedByName = supervisor.name;
    (check as any).refundReason = trimmedReason;
    (check as any).preparedItemsWastage = Boolean(preparedItemsWastage);
    (check as any).unpreparedInventoryRestored = Boolean(restoreUnpreparedInventory);

    // Only restore BOM inventory if the items were NOT already prepared/cooked (`restoreUnpreparedInventory === true`)
    if (
      Boolean(restoreUnpreparedInventory) &&
      (check.inventoryDepletedAt || (db as any).processedDepletionRefs?.[check.checkNumber])
    ) {
      if (typeof reverseInventoryForOrder === 'function') {
        reverseInventoryForOrder(check.checkNumber, check.branchId, supervisor as any, trimmedReason);
      }
    }

    saveDatabaseSync();
    logAuditEvent(
      supervisor.name,
      supervisor.role,
      check.branchId,
      'CHECK_REFUNDED',
      `Refunded check ${check.checkNumber} (₦${Number(check.total || 0).toLocaleString()}, Unprepared Stock Restored: ${Boolean(restoreUnpreparedInventory)}). Reason: ${trimmedReason}`
    );
    res.json({ success: true, check });
  });

  // Mount Offline Sync & Table Transfer Routes
  router.use(createPosOfflineAndTableTransferRouter(deps));

  return router;
}
