import { StaffUser, InventoryItem, RiderProfile, AuditLog } from '../types';

export const INITIAL_STAFF_USERS: StaffUser[] = [];

export const INITIAL_INVENTORY_ITEMS: InventoryItem[] = [
  {
    id: 'inv-1',
    name: 'Fresh Chicken Quarters',
    category: 'proteins',
    unit: 'kg',
    currentStock: { gra: 45, ugbowo: 30, okabere: 25 },
    minThreshold: { gra: 10, ugbowo: 8, okabere: 8 },
    costPerUnit: 4200,
    linkedProductIds: ['prod-sc-box-custom', 'prod-gr-chicken-quarter', 'prod-sh-chicken'],
    lastRestocked: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'inv-2',
    name: 'Spring Roll Wrappers (Packs of 50)',
    category: 'ingredients',
    unit: 'packs',
    currentStock: { gra: 24, ugbowo: 18, okabere: 15 },
    minThreshold: { gra: 5, ugbowo: 5, okabere: 4 },
    costPerUnit: 2800,
    linkedProductIds: ['prod-sc-box-custom', 'prod-sc-springrolls-5'],
    lastRestocked: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'inv-3',
    name: 'Premium Basmati Rice',
    category: 'ingredients',
    unit: 'kg',
    currentStock: { gra: 80, ugbowo: 50, okabere: 40 },
    minThreshold: { gra: 15, ugbowo: 10, okabere: 10 },
    costPerUnit: 3500,
    linkedProductIds: ['prod-rc-jollof-combo', 'prod-rc-fried-combo'],
    lastRestocked: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
  {
    id: 'inv-4',
    name: 'Choplife Signature Suya Spice Blend',
    category: 'spices',
    unit: 'kg',
    currentStock: { gra: 12, ugbowo: 8, okabere: 6 },
    minThreshold: { gra: 2, ugbowo: 2, okabere: 2 },
    costPerUnit: 6000,
    linkedProductIds: ['prod-sh-chicken', 'prod-sh-beef-suya', 'prod-gr-chicken-quarter'],
    lastRestocked: new Date(Date.now() - 3600000 * 72).toISOString(),
  },
  {
    id: 'inv-5',
    name: 'Heavy Duty Thermal Takeaway Food Packs',
    category: 'packaging',
    unit: 'packs (100pcs)',
    currentStock: { gra: 15, ugbowo: 12, okabere: 9 },
    minThreshold: { gra: 3, ugbowo: 3, okabere: 2 },
    costPerUnit: 7500,
    lastRestocked: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
  {
    id: 'inv-6',
    name: 'Fresh Cow Beef Cuts (Suya & Shawarma)',
    category: 'proteins',
    unit: 'kg',
    currentStock: { gra: 35, ugbowo: 22, okabere: 20 },
    minThreshold: { gra: 8, ugbowo: 6, okabere: 5 },
    costPerUnit: 5200,
    linkedProductIds: ['prod-sh-beef-suya', 'prod-sc-box-custom'],
    lastRestocked: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: 'inv-7',
    name: 'Natural Zobo Flowers & Ginger Extract',
    category: 'beverages',
    unit: 'kg',
    currentStock: { gra: 20, ugbowo: 15, okabere: 10 },
    minThreshold: { gra: 4, ugbowo: 3, okabere: 2 },
    costPerUnit: 4800,
    linkedProductIds: ['prod-drink-zobo-1000', 'prod-drink-tigernut'],
    lastRestocked: new Date(Date.now() - 3600000 * 30).toISOString(),
  },
  {
    id: 'inv-8',
    name: 'Shawarma Pita Bread Wraps (Packs of 10)',
    category: 'ingredients',
    unit: 'packs',
    currentStock: { gra: 40, ugbowo: 35, okabere: 28 },
    minThreshold: { gra: 8, ugbowo: 8, okabere: 5 },
    costPerUnit: 2200,
    linkedProductIds: ['prod-sh-chicken', 'prod-sh-beef-suya', 'prod-sh-jumbo-special'],
    lastRestocked: new Date(Date.now() - 3600000 * 10).toISOString(),
  },
];

export const INITIAL_RIDERS: RiderProfile[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

