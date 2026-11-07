import { Router } from 'express';
import type { DbStaffAccount } from '../../server_db.ts';
import { supervisorAuthService } from '../services/supervisorAuthService.ts';

export interface PosManagerOverrideDeps {
  requireAuth: any;
  logAuditEvent: (
    staffName: string,
    staffRole: string,
    branchId: string,
    actionType: string,
    details: string,
    metadata?: Record<string, any>
  ) => void;
}

export function createPosManagerOverrideRouter(deps: PosManagerOverrideDeps): Router {
  const router = Router();
  const { requireAuth, logAuditEvent } = deps;

  router.post('/api/pos/manager-override', requireAuth, async (req, res) => {
    const { pin, supervisorPin, action, actionType, reason, checkId } = req.body || {};
    const rawPin = pin ?? supervisorPin;
    const effectiveAction = action || actionType;
    const currentStaff = (req as any).staff as DbStaffAccount;

    if (!rawPin) {
      return res.status(400).json({ error: 'Manager PIN is required.' });
    }

    const cleanPin = rawPin.toString().trim();

    try {
      const supervisor = await supervisorAuthService.verifySupervisorPin(
        currentStaff,
        currentStaff.branchId, 
        cleanPin, 
        effectiveAction === 'void' ? 'pos.item.void' : 'pos.check.settle', // Map action to permission
        logAuditEvent
      );

      if (!supervisor) {
        logAuditEvent(
          currentStaff.name,
          currentStaff.role,
          currentStaff.branchId,
          'SECURITY_ALERT',
          `Unauthorized manager override attempt by ${currentStaff.name} for ${effectiveAction || 'action'}`
        );
        return res.status(403).json({ error: 'Invalid supervisor PIN or unauthorized role. Authorization denied.' });
      }

      logAuditEvent(
        supervisor.name,
        supervisor.role,
        currentStaff.branchId,
        'MANAGER_OVERRIDE',
        `Manager ${supervisor.name} authorized ${effectiveAction || 'override'} on check ${checkId || 'N/A'}. Reason: ${reason || 'Approved'}. Initiated by: ${currentStaff.name}`
      );

      res.json({
        authorized: true,
        supervisor: {
          id: supervisor.id,
          name: supervisor.name,
          role: supervisor.role,
          staffId: supervisor.staffId,
        },
      });
    } catch (err) {
      console.error('[Manager Override Error]', err);
      res.status(500).json({ error: 'Internal server error during PIN verification.' });
    }
  });

  return router;
}
