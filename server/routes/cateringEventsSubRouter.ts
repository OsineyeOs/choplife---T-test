import { Router } from 'express';
import { db, saveDatabaseSync, DbStaffAccount } from '../../server_db.ts';
import type { LoyaltyAndCateringRouterDeps } from './loyaltyAndCateringRouter.ts';

export function createCateringEventsSubRouter(deps: LoyaltyAndCateringRouterDeps): Router {
  const router = Router();
  const { requireAuth, requireBranchAccess, logAuditEvent } = deps;

  router.get('/api/catering/events', requireAuth, requireBranchAccess, (req, res) => {
    const { branchId, status } = req.query;
    let list = Object.values(db.cateringEvents || {});

    if (branchId && branchId !== 'all') {
      list = list.filter((e: any) => e.branchId === branchId);
    }
    if (status && status !== 'all') {
      list = list.filter((e: any) => e.status === status);
    }

    res.json(list.sort((a: any, b: any) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()));
  });

  router.post('/api/catering/events', requireAuth, (req, res) => {
    const currentStaff = (req as any).staff as DbStaffAccount;
    const {
      branchId = currentStaff.branchId,
      clientName,
      clientPhone,
      clientEmail,
      eventDate,
      eventTime = '12:00',
      venueAddress,
      guestCount = 50,
      packageStyle = 'Small Chops Feast Box',
      packageTier = 'Corporate Premium',
      totalBudget = 0,
      depositAmount = 0,
      specialInstructions = '',
      menuItems = [],
    } = req.body;

    if (!clientName || !clientPhone || !eventDate) {
      res.status(400).json({ error: 'Client name, phone, and event date are required.' });
      return;
    }

    const parsedGuests = parseInt(String(guestCount), 10);
    if (isNaN(parsedGuests) || parsedGuests < 1 || parsedGuests > 100000) {
      res.status(400).json({ error: 'Guest count must be a valid positive integer between 1 and 100,000.' });
      return;
    }

    const id = `cat-${Date.now()}`;
    const contractNumber = `CAT-${new Date().getFullYear()}-${String(Object.keys(db.cateringEvents || {}).length + 1).padStart(4, '0')}`;
    const now = new Date().toISOString();

    const eventRecord = {
      id,
      contractNumber,
      branchId,
      clientName,
      clientPhone,
      clientEmail: clientEmail || '',
      eventDate,
      eventTime,
      venueAddress: venueAddress || 'To be specified',
      guestCount: parsedGuests,
      packageStyle,
      packageTier,
      totalBudget: Number(totalBudget) || 0,
      depositAmount: Number(depositAmount) || 0,
      balanceDue: Math.max(0, (Number(totalBudget) || 0) - (Number(depositAmount) || 0)),
      status: Number(depositAmount) > 0 ? 'deposit_paid' : 'inquiry',
      specialInstructions,
      menuItems,
      createdByStaffId: currentStaff.id,
      createdByName: currentStaff.name,
      createdAt: now,
      updatedAt: now,
    };

    if (!db.cateringEvents) db.cateringEvents = {};
    db.cateringEvents[id] = eventRecord;
    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      branchId,
      'CATERING_CONTRACT_CREATED',
      `Created catering contract ${contractNumber} for ${clientName} (${guestCount} guests, budget: ₦${eventRecord.totalBudget.toLocaleString()})`
    );

    res.status(201).json({ success: true, cateringEvent: eventRecord });
  });

  router.put('/api/catering/events/:id/status', requireAuth, (req, res) => {
    const { id } = req.params;
    const { status, depositAmount, notes } = req.body;
    const currentStaff = (req as any).staff as DbStaffAccount;

    const event = (db.cateringEvents || {})[id];
    if (!event) {
      res.status(404).json({ error: 'Catering event contract not found.' });
      return;
    }

    const oldStatus = event.status;
    if (status) event.status = status;
    if (depositAmount !== undefined) {
      event.depositAmount = Number(depositAmount);
      event.balanceDue = Math.max(0, event.totalBudget - event.depositAmount);
    }
    if (notes) event.specialInstructions = `${event.specialInstructions ? event.specialInstructions + ' | ' : ''}${notes}`;
    event.updatedAt = new Date().toISOString();

    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      event.branchId,
      'CATERING_STATUS_CHANGED',
      `Updated catering contract ${event.contractNumber} status from ${oldStatus} to ${event.status}`
    );

    res.json({ success: true, cateringEvent: event });
  });

  return router;
}
