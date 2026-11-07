import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  moduleName?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Safe technical logging in console without leaking secrets
    console.error(`[ChopLife ErrorBoundary${this.props.moduleName ? ` - ${this.props.moduleName}` : ''}] caught error:`, error, errorInfo);
  }

  private handleResetAppState = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Discard local client cache while preserving nothing that breaks the session
        const keysToClear = [
          'choplife_cart_v1',
          'choplife_menu_cms_v1',
          'choplife_customer_profile_v1',
          'choplife_orders_v1',
          'choplife_staff_active_v1',
          'choplife_staff_token',
          'choplife_inventory_v1',
          'choplife_riders_v1',
          'choplife_held_tickets_v1',
          'choplife_audit_logs_v1',
          'choplife_reconciliation_v1',
          'choplife_offline_pos_queue',
        ];
        keysToClear.forEach((k) => window.localStorage.removeItem(k));
      }
      if (typeof window !== 'undefined' && 'caches' in window) {
        window.caches.keys().then((keys) => {
          keys.forEach((k) => window.caches.delete(k));
        });
      }
    } catch (e) {
      console.warn('[ErrorBoundary] Error clearing storage:', e);
    }

    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleReload = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isSubmodule = Boolean(this.props.moduleName);

      return (
        <div className={`flex flex-col items-center justify-center p-6 text-center ${
          isSubmodule ? 'bg-amber-50/80 rounded-2xl border border-amber-200 my-4 min-h-[320px]' : 'min-h-screen bg-[#FAF7F2] text-[#241311]'
        }`}>
          <div className="max-w-xl w-full bg-white rounded-3xl p-8 shadow-xl border border-[#4D080F]/10 flex flex-col items-center">
            {/* Header Icon */}
            <div className="w-16 h-16 rounded-2xl bg-[#800D15]/10 text-[#800D15] flex items-center justify-center mb-5 ring-8 ring-[#800D15]/5">
              <AlertTriangle className="w-8 h-8" />
            </div>

            {/* Title */}
            <span className="text-xs uppercase tracking-widest font-black text-[#800D15] mb-2">
              Choplife Republic System Safeguard
            </span>
            <h1 className="text-2xl font-black text-[#241311] tracking-tight mb-3">
              {isSubmodule ? `${this.props.moduleName} Paused` : 'Application Recovery Mode'}
            </h1>
            <p className="text-sm text-[#5C4540] mb-6 leading-relaxed">
              {isSubmodule
                ? `An isolated operational exception occurred inside the ${this.props.moduleName}. The rest of the platform remains active.`
                : 'A runtime state inconsistency was safely intercepted by the platform boundary before impacting data integrity.'}
            </p>

            {/* Development Diagnostics (Sanitized) */}
            {this.state.error && (
              <div className="w-full text-left bg-[#1C1210] text-[#FAF7F2] p-4 rounded-xl text-xs font-mono mb-6 overflow-x-auto max-h-48 border border-[#FFC700]/20">
                <div className="text-[#FFC700] font-bold mb-1 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Technical Diagnostics:</span>
                </div>
                <div className="text-rose-300 font-semibold mb-2">
                  {this.state.error.name}: {this.state.error.message}
                </div>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-neutral-400 text-[10px] leading-tight overflow-x-auto whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.trim().slice(0, 500)}
                  </pre>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 w-full">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 min-w-[140px] px-5 py-3 rounded-xl bg-[#800D15] hover:bg-[#680A11] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload View</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetAppState}
                className="flex-1 min-w-[140px] px-5 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-[#4D080F] text-xs font-bold transition-all border border-neutral-300 flex items-center justify-center gap-2 active:scale-95"
                title="Clears corrupted client localStorage and re-establishes clean canonical state"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Reset Local State</span>
              </button>
            </div>

            <div className="mt-6 text-[11px] text-neutral-400">
              Choplife Republic Operations Core &bull; 100% Maximum Enjoyment Protected
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
