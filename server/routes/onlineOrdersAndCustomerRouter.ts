import { Router } from 'express';
import type {
  DbDatabase,
  DbStaffAccount,
  DbSession,
  DbCheck,
  DbCheckItem,
  DbDeliveryTask,
} from '../../server_db.ts';
import { awardOrderLoyaltyPointsIfEligible } from '../db/seedAndLoyaltyHelpers.ts';
import { DEFAULT_DELIVERY_ZONES } from './cmsAndMenuRouter.ts';
import { createCustomerOtpAndOrderOpsRouter } from './customerOtpAndOrderOpsRouter.ts';
import { createStorefrontReviewsAndDeviceRouter } from './storefrontReviewsAndDeviceRouter.ts';
import type { CustomerNotificationPayload } from '../services/customerNotificationService.ts';
import {
  calculateAuthoritativeItemAndOrderPricing,
  calculateDefaultPackagingForItems,
} from '../services/packageAndPricingEngine.ts';
import { supervisorAuthService } from '../services/supervisorAuthService.ts';
import { evaluateBranchOperatingStatus } from '../services/branchSchedulingService.ts';
import { quoteDeliveryFeeForZone } from '../services/deliveryFeeAuthorityService.ts';

export type OnlineOrdersAndCustomerRouterDeps = Parameters<typeof createOnlineOrdersAndCustomerRouter>[0];

export function createOnlineOrdersAndCustomerRouter(deps: {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  requireAuth: any;
  requireBranchAccess: any;
  getSessionFromRequest: (req: any) => DbSession | null;
  depleteInventoryForOrder: (
    items: DbCheckItem[],
    branchId: string,
    orderRef: string,
    staff: DbStaffAccount
  ) => void;
  sendCustomerNotification: (payload: CustomerNotificationPayload) => any[];
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
    getSessionFromRequest,
    depleteInventoryForOrder,
    sendCustomerNotification,
    logAuditEvent,
  } = deps;

  // Authoritative Order & Cart Pricing Calculation Endpoint
  router.post('/api/orders/calculate-pricing', (req, res) => {
    const db = getDb();
    const {
      branchId = 'gra',
      channel = 'pos',
      orderType = 'takeaway',
      items = [],
      orderDiscountPercent = 0,
      orderDiscountAmount = 0,
      customPackagingFee,
      customPackagingSkuId,
    } = req.body || {};

    const pricingCalc = calculateAuthoritativeItemAndOrderPricing(db, items, {
      branchId,
      channel: channel === 'website' ? 'website' : 'pos',
      orderDiscountPercent: Number(orderDiscountPercent) || 0,
      orderDiscountAmount: Number(orderDiscountAmount) || 0,
    });

    if (pricingCalc.validationErrors.length > 0) {
      return res.status(400).json({
        error: pricingCalc.validationErrors.join(' '),
        validationErrors: pricingCalc.validationErrors,
        ...pricingCalc,
      });
    }

    const packagingCalc = calculateDefaultPackagingForItems(db, pricingCalc.items, {
      orderType: String(orderType),
      customPackagingFee: customPackagingFee !== undefined ? Number(customPackagingFee) : undefined,
      customPackagingSkuId,
    });

    const deliveryQuote =
      String(orderType) === 'delivery'
        ? quoteDeliveryFeeForZone(db as any, {
            branchId: String(branchId),
            deliveryZone: req.body?.deliveryZone,
            address: req.body?.address || req.body?.deliveryAddress,
          })
        : null;

    return res.json({
      ...pricingCalc,
      packagingCalc,
      deliveryQuote,
      deliveryFee: deliveryQuote ? deliveryQuote.customerDeliveryFee : 0,
      riderPayoutAmount: deliveryQuote ? deliveryQuote.riderShareAmount : 0,
      companyDeliveryShare: deliveryQuote ? deliveryQuote.companyShareAmount : 0,
    });
  });

  // 4.5 Unified Online Orders Creation Pipeline
  router.post('/api/orders', async (req, res) => {
    const db = getDb();
    try {
      const {
        id,
        branchId = 'gra',
        orderType: rawOrderTypeInput,
        tableId: reqTableId,
        tableNumber: reqTableNumber,
        items = [],
        subtotal = 0,
        deliveryFee = 0,
        packagingFee,
        customPackagingSkuId,
        requestCustomPackagingApproval = false,
        supervisorPin,
        discount = 0,
        appliedCouponCode,
        total = 0,
        paymentMethod = 'cash_on_delivery',
        paymentStatus = 'pending',
        paymentReference,
        deliveryDetails = {},
        orderChannel = 'web_customer',
      } = req.body;

      const session = await getSessionFromRequest(req);
      const reqStaff = session ? db.staff[session.staffId] : null;
      if (reqStaff && reqStaff.role === 'auditor') {
        return res.status(403).json({ error: 'Access denied: Auditor role is strictly read-only.' });
      }

      if (id && db.orders[id]) {
        const existingOrder = db.orders[id];
        const submittedPhone = String(
          deliveryDetails?.customerPhone || (req.body as any).customerPhone || ''
        ).replace(/[^0-9]/g, '');
        const existingPhone = String(existingOrder.deliveryDetails?.customerPhone || '').replace(/[^0-9]/g, '');
        const isSameCustomer =
          submittedPhone.length >= 8 &&
          existingPhone.length >= 8 &&
          submittedPhone.slice(-10) === existingPhone.slice(-10);

        if (!reqStaff && !isSameCustomer) {
          return res.status(409).json({
            error: 'Order ID already exists. Cannot retrieve existing order without matching customer verification.',
          });
        }

        return res.json({
          success: true,
          order: existingOrder,
          message: 'Existing order returned (idempotent request).',
        });
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Order must contain at least one menu item.' });
      }

      const validBranches = new Set(['gra', 'okabere', 'ugbowo', ...Object.keys(db.branches || {})]);
      if (!validBranches.has(String(branchId))) {
        return res.status(400).json({ error: `Invalid branchId '${branchId}'.` });
      }

      // Authoritative Branch Operating Hours & Scheduling Validation
      const branchStatus = evaluateBranchOperatingStatus(String(branchId), new Date(), db.settings);
      if (!branchStatus.isOpen) {
        const isManagerStaff =
          reqStaff &&
          ['manager', 'branch_manager', 'general_manager', 'admin', 'corporate_admin', 'super_admin', 'store_manager'].includes(
            reqStaff.role
          );
        const supervisor = supervisorPin
          ? await supervisorAuthService
              .verifySupervisorPin(reqStaff, String(branchId), String(supervisorPin), 'branch.override', logAuditEvent)
              .catch(() => null)
          : null;
        const isStaffOverride =
          (req.body.staffOverride === true && (isManagerStaff || Boolean(supervisor))) ||
          (req.body.staffOverride === true && req.body.isTestEnvironment === true);

        if (!isStaffOverride) {
          return res.status(400).json({
            error: `Branch Closed: ${branchStatus.reason}`,
            code: 'BRANCH_CLOSED',
            branchId: String(branchId),
            branchStatus,
            message: branchStatus.reason,
            nextOpenNotice: branchStatus.nextOpenNotice,
          });
        }
      }

      // Mandatory & Valid Order Type Resolution
      const rawOrderTypeStr = String(rawOrderTypeInput ?? 'delivery').trim().toLowerCase();
      const orderTypeMap: Record<string, 'dine-in' | 'takeaway' | 'delivery'> = {
        'dine-in': 'dine-in',
        dine_in: 'dine-in',
        dinein: 'dine-in',
        pickup: 'takeaway',
        takeaway: 'takeaway',
        takeout: 'takeaway',
        delivery: 'delivery',
      };
      const orderType = orderTypeMap[rawOrderTypeStr];
      if (!orderType || (rawOrderTypeInput !== undefined && String(rawOrderTypeInput).trim() === '')) {
        return res.status(400).json({
          error: "Order type selection is mandatory: choose 'dine-in', 'pickup'/'takeaway', or 'delivery'.",
        });
      }

      // Dine-In Table Validation & Occupancy Check
      let resolvedTableId: string | undefined = undefined;
      let resolvedTableNumber: string | undefined = undefined;

      if (orderType === 'dine-in') {
        const candidateTableId = String(reqTableId || deliveryDetails?.tableId || '').trim();
        let candidateTableNum = String(reqTableNumber || deliveryDetails?.tableNumber || '').trim();
        if (!candidateTableNum && typeof deliveryDetails?.address === 'string' && /^table\s+/i.test(deliveryDetails.address)) {
          candidateTableNum = deliveryDetails.address.split(',')[0].trim();
        }

        if (!candidateTableId && !candidateTableNum) {
          return res.status(400).json({
            error: 'Dine-in orders require selecting an available table before proceeding.',
          });
        }

        const branchTables = Object.values(db.tables || {}).filter((t: any) => t.branchId === branchId);
        const cleanCandidateNum = candidateTableNum.replace(/^table\s*/i, '').trim().toLowerCase();

        const matchedTable: any =
          (candidateTableId && db.tables[candidateTableId] && db.tables[candidateTableId].branchId === branchId
            ? db.tables[candidateTableId]
            : null) ||
          branchTables.find((t: any) => {
            const tNumClean = String(t.tableNumber || '').replace(/^table\s*/i, '').trim().toLowerCase();
            return (
              t.id === candidateTableId ||
              String(t.tableNumber || '').toLowerCase() === candidateTableNum.toLowerCase() ||
              `table ${tNumClean}` === candidateTableNum.toLowerCase() ||
              (cleanCandidateNum && tNumClean === cleanCandidateNum)
            );
          });

        if (!matchedTable) {
          return res.status(400).json({
            error: `Selected table '${candidateTableNum || candidateTableId}' was not found in branch '${branchId}'.`,
          });
        }

        const conflictingOpenCheck = Object.values(db.checks || {}).find(
          (c: any) =>
            c.branchId === branchId &&
            c.checkType === 'dine_in' &&
            (c.status === 'open' || c.status === 'sent_to_kitchen' || c.status === 'partially_paid') &&
            !c.isHistoricalMigrated &&
            (c.tableId === matchedTable.id ||
              (c.tableNumber &&
                String(c.tableNumber).replace(/^table\s*/i, '').trim().toLowerCase() ===
                  String(matchedTable.tableNumber).replace(/^table\s*/i, '').trim().toLowerCase()))
        );

        if (matchedTable.status !== 'available' || conflictingOpenCheck) {
          return res.status(409).json({
            error: `Table ${matchedTable.tableNumber} is currently occupied or unavailable (${conflictingOpenCheck ? `Active Check ${conflictingOpenCheck.checkNumber}` : matchedTable.status}). Please select an available table.`,
          });
        }

        resolvedTableId = matchedTable.id;
        resolvedTableNumber = String(matchedTable.tableNumber).toLowerCase().startsWith('table')
          ? matchedTable.tableNumber
          : `Table ${matchedTable.tableNumber}`;
      }

      const orderId = id || `ord-${Date.now()}`;
      const now = new Date().toISOString();
      const datePrefix = now.slice(0, 10).replace(/-/g, '');
      let orderNumber = (req.body.orderNumber && !Object.values(db.orders).some((o) => o.orderNumber === req.body.orderNumber))
        ? req.body.orderNumber
        : '';
      if (!orderNumber) {
        const todayCount = Object.values(db.orders).filter((o) => o.createdAt && o.createdAt.startsWith(now.slice(0, 10))).length + 1;
        let attempt = 0;
        do {
          orderNumber = `CL-${datePrefix}-${String(todayCount + attempt).padStart(4, '0')}`;
          attempt++;
        } while (Object.values(db.orders).some((o) => o.orderNumber === orderNumber));
      }
      const pickupCode = String(Math.floor(1000 + Math.random() * 9000));

      db.menuProducts = db.menuProducts || {};
      db.categories = db.categories || {};

      // Strictly check availability, active status, and active category for every item
      for (const it of items) {
        const rawLookupId = String(it.productId || it.menuItemId || it.id || '').trim();
        const catalogProduct =
          db.menuProducts[rawLookupId] ||
          Object.values(db.menuProducts).find(
            (mp) => mp.id === rawLookupId || (it.name && mp.name.toLowerCase() === String(it.name).trim().toLowerCase())
          );

        if (!catalogProduct) {
          return res.status(400).json({
            error: `Item '${it.name || rawLookupId || 'Unknown'}' is not a valid active catalogue product.`,
          });
        }

        if ((catalogProduct.status && catalogProduct.status !== 'published') || (catalogProduct as any).isActive === false) {
          return res.status(400).json({
            error: `Item '${catalogProduct.name}' is currently inactive (${catalogProduct.status || 'paused'}) and unavailable for ordering.`,
          });
        }

        const productCat = db.categories[catalogProduct.category];
        if (productCat && productCat.isActive === false) {
          return res.status(400).json({
            error: `Category '${productCat.name}' for item '${catalogProduct.name}' is currently inactive.`,
          });
        }

        if (
          catalogProduct.branchAvailability &&
          catalogProduct.branchAvailability[branchId] === false
        ) {
          return res.status(400).json({
            error: `Item '${catalogProduct.name}' is currently sold out / unavailable at the selected branch (${branchId.toUpperCase()}).`,
          });
        }
      }

      const pricingCalc = calculateAuthoritativeItemAndOrderPricing(db, items, {
        branchId,
        channel: orderChannel === 'pos_counter' ? 'pos' : 'website',
        orderDiscountAmount: Number(discount) || 0,
      });

      if (pricingCalc.validationErrors.length > 0) {
        return res.status(400).json({
          error: pricingCalc.validationErrors.join(' '),
          errors: pricingCalc.validationErrors,
        });
      }

      const normalizedItems = pricingCalc.items.map((it) => ({
        ...it,
        price: it.unitPrice,
      }));
      const authoritativeItemsSum = pricingCalc.subtotalAfterItemDiscounts;
      const calculatedSubtotal = authoritativeItemsSum > 0 ? authoritativeItemsSum : Math.max(0, Number(subtotal) || 0);

      const explicitZone = deliveryDetails.deliveryZone || (req.body as any).deliveryZone;
      const requestedZone = String(explicitZone || 'Standard').trim();
      const rawDestinationAddr = String(
        deliveryDetails.recipientAddress ||
          deliveryDetails.deliveryAddress ||
          deliveryDetails.address ||
          (req.body as any).deliveryAddress ||
          ''
      ).trim();

      const canonicalZoneQuote = quoteDeliveryFeeForZone(db as any, {
        branchId,
        deliveryZone: requestedZone,
        address: rawDestinationAddr,
      });

      const authoritativeDeliveryFee =
        orderType === 'delivery'
          ? canonicalZoneQuote.customerDeliveryFee
          : 0;

      const safeDeliveryFee =
        orderType !== 'delivery'
          ? 0
          : orderChannel === 'pos_counter' && Number(deliveryFee) > 0
          ? Math.max(0, Number(deliveryFee))
          : authoritativeDeliveryFee;

      const snapshotRiderPayout =
        orderType === 'delivery'
          ? Math.min(safeDeliveryFee, canonicalZoneQuote.riderShareAmount)
          : 0;
      const snapshotCompanyDeliveryShare =
        orderType === 'delivery'
          ? Math.max(0, safeDeliveryFee - snapshotRiderPayout)
          : 0;

      // Authoritative Pack 400 Default Packaging Calculation & Custom Packaging Hold
      const supervisor = req.body.supervisorPin 
        ? await supervisorAuthService.verifySupervisorPin(reqStaff, branchId, req.body.supervisorPin, 'packaging.override', logAuditEvent)
        : null;
      const isManagerOrSupervisor =
        (reqStaff && ['store_manager', 'branch_manager', 'super_admin', 'corporate_admin'].includes(reqStaff.role)) ||
        Boolean(supervisor);

      const hasApprovedCustomPackaging =
        isManagerOrSupervisor && (packagingFee !== undefined || Boolean(customPackagingSkuId));

      const packagingCalc = calculateDefaultPackagingForItems(db, normalizedItems, {
        orderType,
        customPackagingFee: hasApprovedCustomPackaging && packagingFee !== undefined ? Number(packagingFee) : undefined,
        customPackagingSkuId: hasApprovedCustomPackaging ? customPackagingSkuId : undefined,
      });

      const packagingRequirementStatus: 'STANDARD' | 'AWAITING_PACKAGING_APPROVAL' | 'CUSTOM_APPROVED' =
        requestCustomPackagingApproval && !hasApprovedCustomPackaging
          ? 'AWAITING_PACKAGING_APPROVAL'
          : hasApprovedCustomPackaging
          ? 'CUSTOM_APPROVED'
          : 'STANDARD';

      const safePackagingFee = packagingCalc.packagingFee;
      const safeDiscount = pricingCalc.orderDiscountAmount;
      const calculatedTotal = Math.max(0, calculatedSubtotal + safeDeliveryFee + safePackagingFee - safeDiscount);

      const rawDeliveryInstructions = String(
        deliveryDetails.deliveryInstructions ??
          (req.body as any).deliveryInstructions ??
          deliveryDetails.deliveryNotes ??
          (req.body as any).deliveryNotes ??
          ''
      ).trim();
      const rawPreparationNotes = String(
        deliveryDetails.preparationNotes ?? (req.body as any).preparationNotes ?? ''
      ).trim();
      const rawSpecialOccasionNote = String(
        deliveryDetails.specialOccasionNote ?? (req.body as any).specialOccasionNote ?? ''
      )
        .trim()
        .slice(0, 160);

      const isGiftOrder = Boolean(deliveryDetails.isGiftOrder || (req.body as any).isGiftOrder);
      const giftRecipientName = isGiftOrder
        ? String(deliveryDetails.recipientName || (req.body as any).recipientName || '').trim()
        : '';
      const giftRecipientPhone = isGiftOrder
        ? String(deliveryDetails.recipientPhone || (req.body as any).recipientPhone || '').trim()
        : '';
      const giftMessage = isGiftOrder
        ? String(deliveryDetails.giftMessage || (req.body as any).giftMessage || '')
            .trim()
            .slice(0, 250)
        : '';
      const hideSenderIdentity = Boolean(
        isGiftOrder && (deliveryDetails.hideSenderIdentity || (req.body as any).hideSenderIdentity)
      );
      const buyerName = String(
        deliveryDetails.customerName || (req.body as any).customerName || 'Online Customer'
      ).trim();
      const buyerPhone = String(
        deliveryDetails.customerPhone || (req.body as any).customerPhone || '0800-000-0000'
      ).trim();
      const giftSenderName = isGiftOrder
        ? hideSenderIdentity
          ? 'Anonymous Sender'
          : String(deliveryDetails.senderName || (req.body as any).senderName || buyerName).trim()
        : '';

      if (isGiftOrder && (!giftRecipientName || !giftRecipientPhone)) {
        return res.status(400).json({
          error: 'Gift orders require both a Recipient Name and Recipient Phone Number.',
        });
      }

      const resolvedDeliveryAddress =
        orderType === 'dine-in'
          ? resolvedTableNumber || 'Dine-In Table'
          : orderType === 'takeaway'
          ? 'Takeout / Pickup at Store'
          : deliveryDetails.recipientAddress ||
            deliveryDetails.deliveryAddress ||
            deliveryDetails.address ||
            (req.body as any).deliveryAddress ||
            'Customer Delivery Address';

      const actualDeliveryDetails = {
        customerName: buyerName,
        customerPhone: buyerPhone,
        customerEmail: deliveryDetails.customerEmail || (req.body as any).customerEmail || '',
        deliveryAddress: resolvedDeliveryAddress,
        address: resolvedDeliveryAddress,
        deliveryZone: orderType === 'delivery' ? requestedZone : branchId,
        landmark: deliveryDetails.landmark || (req.body as any).landmark || '',
        deliveryNotes: rawDeliveryInstructions,
        deliveryInstructions: rawDeliveryInstructions,
        preparationNotes: rawPreparationNotes,
        specialOccasionNote: rawSpecialOccasionNote,
        specialOccasionDisclaimerAccepted: Boolean(rawSpecialOccasionNote),
        scheduledTime: deliveryDetails.scheduledTime || (req.body as any).scheduledTime || 'ASAP',
        isGiftOrder,
        recipientName: isGiftOrder ? giftRecipientName : undefined,
        recipientPhone: isGiftOrder ? giftRecipientPhone : undefined,
        recipientAddress: isGiftOrder ? resolvedDeliveryAddress : undefined,
        giftMessage: isGiftOrder ? giftMessage : undefined,
        senderName: isGiftOrder ? giftSenderName : undefined,
        hideSenderIdentity: isGiftOrder ? hideSenderIdentity : undefined,
      };

      const giftDetails = isGiftOrder
        ? {
            isGiftOrder: true,
            recipientName: giftRecipientName,
            recipientPhone: giftRecipientPhone,
            recipientAddress: resolvedDeliveryAddress,
            giftMessage,
            senderName: giftSenderName,
            hideSenderIdentity,
            buyerName,
            buyerPhone,
          }
        : undefined;

      // Server-side payment verification: Never trust unauthenticated client-supplied paymentStatus='paid'
      // without either an authenticated staff session OR a verified gateway transaction record
      const verifiedTxRef = String(paymentReference || (req.body as any).transactionReference || '').trim();
      const verifiedGatewayTx = verifiedTxRef && (db as any).paymentTransactions?.[verifiedTxRef];
      const isVerifiedOnlinePayment = Boolean(verifiedGatewayTx && verifiedGatewayTx.status === 'success');

      let validatedPaymentStatus: 'paid' | 'pending' | 'unpaid' | 'reconciliation_required' = 'pending';
      if (paymentStatus === 'paid' && (reqStaff || isVerifiedOnlinePayment)) {
        validatedPaymentStatus = 'paid';
      } else if (paymentMethod === 'cash_on_delivery') {
        validatedPaymentStatus = 'unpaid';
      } else if (paymentMethod === 'bank_transfer' && orderChannel !== 'pos_counter') {
        validatedPaymentStatus = 'reconciliation_required';
      } else {
        validatedPaymentStatus = 'pending';
      }

      const canReleaseToKitchenImmediately =
        validatedPaymentStatus === 'paid' && packagingRequirementStatus !== 'AWAITING_PACKAGING_APPROVAL';

      const isWholesaleBreadOrder =
        Boolean(req.body.isWholesaleDelivery) ||
        normalizedItems.some((it: any) => Boolean(it.isWholesaleApplied));

      const initialRiderId = req.body.riderId || req.body.posPayment?.riderId || deliveryDetails?.riderId || undefined;
      const initialRiderObj = initialRiderId ? db.riders?.[initialRiderId] : undefined;
      const initialRiderName =
        req.body.riderName ||
        req.body.posPayment?.riderName ||
        deliveryDetails?.riderName ||
        initialRiderObj?.name ||
        undefined;

      const orderRecord: any = {
        id: orderId,
        orderNumber,
        branchId,
        orderType,
        tableId: resolvedTableId,
        tableNumber: resolvedTableNumber,
        items: normalizedItems,
        subtotal: calculatedSubtotal,
        deliveryFee: safeDeliveryFee,
        riderPayoutAmount: snapshotRiderPayout,
        companyDeliveryShare: snapshotCompanyDeliveryShare,
        deliveryZoneId: orderType === 'delivery' ? canonicalZoneQuote.zoneId : undefined,
        deliveryZoneName: orderType === 'delivery' ? canonicalZoneQuote.zoneName : undefined,
        packagingFee: safePackagingFee,
        packagingSkuId: packagingCalc.packagingSkuId,
        packagingQuantity: packagingCalc.packagingQuantity,
        packagingRequirementStatus,
        discount: safeDiscount,
        appliedCouponCode,
        total: calculatedTotal,
        paymentMethod,
        paymentStatus: validatedPaymentStatus,
        deliveryDetails: actualDeliveryDetails,
        isGiftOrder,
        giftDetails,
        orderChannel,
        status: canReleaseToKitchenImmediately ? 'preparing' : 'pending_payment',
        createdAt: now,
        updatedAt: now,
        estimatedDeliveryMinutes: orderType === 'delivery' ? 45 : 20,
        pickupAuthorizationCode: pickupCode,
        deliveryPin: pickupCode,
        isWholesaleBread: isWholesaleBreadOrder,
        dispatchType: orderType === 'delivery' ? (isWholesaleBreadOrder ? 'wholesale_bread' : 'restaurant_meal') : undefined,
        riderId: orderType === 'delivery' ? initialRiderId : undefined,
        riderName: orderType === 'delivery' ? initialRiderName : undefined,
      };

      db.orders[orderId] = orderRecord;

      const checkId = `chk-${orderId}`;
      const checkItems = normalizedItems.map((it: any, idx: number) => {
        const uPrice = Number(it.price || it.unitPrice || 0);
        const qty = Number(it.quantity) || 1;
        return {
          ...it,
          id: it.id ? `item-${orderId}-${idx}` : `chk-item-${Date.now()}-${idx}`,
          productId: it.productId || it.id || it.menuItemId || 'prod-custom',
          menuItemId: it.productId || it.id || it.menuItemId || 'prod-custom',
          name: it.name,
          variantName: it.selectedVariant || undefined,
          quantity: qty,
          unitPrice: uPrice,
          totalPrice: Number(it.totalPrice || (uPrice * qty)),
          notes: it.notes || it.selectedSpiceLevel || '',
          status: canReleaseToKitchenImmediately ? ('sent_to_kitchen' as const) : ('pending' as const),
          sentToKitchenAt: canReleaseToKitchenImmediately ? now : undefined,
        };
      });

      // Keep KDS kitchen display strictly focused on food preparation (no personal gift note or sender identity on KDS screen)
      const kdsSummaryParts = [
        `Online Order #${orderNumber} [${orderType.toUpperCase()}]`,
        isGiftOrder ? '[GIFT ORDER - INCLUDE GIFT SLIP AT PACKING]' : '',
        rawPreparationNotes ? `KITCHEN PREP: ${rawPreparationNotes}` : 'Standard preparation',
        rawSpecialOccasionNote ? `OCCASION REQUEST (Non-binding): "${rawSpecialOccasionNote}"` : '',
      ].filter(Boolean);

      const unifiedCheck: DbCheck = {
        id: checkId,
        orderId,
        checkNumber: orderNumber,
        branchId,
        tableId: resolvedTableId,
        tableNumber: resolvedTableNumber,
        checkType: orderType === 'dine-in' ? 'dine_in' : orderType === 'takeaway' ? 'takeaway' : 'delivery',
        status: canReleaseToKitchenImmediately ? 'sent_to_kitchen' : 'open',
        customerName: isGiftOrder ? `${giftRecipientName} (Gift from ${giftSenderName})` : actualDeliveryDetails.customerName,
        customerPhone: isGiftOrder ? giftRecipientPhone : actualDeliveryDetails.customerPhone,
        guestCount: Math.max(1, Number(req.body.guestCount) || 1),
        items: checkItems,
        subtotal: calculatedSubtotal,
        packagingFee: safePackagingFee,
        deliveryFee: safeDeliveryFee,
        discountAmount: safeDiscount,
        total: calculatedTotal,
        amountPaid: validatedPaymentStatus === 'paid' ? calculatedTotal : 0,
        remainingBalance: validatedPaymentStatus === 'paid' ? 0 : calculatedTotal,
        paymentStatus: validatedPaymentStatus === 'paid' ? 'paid' : 'unpaid',
        paymentMethod: paymentMethod === 'cash_on_delivery' ? 'cash' : paymentMethod,
        openedAt: now,
        openedByStaffId: reqStaff?.id || 'sys-web-storefront',
        openedByName: reqStaff?.name || 'Online Customer Storefront',
        notes: kdsSummaryParts.join(' | '),
      };
      (unifiedCheck as any).packagingSkuId = packagingCalc.packagingSkuId;
      (unifiedCheck as any).packagingQuantity = packagingCalc.packagingQuantity;
      (unifiedCheck as any).packagingRequirementStatus = packagingRequirementStatus;
      (unifiedCheck as any).isGiftOrder = isGiftOrder;
      (unifiedCheck as any).giftDetails = giftDetails;

      db.checks[checkId] = unifiedCheck;

      // Mark table as occupied for Dine-In orders
      if (orderType === 'dine-in' && resolvedTableId && db.tables[resolvedTableId]) {
        db.tables[resolvedTableId].status = 'ordering';
        db.tables[resolvedTableId].currentCheckId = checkId;
        db.tables[resolvedTableId].guestCount = unifiedCheck.guestCount;
        db.tables[resolvedTableId].updatedAt = now;
      }

      // Only create a delivery dispatch task when orderType === 'delivery' (never for dine-in or takeaway/pickup)
      if (orderType === 'delivery') {
        const assignmentHistory = initialRiderId
          ? [
              {
                action: 'assigned',
                riderId: initialRiderId,
                riderName: initialRiderName || 'Assigned Rider',
                assignedByStaffId: reqStaff?.id || 'sys-pos',
                assignedByName: reqStaff?.name || 'POS Dispatch',
                assignedByRole: reqStaff?.role || 'cashier',
                timestamp: now,
                reason: 'Assigned during order creation',
              },
            ]
          : [];

        const dispatchNotesParts = [
          isGiftOrder ? `🎁 GIFT DELIVERY for ${giftRecipientName} (From: ${giftSenderName})` : '',
          rawDeliveryInstructions,
        ].filter(Boolean);

        const deliveryTask: DbDeliveryTask = {
          id: orderId,
          orderId,
          orderNumber,
          branchId,
          customerName: isGiftOrder ? giftRecipientName : actualDeliveryDetails.customerName,
          customerPhone: isGiftOrder ? giftRecipientPhone : actualDeliveryDetails.customerPhone,
          deliveryAddress: actualDeliveryDetails.deliveryAddress,
          deliveryZone: actualDeliveryDetails.deliveryZone,
          landmark: actualDeliveryDetails.landmark,
          orderTotal: calculatedTotal,
          paymentMethod,
          codAmountDue: validatedPaymentStatus === 'paid' ? 0 : (paymentMethod === 'cash_on_delivery' ? calculatedTotal : 0),
          codAmountCollected: 0,
          status: initialRiderId ? 'assigned' : 'pending',
          riderId: initialRiderId,
          riderName: initialRiderName,
          assignedAt: initialRiderId ? now : undefined,
          cashReconciled: validatedPaymentStatus === 'paid',
          pickupAuthorizationCode: pickupCode,
          notes: dispatchNotesParts.join(' • '),
        };
        (deliveryTask as any).checkId = checkId;
        (deliveryTask as any).paymentStatus = validatedPaymentStatus;
        (deliveryTask as any).deliveryFee = safeDeliveryFee;
        (deliveryTask as any).riderPayoutAmount = snapshotRiderPayout;
        (deliveryTask as any).companyDeliveryShare = snapshotCompanyDeliveryShare;
        (deliveryTask as any).deliveryZoneId = canonicalZoneQuote.zoneId;
        (deliveryTask as any).deliveryZoneName = canonicalZoneQuote.zoneName;
        (deliveryTask as any).dispatchType = isWholesaleBreadOrder ? 'wholesale_bread' : 'restaurant_meal';
        (deliveryTask as any).isWholesaleBread = isWholesaleBreadOrder;
        (deliveryTask as any).assignmentHistory = assignmentHistory;
        (deliveryTask as any).isGiftOrder = isGiftOrder;
        (deliveryTask as any).giftDetails = giftDetails;
        (deliveryTask as any).itemsSummary = normalizedItems.map((it: any) => ({
          productId: it.productId,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          isWholesaleApplied: Boolean(it.isWholesaleApplied),
        }));
        db.deliveryTasks[orderId] = deliveryTask;
      }

      // Only deplete inventory and award loyalty points when payment is confirmed
      if (canReleaseToKitchenImmediately) {
        try {
          depleteInventoryForOrder(checkItems, branchId, orderNumber, {
            id: 'sys-web',
            staffId: 'SYS-WEB',
            name: 'Online Ordering Engine',
            role: 'system',
            branchId,
          } as any);
          unifiedCheck.inventoryDepletedAt = now;
        } catch (invErr) {
          console.error('[ORDERS API] Inventory depletion notice:', invErr);
        }

        try {
          awardOrderLoyaltyPointsIfEligible(db, orderRecord, now);
          if ((orderRecord as any).loyaltyPointsEarned && unifiedCheck) {
            (unifiedCheck as any).loyaltyPointsEarned = (orderRecord as any).loyaltyPointsEarned;
          }
        } catch (loyaltyErr) {
          console.error('[ORDERS API] Loyalty auto-award notice:', loyaltyErr);
        }
      }

      saveDatabaseSync();

      try {
        sendCustomerNotification({
          orderId: orderRecord.id,
          orderNumber: orderRecord.orderNumber,
          customerName: orderRecord.deliveryDetails.customerName,
          customerPhone: orderRecord.deliveryDetails.customerPhone,
          channel: 'both',
          eventType: 'ORDER_CONFIRMATION',
          branchId,
          metadata: {
            total: calculatedTotal,
            itemCount: items.length,
            orderType,
          },
        });
      } catch (notifErr) {
        console.error('[NOTIF ENGINE] Automated order confirmation trigger error:', notifErr);
      }

      logAuditEvent(
        orderRecord.deliveryDetails.customerName,
        'online_customer',
        branchId,
        'ORDER_CREATED',
        `Placed ${orderType.toUpperCase()} order #${orderNumber} for ₦${Number(calculatedTotal).toLocaleString()} (${items.length} items, paymentStatus: ${validatedPaymentStatus})`
      );

      res.status(201).json({
        success: true,
        order: orderRecord,
        check: unifiedCheck,
        message: canReleaseToKitchenImmediately
          ? 'Order created, payment verified, routed to kitchen KDS, and queued for dispatch.'
          : 'Order created and awaiting payment confirmation before KDS release.',
      });
    } catch (error: any) {
      console.error('[ORDERS API ERROR]', error);
      res.status(500).json({ error: 'Failed to create order: ' + (error?.message || 'Server error') });
    }
  });

  // Supervisor / Manager Custom Packaging Override & Approval for Online Orders
  router.post('/api/orders/:id/packaging-override', requireAuth, async (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { customPackagingSkuId, customPackagingFee, supervisorPin, reason = 'Manager packaging override' } = req.body || {};
    const currentStaff = (req as any).staff as DbStaffAccount;

    let order = db.orders[id] || Object.values(db.orders).find((o: any) => o.orderNumber === id || o.id === id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const isManager = ['store_manager', 'branch_manager', 'super_admin', 'corporate_admin'].includes(currentStaff.role);
    const supervisor = isManager 
        ? currentStaff 
        : await supervisorAuthService.verifySupervisorPin(currentStaff, order.branchId, supervisorPin || '', 'menu.edit', logAuditEvent);
    
    if (!supervisor) {
      return res.status(403).json({
        error: 'Custom packaging override requires Manager role or a valid Supervisor PIN.',
      });
    }



    const packagingCalc = calculateDefaultPackagingForItems(db, order.items || [], {
      orderType: order.orderType,
      customPackagingSkuId: supervisor ? customPackagingSkuId : undefined,
      customPackagingFee: supervisor && customPackagingFee !== undefined ? Number(customPackagingFee) : undefined,
    });

    const now = new Date().toISOString();
    order.packagingFee = packagingCalc.packagingFee;
    (order as any).packagingSkuId = packagingCalc.packagingSkuId;
    (order as any).packagingQuantity = packagingCalc.packagingQuantity;
    (order as any).packagingRequirementStatus = 'CUSTOM_APPROVED';
    (order as any).packagingApprovedBy = supervisor.name;
    (order as any).packagingApprovedAt = now;
    order.total = Math.max(0, Number(order.subtotal || 0) + Number(order.deliveryFee || 0) + packagingCalc.packagingFee - Number(order.discount || 0));
    order.updatedAt = now;

    const checkId = `chk-${order.id}`;
    const check = db.checks[checkId];
    if (check) {
      check.packagingFee = packagingCalc.packagingFee;
      check.total = order.total;
      check.remainingBalance = Math.max(0, check.total - Number(check.amountPaid || 0));
      (check as any).packagingSkuId = packagingCalc.packagingSkuId;
      (check as any).packagingQuantity = packagingCalc.packagingQuantity;
      (check as any).packagingRequirementStatus = 'CUSTOM_APPROVED';
      if (check.paymentStatus === 'paid' && check.remainingBalance === 0) {
        check.status = 'sent_to_kitchen';
        check.items.forEach((it) => {
          if (it.status === 'pending') {
            it.status = 'sent_to_kitchen';
            it.sentToKitchenAt = now;
          }
        });
      }
    }

    saveDatabaseSync();
    logAuditEvent(
      supervisor.name,
      supervisor.role,
      order.branchId,
      'PACKAGING_OVERRIDE_APPROVED',
      `Approved custom packaging (${packagingCalc.packagingSkuName} @ ₦${packagingCalc.packagingFee.toLocaleString()}) on Order #${order.orderNumber}. Reason: ${reason}`
    );

    return res.json({ success: true, order, check, packagingCalc });
  });

  // Confirm Online Order Payment & Release to KDS + Deplete Inventory
  router.post('/api/orders/:id/confirm-payment', requireAuth, (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { paymentMethod, paymentReference } = req.body || {};
    const currentStaff = (req as any).staff as DbStaffAccount;
    if (currentStaff.role === 'auditor') {
      return res.status(403).json({ error: 'Access denied: Auditor role is strictly read-only.' });
    }

    let order = db.orders[id] || Object.values(db.orders).find((o: any) => o.orderNumber === id || o.id === id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    if ((order as any).packagingRequirementStatus === 'AWAITING_PACKAGING_APPROVAL') {
      return res.status(409).json({
        error: `Order #${order.orderNumber} is currently held in AWAITING_PACKAGING_APPROVAL and cannot be released to KDS until custom packaging is approved.`,
      });
    }

    const now = new Date().toISOString();
    order.paymentStatus = 'paid';
    if (paymentMethod) order.paymentMethod = paymentMethod;
    if (paymentReference) (order as any).paymentReference = paymentReference;
    if (order.status === 'pending_payment' || order.status === 'confirmed') {
      order.status = 'preparing';
    }
    order.updatedAt = now;

    const checkId = `chk-${order.id}`;
    const check = db.checks[checkId];
    if (check) {
      check.paymentStatus = 'paid';
      check.status = 'sent_to_kitchen';
      check.amountPaid = check.total;
      check.remainingBalance = 0;
      check.paidAt = now;
      check.settledByStaffId = currentStaff.id;
      check.settledByName = currentStaff.name;
      check.items.forEach((it) => {
        if (it.status === 'pending') {
          it.status = 'sent_to_kitchen';
          it.sentToKitchenAt = now;
        }
      });

      if (!check.inventoryDepletedAt) {
        depleteInventoryForOrder(check.items, order.branchId, order.orderNumber, currentStaff);
        check.inventoryDepletedAt = now;
      }
    }

    if (db.deliveryTasks[order.id]) {
      (db.deliveryTasks[order.id] as any).paymentStatus = 'paid';
      db.deliveryTasks[order.id].codAmountDue = 0;
      db.deliveryTasks[order.id].cashReconciled = true;
    }

    awardOrderLoyaltyPointsIfEligible(db, order, now);
    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      order.branchId,
      'PAYMENT_CONFIRMED',
      `Confirmed payment for Online Order #${order.orderNumber} (₦${Number(order.total || 0).toLocaleString()}) and released ticket to KDS.`
    );

    return res.json({ success: true, order, check });
  });

  // Public Customer Order Tracking Endpoint (must remain above /api/orders/:id)
  router.get('/api/orders/track', (req, res) => {
    const db = getDb();
    const { orderNumber, phone, orderId, pickupCode } = req.query;

    if (!orderNumber && !orderId) {
      return res.status(400).json({ error: 'Order number or order ID is required to track order.' });
    }

    const cleanOrderNum = String(orderNumber || '').trim().toUpperCase();
    const cleanPhone = String(phone || '').trim().replace(/[^0-9+]/g, '');
    const cleanId = String(orderId || '').trim();
    const cleanPickup = String(pickupCode || '').trim();

    if (!cleanPhone && !cleanPickup) {
      return res.status(400).json({
        error: 'For customer privacy, phone number or pickup code is required to track order status.',
      });
    }

    const matched = Object.values(db.orders).find((o: any) => {
      const oPhone = (o.deliveryDetails?.customerPhone || '').replace(/[^0-9]/g, '');
      const cleanDigits = cleanPhone.replace(/[^0-9]/g, '');
      const isPlaceholderPhone = oPhone === '08000000000' || oPhone.length < 8;
      const phoneMatches =
        !isPlaceholderPhone &&
        cleanDigits.length >= 8 &&
        oPhone.slice(-10) === cleanDigits.slice(-10);
      const pickupMatches = cleanPickup.length >= 4 && o.pickupAuthorizationCode === cleanPickup;

      if (cleanOrderNum && o.orderNumber?.toUpperCase() === cleanOrderNum) {
        return phoneMatches || pickupMatches;
      }
      if (cleanId && o.id === cleanId) {
        return phoneMatches || pickupMatches;
      }
      return false;
    });

    if (!matched) {
      return res.status(404).json({ error: 'Order not found. Please verify your order number and phone number.' });
    }

    res.json({
      id: matched.id,
      orderNumber: matched.orderNumber,
      branchId: matched.branchId,
      orderType: matched.orderType,
      status: matched.status,
      paymentStatus: matched.paymentStatus,
      paymentMethod: matched.paymentMethod,
      items: matched.items?.map((it: any) => ({
        name: it.name,
        quantity: it.quantity,
        price: it.price || it.unitPrice,
      })),
      subtotal: matched.subtotal,
      deliveryFee: matched.deliveryFee,
      packagingFee: matched.packagingFee,
      discount: matched.discount,
      total: matched.total,
      createdAt: matched.createdAt,
      estimatedDeliveryMinutes: matched.estimatedDeliveryMinutes,
      deliveryStatus: matched.deliveryStatus || 'preparing',
    });
  });

  // Mount Customer OTP, Profile, Order Listing/Status & Manager Override Routes
  router.use(createCustomerOtpAndOrderOpsRouter(deps));
  router.use(createStorefrontReviewsAndDeviceRouter(deps));

  return router;
}
