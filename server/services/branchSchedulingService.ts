/**
 * Choplife Republic — Authoritative Branch Scheduling & Operating Hours Service
 * 
 * Enforces authoritative operating hours in West Africa Time (WAT, UTC+1, 'Africa/Lagos'):
 * - GRA: Staff 07:00–19:00 | Public 08:00–19:00 | Daily (Mon–Sun) | Bakery 07:30–19:00
 * - Okabere: Staff 06:30–21:00 | Public 08:00–21:00 | Daily (Mon–Sun) | Bakery 08:00–20:30
 * - Ugbowo: Staff 07:00–18:00 | Public 08:00–18:00 | Mon–Sat (Closed Sundays) | Bakery 08:00–18:00
 */

export interface BranchScheduleModel {
  branchId: string;
  name: string;
  shortName: string;
  timeZone: string;
  openTime: string;          // Public customer opening (e.g. '08:00')
  closeTime: string;         // Public customer closing (e.g. '19:00', '21:00', '18:00')
  staffOpenTime: string;     // Staff shift opening (e.g. '07:00', '06:30')
  staffCloseTime: string;    // Staff shift closing (e.g. '19:00', '21:00', '18:00')
  operatingDays: string[];   // ['monday', 'tuesday', ...]
  closedDays: string[];      // ['sunday'] for ugbowo
  isOperational: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  dineInEnabled: boolean;
  cateringEnabled: boolean;
  bakeryHours?: string;
  deliveryHours?: string;
}

export const AUTHORITATIVE_SCHEDULES: Record<string, BranchScheduleModel> = {
  gra: {
    branchId: 'gra',
    name: 'Choplife Republic — GRA Flagship',
    shortName: 'GRA Branch',
    timeZone: 'Africa/Lagos',
    openTime: '08:00',
    closeTime: '19:00',
    staffOpenTime: '07:00',
    staffCloseTime: '19:00',
    operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    closedDays: [],
    isOperational: true,
    deliveryEnabled: true,
    pickupEnabled: true,
    dineInEnabled: true,
    cateringEnabled: true,
    bakeryHours: '07:30–19:00',
    deliveryHours: '08:00–17:00',
  },
  okabere: {
    branchId: 'okabere',
    name: 'Choplife Republic — Okabere Hub',
    shortName: 'Okabere Branch',
    timeZone: 'Africa/Lagos',
    openTime: '08:00',
    closeTime: '21:00',
    staffOpenTime: '06:30',
    staffCloseTime: '21:00',
    operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    closedDays: [],
    isOperational: true,
    deliveryEnabled: true,
    pickupEnabled: true,
    dineInEnabled: true,
    cateringEnabled: false,
    bakeryHours: '08:00–20:30',
    deliveryHours: '08:00–17:00',
  },
  ugbowo: {
    branchId: 'ugbowo',
    name: 'Choplife Republic — Ugbowo Campus Hub',
    shortName: 'Ugbowo Branch',
    timeZone: 'Africa/Lagos',
    openTime: '08:00',
    closeTime: '18:00',
    staffOpenTime: '07:00',
    staffCloseTime: '18:00',
    operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    closedDays: ['sunday'],
    isOperational: true,
    deliveryEnabled: true,
    pickupEnabled: true,
    dineInEnabled: true,
    cateringEnabled: false,
    bakeryHours: '08:00–18:00',
    deliveryHours: '08:00–17:00',
  },
};

/**
 * Returns current date and time components in West Africa Time (Africa/Lagos, UTC+1).
 */
export function getLagosDateTime(referenceDate = new Date()): {
  dayOfWeek: string;
  time24: string;
  hour: number;
  minute: number;
  isoDate: string;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(referenceDate);
  const weekday = (parts.find((p) => p.type === 'weekday')?.value || '').toLowerCase();
  const year = parts.find((p) => p.type === 'year')?.value || '2026';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  let hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  if (hour === 24) hour = 0; // Handle midnight boundary in 24-hr format
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);

  const time24 = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const isoDate = `${year}-${month}-${day}`;

  return { dayOfWeek: weekday, time24, hour, minute, isoDate };
}

/**
 * Resolves the authoritative schedule for a branch from dynamic DB settings, falling back to baseline.
 */
export function resolveBranchSchedule(branchId: string, settings?: any): BranchScheduleModel {
  const key = String(branchId || 'gra').toLowerCase();
  const fallback = AUTHORITATIVE_SCHEDULES[key] || AUTHORITATIVE_SCHEDULES.gra;

  const dbConfig = settings?.operations?.branchSchedules?.[key];
  if (!dbConfig) {
    return fallback;
  }

  return {
    ...fallback,
    openTime: dbConfig.openTime || fallback.openTime,
    closeTime: dbConfig.closeTime || fallback.closeTime,
    staffOpenTime: dbConfig.staffOpenTime || fallback.staffOpenTime,
    staffCloseTime: dbConfig.staffCloseTime || fallback.staffCloseTime,
    operatingDays: Array.isArray(dbConfig.operatingDays) && dbConfig.operatingDays.length > 0
      ? dbConfig.operatingDays.map((d: string) => d.toLowerCase())
      : fallback.operatingDays,
    closedDays: Array.isArray(dbConfig.closedDays)
      ? dbConfig.closedDays.map((d: string) => d.toLowerCase())
      : fallback.closedDays,
    isOperational: dbConfig.isOperational !== false,
    deliveryEnabled: dbConfig.deliveryEnabled !== false,
    pickupEnabled: dbConfig.pickupEnabled !== false,
    dineInEnabled: dbConfig.dineInEnabled !== false,
    cateringEnabled: Boolean(dbConfig.cateringEnabled),
    bakeryHours: dbConfig.bakeryHours || fallback.bakeryHours,
    deliveryHours: dbConfig.deliveryHours || fallback.deliveryHours,
  };
}

export interface BranchOperatingStatus {
  branchId: string;
  name: string;
  shortName: string;
  isOpen: boolean;             // Public customer ordering open
  isStaffActive: boolean;      // Staff currently on active schedule
  isOperational: boolean;
  currentTimeWat: string;
  currentDayWat: string;
  publicHours: string;
  staffHours: string;
  bakeryHours?: string;
  deliveryHours?: string;
  operatingDaysLabel: string;
  reason?: string;
  nextOpenNotice?: string;
}

/**
 * Evaluates whether a branch is open for public customer ordering.
 * Enforces opening boundary (time24 >= openTime) and closing boundary (time24 < closeTime).
 */
export function evaluateBranchOperatingStatus(
  branchId: string,
  referenceDate = new Date(),
  settings?: any
): BranchOperatingStatus {
  const schedule = resolveBranchSchedule(branchId, settings);
  const { dayOfWeek, time24 } = getLagosDateTime(referenceDate);

  const isClosedDay = schedule.closedDays.includes(dayOfWeek) || !schedule.operatingDays.includes(dayOfWeek);

  // 1. Staff Active Window: staffOpenTime <= time24 < staffCloseTime
  const isStaffActive =
    !isClosedDay &&
    schedule.isOperational &&
    Boolean(schedule.staffOpenTime && schedule.staffCloseTime) &&
    time24 >= schedule.staffOpenTime &&
    time24 < schedule.staffCloseTime;

  // 2. Public Open Window: openTime <= time24 < closeTime
  let isOpen = false;
  let reason = '';
  let nextOpenNotice = '';

  const operatingDaysLabel = schedule.closedDays.includes('sunday')
    ? 'Mon–Sat (Closed Sundays)'
    : 'Daily (Mon–Sun)';

  if (!schedule.isOperational) {
    isOpen = false;
    reason = `${schedule.shortName} is temporarily paused for operations by store management.`;
  } else if (isClosedDay) {
    isOpen = false;
    reason = `${schedule.shortName} is closed on ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}s.`;
    nextOpenNotice = `Next open on Monday at ${schedule.openTime} WAT.`;
  } else if (time24 < schedule.openTime) {
    isOpen = false;
    reason = `${schedule.shortName} opens for public ordering at ${schedule.openTime} WAT (currently ${time24} WAT).`;
    nextOpenNotice = `Opens today at ${schedule.openTime} WAT.`;
  } else if (time24 >= schedule.closeTime) {
    isOpen = false;
    reason = `${schedule.shortName} closed for public ordering at ${schedule.closeTime} WAT (currently ${time24} WAT).`;
    const tomorrowOpenDay = schedule.closedDays.includes('sunday') && dayOfWeek === 'saturday' ? 'Monday' : 'tomorrow';
    nextOpenNotice = `Opens ${tomorrowOpenDay} at ${schedule.openTime} WAT.`;
  } else {
    isOpen = true;
    reason = `Open for customer ordering (${schedule.openTime}–${schedule.closeTime} WAT).`;
  }

  return {
    branchId: schedule.branchId,
    name: schedule.name,
    shortName: schedule.shortName,
    isOpen,
    isStaffActive,
    isOperational: schedule.isOperational,
    currentTimeWat: time24,
    currentDayWat: dayOfWeek,
    publicHours: `${schedule.openTime}–${schedule.closeTime}`,
    staffHours: `${schedule.staffOpenTime}–${schedule.staffCloseTime}`,
    bakeryHours: schedule.bakeryHours,
    deliveryHours: schedule.deliveryHours,
    operatingDaysLabel,
    reason,
    nextOpenNotice,
  };
}
