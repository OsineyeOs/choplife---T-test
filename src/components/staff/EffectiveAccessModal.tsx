import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  ShieldCheck,
  Check,
  MapPin,
  FileText,
  Columns,
  RotateCcw,
} from 'lucide-react';
import { EffectiveAccessSummary } from '../../types/rbac';

interface EffectiveAccessModalProps {
  staffId: string | null;
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export const EffectiveAccessModal: React.FC<EffectiveAccessModalProps> = ({
  staffId,
  isOpen,
  onClose,
  showToast,
}) => {
  const [accessData, setAccessData] = useState<EffectiveAccessSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'privileges' | 'reports' | 'columns'>('privileges');

  useEffect(() => {
    if (!isOpen || !staffId) {
      setAccessData(null);
      return;
    }

    const fetchEffectiveAccess = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('choplife_staff_token') || '';
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`/api/rbac/staff/${staffId}/effective-access`, { headers });
        if (res.ok) {
          const data = await res.json();
          setAccessData(data);
        } else {
          showToast('Failed to load effective access permissions.');
        }
      } catch {
        showToast('Error communicating with operations server.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEffectiveAccess();
  }, [isOpen, staffId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#E5DEC9] rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 overflow-hidden">
        <div className="p-5 bg-[#FAF7F2] border-b border-[#E5DEC9] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FFF8E7] border border-[#FFC700] flex items-center justify-center text-[#800D15]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-[#241311]">
                  {accessData ? accessData.name : 'Staff Access Profile'}
                </h3>
                {accessData && (
                  <span className="font-mono text-xs font-bold text-[#800D15] bg-[#FFF8E7] px-2 py-0.5 rounded-md border border-[#FFC700]">
                    {accessData.staffId}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#7A6A65]">
                Resolved runtime privileges, assigned branch restrictions, and forensic security status
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white hover:bg-[#E5DEC9] text-[#7A6A65] hover:text-[#241311] border border-[#E5DEC9] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-[#7A6A65] space-y-2">
            <RotateCcw className="w-6 h-6 animate-spin mx-auto text-[#800D15]" />
            <p>Resolving RBAC privilege tree...</p>
          </div>
        ) : accessData ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-white border-b border-[#E5DEC9] grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 text-xs">
              <div>
                <span className="text-[10px] text-[#7A6A65] uppercase font-bold block">Assigned Role</span>
                <span className="font-bold text-[#800D15] uppercase">{accessData.roleName}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#7A6A65] uppercase font-bold block">Branch Scope</span>
                <span className="font-bold text-[#241311] uppercase flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[#E62E00]" />
                  {accessData.branchScope === 'all' ? 'Enterprise (All)' : accessData.branchScope}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#7A6A65] uppercase font-bold block">Auth &amp; Lockout</span>
                <span
                  className={`font-bold inline-block px-1.5 py-0.5 rounded text-[10px] mt-0.5 ${
                    accessData.failedLoginAttempts > 0
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {accessData.lockoutUntil
                    ? 'Account Locked'
                    : accessData.failedLoginAttempts > 0
                    ? `${accessData.failedLoginAttempts}/5 Failed Attempts`
                    : 'Bcrypt Secured (OK)'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#7A6A65] uppercase font-bold block">Last Login</span>
                <span className="font-mono text-[11px] text-[#241311] block mt-0.5">
                  {accessData.lastLoginAt
                    ? new Date(accessData.lastLoginAt).toLocaleDateString('en-GB', {
                        timeZone: 'Africa/Lagos',
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }) + ' WAT'
                    : 'No sessions recorded'}
                </span>
              </div>
            </div>

            <div className="px-4 pt-3 bg-[#FAF7F2] border-b border-[#E5DEC9] flex gap-2 shrink-0">
              <button
                onClick={() => setActiveTab('privileges')}
                className={`pb-2.5 px-3 font-bold text-xs flex items-center gap-1.5 border-b-2 transition-all ${
                  activeTab === 'privileges'
                    ? 'border-[#800D15] text-[#800D15]'
                    : 'border-transparent text-[#7A6A65] hover:text-[#241311]'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Granted Privileges</span>
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`pb-2.5 px-3 font-bold text-xs flex items-center gap-1.5 border-b-2 transition-all ${
                  activeTab === 'reports'
                    ? 'border-[#800D15] text-[#800D15]'
                    : 'border-transparent text-[#7A6A65] hover:text-[#241311]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Authorized Reports ({accessData.permittedReports.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('columns')}
                className={`pb-2.5 px-3 font-bold text-xs flex items-center gap-1.5 border-b-2 transition-all ${
                  activeTab === 'columns'
                    ? 'border-[#800D15] text-[#800D15]'
                    : 'border-transparent text-[#7A6A65] hover:text-[#241311]'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Permitted Order Columns ({accessData.permittedColumns.length})</span>
              </button>
            </div>

            {activeTab === 'privileges' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF7F2]">
                {accessData.categories.map((cat) => (
                  <div
                    key={cat.categoryKey}
                    className="bg-white border border-[#E5DEC9] rounded-2xl p-3.5 space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-[#241311]">{cat.categoryLabel}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FAF7F2] text-[#7A6A65] border border-[#E5DEC9]">
                          {cat.grantedCount} / {cat.totalAvailable} Granted
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {cat.privileges.map((p) => (
                        <div
                          key={p.code}
                          className={`p-2 rounded-xl flex items-center justify-between text-xs border ${
                            p.granted
                              ? 'bg-emerald-50/70 border-emerald-200 text-[#241311]'
                              : 'bg-[#FAF7F2] border-transparent text-[#7A6A65]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                                p.granted ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-500'
                              }`}
                            >
                              {p.granted ? <Check className="w-3 h-3 stroke-[3]" /> : <span>-</span>}
                            </div>
                            <span className={`truncate text-xs ${p.granted ? 'font-bold' : 'opacity-60'}`}>
                              {p.name}
                            </span>
                          </div>
                          <span className="font-mono text-[9px] opacity-60 shrink-0">{p.code}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#FAF7F2]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {accessData.permittedReports.map((repCode) => (
                    <div
                      key={repCode}
                      className="p-3 bg-white border border-[#E5DEC9] rounded-xl flex items-center gap-2.5 text-xs text-[#241311]"
                    >
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="font-mono font-bold capitalize">
                        {repCode.replace(/_/g, ' ')} Report
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'columns' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#FAF7F2]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {accessData.permittedColumns.map((colCode) => (
                    <div
                      key={colCode}
                      className="p-3 bg-white border border-[#E5DEC9] rounded-xl flex items-center gap-2.5 text-xs text-[#241311]"
                    >
                      <Check className="w-4 h-4 text-[#800D15]" />
                      <span className="font-mono font-bold uppercase">{colCode.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="p-4 bg-[#FAF7F2] border-t border-[#E5DEC9] flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#800D15] hover:bg-[#4D080F] text-white rounded-xl text-xs font-black uppercase shadow-md transition-all active:scale-95"
          >
            Close Access Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
