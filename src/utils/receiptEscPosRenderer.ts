import { EscPosBuilder, ESC_COMMANDS } from './escpos';
import {
  formatNaira,
  resolveBranchDetails,
  normalizeReceiptArgs,
} from './receiptTypesAndNormalization';

/**
 * Generates exact ESC/POS binary command buffer adhering to template configuration
 * Accepts either (data, template) or options object { documentType, order, template, paperWidth }
 */
export function renderReceiptEscPos(arg1: any, arg2?: any): Uint8Array {
  const { data, template } = normalizeReceiptArgs(arg1, arg2);
  const width = template.paperWidth === '58mm' ? 32 : 48;
  const builder = new EscPosBuilder();

  // 1. Initialize
  builder.addBytes(ESC_COMMANDS.INIT);

  // Cash drawer kick if enabled on payment
  if (template.docType === 'customer_receipt' && (data.paymentMethod || '').toLowerCase().includes('cash')) {
    builder.addBytes(ESC_COMMANDS.DRAWER_KICK_PIN2);
  }

  // Buzzer chime for kitchen/grill/bar preparation tickets
  if (template.docType === 'kitchen_kot' || template.docType === 'grill_ticket' || template.docType === 'bar_slip') {
    builder.addBytes(ESC_COMMANDS.BEEP);
  }

  // 2. Header
  builder.addBytes(ESC_COMMANDS.ALIGN_CENTER);

  if (data.isSample) {
    builder.addLine('*** SAMPLE TEST RECEIPT ***');
  }

  if (data.isReprint && template.showReprintIndicator) {
    builder.addBytes(ESC_COMMANDS.BOLD_ON);
    builder.addLine(`*** DUPLICATE REPRINT (${data.reprintCount || 1}) ***`);
    builder.addBytes(ESC_COMMANDS.BOLD_OFF);
  }

  if (template.brandName) {
    builder
      .addBytes(ESC_COMMANDS.BOLD_ON)
      .addBytes(ESC_COMMANDS.DOUBLE_SIZE_ON)
      .addLine(template.brandName)
      .addBytes(ESC_COMMANDS.NORMAL_SIZE)
      .addBytes(ESC_COMMANDS.BOLD_OFF);
  }

  if (template.tagline) {
    builder.addLine(template.tagline);
  }

  const branch = resolveBranchDetails(data.branchId);
  const branchName = data.branchName || branch.name;
  const branchAddress = data.branchAddress || branch.address;
  const branchPhone = data.branchPhone || branch.phone;

  if (template.showBranchAddress && branchAddress) {
    builder.addLine(branchName);
    builder.addLine(branchAddress);
  }

  if (template.showBranchPhone && branchPhone) {
    builder.addLine(`Tel: ${branchPhone}`);
  }

  if (template.customHeaderMessage) {
    builder.addLine(template.customHeaderMessage);
  }

  builder.addDivider('=', width);

  // 3. Metadata
  builder.addBytes(ESC_COMMANDS.ALIGN_LEFT);

  if (template.showOrderNumber) {
    builder.addTwoColumns('ORDER NUMBER:', `#${data.orderNumber}`, width);
  }

  if (template.showDateTime) {
    const dateFormatted = new Date(data.createdAt).toLocaleString('en-GB');
    builder.addTwoColumns('DATE & TIME:', dateFormatted, width);
  }

  if (template.showOrderType) {
    builder.addTwoColumns('ORDER TYPE:', data.orderType.toUpperCase(), width);
  }

  if (template.showTableNumber && data.tableNumber) {
    builder.addTwoColumns('TABLE NUMBER:', String(data.tableNumber), width);
  }

  if (template.showCashierName && data.cashierName) {
    builder.addTwoColumns('SERVER/CASHIER:', data.cashierName, width);
  }

  if (template.showCustomerDetails && data.customerName) {
    builder.addTwoColumns('CUSTOMER:', data.customerName, width);
  }

  builder.addDivider('-', width);

  // 4. Line Items Table Header
  builder.addBytes(ESC_COMMANDS.BOLD_ON);
  if (template.docType === 'customer_receipt' || template.docType === 'bill_check') {
    builder.addThreeColumns('ITEM', 'QTY', 'AMOUNT', width);
  } else {
    builder.addTwoColumns('ITEM', 'QTY', width);
  }
  builder.addBytes(ESC_COMMANDS.BOLD_OFF);
  builder.addDivider('-', width);

  // 5. Line items
  for (const item of data.items) {
    const qtyStr = `${item.quantity}x`;
    if (template.docType === 'customer_receipt' || template.docType === 'bill_check') {
      const priceStr = formatNaira((item.unitPrice || 0) * item.quantity);
      builder.addThreeColumns(item.name, qtyStr, priceStr, width);
    } else {
      if (template.boldItemQuantities) {
        builder.addBytes(ESC_COMMANDS.BOLD_ON);
      }
      builder.addTwoColumns(item.name, qtyStr, width);
      if (template.boldItemQuantities) {
        builder.addBytes(ESC_COMMANDS.BOLD_OFF);
      }
    }

    if (template.showItemModifiers && item.modifiers) {
      if (item.modifiers.spiceLevel) {
        builder.addLine(`  * Spice: ${item.modifiers.spiceLevel}`);
      }
      if (item.modifiers.specialInstructions) {
        builder.addLine(`  * Note: ${item.modifiers.specialInstructions}`);
      }
    }
  }

  builder.addDivider('-', width);

  // 6. Totals section for customer receipts
  if (template.docType === 'customer_receipt' || template.docType === 'bill_check') {
    if (template.showSubtotal) {
      builder.addTwoColumns('SUBTOTAL:', formatNaira(data.subtotal), width);
    }
    if (template.showDiscounts && (data.discount || 0) > 0) {
      builder.addTwoColumns('DISCOUNT:', `-${formatNaira(data.discount || 0)}`, width);
    }
    if (template.showDeliveryFee && (data.deliveryFee || 0) > 0) {
      builder.addTwoColumns('DELIVERY CHARGE:', formatNaira(data.deliveryFee || 0), width);
    }

    builder.addDivider('=', width);
    builder
      .addBytes(ESC_COMMANDS.BOLD_ON)
      .addBytes(ESC_COMMANDS.DOUBLE_HEIGHT_ON)
      .addTwoColumns('TOTAL:', formatNaira(data.total), width)
      .addBytes(ESC_COMMANDS.NORMAL_SIZE)
      .addBytes(ESC_COMMANDS.BOLD_OFF);

    if (template.showPaymentDetails && data.paymentMethod) {
      builder.addTwoColumns('PAYMENT METHOD:', data.paymentMethod.toUpperCase(), width);
    }
    if (template.showTenderAndChange && data.tenderedAmount !== undefined) {
      builder.addTwoColumns('CASH TENDERED:', formatNaira(data.tenderedAmount), width);
      builder.addTwoColumns('CHANGE GIVEN:', formatNaira(data.changeAmount || 0), width);
    }
  }

  // 7. Shift Z-Report details
  if (data.documentType === 'shift_z_report' && data.shiftData) {
    builder.addBytes(ESC_COMMANDS.BOLD_ON);
    builder.addLine('--- SHIFT RECONCILIATION ---');
    builder.addBytes(ESC_COMMANDS.BOLD_OFF);
    builder.addTwoColumns('SHIFT ID:', data.shiftData.shiftId, width);
    builder.addTwoColumns('OPENING FLOAT:', formatNaira(data.shiftData.openingFloat), width);
    builder.addTwoColumns('CASH SALES:', formatNaira(data.shiftData.cashSales), width);
    builder.addTwoColumns('POS CARD SALES:', formatNaira(data.shiftData.cardSales), width);
    builder.addTwoColumns('TRANSFERS:', formatNaira(data.shiftData.transferSales), width);
    builder.addTwoColumns('SAFE DROPS:', `-${formatNaira(data.shiftData.safeDrops)}`, width);
    builder.addDivider('-', width);
    builder.addBytes(ESC_COMMANDS.BOLD_ON);
    builder.addTwoColumns('EXPECTED CASH:', formatNaira(data.shiftData.expectedCash), width);
    builder.addTwoColumns('COUNTED CASH:', formatNaira(data.shiftData.countedCash), width);
    builder.addTwoColumns('VARIANCE:', formatNaira(data.shiftData.cashVariance), width);
    builder.addBytes(ESC_COMMANDS.BOLD_OFF);
  }

  // 8. Footer
  builder.addBytes(ESC_COMMANDS.ALIGN_CENTER);
  if (template.thankYouMessage) {
    builder.addBytes(ESC_COMMANDS.BOLD_ON);
    builder.addLine(template.thankYouMessage);
    builder.addBytes(ESC_COMMANDS.BOLD_OFF);
  }
  if (template.customFooterMessage) {
    builder.addLine(template.customFooterMessage);
  }
  builder.addLine('100% MAXIMUM ENJOYMENT • BENIN CITY');

  // Paper cut & feed
  builder.addBytes(ESC_COMMANDS.FEED_5_LINES);
  builder.addBytes(ESC_COMMANDS.CUT_PARTIAL);

  return builder.build();
}
