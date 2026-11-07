/**
 * Hardware Thermal Printer — Device Transport & Browser Print Frame Layer
 */

import { PrinterConfig, DEFAULT_PRINTER_CONFIG } from './escpos';

export type ConnectionType = 'browser_thermal' | 'web_serial' | 'web_usb' | 'web_bluetooth' | 'network_ip';

export interface NetworkPrinterProfile {
  id: string;
  name: string;
  role: 'counter_pos' | 'kitchen_kot' | 'bakery' | 'drinks';
  ip: string;
  port: number;
  paperWidth: '80mm' | '58mm';
  enabled: boolean;
  autoCut: boolean;
  soundBuzzer: boolean;
  kickDrawer: boolean;
  lastPingStatus?: 'online' | 'offline' | 'unknown';
  lastLatencyMs?: number;
}

export interface HardwarePrinterState {
  connectionType: ConnectionType;
  config: PrinterConfig;
  connectedDeviceName: string | null;
  networkPrinterIp: string;
  networkPrinterPort: number;
  networkPrinters: NetworkPrinterProfile[];
  lastPrintTimestamp: string | null;
  status: 'disconnected' | 'connected' | 'printing' | 'error';
  lastError: string | null;
}

const PRINTER_STORAGE_KEY = 'choplife_hardware_printer_config';

export function loadHardwarePrinterState(): HardwarePrinterState {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(PRINTER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          networkPrinterPort: parsed.networkPrinterPort || 9100,
          networkPrinters: parsed.networkPrinters || [],
          status: parsed.connectionType === 'browser_thermal' ? 'connected' : 'disconnected',
          lastError: null,
        };
      }
    }
  } catch (e) {
    console.error('Failed to load printer settings:', e);
  }

  return {
    connectionType: 'browser_thermal',
    config: DEFAULT_PRINTER_CONFIG,
    connectedDeviceName: 'Direct Browser Thermal Driver (System Print Dialog / USB)',
    networkPrinterIp: '',
    networkPrinterPort: 9100,
    networkPrinters: [],
    lastPrintTimestamp: null,
    status: 'connected',
    lastError: null,
  };
}

export function saveHardwarePrinterState(state: Partial<HardwarePrinterState>) {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const current = loadHardwarePrinterState();
      const updated = { ...current, ...state };
      localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Failed to save printer settings:', e);
  }
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getPrinterAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = localStorage.getItem('choplife_staff_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // ignore storage errors
  }
  return headers;
}

export async function pingNetworkPrinter(ip: string, port: number = 9100): Promise<{
  online: boolean;
  latencyMs: number;
  message: string;
}> {
  try {
    const res = await fetch('/api/pos/printers/network-ping', {
      method: 'POST',
      headers: getPrinterAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ ip, port }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return {
        online: !!data.online,
        latencyMs: data.latencyMs || 0,
        message: data.message || (data.online ? 'TCP socket reachable' : 'Printer unreachable on LAN'),
      };
    }
    return {
      online: false,
      latencyMs: 0,
      message: data.error || data.message || `Request failed (${res.status})`,
    };
  } catch (err: any) {
    console.warn('[PRINTER PING] Network error:', err);
  }
  return { online: false, latencyMs: 0, message: 'Could not connect to printer endpoint' };
}

export async function sendRawEscPosOverNetwork(
  bytes: Uint8Array,
  ip: string,
  port: number = 9100,
  printerName: string = 'Network Thermal Printer',
  paperWidth: '80mm' | '58mm' = '80mm'
): Promise<{ success: boolean; message: string; hexDumpPreview?: string }> {
  try {
    playThermalPrintSound();
    const hexData = bytesToHex(bytes);
    const res = await fetch('/api/pos/printers/network-print', {
      method: 'POST',
      headers: getPrinterAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        ip,
        port,
        printerName,
        hexData,
        paperWidth,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message || `Transmitted ${data.bytesTransmitted || bytes.length} bytes to ${ip}:${port}`,
        hexDumpPreview: data.hexDumpPreview,
      };
    }
    return {
      success: false,
      message: data.error || data.message || `Network printer ${ip}:${port} unreachable (${res.status})`,
      hexDumpPreview: data.hexDumpPreview,
    };
  } catch (err: any) {
    console.error('[NETWORK PRINT ERROR]', err);
    return { success: false, message: `Network print failed: ${err.message || 'Connection error'}` };
  }
}

// Active connection handles in memory
let activeSerialPort: any = null;
let activeUsbDevice: any = null;

export function hasActiveHardwareDevice(connectionType: ConnectionType): boolean {
  return (connectionType === 'web_serial' && !!activeSerialPort) || (connectionType === 'web_usb' && !!activeUsbDevice);
}

// Sound synthesis for Cash Drawer Kick & Thermal Print Chime
export function playDrawerKickSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // AudioContext blocked
  }
}

export function playThermalPrintSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 0.2 - 0.1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    noise.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  } catch {
    // AudioContext blocked
  }
}

export async function connectSerialPrinter(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
  if (!('serial' in navigator)) {
    return { success: false, error: 'Web Serial API is not supported in this browser. Please use Chrome, Edge, or Browser Thermal mode.' };
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 9600 });
    activeSerialPort = port;
    const info = port.getInfo();
    const name = `Serial POS (USB: ${info.usbVendorId?.toString(16) || 'COM'})`;
    saveHardwarePrinterState({
      connectionType: 'web_serial',
      connectedDeviceName: name,
      status: 'connected',
    });
    return { success: true, deviceName: name };
  } catch (err: any) {
    return { success: false, error: err.message || 'Serial connection cancelled or failed.' };
  }
}

export async function connectUsbPrinter(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
  if (!('usb' in navigator)) {
    return { success: false, error: 'WebUSB API is not supported in this browser. Please use Chrome, Edge, or Browser Thermal mode.' };
  }

  try {
    const device = await (navigator as any).usb.requestDevice({
      filters: [{ classCode: 7 }],
    });
    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);
    activeUsbDevice = device;
    const name = device.productName || `USB Thermal (${device.vendorId.toString(16)})`;
    saveHardwarePrinterState({
      connectionType: 'web_usb',
      connectedDeviceName: name,
      status: 'connected',
    });
    return { success: true, deviceName: name };
  } catch (err: any) {
    return { success: false, error: err.message || 'USB printer selection cancelled or unavailable.' };
  }
}

export async function sendRawEscPosToHardware(data: Uint8Array): Promise<{ success: boolean; error?: string }> {
  const state = loadHardwarePrinterState();

  if (state.connectionType === 'web_serial' && activeSerialPort) {
    try {
      const writer = activeSerialPort.writable.getWriter();
      await writer.write(data);
      writer.releaseLock();
      playThermalPrintSound();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `Serial write failed: ${err.message}` };
    }
  }

  if (state.connectionType === 'web_usb' && activeUsbDevice) {
    try {
      const endpoint = activeUsbDevice.configuration.interfaces[0].alternate.endpoints.find(
        (e: any) => e.direction === 'out'
      );
      if (!endpoint) throw new Error('No OUT endpoint found on USB printer interface.');
      await activeUsbDevice.transferOut(endpoint.endpointNumber, data);
      playThermalPrintSound();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `USB transfer failed: ${err.message}` };
    }
  }

  return { success: false, error: 'Hardware printer not connected or port closed.' };
}
