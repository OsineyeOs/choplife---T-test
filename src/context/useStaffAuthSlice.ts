import { useState, useEffect } from 'react';
import { BranchId, StaffRole, StaffUser } from '../types';
import { LOCAL_STORAGE_KEY_STAFF } from './appContextTypes';

export interface StaffAuthSliceCallbacks {
  onLogoutCleanup: () => void;
  onOpenStaffLoginModal: (updater: (prev: boolean) => boolean) => void;
}

export function useStaffAuthSlice({ onLogoutCleanup, onOpenStaffLoginModal }: StaffAuthSliceCallbacks) {
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [currentStaff, setCurrentStaff] = useState<StaffUser | null>(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const token =
        window.localStorage.getItem('choplife_staff_token') ||
        window.localStorage.getItem('choplife_staff_session_token');
      if (!token) return null;
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY_STAFF);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.id && parsed.role) {
        return parsed as StaffUser;
      }
    } catch {}
    return null;
  });

  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>(() => {
    if (typeof window === 'undefined' || !window.localStorage) return 'unauthenticated';
    return (window.localStorage.getItem('choplife_staff_token') || window.localStorage.getItem('choplife_staff_session_token'))
      ? 'loading'
      : 'unauthenticated';
  });

  const [isStorefrontPreviewActive, setIsStorefrontPreviewActive] = useState<boolean>(false);

  // Rehydrate staff session from backend on mount
  useEffect(() => {
    let token: string | null = null;
    try {
      token =
        localStorage.getItem('choplife_staff_token') ||
        localStorage.getItem('choplife_staff_session_token');
    } catch {}

    if (!token) {
      setCurrentStaff(null);
      setAuthStatus('unauthenticated');
      return;
    }

    fetch('/api/auth/staff/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then((staffData) => {
        setCurrentStaff(staffData);
        setAuthStatus('authenticated');
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY_STAFF, JSON.stringify(staffData));
        } catch {}
      })
      .catch(() => {
        setCurrentStaff(null);
        setAuthStatus('unauthenticated');
        try {
          localStorage.removeItem(LOCAL_STORAGE_KEY_STAFF);
          localStorage.removeItem('choplife_staff_token');
          localStorage.removeItem('choplife_staff_session_token');
        } catch {}
      });
  }, []);

  // Check URL parameters and keyboard shortcuts for staff access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('portal') === 'staff' ||
        params.get('staff') === 'true' ||
        params.get('login') === 'staff' ||
        params.get('admin') === 'true'
      ) {
        onOpenStaffLoginModal(() => true);
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') || (e.altKey && e.key.toLowerCase() === 's')) {
          e.preventDefault();
          onOpenStaffLoginModal((prev) => !prev);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, []);

  const fetchStaffAccounts = async (overrideToken?: string) => {
    try {
      const token =
        overrideToken ||
        (typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('choplife_staff_token') ||
            window.localStorage.getItem('choplife_auth_token')
          : null);
      const res = await fetch('/api/staff/accounts', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setStaffUsers(data);
        }
      }
    } catch {}
  };

  useEffect(() => {
    if (currentStaff) {
      fetchStaffAccounts();
    }
  }, [currentStaff?.id]);

  const loginStaff = async (
    emailOrStaffId: string,
    password: string
  ): Promise<{ success: boolean; error?: string; lockoutSeconds?: number; staff?: StaffUser }> => {
    try {
      const res = await fetch('/api/auth/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrStaffId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Authentication failed. Please check your credentials.',
          lockoutSeconds: data.lockoutSeconds,
        };
      }
      setCurrentStaff(data.staff);
      setAuthStatus('authenticated');
      localStorage.setItem(LOCAL_STORAGE_KEY_STAFF, JSON.stringify(data.staff));
      if (data.token) {
        localStorage.setItem('choplife_staff_token', data.token);
        localStorage.setItem('choplife_staff_session_token', data.token);
        fetchStaffAccounts(data.token);
      }
      return { success: true, staff: data.staff };
    } catch {
      return { success: false, error: 'Operations server unavailable. Please try again.' };
    }
  };

  const loginStaffWithPin = async (
    pin: string,
    branchId?: string,
    staffId?: string
  ): Promise<{ success: boolean; error?: string; staff?: StaffUser }> => {
    try {
      const res = await fetch('/api/auth/staff/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, branchId, staffId }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Invalid staff PIN.' };
      }
      setCurrentStaff(data.staff);
      setAuthStatus('authenticated');
      localStorage.setItem(LOCAL_STORAGE_KEY_STAFF, JSON.stringify(data.staff));
      if (data.token) {
        localStorage.setItem('choplife_staff_token', data.token);
        localStorage.setItem('choplife_staff_session_token', data.token);
      }
      return { success: true, staff: data.staff };
    } catch {
      return { success: false, error: 'Operations server unreachable.' };
    }
  };

  const validateManagerOverride = async (
    pin: string,
    action: string,
    reason?: string,
    checkId?: string
  ): Promise<{ authorized: boolean; error?: string; supervisor?: { id: string; name: string; role: string } }> => {
    try {
      const res = await fetch('/api/pos/manager-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, action, reason, checkId }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { authorized: false, error: data.error || 'Manager override rejected.' };
      }
      return { authorized: true, supervisor: data.supervisor };
    } catch {
      return { authorized: false, error: 'Authorization service unavailable.' };
    }
  };

  const logoutStaff = async () => {
    try {
      await fetch('/api/auth/staff/logout', { method: 'POST' });
    } catch {}
    setCurrentStaff(null);
    setAuthStatus('unauthenticated');
    setIsStorefrontPreviewActive(false);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY_STAFF);
      localStorage.removeItem('choplife_staff_token');
      localStorage.removeItem('choplife_staff_session_token');
    } catch {}
    onLogoutCleanup();
  };

  const provisionAdmin = async (adminData: {
    fullName: string;
    workEmail: string;
    phone?: string;
    password: string;
    branchId?: BranchId;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/staff/setup-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminData),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Setup failed' };
      }
      setCurrentStaff(data.staff);
      setAuthStatus('authenticated');
      localStorage.setItem(LOCAL_STORAGE_KEY_STAFF, JSON.stringify(data.staff));
      if (data.token) {
        localStorage.setItem('choplife_staff_token', data.token);
        localStorage.setItem('choplife_staff_session_token', data.token);
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network error while provisioning admin.' };
    }
  };

  const requestPasswordReset = async (email: string) => {
    try {
      const res = await fetch('/api/auth/staff/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return await res.json();
    } catch {
      return { success: false, message: 'Request failed.' };
    }
  };

  const completePasswordReset = async (token: string, newPassword: string) => {
    try {
      const res = await fetch('/api/auth/staff/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Reset failed' };
      return { success: true };
    } catch {
      return { success: false, error: 'Network error.' };
    }
  };

  const createStaffAccount = async (data: {
    staffId: string;
    name: string;
    workEmail: string;
    phone?: string;
    role: StaffRole;
    branchId: BranchId;
    initialPassword: string;
  }) => {
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) return { success: false, error: resData.error || 'Failed to create staff' };
      await fetchStaffAccounts();
      return { success: true };
    } catch {
      return { success: false, error: 'Operations server unavailable.' };
    }
  };

  const updateStaffAccount = async (id: string, data: Partial<StaffUser>) => {
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) return { success: false, error: resData.error || 'Update failed' };
      await fetchStaffAccounts();
      return { success: true };
    } catch {
      return { success: false, error: 'Operations server unavailable.' };
    }
  };

  const resetStaffPassword = async (id: string, temporaryPassword: string) => {
    try {
      const res = await fetch(`/api/staff/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temporaryPassword }),
      });
      const resData = await res.json();
      if (!res.ok) return { success: false, error: resData.error || 'Password reset failed' };
      return { success: true };
    } catch {
      return { success: false, error: 'Operations server unavailable.' };
    }
  };

  const revokeStaffSessions = async (id: string) => {
    try {
      const res = await fetch(`/api/staff/${id}/revoke-sessions`, {
        method: 'POST',
      });
      const resData = await res.json();
      if (!res.ok) return { success: false, error: resData.error || 'Revocation failed' };
      return { success: true };
    } catch {
      return { success: false, error: 'Operations server unavailable.' };
    }
  };

  const checkSystemProvisioned = async () => {
    try {
      const res = await fetch('/api/auth/staff/status');
      if (res.ok) return await res.json();
    } catch {}
    return { isProvisioned: false, activeStaffCount: 0 };
  };

  return {
    staffUsers,
    currentStaff,
    setCurrentStaff,
    authStatus,
    isStorefrontPreviewActive,
    setIsStorefrontPreviewActive,
    fetchStaffAccounts,
    loginStaff,
    loginStaffWithPin,
    validateManagerOverride,
    logoutStaff,
    provisionAdmin,
    requestPasswordReset,
    completePasswordReset,
    createStaffAccount,
    updateStaffAccount,
    resetStaffPassword,
    revokeStaffSessions,
    checkSystemProvisioned,
  };
}
