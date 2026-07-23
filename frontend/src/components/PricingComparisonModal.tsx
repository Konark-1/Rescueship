import React, { useState } from 'react';
import { X, Check, Minus } from 'lucide-react';

interface PricingComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PricingComparisonModal: React.FC<PricingComparisonModalProps> = ({ isOpen, onClose }) => {
  const [billingCycle, setBillingCycle] = useState<'quarterly' | 'semi_annual' | 'annual'>('annual');

  if (!isOpen) return null;

  const prices = {
    starter: { quarterly: '₹1,599', semi_annual: '₹1,359', annual: '₹1,119' },
    growth: { quarterly: '₹3,999', semi_annual: '₹3,399', annual: '₹2,799' },
    scale: { quarterly: '₹9,999', semi_annual: '₹8,499', annual: '₹6,999' },
    enterprise: { quarterly: 'Custom', semi_annual: 'Custom', annual: 'Custom' },
  };

  const featureGroups = [
    {
      category: 'ORDERS & CAPACITY',
      features: [
        { name: 'Monthly Order Limit', starter: '2,000 orders', growth: '10,000 orders', scale: '50,000 orders', enterprise: 'Unlimited' },
        { name: 'Order Limit Warning (80%)', starter: true, growth: true, scale: true, enterprise: true },
      ],
    },
    {
      category: 'NDR RESCUE AUTOMATION',
      features: [
        { name: 'WhatsApp Bot (English)', starter: true, growth: true, scale: true, enterprise: true },
        { name: 'Fake Remark Detection', starter: true, growth: true, scale: true, enterprise: true },
        { name: 'Smart Address Correction (Text)', starter: true, growth: true, scale: true, enterprise: true },
        { name: 'Smart Address Correction (Location Pin)', starter: true, growth: true, scale: true, enterprise: true },
        { name: 'Smart Address Correction (Both)', starter: true, growth: true, scale: true, enterprise: true },
        { name: 'NDR Escalation Workflow', starter: 'Basic (3-step)', growth: 'Advanced (custom)', scale: 'Full Automation', enterprise: 'Custom SLA' },
      ],
    },
    {
      category: 'COD TO PREPAID CONVERSION',
      features: [
        { name: 'Payment Links (Razorpay/Cashfree)', starter: true, growth: true, scale: true, enterprise: true },
        { name: 'Incentive Discount Types', starter: 'Flat discount', growth: 'Flat + Percentage', scale: 'Flat + Percentage', enterprise: 'Custom Rules' },
        { name: 'UPI QR Code via WhatsApp', starter: false, growth: true, scale: true, enterprise: true },
        { name: 'Seller Payment Notification', starter: false, growth: true, scale: true, enterprise: true },
      ],
    },
    {
      category: 'CARRIER INTEGRATIONS',
      features: [
        { name: 'Shiprocket Integration', starter: true, growth: true, scale: true, enterprise: true },
        { name: 'Delhivery Integration', starter: true, growth: true, scale: true, enterprise: true },
        { name: 'ClickPost Integration', starter: false, growth: true, scale: true, enterprise: true },
        { name: 'Custom Carrier API', starter: false, growth: false, scale: true, enterprise: true },
      ],
    },
    {
      category: 'ANALYTICS & REPORTING',
      features: [
        { name: 'Overview KPIs + Revenue Saved', starter: true, growth: true, scale: true, enterprise: true },
        { name: 'Daily Conversion Performance Chart', starter: false, growth: true, scale: true, enterprise: true },
        { name: 'Carrier Performance Breakdown', starter: false, growth: true, scale: true, enterprise: true },
        { name: 'NDR Reason Distribution Pie Chart', starter: false, growth: true, scale: true, enterprise: true },
        { name: 'Export Reports (CSV)', starter: false, growth: false, scale: true, enterprise: true },
      ],
    },
    {
      category: 'SECURITY & PLATFORM',
      features: [
        { name: 'Emergency "Pause All" Control', starter: true, growth: true, scale: true, enterprise: true },
        { name: 'Webhook HMAC Signature Verification', starter: true, growth: true, scale: true, enterprise: true },
        { name: 'REST API & Developer Docs Access', starter: false, growth: true, scale: true, enterprise: true },
      ],
    },
    {
      category: 'SUPPORT & GUARANTEES',
      features: [
        { name: 'Email Support Response Time', starter: 'Within 24h', growth: 'Within 12h', scale: 'Within 6h', enterprise: 'Within 6h' },
        { name: 'Priority Queue Job Processing', starter: false, growth: true, scale: true, enterprise: true },
        { name: 'SLA Guarantee (99.5% Uptime)', starter: false, growth: false, scale: true, enterprise: true },
        { name: 'Dedicated Account Manager', starter: false, growth: false, scale: false, enterprise: true },
      ],
    },
  ];

  const renderValue = (val: boolean | string) => {
    if (typeof val === 'boolean') {
      return val ? (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400">
          <Check size={14} />
        </span>
      ) : (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-500/10 text-rose-500/50">
          <Minus size={14} />
        </span>
      );
    }
    return <span className="text-xs font-medium text-gray-300">{val}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-[#0b0f19] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800/80 bg-[#0f172a]/50 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Compare All RescueShip Plans</h2>
            <p className="text-sm text-gray-400 mt-1">Detailed feature breakdown across all subscription tiers.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/60 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center p-4 border-b border-gray-800/50 bg-[#0b0f19] shrink-0">
          <div className="inline-flex p-1 bg-gray-900/80 border border-gray-800 rounded-xl">
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

        {/* Scrollable Table */}
        <div className="overflow-y-auto overflow-x-auto flex-1 p-6">
          <table className="w-full text-left border-collapse min-w-[700px]">
            {/* Table Header Sticky */}
            <thead>
              <tr className="border-b border-gray-800 text-white">
                <th className="py-4 px-4 font-semibold text-gray-400 text-sm w-2/5">Features</th>
                <th className="py-4 px-3 text-center font-bold text-lg text-white w-1/5 bg-gray-900/40 rounded-t-xl">
                  Starter
                  <div className="text-base font-extrabold text-indigo-400 mt-1">
                    {prices.starter[billingCycle]}
                    <span className="text-xs text-gray-400 font-normal">/mo</span>
                  </div>
                </th>
                <th className="py-4 px-3 text-center font-bold text-lg text-white w-1/5 bg-indigo-950/40 border-t-2 border-indigo-500 rounded-t-xl relative">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    Popular
                  </span>
                  Growth
                  <div className="text-base font-extrabold text-indigo-300 mt-1">
                    {prices.growth[billingCycle]}
                    <span className="text-xs text-gray-400 font-normal">/mo</span>
                  </div>
                </th>
                <th className="py-4 px-3 text-center font-bold text-lg text-white w-1/5 bg-gray-900/40 rounded-t-xl">
                  Scale
                  <div className="text-base font-extrabold text-indigo-400 mt-1">
                    {prices.scale[billingCycle]}
                    <span className="text-xs text-gray-400 font-normal">/mo</span>
                  </div>
                </th>
                <th className="py-4 px-3 text-center font-bold text-lg text-white w-1/5 bg-gray-900/40 rounded-t-xl">
                  Enterprise
                  <div className="text-base font-extrabold text-gray-300 mt-1">Custom</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {featureGroups.map((group, gIdx) => (
                <React.Fragment key={gIdx}>
                  {/* Category Header */}
                  <tr>
                    <td
                      colSpan={5}
                      className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-indigo-400 bg-gray-900/60 border-y border-gray-800/60"
                    >
                      {group.category}
                    </td>
                  </tr>
                  {/* Features in Category */}
                  {group.features.map((feat, fIdx) => (
                    <tr
                      key={fIdx}
                      className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-gray-300 font-medium">{feat.name}</td>
                      <td className="py-3 px-3 text-center bg-gray-900/20">{renderValue(feat.starter)}</td>
                      <td className="py-3 px-3 text-center bg-indigo-950/20 font-semibold">{renderValue(feat.growth)}</td>
                      <td className="py-3 px-3 text-center bg-gray-900/20">{renderValue(feat.scale)}</td>
                      <td className="py-3 px-3 text-center bg-gray-900/20">{renderValue(feat.enterprise)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PricingComparisonModal;
