import React, { useState, useEffect } from 'react';
import { BranchId, StaffUser, CustomerNotification, NotificationEngineStats } from '../../types';
import {
  Bell,
  MessageSquare,
  Smartphone,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Send,
  Radio,
  Zap,
  Clock,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Info,
  Key,
  Sliders,
  Check,
  Copy,
  Bot,
  Activity,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
} from 'lucide-react';

interface NotificationHubProps {
  activeBranchId: BranchId;
  currentStaff: StaffUser;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const NotificationHub: React.FC<NotificationHubProps> = ({
  activeBranchId,
  currentStaff,
  showToast,
}) => {
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [stats, setStats] = useState<NotificationEngineStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<'all' | 'sms' | 'whatsapp'>('all');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'stream' | 'composer' | 'gateways'>('stream');

  // Manual Composer State
  const [composePhone, setComposePhone] = useState<string>('');
  const [composeCustomerName, setComposeCustomerName] = useState<string>('');
  const [composeOrderNumber, setComposeOrderNumber] = useState<string>('');
  const [composeChannel, setComposeChannel] = useState<'sms' | 'whatsapp' | 'both'>('sms');
  const [composeMessage, setComposeMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  // Selected Notification for Detail View
  const [inspectedNotif, setInspectedNotif] = useState<CustomerNotification | null>(null);

  // Gateway Configuration & Credentials State
  const [gatewayData, setGatewayData] = useState<any>(null);
  const [gatewayForm, setGatewayForm] = useState<any>({
    termiiApiKey: '',
    termiiSenderId: 'CHOPLIFE',
    termiiChannel: 'generic',
    whatsappToken: '',
    whatsappPhoneId: '',
    whatsappWabaId: '',
    webhookSecret: 'choplife_wh_sec_2026_benin',
    defaultChannel: 'both',
    autoAlerts: {
      orderConfirmation: true,
      kitchenPreparing: true,
      orderReady: true,
      dispatchEnRoute: true,
      deliveryCompleted: true,
      posReceipt: true,
    },
    liveGatewayMode: false,
  });
  const [isSavingGateway, setIsSavingGateway] = useState<boolean>(false);
  const [pingResults, setPingResults] = useState<{
    termii?: any;
    whatsapp?: any;
    testing?: string;
  }>({});
  const [inboundSimPhone, setInboundSimPhone] = useState<string>('08031234567');
  const [inboundSimText, setInboundSimText] = useState<string>('STATUS');
  const [inboundBotResponse, setInboundBotResponse] = useState<any>(null);
  const [isTestingBot, setIsTestingBot] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchGatewayConfig = async () => {
    try {
      const token = localStorage.getItem('choplife_staff_token') || '';
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/notifications/gateways', { headers });
      if (res.ok) {
        const data = await res.json();
        setGatewayData(data);
        if (data.config) {
          setGatewayForm((prev: any) => ({
            ...prev,
            termiiSenderId: data.config.termiiSenderId || 'CHOPLIFE',
            termiiChannel: data.config.termiiChannel || 'generic',
            whatsappPhoneId: data.config.whatsappPhoneId || '',
            whatsappWabaId: data.config.whatsappWabaId || '',
            webhookSecret: data.config.webhookSecret || 'choplife_wh_sec_2026_benin',
            defaultChannel: data.config.defaultChannel || 'both',
            autoAlerts: data.config.autoAlerts || prev.autoAlerts,
            liveGatewayMode: Boolean(data.config.liveGatewayMode),
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load gateway config:', err);
    }
  };

  const handleSaveGatewayConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGateway(true);
    try {
      const token = localStorage.getItem('choplife_staff_token') || '';
      const payload = { ...gatewayForm };
      if (!payload.termiiApiKey) delete payload.termiiApiKey;
      if (!payload.whatsappToken) delete payload.whatsappToken;

      const res = await fetch('/api/notifications/gateways', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast('Gateway configuration saved successfully!', 'success');
        fetchGatewayConfig();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to save gateway config', 'error');
      }
    } catch {
      showToast('Error saving gateway credentials', 'error');
    } finally {
      setIsSavingGateway(false);
    }
  };

  const handleTestPing = async (gateway: 'termii' | 'whatsapp') => {
    setPingResults((prev) => ({ ...prev, testing: gateway }));
    try {
      const token = localStorage.getItem('choplife_staff_token') || '';
      const res = await fetch('/api/notifications/gateways/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ gateway }),
      });
      const data = await res.json();
      setPingResults((prev) => ({ ...prev, [gateway]: data, testing: undefined }));
      if (data.success) {
        showToast(`${gateway === 'termii' ? 'Termii' : 'WhatsApp'} Ping: ${data.status} (${data.latencyMs}ms)`, 'success');
      } else {
        showToast(`Diagnostic: ${data.status}`, 'error');
      }
    } catch (err: any) {
      setPingResults((prev) => ({
        ...prev,
        [gateway]: { success: false, status: 'FAILED', details: err.message },
        testing: undefined,
      }));
      showToast('Network error pinging gateway', 'error');
    }
  };

  const handleSimulateInboundBot = async () => {
    if (!inboundSimText.trim()) return;
    setIsTestingBot(true);
    setInboundBotResponse(null);
    try {
      const res = await fetch('/api/notifications/webhook/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: inboundSimPhone,
          text: inboundSimText,
          name: 'Customer Test',
        }),
      });
      const data = await res.json();
      if (res.ok && data.result) {
        setInboundBotResponse(data.result);
        showToast('WhatsApp Inbound Bot generated reply!', 'success');
        fetchNotifications();
        fetchStats();
      } else {
        showToast('Bot test failed', 'error');
      }
    } catch {
      showToast('Failed to reach webhook', 'error');
    } finally {
      setIsTestingBot(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    showToast(`Copied ${label} to clipboard!`, 'success');
    setTimeout(() => setCopiedKey(null), 3000);
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('choplife_staff_token') || '';
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let url = `/api/notifications?branchId=${activeBranchId}`;
      if (selectedChannel !== 'all') url += `&channel=${selectedChannel}`;
      if (selectedEventType !== 'all') url += `&eventType=${selectedEventType}`;

      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        if (data.length > 0 && !inspectedNotif) {
          setInspectedNotif(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('choplife_staff_token') || '';
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/notifications/stats', { headers });
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch notification stats:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchStats();
    fetchGatewayConfig();
  }, [activeBranchId, selectedChannel, selectedEventType]);

  // Resend notification
  const handleResend = async (notifId: string) => {
    try {
      const token = localStorage.getItem('choplife_staff_token') || '';
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/notifications/resend/${notifId}`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        showToast('Notification re-dispatched via gateway successfully!', 'success');
        fetchNotifications();
        fetchStats();
      } else {
        showToast('Failed to resend notification.', 'error');
      }
    } catch {
      showToast('Error connecting to notification service.', 'error');
    }
  };

  // Send Manual Notification
  const handleSendCustomNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composePhone.trim() || !composeMessage.trim()) {
      showToast('Please enter a recipient phone and message.', 'error');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerPhone: composePhone,
          customerName: composeCustomerName || 'Valued Customer',
          orderNumber: composeOrderNumber || undefined,
          channel: composeChannel,
          message: composeMessage,
          branchId: activeBranchId,
        }),
      });

      if (res.ok) {
        showToast(`Dispatched ${composeChannel.toUpperCase()} notification successfully!`, 'success');
        setComposeMessage('');
        setComposePhone('');
        setComposeCustomerName('');
        setComposeOrderNumber('');
        setActiveTab('stream');
        fetchNotifications();
        fetchStats();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to dispatch notification.', 'error');
      }
    } catch {
      showToast('Network error while dispatching notification.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Quick Templates
  const applyTemplate = (type: 'delay' | 'pin' | 'gate' | 'substitute') => {
    if (type === 'delay') {
      setComposeMessage(
        'ChopLife Dispatch Notice: Due to heavy traffic conditions along Sapele Road / Airport Road, your delivery rider will arrive in approx 15 minutes. Thank you for your patience! 🛵'
      );
    } else if (type === 'pin') {
      setComposeMessage(
        'ChopLife Security Notice: Your 4-Digit Handover Verification PIN is [PIN]. Please present this PIN to the rider upon arrival to release your order! 🔐'
      );
    } else if (type === 'gate') {
      setComposeMessage(
        'ChopLife Express: Your dispatch rider has arrived at your estate security gate. Kindly authorize entrance or meet at the gate for package handover! 🚪'
      );
    } else if (type === 'substitute') {
      setComposeMessage(
        'ChopLife Kitchen Notice: We are freshly grilling your chicken cuts right now. Would you like complimentary spicy pepper sauce with your order? Reply YES to confirm! 🍗'
      );
    }
  };

  // Trigger Paystack Webhook Simulation
  const handleSimulatePaystackWebhook = async () => {
    try {
      const res = await fetch('/api/notifications/webhook/paystack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'charge.success',
          data: {
            reference: `PSK-SIM-${Date.now()}`,
            amount: 850000,
            metadata: {
              orderNumber: notifications[0]?.orderNumber || 'CL-83921',
            },
          },
        }),
      });

      if (res.ok) {
        showToast('Simulated Paystack charge.success webhook processed! Triggered multi-channel alerts.', 'success');
        setTimeout(() => {
          fetchNotifications();
          fetchStats();
        }, 600);
      }
    } catch {
      showToast('Failed to trigger webhook simulation.', 'error');
    }
  };

  // Filtered Notifications
  const filteredNotifs = notifications.filter((n) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.customerName.toLowerCase().includes(q) ||
      n.customerPhone.includes(q) ||
      (n.orderNumber && n.orderNumber.toLowerCase().includes(q)) ||
      n.message.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6" id="notification-hub-root">
      {/* Top Banner & KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#FAF7F2] p-4 rounded-3xl border border-[#E5DEC9] shadow-xs flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-gray-500 font-montserrat uppercase font-semibold block truncate">Total Sent</span>
            <p className="font-titan text-2xl text-[#241311] truncate">{stats?.totalSent || notifications.length}</p>
            <p className="text-[10px] text-emerald-600 font-bold truncate">
              {stats?.totalSent && stats.totalSent > 0 ? `${stats.deliveryRate} Delivery Rate` : 'No Dispatches Yet'}
            </p>
          </div>
        </div>

        <div className="bg-[#FAF7F2] p-4 rounded-3xl border border-[#E5DEC9] shadow-xs flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700 shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-gray-500 font-montserrat uppercase font-semibold block truncate">SMS (Termii DND)</span>
            <p className="font-titan text-2xl text-[#241311] truncate">{stats?.smsCount || 0}</p>
            <p className="text-[10px] text-gray-500 truncate">₦4.50 / Nigerian SMS</p>
          </div>
        </div>

        <div className="bg-[#FAF7F2] p-4 rounded-3xl border border-[#E5DEC9] shadow-xs flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-gray-500 font-montserrat uppercase font-semibold block truncate">WhatsApp Cloud API</span>
            <p className="font-titan text-2xl text-[#241311] truncate">{stats?.whatsappCount || 0}</p>
            <p className="text-[10px] text-emerald-600 font-bold truncate">Rich Templates & PINs</p>
          </div>
        </div>

        <div className="bg-[#FAF7F2] p-4 rounded-3xl border border-[#E5DEC9] shadow-xs flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-gray-500 font-montserrat uppercase font-semibold block truncate">Gateway Spend</span>
            <p className="font-titan text-2xl text-[#E62E00] truncate">
              ₦{Number(stats?.totalCostNaira || 0).toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-500 truncate">Prepaid Credits Active</p>
          </div>
        </div>
      </div>

      {/* Main Tab Controller & Search */}
      <div className="bg-white rounded-3xl border border-[#E5DEC9] shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#E5DEC9] pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('stream')}
              className={`px-3.5 py-2 rounded-xl text-xs font-titan transition-all flex items-center gap-2 ${
                activeTab === 'stream'
                  ? 'bg-[#4D080F] text-[#FFC700] shadow-sm'
                  : 'bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#241311]'
              }`}
            >
              <Radio className="w-4 h-4 shrink-0" /> Real-time Audit Stream
            </button>
            <button
              onClick={() => setActiveTab('composer')}
              className={`px-3.5 py-2 rounded-xl text-xs font-titan transition-all flex items-center gap-2 ${
                activeTab === 'composer'
                  ? 'bg-[#4D080F] text-[#FFC700] shadow-sm'
                  : 'bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#241311]'
              }`}
            >
              <Send className="w-4 h-4 shrink-0" /> Compose Custom Alert
            </button>
            <button
              onClick={() => setActiveTab('gateways')}
              className={`px-3.5 py-2 rounded-xl text-xs font-titan transition-all flex items-center gap-2 ${
                activeTab === 'gateways'
                  ? 'bg-[#4D080F] text-[#FFC700] shadow-sm'
                  : 'bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#241311]'
              }`}
            >
              <Zap className="w-4 h-4 shrink-0" /> Telemetry & Webhooks
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchNotifications}
              disabled={isLoading}
              className="p-2 bg-[#FAF7F2] hover:bg-[#F2ECE1] border border-[#E5DEC9] rounded-xl text-gray-700 text-xs font-montserrat flex items-center gap-1.5 transition-all"
              title="Refresh notification stream"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleSimulatePaystackWebhook}
              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-titan flex items-center gap-1.5 shadow-xs transition-all"
              title="Simulate incoming Paystack payment webhook"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-200 shrink-0" /> Paystack Webhook Test
            </button>
          </div>
        </div>

        {/* TAB 1: REAL-TIME AUDIT STREAM */}
        {activeTab === 'stream' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by customer name, phone, order # or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-montserrat focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                />
              </div>

              {/* Channel Filter */}
              <div className="flex items-center gap-1 bg-[#FAF7F2] p-1 rounded-2xl border border-[#E5DEC9]">
                {(['all', 'sms', 'whatsapp'] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setSelectedChannel(ch)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-semibold capitalize transition-all ${
                      selectedChannel === ch
                        ? 'bg-[#4D080F] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>

              {/* Event Type Filter */}
              <select
                value={selectedEventType}
                onChange={(e) => setSelectedEventType(e.target.value)}
                className="px-3 py-2 rounded-2xl bg-[#FAF7F2] border border-[#E5DEC9] text-xs font-montserrat text-gray-700 focus:outline-none"
              >
                <option value="all">All Events</option>
                <option value="ORDER_CONFIRMATION">Order Confirmation</option>
                <option value="KITCHEN_PREPARING">Kitchen Preparing</option>
                <option value="DISPATCH_EN_ROUTE">Dispatch & PIN</option>
                <option value="DELIVERY_COMPLETED">Delivery Handover</option>
                <option value="MANUAL_ALERT">Manual Staff Alert</option>
                <option value="PAYMENT_RECEIVED">Payment Confirmation</option>
              </select>
            </div>

            {/* Split Stream: Notification List + Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
              {/* List */}
              <div className="lg:col-span-7 space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                {filteredNotifs.length === 0 ? (
                  <div className="text-center py-12 bg-[#FAF7F2] rounded-3xl border border-dashed border-[#E5DEC9] space-y-2">
                    <Bell className="w-8 h-8 text-gray-400 mx-auto" />
                    <p className="font-titan text-sm text-[#241311]">No notifications found</p>
                    <p className="text-xs text-gray-500 font-montserrat">
                      Notifications fire automatically when orders are placed, cooked, or assigned to riders.
                    </p>
                  </div>
                ) : (
                  filteredNotifs.map((notif) => {
                    const isSelected = inspectedNotif?.id === notif.id;
                    return (
                      <div
                        key={notif.id}
                        onClick={() => setInspectedNotif(notif)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                          isSelected
                            ? 'bg-[#FFF8E7] border-[#FFC700] shadow-sm ring-1 ring-[#FFC700]'
                            : 'bg-[#FAF7F2] hover:bg-[#F5EFE6] border-[#E5DEC9]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                                notif.channel === 'whatsapp'
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                  : 'bg-blue-100 text-blue-700 border border-blue-300'
                              }`}
                            >
                              {notif.channel === 'whatsapp' ? (
                                <MessageSquare className="w-3.5 h-3.5" />
                              ) : (
                                <Smartphone className="w-3.5 h-3.5" />
                              )}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-xs text-[#241311]">
                                  {notif.customerName}
                                </h4>
                                {notif.orderNumber && (
                                  <span className="px-2 py-0.5 bg-white border border-[#E5DEC9] rounded-md font-mono text-[10px] text-gray-600">
                                    #{notif.orderNumber}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-gray-500 font-montserrat">
                                {notif.recipient}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Delivered
                            </span>
                            <p className="text-[10px] text-gray-400 font-montserrat mt-0.5">
                              {new Date(notif.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Preview Snippet */}
                        <p className="text-xs text-gray-700 font-montserrat line-clamp-2 bg-white/70 p-2 rounded-xl border border-gray-100">
                          {notif.message}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Inspector Card */}
              <div className="lg:col-span-5 bg-[#FAF7F2] rounded-3xl border border-[#E5DEC9] p-5 space-y-4 flex flex-col justify-between">
                {inspectedNotif ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-montserrat font-bold text-gray-400">
                          Delivery Receipt
                        </span>
                        <h3 className="font-titan text-base text-[#4D080F] flex items-center gap-2">
                          {inspectedNotif.channel === 'whatsapp' ? 'WhatsApp Business Cloud' : 'Termii Direct Route'}
                        </h3>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-[10px] font-titan uppercase tracking-wide flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Handset Ack
                      </span>
                    </div>

                    {/* Metadata Pill Box */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-montserrat">
                      <div className="bg-white p-2.5 rounded-xl border border-[#E5DEC9]">
                        <span className="text-[10px] text-gray-400 uppercase">Event Trigger</span>
                        <p className="font-bold text-[#241311] truncate">{inspectedNotif.eventType}</p>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-[#E5DEC9]">
                        <span className="text-[10px] text-gray-400 uppercase">Gateway Fee</span>
                        <p className="font-bold text-[#E62E00]">₦{inspectedNotif.costNaira.toFixed(2)}</p>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-[#E5DEC9]">
                        <span className="text-[10px] text-gray-400 uppercase">Order Ref</span>
                        <p className="font-mono text-[#241311]">{inspectedNotif.orderNumber || 'Direct Alert'}</p>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-[#E5DEC9]">
                        <span className="text-[10px] text-gray-400 uppercase">Branch</span>
                        <p className="font-bold text-[#241311] uppercase">{inspectedNotif.branchId || 'GRA'}</p>
                      </div>
                    </div>

                    {/* Phone Mockup / Message Bubble */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-titan text-[#4D080F] uppercase">Rendered Customer Payload:</span>
                      <div
                        className={`p-4 rounded-2xl border text-xs font-sans leading-relaxed whitespace-pre-wrap shadow-inner ${
                          inspectedNotif.channel === 'whatsapp'
                            ? 'bg-[#E7F8E8] border-[#A8E5B2] text-gray-900 font-medium'
                            : 'bg-white border-blue-200 text-gray-800'
                        }`}
                      >
                        {inspectedNotif.message}
                      </div>
                    </div>

                    {/* Handover PIN Spotlight if present */}
                    {inspectedNotif.metadata?.handoverPin && (
                      <div className="bg-amber-50 p-3 rounded-2xl border border-amber-300 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-amber-800 font-bold uppercase">Customer Handover PIN</p>
                          <p className="font-mono font-black text-lg text-amber-950">
                            {inspectedNotif.metadata.handoverPin}
                          </p>
                        </div>
                        <ShieldCheck className="w-6 h-6 text-amber-600" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-16 text-gray-400">
                    <Info className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="font-titan text-sm">Select a notification to view gateway telemetry</p>
                  </div>
                )}

                {/* Bottom Actions */}
                {inspectedNotif && (
                  <div className="pt-3 border-t border-[#E5DEC9] flex items-center gap-2">
                    <button
                      onClick={() => handleResend(inspectedNotif.id)}
                      className="flex-1 py-2.5 bg-[#4D080F] hover:bg-[#38060b] text-[#FFC700] rounded-xl text-xs font-titan uppercase tracking-wide flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Resend via Gateway
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MANUAL COMPOSER & TEMPLATES */}
        {activeTab === 'composer' && (
          <form onSubmit={handleSendCustomNotification} className="space-y-5 max-w-2xl mx-auto py-2">
            <div className="bg-[#FAF7F2] p-5 rounded-3xl border border-[#E5DEC9] space-y-4">
              <div className="border-b border-[#E5DEC9] pb-3">
                <h3 className="font-titan text-base text-[#4D080F]">Compose Customer Notification</h3>
                <p className="text-xs text-gray-500 font-montserrat">
                  Send real-time SMS or WhatsApp alerts directly to customer handsets for transit updates or order queries.
                </p>
              </div>

              {/* Quick Template Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-titan uppercase text-[#4D080F]">Quick Smart Templates:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyTemplate('delay')}
                    className="px-2.5 py-1.5 bg-white hover:bg-amber-50 text-[#241311] border border-[#E5DEC9] rounded-xl text-xs font-montserrat flex items-center gap-1.5 transition-all"
                  >
                    🌧️ Rain/Traffic Delay
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('pin')}
                    className="px-2.5 py-1.5 bg-white hover:bg-amber-50 text-[#241311] border border-[#E5DEC9] rounded-xl text-xs font-montserrat flex items-center gap-1.5 transition-all"
                  >
                    🔐 Resend Handover PIN
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('gate')}
                    className="px-2.5 py-1.5 bg-white hover:bg-amber-50 text-[#241311] border border-[#E5DEC9] rounded-xl text-xs font-montserrat flex items-center gap-1.5 transition-all"
                  >
                    🚪 Security Gate Pass
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('substitute')}
                    className="px-2.5 py-1.5 bg-white hover:bg-amber-50 text-[#241311] border border-[#E5DEC9] rounded-xl text-xs font-montserrat flex items-center gap-1.5 transition-all"
                  >
                    🍗 Side/Option Suggestion
                  </button>
                </div>
              </div>

              {/* Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-montserrat font-bold text-gray-700 mb-1">
                    Customer Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 08034567890"
                    value={composePhone}
                    onChange={(e) => setComposePhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[#E5DEC9] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-montserrat font-bold text-gray-700 mb-1">
                    Customer Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Osagie Alonge"
                    value={composeCustomerName}
                    onChange={(e) => setComposeCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[#E5DEC9] text-xs font-montserrat focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-montserrat font-bold text-gray-700 mb-1">
                    Associated Order # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CL-83921"
                    value={composeOrderNumber}
                    onChange={(e) => setComposeOrderNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[#E5DEC9] text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-montserrat font-bold text-gray-700 mb-1">
                    Dispatch Channel
                  </label>
                  <select
                    value={composeChannel}
                    onChange={(e) => setComposeChannel(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[#E5DEC9] text-xs font-montserrat font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                  >
                    <option value="sms">SMS (Termii DND Direct)</option>
                    <option value="whatsapp">WhatsApp (Meta Cloud API)</option>
                    <option value="both">Both (SMS + WhatsApp)</option>
                  </select>
                </div>
              </div>

              {/* Message Box */}
              <div>
                <label className="block text-xs font-montserrat font-bold text-gray-700 mb-1">
                  Message Content *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Type custom customer notification message..."
                  value={composeMessage}
                  onChange={(e) => setComposeMessage(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-white border border-[#E5DEC9] text-xs font-montserrat leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                />
                <div className="flex justify-between items-center text-[10px] text-gray-400 mt-1">
                  <span>Characters: {composeMessage.length} (Estimated SMS credits: {Math.ceil((composeMessage.length || 1) / 160)})</span>
                  <span>Sender ID: CHOPLIFE (Approved)</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setComposeMessage('')}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold font-montserrat"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-6 py-2.5 rounded-xl bg-[#E62E00] hover:bg-[#c92800] text-white text-xs font-titan uppercase tracking-wide flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-[#FFC700]" />
                  {isSending ? 'Dispatching...' : 'Dispatch Notification'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 3: TELEMETRY & GATEWAYS */}
        {activeTab === 'gateways' && (
          <div className="space-y-6">
            {/* 1. Mode Switcher & Diagnostic Header */}
            <div className="bg-[#FAF7F2] p-5 rounded-3xl border border-[#E5DEC9] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5DEC9] pb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-titan text-lg ${
                    gatewayForm.liveGatewayMode
                      ? 'bg-red-100 text-[#E62E00] border border-red-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    {gatewayForm.liveGatewayMode ? <Activity className="w-6 h-6 animate-pulse" /> : <ShieldCheck className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-titan text-base text-[#241311]">
                        {gatewayForm.liveGatewayMode
                          ? 'Live Production Gateway Mode'
                          : 'High-Fidelity Sandbox Gateway Mode'}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-titan uppercase ${
                        gatewayForm.liveGatewayMode
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                        {gatewayForm.liveGatewayMode ? 'LIVE REAL HTTP' : 'SAFE SANDBOX'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-montserrat">
                      {gatewayForm.liveGatewayMode
                        ? 'Outgoing notifications trigger live HTTP calls to api.ng.termii.com & graph.facebook.com.'
                        : 'Simulates direct telecommunication delivery with zero SMS unit deductions and instant DLR feedback.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setGatewayForm((prev: any) => ({
                        ...prev,
                        liveGatewayMode: !prev.liveGatewayMode,
                      }))
                    }
                    className={`px-4 py-2 rounded-2xl text-xs font-titan uppercase tracking-wide flex items-center gap-2 transition-all shadow-xs ${
                      gatewayForm.liveGatewayMode
                        ? 'bg-[#E62E00] hover:bg-[#c92800] text-white'
                        : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    }`}
                  >
                    {gatewayForm.liveGatewayMode ? (
                      <>
                        <ToggleRight className="w-4 h-4" />
                        <span>Switch to Safe Sandbox</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-4 h-4" />
                        <span>Enable Live HTTP Mode</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Diagnostic Ping Runner */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-xs font-montserrat font-bold text-gray-700 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-[#E62E00]" />
                  Active Health Diagnostics:
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestPing('termii')}
                    disabled={pingResults.testing === 'termii'}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 text-xs font-titan flex items-center gap-1.5 transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${pingResults.testing === 'termii' ? 'animate-spin' : ''}`} />
                    <span>Ping Termii SMS</span>
                    {pingResults.termii && (
                      <span className="px-1.5 py-0.2 rounded-md bg-blue-200 text-blue-800 font-mono text-[10px]">
                        {pingResults.termii.latencyMs}ms
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTestPing('whatsapp')}
                    disabled={pingResults.testing === 'whatsapp'}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-titan flex items-center gap-1.5 transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${pingResults.testing === 'whatsapp' ? 'animate-spin' : ''}`} />
                    <span>Ping WhatsApp Cloud</span>
                    {pingResults.whatsapp && (
                      <span className="px-1.5 py-0.2 rounded-md bg-emerald-200 text-emerald-800 font-mono text-[10px]">
                        {pingResults.whatsapp.latencyMs}ms
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Credentials & Parameters Configuration Form */}
            <form onSubmit={handleSaveGatewayConfig} className="bg-[#FAF7F2] p-5 rounded-3xl border border-[#E5DEC9] space-y-5">
              <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-[#4D080F]" />
                  <h4 className="font-titan text-base text-[#241311]">Gateway Credentials & Routing Rules</h4>
                </div>
                <button
                  type="submit"
                  disabled={isSavingGateway}
                  className="px-4 py-2 rounded-xl bg-[#4D080F] hover:bg-[#38050a] text-[#FFC700] text-xs font-titan uppercase tracking-wide flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isSavingGateway ? 'Saving Changes...' : 'Save Settings'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Termii Credentials */}
                <div className="space-y-3 bg-white p-4 rounded-2xl border border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="font-titan text-xs text-[#241311] flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold">T</div>
                      Termii SMS (Nigeria DND Direct)
                    </span>
                    {gatewayData?.config?.hasTermiiApiKey && (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        API Key Stored
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-montserrat font-bold text-gray-700 mb-1">
                      Termii API Key (Secret)
                    </label>
                    <input
                      type="password"
                      value={gatewayForm.termiiApiKey}
                      onChange={(e) => setGatewayForm({ ...gatewayForm, termiiApiKey: e.target.value })}
                      placeholder={gatewayData?.config?.termiiApiKeyMasked || 'Leave blank to keep existing key'}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Obtain from termii.com/dashboard/settings/api</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-montserrat font-bold text-gray-700 mb-1">
                        Approved Sender ID
                      </label>
                      <input
                        type="text"
                        value={gatewayForm.termiiSenderId}
                        onChange={(e) => setGatewayForm({ ...gatewayForm, termiiSenderId: e.target.value })}
                        placeholder="CHOPLIFE"
                        maxLength={11}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono uppercase font-bold focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-montserrat font-bold text-gray-700 mb-1">
                        Channel Route
                      </label>
                      <select
                        value={gatewayForm.termiiChannel}
                        onChange={(e) => setGatewayForm({ ...gatewayForm, termiiChannel: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-montserrat font-bold focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                      >
                        <option value="generic">Generic (DND bypass)</option>
                        <option value="dnd">DND Direct Priority</option>
                        <option value="whatsapp">WhatsApp Channel</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Cloud Credentials */}
                <div className="space-y-3 bg-white p-4 rounded-2xl border border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="font-titan text-xs text-[#241311] flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold">W</div>
                      Meta WhatsApp Cloud API
                    </span>
                    {gatewayData?.config?.hasWhatsappToken && (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Token Stored
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-montserrat font-bold text-gray-700 mb-1">
                      System User Permanent Token
                    </label>
                    <input
                      type="password"
                      value={gatewayForm.whatsappToken}
                      onChange={(e) => setGatewayForm({ ...gatewayForm, whatsappToken: e.target.value })}
                      placeholder={gatewayData?.config?.whatsappTokenMasked || 'Leave blank to keep existing token'}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">From Meta Business Manager System User</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-montserrat font-bold text-gray-700 mb-1">
                        Phone Number ID
                      </label>
                      <input
                        type="text"
                        value={gatewayForm.whatsappPhoneId}
                        onChange={(e) => setGatewayForm({ ...gatewayForm, whatsappPhoneId: e.target.value })}
                        placeholder="e.g. 104829104859"
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-montserrat font-bold text-gray-700 mb-1">
                        WABA Account ID
                      </label>
                      <input
                        type="text"
                        value={gatewayForm.whatsappWabaId}
                        onChange={(e) => setGatewayForm({ ...gatewayForm, whatsappWabaId: e.target.value })}
                        placeholder="e.g. 29384910284"
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Automated Event Trigger Toggles */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-titan text-xs text-[#241311]">Automated Life-Cycle Notification Triggers</h5>
                    <p className="text-[11px] text-gray-500 font-montserrat">
                      Enable or disable automated dispatch when order status updates across Benin City branches
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-montserrat font-bold text-gray-700">Default Channel:</span>
                    <select
                      value={gatewayForm.defaultChannel}
                      onChange={(e) => setGatewayForm({ ...gatewayForm, defaultChannel: e.target.value })}
                      className="px-3 py-1 rounded-xl border border-gray-300 text-xs font-montserrat font-bold text-[#4D080F]"
                    >
                      <option value="both">Both (SMS + WhatsApp)</option>
                      <option value="sms">SMS Only</option>
                      <option value="whatsapp">WhatsApp Only</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
                  {[
                    { key: 'orderConfirmation', label: 'Order Confirmed' },
                    { key: 'kitchenPreparing', label: 'Kitchen Preparing' },
                    { key: 'orderReady', label: 'Order Ready' },
                    { key: 'dispatchEnRoute', label: 'Rider En Route' },
                    { key: 'deliveryCompleted', label: 'Delivered' },
                    { key: 'posReceipt', label: 'POS e-Receipt' },
                  ].map((trigger) => (
                    <label
                      key={trigger.key}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-montserrat cursor-pointer transition-all ${
                        gatewayForm.autoAlerts?.[trigger.key]
                          ? 'bg-[#4D080F]/5 border-[#4D080F]/30 text-[#4D080F] font-bold'
                          : 'bg-gray-50 border-gray-200 text-gray-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={gatewayForm.autoAlerts?.[trigger.key] ?? true}
                        onChange={(e) =>
                          setGatewayForm({
                            ...gatewayForm,
                            autoAlerts: {
                              ...gatewayForm.autoAlerts,
                              [trigger.key]: e.target.checked,
                            },
                          })
                        }
                        className="rounded text-[#4D080F] focus:ring-[#FFC700]"
                      />
                      <span className="truncate">{trigger.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </form>

            {/* 3. Inbound WhatsApp Interactive Chatbot Simulator */}
            <div className="bg-[#FAF7F2] p-5 rounded-3xl border border-[#E5DEC9] space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-titan text-base text-[#241311]">WhatsApp Inbound Conversational Bot Tester</h4>
                    <p className="text-xs text-gray-500 font-montserrat">
                      Simulate incoming customer WhatsApp queries to test automatic tracking links & OTP handovers
                    </p>
                  </div>
                </div>

                {/* Quick chip queries */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs">
                  <span className="text-gray-400 font-montserrat text-[11px]">Quick Tests:</span>
                  {['STATUS CL-83921', 'PIN', 'MENU', 'HELP'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setInboundSimText(chip)}
                      className="px-2 py-0.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-[11px] font-mono text-gray-700"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Simulator Inputs */}
                <div className="space-y-3 bg-white p-4 rounded-2xl border border-gray-200">
                  <div>
                    <label className="block text-[11px] font-montserrat font-bold text-gray-700 mb-1">
                      Customer Phone Number (e.g. +234...)
                    </label>
                    <input
                      type="tel"
                      value={inboundSimPhone}
                      onChange={(e) => setInboundSimPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-montserrat font-bold text-gray-700 mb-1">
                      Incoming Message Body
                    </label>
                    <input
                      type="text"
                      value={inboundSimText}
                      onChange={(e) => setInboundSimText(e.target.value)}
                      placeholder="e.g. STATUS CL-83921, PIN, MENU, or HELP"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-montserrat font-bold focus:outline-none focus:ring-2 focus:ring-[#FFC700]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSimulateInboundBot}
                    disabled={isTestingBot || !inboundSimText.trim()}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-titan uppercase tracking-wide flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isTestingBot ? 'Processing Bot Response...' : 'Simulate Customer Message'}
                  </button>
                </div>

                {/* Simulated WhatsApp Reply Bubble */}
                <div className="bg-[#EFEAE2] p-4 rounded-2xl border border-[#D1D7DB] flex flex-col justify-between min-h-[160px]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-gray-600 border-b border-gray-300 pb-1">
                      <span className="font-bold flex items-center gap-1 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" /> ChopLife Official Verified Bot
                      </span>
                      <span className="font-mono text-[10px]">Meta Webhook Preview</span>
                    </div>

                    {inboundBotResponse ? (
                      <div className="bg-white p-3 rounded-2xl rounded-tl-xs shadow-xs border border-gray-200 text-xs text-[#241311] whitespace-pre-wrap font-sans leading-relaxed animate-in fade-in">
                        {inboundBotResponse.reply}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-gray-500 italic">
                        Send a simulation message above (or click a quick test chip) to view real-time automated bot response.
                      </div>
                    )}
                  </div>

                  {inboundBotResponse && (
                    <div className="flex justify-between items-center text-[10px] text-gray-500 pt-2 border-t border-gray-300">
                      <span>Intent: <strong>{inboundBotResponse.matchedIntent || 'GENERAL'}</strong></span>
                      <span>Dispatch: <strong>{inboundBotResponse.dispatchResult?.mode || 'High-Fidelity Sandbox'}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Production Webhook Callback Endpoints Display */}
            <div className="bg-[#FAF7F2] p-5 rounded-3xl border border-[#E5DEC9] space-y-4">
              <div className="flex items-center gap-2 border-b border-[#E5DEC9] pb-3">
                <Zap className="w-5 h-5 text-amber-600" />
                <h4 className="font-titan text-base text-[#241311]">Production Webhook & Callback Endpoints</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-montserrat">
                {/* WhatsApp Webhook Info */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#241311]">Meta WhatsApp Callback URL</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `${window.location.origin}/api/notifications/webhook/whatsapp`,
                          'WhatsApp Webhook URL'
                        )
                      }
                      className="text-[#4D080F] hover:underline font-bold flex items-center gap-1 text-[11px]"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedKey === 'WhatsApp Webhook URL' ? 'Copied!' : 'Copy URL'}
                    </button>
                  </div>
                  <code className="block bg-gray-50 p-2 rounded-xl text-gray-700 font-mono text-[11px] truncate">
                    {window.location.origin}/api/notifications/webhook/whatsapp
                  </code>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-gray-500">Verify Token (hub.verify_token):</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {gatewayForm.webhookSecret}
                    </span>
                  </div>
                </div>

                {/* Termii DLR Info */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#241311]">Termii DLR Webhook Callback</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `${window.location.origin}/api/notifications/webhook/termii`,
                          'Termii DLR URL'
                        )
                      }
                      className="text-[#4D080F] hover:underline font-bold flex items-center gap-1 text-[11px]"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedKey === 'Termii DLR URL' ? 'Copied!' : 'Copy URL'}
                    </button>
                  </div>
                  <code className="block bg-gray-50 p-2 rounded-xl text-gray-700 font-mono text-[11px] truncate">
                    {window.location.origin}/api/notifications/webhook/termii
                  </code>
                  <p className="text-[10px] text-gray-400">
                    Paste in Termii Settings &gt; Webhooks &gt; Delivery Reports.
                  </p>
                </div>
              </div>

              {/* Paystack Webhook Simulation */}
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h5 className="font-titan text-xs text-amber-950">Paystack Automated Webhook Engine</h5>
                  <p className="text-[11px] text-amber-900 font-montserrat">
                    Webhook route <code>/api/notifications/webhook/paystack</code> processes <code>charge.success</code> and auto-orchestrates notifications.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSimulatePaystackWebhook}
                  className="px-4 py-2 bg-[#4D080F] hover:bg-[#38060b] text-[#FFC700] rounded-xl text-xs font-titan uppercase tracking-wide transition-all shadow-xs shrink-0"
                >
                  Fire Paystack Test
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
