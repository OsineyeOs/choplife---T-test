/**
 * Choplife Republic — Frontend Branch Scheduling & Live Status Utility
 * Calculates West Africa Time (WAT, UTC+1, 'Africa/Lagos') opening boundaries.
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
  operatingDays: string[];
  closedDays: string[];
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

export function getLagosDateTime(referenceDate = new Date()): {
  dayOfWeek: string;
  time24: string;
  hour: number;
  minute: number;
} {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Lagos',
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });

    const parts = formatter.formatToParts(referenceDate);
    const weekday = (parts.find((p) => p.type === 'weekday')?.value || '').toLowerCase();
    let hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    if (hour === 24) hour = 0;
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    const time24 = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { dayOfWeek: weekday, time24, hour, minute };
  } catch {
    // Fallback if Intl timeZone is unsupported
    const d = new Date(referenceDate.getTime() + (1 * 60 + referenceDate.getTimezoneOffset()) * 60000);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekday = days[d.getDay()];
    const time24 = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return { dayOfWeek: weekday, time24, hour: d.getHours(), minute: d.getMinutes() };
  }
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

export function evaluateBranchOperatingStatus(
  branchId: string,
  referenceDate = new Date(),
  overrideSchedule?: Partial<BranchScheduleModel>
): BranchOperatingStatus {
  const key = String(branchId || 'gra').toLowerCase();
  const base = AUTHORITATIVE_SCHEDULES[key] || AUTHORITATIVE_SCHEDULES.gra;
  const schedule: BranchScheduleModel = {
    ...base,
    ...overrideSchedule,
  };

  const { dayOfWeek, time24 } = getLagosDateTime(referenceDate);
  const isClosedDay = schedule.closedDays.includes(dayOfWeek) || !schedule.operatingDays.includes(dayOfWeek);

  const isStaffActive =
    !isClosedDay &&
    schedule.isOperational &&
    Boolean(schedule.staffOpenTime && schedule.staffCloseTime) &&
    time24 >= schedule.staffOpenTime &&
    time24 < schedule.staffCloseTime;

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
