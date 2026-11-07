/**
 * Hardware Thermal Printer & Peripherals Controller
 * High-level thermal browser print frame and receipt/KOT/drawer dispatchers
 */

import {
  buildCustomerReceiptEscPos,
  buildKitchenKotEscPos,
  buildCashDrawerKickEscPos,
  buildTestPageEscPos,
} from './escpos';
import {
  renderReceiptHtml,
  generateSampleReceiptData,
} from './receiptRenderer';
import {
  loadHardwarePrinterState,
  saveHardwarePrinterState,
  sendRawEscPosOverNetwork,
  sendRawEscPosToHardware,
  hasActiveHardwareDevice,
  playDrawerKickSound,
  playThermalPrintSound,
} from './hardwareDeviceTransport';

export * from './hardwareDeviceTransport';

/**
 * Print via Isolated Thermal Browser Engine
 * Renders an offscreen iframe with standard 80mm/58mm thermal ticket layout,
 * avoiding the surrounding POS screen or dashboard.
 */
export function printThermalHtml(htmlContent: string, width: '80mm' | '58mm' = '80mm'): Promise<boolean> {
  return new Promise((resolve) => {
    playThermalPrintSound();

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      resolve(false);
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Choplife Republic Thermal Receipt</title>
          <style>
            @page {
              size: ${width} auto;
              margin: 0;
            }
            body {
              width: ${width === '58mm' ? '54mm' : '72mm'};
              margin: 0 auto;
              padding: 4mm 2mm;
              font-family: 'Courier New', Courier, monospace;
              font-size: ${width === '58mm' ? '11px' : '12px'};
              line-height: 1.25;
              color: #000;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            * { box-sizing: border-box; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .divider-solid { border-top: 1.5px solid #000; margin: 8px 0; }
            .flex-between { display: flex; justify-content: space-between; align-items: baseline; }
            .items-table { width: 100%; border-collapse: collapse; margin: 4px 0; }
            .items-table th { border-bottom: 1px dashed #000; padding-bottom: 3px; font-weight: bold; font-size: 11px; }
            .items-table td { padding: 3px 0; vertical-align: top; }
            .tag { display: inline-block; padding: 2px 4px; background: #000; color: #fff; font-weight: bold; font-size: 10px; }
          </style>
        </head>
        <body>
          ${htmlContent}
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() {
                window.parent.postMessage('choplife_print_done', '*');
              }, 600);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();

    const handleMessage = (e: MessageEvent) => {
      if (e.data === 'choplife_print_done') {
        window.removeEventListener('message', handleMessage);
        try {
          document.body.removeChild(iframe);
        } catch {
          // cleanup
        }
        resolve(true);
      }
    };

    window.addEventListener('message', handleMessage);

    // Fallback cleanup after 8 seconds
    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      try {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      } catch {
        // ignore
      }
      resolve(true);
    }, 8000);
  });
}

/**
 * Resolves the latest saved receipt template from local cache if available
 */
export function getCachedReceiptTemplate(docType: string): any | undefined {
  try {
    const raw = localStorage.getItem('choplife_cached_receipt_templates');
    if (!raw) return undefined;
    const map = JSON.parse(raw);
    return map[docType] || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Generates clean thermal HTML markup for Customer Receipt using authoritative renderer
 */
export function generateCustomerReceiptHtml(order: any, width?: '80mm' | '58mm', customTemplate?: any): string {
  const tmpl = customTemplate || getCachedReceiptTemplate('customer_receipt');
  const paperWidth = width || tmpl?.paperWidth || '80mm';
  return renderReceiptHtml({
    documentType: 'customer_receipt',
    order,
    template: tmpl,
    paperWidth,
  });
}

/**
 * Generates clean thermal HTML markup for Kitchen Order Ticket (KOT) using authoritative renderer
 */
export function generateKitchenKotHtml(order: any, station: string = 'all', width?: '80mm' | '58mm', customTemplate?: any): string {
  const tmpl = customTemplate || getCachedReceiptTemplate('kitchen_kot');
  const paperWidth = width || tmpl?.paperWidth || '80mm';
  return renderReceiptHtml({
    documentType: 'kitchen_kot',
    order,
    station,
    template: tmpl,
    paperWidth,
  });
}

/**
 * Main High-Level Print Dispatcher
 * Sends to hardware device if WebSerial/WebUSB is active, or prints via isolated browser thermal engine.
 */
export async function dispatchCustomerReceipt(order: any): Promise<{ success: boolean; method: string; error?: string }> {
  const state = loadHardwarePrinterState();

  if (state.config.autoOpenDrawer && order.paymentMethod === 'cash') {
    kickCashDrawerPeripheral();
  }

  if (state.connectionType === 'network_ip') {
    const counterPrinter = state.networkPrinters.find((p) => p.role === 'counter_pos' && p.enabled) || state.networkPrinters[0];
    const ip = counterPrinter?.ip || state.networkPrinterIp || '192.168.1.200';
    const port = counterPrinter?.port || state.networkPrinterPort || 9100;
    const bytes = buildCustomerReceiptEscPos(order, {
      ...state.config,
      paperWidth: counterPrinter?.paperWidth || state.config.paperWidth,
    });
    const res = await sendRawEscPosOverNetwork(bytes, ip, port, counterPrinter?.name || 'Counter POS Printer', counterPrinter?.paperWidth || '80mm');
    saveHardwarePrinterState({ lastPrintTimestamp: new Date().toISOString() });
    return { success: true, method: 'network_ip', error: res.message };
  }

  if (hasActiveHardwareDevice(state.connectionType)) {
    const bytes = buildCustomerReceiptEscPos(order, state.config);
    const res = await sendRawEscPosToHardware(bytes);
    if (res.success) {
      saveHardwarePrinterState({ lastPrintTimestamp: new Date().toISOString() });
      return { success: true, method: state.connectionType };
    }
  }

  const html = generateCustomerReceiptHtml(order, state.config.paperWidth);
  const printed = await printThermalHtml(html, state.config.paperWidth);
  saveHardwarePrinterState({ lastPrintTimestamp: new Date().toISOString() });
  return { success: printed, method: 'browser_thermal' };
}

/**
 * Main High-Level Kitchen KOT Dispatcher
 */
export async function dispatchKitchenKot(order: any, station: string = 'all'): Promise<{ success: boolean; method: string; error?: string }> {
  const state = loadHardwarePrinterState();

  if (state.connectionType === 'network_ip') {
    const kitchenPrinter = state.networkPrinters.find((p) => (p.role === 'kitchen_kot' || p.role === 'bakery') && p.enabled) || state.networkPrinters[1];
    const ip = kitchenPrinter?.ip || '192.168.1.201';
    const port = kitchenPrinter?.port || 9100;
    const bytes = buildKitchenKotEscPos(order, station, {
      ...state.config,
      paperWidth: kitchenPrinter?.paperWidth || '80mm',
    });
    const res = await sendRawEscPosOverNetwork(bytes, ip, port, kitchenPrinter?.name || 'Kitchen KOT Printer', kitchenPrinter?.paperWidth || '80mm');
    saveHardwarePrinterState({ lastPrintTimestamp: new Date().toISOString() });
    return { success: true, method: 'network_ip', error: res.message };
  }

  if (hasActiveHardwareDevice(state.connectionType)) {
    const bytes = buildKitchenKotEscPos(order, station, state.config);
    const res = await sendRawEscPosToHardware(bytes);
    if (res.success) {
      saveHardwarePrinterState({ lastPrintTimestamp: new Date().toISOString() });
      return { success: true, method: state.connectionType };
    }
  }

  const html = generateKitchenKotHtml(order, station, state.config.paperWidth);
  const printed = await printThermalHtml(html, state.config.paperWidth);
  saveHardwarePrinterState({ lastPrintTimestamp: new Date().toISOString() });
  return { success: printed, method: 'browser_thermal' };
}

/**
 * Cash Drawer Manual / Auto Kick
 */
export async function kickCashDrawerPeripheral(): Promise<{ success: boolean; method: string }> {
  playDrawerKickSound();
  const state = loadHardwarePrinterState();

  if (state.connectionType === 'network_ip') {
    const counterPrinter = state.networkPrinters.find((p) => p.role === 'counter_pos' && p.enabled) || state.networkPrinters[0];
    const ip = counterPrinter?.ip || state.networkPrinterIp || '192.168.1.200';
    const port = counterPrinter?.port || 9100;
    const bytes = buildCashDrawerKickEscPos();
    await sendRawEscPosOverNetwork(bytes, ip, port, counterPrinter?.name || 'Counter Drawer Kick', '80mm');
    return { success: true, method: 'network_ip' };
  }

  if (hasActiveHardwareDevice(state.connectionType)) {
    const bytes = buildCashDrawerKickEscPos();
    await sendRawEscPosToHardware(bytes);
    return { success: true, method: state.connectionType };
  }

  return { success: true, method: 'simulated_chime' };
}

/**
 * Diagnostics Test Print
 */
export async function dispatchDiagnosticsTest(): Promise<{ success: boolean; method: string }> {
  const state = loadHardwarePrinterState();

  if (state.connectionType === 'network_ip') {
    const bytes = buildTestPageEscPos(state.config);
    const counterPrinter = state.networkPrinters.find((p) => p.role === 'counter_pos' && p.enabled) || state.networkPrinters[0];
    const ip = counterPrinter?.ip || state.networkPrinterIp || '192.168.1.200';
    const port = counterPrinter?.port || 9100;
    await sendRawEscPosOverNetwork(bytes, ip, port, counterPrinter?.name || 'Self-Test Print', state.config.paperWidth);
    return { success: true, method: 'network_ip' };
  }

  if (hasActiveHardwareDevice(state.connectionType)) {
    const bytes = buildTestPageEscPos(state.config);
    await sendRawEscPosToHardware(bytes);
    return { success: true, method: state.connectionType };
  }

  const sampleOrder = generateSampleReceiptData('customer_receipt');
  const html = generateCustomerReceiptHtml(sampleOrder, state.config.paperWidth);
  await printThermalHtml(html, state.config.paperWidth);
  return { success: true, method: 'browser_thermal' };
}
