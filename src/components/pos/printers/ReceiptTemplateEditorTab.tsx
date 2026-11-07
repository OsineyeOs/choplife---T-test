import React, { useState, useEffect } from 'react';
import {
  FileText,
  Save,
  RotateCcw,
  Printer,
  Eye,
  CheckCircle2,
  AlertCircle,
  Lock,
  Undo2,
} from 'lucide-react';
import {
  renderReceiptHtml,
  generateSampleReceiptData,
} from '../../../utils/receiptRenderer';
import { printThermalHtml } from '../../../utils/hardwarePrinter';
import { DbReceiptTemplate } from '../../../../server_db';
import { useApp } from '../../../context/AppContext';

export const CACHED_TEMPLATES_STORAGE_KEY = 'choplife_cached_receipt_templates';

function getAuthHeaders(includeJsonContentType = false): Record<string, string> {
  const token = localStorage.getItem('choplife_staff_token') || '';
  const headers: Record<string, string> = {};
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const ReceiptTemplateEditorTab: React.FC = () => {
  const { currentStaff, orders } = useApp();
  const [templates, setTemplates] = useState<DbReceiptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('tmpl-cust-receipt');
  const [currentTemplate, setCurrentTemplate] = useState<DbReceiptTemplate | null>(null);
  const [originalTemplate, setOriginalTemplate] = useState<DbReceiptTemplate | null>(null);
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [useSampleData, setUseSampleData] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Permission evaluation
  const staffPrivileges: string[] = (currentStaff as any)?.privileges || [];
  const isSuperAdmin =
    currentStaff?.role === 'super_admin' ||
    currentStaff?.role === 'admin' ||
    currentStaff?.role === 'corporate_admin' ||
    staffPrivileges.includes('*');

  const canEditTemplates =
    isSuperAdmin ||
    currentStaff?.role === 'branch_manager' ||
    staffPrivileges.includes('hardware.templates.edit') ||
    staffPrivileges.includes('hardware.*');

  const canResetTemplates =
    isSuperAdmin ||
    currentStaff?.role === 'branch_manager' ||
    staffPrivileges.includes('hardware.templates.reset') ||
    staffPrivileges.includes('hardware.*');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const syncTemplatesCache = (list: DbReceiptTemplate[]) => {
    try {
      const map: Record<string, DbReceiptTemplate> = {};
      for (const item of list) {
        map[item.docType] = item;
        map[item.id] = item;
      }
      localStorage.setItem(CACHED_TEMPLATES_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // Ignore storage quota issues
    }
  };

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/pos/printers/templates', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const list: DbReceiptTemplate[] = Array.isArray(data) ? data : data.templates || [];
        setTemplates(list);
        syncTemplatesCache(list);
        const current = list.find((t: DbReceiptTemplate) => t.id === selectedTemplateId) || list[0];
        if (current) {
          setSelectedTemplateId(current.id);
          setCurrentTemplate({ ...current });
          setOriginalTemplate({ ...current });
          setPaperWidth(current.paperWidth);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMessage({
          text: err.error || `Failed to load templates (HTTP ${res.status})`,
          type: 'error',
        });
      }
    } catch (err: any) {
      console.error('Failed to load receipt templates:', err);
      setStatusMessage({ text: 'Failed to load templates from server', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const isDirty = React.useMemo(() => {
    if (!currentTemplate || !originalTemplate) return false;
    return JSON.stringify(currentTemplate) !== JSON.stringify(originalTemplate);
  }, [currentTemplate, originalTemplate]);

  const handleSelectTemplate = (id: string) => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes to this template. Discard changes and switch template?')) {
        return;
      }
    }
    setSelectedTemplateId(id);
    const tmpl = templates.find((t) => t.id === id);
    if (tmpl) {
      setCurrentTemplate({ ...tmpl });
      setOriginalTemplate({ ...tmpl });
      setPaperWidth(tmpl.paperWidth);
      setStatusMessage(null);
    }
  };

  const handleFieldChange = (field: keyof DbReceiptTemplate, value: any) => {
    if (!currentTemplate || !canEditTemplates) return;
    setCurrentTemplate({
      ...currentTemplate,
      [field]: value,
    });
  };

  const handleDiscardChanges = () => {
    if (!originalTemplate) return;
    setCurrentTemplate({ ...originalTemplate });
    setPaperWidth(originalTemplate.paperWidth);
    setStatusMessage({ text: 'Unsaved changes discarded.', type: 'success' });
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const handleSave = async () => {
    if (!currentTemplate || !canEditTemplates) return;

    if (!currentTemplate.brandName?.trim() || !currentTemplate.name?.trim()) {
      setStatusMessage({
        text: 'Validation Error: Header Brand Title and Template Name cannot be empty.',
        type: 'error',
      });
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch(`/api/pos/printers/templates/${currentTemplate.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({
          ...currentTemplate,
          paperWidth,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated: DbReceiptTemplate = data.template || data;
        const nextList = templates.map((t) => (t.id === updated.id ? updated : t));
        setTemplates(nextList);
        syncTemplatesCache(nextList);
        setCurrentTemplate({ ...updated });
        setOriginalTemplate({ ...updated });
        setPaperWidth(updated.paperWidth);
        setStatusMessage({ text: 'Template saved and persisted to server!', type: 'success' });
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMessage({ text: err.error || 'Failed to save template', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Network error saving template', type: 'error' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleReset = async () => {
    if (!currentTemplate || !canResetTemplates) return;
    if (!window.confirm('Restore this template to the official Choplife Republic default layout?')) return;
    try {
      setIsSaving(true);
      const res = await fetch(`/api/pos/printers/templates/${currentTemplate.id}/reset`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const reset: DbReceiptTemplate = data.template || data;
        const nextList = templates.map((t) => (t.id === reset.id ? reset : t));
        setTemplates(nextList);
        syncTemplatesCache(nextList);
        setCurrentTemplate({ ...reset });
        setOriginalTemplate({ ...reset });
        setPaperWidth(reset.paperWidth);
        setStatusMessage({ text: 'Restored to official Choplife Republic defaults!', type: 'success' });
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMessage({ text: err.error || 'Failed to reset template', type: 'error' });
      }
    } catch {
      setStatusMessage({ text: 'Failed to reset template', type: 'error' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const getPreviewOrderData = () => {
    if (!currentTemplate) return generateSampleReceiptData('customer_receipt');
    if (!useSampleData && orders && orders.length > 0) {
      const latestOrder = orders[0];
      return {
        ...latestOrder,
        isSample: false,
      };
    }
    const sample = generateSampleReceiptData(currentTemplate.docType);
    return {
      ...sample,
      isSample: true,
    };
  };

  const handleTestPrint = async () => {
    if (!currentTemplate) return;
    const previewOrder = getPreviewOrderData();
    const html = renderReceiptHtml({
      documentType: currentTemplate.docType,
      order: previewOrder,
      template: currentTemplate,
      paperWidth,
    });
    await printThermalHtml(html, paperWidth);
    setStatusMessage({ text: 'Dispatched test receipt to browser thermal print dialog!', type: 'success' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const previewOrder = getPreviewOrderData();

  const previewHtml = currentTemplate
    ? renderReceiptHtml({
        documentType: currentTemplate.docType,
        order: previewOrder,
        template: {
          ...currentTemplate,
          paperWidth,
        },
        paperWidth,
      })
    : '';

  if (isLoading) {
    return (
      <div className="p-8 text-center text-stone-400 text-sm">
        <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FFC700]" />
        Loading Authoritative Receipt Templates...
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full gap-5 overflow-hidden" id="receipt-template-editor-container">
      {/* Left Column: Template Selection & Controls */}
      <div className="w-full lg:w-1/2 flex flex-col space-y-4 overflow-y-auto pr-1">
        {!canEditTemplates && (
          <div
            className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5"
            id="template-readonly-banner"
          >
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Read-Only Preview Mode</span>
              Your current role ({currentStaff?.role || 'guest'}) does not have the{' '}
              <code className="text-amber-300 font-mono">hardware.templates.edit</code> permission. You can inspect
              and test-print templates, but saving modifications is restricted to authorised administrators and managers.
            </div>
          </div>
        )}

        {/* Template Selector Pills */}
        <div>
          <label className="block text-xs font-titan text-[#4D080F] uppercase mb-2">
            Select Document Template ({templates.length})
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {templates.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tmpl.id)}
                id={`select-template-${tmpl.id}`}
                className={`p-2.5 rounded-xl text-left border transition-all text-xs flex flex-col shadow-2xs ${
                  selectedTemplateId === tmpl.id
                    ? 'bg-[#FAF7F2] border-2 border-[#4D080F] text-[#4D080F] font-bold shadow-xs'
                    : 'bg-white border-[#E5DEC9] text-[#241311] hover:border-stone-400'
                }`}
              >
                <span className="font-titan text-xs text-[#4D080F]">{tmpl.name}</span>
                <span className="text-[10px] text-[#6E5953] font-mono mt-0.5">{tmpl.docType}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Paper Width & Data Mode Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border border-[#E5DEC9] rounded-xl shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#4D080F] font-titan">Paper Roll:</span>
            <div className="flex rounded-lg overflow-hidden border border-[#E5DEC9] p-0.5 bg-[#FAF7F2]">
              <button
                type="button"
                disabled={!canEditTemplates}
                onClick={() => {
                  setPaperWidth('80mm');
                  handleFieldChange('paperWidth', '80mm');
                }}
                id="paper-width-80mm-btn"
                className={`px-2.5 py-1 text-xs font-bold rounded ${
                  paperWidth === '80mm' ? 'bg-[#4D080F] text-[#FFC700]' : 'text-[#6E5953] hover:text-[#241311]'
                } disabled:opacity-60`}
              >
                80mm (Wide)
              </button>
              <button
                type="button"
                disabled={!canEditTemplates}
                onClick={() => {
                  setPaperWidth('58mm');
                  handleFieldChange('paperWidth', '58mm');
                }}
                id="paper-width-58mm-btn"
                className={`px-2.5 py-1 text-xs font-bold rounded ${
                  paperWidth === '58mm' ? 'bg-[#4D080F] text-[#FFC700]' : 'text-[#6E5953] hover:text-[#241311]'
                } disabled:opacity-60`}
              >
                58mm (Compact)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {orders && orders.length > 0 && (
              <button
                type="button"
                onClick={() => setUseSampleData(!useSampleData)}
                className="px-2.5 py-1.5 rounded-lg bg-[#FAF7F2] hover:bg-stone-100 text-[#241311] border border-[#E5DEC9] text-xs font-semibold transition-colors"
                id="toggle-sample-data-btn"
              >
                {useSampleData ? 'Using Sample Data' : 'Using Live Order'}
              </button>
            )}
            <button
              type="button"
              onClick={handleTestPrint}
              id="template-test-print-btn"
              className="px-3 py-1.5 rounded-lg bg-[#4D080F] hover:bg-[#38060B] text-[#FFC700] text-xs font-titan flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Test Print
            </button>
          </div>
        </div>

        {/* Form Fields */}
        {currentTemplate && (
          <div className="space-y-3 bg-white p-4 border border-[#E5DEC9] rounded-2xl shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-titan text-[#4D080F] uppercase mb-1" htmlFor="tmpl-name-input">
                  Template Display Name
                </label>
                <input
                  id="tmpl-name-input"
                  type="text"
                  disabled={!canEditTemplates}
                  value={currentTemplate.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-titan text-[#4D080F] uppercase mb-1" htmlFor="tmpl-brand-input">
                  Header Brand Title
                </label>
                <input
                  id="tmpl-brand-input"
                  type="text"
                  disabled={!canEditTemplates}
                  value={currentTemplate.brandName}
                  onChange={(e) => handleFieldChange('brandName', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F] disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-titan text-[#4D080F] uppercase mb-1" htmlFor="tmpl-tagline-input">
                  Brand Subtitle / Tagline
                </label>
                <input
                  id="tmpl-tagline-input"
                  type="text"
                  disabled={!canEditTemplates}
                  value={currentTemplate.tagline}
                  onChange={(e) => handleFieldChange('tagline', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-titan text-[#4D080F] uppercase mb-1" htmlFor="tmpl-header-note-input">
                  Custom Header Note / Banner
                </label>
                <input
                  id="tmpl-header-note-input"
                  type="text"
                  disabled={!canEditTemplates}
                  placeholder="Optional banner note (e.g. 100% Maximum Enjoyment)"
                  value={currentTemplate.customHeaderMessage || ''}
                  onChange={(e) => handleFieldChange('customHeaderMessage', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F] disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-titan text-[#4D080F] uppercase mb-1" htmlFor="tmpl-phone-input">
                  Support Phone
                </label>
                <input
                  id="tmpl-phone-input"
                  type="text"
                  disabled={!canEditTemplates}
                  value={currentTemplate.phone || ''}
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                  placeholder="Branch default"
                  className="w-full px-2.5 py-1.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-titan text-[#4D080F] uppercase mb-1" htmlFor="tmpl-social-input">
                  Social Handle
                </label>
                <input
                  id="tmpl-social-input"
                  type="text"
                  disabled={!canEditTemplates}
                  value={currentTemplate.instagram || ''}
                  onChange={(e) => handleFieldChange('instagram', e.target.value)}
                  placeholder="@chopliferepublic"
                  className="w-full px-2.5 py-1.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-titan text-[#4D080F] uppercase mb-1" htmlFor="tmpl-tax-input">
                  Tax / TIN ID
                </label>
                <input
                  id="tmpl-tax-input"
                  type="text"
                  disabled={!canEditTemplates}
                  value={currentTemplate.taxNumber || ''}
                  onChange={(e) => handleFieldChange('taxNumber', e.target.value)}
                  placeholder="Optional TIN"
                  className="w-full px-2.5 py-1.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F] disabled:opacity-50"
                />
              </div>
            </div>

            {/* Display Toggles */}
            <div className="pt-2 border-t border-[#E5DEC9]">
              <span className="block text-[10px] font-titan text-[#4D080F] uppercase tracking-wider mb-2">
                Receipt Sections &amp; Field Visibility
              </span>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditTemplates}
                    checked={currentTemplate.showLogo}
                    onChange={(e) => handleFieldChange('showLogo', e.target.checked)}
                    className="accent-[#FFC700] rounded"
                  />
                  <span>Show Brand Logo Header</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditTemplates}
                    checked={currentTemplate.showBranchAddress}
                    onChange={(e) => handleFieldChange('showBranchAddress', e.target.checked)}
                    className="accent-[#FFC700] rounded"
                  />
                  <span>Show Benin City Branch Address</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditTemplates}
                    checked={currentTemplate.showBranchPhone}
                    onChange={(e) => handleFieldChange('showBranchPhone', e.target.checked)}
                    className="accent-[#FFC700] rounded"
                  />
                  <span>Show Branch Telephone</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditTemplates}
                    checked={currentTemplate.showOrderNumber}
                    onChange={(e) => handleFieldChange('showOrderNumber', e.target.checked)}
                    className="accent-[#FFC700] rounded"
                  />
                  <span>Show Order / Check Number</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditTemplates}
                    checked={currentTemplate.showDateTime}
                    onChange={(e) => handleFieldChange('showDateTime', e.target.checked)}
                    className="accent-[#FFC700] rounded"
                  />
                  <span>Show Date & Timestamp</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditTemplates}
                    checked={currentTemplate.showCashierName}
                    onChange={(e) => handleFieldChange('showCashierName', e.target.checked)}
                    className="accent-[#FFC700] rounded"
                  />
                  <span>Show Cashier Name</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditTemplates}
                    checked={currentTemplate.showCustomerDetails}
                    onChange={(e) => handleFieldChange('showCustomerDetails', e.target.checked)}
                    className="accent-[#FFC700] rounded"
                  />
                  <span>Show Customer Name & Phone</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditTemplates}
                    checked={currentTemplate.showTableNumber}
                    onChange={(e) => handleFieldChange('showTableNumber', e.target.checked)}
                    className="accent-[#FFC700] rounded"
                  />
                  <span>Show Table / Seating</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditTemplates}
                    checked={currentTemplate.showItemModifiers}
                    onChange={(e) => handleFieldChange('showItemModifiers', e.target.checked)}
                    className="accent-[#FFC700] rounded"
                  />
                  <span>Show Spice & Item Modifiers</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditTemplates}
                    checked={currentTemplate.highlightKitchenNotes || false}
                    onChange={(e) => handleFieldChange('highlightKitchenNotes', e.target.checked)}
                    className="accent-[#FFC700] rounded"
                  />
                  <span>Highlight Kitchen Prep Notes</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditTemplates}
                    checked={currentTemplate.showSubtotal}
                    onChange={(e) => handleFieldChange('showSubtotal', e.target.checked)}
                    className="accent-[#FFC700] rounded"
                  />
                  <span>Show Subtotal & Charges</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditTemplates}
                    checked={currentTemplate.showPaymentDetails}
                    onChange={(e) => handleFieldChange('showPaymentDetails', e.target.checked)}
                    className="accent-[#FFC700] rounded"
                  />
                  <span>Show Payment Method & Tender</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditTemplates}
                    checked={currentTemplate.showLoyaltyPoints}
                    onChange={(e) => handleFieldChange('showLoyaltyPoints', e.target.checked)}
                    className="accent-[#FFC700] rounded"
                  />
                  <span>Show Chop Paddy Rewards</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditTemplates}
                    checked={currentTemplate.showReprintIndicator}
                    onChange={(e) => handleFieldChange('showReprintIndicator', e.target.checked)}
                    className="accent-[#FFC700] rounded"
                  />
                  <span>Show Duplicate Reprint Banner</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E5DEC9]">
              <div>
                <label className="block text-[11px] font-titan text-[#4D080F] uppercase mb-1" htmlFor="tmpl-footer-input">
                  Footer Thank-You Message
                </label>
                <input
                  id="tmpl-footer-input"
                  type="text"
                  disabled={!canEditTemplates}
                  value={currentTemplate.thankYouMessage}
                  onChange={(e) => handleFieldChange('thankYouMessage', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-titan text-[#4D080F] uppercase mb-1" htmlFor="tmpl-policy-input">
                  Customer Service / Policy Note
                </label>
                <input
                  id="tmpl-policy-input"
                  type="text"
                  disabled={!canEditTemplates}
                  value={currentTemplate.customFooterMessage || ''}
                  onChange={(e) => handleFieldChange('customFooterMessage', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#FAF7F2] border border-[#E5DEC9] rounded-lg text-xs text-[#241311] focus:outline-hidden focus:border-[#4D080F] disabled:opacity-50"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E5DEC9]">
              <div className="flex items-center gap-2">
                {canResetTemplates && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isSaving}
                    id="template-reset-btn"
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FAF7F2] text-[#4D080F] border border-[#E5DEC9] text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore Defaults
                  </button>
                )}

                {isDirty && canEditTemplates && (
                  <button
                    type="button"
                    onClick={handleDiscardChanges}
                    disabled={isSaving}
                    id="template-discard-btn"
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 text-amber-700 border border-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Discard Changes
                  </button>
                )}
              </div>

              {canEditTemplates && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  id="template-save-btn"
                  className="px-4 py-1.5 rounded-lg bg-[#4D080F] hover:bg-[#38060B] text-[#FFC700] text-xs font-titan flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? 'Saving...' : 'Save Template'}
                </button>
              )}
            </div>

            {statusMessage && (
              <div
                id="template-status-alert"
                className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-950/70 border border-emerald-500/50 text-emerald-300'
                    : 'bg-red-950/70 border border-red-500/50 text-red-300'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Column: Live Thermal Paper Visualizer */}
      <div className="w-full lg:w-1/2 flex flex-col items-center bg-[#140C0B] p-4 rounded-2xl border border-stone-800 overflow-y-auto">
        <div className="w-full flex items-center justify-between mb-3 px-2">
          <div className="flex items-center gap-2 text-stone-400 text-xs">
            <Eye className="w-4 h-4 text-[#FFC700]" />
            <span className="font-bold">Live Thermal Ticket Preview</span>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Unsaved Edits
              </span>
            )}
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-800 text-stone-300">
              {paperWidth} • 203 DPI
            </span>
          </div>
        </div>

        {/* Realistic Thermal Paper Roll Container */}
        <div
          id="thermal-live-preview-box"
          className="bg-white text-black shadow-2xl p-4 sm:p-6 rounded-b transition-all duration-200 border-t-8 border-stone-400 select-text overflow-hidden"
          style={{
            width: paperWidth === '58mm' ? '280px' : '360px',
            fontFamily: "'Courier New', Courier, monospace",
            minHeight: '440px',
          }}
        >
          {previewHtml ? (
            <div
              className="text-black text-xs leading-tight"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <div className="text-center py-12 text-stone-400 text-xs">
              No template preview available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
