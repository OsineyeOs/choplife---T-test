/**
 * Choplife Republic — Authoritative Receipt & Ticket Rendering Pipeline
 * 
 * Provides a single unified rendering pipeline reused across:
 * 1. Live Interactive Template Preview (React DOM)
 * 2. Browser Thermal Print (isolated printable HTML document with @media print)
 * 3. ESC/POS Binary Byte Stream (direct hardware thermal generation)
 */

import {
  escapeHtml,
  formatNaira,
  resolveBranchDetails,
  normalizeReceiptArgs,
} from './receiptTypesAndNormalization';

export * from './receiptTypesAndNormalization';

/**
 * Unified HTML Renderer for Thermal Receipts & Tickets
 * Accepts either (data, template) or options object { documentType, order, template, paperWidth }
 */
export function renderReceiptHtml(arg1: any, arg2?: any): string {
  const { data, template } = normalizeReceiptArgs(arg1, arg2);
  const branch = resolveBranchDetails(data.branchId);
  const branchName = data.branchName || branch.name;
  const branchAddress = data.branchAddress || branch.address;
  const branchPhone = data.branchPhone || branch.phone;
  const widthPx = template.paperWidth === '58mm' ? '280px' : '380px';
  const fontSizeBase = template.paperWidth === '58mm' ? '11px' : '12px';

  const dateFormatted = new Date(data.createdAt).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
    <div class="receipt-container" style="width: ${widthPx}; max-width: 100%; margin: 0 auto; padding: 12px 8px; font-family: 'Courier New', Courier, monospace; color: #111111; font-size: ${fontSizeBase}; line-height: 1.35; background: #ffffff;">
      
      ${data.isSample ? `
        <div style="background: #FFF3CD; border: 1px dashed #856404; color: #856404; font-size: 10px; font-weight: bold; text-align: center; padding: 4px; margin-bottom: 8px; text-transform: uppercase;">
          *** SAMPLE PREVIEW • NOT AN OFFICIAL SALE ***
        </div>
      ` : ''}

      ${data.isReprint && template.showReprintIndicator ? `
        <div style="border: 2px solid #000; text-align: center; font-weight: 900; font-size: 13px; padding: 4px; margin-bottom: 8px; text-transform: uppercase;">
          *** DUPLICATE REPRINT (${data.reprintCount || 1}) ***
        </div>
      ` : ''}

      <!-- HEADER -->
      <div style="text-align: center; margin-bottom: 8px;">
        ${template.brandName ? `
          <div style="font-size: ${template.paperWidth === '58mm' ? '15px' : '18px'}; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
            ${escapeHtml(template.brandName)}
          </div>
        ` : ''}
        ${template.tagline ? `
          <div style="font-size: 9px; font-weight: bold; letter-spacing: 0.5px; margin-top: 1px;">
            ${escapeHtml(template.tagline)}
          </div>
        ` : ''}
        ${template.showBranchAddress && branchAddress ? `
          <div style="font-size: 10px; margin-top: 3px;">
            ${escapeHtml(branchName)}<br/>${escapeHtml(branchAddress)}
          </div>
        ` : ''}
        ${template.showBranchPhone && branchPhone ? `
          <div style="font-size: 10px;">
            Tel: ${escapeHtml(branchPhone)}
          </div>
        ` : ''}
        ${template.customHeaderMessage ? `
          <div style="font-size: 10px; font-weight: bold; margin-top: 4px; border-top: 1px dashed #666; border-bottom: 1px dashed #666; padding: 3px 0;">
            ${escapeHtml(template.customHeaderMessage)}
          </div>
        ` : ''}
      </div>

      <div style="border-top: 1px dashed #111; margin: 6px 0;"></div>

      <!-- TRANSACTION METADATA -->
      <div style="margin-bottom: 6px; font-size: 11px;">
        ${template.showOrderNumber ? `
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: ${template.paperWidth === '58mm' ? '12px' : '14px'};">
            <span>ORDER #:</span>
            <span>#${escapeHtml(data.orderNumber)}</span>
          </div>
        ` : ''}
        ${template.showDateTime ? `
          <div style="display: flex; justify-content: space-between;">
            <span>DATE/TIME:</span>
            <span>${escapeHtml(dateFormatted)}</span>
          </div>
        ` : ''}
        ${template.showOrderType ? `
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>ORDER TYPE:</span>
            <span>${escapeHtml(data.orderType.toUpperCase())}</span>
          </div>
        ` : ''}
        ${template.showTableNumber && data.tableNumber ? `
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>TABLE:</span>
            <span>${escapeHtml(String(data.tableNumber))}</span>
          </div>
        ` : ''}
        ${template.showCashierName && data.cashierName ? `
          <div style="display: flex; justify-content: space-between;">
            <span>SERVER / CASHIER:</span>
            <span>${escapeHtml(data.cashierName)}</span>
          </div>
        ` : ''}
        ${template.showCustomerDetails && data.customerName ? `
          <div style="display: flex; justify-content: space-between;">
            <span>CUSTOMER:</span>
            <span>${escapeHtml(data.customerName)}</span>
          </div>
        ` : ''}
      </div>

      <div style="border-top: 1px solid #111; margin: 6px 0;"></div>

      <!-- LINE ITEMS -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
        <thead>
          <tr style="border-bottom: 1px dashed #111; font-weight: bold; font-size: 10px;">
            <th style="text-align: left; padding: 2px 0;">ITEM</th>
            <th style="text-align: center; width: 36px; padding: 2px 0;">QTY</th>
            ${template.docType === 'customer_receipt' || template.docType === 'bill_check' ? `
              <th style="text-align: right; width: 65px; padding: 2px 0;">AMOUNT</th>
            ` : ''}
          </tr>
        </thead>
        <tbody>
          ${data.items.map((item) => `
            <tr style="vertical-align: top;">
              <td style="padding: 4px 0 2px 0;">
                <span style="${template.boldItemQuantities ? 'font-weight: 700;' : ''}">${escapeHtml(item.name)}</span>
                ${template.showItemModifiers && item.modifiers ? `
                  <div style="font-size: 10px; color: #444; padding-left: 6px; font-style: italic;">
                    ${item.modifiers.spiceLevel ? `<div>• Spice: ${escapeHtml(item.modifiers.spiceLevel)}</div>` : ''}
                    ${item.modifiers.specialInstructions ? `<div style="${template.highlightKitchenNotes ? 'font-weight: bold; color: #000;' : ''}">• Note: ${escapeHtml(item.modifiers.specialInstructions)}</div>` : ''}
                  </div>
                ` : ''}
              </td>
              <td style="text-align: center; padding: 4px 0; font-weight: ${template.boldItemQuantities ? '900' : 'bold'}; font-size: ${template.boldItemQuantities ? '13px' : '11px'};">
                ${item.quantity}x
              </td>
              ${template.docType === 'customer_receipt' || template.docType === 'bill_check' ? `
                <td style="text-align: right; padding: 4px 0; font-weight: bold;">
                  ${formatNaira((item.unitPrice || 0) * item.quantity)}
                </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${(template.docType === 'customer_receipt' || template.docType === 'bill_check') ? `
        <div style="border-top: 1px dashed #111; margin: 6px 0;"></div>

        <!-- TOTALS & FINANCIAL BREAKDOWN -->
        <div style="font-size: 11px;">
          ${template.showSubtotal ? `
            <div style="display: flex; justify-content: space-between;">
              <span>SUBTOTAL:</span>
              <span>${formatNaira(data.subtotal)}</span>
            </div>
          ` : ''}
          ${template.showDiscounts && (data.discount || 0) > 0 ? `
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>DISCOUNT:</span>
              <span>-${formatNaira(data.discount || 0)}</span>
            </div>
          ` : ''}
          ${template.showDeliveryFee && (data.deliveryFee || 0) > 0 ? `
            <div style="display: flex; justify-content: space-between;">
              <span>DELIVERY FEE:</span>
              <span>${formatNaira(data.deliveryFee || 0)}</span>
            </div>
          ` : ''}
          ${template.showTaxBreakdown && (data.vatAmount || 0) > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 10px;">
              <span>VAT (7.5% INCL):</span>
              <span>${formatNaira(data.vatAmount || 0)}</span>
            </div>
          ` : ''}

          <div style="border-top: 2px solid #111; margin: 4px 0;"></div>

          <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: ${template.paperWidth === '58mm' ? '14px' : '16px'}; margin: 2px 0;">
            <span>TOTAL:</span>
            <span>${formatNaira(data.total)}</span>
          </div>

          ${template.showPaymentDetails && data.paymentMethod ? `
            <div style="border-top: 1px dashed #111; margin: 4px 0; padding-top: 4px;">
              <div style="display: flex; justify-content: space-between;">
                <span>PAYMENT METHOD:</span>
                <span style="font-weight: bold;">${escapeHtml(data.paymentMethod.toUpperCase())}</span>
              </div>
              ${data.paymentReference ? `
                <div style="display: flex; justify-content: space-between; font-size: 10px;">
                  <span>REF:</span>
                  <span>${escapeHtml(data.paymentReference)}</span>
                </div>
              ` : ''}
            </div>
          ` : ''}

          ${template.showTenderAndChange && data.tenderedAmount !== undefined ? `
            <div style="display: flex; justify-content: space-between;">
              <span>TENDERED:</span>
              <span>${formatNaira(data.tenderedAmount)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>CHANGE:</span>
              <span>${formatNaira(data.changeAmount || 0)}</span>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- SHIFT Z-REPORT BREAKDOWN -->
      ${data.documentType === 'shift_z_report' && data.shiftData ? `
        <div style="border-top: 1px solid #111; border-bottom: 1px solid #111; padding: 6px 0; margin: 8px 0; font-size: 11px;">
          <div style="font-weight: 900; text-align: center; margin-bottom: 4px; text-transform: uppercase;">
            SHIFT FINANCIAL RECONCILIATION
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>SHIFT ID:</span>
            <span style="font-weight: bold;">${escapeHtml(data.shiftData.shiftId)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>REGISTER:</span>
            <span>${escapeHtml(data.shiftData.registerId)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>TOTAL CHECKS:</span>
            <span>${data.shiftData.totalOrdersCount}</span>
          </div>
          <div style="border-top: 1px dashed #666; margin: 4px 0;"></div>
          <div style="display: flex; justify-content: space-between;">
            <span>OPENING FLOAT:</span>
            <span>${formatNaira(data.shiftData.openingFloat)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>CASH SALES:</span>
            <span>${formatNaira(data.shiftData.cashSales)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>POS / CARD SALES:</span>
            <span>${formatNaira(data.shiftData.cardSales)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>BANK TRANSFERS:</span>
            <span>${formatNaira(data.shiftData.transferSales)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>SAFE DROPS:</span>
            <span>-${formatNaira(data.shiftData.safeDrops)}</span>
          </div>
          <div style="border-top: 2px solid #111; margin: 4px 0;"></div>
          <div style="display: flex; justify-content: space-between; font-weight: 900;">
            <span>EXPECTED CASH:</span>
            <span>${formatNaira(data.shiftData.expectedCash)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: 900;">
            <span>PHYSICAL COUNT:</span>
            <span>${formatNaira(data.shiftData.countedCash)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: 900; color: ${data.shiftData.cashVariance === 0 ? '#000' : '#d00'};">
            <span>VARIANCE:</span>
            <span>${formatNaira(data.shiftData.cashVariance)}</span>
          </div>
        </div>
      ` : ''}

      ${template.showLoyaltyPoints && (data.loyaltyPointsEarned || data.loyaltyBalance) ? `
        <div style="border-top: 1px dashed #111; margin: 6px 0; padding-top: 4px; font-size: 10px; text-align: center;">
          ${data.loyaltyPointsEarned ? `<div>Points Earned: +${data.loyaltyPointsEarned} pts</div>` : ''}
          ${data.loyaltyBalance ? `<div>Total Rewards Balance: ${data.loyaltyBalance} pts</div>` : ''}
        </div>
      ` : ''}

      <!-- FOOTER -->
      <div style="text-align: center; margin-top: 10px; font-size: 10px;">
        ${template.thankYouMessage ? `
          <div style="font-weight: bold; margin-bottom: 2px;">
            ${escapeHtml(template.thankYouMessage)}
          </div>
        ` : ''}
        ${template.customFooterMessage ? `
          <div style="color: #444; margin-top: 2px;">
            ${escapeHtml(template.customFooterMessage)}
          </div>
        ` : ''}
        <div style="margin-top: 6px; font-size: 9px; color: #777;">
          *** 100% MAXIMUM ENJOYMENT • BENIN CITY ***
        </div>
      </div>

    </div>
  `;
}

export { renderReceiptEscPos } from './receiptEscPosRenderer';

