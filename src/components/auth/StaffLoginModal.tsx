import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { BranchId, OperationsTab } from '../../types';
import {
  X,
  Lock,
  ShieldCheck,
  User,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Building2,
  ArrowRight,
  ShieldAlert,
  RotateCw,
} from 'lucide-react';
import { PasswordInput } from '../ui/PasswordInput';

interface StaffLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalView = 'login' | 'forgot_password' | 'reset_password' | 'initial_setup';

export const StaffLoginModal: React.FC<StaffLoginModalProps> = ({ isOpen, onClose }) => {
  const {
    loginStaff,
    loginStaffWithPin,
    provisionAdmin,
    requestPasswordReset,
    completePasswordReset,
    checkSystemProvisioned,
    navigateToOperations,
    branches,
  } = useApp();

  const [view, setView] = useState<ModalView>('login');
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('password');
  const [pin, setPin] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [emailOrStaffId, setEmailOrStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);

  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Initial setup state
  const [setupName, setSetupName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPhone, setSetupPhone] = useState('');
  const [setupBranchId, setSetupBranchId] = useState<BranchId>('gra');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');

  // Check system provisioning state when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      checkSystemProvisioned().then((res) => {
        if (!res.isProvisioned && res.activeStaffCount === 0) {
          setView('initial_setup');
        } else if (view === 'initial_setup') {
          setView('login');
        }
      });
    }
  }, [isOpen]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds && lockoutSeconds > 0) {
      const timer = setInterval(() => {
        setLockoutSeconds((prev) => {
          if (!prev || prev <= 1) {
            clearInterval(timer);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutSeconds]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrStaffId.trim() || !password) {
      setErrorMsg('Please enter both your work identifier and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const res = await loginStaff(emailOrStaffId.trim(), password);
    setIsLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Authentication failed. Please check your credentials.');
      if (res.lockoutSeconds) {
        setLockoutSeconds(res.lockoutSeconds);
      }
      return;
    }

    const staff = res.staff;
    setSuccessMsg(`Authenticated successfully. Redirecting to workspace...`);

    const getInitialTabForStaff = (role?: string): OperationsTab => {
      if (role === 'kitchen_lead' || role === 'kitchen') return 'kds';
      if (role === 'rider' || role === 'internal_rider' || role === 'external_rider' || role === 'dispatch_manager') return 'dispatch';
      if (role === 'storekeeper') return 'inventory';
      if (role === 'accountant') return 'shifts';
      if (role === 'auditor') return 'audit';
      if (role === 'customer_service') return 'customercare';
      if (role === 'super_admin' || role === 'corporate_admin' || role === 'branch_manager' || role === 'store_manager') return 'reports';
      return 'pos';
    };

    setTimeout(() => {
      onClose();
      setEmailOrStaffId('');
      setPassword('');
      setSuccessMsg('');

      if (!staff) return;
      const targetTab = getInitialTabForStaff(staff.role);
      navigateToOperations(targetTab);
    }, 400);
  };

  const handlePinLogin = async (e?: React.FormEvent, customPin?: string, staffIdOverride?: string) => {
    if (e) e.preventDefault();
    const pinToSubmit = customPin || pin;
    const targetStaffId = staffIdOverride || selectedStaffId;

    if (!pinToSubmit || pinToSubmit.length < 4) {
      setErrorMsg('Please enter your 4-digit staff terminal PIN.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const res = await loginStaffWithPin(pinToSubmit, undefined, targetStaffId || undefined);
    setIsLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Invalid staff PIN.');
      return;
    }

    const staff = res.staff;
    setSuccessMsg(`PIN verified: Welcome, ${staff?.name}! Entering operations...`);

    const getInitialTabForStaff = (role?: string): OperationsTab => {
      if (role === 'kitchen_lead' || role === 'kitchen') return 'kds';
      if (role === 'rider' || role === 'internal_rider' || role === 'external_rider' || role === 'dispatch_manager') return 'dispatch';
      if (role === 'storekeeper') return 'inventory';
      if (role === 'accountant') return 'shifts';
      if (role === 'auditor') return 'audit';
      if (role === 'customer_service') return 'customercare';
      if (role === 'super_admin' || role === 'corporate_admin' || role === 'branch_manager' || role === 'store_manager') return 'reports';
      return 'pos';
    };

    setTimeout(() => {
      onClose();
      setPin('');
      setSelectedStaffId('');
      setSuccessMsg('');

      if (!staff) return;
      const targetTab = getInitialTabForStaff(staff.role);
      navigateToOperations(targetTab);
    }, 400);
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setErrorMsg('Please enter your work email.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const res = await requestPasswordReset(resetEmail.trim());
    setIsLoading(false);

    setSuccessMsg(res.message || 'If an account matches, a reset token has been generated.');
    setView('reset_password');
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken.trim()) {
      setErrorMsg('Please provide the security reset token.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    const res = await completePasswordReset(resetToken.trim(), newPassword);
    setIsLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to reset password. Token may have expired.');
      return;
    }

    setSuccessMsg('Password has been securely updated. You can now sign in.');
    setTimeout(() => {
      setView('login');
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setResetToken('');
    }, 1500);
  };

  const handleInitialSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupName.trim() || !setupEmail.trim() || !setupPassword) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    if (setupPassword.length < 8) {
      setErrorMsg('Admin password must be at least 8 characters long.');
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    const res = await provisionAdmin({
      fullName: setupName.trim(),
      workEmail: setupEmail.trim(),
      phone: setupPhone.trim() || undefined,
      branchId: setupBranchId,
      password: setupPassword,
    });

    setIsLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'System setup failed.');
      return;
    }

    setSuccessMsg('Administrator account provisioned! Entering Operations Dashboard...');
    setTimeout(() => {
      onClose();
      navigateToOperations('reports');
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      id="staff-login-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[min(90dvh,720px)] shadow-2xl border border-[#E5DEC9] overflow-hidden flex flex-col" id="staff-login-modal-card">
        {/* Modal Top Header */}
        <div className="bg-[#241311] text-white p-5 sm:p-6 flex items-center justify-between border-b border-[#4D080F]/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFC700] text-[#241311] flex items-center justify-center font-titan text-xl shadow-inner">
              <Lock className="w-5 h-5 text-[#241311]" />
            </div>
            <div>
              <span className="text-[10px] font-titan uppercase tracking-widest text-[#FFC700] block">
                RESTAURANT OPERATIONS
              </span>
              <h2 className="font-titan text-lg sm:text-xl text-white">
                {view === 'initial_setup'
                  ? 'SYSTEM PROVISIONING'
                  : view === 'forgot_password'
                  ? 'PASSWORD RECOVERY'
                  : view === 'reset_password'
                  ? 'SET NEW PASSWORD'
                  : 'STAFF AUTHENTICATION'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            id="close-staff-login-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto overscroll-contain">
          {/* Rate limit lockout warning */}
          {lockoutSeconds !== null && lockoutSeconds > 0 && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3.5 rounded-2xl text-xs font-montserrat flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Too many invalid attempts</strong>
                <span>Please wait {lockoutSeconds} seconds before trying again to protect restaurant systems.</span>
              </div>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-2xl text-xs font-montserrat flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-2xl text-xs font-montserrat flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* VIEW: 1. AUTHENTICATION (PASSWORD ONLY) */}
          {view === 'login' && (
            <div className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4" id="staff-auth-form">
                <div>
                  <label className="block text-xs font-titan text-[#4D080F] uppercase tracking-wider mb-1.5">
                    WORK EMAIL OR STAFF ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="john.doe@example.com"
                      value={emailOrStaffId}
                      onChange={(e) => {
                        setEmailOrStaffId(e.target.value);
                        setErrorMsg('');
                      }}
                      disabled={lockoutSeconds !== null && lockoutSeconds > 0}
                      className="w-full pl-10 pr-3 py-2.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs sm:text-sm font-montserrat text-[#241311] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                      id="staff-email-or-id-input"
                      autoFocus
                    />
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-titan text-[#4D080F] uppercase tracking-wider">
                      PASSWORD
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setView('forgot_password');
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-[11px] text-[#C92200] hover:underline font-montserrat font-medium"
                      id="staff-forgot-password-link"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <PasswordInput
                    id="staff-password-input"
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg('');
                    }}
                    disabled={lockoutSeconds !== null && lockoutSeconds > 0}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || (lockoutSeconds !== null && lockoutSeconds > 0)}
                  className="w-full bg-[#E62E00] hover:bg-[#C92200] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-titan text-xs sm:text-sm py-3.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 mt-2"
                  id="staff-login-submit-btn"
                >
                  {isLoading ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin text-white" />
                      VERIFYING CREDENTIALS...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-[#FFC700]" />
                      SIGN IN TO OPERATIONS
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* VIEW: 2. FORGOT PASSWORD REQUEST */}
          {view === 'forgot_password' && (
            <form onSubmit={handleRequestReset} className="space-y-4" id="staff-forgot-form">
              <p className="text-xs text-[#7A6A65] font-montserrat">
                Enter your registered work email. A cryptographic recovery token will be dispatched for your account.
              </p>
              <div>
                <label className="block text-xs font-titan text-[#4D080F] uppercase tracking-wider mb-1.5">
                  REGISTERED WORK EMAIL
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="john.doe@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs sm:text-sm font-montserrat text-[#241311] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                    id="reset-email-input"
                    autoFocus
                  />
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setView('login');
                    setErrorMsg('');
                  }}
                  className="w-1/3 border border-[#E5DEC9] text-[#7A6A65] hover:bg-gray-50 font-titan text-xs py-3 rounded-xl transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-2/3 bg-[#4D080F] hover:bg-[#241311] text-white font-titan text-xs py-3 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
                  id="request-reset-token-btn"
                >
                  {isLoading ? 'GENERATING...' : 'REQUEST RESET TOKEN'}
                </button>
              </div>
            </form>
          )}

          {/* VIEW: 3. COMPLETE PASSWORD RESET */}
          {view === 'reset_password' && (
            <form onSubmit={handleCompleteReset} className="space-y-3.5" id="staff-reset-form">
              <div>
                <label className="block text-[11px] font-titan text-[#4D080F] uppercase tracking-wider mb-1">
                  SECURITY RESET TOKEN
                </label>
                <input
                  type="text"
                  required
                  placeholder="Paste token here"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs font-mono text-[#241311] focus:ring-2 focus:ring-[#FFC700] outline-none"
                />
              </div>

              <PasswordInput
                label="NEW PASSWORD (MIN 8 CHARACTERS)"
                id="staff-reset-new-password"
                required
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
              />

              <PasswordInput
                label="CONFIRM NEW PASSWORD"
                id="staff-reset-confirm-password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setView('login');
                    setErrorMsg('');
                  }}
                  className="w-1/3 border border-[#E5DEC9] text-[#7A6A65] font-titan text-xs py-2.5 rounded-xl"
                >
                  BACK
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-2/3 bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs py-2.5 rounded-xl shadow-md transition-colors"
                >
                  {isLoading ? 'UPDATING...' : 'SET NEW PASSWORD'}
                </button>
              </div>
            </form>
          )}

          {/* VIEW: 4. INITIAL ROOT ADMIN PROVISIONING */}
          {view === 'initial_setup' && (
            <form onSubmit={handleInitialSetup} className="space-y-3" id="initial-setup-form">
              <div className="bg-[#FFF8E7] border border-[#FFC700] p-3 rounded-xl text-xs font-montserrat text-[#4D080F]">
                <strong className="block font-bold">First-Time Setup Required</strong>
                <span>Initialize the restaurant root administrator account to unlock POS, Kitchen, and Operations portals.</span>
              </div>

              <div>
                <label className="block text-[11px] font-titan text-[#4D080F] uppercase tracking-wider mb-1">
                  FULL NAME
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lead Administrator"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs font-montserrat text-[#241311] focus:ring-2 focus:ring-[#FFC700] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-titan text-[#4D080F] uppercase tracking-wider mb-1">
                    WORK EMAIL
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@choplife.ng"
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs font-montserrat text-[#241311] focus:ring-2 focus:ring-[#FFC700] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-titan text-[#4D080F] uppercase tracking-wider mb-1">
                    PRIMARY BRANCH
                  </label>
                  <select
                    value={setupBranchId}
                    onChange={(e) => setSetupBranchId(e.target.value as BranchId)}
                    className="w-full px-2.5 py-2 bg-[#FAF7F2] border border-[#E5DEC9] rounded-xl text-xs font-montserrat text-[#241311] focus:ring-2 focus:ring-[#FFC700] outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <PasswordInput
                label="SECURE PASSWORD (MIN 8 CHARS)"
                id="initial-setup-password"
                required
                placeholder="••••••••"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
              />

              <PasswordInput
                label="CONFIRM PASSWORD"
                id="initial-setup-confirm-password"
                required
                placeholder="••••••••"
                value={setupConfirmPassword}
                onChange={(e) => setSetupConfirmPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
              />

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#E62E00] hover:bg-[#C92200] text-white font-titan text-xs sm:text-sm py-3 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 mt-2"
                id="initial-setup-submit-btn"
              >
                <ShieldCheck className="w-4 h-4 text-[#FFC700]" />
                {isLoading ? 'CREATING ROOT ACCOUNT...' : 'PROVISION ROOT ADMIN'}
              </button>
            </form>
          )}
        </div>

        {/* Security Footer Notice */}
        <div className="bg-[#FAF7F2] px-6 py-3.5 border-t border-[#E5DEC9] flex items-center justify-between text-[11px] text-[#7A6A65] font-montserrat">
          <span>Protected by session cryptography & rate limiting</span>
          <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-[#E5DEC9]">TLS SECURE</span>
        </div>
      </div>
    </div>
  );
};
