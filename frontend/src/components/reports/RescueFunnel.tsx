import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { Bot, ArrowRight, CheckCircle2, MessageSquare, Zap, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { useRescueFunnel } from '../../hooks/useRescueFunnel';
import type { FunnelStage } from '../../types/analytics.d';

const STAGE_COLORS = ['#6366f1', '#38bdf8', '#f59e0b', '#10b981'];

export const RescueFunnel: React.FC = () => {
  const { funnelData, loading, error, refetch } = useRescueFunnel();

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        <Card style={{ padding: '24px' }}>
          <Skeleton style={{ height: '24px', width: '50%', marginBottom: '16px' }} />
          <Skeleton style={{ height: '280px', width: '100%' }} />
        </Card>
        <Card style={{ padding: '24px' }}>
          <Skeleton style={{ height: '24px', width: '50%', marginBottom: '16px' }} />
          <Skeleton style={{ height: '280px', width: '100%' }} />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card style={{ padding: '32px', textAlign: 'center' }}>
        <AlertTriangle size={36} color="var(--rose, #f43f5e)" style={{ margin: '0 auto 12px' }} />
        <CardTitle style={{ color: 'var(--text-1)' }}>Unable to Load AI Rescue Funnel</CardTitle>
        <CardDescription style={{ marginTop: '8px', marginBottom: '16px' }}>{error}</CardDescription>
        <Button variant="secondary" onClick={() => refetch()} style={{ margin: '0 auto' }}>
          <RefreshCw size={14} />
          <span>Retry</span>
        </Button>
      </Card>
    );
  }

  const { stages, overallRescueRate, aiTelemetry } = funnelData;

  const chartData = stages.map((s: FunnelStage) => ({
    name: s.label,
    count: s.count,
    rate: s.conversionRateFromPrevious,
    overallRate: s.conversionRateFromStart,
    dropOff: s.dropOffCount,
  }));

  return (
    <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 2-Column Layout: Visual Funnel (Left 60%) + Gemini AI Telemetry (Right 40%) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Left Column: Visual Funnel Chart */}
        <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <CardHeader style={{ padding: 0, marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <CardTitle style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                  NDR Recovery Conversion Funnel
                </CardTitle>
                <CardDescription style={{ marginTop: '4px' }}>
                  Progressive pipeline drop-offs from courier exception to customer rescue
                </CardDescription>
              </div>
              <Badge variant="success" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                {overallRescueRate.toFixed(1)}% Rescued
              </Badge>
            </div>
          </CardHeader>

          <CardContent style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Horizontal Bar Visualizer */}
            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={120} tickLine={false} />
                  <Tooltip
                    formatter={(value: any, _: any, entry: any) => [
                      `${value} orders (${entry.payload.rate}% from previous stage)`,
                      'Volume',
                    ]}
                    contentStyle={{
                      background: '#0d0f15',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={`bar-${index}`} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Step-by-Step Flow Metrics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '10px',
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.06))',
              }}
            >
              {stages.map((st: FunnelStage, idx: number) => (
                <div key={st.stage} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {st.label}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                    {st.count}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: idx === 0 ? 'var(--text-3)' : 'var(--emerald, #10b981)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {idx === 0 ? 'Baseline 100%' : `↓ ${st.conversionRateFromPrevious}% passed`}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Gemini AI Telemetry Widget */}
        <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
          <CardHeader style={{ padding: 0, marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--indigo-soft, #818cf8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Bot size={20} />
                </div>
                <div>
                  <CardTitle style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    Gemini AI Telemetry
                  </CardTitle>
                  <CardDescription style={{ marginTop: '2px' }}>
                    High-fidelity address parsing & normalization
                  </CardDescription>
                </div>
              </div>
              <Badge variant="success">
                Active
              </Badge>
            </div>
          </CardHeader>

          <CardContent style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Parser Success Rate KPI */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-3, #9ca3af)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  AI Parser Success Rate
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--emerald, #10b981)', marginTop: '2px', fontFamily: 'var(--font-display, inherit)' }}>
                  {aiTelemetry.parserSuccessRate.toFixed(1)}%
                </div>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={20} />
              </div>
            </div>

            {/* Before & After Interactive Showcase */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2, #d4d4d8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Before &amp; After Normalization Example:
              </div>

              {/* Before Box */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(244, 63, 94, 0.08)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--rose, #f43f5e)', textTransform: 'uppercase' }}>
                  <span>Raw Hinglish Customer Input:</span>
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--text-1)', fontStyle: 'italic', lineHeight: 1.4 }}>
                  "{aiTelemetry.sampleBefore}"
                </p>
              </div>

              {/* Arrow transition */}
              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--indigo-soft, #818cf8)' }}>
                <ArrowRight size={18} style={{ transform: 'rotate(90deg)' }} />
              </div>

              {/* After Box */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--emerald, #10b981)', textTransform: 'uppercase' }}>
                    <CheckCircle2 size={12} />
                    <span>Clean Courier Address (120-Char standard):</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-3, #9ca3af)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {aiTelemetry.sampleAfter.length}/120 chars
                  </span>
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#fff', fontWeight: 500, lineHeight: 1.4 }}>
                  {aiTelemetry.sampleAfter}
                </p>
              </div>
            </div>

            {/* Model telemetry note */}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3, #9ca3af)', marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={13} />
              <span>Direct multimodal parsing powered by Gemini 3.8 Flash</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RescueFunnel;
