import React, { useState, useEffect } from 'react';
import { Bike, Save, Plus, Trash2, RefreshCw, MapPin, ShieldCheck } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

export interface ExternalRiderZoneRate {
  zoneId: string;
  zoneName: string;
  customerDeliveryFee: number;
  externalRiderShare: number;
  companyShare: number;
}

export interface RiderCompensationConfig {
  internalRiderMonthlyBaseSalary: number;
  internalRiderPerDeliveryFee: number;
  externalRiderRatesByZone: ExternalRiderZoneRate[];
  updatedAt?: string;
  updatedBy?: string;
}

interface Props {
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const RiderPaymentsAndRatesPanel: React.FC<Props> = ({ onShowToast }) => {
  const { formatNaira } = useApp();
  const [config, setConfig] = useState<RiderCompensationConfig>({
    internalRiderMonthlyBaseSalary: 25000,
    internalRiderPerDeliveryFee: 200,
    externalRiderRatesByZone: [],
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('choplife_staff_token') || localStorage.getItem('choplife_auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchRiderConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/payroll/rider-config', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setConfig({
          internalRiderMonthlyBaseSalary: Number(data.internalRiderMonthlyBaseSalary ?? 25000),
          internalRiderPerDeliveryFee: Number(data.internalRiderPerDeliveryFee ?? 200),
          externalRiderRatesByZone: Array.isArray(data.externalRiderRatesByZone)
            ? data.externalRiderRatesByZone
            : [],
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        });
      }
    } catch (err) {
      console.error('Failed to load rider config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiderConfig();
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/finance/payroll/rider-config', {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        onShowToast('error', data.error || 'Failed to update rider compensation rules.');
        return;
      }
      setConfig(data.config);
      onShowToast(
        'success',
        'Rider compensation rules updated. Internal rider base salary and per-delivery commissions will automatically apply in payroll runs.'
      );
    } catch (err) {
      onShowToast('error', 'Network error while saving rider compensation configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleZoneChange = (index: number, field: keyof ExternalRiderZoneRate, value: string | number) => {
    setConfig((prev) => {
      const nextZones = [...prev.externalRiderRatesByZone];
      const updated = { ...nextZones[index], [field]: value };
      if (field === 'customerDeliveryFee' || field === 'externalRiderShare') {
        const fee = Number(field === 'customerDeliveryFee' ? value : updated.customerDeliveryFee) || 0;
        const rider = Number(field === 'externalRiderShare' ? value : updated.externalRiderShare) || 0;
        updated.companyShare = Math.max(0, fee - rider);
      }
      nextZones[index] = updated;
      return { ...prev, externalRiderRatesByZone: nextZones };
    });
  };

  const handleAddZone = () => {
    setConfig((prev) => ({
      ...prev,
      externalRiderRatesByZone: [
        ...prev.externalRiderRatesByZone,
        {
          zoneId: `zone-${Date.now()}`,
          zoneName: 'New Delivery Zone',
          customerDeliveryFee: 2000,
          externalRiderShare: 1500,
          companyShare: 500,
        },
      ],
    }));
  };

  const handleRemoveZone = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      externalRiderRatesByZone: prev.externalRiderRatesByZone.filter((_, idx) => idx !== index),
    }));
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E5DEC9] shadow-xs overflow-hidden">
      <div className="p-5 border-b border-[#E5DEC9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#4D080F] flex items-center gap-2">
            <Bike className="w-5 h-5 text-[#4D080F]" />
            <span>Rider Payments & Dispatch Compensation Matrix</span>
          </h2>
          <p className="text-xs text-stone-500">
            Configure Internal Rider payroll structure (Monthly Base Salary + Per-Delivery Commission) and External Rider location-based delivery fee splits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRiderConfig}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-[#E5DEC9] bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>
          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#4D080F] text-[#FFC700] hover:bg-[#800D15] text-xs font-bold flex items-center gap-1.5 shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving Rules...' : 'Save Rider Compensation Rules'}</span>
          </button>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 gap-6">
        {/* Internal Riders Card */}
        <div className="bg-[#FAF7F2] rounded-2xl p-4 sm:p-5 border border-[#E5DEC9] space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#4D080F] text-[#FFC700]">
                Internal Fleet Riders
              </span>
              <h3 className="text-sm font-bold text-stone-900 mt-1.5">
                Salaried Dispatch Riders + Per-Delivery Commission
              </h3>
              <p className="text-[11px] text-stone-500">
                Automatically synced into monthly payroll runs for all active staff with the Dispatch Rider role.
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs items-stretch">
            <div className="bg-white p-3 rounded-xl border border-[#E5DEC9]">
              <label className="font-bold text-stone-700 block mb-1">
                Monthly Base Salary (₦)
              </label>
              <input
                type="number"
                min={0}
                step={1000}
                value={config.internalRiderMonthlyBaseSalary}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    internalRiderMonthlyBaseSalary: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 font-black text-sm text-[#4D080F]"
              />
              <span className="text-[10px] text-stone-500 mt-1 block">
                Default standard: {formatNaira(25000)} / month
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-[#E5DEC9]">
              <label className="font-bold text-stone-700 block mb-1">
                Per Completed Delivery (₦)
              </label>
              <input
                type="number"
                min={0}
                step={50}
                value={config.internalRiderPerDeliveryFee}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    internalRiderPerDeliveryFee: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 font-black text-sm text-emerald-800"
              />
              <span className="text-[10px] text-stone-500 mt-1 block">
                Default standard: {formatNaira(200)} / verified delivery
              </span>
            </div>

            <div className="bg-white/80 rounded-xl p-3 border border-[#E5DEC9] text-[11px] text-stone-600 space-y-1">
              <p className="font-bold text-stone-800">Anti-Duplication Payroll Guarantee:</p>
              <p>
                • Base salary is applied once per payroll period per internal rider.
                <br />• Only unique orders with <code className="font-mono text-stone-800">delivered</code> status are counted toward the{' '}
                {formatNaira(config.internalRiderPerDeliveryFee)} delivery commission.
              </p>
            </div>
          </div>
        </div>

        {/* External Riders Location Split Table (Full Width — Zero Truncation) */}
        <div className="bg-[#FAF7F2] rounded-2xl p-4 sm:p-5 border border-[#E5DEC9] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-800 text-white">
                External / 3P Dispatch Riders
              </span>
              <h3 className="text-sm font-bold text-stone-900 mt-1.5">
                Location-Based Delivery Fee Split Schedule (Unified Storefront &amp; Dispatch Authority)
              </h3>
            </div>
            <button
              type="button"
              onClick={handleAddZone}
              className="px-3.5 py-1.5 rounded-xl bg-white border border-[#E5DEC9] hover:bg-stone-100 text-stone-800 text-xs font-bold flex items-center gap-1 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Zone</span>
            </button>
          </div>

          <div className="overflow-x-auto bg-white rounded-xl border border-[#E5DEC9]">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-700 font-bold border-b border-[#E5DEC9]">
                  <th className="py-3 px-4 min-w-[420px]">Delivery Location / Zone</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Customer Fee (₦)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Rider Payout (₦)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Choplife Share (₦)</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DEC9]">
                {config.externalRiderRatesByZone.map((z, idx) => (
                  <tr key={z.zoneId || idx} className="hover:bg-stone-50/70">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2 min-w-[400px] w-full">
                        <MapPin className="w-4 h-4 text-[#4D080F] shrink-0" />
                        <input
                          type="text"
                          value={z.zoneName}
                          title={z.zoneName}
                          onChange={(e) => handleZoneChange(idx, 'zoneName', e.target.value)}
                          className="w-full min-w-[380px] bg-transparent font-bold text-stone-900 focus:outline-hidden border border-transparent hover:border-stone-200 focus:border-[#4D080F] focus:bg-[#FAF7F2] rounded-lg px-2 py-1.5 transition"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={z.customerDeliveryFee}
                        onChange={(e) => handleZoneChange(idx, 'customerDeliveryFee', Number(e.target.value) || 0)}
                        className="w-24 text-right bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg px-2.5 py-1.5 font-bold text-stone-900"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={z.externalRiderShare}
                        onChange={(e) => handleZoneChange(idx, 'externalRiderShare', Number(e.target.value) || 0)}
                        className="w-24 text-right bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 font-bold text-emerald-900"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#4D080F] tabular-nums">
                      {formatNaira(z.companyShare)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveZone(idx)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 transition"
                        title="Remove zone"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
