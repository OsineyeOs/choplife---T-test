import React, { useState, useEffect, useRef } from 'react';
import {
  Scan,
  Camera,
  X,
  CheckCircle2,
  AlertCircle,
  Package,
  Bike,
  KeyRound,
  Zap,
  Search,
} from 'lucide-react';
import { BranchId } from '../../types';

export interface BarcodeDispatchScannerProps {
  isOpen: boolean;
  onClose: () => void;
  activeBranchId: BranchId;
  defaultAction?: 'pack' | 'pickup' | 'handover';
  onScanSuccess?: (result: any) => void;
}

export const BarcodeDispatchScanner: React.FC<BarcodeDispatchScannerProps> = ({
  isOpen,
  onClose,
  activeBranchId,
  defaultAction = 'pack',
  onScanSuccess,
}) => {
  const [stationMode, setStationMode] = useState<'pack' | 'pickup' | 'handover'>(defaultAction);
  const [manualCode, setManualCode] = useState<string>('');
  const [handoverPinInput, setHandoverPinInput] = useState<string>('');
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [riders, setRiders] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string; data?: any } | null>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Hardware wedge scanner buffer
  const keyBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const lastSubmitTimeRef = useRef<number>(0);

  // Optical Camera Frame Barcode Scanner Loop
  useEffect(() => {
    let isCancelled = false;
    let detector: any = null;

    if (isCameraActive && typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'upc_a'],
        });
      } catch {
        detector = null;
      }
    }

    const scanFrame = async () => {
      if (isCancelled || !isCameraActive || !videoRef.current) return;

      if (detector && videoRef.current.readyState >= 2) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0 && !isProcessing) {
            const raw = barcodes[0].rawValue;
            if (raw) {
              executeBarcodeAction(raw);
            }
          }
        } catch {
          // ignore transient frame decode errors
        }
      }

      if (!isCancelled && isCameraActive) {
        animationFrameIdRef.current = requestAnimationFrame(scanFrame);
      }
    };

    if (isCameraActive) {
      animationFrameIdRef.current = requestAnimationFrame(scanFrame);
    }

    return () => {
      isCancelled = true;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [isCameraActive, stationMode, selectedRiderId, handoverPinInput, isProcessing]);

  const getAuthHeaders = (extra: Record<string, string> = {}) => {
    const token = localStorage.getItem('choplife_staff_token') || '';
    return { Authorization: `Bearer ${token}`, ...extra };
  };

  // Sound generator
  const playScanBeep = (success: boolean = true) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = success ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(success ? 880 : 220, ctx.currentTime);
      if (success) {
        osc.frequency.setValueAtTime(1760, ctx.currentTime + 0.08);
      }

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(success ? [60, 40, 60] : [200]);
      }
    } catch {}
  };

  // Fetch branch riders for pickup station
  useEffect(() => {
    if (isOpen) {
      fetch(`/api/dispatch/riders?branchId=${activeBranchId}`, {
        headers: getAuthHeaders(),
      })
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data) ? data : Array.isArray(data?.riders) ? data.riders : [];
          setRiders(list);
          if (list.length > 0 && !selectedRiderId) {
            setSelectedRiderId(list[0].id);
          }
        })
        .catch(() => setRiders([]));
    }
  }, [isOpen, activeBranchId]);

  // Hardware Wedge Scanner Keyboard Listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const now = Date.now();
      const diff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        if (keyBufferRef.current.length >= 3) {
          const scanned = keyBufferRef.current.trim();
          keyBufferRef.current = '';
          executeBarcodeAction(scanned);
        }
        keyBufferRef.current = '';
        return;
      }

      if (diff > 120 && keyBufferRef.current.length > 0) {
        keyBufferRef.current = '';
      }

      if (e.key.length === 1) {
        keyBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, stationMode, selectedRiderId, handoverPinInput]);

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      setCameraError(err.message || 'Unable to access device camera.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (!isOpen && isCameraActive) {
      stopCamera();
    }
  }, [isOpen]);

  // Execute scan transition
  const executeBarcodeAction = async (barcode: string) => {
    const now = Date.now();
    if (!barcode || isProcessing || now - lastSubmitTimeRef.current < 600) return;
    lastSubmitTimeRef.current = now;

    setIsProcessing(true);
    setFeedback(null);

    try {
      const payload: any = {
        barcode: barcode.trim(),
        actionType: stationMode,
        branchId: activeBranchId,
      };

      if (stationMode === 'pickup') {
        payload.riderId = selectedRiderId;
      }

      if (stationMode === 'handover') {
        payload.handoverPin = handoverPinInput.trim();
      }

      const res = await fetch('/api/dispatch/scan-action', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        playScanBeep(true);
        setFeedback({
          type: 'success',
          message: data.message,
          data: data.task,
        });

        const newLog = {
          id: `scan-${Date.now()}`,
          orderNumber: data.orderNumber,
          actionType: stationMode,
          timestamp: new Date().toLocaleTimeString(),
          message: data.message,
        };
        setRecentScans((prev) => [newLog, ...prev.slice(0, 7)]);
        setManualCode('');
        setHandoverPinInput('');

        if (onScanSuccess) {
          onScanSuccess(data);
        }
      } else {
        playScanBeep(false);
        setFeedback({
          type: 'error',
          message: data.error || 'Barcode scan failed or ticket not found.',
        });
      }
    } catch (err: any) {
      playScanBeep(false);
      setFeedback({
        type: 'error',
        message: err.message || 'Network error executing scanner action.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const safeRiders = Array.isArray(riders) ? riders : [];

  return (
    <div className="fixed inset-0 z-80 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white text-stone-900 border border-[#E5DEC9] rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-montserrat">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#FAF7F2] border-b border-[#E5DEC9] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#4D080F] text-[#FFC700] flex items-center justify-center shadow-xs">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-titan uppercase bg-[#4D080F] text-[#FFC700]">
                  Wedge &amp; Optical Scanner
                </span>
                <span className="text-xs text-stone-500 font-mono">USB / Bluetooth / Camera</span>
              </div>
              <h3 className="font-titan text-lg sm:text-xl text-[#4D080F]">
                Dispatch &amp; Kitchen Barcode Scanner
              </h3>
            </div>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="min-h-[44px] min-w-[44px] touch-manipulation flex items-center justify-center rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Station Mode Switcher */}
        <div className="bg-white px-4 py-2.5 border-b border-[#E5DEC9] grid grid-cols-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setStationMode('pack')}
            className={`min-h-[44px] touch-manipulation px-3 py-2 rounded-xl text-xs font-titan transition-all flex items-center justify-center gap-1.5 ${
              stationMode === 'pack'
                ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                : 'bg-[#FAF7F2] text-stone-600 hover:text-[#4D080F] border border-[#E5DEC9]'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>1. Pack &amp; QC</span>
          </button>

          <button
            type="button"
            onClick={() => setStationMode('pickup')}
            className={`min-h-[44px] touch-manipulation px-3 py-2 rounded-xl text-xs font-titan transition-all flex items-center justify-center gap-1.5 ${
              stationMode === 'pickup'
                ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                : 'bg-[#FAF7F2] text-stone-600 hover:text-[#4D080F] border border-[#E5DEC9]'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>2. Rider Pickup</span>
          </button>

          <button
            type="button"
            onClick={() => setStationMode('handover')}
            className={`min-h-[44px] touch-manipulation px-3 py-2 rounded-xl text-xs font-titan transition-all flex items-center justify-center gap-1.5 ${
              stationMode === 'handover'
                ? 'bg-[#4D080F] text-[#FFC700] shadow-xs'
                : 'bg-[#FAF7F2] text-stone-600 hover:text-[#4D080F] border border-[#E5DEC9]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>3. PIN Handover</span>
          </button>
        </div>

        {/* Modal Stage */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-[#FAF7F2]">
          {/* Station Context Banner */}
          <div className="p-3.5 bg-white rounded-2xl border border-[#E5DEC9] text-xs flex items-center justify-between shadow-2xs">
            <div>
              <span className="font-titan text-[#4D080F] block">
                {stationMode === 'pack' && 'Station 1: Kitchen Packing & QC Verification'}
                {stationMode === 'pickup' && 'Station 2: Courier Load & Dispatch Bag Handover'}
                {stationMode === 'handover' && 'Station 3: Customer Arrival & 4-Digit Handover PIN Verification'}
              </span>
              <p className="text-stone-500 text-[11px] mt-0.5">
                {stationMode === 'pack' && 'Scan kitchen order ticket to mark order ready for courier assignment.'}
                {stationMode === 'pickup' && 'Rider scans ticket to assign bag and trigger customer SMS/WhatsApp tracking.'}
                {stationMode === 'handover' && 'Enter or scan customer PIN to confirm verified delivery and close ticket.'}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#4D080F] text-[#FFC700] font-mono text-xs font-bold">
              {stationMode.toUpperCase()}
            </span>
          </div>

          {/* If Pickup mode: Rider Selector */}
          {stationMode === 'pickup' && (
            <div className="p-3.5 bg-white rounded-2xl border border-[#E5DEC9] space-y-1.5 shadow-2xs">
              <label className="text-xs font-titan text-[#4D080F] block">
                Assign To Dispatch Rider:
              </label>
              <select
                value={selectedRiderId}
                onChange={(e) => setSelectedRiderId(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#E5DEC9] text-stone-900 rounded-xl px-3 py-2 text-xs font-montserrat font-bold focus:border-[#4D080F] outline-none"
              >
                {safeRiders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.phone}) • {(r.status || r.currentStatus || 'AVAILABLE').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* If Handover mode: 4-digit PIN input */}
          {stationMode === 'handover' && (
            <div className="p-3.5 bg-white rounded-2xl border border-[#E5DEC9] space-y-1.5 shadow-2xs">
              <label className="text-xs font-titan text-[#4D080F] block">
                Customer 4-Digit Handover PIN (from WhatsApp / SMS):
              </label>
              <input
                type="text"
                maxLength={4}
                value={handoverPinInput}
                onChange={(e) => setHandoverPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 4821"
                className="w-full bg-[#FAF7F2] border border-[#E5DEC9] text-[#4D080F] font-mono font-bold text-center tracking-widest text-lg rounded-xl px-3 py-2 outline-none focus:border-[#4D080F]"
              />
            </div>
          )}

          {/* Camera Viewport or Viewport Trigger */}
          <div className="relative rounded-2xl overflow-hidden bg-stone-900 border border-[#E5DEC9] aspect-video flex items-center justify-center">
            {isCameraActive ? (
              <>
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-36 border-2 border-[#FFC700] rounded-2xl relative shadow-lg">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#FFC700]"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#FFC700]"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#FFC700]"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#FFC700]"></div>
                    <div className="w-full h-0.5 bg-red-500/80 shadow-[0_0_8px_#ef4444] animate-pulse"></div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/70 text-white text-xs font-titan border border-stone-700"
                >
                  Turn Off Camera
                </button>
              </>
            ) : (
              <div className="text-center p-6 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-stone-800 border border-stone-700 flex items-center justify-center mx-auto text-[#FFC700]">
                  <Camera className="w-7 h-7" />
                </div>
                <div>
                  <div className="font-titan text-sm text-white">Live Camera Scanner</div>
                  <div className="text-xs text-stone-300 mt-1 max-w-xs mx-auto">
                    Point your device camera at the order ticket barcode or QR code.
                  </div>
                </div>
                {cameraError && <p className="text-xs text-red-400 font-mono">{cameraError}</p>}
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2 bg-[#FFC700] hover:bg-amber-400 text-[#4D080F] font-titan text-xs rounded-xl transition-all shadow-md active:scale-95"
                >
                  Enable Camera Viewport
                </button>
              </div>
            )}
          </div>

          {/* Physical USB/Bluetooth Hardware Scanner Notice */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="text-xs text-emerald-900 font-montserrat">
              <span className="font-titan text-emerald-800 block">Hardware Barcode Scanner Active:</span>
              <span>
                Point and shoot any USB/Bluetooth handheld barcode scanner. Keys are intercepted automatically without clicking into any field.
              </span>
            </div>
          </div>

          {/* Manual Barcode Entry Fallback & Quick Simulator */}
          <div className="space-y-2 bg-white p-4 rounded-2xl border border-[#E5DEC9]">
            <label className="text-xs font-titan uppercase tracking-wider text-[#4D080F] block">
              Manual Barcode / Quick Test Emulation
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    executeBarcodeAction(manualCode);
                  }
                }}
                placeholder="Scan or enter ticket # (e.g. CL-10492)"
                className="flex-1 bg-[#FAF7F2] border border-[#E5DEC9] text-stone-900 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:border-[#4D080F] outline-none"
              />
              <button
                type="button"
                onClick={() => executeBarcodeAction(manualCode)}
                disabled={!manualCode.trim() || isProcessing}
                className="min-h-[44px] touch-manipulation px-4 py-2.5 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] font-titan text-xs rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Submit</span>
              </button>
            </div>

            {/* Quick Demo Test Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-stone-500 font-titan">Quick Test Slips:</span>
              {['CL-10291', 'CL-54912', 'CL-88204', 'CL-33910'].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => executeBarcodeAction(code)}
                  className="min-h-[36px] touch-manipulation px-2.5 py-1.5 rounded-lg bg-[#FAF7F2] hover:bg-[#EFEAE0] border border-[#E5DEC9] text-[10px] font-mono font-bold text-[#4D080F] transition-colors"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          {/* Scan Action Result Feedback */}
          {feedback && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5 flex-1">
                <span className="font-titan text-sm block">
                  {feedback.type === 'success' ? 'Scan Verified & Executed!' : 'Scan Validation Failed'}
                </span>
                <p>{feedback.message}</p>
              </div>
            </div>
          )}

          {/* Recent Scans Session Log */}
          {recentScans.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#E5DEC9]">
              <span className="text-xs font-titan text-stone-600 uppercase tracking-wider block">
                Recent Scans This Session
              </span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {recentScans.map((s) => (
                  <div
                    key={s.id}
                    className="p-2 rounded-xl bg-white border border-[#E5DEC9] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#4D080F]">#{s.orderNumber}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-titan bg-[#FAF7F2] text-stone-700 border border-[#E5DEC9]">
                        {s.actionType}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-500 font-mono">{s.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-white border-t border-[#E5DEC9] flex items-center justify-between text-xs text-stone-500">
          <span>ChopLife Hardware Peripheral Scanner Hub</span>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="min-h-[44px] touch-manipulation px-5 py-2.5 bg-[#4D080F] hover:bg-[#3A050A] text-[#FFC700] font-titan text-xs rounded-xl transition-all"
          >
            Done [Esc]
          </button>
        </div>
      </div>
    </div>
  );
};
