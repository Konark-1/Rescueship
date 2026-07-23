import { useState, useRef } from 'react';
import { CreditCard, Zap, Download, Check, Shield, Star, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import PricingComparisonModal from '../components/PricingComparisonModal';

export default function BillingPage() {
  const [billingCycle, setBillingCycle] = useState<'quarterly' | 'semi_annual' | 'annual'>('annual');
  const [toast, setToast] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mock order usage data
  const currentOrdersUsed = 1240;
  const currentOrderLimit = 2000;
  const percentageUsed = Math.min(100, Math.round((currentOrdersUsed / currentOrderLimit) * 100));

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDownload = (id: string) => {
    showToast(`Downloading Invoice PDF for ${id}...`);
  };

  const handleSelectPlan = (name: string, price: string) => {
    if (name === 'Starter') {
      showToast('You are currently on the Starter Plan.');
      return;
    }
    if (name === 'Enterprise') {
      window.location.href = 'mailto:support@rescueship.io?subject=RescueShip Enterprise Inquiry';
      return;
    }
    showToast(`Upgrading to ${name} Plan (${price})... Redirecting to Checkout.`);
  };

  const subscriptions = [
    {
      name: 'Starter',
      price: billingCycle === 'quarterly' ? '₹1,599' : billingCycle === 'semi_annual' ? '₹1,359' : '₹1,119',
      period: '/mo',
      orderLimit: '2,000 orders/mo',
      features: [
        'Up to 2,000 orders/mo',
        'Smart Address Correction (Text, Pin, Both)',
        'Fake Remark Detection',
        'Shiprocket & Delhivery Integrations',
        'Email Support (24h SLA)',
      ],
      buttonText: 'Current Plan',
      active: true,
      popular: false,
    },
    {
      name: 'Growth',
      price: billingCycle === 'quarterly' ? '₹3,999' : billingCycle === 'semi_annual' ? '₹3,399' : '₹2,799',
      period: '/mo',
      orderLimit: '10,000 orders/mo',
      features: [
        'Up to 10,000 orders/mo',
        'Everything in Starter',
        'UPI QR Payment Link Generation',
        'Seller Payment WhatsApp Alerts',
        'ClickPost Integration',
        'Advanced Analytics & Charts',
        'Priority Support (12h SLA)',
      ],
      buttonText: 'Upgrade Now',
      active: false,
      popular: true,
    },
    {
      name: 'Scale',
      price: billingCycle === 'quarterly' ? '₹9,999' : billingCycle === 'semi_annual' ? '₹8,499' : '₹6,999',
      period: '/mo',
      orderLimit: '50,000 orders/mo',
      features: [
        'Up to 50,000 orders/mo',
        'Everything in Growth',
        'Custom Carrier Integration',
        'CSV Data Exports',
        'Priority Support (6h SLA)',
        '99.5% Uptime SLA Guarantee',
      ],
      buttonText: 'Upgrade to Scale',
      active: false,
      popular: false,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      orderLimit: 'Unlimited orders',
      features: [
        'Unlimited orders & volume',
        'Everything in Scale',
        'Dedicated Account Manager',
        'Custom SLA & Escalation Flow',
        'Whitelabel & Custom Workflows',
      ],
      buttonText: 'Contact Sales',
      active: false,
      popular: false,
    },
  ];

  const invoices = [
    { id: 'INV-2026-001', date: 'Oct 1, 2026', amount: '₹1,599', status: 'Paid' },
    { id: 'INV-2026-002', date: 'Sep 1, 2026', amount: '₹1,599', status: 'Paid' },
    { id: 'INV-2026-003', date: 'Aug 1, 2026', amount: '₹1,599', status: 'Paid' },
  ];

  return (
    <div className="fade-in-up p-6 max-w-7xl mx-auto space-y-10">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-xl z-50 text-sm font-semibold flex items-center gap-2">
          <span>{toast}</span>
        </div>
      )}

      {/* Header & Order Limit Usage */}
      <div className="glass-card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 z-0"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-white mb-2 font-display">Billing & Subscription</h1>
          <p className="text-gray-400">Manage your subscription plan, order capacity, and billing history.</p>
        </div>

        {/* Current Usage Bar */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 min-w-[320px] relative z-10">
          <div className="flex justify-between text-sm font-medium mb-2">
            <span className="text-gray-400">Monthly Order Capacity</span>
            <span className="text-indigo-400 font-bold">
              {currentOrdersUsed.toLocaleString()} / {currentOrderLimit.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3 mb-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percentageUsed > 80 ? 'bg-rose-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${percentageUsed}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center text-xs text-gray-400 mt-2">
            <span>{percentageUsed}% Used this cycle</span>
            {percentageUsed >= 80 && (
              <span className="text-rose-400 font-semibold flex items-center gap-1">
                <Zap size={12} /> Near Limit
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Subscription Plans Section */}
      <div ref={containerRef} className="relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display">
              <Shield size={22} className="text-emerald-400" />
              Select Your Plan
            </h2>
            <p className="text-sm text-gray-400">Scale your COD recovery & NDR management seamlessly.</p>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center bg-gray-900/80 p-1.5 rounded-xl border border-gray-800">
            <button
              onClick={() => setBillingCycle('quarterly')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                billingCycle === 'quarterly'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Quarterly
            </button>
            <button
              onClick={() => setBillingCycle('semi_annual')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                billingCycle === 'semi_annual'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Semi-Annual
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                15% OFF
              </span>
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                billingCycle === 'annual'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Annual
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
                30% OFF
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {subscriptions.map((plan, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -6 }}
              className={`glass-card p-6 flex flex-col justify-between border relative overflow-hidden transition-all ${
                plan.popular
                  ? 'bg-gradient-to-b from-indigo-950/60 to-gray-900/90 border-indigo-500 shadow-xl shadow-indigo-950/40'
                  : 'border-gray-800 hover:border-gray-700'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-4 transform -translate-y-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-md">
                  <Star size={12} className="fill-white" /> Popular
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-xs text-indigo-400 font-semibold mb-4">{plan.orderLimit}</p>

                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                  <span className="text-xs text-gray-400">{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-gray-300">
                      <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleSelectPlan(plan.name, plan.price)}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                  plan.active
                    ? 'bg-gray-800 text-gray-400 cursor-default border border-gray-700'
                    : plan.popular
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30'
                    : 'bg-gray-800 text-white hover:bg-gray-700'
                }`}
              >
                {plan.buttonText}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Feature Comparison Link */}
        <div className="mt-8 text-center">
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-950/40 border border-indigo-800/50 px-5 py-2.5 rounded-xl"
          >
            <HelpCircle size={18} />
            Compare All Features in Detail →
          </button>
        </div>
      </div>

      {/* Invoice History Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/40">
          <h2 className="text-lg font-bold text-white font-display">Invoice History</h2>
          <CreditCard className="w-5 h-5 text-gray-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-900/60 border-b border-gray-800 text-gray-400 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Invoice ID</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40">
              {invoices.map((inv, i) => (
                <tr key={i} className="hover:bg-gray-800/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{inv.id}</td>
                  <td className="px-6 py-4">{inv.date}</td>
                  <td className="px-6 py-4 font-medium">{inv.amount}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDownload(inv.id)}
                      className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-medium text-xs transition-colors p-2 hover:bg-gray-800 rounded-lg"
                    >
                      <Download className="w-4 h-4" /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparison Modal */}
      <PricingComparisonModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
