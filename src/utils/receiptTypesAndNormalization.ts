/**
 * Choplife Republic — Receipt Types, Sample Data & Argument Normalization
 */

import { BRANCHES } from '../data/branches';

export type ReceiptDocumentType =
  | 'customer_receipt'
  | 'kitchen_kot'
  | 'grill_ticket'
  | 'grill_kot'
  | 'bar_slip'
  | 'bar_kot'
  | 'bill_check'
  | 'shift_z_report';

export interface ReceiptItemModifier {
  spiceLevel?: string;
  specialInstructions?: string;
  packSize?: string;
  sides?: string[];
}

export interface ReceiptLineItem {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  category?: string;
  station?: string;
  modifiers?: ReceiptItemModifier;
  isComplimentary?: boolean;
}

export interface ReceiptData {
  documentType: ReceiptDocumentType;
  orderNumber: string;
  branchId: string;
  branchName?: string;
  branchAddress?: string;
  branchPhone?: string;
  createdAt: string;
  cashierName?: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery' | 'pickup' | 'pos';
  tableNumber?: string | number;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  items: ReceiptLineItem[];
  subtotal: number;
  discount?: number;
  deliveryFee?: number;
  vatAmount?: number;
  total: number;
  paymentMethod?: string;
  paymentReference?: string;
  tenderedAmount?: number;
  changeAmount?: number;
  balanceDue?: number;
  loyaltyPointsEarned?: number;
  loyaltyBalance?: number;
  isReprint?: boolean;
  reprintCount?: number;
  specialInstructions?: string;
  isSample?: boolean;
  shiftData?: {
    shiftId: string;
    registerId: string;
    openedAt: string;
    closedAt: string;
    openingFloat: number;
    cashSales: number;
    cardSales: number;
    transferSales: number;
    safeDrops: number;
    expectedCash: number;
    countedCash: number;
    cashVariance: number;
    totalOrdersCount: number;
  };
}

export interface ReceiptTemplateConfig {
  id: string;
  docType: ReceiptDocumentType;
  branchId: string;
  name: string;
  paperWidth: '80mm' | '58mm';
  showLogo: boolean;
  brandName: string;
  tagline: string;
  showBranchAddress: boolean;
  showBranchPhone: boolean;
  phone?: string;
  instagram?: string;
  taxNumber?: string;
  customHeaderMessage?: string;
  customFooterMessage?: string;
  thankYouMessage: string;
  showOrderNumber: boolean;
  showDateTime: boolean;
  showCashierName: boolean;
  showCustomerDetails: boolean;
  showTableNumber: boolean;
  showOrderType: boolean;
  showItemModifiers: boolean;
  showTaxBreakdown: boolean;
  showSubtotal: boolean;
  showDeliveryFee: boolean;
  showDiscounts: boolean;
  showPaymentDetails: boolean;
  showTenderAndChange: boolean;
  showLoyaltyPoints: boolean;
  showReprintIndicator: boolean;
  highlightKitchenNotes?: boolean;
  boldItemQuantities?: boolean;
  separateCategorySections?: boolean;
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatNaira(amount: number): string {
  return `₦${Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function resolveBranchDetails(branchId: string = 'gra'): {
  name: string;
  address: string;
  phone: string;
} {
  const branch = BRANCHES.find((b) => b.id === branchId) || BRANCHES[0];
  return {
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
  };
}

/**
 * Generates canonical sample receipt data for safe live template editing
 */
export function generateSampleReceiptData(docType: ReceiptDocumentType = 'customer_receipt', branchId: string = 'gra'): ReceiptData {
  const branch = resolveBranchDetails(branchId);

  const base: ReceiptData = {
    documentType: docType,
    orderNumber: 'CL-84920',
    branchId,
    branchName: branch.name,
    branchAddress: branch.address,
    branchPhone: branch.phone,
    createdAt: new Date().toISOString(),
    cashierName: 'Chioma E. (Cashier)',
    orderType: docType === 'kitchen_kot' || docType === 'grill_ticket' ? 'dine_in' : 'takeaway',
    tableNumber: 'Table 04',
    customerName: 'Osagie Alonge',
    customerPhone: '+234 803 456 7890',
    deliveryAddress: '45 Boundary Road, GRA, Benin City',
    items: [
      {
        name: 'Choplife Charcoal Flame Asun',
        quantity: 2,
        unitPrice: 3500,
        totalPrice: 7000,
        category: 'grills',
        station: 'Grill Station',
        modifiers: {
          spiceLevel: 'Extra Spicy Pepper Sauce',
          specialInstructions: 'Well crisped skin, pack with extra onions',
        },
      },
      {
        name: 'Monster Beef Shawarma (Double Sausage)',
        quantity: 1,
        unitPrice: 4200,
        totalPrice: 4200,
        category: 'shawarma',
        station: 'Hot Kitchen',
        modifiers: {
          spiceLevel: 'Mild Pepper',
          specialInstructions: 'Extra sweet cream dressing',
        },
      },
      {
        name: 'Choplife Special Bromate-Free Bread (600g)',
        quantity: 1,
        unitPrice: 900,
        totalPrice: 900,
        category: 'bakery',
        station: 'Bakery Counter',
      },
      {
        name: 'Chilled Zobo Supreme (500ml Pet)',
        quantity: 2,
        unitPrice: 800,
        totalPrice: 1600,
        category: 'drinks',
        station: 'Bar & Drinks',
      },
    ],
    subtotal: 13700,
    discount: 500,
    deliveryFee: 1500,
    vatAmount: 0,
    total: 14700,
    paymentMethod: 'Cash (POS Till)',
    paymentReference: 'CSH-GRA-20261024-0014',
    tenderedAmount: 15000,
    changeAmount: 300,
    loyaltyPointsEarned: 13,
    loyaltyBalance: 820,
    isReprint: false,
    isSample: true,
  };

  if (docType === 'shift_z_report') {
    base.shiftData = {
      shiftId: 'SFT-GRA-0001',
      registerId: 'POS-REG-01',
      openedAt: new Date(Date.now() - 28800000).toISOString(),
      closedAt: new Date().toISOString(),
      openingFloat: 25000,
      cashSales: 185000,
      cardSales: 242000,
      transferSales: 96000,
      safeDrops: 50000,
      expectedCash: 160000,
      countedCash: 160000,
      cashVariance: 0,
      totalOrdersCount: 64,
    };
  }

  return base;
}

export function normalizeReceiptArgs(
  arg1: any,
  arg2?: any
): { data: ReceiptData; template: ReceiptTemplateConfig } {
  let data: ReceiptData;

  if (arg1 && typeof arg1 === 'object') {
    if (arg1.order && arg1.documentType) {
      const order = arg1.order;
      if (order.items && order.orderNumber && order.subtotal !== undefined) {
        data = {
          ...order,
          documentType: arg1.documentType,
        };
      } else {
        const branch = resolveBranchDetails(order.branchId || 'gra');
        data = {
          documentType: arg1.documentType,
          orderNumber: order.orderNumber || order.id || 'ORDER',
          branchId: order.branchId || 'gra',
          branchName: branch.name,
          branchAddress: branch.address,
          branchPhone: branch.phone,
          createdAt: order.createdAt || new Date().toISOString(),
          cashierName: order.cashier || order.cashierName || 'Front Counter',
          orderType: order.deliveryDetails?.orderType || order.orderType || 'pos',
          tableNumber: order.tableNumber,
          customerName: order.deliveryDetails?.customerName || order.customerName,
          customerPhone: order.deliveryDetails?.customerPhone || order.customerPhone,
          deliveryAddress: order.deliveryDetails?.deliveryAddress || order.deliveryAddress,
          items: (order.items || []).map((it: any) => ({
            name: it.product?.name || it.name || 'Item',
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || it.price || 0,
            totalPrice: (it.unitPrice || it.price || 0) * (it.quantity || 1),
            notes: it.customization?.specialInstructions || it.notes,
            spiceLevel: it.customization?.spiceLevel || it.spiceLevel,
            category: it.product?.category || it.category,
            station: it.station || arg1.station || 'Counter POS',
          })),
          subtotal: order.subtotal || 0,
          discount: order.discount || 0,
          deliveryFee: order.deliveryFee || 0,
          vatAmount: order.vatAmount || 0,
          total: order.total || order.subtotal || 0,
          paymentMethod: order.paymentMethod || 'cash',
          paymentReference: order.paymentReference || order.posPayment?.reference,
          tenderedAmount: order.posPayment?.tenderedAmount,
          changeAmount: order.posPayment?.changeAmount,
          isSample: order.isSample ?? false,
          shiftData: order.shiftData,
        };
      }
    } else if (arg1.items && arg1.documentType) {
      data = arg1;
    } else {
      data = generateSampleReceiptData(arg1.documentType || 'customer_receipt');
    }
  } else {
    data = generateSampleReceiptData('customer_receipt');
  }

  const rawTemplate = arg2 || arg1?.template;
  const docType = data.documentType || 'customer_receipt';
  const tmplPaperWidth = arg1?.paperWidth || rawTemplate?.paperWidth || '80mm';

  const template: ReceiptTemplateConfig = {
    id: rawTemplate?.id || `tmpl-${docType}`,
    docType: docType,
    branchId: data.branchId || 'gra',
    name: rawTemplate?.name || 'Default Receipt Template',
    paperWidth: tmplPaperWidth,
    showLogo: rawTemplate?.showLogo ?? true,
    brandName: rawTemplate?.headerTitle || rawTemplate?.brandName || 'CHOPLIFE REPUBLIC',
    tagline: rawTemplate?.headerSubtitle || rawTemplate?.tagline || 'AUTHENTIC SMALL CHOPS & GRILL',
    showBranchAddress: rawTemplate?.showBranchDetails ?? rawTemplate?.showBranchAddress ?? true,
    showBranchPhone: rawTemplate?.showBranchDetails ?? rawTemplate?.showBranchPhone ?? true,
    customHeaderMessage: rawTemplate?.headerCustomNote || rawTemplate?.customHeaderMessage,
    customFooterMessage: rawTemplate?.policyText || rawTemplate?.customFooterMessage,
    thankYouMessage: rawTemplate?.footerMessage || rawTemplate?.thankYouMessage || 'THANK YOU FOR CHOPPING LIFE!',
    showOrderNumber: rawTemplate?.showOrderNumber ?? true,
    showDateTime: rawTemplate?.showDateTime ?? true,
    showCashierName: rawTemplate?.showCashier ?? rawTemplate?.showCashierName ?? true,
    showCustomerDetails: rawTemplate?.showCustomerDetails ?? true,
    showTableNumber: rawTemplate?.showTableNumber ?? true,
    showOrderType: rawTemplate?.showOrderType ?? true,
    showItemModifiers: rawTemplate?.showSpiceLevels ?? rawTemplate?.showItemModifiers ?? true,
    showTaxBreakdown: rawTemplate?.showTaxId ?? rawTemplate?.showTaxBreakdown ?? false,
    showSubtotal: rawTemplate?.showSubtotal ?? true,
    showDeliveryFee: rawTemplate?.showDeliveryFee ?? true,
    showDiscounts: rawTemplate?.showDiscounts ?? true,
    showPaymentDetails: rawTemplate?.showPaymentDetails ?? true,
    showTenderAndChange: rawTemplate?.showTenderAndChange ?? true,
    showLoyaltyPoints: rawTemplate?.showQrCode ?? rawTemplate?.showLoyaltyPoints ?? true,
    showReprintIndicator: rawTemplate?.showReprintIndicator ?? true,
    highlightKitchenNotes: rawTemplate?.showCustomerNotes ?? rawTemplate?.highlightKitchenNotes ?? true,
    boldItemQuantities: rawTemplate?.boldItemQuantities ?? true,
    separateCategorySections: rawTemplate?.separateCategorySections ?? false,
  };

  return { data, template };
}
