import React from 'react';
import { Lock } from 'lucide-react';

interface WorkspaceAuditTabProps {
  canAccessBackend: boolean;
  setActiveTab: (tab: any) => void;
  auditLogsList: any[];
}

export const WorkspaceAuditTab: React.FC<WorkspaceAuditTabProps> = ({
  canAccessBackend,
  setActiveTab,
  auditLogsList,
}) => {
  if (!canAccessBackend) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4 bg-[#FAF7F2]">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900">Access Restricted — Interface C Required</h2>
        <p className="text-sm text-stone-500 max-w-md">
          Immutable forensic audit logs are reserved for system auditors and corporate administration.
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Immutable Security Audit Log</h2>
          <p className="text-xs text-stone-500">
            Forensic operational logs for financial events, auth, inventory, and voids
          </p>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 uppercase font-semibold">
            <tr>
              <th className="p-3">Timestamp</th>
              <th className="p-3">Staff / Role</th>
              <th className="p-3">Action Type</th>
              <th className="p-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {auditLogsList.map((log) => (
              <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                <td className="p-3 font-mono tabular-nums text-stone-600 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })}
                </td>
                <td className="p-3">
                  <p className="font-bold text-stone-900">{log.staffName}</p>
                  <span className="text-[10px] text-stone-500 uppercase">{log.staffRole}</span>
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-50 text-amber-800 border border-amber-200">
                    {log.actionType}
                  </span>
                </td>
                <td className="p-3 text-stone-700">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
