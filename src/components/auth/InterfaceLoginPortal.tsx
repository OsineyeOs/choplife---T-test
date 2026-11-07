import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Store,
  ShieldCheck,
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

interface InterfaceLoginPortalProps {
  mode: 'pos' | 'admin';
  onNavigateRoute: (route: 'storefront' | 'pos' | 'admin') => void;
}

export const InterfaceLoginPortal: React.FC<InterfaceLoginPortalProps> = ({
  mode,
  onNavigateRoute,
}) => {
  const { loginStaff } = useApp();
  const [emailOrStaffId, setEmailOrStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);

  const isPos = mode === 'pos';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrStaffId.trim() || !password) {
      setErrorMsg('Please enter both your Staff ID/Email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await loginStaff(emailOrStaffId.trim(), password);
      if (!res.success) {
        if (res.lockoutSeconds) {
          setLockoutSeconds(res.lockoutSeconds);
        }
        setErrorMsg(res.error || 'Authentication failed. Please verify credentials.');
      } else {
        // Successful login: stay on the current route
        onNavigateRoute(mode);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Server error during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#241311] flex flex-col justify-between selection:bg-[#FFC700] selection:text-[#4D080F]">
      {/* Top Banner Navigation */}
      <header className="h-14 sm:h-16 border-b border-[#E5DEC9] px-3 sm:px-6 md:px-8 flex items-center justify-between bg-white/95 backdrop-blur-md shadow-xs shrink-0">
        <button
          onClick={() => onNavigateRoute('storefront')}
          className="flex items-center gap-2 sm:gap-3 hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#800D15] to-[#4D080F] border border-[#FFC700]/40 flex items-center justify-center font-black text-[#FFC700] text-base sm:text-lg shadow-sm">
            C
          </div>
          <div className="text-left">
            <span className="font-extrabold text-xs sm:text-sm tracking-wider uppercase text-[#4D080F]">
              Choplife Republic
            </span>
            <p className="text-[9px] sm:text-[10px] text-[#7A6A65] font-mono font-semibold">
              {isPos ? 'Front-Office POS Portal' : 'Back-Office Admin Portal'}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {isPos ? (
            <button
              onClick={() => onNavigateRoute('admin')}
              className="text-[11px] sm:text-xs font-bold text-[#800D15] hover:text-[#4D080F] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-[#800D15]/30 bg-[#FFF8E7] hover:bg-[#FFC700]/20 transition-all flex items-center gap-1 sm:gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#800D15]" />
              <span className="hidden xs:inline">Switch to Admin &rarr;</span>
              <span className="xs:hidden">Admin &rarr;</span>
            </button>
          ) : (
            <button
              onClick={() => onNavigateRoute('pos')}
              className="text-[11px] sm:text-xs font-bold text-[#800D15] hover:text-[#4D080F] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-[#800D15]/30 bg-[#FFF8E7] hover:bg-[#FFC700]/20 transition-all flex items-center gap-1 sm:gap-1.5"
            >
              <Store className="w-3.5 h-3.5 text-[#800D15]" />
              <span className="hidden xs:inline">Switch to POS &rarr;</span>
              <span className="xs:hidden">POS &rarr;</span>
            </button>
          )}

          <button
            onClick={() => onNavigateRoute('storefront')}
            className="text-[11px] sm:text-xs font-bold text-[#241311] hover:text-[#800D15] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[#FAF7F2] hover:bg-[#E5DEC9]/50 border border-[#E5DEC9] transition-all flex items-center gap-1 sm:gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Storefront</span>
          </button>
        </div>
      </header>

      {/* Main Login Box */}
      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 md:p-8 overflow-y-auto min-h-0">
        <div className="max-w-md w-full bg-white border border-[#E5DEC9] rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-xl relative overflow-hidden my-auto">
          {/* Subtle Warm Brand Accents */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FFC700]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#800D15]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-4 sm:mb-6 relative">
            <div className="w-11 h-11 sm:w-14 sm:h-14 mx-auto mb-2 sm:mb-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#800D15] to-[#4D080F] border border-[#FFC700]/50 flex items-center justify-center shadow-md">
              {isPos ? (
                <Store className="w-5 h-5 sm:w-7 sm:h-7 text-[#FFC700]" />
              ) : (
                <ShieldCheck className="w-5 h-5 sm:w-7 sm:h-7 text-[#FFC700]" />
              )}
            </div>

            <div className="inline-block px-2.5 py-0.5 rounded-full bg-[#FFF8E7] text-[#800D15] text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5 border border-[#FFC700]/60">
              {isPos ? 'Front-Office POS & Operations' : 'Back-Office Administration'}
            </div>

            <h1 className="text-lg sm:text-2xl font-black text-[#241311]">
              {isPos ? 'Frontline Staff Login' : 'Administrative Governance Login'}
            </h1>
            <p className="text-[11px] sm:text-xs text-[#7A6A65] mt-1 font-medium">
              {isPos
                ? 'Cashier Registers • Kitchen Display • Delivery Dispatch • Table Orders'
                : 'Executive Reports • Menu & CMS • Inventory • Staff & RBAC • Accounting'}
            </p>
          </div>

          {/* Error & Lockout Banner */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">{errorMsg}</p>
                {lockoutSeconds && lockoutSeconds > 0 && (
                  <p className="text-[11px] mt-1 text-amber-800 font-semibold">
                    Brute-force protection: try again in {lockoutSeconds} seconds.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4 relative">
            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-[#4D080F] uppercase tracking-wider mb-1">
                Staff ID or Work Email
              </label>
              <div className="relative">
                <input
                  id="portal-identifier-input"
                  type="text"
                  required
                  value={emailOrStaffId}
                  onChange={(e) => setEmailOrStaffId(e.target.value)}
                  placeholder="john.doe@example.com"
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 text-xs sm:text-sm text-[#241311] placeholder-[#7A6A65]/60 focus:outline-none focus:border-[#800D15] focus:ring-2 focus:ring-[#FFC700]/40 transition-colors"
                />
                <User className="w-4 h-4 text-[#7A6A65] absolute left-3 top-2.5 sm:top-3" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-[#4D080F] uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="portal-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 pr-9 sm:pr-10 text-xs sm:text-sm text-[#241311] placeholder-[#7A6A65]/60 focus:outline-none focus:border-[#800D15] focus:ring-2 focus:ring-[#FFC700]/40 transition-colors"
                />
                <Lock className="w-4 h-4 text-[#7A6A65] absolute left-3 top-2.5 sm:top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 sm:top-3 text-[#7A6A65] hover:text-[#241311]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || Boolean(lockoutSeconds && lockoutSeconds > 0)}
              className="w-full py-2.5 sm:py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#800D15] to-[#A3121B] hover:from-[#A3121B] hover:to-[#B91C1C] text-white font-bold text-xs sm:text-sm shadow-md border border-[#FFC700]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              {isLoading ? (
                <span>Authenticating…</span>
              ) : (
                <>
                  <span>Sign In to {isPos ? 'Front-Office POS' : 'Back-Office Admin'}</span>
                  <ArrowRight className="w-4 h-4 text-[#FFC700]" />
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-[#E5DEC9] text-center">
            <p className="text-[10px] sm:text-[11px] text-[#7A6A65] font-mono">
              Authorized Personnel Only • Session Encrypted
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-2.5 sm:py-0 sm:h-12 border-t border-[#E5DEC9] px-4 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-4 text-[11px] sm:text-xs text-[#7A6A65] bg-white shrink-0 text-center sm:text-left">
        <div>Choplife Republic &copy; 2026 • Benin City, Nigeria</div>
        <div className="flex items-center gap-3 font-semibold">
          <button
            onClick={() => onNavigateRoute('storefront')}
            className="hover:text-[#800D15] transition-colors py-0.5"
          >
            Storefront
          </button>
          <span>•</span>
          <button
            onClick={() => onNavigateRoute(isPos ? 'admin' : 'pos')}
            className="hover:text-[#800D15] transition-colors py-0.5 whitespace-nowrap"
          >
            {isPos ? 'Back-Office Admin' : 'Front-Office POS'}
          </button>
        </div>
      </footer>
    </div>
  );
};
