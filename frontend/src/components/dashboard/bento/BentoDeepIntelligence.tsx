import React, { useState, Suspense, lazy } from 'react';
import { BarChart3, ShieldAlert, Sparkles, MapPin, Truck, ChevronDown, ChevronUp } from 'lucide-react';
import type { DailyTrendItem, NdrReasonItem } from '../TrendCharts';
import type { DateRange } from '../DateRangePicker';

const TrendCharts = lazy(() => import('../TrendCharts'));
const RescueFunnel = lazy(() => import('../../reports/RescueFunnel'));
const FraudWatchtower = lazy(() => import('../../reports/FraudWatchtower').then(m => ({ default: m.FraudWatchtower })));
const CarrierPerformanceCard = lazy(() => import('../CarrierPerformanceCard').then(m => ({ default: m.CarrierPerformanceCard })));
const RtoWatchtower = lazy(() => import('../RtoWatchtower').then(m => ({ default: m.RtoWatchtower })));
const TopRiskPincodes = lazy(() => import('../../TopRiskPincodes').then(m => ({ default: m.TopRiskPincodes })));

interface BentoDeepIntelligenceProps {
  trendData: DailyTrendItem[];
  reasonsData: NdrReasonItem[];
  roiChartData: Array<{ period: string; saved: number }>;
  dateRange?: DateRange;
  loading?: boolean;
  onRefreshData?: () => void;
}

export const BentoDeepIntelligence: React.FC<BentoDeepIntelligenceProps> = ({
  trendData,
  reasonsData,
  roiChartData,
  dateRange,
  loading = false,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'trends' | 'funnel' | 'fraud' | 'carriers' | 'rto' | 'pincodes'>('trends');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const tabs = [
    { id: 'trends', label: 'Trend Analytics & ROI', icon: BarChart3 },
    { id: 'funnel', label: 'AI Rescue Funnel', icon: Sparkles },
    { id: 'fraud', label: 'Fraud Watchtower', icon: ShieldAlert },
    { id: 'carriers', label: 'Carrier Scorecard', icon: Truck },
    { id: 'rto', label: 'Pre-Dispatch RTO', icon: ShieldAlert },
    { id: 'pincodes', label: 'Risk Pincodes', icon: MapPin },
  ] as const;

  return (
    <div className="bento-tile bento-deep-intel col-span-full rounded-2xl bg-zinc-950/80 border border-white/10 p-5 backdrop-blur-sm mt-4">
      {/* Header with expand/collapse and Tab Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-900 border border-white/10 text-white">
            <BarChart3 size={16} />
          </div>
          <div>
            <h4 className="text-base font-semibold text-white">Deep Intelligence & Regulatory Telemetry</h4>
            <p className="text-xs text-zinc-400">High-volume Recharts telemetry, AI Funnel stages, and Carrier Fraud disputes</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented Switcher Pills */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-900/90 rounded-lg border border-white/10">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsExpanded(true);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                    active
                      ? 'bg-zinc-800 text-white shadow-sm border border-white/10'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Icon size={13} className={active ? 'text-emerald-400' : 'text-zinc-500'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white transition-colors"
            title={isExpanded ? 'Collapse section' : 'Expand section'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Tab Content Body */}
      {isExpanded && (
        <div className="pt-2">
          {activeTab === 'trends' && (
            <Suspense fallback={<div className="h-48 flex items-center justify-center text-xs text-zinc-500 font-mono">Loading Trend Analytics…</div>}>
              <TrendCharts
                trendData={trendData}
                reasonsData={reasonsData}
                roiChartData={roiChartData}
                loading={loading}
              />
            </Suspense>
          )}

          {activeTab === 'funnel' && (
            <Suspense fallback={<div className="h-48 flex items-center justify-center text-xs text-zinc-500 font-mono">Loading AI Funnel…</div>}>
              <RescueFunnel dateRange={dateRange} />
            </Suspense>
          )}

          {activeTab === 'fraud' && (
            <Suspense fallback={<div className="h-48 flex items-center justify-center text-xs text-zinc-500 font-mono">Loading Fraud Watchtower…</div>}>
              <FraudWatchtower dateRange={dateRange} />
            </Suspense>
          )}

          {activeTab === 'carriers' && (
            <Suspense fallback={<div className="h-48 flex items-center justify-center text-xs text-zinc-500 font-mono">Loading Carrier Matrix…</div>}>
              <CarrierPerformanceCard dateRange={dateRange} />
            </Suspense>
          )}

          {activeTab === 'rto' && (
            <Suspense fallback={<div className="h-48 flex items-center justify-center text-xs text-zinc-500 font-mono">Loading Pre-Dispatch Watchtower…</div>}>
              <RtoWatchtower onActionComplete={onRefreshData} />
            </Suspense>
          )}

          {activeTab === 'pincodes' && (
            <Suspense fallback={<div className="h-48 flex items-center justify-center text-xs text-zinc-500 font-mono">Loading High Risk Pincodes…</div>}>
              <TopRiskPincodes />
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
};
