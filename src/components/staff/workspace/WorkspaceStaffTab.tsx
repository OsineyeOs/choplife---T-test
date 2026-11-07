import React from 'react';
import { Plus, Lock } from 'lucide-react';
import { RolePermissionManager } from '../RolePermissionManager';

interface WorkspaceStaffTabProps {
  canAccessBackend: boolean;
  setActiveTab: (tab: any) => void;
  staffSubTab: 'directory' | 'roles';
  setStaffSubTab: (v: 'directory' | 'roles') => void;
  handleOpenNewStaffModal: () => void;
  upcomingBirthdays: any[];
  staffAccountsList: any[];
  setEffectiveAccessStaffId: (id: string) => void;
  setIsEffectiveAccessOpen: (v: boolean) => void;
  handleEditStaffModal: (s: any) => void;
  handleResetStaffPassword: (id: string, name: string) => void;
  currentStaffRole?: string;
  showToast: (msg: string, type?: string) => void;
}

export const WorkspaceStaffTab: React.FC<WorkspaceStaffTabProps> = ({
  canAccessBackend,
  setActiveTab,
  staffSubTab,
  setStaffSubTab,
  handleOpenNewStaffModal,
  upcomingBirthdays,
  staffAccountsList,
  setEffectiveAccessStaffId,
  setIsEffectiveAccessOpen,
  handleEditStaffModal,
  handleResetStaffPassword,
  currentStaffRole,
  showToast,
}) => {
  if (!canAccessBackend) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4 bg-[#FAF7F2]">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900">Access Restricted — Interface C Required</h2>
        <p className="text-sm text-stone-500 max-w-md">
          Staff account administration and RBAC governance are restricted to authorized administrators and branch managers.
        </p>
        <button
          onClick={() => setActiveTab('pos')}
          className="px-5 py-2.5 bg-[#800D15] text-white font-bold text-xs uppercase tracking-wide rounded-xl hover:bg-[#660A11] transition-colors shadow-2xs"
        >
          Return to POS Register
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#FAF7F2]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Staff Directory & RBAC Governance</h2>
          <p className="text-xs text-stone-500">
            Configurable role matrices, granular privileges, reports, and staff credentials
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200">
            <button
              onClick={() => setStaffSubTab('directory')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                staffSubTab === 'directory'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Staff Directory
            </button>
            <button
              onClick={() => setStaffSubTab('roles')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                staffSubTab === 'roles'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Roles & Permissions (Master)
            </button>
          </div>

          {staffSubTab === 'directory' && (
            <button
              onClick={handleOpenNewStaffModal}
              className="px-4 py-2 bg-[#800D15] hover:bg-[#660A11] text-white rounded-xl text-xs font-bold uppercase flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 text-[#FFC700]" /> Add Staff Account
            </button>
          )}
        </div>
      </div>

      {upcomingBirthdays.length > 0 && staffSubTab === 'directory' && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg shrink-0">
              🎂
            </div>
            <div>
              <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                Upcoming Staff Birthdays (Next 30 Days)
                <span className="px-2 py-0.5 rounded-full bg-[#800D15] text-white text-[10px] font-bold">
                  {upcomingBirthdays.length}
                </span>
              </h4>
              <p className="text-xs text-stone-600">
                Recognize and celebrate our restaurant team members across all branches!
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {upcomingBirthdays.slice(0, 5).map((b: any) => (
              <div
                key={b.staffId}
                className={`border px-3 py-1.5 rounded-xl text-xs flex flex-col gap-1 shadow-2xs ${
                  b.daysUntil === 0
                    ? 'bg-amber-100 border-amber-400 font-bold text-amber-950'
                    : 'bg-white border-amber-200 text-stone-900'
                }`}
                title={b.daysUntil === 0 ? b.colleagueNotification : b.personalGreeting}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">{b.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    b.daysUntil === 0 ? 'bg-[#800D15] text-white' : 'bg-amber-100 text-amber-900'
                  }`}>
                    {b.daysUntil === 0 ? '🎉 Today!' : `${b.birthdayThisYear} (${b.daysUntil}d)`}
                  </span>
                  <span className="text-[10px] opacity-75">Turns {b.turningAge}</span>
                </div>
                {b.daysUntil === 0 && (
                  <p className="text-[11px] text-amber-900 font-medium italic leading-tight">
                    "{b.colleagueNotification}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {staffSubTab === 'directory' ? (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 uppercase font-semibold">
                <tr>
                  <th className="p-3 whitespace-nowrap">Staff ID</th>
                  <th className="p-3 whitespace-nowrap">Full Name</th>
                  <th className="p-3 whitespace-nowrap">Work Email</th>
                  <th className="p-3 whitespace-nowrap">Role</th>
                  <th className="p-3 whitespace-nowrap">Branch</th>
                  <th className="p-3 whitespace-nowrap">DOB</th>
                  <th className="p-3 whitespace-nowrap">Guarantor</th>
                  <th className="p-3 whitespace-nowrap">Status</th>
                  <th className="p-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {staffAccountsList.map((s) => (
                  <tr key={s.id} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-[#800D15] whitespace-nowrap">{s.staffId}</td>
                    <td className="p-3 font-bold text-stone-900 whitespace-nowrap">{s.name}</td>
                    <td className="p-3 text-stone-600 whitespace-nowrap">{s.workEmail}</td>
                    <td className="p-3 uppercase font-medium text-stone-700 whitespace-nowrap">
                      <span className="bg-stone-100 px-2 py-0.5 rounded border border-stone-200 font-mono text-[11px]">
                        {s.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 uppercase font-medium text-stone-700 whitespace-nowrap">{s.branchId}</td>
                    <td className="p-3 text-stone-700 font-mono text-[11px] whitespace-nowrap">
                      {s.dateOfBirth || <span className="text-stone-400 italic font-sans">Not set</span>}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {s.guarantorName ? (
                        <div className="text-[11px] leading-tight">
                          <p className="font-semibold text-emerald-700 truncate max-w-[140px]">
                            {s.guarantorName}
                          </p>
                          <p className="text-stone-500 text-[10px] truncate max-w-[140px]">
                            {s.guarantorRelationship || s.guarantorPhone}
                          </p>
                        </div>
                      ) : (
                        <span className="text-amber-800 text-[10px] font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          s.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setEffectiveAccessStaffId(s.staffId);
                          setIsEffectiveAccessOpen(true);
                        }}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-medium transition-colors"
                        title="Inspect resolved runtime permissions and reports"
                      >
                        View Access
                      </button>
                      <button
                        onClick={() => handleEditStaffModal(s)}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-lg text-[11px] font-medium transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleResetStaffPassword(s.id, s.name)}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-medium transition-colors"
                      >
                        Reset Password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <RolePermissionManager
          currentStaffRole={currentStaffRole}
          showToast={(msg) => showToast(msg, 'success')}
        />
      )}
    </div>
  );
};
