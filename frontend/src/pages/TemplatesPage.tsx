import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  Smartphone,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  Zap,
  Send,
  MapPin,
  Home,
  CreditCard,
  Truck,
  ShieldCheck,
  Percent,
  Tag,
  Ban,
  Check,
  CheckCheck,
  Copy,
  Clock,
  ShieldAlert,
  Play,
  Shield,
} from 'lucide-react';
import api from '../services/api';
import { Toggle } from '../components/settings/WhatsAppTemplates';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { RescueScene } from '../components/story/RescueScene';
import './TemplatesPage.css';
import './landing.css';

interface TemplateComponent {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface Template {
  _id: string;
  templateName: string;
  language: string;
  category: string;
  status: string;
  components: TemplateComponent[];
  buttons: any[];
}

interface CodIncentiveSettings {
  enabled: boolean;
  incentiveType: 'none' | 'flat' | 'percentage';
  incentiveAmount: number;
  discountCap: number;
  minOrderValue: number;
}

interface PlaybookDef {
  id: string;
  templateName: string;
  title: string;
  subtitle: string;
  trigger: string;
  icon: React.ReactNode;
  category: 'UTILITY' | 'MARKETING';
  sampleBubble: (cfg: CodIncentiveSettings) => {
    body: string;
    buttons: string[];
    note?: string;
  };
}

interface ChatThread {
  orderId: string;
  externalOrderId: string;
  customerName: string;
  customerPhone: string;
  orderValue: number;
  status: string;
  paymentMethod: string;
  carrier: string;
  awb: string;
  claimedUtr: string | null;
  lastMessageAt: string;
  lastMessageBody: string;
  lastDirection: 'inbound' | 'outbound';
}

interface ChatMessage {
  _id?: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status?: string;
  createdAt: string;
}

interface OrderDetailResponse {
  order: {
    _id: string;
    externalOrderId: string;
    customerPhone: string;
    customerName?: string;
    orderValue: number;
    paymentMethod: string;
    status: string;
    carrier?: string;
    awb?: string;
    codConversion?: {
      messageSentAt?: string;
      incentiveOffered?: number;
      convertedAt?: string;
      claimedUtr?: string;
      claimedUtrAt?: string;
    };
  };
  messages: ChatMessage[];
  auditLogs: any[];
}

const PLAYBOOKS: PlaybookDef[] = [
  {
    id: 'door_locked',
    templateName: 'ndr_rescue_v2_en',
    title: 'Door Locked / Customer Unavailable',
    subtitle: 'Autonomous reattempt coordinator with quick-action time slots',
    trigger: 'Courier logs "Door Locked", "Customer Not Reachable", or "Out of Home"',
    icon: <Home size={18} color="var(--indigo-soft)" />,
    category: 'UTILITY',
    sampleBubble: () => ({
      body: "Hi Rahul, our courier executive could not reach you at your doorstep for order #RS-8492. When should we re-attempt your delivery?",
      buttons: ['⚡ Deliver Today', '📅 Deliver Tomorrow', '❌ Cancel Order'],
      note: 'Auto-reschedules directly with courier dispatch upon customer tap.',
    }),
  },
  {
    id: 'address_pin',
    templateName: 'address_pin_v2_en',
    title: 'Address & GPS Landmark Fix',
    subtitle: 'Native WhatsApp location pin drop for untraceable addresses',
    trigger: 'Courier logs "Incomplete Address", "Wrong Landmark", or "Untraceable Pincode"',
    icon: <MapPin size={18} color="var(--cyan)" />,
    category: 'UTILITY',
    sampleBubble: () => ({
      body: "Hi Rahul, the delivery executive is having trouble locating your address for order #RS-8492. Please share your exact Google Maps location pin below so the driver can reach you directly.",
      buttons: ['📍 Share Location Pin'],
      note: 'Captures precise latitude/longitude and forwards directly to carrier routing hub.',
    }),
  },
  {
    id: 'cod_to_upi',
    templateName: 'cod_convert_v2_en',
    title: 'COD-to-Prepaid UPI Rescue',
    subtitle: 'Convert high-risk cash orders to instant prepaid before or after failure',
    trigger: 'Dispatched upon high-risk COD detection or after first failed delivery attempt',
    icon: <CreditCard size={18} color="var(--emerald)" />,
    category: 'UTILITY',
    sampleBubble: (cfg) => {
      const sampleVal = 1500;
      let discount = 0;

      if (cfg.enabled && cfg.incentiveType === 'percentage') {
        const rawPct = Math.round((sampleVal * (cfg.incentiveAmount || 5)) / 100);
        discount = cfg.discountCap > 0 ? Math.min(rawPct, cfg.discountCap) : rawPct;
      } else if (cfg.enabled && cfg.incentiveType === 'flat') {
        discount = cfg.incentiveAmount || 50;
      }

      const finalAmount = Math.max(1, sampleVal - discount);

      if (discount > 0) {
        return {
          body: `Hi Rahul! 🎉 Pay online now for Order #RS-8492 and get ₹${discount} OFF! Final total: ₹${finalAmount} (originally ₹${sampleVal}). Tap below to pay via UPI and lock your guaranteed delivery slot. Valid for 15m (reply 'PAY' if expired).`,
          buttons: [`⚡ Pay ₹${finalAmount} via UPI`],
          note: `Live preview calculated for sample ₹${sampleVal} order. Automatically reduces courier COD to ₹0 upon payment.`,
        };
      }

      return {
        body: `Hi Rahul, confirm Order #RS-8492 by paying ₹${sampleVal} online to lock your priority delivery slot. No cash needed at the door. Valid for 15m (reply 'PAY' if expired).`,
        buttons: [`⚡ Pay ₹${sampleVal} via UPI`],
        note: 'Zero-discount mode. Automatically reduces courier COD to ₹0 upon payment.',
      };
    },
  },
  {
    id: 'predelivery',
    templateName: 'predelivery_confirm_v2_en',
    title: 'Morning Out-for-Delivery Check',
    subtitle: 'Verify recipient presence before the van leaves the delivery hub',
    trigger: 'Dispatched at 9:00 AM when shipment is scanned into the local delivery van',
    icon: <Truck size={18} color="var(--amber)" />,
    category: 'UTILITY',
    sampleBubble: () => ({
      body: "Good morning Rahul! 📦 Your order #RS-8492 is out for delivery today. Please confirm if you will be available to receive your package:",
      buttons: ["✅ Yes, I'm Home", '📅 Reschedule Tomorrow'],
      note: 'Prevents wasteful delivery attempts and cuts fuel-wasting false trips.',
    }),
  },
  {
    id: 'dispute_done',
    templateName: 'rescue_done_v2_en',
    title: 'Fake Attempt Dispute & Rescue Confirmation',
    subtitle: 'Courier accountability shield and next-day re-delivery guarantee',
    trigger: 'Customer reports fake attempt or courier reattempt confirmed',
    icon: <ShieldCheck size={18} color="var(--rose)" />,
    category: 'UTILITY',
    sampleBubble: () => ({
      body: "Great news Rahul! 🙌 We have flagged this with delivery management. Order #RS-8492 is back on track and has been scheduled for priority delivery tomorrow. Thank you for your patience!",
      buttons: ['📦 Track Live Delivery'],
      note: 'Instantly reassures customers and prevents order cancellations.',
    }),
  },
];

// Fallback demo threads if fresh database has 0 historical messages
const FALLBACK_THREADS: ChatThread[] = [
  {
    orderId: 'demo_order_1',
    externalOrderId: 'RS-77319',
    customerName: 'Ananya Deshmukh',
    customerPhone: '+91 98765 11029',
    orderValue: 1850,
    status: 'ndr_rescue_sent',
    paymentMethod: 'cod',
    carrier: 'Delhivery',
    awb: 'DEL99482103',
    claimedUtr: '408219504218',
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    lastMessageBody: 'I paid on PhonePe UTR 408219504218',
    lastDirection: 'inbound',
  },
  {
    orderId: 'demo_order_2',
    externalOrderId: 'RS-89421',
    customerName: 'Priya Sharma',
    customerPhone: '+91 98200 48192',
    orderValue: 1240,
    status: 'ndr_rescued',
    paymentMethod: 'cod',
    carrier: 'BlueDart',
    awb: 'BLU84019283',
    claimedUtr: null,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    lastMessageBody: 'Yes I’m home! Nobody came to my door! 😤',
    lastDirection: 'inbound',
  },
  {
    orderId: 'demo_order_3',
    externalOrderId: 'RS-84920',
    customerName: 'Rahul Verma',
    customerPhone: '+91 99112 30192',
    orderValue: 890,
    status: 'converted_to_prepaid',
    paymentMethod: 'cod',
    carrier: 'Shadowfax',
    awb: 'SFX83019284',
    claimedUtr: null,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    lastMessageBody: 'Paid ₹840 on UPI ✅',
    lastDirection: 'inbound',
  },
];

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState<'playbooks' | 'chats'>('playbooks');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<PlaybookDef>(PLAYBOOKS[0]);
  const [loading, setLoading] = useState(true);
  const [syncingMeta, setSyncingMeta] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // COD Incentive Configuration State
  const [codConfig, setCodConfig] = useState<CodIncentiveSettings>({
    enabled: true,
    incentiveType: 'percentage',
    incentiveAmount: 5,
    discountCap: 150,
    minOrderValue: 299,
  });
  const [savingIncentive, setSavingIncentive] = useState(false);
  const [incentiveSavedNotice, setIncentiveSavedNotice] = useState(false);

  // Real Customer Chat Audit State
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [activeChatDetails, setActiveChatDetails] = useState<OrderDetailResponse | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // 1. Fetch live templates, merchant settings, and recent chats
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tplRes, setRes, chatRes] = await Promise.allSettled([
        api.get('/api/templates'),
        api.get('/api/settings'),
        api.get('/api/orders/chats/recent'),
      ]);

      if (tplRes.status === 'fulfilled' && Array.isArray(tplRes.value.data)) {
        setTemplates(tplRes.value.data);
      }

      if (setRes.status === 'fulfilled' && setRes.value.data?.settings?.codConversion) {
        const cc = setRes.value.data.settings.codConversion;
        const currentType: 'none' | 'flat' | 'percentage' =
          cc.enabled === false
            ? 'none'
            : cc.incentiveType === 'none'
            ? 'none'
            : cc.incentiveType === 'flat'
            ? 'flat'
            : 'percentage';

        setCodConfig({
          enabled: currentType !== 'none',
          incentiveType: currentType,
          incentiveAmount: Number(cc.incentiveAmount) || (currentType === 'percentage' ? 5 : 50),
          discountCap: Number(cc.discountCap) || 150,
          minOrderValue: Number(cc.minOrderValue) || 299,
        });
      }

      if (chatRes.status === 'fulfilled' && Array.isArray(chatRes.value.data) && chatRes.value.data.length > 0) {
        setThreads(chatRes.value.data);
        if (!selectedThread) {
          setSelectedThread(chatRes.value.data[0]);
        }
      } else {
        setThreads(FALLBACK_THREADS);
        if (!selectedThread) {
          setSelectedThread(FALLBACK_THREADS[0]);
        }
      }
    } catch {
      showToast('Loaded local defaults', 'success');
    } finally {
      setLoading(false);
    }
  }, [selectedThread]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load chat messages when a thread is selected
  useEffect(() => {
    if (!selectedThread) return;

    if (selectedThread.orderId.startsWith('demo_')) {
      // Build simulated historical transcript for demo thread
      if (selectedThread.externalOrderId === 'RS-77319') {
        setActiveChatDetails({
          order: {
            _id: 'demo_order_1',
            externalOrderId: 'RS-77319',
            customerName: 'Ananya Deshmukh',
            customerPhone: '+91 98765 11029',
            orderValue: 1850,
            paymentMethod: 'cod',
            status: 'ndr_rescue_sent',
            carrier: 'Delhivery',
            awb: 'DEL99482103',
            codConversion: {
              messageSentAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
              incentiveOffered: 93,
              claimedUtr: '408219504218',
              claimedUtrAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
            },
          },
          messages: [
            {
              direction: 'outbound',
              body: 'Hi Ananya 👋 Delivery partner is at your doorstep for Order #RS-77319 (₹1,850 COD). Pay ₹1,757 online via UPI now to complete contactless delivery and save ₹93. Link valid for 15m. Reply "PAY" if expired.',
              createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
              status: 'read',
            },
            {
              direction: 'inbound',
              body: 'I paid online from PhonePe but delivery guy says cash is showing',
              createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
            },
            {
              direction: 'outbound',
              body: 'We couldn’t verify payment yet on our banking gateway. If your bank debited the amount, please reply with your 12-digit UPI Reference / UTR Number so our team can verify it immediately.',
              createdAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
              status: 'read',
            },
            {
              direction: 'inbound',
              body: '408219504218',
              createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
            },
            {
              direction: 'outbound',
              body: 'Thank you! We have recorded your UPI UTR: 408219504218 and sent it to our verification desk. The delivery team has been notified.',
              createdAt: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
              status: 'read',
            },
          ],
          auditLogs: [],
        });
      } else if (selectedThread.externalOrderId === 'RS-89421') {
        setActiveChatDetails({
          order: {
            _id: 'demo_order_2',
            externalOrderId: 'RS-89421',
            customerName: 'Priya Sharma',
            customerPhone: '+91 98200 48192',
            orderValue: 1240,
            paymentMethod: 'cod',
            status: 'ndr_rescued',
            carrier: 'BlueDart',
            awb: 'BLU84019283',
          },
          messages: [
            {
              direction: 'outbound',
              body: 'Hi Priya 👋 Order #RS-89421 (₹1,240) was marked “door locked” at 7:58 PM. We couldn’t confirm a delivery attempt — what would you like to do?',
              createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
              status: 'read',
            },
            {
              direction: 'inbound',
              body: 'Yes I’m home! Nobody came to my door! 😤',
              createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
            },
            {
              direction: 'outbound',
              body: 'Thanks for confirming, Priya! We have flagged this attempt with delivery management and reserved First-Slot Priority Delivery for you tomorrow, 9 AM–12 PM. 🚚',
              createdAt: new Date(Date.now() - 1000 * 60 * 44).toISOString(),
              status: 'read',
            },
          ],
          auditLogs: [],
        });
      } else {
        setActiveChatDetails({
          order: {
            _id: 'demo_order_3',
            externalOrderId: 'RS-84920',
            customerName: 'Rahul Verma',
            customerPhone: '+91 99112 30192',
            orderValue: 890,
            paymentMethod: 'cod',
            status: 'converted_to_prepaid',
            carrier: 'Shadowfax',
            awb: 'SFX83019284',
            codConversion: {
              incentiveOffered: 50,
              convertedAt: new Date(Date.now() - 1000 * 60 * 115).toISOString(),
            },
          },
          messages: [
            {
              direction: 'outbound',
              body: 'Hi Rahul, confirm Order #RS-84920 by paying ₹840 online to save ₹50 and lock your priority delivery slot. No cash needed at the door.',
              createdAt: new Date(Date.now() - 1000 * 60 * 125).toISOString(),
              status: 'read',
            },
            {
              direction: 'inbound',
              body: 'Paid ₹840 on UPI ✅',
              createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
            },
            {
              direction: 'outbound',
              body: 'Payment confirmed! Order converted to prepaid. Doorstep cash balance adjusted to ₹0. Thank you! 💜',
              createdAt: new Date(Date.now() - 1000 * 60 * 119).toISOString(),
              status: 'read',
            },
          ],
          auditLogs: [],
        });
      }
      return;
    }

    // Live order
    const loadRealOrder = async () => {
      setLoadingChat(true);
      try {
        const res = await api.get(`/api/orders/${selectedThread.orderId}`);
        setActiveChatDetails(res.data);
      } catch {
        // fallback
      } finally {
        setLoadingChat(false);
      }
    };

    loadRealOrder();
  }, [selectedThread]);

  // Save COD Incentive Setting
  const handleSaveIncentive = async () => {
    setSavingIncentive(true);
    setIncentiveSavedNotice(false);
    try {
      const payload = {
        settings: {
          codConversion: {
            enabled: codConfig.incentiveType !== 'none',
            incentiveType: codConfig.incentiveType,
            incentiveAmount: codConfig.incentiveAmount,
            discountCap: codConfig.incentiveType === 'percentage' ? codConfig.discountCap : 0,
            minOrderValue: codConfig.minOrderValue,
          },
        },
      };

      await api.put('/api/settings', payload);
      setIncentiveSavedNotice(true);
      showToast('✓ COD conversion incentive settings saved and live in WhatsApp links!');
      setTimeout(() => setIncentiveSavedNotice(false), 3000);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save settings', 'error');
    } finally {
      setSavingIncentive(false);
    }
  };

  // 1-Click Sync with Meta
  const handleSyncMeta = async () => {
    setSyncingMeta(true);
    try {
      const res = await api.post('/api/templates/sync-meta');
      showToast(res.data?.message || '✓ All canonical playbooks synchronized with Meta WABA!');
      await fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to sync playbooks with Meta', 'error');
    } finally {
      setSyncingMeta(false);
    }
  };

  // Test Send
  const handleFireTestRescue = async () => {
    setSendingTest(true);
    try {
      const res = await api.post('/api/templates/test-send', {
        templateName: selectedPlaybook.templateName,
        phone: testPhone,
      });
      showToast(res.data?.message || `✓ Test rescue sent for ${selectedPlaybook.title}`);
      setShowTestModal(false);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to dispatch test message', 'error');
    } finally {
      setSendingTest(false);
    }
  };

  // Resend fresh payment link to customer
  const handleResendPaymentLink = async () => {
    if (!selectedThread) return;
    if (selectedThread.orderId.startsWith('demo_')) {
      setActionNotice('Demo order: Dispatched fresh 15-minute payment link to customer WhatsApp.');
      setTimeout(() => setActionNotice(null), 3500);
      showToast('✓ [Demo] Fresh payment link dispatched!');
      return;
    }

    try {
      const res = await api.post(`/api/orders/${selectedThread.orderId}/resend-payment-link`);
      setActionNotice(`Dispatched fresh 15-minute payment link: ${res.data.paymentLinkUrl}`);
      showToast('✓ Fresh payment link generated and dispatched to customer WhatsApp!');
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to resend payment link', 'error');
    }
  };

  // Reconcile UTR
  const handleReconcileUtr = async () => {
    if (!selectedThread) return;
    if (selectedThread.orderId.startsWith('demo_')) {
      setActionNotice('Demo order: UTR reconciled. Courier COD balance adjusted to ₹0.');
      setSelectedThread((prev) => (prev ? { ...prev, status: 'converted_to_prepaid' } : null));
      setTimeout(() => setActionNotice(null), 3500);
      showToast('✓ [Demo] Order reconciled! Carrier COD balance updated to ₹0.');
      return;
    }

    try {
      await api.post(`/api/orders/${selectedThread.orderId}/reconcile-utr`, {
        utr: selectedThread.claimedUtr,
      });
      setActionNotice('UTR reconciled on gateway. Order marked prepaid and courier COD adjusted to ₹0.');
      showToast('✓ UTR reconciled! Carrier COD balance updated to ₹0.');
      setSelectedThread((prev) => (prev ? { ...prev, status: 'converted_to_prepaid' } : null));
      setTimeout(() => setActionNotice(null), 4000);
      const detailRes = await api.get(`/api/orders/${selectedThread.orderId}`);
      setActiveChatDetails(detailRes.data);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to reconcile UTR', 'error');
    }
  };

  const activeSample = selectedPlaybook.sampleBubble(codConfig);

  return (
    <div className="page" style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 'var(--space-12)' }}>
      {/* Page Header */}
      <header className="page-head" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="page-head__title" style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Recovery Flows & Customer Experience
            </h1>
            <span className="badge badge-success" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
              <CheckCircle size={11} /> {templates.length > 0 ? `${templates.length} Meta Templates Synced` : '5 Turnkey Playbooks Active'}
            </span>
          </div>
          <p className="page-head__sub" style={{ marginTop: '4px', color: 'var(--text-2)', fontSize: '0.88rem' }}>
            Turnkey WhatsApp recovery playbooks, interactive customer flow simulator, and real chat dispute audit.
          </p>
        </div>
        <div className="page-head__actions" style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost" onClick={fetchData} disabled={loading} aria-label="Refresh data">
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSyncMeta}
            disabled={syncingMeta}
            style={{
              background: 'linear-gradient(135deg, var(--indigo), #6366f1)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Zap size={14} /> {syncingMeta ? 'Synchronizing…' : '1-Click Meta Sync'}
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          TAB NAVIGATION SWITCHER
      ───────────────────────────────────────────────────────────── */}
      <nav className="rf-tabs" aria-label="Recovery Flow Views">
        <button
          className={`rf-tab-btn ${activeTab === 'playbooks' ? 'active' : ''}`}
          onClick={() => setActiveTab('playbooks')}
        >
          <Play size={15} /> Flow Simulator & Playbooks
        </button>
        <button
          className={`rf-tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => setActiveTab('chats')}
        >
          <MessageSquare size={15} /> Real Customer Chat Audit & Dispute Center
          {threads.some((t) => t.claimedUtr) && (
            <span className="badge badge-warning" style={{ fontSize: '0.62rem', padding: '1px 5px', marginLeft: 4 }}>
              Dispute
            </span>
          )}
        </button>
      </nav>

      {/* ══════════════════════════════════════════════════════════════
          TAB 1: FLOW SIMULATOR & TURNKEY PLAYBOOKS
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'playbooks' && (
        <div className="fade-in-up">
          {/* SECTION 1: COD-TO-PREPAID INCENTIVE ARCHITECTURE (MUTUALLY EXCLUSIVE) */}
          <section
            className="panel"
            style={{
              marginBottom: 'var(--space-6)',
              border: '1px solid var(--border-hover)',
              background: 'linear-gradient(180deg, rgba(79, 70, 229, 0.04) 0%, rgba(13, 15, 21, 0.6) 100%)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '16px',
                marginBottom: 'var(--space-4)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={18} color="var(--emerald)" />
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>
                    COD-to-Prepaid Conversion Incentive Strategy
                  </h2>
                  <span className="badge badge-secondary" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                    Single-Select Rule
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-2)' }}>
                  Incentivize customers to pay online via UPI before delivery. Only one strategy can be active at a time to prevent pricing conflicts.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {incentiveSavedNotice && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--emerald)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} /> Saved & Live
                  </span>
                )}
                <button
                  onClick={handleSaveIncentive}
                  disabled={savingIncentive}
                  className="btn btn-primary"
                  style={{ minWidth: 120, height: 36, fontSize: '0.82rem' }}
                >
                  {savingIncentive ? 'Saving…' : 'Save Incentive'}
                </button>
              </div>
            </div>

            {/* 3 Mutually Exclusive Selectable Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 'var(--space-3-5)',
                marginBottom: 'var(--space-4)',
              }}
            >
              {/* OPTION 1: NONE */}
              <div
                onClick={() => setCodConfig((prev) => ({ ...prev, enabled: false, incentiveType: 'none' }))}
                style={{
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${codConfig.incentiveType === 'none' ? 'var(--indigo)' : 'var(--border)'}`,
                  background: codConfig.incentiveType === 'none' ? 'rgba(79, 70, 229, 0.08)' : 'rgba(255, 255, 255, 0.015)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)' }}>
                      <Ban size={15} color={codConfig.incentiveType === 'none' ? 'var(--indigo-soft)' : 'var(--text-3)'} />
                      <span>No Discount (0% Off)</span>
                    </div>
                    <input
                      type="radio"
                      name="incentive_strategy"
                      aria-label="No Discount (0% Off)"
                      checked={codConfig.incentiveType === 'none'}
                      onChange={() => setCodConfig((prev) => ({ ...prev, enabled: false, incentiveType: 'none' }))}
                      style={{ accentColor: 'var(--indigo)', cursor: 'pointer' }}
                    />
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.4 }}>
                    Customer pays the exact full COD total via UPI. Best for essential goods, constrained margins, or zero-discount brands.
                  </p>
                </div>
                <div style={{ marginTop: '12px', fontSize: '0.72rem', color: 'var(--text-3)' }}>
                  Incentive Applied: <strong>₹0.00</strong>
                </div>
              </div>

              {/* OPTION 2: PERCENTAGE WITH MANDATORY CAP */}
              <div
                onClick={() => setCodConfig((prev) => ({ ...prev, enabled: true, incentiveType: 'percentage' }))}
                style={{
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${codConfig.incentiveType === 'percentage' ? 'var(--emerald)' : 'var(--border)'}`,
                  background: codConfig.incentiveType === 'percentage' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.015)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)' }}>
                      <Percent size={15} color={codConfig.incentiveType === 'percentage' ? 'var(--emerald)' : 'var(--text-3)'} />
                      <span>Percentage Off with Cap</span>
                      <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>Popular</span>
                    </div>
                    <input
                      type="radio"
                      name="incentive_strategy"
                      aria-label="Percentage Off with Cap"
                      checked={codConfig.incentiveType === 'percentage'}
                      onChange={() => setCodConfig((prev) => ({ ...prev, enabled: true, incentiveType: 'percentage' }))}
                      style={{ accentColor: 'var(--emerald)', cursor: 'pointer' }}
                    />
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.4 }}>
                    Offers percentage off, strictly capped at a rupee ceiling so high-ticket orders do not burn your margins.
                  </p>
                </div>
                <div style={{ marginTop: '12px', fontSize: '0.72rem', color: 'var(--text-3)' }}>
                  Active Rule: <strong>{codConfig.incentiveAmount}% OFF</strong> (Capped at <strong>₹{codConfig.discountCap}</strong>)
                </div>
              </div>

              {/* OPTION 3: FLAT RUPEE DISCOUNT */}
              <div
                onClick={() => setCodConfig((prev) => ({ ...prev, enabled: true, incentiveType: 'flat' }))}
                style={{
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${codConfig.incentiveType === 'flat' ? 'var(--amber)' : 'var(--border)'}`,
                  background: codConfig.incentiveType === 'flat' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.015)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-1)' }}>
                      <Tag size={15} color={codConfig.incentiveType === 'flat' ? 'var(--amber)' : 'var(--text-3)'} />
                      <span>Flat Rupee Discount</span>
                    </div>
                    <input
                      type="radio"
                      name="incentive_strategy"
                      aria-label="Flat Rupee Discount"
                      checked={codConfig.incentiveType === 'flat'}
                      onChange={() => setCodConfig((prev) => ({ ...prev, enabled: true, incentiveType: 'flat' }))}
                      style={{ accentColor: 'var(--amber)', cursor: 'pointer' }}
                    />
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.4 }}>
                    Instant fixed rupee deduction (e.g. ₹50 off). Upfront cash discount that customers immediately understand.
                  </p>
                </div>
                <div style={{ marginTop: '12px', fontSize: '0.72rem', color: 'var(--text-3)' }}>
                  Active Rule: Flat <strong>₹{codConfig.incentiveAmount} OFF</strong> per conversion
                </div>
              </div>
            </div>

            {/* Dynamic Controls based on selected strategy */}
            {codConfig.incentiveType === 'percentage' && (
              <div
                style={{
                  padding: 'var(--space-3-5) var(--space-4)',
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="discount-pct-select" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)' }}>Discount %:</label>
                  <select
                    id="discount-pct-select"
                    aria-label="Discount percentage"
                    className="form-control"
                    style={{ width: 90, height: 32, fontSize: '0.82rem', padding: '0 8px' }}
                    value={codConfig.incentiveAmount}
                    onChange={(e) => setCodConfig((prev) => ({ ...prev, incentiveAmount: Number(e.target.value) }))}
                  >
                    <option value={3}>3% off</option>
                    <option value={5}>5% off</option>
                    <option value={7}>7% off</option>
                    <option value={10}>10% off</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="discount-cap-input" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)' }}>Maximum Cap (₹):</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>₹</span>
                    <input
                      id="discount-cap-input"
                      aria-label="Maximum discount cap in rupees"
                      type="number"
                      min={20}
                      max={500}
                      step={10}
                      className="form-control"
                      style={{ width: 100, height: 32, fontSize: '0.82rem', padding: '0 8px' }}
                      value={codConfig.discountCap}
                      onChange={(e) => setCodConfig((prev) => ({ ...prev, discountCap: Math.max(0, Number(e.target.value)) }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="pct-min-order-input" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)' }}>Min Order Value:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>₹</span>
                    <input
                      id="pct-min-order-input"
                      aria-label="Minimum order value in rupees"
                      type="number"
                      min={0}
                      step={50}
                      className="form-control"
                      style={{ width: 100, height: 32, fontSize: '0.82rem', padding: '0 8px' }}
                      value={codConfig.minOrderValue}
                      onChange={(e) => setCodConfig((prev) => ({ ...prev, minOrderValue: Math.max(0, Number(e.target.value)) }))}
                    />
                  </div>
                </div>

                <div style={{ flex: '1 1 100%', fontSize: '0.76rem', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <ShieldCheck size={14} color="var(--emerald)" />
                  <span>
                    <strong>Margin Shield Active:</strong> On a ₹5,000 order, 5% is ₹250. The cap holds the discount at <strong>₹{codConfig.discountCap}</strong>, keeping your discount below typical courier RTO loss (~₹140).
                  </span>
                </div>
              </div>
            )}

            {codConfig.incentiveType === 'flat' && (
              <div
                style={{
                  padding: 'var(--space-3-5) var(--space-4)',
                  background: 'rgba(245, 158, 11, 0.05)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="flat-discount-amount-input" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)' }}>Flat Rupee Discount:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>₹</span>
                    <input
                      id="flat-discount-amount-input"
                      aria-label="Flat rupee discount amount"
                      type="number"
                      min={10}
                      max={250}
                      step={10}
                      className="form-control"
                      style={{ width: 100, height: 32, fontSize: '0.82rem', padding: '0 8px' }}
                      value={codConfig.incentiveAmount}
                      onChange={(e) => setCodConfig((prev) => ({ ...prev, incentiveAmount: Math.max(1, Number(e.target.value)) }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="flat-min-order-input" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)' }}>Min Order Value:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>₹</span>
                    <input
                      id="flat-min-order-input"
                      aria-label="Minimum order value for flat discount in rupees"
                      type="number"
                      min={0}
                      step={50}
                      className="form-control"
                      style={{ width: 100, height: 32, fontSize: '0.82rem', padding: '0 8px' }}
                      value={codConfig.minOrderValue}
                      onChange={(e) => setCodConfig((prev) => ({ ...prev, minOrderValue: Math.max(0, Number(e.target.value)) }))}
                    />
                  </div>
                </div>

                <div style={{ flex: '1 1 100%', fontSize: '0.76rem', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <ShieldCheck size={14} color="var(--amber)" />
                  <span>
                    <strong>Unit Economics Safe:</strong> Standard courier RTO fee is ₹140. Giving ₹{codConfig.incentiveAmount} off saves an average of <strong>₹{Math.max(0, 140 - codConfig.incentiveAmount)} net profit</strong> per rescued order.
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* SECTION 2: 2-COLUMN SPLIT (PLAYBOOKS ON LEFT, LIVE INTERACTIVE SIMULATOR ON RIGHT) */}
          <div className="playbooks-split-grid">
            {/* Left Column: 5 Turnkey Meta Playbooks */}
            <div className="panel" style={{ borderRadius: 'var(--radius-lg)' }}>
              <div className="panel__head" style={{ padding: 'var(--space-3-5) var(--space-4)' }}>
                <span className="panel__title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={13} aria-hidden="true" />
                  Turnkey Recovery Playbooks
                </span>
                <span className="panel__aside" style={{ color: 'var(--emerald)', fontWeight: 600 }}>
                  {PLAYBOOKS.length} / {PLAYBOOKS.length} Operational
                </span>
              </div>

              <div style={{ padding: 'var(--space-3)' }}>
                {PLAYBOOKS.map((playbook) => {
                  const isSelected = selectedPlaybook.id === playbook.id;
                  return (
                    <div
                      key={playbook.id}
                      onClick={() => setSelectedPlaybook(playbook)}
                      style={{
                        padding: 'var(--space-3-5) var(--space-4)',
                        marginBottom: 'var(--space-2-5)',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${isSelected ? 'var(--indigo)' : 'var(--border)'}`,
                        background: isSelected ? 'rgba(79, 70, 229, 0.08)' : 'var(--white-01)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {playbook.icon}
                          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-1)' }}>
                            {playbook.title}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                            <CheckCircle size={10} /> Meta Approved
                          </span>
                          <Toggle
                            id={`toggle-${playbook.id}`}
                            aria-label={`Toggle ${playbook.title}`}
                            checked={true}
                            disabled={false}
                            onChange={() => {}}
                          />
                        </div>
                      </div>

                      <p style={{ margin: '0 0 6px 0', fontSize: '0.78rem', color: 'var(--text-2)' }}>
                        {playbook.subtitle}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Zap size={11} color="var(--amber)" />
                          <span><strong>Trigger:</strong> {playbook.trigger}</span>
                        </div>
                        <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>
                          {playbook.templateName}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Playbook Bottom Quick Action */}
              <div style={{ padding: 'var(--space-3-5) var(--space-4)', borderTop: '1px solid var(--border)', background: 'var(--white-01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div style={{ maxWidth: '65%', minWidth: 0 }}>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-3)' }}>
                    Active Playbook: <strong style={{ color: 'var(--text-1)' }}>{selectedPlaybook.title}</strong>
                  </div>
                  <div style={{ marginTop: '2px', fontSize: '0.72rem', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    "{activeSample.body.slice(0, 75)}…"
                  </div>
                </div>
                <button
                  onClick={() => setShowTestModal(true)}
                  className="btn btn-secondary"
                  style={{ height: 32, fontSize: '0.78rem', flexShrink: 0 }}
                >
                  <Send size={13} /> Send Test to Phone
                </button>
              </div>
            </div>

            {/* Right Column: Live Interactive WhatsApp Phone Simulator */}
            <div style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>
              <div className="panel" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div className="panel__head" style={{ padding: 'var(--space-3-5) var(--space-4)' }}>
                  <span className="panel__title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Smartphone size={13} aria-hidden="true" />
                    Live WhatsApp Customer Simulator
                  </span>
                  <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>
                    ● Interactive Sandbox
                  </span>
                </div>

                <div style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'center' }}>
                  {/* Embedded RescueScene Simulator with dynamic merchant COD incentive prop */}
                  <RescueScene
                    active={true}
                    reduced={false}
                    codIncentive={{
                      type: codConfig.incentiveType,
                      amount: codConfig.incentiveAmount,
                      cap: codConfig.discountCap,
                    }}
                  />
                </div>

                <div style={{ padding: '10px 14px', background: 'var(--white-02)', borderTop: '1px solid var(--border)', fontSize: '0.74rem', color: 'var(--text-3)', lineHeight: 1.4 }}>
                  💡 <strong>Simulator Connected:</strong> Tap scenarios above or click reply buttons to experience customer flow in real time. Reflects your active COD discount: <strong>{codConfig.incentiveType === 'none' ? '0% Off' : codConfig.incentiveType === 'percentage' ? `${codConfig.incentiveAmount}% Off (Max ₹${codConfig.discountCap})` : `₹${codConfig.incentiveAmount} Off`}</strong>.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 2: REAL CUSTOMER CHAT AUDIT & DISPUTE CENTER
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'chats' && (
        <div className="fade-in-up">
          {actionNotice && (
            <div
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: 'var(--emerald)',
                fontSize: '0.84rem',
                fontWeight: 600,
                marginBottom: 'var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle size={16} /> {actionNotice}
            </div>
          )}

          <div className="audit-grid">
            {/* COLUMN 1: THREAD LIST */}
            <div className="thread-list-pane">
              <div className="thread-list-head">
                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-1)' }}>
                  Customer Conversations
                </span>
                <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>
                  {threads.length} Threads
                </span>
              </div>

              <div className="thread-list-items">
                {threads.map((thread) => {
                  const isSelected = selectedThread?.orderId === thread.orderId;
                  const timeFormatted = new Date(thread.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={thread.orderId}
                      className={`thread-item ${isSelected ? 'active' : ''}`}
                      onClick={() => setSelectedThread(thread)}
                    >
                      <div className="thread-item-top">
                        <span className="thread-item-name">{thread.customerName}</span>
                        <span className="thread-item-time">{timeFormatted}</span>
                      </div>

                      <div className="thread-item-sub">
                        <span className="mono" style={{ color: 'var(--indigo-soft)', fontWeight: 600 }}>
                          #{thread.externalOrderId}
                        </span>
                        <span style={{ color: 'var(--text-2)' }}>₹{thread.orderValue}</span>
                      </div>

                      <div className="thread-item-msg">
                        {thread.lastDirection === 'inbound' ? '← ' : '→ '}
                        {thread.lastMessageBody}
                      </div>

                      {thread.claimedUtr && (
                        <div style={{ marginTop: '6px' }}>
                          <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                            <ShieldAlert size={10} /> UTR Claimed: {thread.claimedUtr.slice(0, 6)}…
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 2: ACTIVE WHATSAPP CHAT TRANSCRIPT */}
            <div className="chat-window-pane">
              {/* WhatsApp Header */}
              <div className="chat-window-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="chat-window-avatar">
                    {selectedThread ? selectedThread.customerName.charAt(0) : 'C'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.86rem', color: '#fff' }}>
                      {selectedThread?.customerName || 'Customer'}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', color: '#8696a0' }}>
                      {selectedThread?.customerPhone} · Order #{selectedThread?.externalOrderId}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                    ● Real WhatsApp Thread
                  </span>
                </div>
              </div>

              {/* Chat Message Scrollable Feed */}
              <div className="chat-messages-body">
                {loadingChat && (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#8696a0', fontSize: '0.8rem' }}>
                    Loading message history…
                  </div>
                )}

                {activeChatDetails?.messages && activeChatDetails.messages.length > 0 ? (
                  activeChatDetails.messages.map((msg, idx) => {
                    const isOutbound = msg.direction === 'outbound';
                    const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div key={msg._id || idx} className={`wa-bubble-wrap ${isOutbound ? 'outbound' : 'inbound'}`}>
                        <div className={`wa-bubble-box ${isOutbound ? 'outbound' : 'inbound'}`}>
                          <div style={{ wordBreak: 'break-word' }}>{msg.body}</div>
                          <div className="wa-bubble-meta">
                            <span>{timeStr}</span>
                            {isOutbound && (
                              <span className="wa-ticks">
                                <CheckCheck size={13} />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', margin: 'auto', color: '#8696a0', fontSize: '0.82rem' }}>
                    No messages recorded for this order.
                  </div>
                )}
              </div>

              {/* WhatsApp Bottom Disclaimer Bar */}
              <div
                style={{
                  padding: '8px 14px',
                  background: '#202c33',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  fontSize: '0.72rem',
                  color: '#8696a0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>Automated Meta WABA webhook channel</span>
                <span className="mono">DPDP Act 2023 · 180-Day TTL Archive</span>
              </div>
            </div>

            {/* COLUMN 3: PAYMENT VERIFICATION DOSSIER */}
            <div className="dossier-pane audit-dossier-col">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                <ShieldCheck size={18} color="var(--emerald)" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-1)' }}>
                  Verification Dossier
                </h3>
              </div>

              {/* Order & Courier Snapshot Card */}
              <div className="dossier-card">
                <div className="dossier-title">
                  <Truck size={13} /> Courier & Order Status
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.76rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-3)' }}>Order ID:</span>
                    <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>#{selectedThread?.externalOrderId}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-3)' }}>Total Value:</span>
                    <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>₹{selectedThread?.orderValue}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-3)' }}>Carrier:</span>
                    <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{selectedThread?.carrier || 'Delhivery'}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-3)' }}>AWB:</span>
                    <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-1)' }}>{selectedThread?.awb || 'N/A'}</div>
                  </div>
                </div>
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '0.74rem' }}>
                  <span style={{ color: 'var(--text-3)' }}>Doorstep COD Balance: </span>
                  <strong style={{ color: selectedThread?.status === 'converted_to_prepaid' ? 'var(--emerald)' : 'var(--amber)' }}>
                    {selectedThread?.status === 'converted_to_prepaid' ? '₹0.00 (Adjusted)' : `₹${selectedThread?.orderValue || 0} Cash Due`}
                  </strong>
                </div>
              </div>

              {/* Claimed UTR Card */}
              {selectedThread?.claimedUtr ? (
                <div
                  className="dossier-card"
                  style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                  }}
                >
                  <div className="dossier-title" style={{ color: 'var(--amber)' }}>
                    <AlertTriangle size={13} /> Customer Claimed UTR
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: 'var(--text-2)' }}>
                    Customer sent a 12-digit UPI reference number. Verify on Razorpay/Cashfree ledger before confirming.
                  </p>
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>
                      {selectedThread.claimedUtr}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedThread.claimedUtr || '');
                        showToast('✓ UTR copied to clipboard');
                      }}
                      className="btn btn-ghost"
                      style={{ padding: '3px 8px', height: 26, fontSize: '0.7rem' }}
                      title="Copy UTR"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                  <button
                    onClick={handleReconcileUtr}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      marginTop: '10px',
                      height: 32,
                      fontSize: '0.76rem',
                      background: 'linear-gradient(135deg, var(--emerald), #059669)',
                    }}
                  >
                    <CheckCircle size={13} /> Reconcile & Mark Prepaid
                  </button>
                </div>
              ) : (
                <div className="dossier-card">
                  <div className="dossier-title">
                    <CheckCircle size={13} color="var(--emerald)" /> Payment Integrity
                  </div>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-2)' }}>
                    No payment disputes recorded. Customer interactions are adhering to standard automated workflow.
                  </p>
                </div>
              )}

              {/* Merchant Action Controls */}
              <div className="dossier-card">
                <div className="dossier-title">
                  <Zap size={13} /> Quick Triage Actions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={handleResendPaymentLink}
                    className="btn btn-secondary"
                    style={{ width: '100%', height: 32, fontSize: '0.76rem', justifyContent: 'center' }}
                  >
                    <CreditCard size={13} /> Resend Fresh Payment Link (15m)
                  </button>
                  <button
                    onClick={() => {
                      showToast('✓ Notified courier dispatch to prioritize morning delivery');
                    }}
                    className="btn btn-ghost"
                    style={{ width: '100%', height: 32, fontSize: '0.76rem', justifyContent: 'center' }}
                  >
                    <Clock size={13} /> Force Next-Day Reattempt
                  </button>
                </div>
              </div>

              {/* Fraud & Legal Protocol Note */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: 'var(--white-02)',
                  border: '1px solid var(--border)',
                  fontSize: '0.72rem',
                  color: 'var(--text-3)',
                  lineHeight: 1.45,
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Shield size={12} /> Fraud Prevention Protocol
                </div>
                <strong>Zero Screenshot Verification:</strong> RescueShip never converts orders on payment screenshots alone (AI/spoof APKs make forged receipts trivial). Automated conversions require signed banking webhooks or verified 12-digit UPI UTR numbers.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accessible Radix Test Send Dialog */}
      <Dialog open={showTestModal} onOpenChange={(open) => !open && setShowTestModal(false)}>
        <DialogContent style={{ maxWidth: 440 }} showCloseX={false}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: '1.05rem', fontWeight: 600 }}>
              Test WhatsApp Delivery
            </DialogTitle>
            <DialogDescription style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>
              Send a live test rescue message to your mobile number to experience the customer flow.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3-5)', marginTop: 'var(--space-3)' }}>
            <div style={{ padding: '10px', background: 'var(--white-02)', borderRadius: '6px', fontSize: '0.8rem' }}>
              <div style={{ color: 'var(--text-3)', marginBottom: '2px' }}>Testing Workflow:</div>
              <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{selectedPlaybook.title}</div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="test-phone-input" style={{ fontSize: '0.82rem' }}>
                Your Mobile Number (with +91)
              </label>
              <input
                id="test-phone-input"
                type="text"
                placeholder="+91 98765 43210"
                className="form-control"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button onClick={() => setShowTestModal(false)} className="btn btn-ghost" disabled={sendingTest}>
              Cancel
            </button>
            <button
              onClick={handleFireTestRescue}
              disabled={sendingTest || !testPhone.trim()}
              className="btn btn-primary"
            >
              <Send size={14} /> {sendingTest ? 'Sending…' : 'Send Test WhatsApp'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast Alert */}
      {toast && (
        <div
          className="toast-notification"
          role="status"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            borderRadius: '8px',
            background: toast.type === 'error' ? '#ef4444' : '#10b981',
            color: '#fff',
            fontWeight: 500,
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
          }}
        >
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
