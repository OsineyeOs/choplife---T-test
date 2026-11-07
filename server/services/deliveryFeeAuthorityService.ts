import type { DbDatabase } from '../../server_db.ts';

export interface CanonicalDeliveryZoneScheduleItem {
  zoneId: string;
  zoneKey: string;
  zoneName: string;
  branchId: string;
  customerDeliveryFee: number;
  riderShareAmount: number;
  companyShareAmount: number;
  estimatedMinutes: string;
  isActive: boolean;
}

export const CANONICAL_DELIVERY_ZONE_SCHEDULE: CanonicalDeliveryZoneScheduleItem[] = [
  {
    zoneId: 'zone-gra-core',
    zoneKey: 'GRA Core',
    zoneName: 'GRA Flagship & Okogo Environs (Ihama / Adesuwa / Boundary Rd)',
    branchId: 'gra',
    customerDeliveryFee: 1500,
    riderShareAmount: 1050,
    companyShareAmount: 450,
    estimatedMinutes: '25–35 mins',
    isActive: true,
  },
  {
    zoneId: 'zone-okabere',
    zoneKey: 'Okabere / Sapele Rd',
    zoneName: 'Okabere / Upper Sapele Road / Limit Environs',
    branchId: 'okabere',
    customerDeliveryFee: 1500,
    riderShareAmount: 1050,
    companyShareAmount: 450,
    estimatedMinutes: '25–40 mins',
    isActive: true,
  },
  {
    zoneId: 'zone-ugbowo',
    zoneKey: 'Ugbowo / Uselu',
    zoneName: 'Ugbowo / UNIBEN / Ekosodin / BDPA / Uselu',
    branchId: 'ugbowo',
    customerDeliveryFee: 1200,
    riderShareAmount: 850,
    companyShareAmount: 350,
    estimatedMinutes: '25–40 mins',
    isActive: true,
  },
  {
    zoneId: 'zone-airport-rd',
    zoneKey: 'Ring Road / Airport Rd',
    zoneName: 'Airport Road / Adesuwa / Ihama Extended',
    branchId: 'gra',
    customerDeliveryFee: 1800,
    riderShareAmount: 1250,
    companyShareAmount: 550,
    estimatedMinutes: '30–45 mins',
    isActive: true,
  },
  {
    zoneId: 'zone-ringroad',
    zoneKey: 'Ekenwan / Siluko',
    zoneName: 'Ring Road / Akpakpava / Forestry / Ekenwan',
    branchId: 'gra',
    customerDeliveryFee: 2000,
    riderShareAmount: 1400,
    companyShareAmount: 600,
    estimatedMinutes: '35–50 mins',
    isActive: true,
  },
];

export function ensureCanonicalDeliveryZones(db: DbDatabase & Record<string, any>): CanonicalDeliveryZoneScheduleItem[] {
  if (!db.riderCompensationConfig) {
    db.riderCompensationConfig = {
      internalRiderConfig: {
        monthlyBaseSalary: 25000,
        perDeliveryFee: 200,
        currency: 'NGN',
        updatedAt: new Date().toISOString(),
        updatedBy: 'System Default',
      },
      externalRiderZoneSplits: JSON.parse(JSON.stringify(CANONICAL_DELIVERY_ZONE_SCHEDULE)),
    };
  }
  const existingSplits: any[] = Array.isArray(db.riderCompensationConfig.externalRiderZoneSplits)
    ? db.riderCompensationConfig.externalRiderZoneSplits
    : [];

  if (existingSplits.length === 0) {
    db.riderCompensationConfig.externalRiderZoneSplits = JSON.parse(JSON.stringify(CANONICAL_DELIVERY_ZONE_SCHEDULE));
  } else {
    db.riderCompensationConfig.externalRiderZoneSplits = existingSplits.map((z, idx) => {
      const fallback = CANONICAL_DELIVERY_ZONE_SCHEDULE[idx] || CANONICAL_DELIVERY_ZONE_SCHEDULE[0];
      const fee = Math.max(0, Math.round(Number(z.customerDeliveryFee ?? fallback.customerDeliveryFee)));
      const rShare = Math.max(0, Math.round(Number(z.riderShareAmount ?? z.externalRiderShare ?? Math.round(fee * 0.7))));
      const cShare = Math.max(0, fee - rShare);
      return {
        zoneId: z.zoneId || fallback.zoneId || `zone-${idx + 1}`,
        zoneKey: z.zoneKey || fallback.zoneKey || z.zoneName || `Zone ${idx + 1}`,
        zoneName: z.zoneName || fallback.zoneName,
        branchId: z.branchId || fallback.branchId || 'gra',
        customerDeliveryFee: fee,
        riderShareAmount: rShare,
        companyShareAmount: cShare,
        externalRiderShare: rShare,
        companyShare: cShare,
        estimatedMinutes: z.estimatedMinutes || fallback.estimatedMinutes || '30–45 mins',
        isActive: z.isActive !== undefined ? Boolean(z.isActive) : true,
      };
    });
  }

  // Synchronize cmsContent.deliveryZones map with the authoritative schedule
  const syncedMap: Record<string, {
    zoneId: string;
    name: string;
    fee: number;
    riderShareAmount: number;
    companyShareAmount: number;
    branchId: string;
    estimatedMinutes: string;
    active: boolean;
  }> = {};

  for (const item of db.riderCompensationConfig.externalRiderZoneSplits as CanonicalDeliveryZoneScheduleItem[]) {
    const key = item.zoneKey || item.zoneName;
    syncedMap[key] = {
      zoneId: item.zoneId,
      name: item.zoneName,
      fee: item.customerDeliveryFee,
      riderShareAmount: item.riderShareAmount,
      companyShareAmount: item.companyShareAmount,
      branchId: item.branchId,
      estimatedMinutes: item.estimatedMinutes || '30–45 mins',
      active: item.isActive !== false,
    };
  }
  // Always ensure 'Standard' fallback key exists pointing to GRA/Okabere ₦1,500 standard
  if (!syncedMap.Standard) {
    const primary = db.riderCompensationConfig.externalRiderZoneSplits[0] || CANONICAL_DELIVERY_ZONE_SCHEDULE[0];
    syncedMap.Standard = {
      zoneId: primary.zoneId,
      name: 'Benin City Standard Delivery Zone',
      fee: primary.customerDeliveryFee,
      riderShareAmount: primary.riderShareAmount,
      companyShareAmount: primary.companyShareAmount,
      branchId: primary.branchId || 'gra',
      estimatedMinutes: '30–45 mins',
      active: true,
    };
  }

  if (db.cmsContent) {
    db.cmsContent.deliveryZones = syncedMap;
  }
  if (db.cmsDraft) {
    db.cmsDraft.deliveryZones = syncedMap;
  }

  return db.riderCompensationConfig.externalRiderZoneSplits;
}

export function quoteDeliveryFeeForZone(
  db: DbDatabase & Record<string, any>,
  params: { branchId?: string; deliveryZone?: string; address?: string }
): CanonicalDeliveryZoneScheduleItem {
  const schedule = ensureCanonicalDeliveryZones(db).filter((z) => z.isActive !== false);
  const rawZone = String(params.deliveryZone || '').trim().toLowerCase();
  const rawAddr = String(params.address || '').trim().toLowerCase();
  const branch = String(params.branchId || 'gra').trim().toLowerCase();

  // 1. Exact or substring match on zoneId, zoneKey, or zoneName
  if (rawZone && rawZone !== 'standard') {
    const byZone = schedule.find(
      (z) =>
        z.zoneId.toLowerCase() === rawZone ||
        z.zoneKey.toLowerCase() === rawZone ||
        z.zoneName.toLowerCase() === rawZone ||
        z.zoneName.toLowerCase().includes(rawZone) ||
        rawZone.includes(z.zoneKey.toLowerCase())
    );
    if (byZone) return byZone;
  }

  // 2. Match by address keywords
  if (rawAddr) {
    if (rawAddr.includes('ugbowo') || rawAddr.includes('uniben') || rawAddr.includes('ekosodin') || rawAddr.includes('uselu') || rawAddr.includes('bdpa')) {
      const match = schedule.find((z) => z.zoneId === 'zone-ugbowo' || z.branchId === 'ugbowo');
      if (match) return match;
    }
    if (rawAddr.includes('okabere') || rawAddr.includes('sapele') || rawAddr.includes('limit')) {
      const match = schedule.find((z) => z.zoneId === 'zone-okabere' || z.branchId === 'okabere');
      if (match) return match;
    }
    if (rawAddr.includes('ring road') || rawAddr.includes('akpakpava') || rawAddr.includes('forestry') || rawAddr.includes('ekenwan') || rawAddr.includes('siluko')) {
      const match = schedule.find((z) => z.zoneId === 'zone-ringroad');
      if (match) return match;
    }
    if (rawAddr.includes('airport')) {
      const match = schedule.find((z) => z.zoneId === 'zone-airport-rd');
      if (match) return match;
    }
    if (rawAddr.includes('gra') || rawAddr.includes('ihama') || rawAddr.includes('adesuwa') || rawAddr.includes('okogo')) {
      const match = schedule.find((z) => z.zoneId === 'zone-gra-core');
      if (match) return match;
    }
  }

  // 3. Match by selected branchId
  const byBranch = schedule.find((z) => z.branchId.toLowerCase() === branch);
  if (byBranch) return byBranch;

  return schedule[0] || CANONICAL_DELIVERY_ZONE_SCHEDULE[0];
}
