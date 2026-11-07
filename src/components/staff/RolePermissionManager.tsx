import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  FileText,
  Columns,
  Check,
  Search,
  Save,
  RotateCcw,
  Users,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  PrivilegeCategory,
  ReportItem,
  OrderSummaryColumn,
  RoleDefinition,
} from '../../types/rbac';
import {
  CANONICAL_PRIVILEGE_CATEGORIES,
  CANONICAL_REPORTS,
  CANONICAL_ORDER_SUMMARY_COLUMNS,
  DEFAULT_STANDARD_ROLES,
} from '../../data/rbacCatalogue';

interface RolePermissionManagerProps {
  currentStaffRole?: string;
  showToast: (msg: string) => void;
}

export const RolePermissionManager: React.FC<RolePermissionManagerProps> = ({
  showToast,
}) => {
  const [roles, setRoles] = useState<RoleDefinition[]>(DEFAULT_STANDARD_ROLES);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('role-admin');
  const [activeTab, setActiveTab] = useState<'privileges' | 'reports' | 'columns'>('privileges');
  const [categories, setCategories] = useState<PrivilegeCategory[]>(CANONICAL_PRIVILEGE_CATEGORIES);
  const [reportsList, setReportsList] = useState<ReportItem[]>(CANONICAL_REPORTS);
  const [columnsList, setColumnsList] = useState<OrderSummaryColumn[]>(CANONICAL_ORDER_SUMMARY_COLUMNS);
  const [, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    back_office: true,
    pos_front_office: true,
    menu_items: true,
    inventory_procurement: true,
    accounting_finance: true,
    customer_loyalty: true,
    delivery_dispatch: true,
    security_audit: true,
  });

  const [draftPrivileges, setDraftPrivileges] = useState<string[]>([]);
  const [draftReports, setDraftReports] = useState<string[]>([]);
  const [draftColumns, setDraftColumns] = useState<string[]>([]);
  const [draftDescription, setDraftDescription] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('choplife_staff_token') || '';
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        authHeaders['Authorization'] = `Bearer ${token}`;
      }

      const [catRes, rolesRes] = await Promise.all([
        fetch('/api/rbac/permissions-catalogue', { headers: authHeaders }),
        fetch('/api/rbac/roles', { headers: authHeaders }),
      ]);

      let loadedRoles: RoleDefinition[] = [];

      if (catRes.ok) {
        const catData = await catRes.json();
        if (Array.isArray(catData.categories) && catData.categories.length > 0) {
          setCategories(catData.categories);
        }
        if (Array.isArray(catData.reports) && catData.reports.length > 0) {
          setReportsList(catData.reports);
        }
        if (Array.isArray(catData.orderSummaryColumns) && catData.orderSummaryColumns.length > 0) {
          setColumnsList(catData.orderSummaryColumns);
        }
        if (Array.isArray(catData.standardRoles) && catData.standardRoles.length > 0) {
          loadedRoles = catData.standardRoles;
        }
      }

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        if (Array.isArray(rolesData) && rolesData.length > 0) {
          loadedRoles = rolesData;
        }
      }

      if (loadedRoles.length > 0) {
        setRoles(loadedRoles);
        setSelectedRoleId((prev) => {
          if (prev && loadedRoles.some((r) => r.id === prev || r.code === prev)) {
            return prev;
          }
          return loadedRoles[0].id || loadedRoles[0].code;
        });
      }
    } catch {
      showToast('Error loading RBAC role permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const role = roles.find((r) => r.id === selectedRoleId || r.code === selectedRoleId);
    if (role) {
      setDraftPrivileges([...(role.privileges || [])]);
      setDraftReports([...(role.reports || [])]);
      setDraftColumns([...(role.orderSummaryColumns || [])]);
      setDraftDescription(role.description || '');
    }
  }, [selectedRoleId, roles]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId || r.code === selectedRoleId);

  const toggleCategoryExpand = (catKey: string) => {
    setExpandedCategories((prev) => ({ ...prev, [catKey]: !prev[catKey] }));
  };

  const handleTogglePrivilege = (code: string) => {
    setDraftPrivileges((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleToggleCategoryAll = (category: PrivilegeCategory) => {
    const catCodes = category.privileges.map((p) => p.code);
    const allSelected = catCodes.every((c) => draftPrivileges.includes(c));

    if (allSelected) {
      setDraftPrivileges((prev) => prev.filter((c) => !catCodes.includes(c)));
    } else {
      setDraftPrivileges((prev) => Array.from(new Set([...prev, ...catCodes])));
    }
  };

  const handleToggleReport = (code: string) => {
    setDraftReports((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleToggleColumn = (code: string) => {
    setDraftColumns((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    setIsSaving(true);
    try {
      const token = localStorage.getItem('choplife_staff_token') || '';
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        authHeaders['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/rbac/roles/${selectedRole.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          description: draftDescription,
          privileges: draftPrivileges,
          reports: draftReports,
          orderSummaryColumns: draftColumns,
        }),
      });

      if (res.ok) {
        showToast(`Permissions updated for ${selectedRole.name}.`);
        await loadData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save role permissions.');
      }
    } catch {
      showToast('Error communicating with operations server.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCategories = categories
    .map((cat) => {
      const matchedPrivs = cat.privileges.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return {
        ...cat,
        privileges: matchedPrivs,
      };
    })
    .filter((cat) => cat.privileges.length > 0);

  return (
    <div className="bg-white border border-[#E5DEC9] rounded-2xl overflow-hidden shadow-md flex flex-col min-h-[680px] lg:h-[760px]">
      <div className="p-4 bg-[#FAF7F2] border-b border-[#E5DEC9] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFF8E7] border border-[#FFC700] flex items-center justify-center text-[#800D15]">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-black text-[#241311]">Role &amp; Permission Master</h2>
              <span className="bg-[#FFF8E7] text-[#800D15] border border-[#FFC700] text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                ChopLife Enterprise RBAC
              </span>
            </div>
            <p className="text-xs text-[#7A6A65]">
              Configure granular privilege matrices, operational reports, and order summary column visibility
            </p>
          </div>
        </div>

        {selectedRole && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedRole) {
                  setDraftPrivileges([...(selectedRole.privileges || [])]);
                  setDraftReports([...(selectedRole.reports || [])]);
                  setDraftColumns([...(selectedRole.orderSummaryColumns || [])]);
                  setDraftDescription(selectedRole.description || '');
                  showToast('Draft changes reset.');
                }
              }}
              className="px-3 py-1.5 bg-white hover:bg-[#FAF7F2] text-[#7A6A65] border border-[#E5DEC9] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button
              onClick={handleSaveRole}
              disabled={isSaving}
              className="px-4 py-1.5 bg-[#800D15] hover:bg-[#4D080F] text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-[#FFC700]" />
              <span>{isSaving ? 'Saving...' : 'Save Role Permissions'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-[#E5DEC9] bg-[#FAF7F2] flex flex-col shrink-0 max-h-56 lg:max-h-none">
          <div className="p-3 border-b border-[#E5DEC9] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4D080F] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#800D15]" /> User Roles ({roles.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#E5DEC9] p-1.5 space-y-1">
            {roles.map((r) => {
              const isSelected = r.id === selectedRoleId || r.code === selectedRoleId;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoleId(r.id)}
                  className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between group ${
                    isSelected
                      ? 'bg-[#800D15] text-white shadow-xs'
                      : 'bg-white hover:bg-[#FFF8E7] text-[#241311] border border-[#E5DEC9]'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xs font-black truncate ${isSelected ? 'text-[#FFC700]' : 'text-[#241311]'}`}>
                        {r.name}
                      </p>
                    </div>
                    <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-white/80' : 'text-[#7A6A65]'}`}>
                      {r.description}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold shrink-0 ${
                      isSelected ? 'bg-[#FFC700] text-[#4D080F]' : 'bg-[#FAF7F2] text-[#7A6A65] border border-[#E5DEC9]'
                    }`}
                  >
                    {r.userCount || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {selectedRole ? (
            <div className="p-4 border-b border-[#E5DEC9] bg-[#FAF7F2] space-y-3 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-[#241311] flex items-center gap-2">
                    <span>{selectedRole.name}</span>
                    <span className="font-mono text-xs font-normal text-[#7A6A65]">({selectedRole.code})</span>
                  </h3>
                  <input
                    type="text"
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    placeholder="Role operational purpose and responsibilities..."
                    className="mt-1 w-full sm:w-96 bg-white border border-[#E5DEC9] rounded-lg px-2.5 py-1 text-xs text-[#241311] focus:outline-none focus:border-[#800D15]"
                  />
                </div>

                <div className="flex bg-white p-1 rounded-xl border border-[#E5DEC9]">
                  <button
                    onClick={() => setActiveTab('privileges')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      activeTab === 'privileges'
                        ? 'bg-[#800D15] text-white shadow-xs'
                        : 'text-[#7A6A65] hover:text-[#241311]'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Privilege ({draftPrivileges.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('reports')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      activeTab === 'reports'
                        ? 'bg-[#800D15] text-white shadow-xs'
                        : 'text-[#7A6A65] hover:text-[#241311]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Reports ({draftReports.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('columns')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      activeTab === 'columns'
                        ? 'bg-[#800D15] text-white shadow-xs'
                        : 'text-[#7A6A65] hover:text-[#241311]'
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" />
                    <span>Order Summary Columns ({draftColumns.length})</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'privileges' && (
            <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3 bg-[#FAF7F2]">
              <div className="flex items-center justify-between gap-3 shrink-0">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#7A6A65]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search privileges (e.g. discount, delivery, stock, settle)..."
                    className="w-full bg-white border border-[#E5DEC9] rounded-xl pl-9 pr-3 py-2 text-xs text-[#241311] placeholder-[#7A6A65] focus:outline-none focus:border-[#800D15]"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => {
                      const all = categories.flatMap((c) => c.privileges.map((p) => p.code));
                      setDraftPrivileges(all);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-[#FFF8E7] text-[#800D15] rounded-lg border border-[#E5DEC9] font-bold"
                  >
                    Grant All Privileges
                  </button>
                  <button
                    onClick={() => setDraftPrivileges([])}
                    className="px-2.5 py-1 bg-white hover:bg-red-50 text-red-600 rounded-lg border border-[#E5DEC9] font-bold"
                  >
                    Revoke All
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {filteredCategories.map((cat) => {
                  const isExpanded = expandedCategories[cat.key] !== false;
                  const catCodes = cat.privileges.map((p) => p.code);
                  const selectedCount = catCodes.filter((c) => draftPrivileges.includes(c)).length;
                  const isAll = selectedCount === catCodes.length && catCodes.length > 0;

                  return (
                    <div
                      key={cat.key}
                      className="bg-white border border-[#E5DEC9] rounded-2xl overflow-hidden shadow-2xs"
                    >
                      <div className="p-3 bg-[#FAF7F2] border-b border-[#E5DEC9] flex items-center justify-between">
                        <div
                          onClick={() => toggleCategoryExpand(cat.key)}
                          className="flex items-center gap-2 cursor-pointer select-none"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-[#800D15]" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-[#7A6A65]" />
                          )}
                          <span className="font-black text-xs text-[#241311]">{cat.label}</span>
                          <span className="text-[10px] text-[#7A6A65] font-mono">
                            ({selectedCount}/{cat.privileges.length})
                          </span>
                        </div>

                        <button
                          onClick={() => handleToggleCategoryAll(cat)}
                          className="text-[11px] font-bold px-2 py-0.5 rounded bg-white hover:bg-[#FFF8E7] text-[#800D15] border border-[#E5DEC9] transition-all"
                        >
                          {isAll ? 'Deselect Category' : 'Select All'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          {cat.privileges.map((p) => {
                            const isChecked = draftPrivileges.includes(p.code);
                            return (
                              <div
                                key={p.id}
                                onClick={() => handleTogglePrivilege(p.code)}
                                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                                  isChecked
                                    ? 'bg-[#FFF8E7] border-[#FFC700] text-[#241311]'
                                    : 'bg-[#FAF7F2] border-[#E5DEC9] text-[#7A6A65] hover:border-[#800D15]/40'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded mt-0.5 border flex items-center justify-center shrink-0 ${
                                    isChecked
                                      ? 'bg-[#800D15] border-[#800D15] text-white'
                                      : 'border-[#E5DEC9] bg-white'
                                  }`}
                                >
                                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <p className={`text-xs font-bold leading-tight ${isChecked ? 'text-[#241311]' : 'text-[#7A6A65]'}`}>
                                      {p.name}
                                    </p>
                                    <span className="text-[9px] font-mono opacity-60 shrink-0">{p.code}</span>
                                  </div>
                                  <p className="text-[10px] text-[#7A6A65] leading-tight mt-0.5">{p.description}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF7F2]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reportsList.map((rep) => {
                  const isChecked = draftReports.includes(rep.code);
                  return (
                    <div
                      key={rep.id}
                      onClick={() => handleToggleReport(rep.code)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                        isChecked
                          ? 'bg-[#FFF8E7] border-[#FFC700] text-[#241311]'
                          : 'bg-white border-[#E5DEC9] text-[#7A6A65]'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${
                          isChecked ? 'bg-[#800D15] border-[#800D15] text-white' : 'border-[#E5DEC9] bg-[#FAF7F2]'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#241311]">{rep.name}</p>
                        <p className="text-[11px] text-[#7A6A65] mt-0.5">{rep.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'columns' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF7F2]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {columnsList.map((col) => {
                  const isChecked = draftColumns.includes(col.code);
                  return (
                    <div
                      key={col.id}
                      onClick={() => handleToggleColumn(col.code)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                        isChecked
                          ? 'bg-[#FFF8E7] border-[#FFC700] text-[#241311]'
                          : 'bg-white border-[#E5DEC9] text-[#7A6A65]'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${
                          isChecked ? 'bg-[#800D15] border-[#800D15] text-white' : 'border-[#E5DEC9] bg-[#FAF7F2]'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#241311]">{col.label}</p>
                        <p className="text-[11px] text-[#7A6A65] mt-0.5">{col.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
