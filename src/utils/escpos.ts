/**
 * ESC/POS Thermal Printing Command Generator for Choplife Republic POS & KDS
 * Standard command codes for Epson, Star, Xprinter, Rongta, Sunmi, and compatible 80mm/58mm thermal printers.
 */

import { BRANCHES } from '../data/branches';

export interface PrinterConfig {
  paperWidth: '80mm' | '58mm';
  autoCut: boolean;
  autoOpenDrawer: boolean;
  printDuplicate: boolean;
  soundBuzzer: boolean;
  lineCharacters: number; // 48 for 80mm Font A, 32 for 58mm Font A
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  paperWidth: '80mm',
  autoCut: true,
  autoOpenDrawer: true,
  printDuplicate: false,
  soundBuzzer: true,
  lineCharacters: 48,
};

// Common ESC/POS Byte Commands
export const ESC_COMMANDS = {
  // Initialize printer
  INIT: new Uint8Array([0x1b, 0x40]),

  // Alignment
  ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]),

  // Text Styling
  BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]),
  UNDERLINE_ON: new Uint8Array([0x1b, 0x2d, 0x01]),
  UNDERLINE_OFF: new Uint8Array([0x1b, 0x2d, 0x00]),
  DOUBLE_SIZE_ON: new Uint8Array([0x1d, 0x21, 0x11]), // 2x width & 2x height
  DOUBLE_HEIGHT_ON: new Uint8Array([0x1d, 0x21, 0x01]),
  NORMAL_SIZE: new Uint8Array([0x1d, 0x21, 0x00]),
  INVERT_ON: new Uint8Array([0x1d, 0x42, 0x01]),
  INVERT_OFF: new Uint8Array([0x1d, 0x42, 0x00]),

  // Paper Feeding
  FEED_LINE: new Uint8Array([0x0a]),
  FEED_3_LINES: new Uint8Array([0x1b, 0x64, 0x03]),
  FEED_5_LINES: new Uint8Array([0x1b, 0x64, 0x05]),

  // Cut Paper
  CUT_FULL: new Uint8Array([0x1d, 0x56, 0x00]),
  CUT_PARTIAL: new Uint8Array([0x1d, 0x56, 0x01]),
  FEED_AND_CUT: new Uint8Array([0x1d, 0x56, 0x42, 0x14]), // feed 20 units and partial cut

  // Cash Drawer Kick Pulse (pin 2: 0x00, pin 5: 0x01)
  DRAWER_KICK_PIN2: new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]),
  DRAWER_KICK_PIN5: new Uint8Array([0x1b, 0x70, 0x01, 0x19, 0xfa]),

  // Internal Buzzer / Chime
  BEEP: new Uint8Array([0x1b, 0x42, 0x02, 0x02]),
};

/**
 * Helper class to assemble Uint8Array ESC/POS command buffers
 */
export class EscPosBuilder {
  private chunks: Uint8Array[] = [];
  private encoder = new TextEncoder();

  addBytes(bytes: Uint8Array): EscPosBuilder {
    this.chunks.push(bytes);
    return this;
  }

  addText(text: string): EscPosBuilder {
    this.chunks.push(this.encoder.encode(text));
    return this;
  }

  addLine(text: string = ''): EscPosBuilder {
    this.chunks.push(this.encoder.encode(text + '\n'));
    return this;
  }

  addDivider(char: string = '-', width: number = 48): EscPosBuilder {
    const divider = char.repeat(width);
    this.addLine(divider);
    return this;
  }

  addTwoColumns(left: string, right: string, width: number = 48): EscPosBuilder {
    const leftTrimmed = left.substring(0, width - right.length - 1);
    const spacesCount = Math.max(1, width - leftTrimmed.length - right.length);
    this.addLine(leftTrimmed + ' '.repeat(spacesCount) + right);
    return this;
  }

  addThreeColumns(col1: string, col2: string, col3: string, width: number = 48): EscPosBuilder {
    // col1: item name (~55%), col2: qty (~15%), col3: price (~30%)
    const col2Width = 6;
    const col3Width = 14;
    const col1Width = width - col2Width - col3Width;

    const c1 = col1.padEnd(col1Width).substring(0, col1Width);
    const c2 = col2.padStart(col2Width).substring(0, col2Width);
    const c3 = col3.padStart(col3Width).substring(0, col3Width);

    this.addLine(c1 + c2 + c3);
    return this;
  }

  build(): Uint8Array {
    let totalLength = 0;
    for (const chunk of this.chunks) {
      totalLength += chunk.length;
    }

    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
}

/**
 * Builds binary ESC/POS buffer for Customer Sales Receipt
 */
export function buildCustomerReceiptEscPos(order: any, config: PrinterConfig = DEFAULT_PRINTER_CONFIG): Uint8Array {
  const width = config.paperWidth === '58mm' ? 32 : 48;
  const builder = new EscPosBuilder();

  // 1. Init & optional drawer kick
  builder.addBytes(ESC_COMMANDS.INIT);
  if (config.autoOpenDrawer && order.paymentMethod === 'cash') {
    builder.addBytes(ESC_COMMANDS.DRAWER_KICK_PIN2);
  }

  // 2. Header
  builder
    .addBytes(ESC_COMMANDS.ALIGN_CENTER)
    .addBytes(ESC_COMMANDS.BOLD_ON)
    .addBytes(ESC_COMMANDS.DOUBLE_SIZE_ON)
    .addLine('CHOPLIFE REPUBLIC')
    .addBytes(ESC_COMMANDS.NORMAL_SIZE)
    .addLine('AUTHENTIC SMALL CHOPS & GRILL')
    .addBytes(ESC_COMMANDS.BOLD_OFF);

  const matchedBranch = BRANCHES.find((b) => b.id === order.branchId) || BRANCHES[0];
  builder
    .addLine(matchedBranch.name)
    .addLine(matchedBranch.address)
    .addLine(`Tel: ${matchedBranch.phone}`)
    .addDivider('=', width);

  // 3. Receipt Info
  builder
    .addBytes(ESC_COMMANDS.ALIGN_LEFT)
    .addTwoColumns('ORDER NUMBER:', `#${order.orderNumber || order.id}`, width)
    .addTwoColumns('DATE & TIME:', new Date(order.createdAt || Date.now()).toLocaleString('en-GB'), width)
    .addTwoColumns('ORDER TYPE:', (order.deliveryDetails?.orderType || order.orderType || 'POS').toUpperCase(), width);

  if (order.tableNumber) {
    builder.addTwoColumns('TABLE NUMBER:', `TABLE ${order.tableNumber}`, width);
  }
  if (order.deliveryDetails?.customerName && order.deliveryDetails.customerName !== 'Walk-in Guest') {
    builder.addTwoColumns('CUSTOMER:', order.deliveryDetails.customerName, width);
  }
  if (order.cashier) {
    builder.addTwoColumns('CASHIER:', order.cashier, width);
  }

  builder.addDivider('-', width);

  // 4. Line Items Table Header
  builder
    .addBytes(ESC_COMMANDS.BOLD_ON)
    .addThreeColumns('ITEM', 'QTY', 'AMOUNT', width)
    .addBytes(ESC_COMMANDS.BOLD_OFF)
    .addDivider('-', width);

  // 5. Line Items
  const items = order.items || [];
  for (const item of items) {
    const name = item.product?.name || item.name || 'Menu Item';
    const qty = `${item.quantity}x`;
    const price = `N${((item.unitPrice || item.price || 0) * item.quantity).toLocaleString()}`;
    builder.addThreeColumns(name, qty, price, width);

    // Customization notes if present
    if (item.customization?.spiceLevel || item.customization?.specialInstructions) {
      const notes = [
        item.customization.spiceLevel ? `Spice: ${item.customization.spiceLevel}` : '',
        item.customization.specialInstructions ? `Note: ${item.customization.specialInstructions}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      builder.addLine(`  * ${notes}`);
    }
  }

  builder.addDivider('-', width);

  // 6. Totals Section
  const subtotal = order.subtotal || 0;
  const discount = order.discount || 0;
  const deliveryFee = order.deliveryFee || 0;
  const total = order.total || 0;

  builder.addTwoColumns('SUBTOTAL:', `N${subtotal.toLocaleString()}`, width);
  if (discount > 0) {
    builder.addTwoColumns('DISCOUNT APPLIED:', `-N${discount.toLocaleString()}`, width);
  }
  if (deliveryFee > 0) {
    builder.addTwoColumns('DELIVERY CHARGE:', `N${deliveryFee.toLocaleString()}`, width);
  }

  builder.addDivider('=', width);
  builder
    .addBytes(ESC_COMMANDS.BOLD_ON)
    .addBytes(ESC_COMMANDS.DOUBLE_HEIGHT_ON)
    .addTwoColumns('TOTAL PAID:', `N${total.toLocaleString()}`, width)
    .addBytes(ESC_COMMANDS.NORMAL_SIZE)
    .addBytes(ESC_COMMANDS.BOLD_OFF);

  builder.addTwoColumns('PAYMENT METHOD:', (order.paymentMethod || 'CASH').toUpperCase(), width);
  if (order.posPayment?.tenderedAmount && order.posPayment?.changeAmount !== undefined) {
    builder.addTwoColumns('CASH TENDERED:', `N${order.posPayment.tenderedAmount.toLocaleString()}`, width);
    builder.addTwoColumns('CHANGE RETURNED:', `N${order.posPayment.changeAmount.toLocaleString()}`, width);
  }

  builder.addDivider('=', width);

  // 7. Footer
  builder
    .addBytes(ESC_COMMANDS.ALIGN_CENTER)
    .addBytes(ESC_COMMANDS.BOLD_ON)
    .addLine('THANK YOU FOR CHOPPING LIFE WITH US!')
    .addBytes(ESC_COMMANDS.BOLD_OFF)
    .addLine('Goods received in good condition are not returnable.')
    .addLine('Choplife Republic Loyalty Rewards: 100% Maximum Enjoyment!')
    .addLine('*** END OF OFFICIAL RECEIPT ***')
    .addBytes(ESC_COMMANDS.FEED_5_LINES);

  // 8. Auto cut
  if (config.autoCut) {
    builder.addBytes(ESC_COMMANDS.FEED_AND_CUT);
  }

  return builder.build();
}

/**
 * Builds binary ESC/POS buffer for Kitchen Order Ticket (KOT)
 */
export function buildKitchenKotEscPos(order: any, station: string = 'all', config: PrinterConfig = DEFAULT_PRINTER_CONFIG): Uint8Array {
  const width = config.paperWidth === '58mm' ? 32 : 48;
  const builder = new EscPosBuilder();

  builder.addBytes(ESC_COMMANDS.INIT);

  if (config.soundBuzzer) {
    builder.addBytes(ESC_COMMANDS.BEEP);
  }

  // Header
  builder
    .addBytes(ESC_COMMANDS.ALIGN_CENTER)
    .addBytes(ESC_COMMANDS.INVERT_ON)
    .addBytes(ESC_COMMANDS.DOUBLE_SIZE_ON)
    .addLine(' *** KITCHEN ORDER (KOT) *** ')
    .addBytes(ESC_COMMANDS.NORMAL_SIZE)
    .addBytes(ESC_COMMANDS.INVERT_OFF)
    .addBytes(ESC_COMMANDS.BOLD_ON)
    .addLine(`STATION: ${station.toUpperCase()}`)
    .addBytes(ESC_COMMANDS.BOLD_OFF)
    .addLine(`Branch: ${(order.branchId || 'main').toUpperCase()}`)
    .addDivider('=', width);

  // Ticket & Table Info
  const orderType = order.deliveryDetails?.orderType || order.orderType || 'DINE-IN';
  builder
    .addBytes(ESC_COMMANDS.ALIGN_LEFT)
    .addBytes(ESC_COMMANDS.BOLD_ON)
    .addBytes(ESC_COMMANDS.DOUBLE_SIZE_ON)
    .addLine(`TICKET: #${order.orderNumber || order.id}`)
    .addBytes(ESC_COMMANDS.NORMAL_SIZE)
    .addBytes(ESC_COMMANDS.BOLD_OFF)
    .addTwoColumns('ORDER TYPE:', orderType.toUpperCase(), width);

  if (order.tableNumber) {
    builder
      .addBytes(ESC_COMMANDS.BOLD_ON)
      .addTwoColumns('SEATING:', `TABLE ${order.tableNumber}`, width)
      .addBytes(ESC_COMMANDS.BOLD_OFF);
  }

  builder
    .addTwoColumns('TIME PLACED:', new Date(order.createdAt || Date.now()).toLocaleTimeString('en-GB'), width)
    .addDivider('=', width);

  // Items for kitchen
  builder
    .addBytes(ESC_COMMANDS.BOLD_ON)
    .addLine('QTY   ITEMS TO PREPARE')
    .addBytes(ESC_COMMANDS.BOLD_OFF)
    .addDivider('-', width);

  const items = order.items || [];
  for (const item of items) {
    const qty = `[${item.quantity}x]`.padEnd(6);
    const name = item.product?.name || item.name || 'Kitchen Item';

    builder
      .addBytes(ESC_COMMANDS.BOLD_ON)
      .addBytes(ESC_COMMANDS.DOUBLE_HEIGHT_ON)
      .addLine(`${qty} ${name}`)
      .addBytes(ESC_COMMANDS.NORMAL_SIZE)
      .addBytes(ESC_COMMANDS.BOLD_OFF);

    if (item.customization) {
      if (item.customization.spiceLevel) {
        builder.addLine(`      >>> SPICE: ${item.customization.spiceLevel.toUpperCase()}`);
      }
      if (item.customization.specialInstructions) {
        builder
          .addBytes(ESC_COMMANDS.INVERT_ON)
          .addLine(`  NOTE: ${item.customization.specialInstructions}  `)
          .addBytes(ESC_COMMANDS.INVERT_OFF);
      }
    }
    builder.addLine('');
  }

  builder.addDivider('=', width);
  builder
    .addBytes(ESC_COMMANDS.ALIGN_CENTER)
    .addLine('EXPEDITE FRESH & PIPING HOT')
    .addLine(`Server: ${order.cashier || 'Front Counter'}`)
    .addBytes(ESC_COMMANDS.FEED_5_LINES);

  if (config.autoCut) {
    builder.addBytes(ESC_COMMANDS.FEED_AND_CUT);
  }

  return builder.build();
}

/**
 * Builds cash drawer kick command only
 */
export function buildCashDrawerKickEscPos(): Uint8Array {
  const builder = new EscPosBuilder();
  builder.addBytes(ESC_COMMANDS.DRAWER_KICK_PIN2);
  builder.addBytes(ESC_COMMANDS.DRAWER_KICK_PIN5);
  return builder.build();
}

/**
 * Builds Test Page ESC/POS buffer
 */
export function buildTestPageEscPos(config: PrinterConfig = DEFAULT_PRINTER_CONFIG): Uint8Array {
  const width = config.paperWidth === '58mm' ? 32 : 48;
  const builder = new EscPosBuilder();

  builder
    .addBytes(ESC_COMMANDS.INIT)
    .addBytes(ESC_COMMANDS.ALIGN_CENTER)
    .addBytes(ESC_COMMANDS.BOLD_ON)
    .addBytes(ESC_COMMANDS.DOUBLE_SIZE_ON)
    .addLine('CHOPLIFE HARDWARE TEST')
    .addBytes(ESC_COMMANDS.NORMAL_SIZE)
    .addLine('THERMAL ESC/POS PERIPHERAL READY')
    .addBytes(ESC_COMMANDS.BOLD_OFF)
    .addDivider('=', width)
    .addBytes(ESC_COMMANDS.ALIGN_LEFT)
    .addTwoColumns('Paper Width:', config.paperWidth, width)
    .addTwoColumns('Line Chars:', `${width} Chars`, width)
    .addTwoColumns('Auto Cut:', config.autoCut ? 'Enabled' : 'Disabled', width)
    .addTwoColumns('Drawer Kick:', config.autoOpenDrawer ? 'Enabled' : 'Disabled', width)
    .addTwoColumns('Test Time:', new Date().toLocaleString(), width)
    .addDivider('-', width)
    .addBytes(ESC_COMMANDS.ALIGN_CENTER)
    .addLine('1234567890 ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    .addLine('!@#$%^&*()_+-=[]{}|;:,.<>?')
    .addBytes(ESC_COMMANDS.INVERT_ON)
    .addLine(' INVERTED HIGH CONTRAST TEXT TEST ')
    .addBytes(ESC_COMMANDS.INVERT_OFF)
    .addDivider('=', width)
    .addLine('HARDWARE TEST PASSED OK')
    .addBytes(ESC_COMMANDS.FEED_5_LINES);

  if (config.autoCut) {
    builder.addBytes(ESC_COMMANDS.FEED_AND_CUT);
  }

  return builder.build();
}
