import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  DbDatabase,
  DbStaffAccount,
  DbCmsContent,
} from '../../server_db.ts';
import { createMenuCatalogueRouter } from './menuCatalogueRouter.ts';
import { createPromotionsRouter } from './promotionsAndCfdRouter.ts';

export interface CmsAndMenuRouterDeps {
  getDb: () => DbDatabase;
  saveDatabaseSync: () => void;
  seedCmsAndMenuCatalogue: () => void;
  requireAuth: express.RequestHandler;
  hasPermission: (staff: DbStaffAccount, permissionCode: string) => Promise<boolean>;
  logAuditEvent: (
    staffName: string,
    role: string,
    branchId: string,
    eventType: string,
    description: string
  ) => void;
  uploadsDir: string;
}

import {
  ensureCanonicalDeliveryZones,
  quoteDeliveryFeeForZone,
} from '../services/deliveryFeeAuthorityService.ts';

export const DEFAULT_DELIVERY_ZONES: Record<string, { name: string; fee: number; riderShareAmount: number; companyShareAmount: number; branchId: string; estimatedMinutes: string; active: boolean }> = {
  'GRA Core': { name: 'GRA Flagship & Okogo Environs (Ihama / Adesuwa / Boundary Rd)', fee: 1500, riderShareAmount: 1050, companyShareAmount: 450, branchId: 'gra', estimatedMinutes: '25–35 mins', active: true },
  'Okabere / Sapele Rd': { name: 'Okabere / Upper Sapele Road / Limit Environs', fee: 1500, riderShareAmount: 1050, companyShareAmount: 450, branchId: 'okabere', estimatedMinutes: '25–40 mins', active: true },
  'Ugbowo / Uselu': { name: 'Ugbowo / UNIBEN / Ekosodin / BDPA / Uselu', fee: 1200, riderShareAmount: 850, companyShareAmount: 350, branchId: 'ugbowo', estimatedMinutes: '25–40 mins', active: true },
  'Ring Road / Airport Rd': { name: 'Airport Road / Adesuwa / Ihama Extended', fee: 1800, riderShareAmount: 1250, companyShareAmount: 550, branchId: 'gra', estimatedMinutes: '30–45 mins', active: true },
  'Ekenwan / Siluko': { name: 'Ring Road / Akpakpava / Forestry / Ekenwan', fee: 2000, riderShareAmount: 1400, companyShareAmount: 600, branchId: 'gra', estimatedMinutes: '35–50 mins', active: true },
  Standard: { name: 'Benin City Standard Delivery Zone', fee: 1500, riderShareAmount: 1050, companyShareAmount: 450, branchId: 'gra', estimatedMinutes: '30–45 mins', active: true },
};

export function createCmsAndMenuRouter(deps: CmsAndMenuRouterDeps): express.Router {
  const router = express.Router();
  const {
    getDb,
    saveDatabaseSync,
    seedCmsAndMenuCatalogue,
    requireAuth,
    hasPermission,
    logAuditEvent,
    uploadsDir,
  } = deps;

  // ==========================================
  // 3.55 WEBSITE CONTENT (CMS), DELIVERY ZONES & IMAGE UPLOAD API
  // ==========================================
  router.get('/api/delivery/zones', (_req, res) => {
    const db = getDb() as any;
    if (!db.cmsContent) {
      seedCmsAndMenuCatalogue();
    }
    const schedule = ensureCanonicalDeliveryZones(db);
    const zones = db.cmsContent?.deliveryZones || DEFAULT_DELIVERY_ZONES;
    res.json({
      ...zones,
      _canonicalSchedule: schedule,
    });
  });

  router.post('/api/delivery/quote', (req, res) => {
    const db = getDb() as any;
    const { branchId = 'gra', deliveryZone = 'Standard', address = '' } = req.body || {};
    const quote = quoteDeliveryFeeForZone(db, { branchId, deliveryZone, address });
    res.json({
      zoneId: quote.zoneId,
      zoneKey: quote.zoneKey,
      zoneName: quote.zoneName,
      branchId: quote.branchId,
      customerDeliveryFee: quote.customerDeliveryFee,
      riderShareAmount: quote.riderShareAmount,
      companyShareAmount: quote.companyShareAmount,
      estimatedMinutes: quote.estimatedMinutes,
      currency: 'NGN',
    });
  });

  router.put('/api/delivery/zones', requireAuth, async (req, res) => {
    const db = getDb() as any;
    const currentStaff = (req as any).staff as DbStaffAccount;
    const isAuthorized =
      ['super_admin', 'admin', 'corporate_admin', 'branch_manager', 'content_editor', 'accountant'].includes(currentStaff.role) ||
      await hasPermission(currentStaff, 'content.edit');
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges to update delivery zones.' });
    }
    if (!db.cmsContent) {
      seedCmsAndMenuCatalogue();
    }
    const incomingZones = req.body.deliveryZones || req.body;
    if (!incomingZones || typeof incomingZones !== 'object') {
      return res.status(400).json({ error: 'Valid deliveryZones map is required.' });
    }
    const currentSchedule = ensureCanonicalDeliveryZones(db);
    const updatedSchedule = [...currentSchedule];
    for (const [key, val] of Object.entries(incomingZones)) {
      if (key === '_canonicalSchedule') continue;
      const z = val as any;
      const fee = Math.round(Number(z?.fee ?? z?.customerDeliveryFee));
      if (Number.isNaN(fee) || fee < 0) {
        return res.status(400).json({ error: `Invalid delivery fee for zone '${key}'. Fee must be >= 0.` });
      }
      const existingIdx = updatedSchedule.findIndex((item) => item.zoneKey === key || item.zoneName === key || item.zoneId === key);
      const riderShare = z?.riderShareAmount !== undefined
        ? Math.round(Number(z.riderShareAmount))
        : existingIdx >= 0
        ? Math.min(fee, updatedSchedule[existingIdx].riderShareAmount)
        : Math.round(fee * 0.7);
      const companyShare = Math.max(0, fee - riderShare);
      if (existingIdx >= 0) {
        updatedSchedule[existingIdx] = {
          ...updatedSchedule[existingIdx],
          zoneName: String(z?.name || updatedSchedule[existingIdx].zoneName).trim(),
          customerDeliveryFee: fee,
          riderShareAmount: riderShare,
          companyShareAmount: companyShare,
          estimatedMinutes: String(z?.estimatedMinutes || updatedSchedule[existingIdx].estimatedMinutes || '30–45 mins').trim(),
          isActive: z?.active !== undefined ? Boolean(z.active) : true,
        };
      } else if (key !== 'Standard') {
        updatedSchedule.push({
          zoneId: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          zoneKey: key,
          zoneName: String(z?.name || key).trim(),
          branchId: String(z?.branchId || 'gra'),
          customerDeliveryFee: fee,
          riderShareAmount: riderShare,
          companyShareAmount: companyShare,
          estimatedMinutes: String(z?.estimatedMinutes || '30–45 mins').trim(),
          isActive: z?.active !== undefined ? Boolean(z.active) : true,
        });
      }
    }
    db.riderCompensationConfig.externalRiderZoneSplits = updatedSchedule;
    ensureCanonicalDeliveryZones(db);
    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'DELIVERY_ZONES_UPDATED',
      `Updated canonical delivery zone fee schedule (${updatedSchedule.length} active zones)`
    );
    res.json({
      success: true,
      deliveryZones: db.cmsContent!.deliveryZones,
      externalRiderZoneSplits: updatedSchedule,
    });
  });

  router.post('/api/uploads/image', requireAuth, async (req, res) => {
    const currentStaff = (req as any).staff as DbStaffAccount;
    const isAuthorized =
      ['super_admin', 'admin', 'corporate_admin', 'branch_manager', 'content_editor', 'menu_manager'].includes(
        currentStaff.role
      ) ||
      await hasPermission(currentStaff, 'content.edit') ||
      await hasPermission(currentStaff, 'menu.edit');

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges to upload media files.' });
    }

    const { fileName, mimeType, dataBase64 } = req.body || {};
    if (!fileName || !mimeType || !dataBase64 || typeof dataBase64 !== 'string') {
      return res.status(400).json({ error: 'fileName, mimeType, and dataBase64 are required.' });
    }

    const allowedMime: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    const cleanMime = String(mimeType).toLowerCase().trim();
    const ext = allowedMime[cleanMime];
    if (!ext) {
      return res.status(400).json({ error: `Unsupported image type '${mimeType}'. Allowed types: JPEG, PNG, WebP.` });
    }

    const rawBase64 = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
    let buffer: Buffer;
    try {
      buffer = Buffer.from(rawBase64, 'base64');
    } catch {
      return res.status(400).json({ error: 'Malformed base64 image payload.' });
    }

    const maxBytes = 5 * 1024 * 1024;
    if (buffer.length < 12) {
      return res.status(400).json({ error: 'Uploaded file is empty or corrupted.' });
    }
    if (buffer.length > maxBytes) {
      return res.status(400).json({ error: 'Image exceeds the maximum 5 MB file size limit.' });
    }

    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isWebp =
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    if ((ext === '.jpg' && !isJpeg) || (ext === '.png' && !isPng) || (ext === '.webp' && !isWebp)) {
      return res.status(400).json({
        error: 'Binary file signature does not match the declared image MIME type. Upload rejected.',
      });
    }

    const baseSlug =
      path
        .basename(String(fileName), path.extname(String(fileName)))
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 40) || 'image';
    const uniqueName = `${baseSlug}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`;
    const targetPath = path.join(uploadsDir, uniqueName);

    if (!targetPath.startsWith(uploadsDir)) {
      return res.status(400).json({ error: 'Invalid upload file path.' });
    }

    fs.writeFileSync(targetPath, buffer);
    const publicUrl = `/uploads/${uniqueName}`;

    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'MEDIA_UPLOADED',
      `Uploaded image '${uniqueName}' (${Math.round(buffer.length / 1024)} KB)`
    );

    res.status(201).json({
      success: true,
      filename: uniqueName,
      url: publicUrl,
      sizeBytes: buffer.length,
      mimeType: cleanMime,
    });
  });

  router.delete('/api/uploads/image/:filename', requireAuth, async (req, res) => {
    const currentStaff = (req as any).staff as DbStaffAccount;
    const isAuthorized =
      ['super_admin', 'admin', 'corporate_admin', 'branch_manager', 'content_editor', 'menu_manager'].includes(
        currentStaff.role
      ) ||
      await hasPermission(currentStaff, 'content.edit') ||
      await hasPermission(currentStaff, 'menu.edit');

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges to delete uploaded media.' });
    }

    const safeFilename = path.basename(String(req.params.filename || ''));
    if (!safeFilename || safeFilename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename.' });
    }

    const targetPath = path.join(uploadsDir, safeFilename);
    if (!targetPath.startsWith(uploadsDir) || !fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Uploaded image file not found.' });
    }

    fs.unlinkSync(targetPath);
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'MEDIA_DELETED',
      `Deleted uploaded image '${safeFilename}'`
    );
    res.json({ success: true, message: `Deleted uploaded image ${safeFilename}.` });
  });

  router.get('/api/cms/content', (req, res) => {
    const db = getDb();
    if (!db.cmsContent) {
      seedCmsAndMenuCatalogue();
    }
    if (!db.cmsContent!.deliveryZones) {
      db.cmsContent!.deliveryZones = DEFAULT_DELIVERY_ZONES;
    }
    const viewMode = String(req.query.mode || req.query.view || '').toLowerCase();
    if (viewMode === 'draft' && db.cmsDraft) {
      return res.json(db.cmsDraft);
    }
    if (viewMode === 'editor') {
      return res.json({
        ...db.cmsContent,
        draft: db.cmsDraft || db.cmsContent,
      });
    }
    res.json(db.cmsContent);
  });

  router.put('/api/cms/content', requireAuth, async (req, res) => {
    const db = getDb();
    const currentStaff = (req as any).staff as DbStaffAccount;
    const isAuthorized =
      currentStaff.role === 'super_admin' ||
      currentStaff.role === 'admin' ||
      currentStaff.role === 'corporate_admin' ||
      currentStaff.role === 'branch_manager' ||
      currentStaff.role === 'content_editor' ||
      await hasPermission(currentStaff, 'content.edit') ||
      await hasPermission(currentStaff, 'content.publish');

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges to update website CMS content.' });
    }

    const { hero, contactInfo, banners, articles, status, bankTransferConfig, deliveryZones } = req.body;
    if (!db.cmsContent) {
      seedCmsAndMenuCatalogue();
    }

    const now = new Date().toISOString();
    const baseDraft: DbCmsContent = JSON.parse(JSON.stringify(db.cmsDraft || db.cmsContent));

    if (hero) baseDraft.hero = { ...baseDraft.hero, ...hero };
    if (contactInfo) baseDraft.contactInfo = { ...baseDraft.contactInfo, ...contactInfo };
    if (Array.isArray(banners)) baseDraft.banners = banners;
    if (Array.isArray(articles)) baseDraft.articles = articles;
    if (bankTransferConfig !== undefined) baseDraft.bankTransferConfig = bankTransferConfig;
    if (deliveryZones !== undefined) baseDraft.deliveryZones = deliveryZones;
    baseDraft.updatedAt = now;
    baseDraft.updatedBy = `${currentStaff.name} (${currentStaff.role})`;

    if (status === 'draft') {
      baseDraft.status = 'draft';
      db.cmsDraft = baseDraft;
      saveDatabaseSync();
      logAuditEvent(
        currentStaff.name,
        currentStaff.role,
        currentStaff.branchId,
        'CMS_DRAFT_SAVED',
        `Saved website CMS draft without overwriting live published storefront`
      );
      return res.json({
        success: true,
        mode: 'draft',
        cmsContent: baseDraft,
        publishedContent: db.cmsContent,
      });
    }

    baseDraft.status = 'published';
    baseDraft.publishedAt = now;
    baseDraft.publishedBy = `${currentStaff.name} (${currentStaff.role})`;
    db.cmsContent = JSON.parse(JSON.stringify(baseDraft));
    db.cmsDraft = JSON.parse(JSON.stringify(baseDraft));

    saveDatabaseSync();
    logAuditEvent(
      currentStaff.name,
      currentStaff.role,
      currentStaff.branchId,
      'CMS_CONTENT_PUBLISHED',
      `Published website CMS content to live storefront`
    );

    res.json({ success: true, mode: 'published', cmsContent: db.cmsContent });
  });

  router.use(createMenuCatalogueRouter(deps));
  router.use(createPromotionsRouter());

  return router;
}
