import { Router } from 'express';
import crypto from 'crypto';
import { db, saveDatabaseSync, DbStaffAccount } from '../../server_db';
import type { LoyaltyAndCateringRouterDeps } from './loyaltyAndCateringRouter';
import { createCateringEventsSubRouter } from './cateringEventsSubRouter.ts';

export function createCateringAndHouseAccountsRouter(deps: LoyaltyAndCateringRouterDeps): Router {
  const router = Router();
  const { requireAuth, requireBranchAccess, requireRole, logAuditEvent } = deps;

  router.get('/api/customercare/tickets', requireAuth, requireBranchAccess, (req, res) => {
    const currentStaff = (req as any).staff as DbStaffAccount;
    const isGlobal = ['super_admin', 'corporate_admin', 'auditor', 'customer_care'].includes(currentStaff.role);
    const branchId = isGlobal ? req.query.branchId : currentStaff.branchId;
    const { status } = req.query;
    let list = Object.values(db.customerCareTickets || {});

    if (branchId && branchId !== 'all') {
      list = list.filter((t: any) => t.branchId === branchId);
    }
    if (status && status !== 'all') {
      list = list.filter((t: any) => t.status === status);
    }

    res.json(list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  });

  router.post('/api/customercare/tickets', requireAuth, (req, res) => {
    const currentStaff = (req as any).staff as DbStaffAccount;
    const {
      orderId,
      orderNumber,
      customerName,
      customerPhone,
      branchId,
      category,
      priority,
      description,
    } = req.body;

    if (!customerName || !category || !description) {
      return res.status(400).json({ error: 'Customer name, issue category, and description are required.' });
    }

    const ticketId = `tkt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const count = Object.keys(db.customerCareTickets || {}).length + 1;
    const ticketNumber = `CARE-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    const newTicket = {
      id: ticketId,
      ticketNumber,
      orderId: orderId || '',
      orderNumber: orderNumber || '',
      customerName,
      customerPhone: customerPhone || '',
      branchId: branchId || currentStaff.branchId || 'gra',
      category,
      priority: priority || 'medium',
      status: 'open',
      description,
      createdByStaffId: currentStaff.id,
      createdByStaffName: currentStaff.name,
      createdAt: new Date().toISOString(),
    };

    db.customerCareTickets = db.customerCareTickets || {};
    db.customerCareTickets[ticketId] = newTicket;
    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      newTicket.branchId,
      'CUSTOMER_CARE_TICKET_CREATED',
      `Created Ticket ${ticketNumber} (${category}) for ${customerName}`
    );

    res.json({ success: true, ticket: newTicket });
  });

  router.put('/api/customercare/tickets/:id/resolve', requireAuth, (req, res) => {
    const { id } = req.params;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const { resolutionNotes, compensationType, compensationAmount } = req.body;

    db.customerCareTickets = db.customerCareTickets || {};
    const ticket = db.customerCareTickets[id];
    if (!ticket) {
      return res.status(404).json({ error: 'Customer care ticket not found.' });
    }

    ticket.status = 'resolved';
    ticket.resolutionNotes = resolutionNotes || 'Resolved by customer support';
    ticket.compensationType = compensationType || 'none';
    ticket.compensationAmount = Number(compensationAmount) || 0;
    ticket.resolvedByStaffId = currentStaff.id;
    ticket.resolvedByStaffName = currentStaff.name;
    ticket.resolvedAt = new Date().toISOString();

    saveDatabaseSync();

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      ticket.branchId,
      'CUSTOMER_CARE_TICKET_RESOLVED',
      `Resolved Ticket ${ticket.ticketNumber}: ${resolutionNotes || 'Closed'}`
    );

    res.json({ success: true, ticket });
  });

  router.get(
    '/api/house-accounts',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager', 'store_manager', 'cashier']),
    (_req, res) => {
      const accounts = Object.values(db.houseAccounts || {});

      const totalAccounts = accounts.length;
      const totalCreditLimit = accounts.reduce((sum: number, a: any) => sum + Number(a.creditLimit || 0), 0);
      const totalOutstanding = accounts.reduce((sum: number, a: any) => sum + Number(a.currentBalance || 0), 0);
      const totalAvailableCredit = Math.max(0, totalCreditLimit - totalOutstanding);

      res.json({
        accounts,
        stats: {
          totalAccounts,
          totalCreditLimit,
          totalOutstanding,
          totalAvailableCredit,
        },
      });
    }
  );

  router.post(
    '/api/house-accounts',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'accountant', 'branch_manager', 'store_manager']),
    (req, res) => {
      const currentStaff = (req as any).staff as DbStaffAccount;
      const {
        companyName,
        accountCode,
        contactPerson,
        phone,
        email,
        address,
        creditLimit,
        paymentTerms = 'net_30',
        authorizedSigners = [],
        preferredBranchId = 'all',
        billingNotes,
      } = req.body;

      if (!companyName || !contactPerson || !phone || !creditLimit) {
        return res.status(400).json({ error: 'Company name, contact person, phone, and credit limit are required.' });
      }

      const accountId = `house-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
      const generatedCode = accountCode || `CHOP-CORP-${String(Object.keys(db.houseAccounts || {}).length + 1).padStart(4, '0')}`;

      const newAccount = {
        id: accountId,
        companyName: companyName.trim(),
        accountCode: generatedCode.toUpperCase(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : '',
        address: address || 'Benin City, Edo State',
        creditLimit: Number(creditLimit),
        currentBalance: 0,
        paymentTerms,
        authorizedSigners: Array.isArray(authorizedSigners) ? authorizedSigners : [],
        status: 'active',
        preferredBranchId,
        billingNotes: billingNotes || '',
        createdAt: new Date().toISOString(),
      };

      db.houseAccounts = db.houseAccounts || {};
      db.houseAccounts[accountId] = newAccount;
      saveDatabaseSync();

      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'HOUSE_ACCOUNT_CREATED',
        `Created corporate account for ${newAccount.companyName} (${newAccount.accountCode}) with credit limit ₦${newAccount.creditLimit.toLocaleString()}`
      );

      res.json({ success: true, account: newAccount });
    }
  );

  router.get(
    '/api/house-accounts/:id',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'accountant', 'auditor', 'branch_manager', 'store_manager', 'cashier']),
    (req, res) => {
      const { id } = req.params;
      const account = (db.houseAccounts || {})[id];
      if (!account) return res.status(404).json({ error: 'Corporate house account not found.' });

      const charges = (db.houseAccountCharges || [])
        .filter((chg: any) => chg.accountId === id)
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const payments = (db.houseAccountPayments || [])
        .filter((pmt: any) => pmt.accountId === id)
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({ account, charges, payments });
    }
  );

  router.put(
    '/api/house-accounts/:id',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'accountant', 'branch_manager', 'store_manager']),
    (req, res) => {
      const { id } = req.params;
      const currentStaff = (req as any).staff as DbStaffAccount;
      const account = (db.houseAccounts || {})[id];
      if (!account) return res.status(404).json({ error: 'Corporate house account not found.' });

      const {
        companyName,
        contactPerson,
        phone,
        email,
        address,
        creditLimit,
        paymentTerms,
        authorizedSigners,
        status,
        preferredBranchId,
        billingNotes,
      } = req.body;

      if (companyName) account.companyName = companyName.trim();
      if (contactPerson) account.contactPerson = contactPerson.trim();
      if (phone) account.phone = phone.trim();
      if (email !== undefined) account.email = email.trim();
      if (address) account.address = address;
      if (creditLimit !== undefined) account.creditLimit = Number(creditLimit);
      if (paymentTerms) account.paymentTerms = paymentTerms;
      if (authorizedSigners) account.authorizedSigners = authorizedSigners;
      if (status) account.status = status;
      if (preferredBranchId) account.preferredBranchId = preferredBranchId;
      if (billingNotes !== undefined) account.billingNotes = billingNotes;

      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'HOUSE_ACCOUNT_UPDATED',
        `Updated corporate house account ${account.companyName} (${account.accountCode})`
      );

      res.json({ success: true, account });
    }
  );

  router.post(
    '/api/house-accounts/:id/charge',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'accountant', 'branch_manager', 'store_manager', 'cashier']),
    (req, res) => {
      const { id } = req.params;
      const currentStaff = (req as any).staff as DbStaffAccount;
      const account = (db.houseAccounts || {})[id];
      if (!account) return res.status(404).json({ error: 'Corporate house account not found.' });

      const { amount, authorizedSigner, department, orderId, checkNumber, notes } = req.body;
      const chargeAmt = Number(amount);
      if (isNaN(chargeAmt) || chargeAmt <= 0) {
        return res.status(400).json({ error: 'A positive charge amount is required.' });
      }

      const projectedBalance = Number(account.currentBalance || 0) + chargeAmt;
      if (projectedBalance > account.creditLimit) {
        return res.status(400).json({
          error: `Charge exceeds credit limit. Current: ₦${account.currentBalance.toLocaleString()}, Charge: ₦${chargeAmt.toLocaleString()}, Limit: ₦${account.creditLimit.toLocaleString()}`,
        });
      }

      account.currentBalance = projectedBalance;
      const now = new Date().toISOString();
      const newCharge = {
        id: `hchg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        accountId: account.id,
        companyName: account.companyName,
        orderId: orderId || '',
        checkNumber: checkNumber || `INV-${Date.now().toString().slice(-6)}`,
        amount: chargeAmt,
        authorizedSigner: authorizedSigner || account.contactPerson,
        department: department || 'General Executive Catering',
        branchId: currentStaff.branchId || 'gra',
        timestamp: now,
        staffName: currentStaff.name,
        status: 'unbilled',
        notes: notes || '',
      };

      db.houseAccountCharges = db.houseAccountCharges || [];
      db.houseAccountCharges.push(newCharge);
      saveDatabaseSync();

      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'HOUSE_ACCOUNT_CHARGED',
        `Charged ₦${chargeAmt.toLocaleString()} to ${account.companyName} by signer ${newCharge.authorizedSigner}`
      );

      res.json({ success: true, account, charge: newCharge });
    }
  );

  router.post(
    '/api/house-accounts/:id/payments',
    requireAuth,
    requireRole(['super_admin', 'corporate_admin', 'admin', 'accountant', 'branch_manager', 'store_manager']),
    (req, res) => {
      const { id } = req.params;
      const currentStaff = (req as any).staff as DbStaffAccount;
      const account = (db.houseAccounts || {})[id];
      if (!account) return res.status(404).json({ error: 'Corporate house account not found.' });

      const { amount, paymentMethod = 'bank_transfer', bankReference, notes } = req.body;
      const payAmt = Number(amount);
      if (isNaN(payAmt) || payAmt <= 0) {
        return res.status(400).json({ error: 'A valid payment amount is required.' });
      }

      const prevBal = Number(account.currentBalance || 0);
      const newBal = Math.max(0, prevBal - payAmt);
      account.currentBalance = newBal;

      const now = new Date().toISOString();
      const pmtId = `hpmt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      const receiptNumber = `REC-CORP-${Date.now().toString().slice(-6)}`;
      const paymentRecord = {
        id: pmtId,
        accountId: account.id,
        companyName: account.companyName,
        amount: payAmt,
        paymentMethod,
        bankReference: bankReference || `REF-${Date.now().toString().slice(-8)}`,
        receiptNumber,
        receivedByStaffName: currentStaff.name,
        timestamp: now,
        notes: notes || 'Corporate statement remittance settlement',
      };

      db.houseAccountPayments = db.houseAccountPayments || [];
      db.houseAccountPayments.push(paymentRecord);

      saveDatabaseSync();

      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'HOUSE_ACCOUNT_PAYMENT',
        `Recorded remittance of ₦${payAmt.toLocaleString()} from ${account.companyName} (${account.accountCode}). Receipt: ${receiptNumber}`
      );

      res.json({ success: true, account, payment: paymentRecord });
    }
  );

  router.get('/api/house-accounts/:id/statement', requireAuth, (req, res) => {
    const { id } = req.params;
    const account = (db.houseAccounts || {})[id];
    if (!account) return res.status(404).json({ error: 'Corporate house account not found.' });

    const charges = (db.houseAccountCharges || []).filter((chg: any) => chg.accountId === id);
    const payments = (db.houseAccountPayments || []).filter((pmt: any) => pmt.accountId === id);

    const totalBilled = charges.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
    const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const netDue = Math.max(0, totalBilled - totalPaid);

    res.json({
      statementDate: new Date().toISOString(),
      account,
      totalBilled,
      totalPaid,
      netDue,
      charges,
      payments,
    });
  });

  router.use(createCateringEventsSubRouter(deps));

  return router;
}
