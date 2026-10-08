import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  MapPin,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Zap,
  Truck,
  UserX,
  RotateCw,
} from 'lucide-react';
import { Switch } from './ui/switch';
import './top-risk-pincodes.css';

export interface PincodeRiskItem {
  pincode: string;
  city: string;
  state?: string;
  totalOrders: number;
  deliveredOrders: number;
  failedOrders: number;
  courierReported?: number;
  customerCancelled?: number;
  fakeAttempts: number;
  avgAttempts?: number;
  rtoRate: number; // percentage (0 - 100)
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  primaryCarrier?: string;
  failureReasons: string[];
  recommendedAction: string;
}

export interface PincodeRuleState {
  forcePrepaid: boolean;
  mandateAdvance: boolean;
  advanceAmount?: number;
  syncStatus?: 'synced' | 'pending' | 'failed';
}

export const TopRiskPincodes: React.FC = () => {
  const [pincodes, setPincodes] = useState<PincodeRiskItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<Record<string, PincodeRuleState>>({});
  const [syncingPincode, setSyncingPincode] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchHighRiskPincodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/analytics/high-risk-pincodes?limit=5');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setPincodes(res.data.data);
      } else if (Array.isArray(res.data)) {
        setPincodes(res.data);
      } else {
        setPincodes([]);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load high-risk pincodes telemetry');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPincodeRules = useCallback(async () => {
    try {
      const res = await api.get('/api/settings/pincode-rules');
      if (res.data?.success && Array.isArray(res.data.rules)) {
        const rulesMap: Record<string, PincodeRuleState> = {};
        res.data.rules.forEach((r: any) => {
          if (r.pincode) {
            rulesMap[r.pincode] = {
              forcePrepaid: !!r.forcePrepaid,
              mandateAdvance: !!r.mandateAdvance,
              advanceAmount: r.advanceAmount ?? 50,
              syncStatus: r.syncStatus,
            };
          }
        });
        setRules(rulesMap);
      }
    } catch {
      // Non-blocking if settings endpoint is still initializing
    }
  }, []);

  useEffect(() => {
    fetchHighRiskPincodes();
    fetchPincodeRules();
  }, [fetchHighRiskPincodes, fetchPincodeRules]);

  const handleToggleRule = async (
    pincode: string,
    field: 'forcePrepaid' | 'mandateAdvance',
    newValue: boolean
  ) => {
    const currentRule = rules[pincode] || {
      forcePrepaid: false,
      mandateAdvance: false,
      advanceAmount: 50,
      syncStatus: 'pending',
    };

    const previousRule = { ...currentRule };
    const updatedRule: PincodeRuleState = {
      ...currentRule,
      [field]: newValue,
    };

    // Optimistic UI update
    setRules((prev) => ({
      ...prev,
      [pincode]: updatedRule,
    }));
    setSyncingPincode(pincode);

    try {
      const res = await api.put('/api/settings/pincode-rules', {
        pincode,
        rules: {
          forcePrepaid: updatedRule.forcePrepaid,
          mandateAdvance: updatedRule.mandateAdvance,
          advanceAmount: updatedRule.advanceAmount ?? 50,
        },
      });

      const syncStatus = res.data?.syncStatus || 'synced';
      setRules((prev) => ({
        ...prev,
        [pincode]: {
          ...updatedRule,
          syncStatus,
        },
      }));

      const actionName = field === 'forcePrepaid' ? 'Force Prepaid' : 'Mandate ₹50 Advance';
      showToast(
        newValue
          ? `Enabled ${actionName} for ${pincode} (${syncStatus === 'synced' ? 'synced' : 'pending sync'})`
          : `Disabled ${actionName} for ${pincode}`,
        'success'
      );
    } catch (err: any) {
      // Rollback optimistic update
      setRules((prev) => ({
        ...prev,
        [pincode]: previousRule,
      }));
      const errorMsg =
        err?.response?.data?.error ||
        `Failed to sync rule for ${pincode} to storefront. Reverting.`;
      showToast(errorMsg, 'error');
    } finally {
      setSyncingPincode(null);
    }
  };

  return (
    <section className="panel fade-in-up top-risk-panel">
      <div className="panel__head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={16} color="var(--rose, #f43f5e)" aria-hidden="true" />
          <span className="panel__title">Top 5 High-Risk Pincodes</span>
          <span className="top-risk-badge top-risk-badge--critical">30-Day Hotspots</span>
          <span
            style={{
              fontSize: '0.72rem',
              color: 'var(--indigo-soft, #a5b4fc)',
              background: 'rgba(99, 102, 241, 0.12)',
              padding: '2px 8px',
              borderRadius: '12px',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              fontWeight: 500,
            }}
          >
            ⚡ Storefront Sync Active
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={fetchHighRiskPincodes}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            title="Refresh pincode analytics"
            aria-label="Refresh pincode risk data"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="panel__body" style={{ padding: 0 }}>
        {loading ? (
          <div className="top-risk-empty">
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: 'var(--indigo)' }} />
            <p>Aggregating 30-day delivery failure telemetry…</p>
          </div>
        ) : error ? (
          <div className="top-risk-empty" style={{ color: 'var(--rose)' }}>
            <AlertTriangle size={24} style={{ margin: '0 auto 8px' }} />
            <p>{error}</p>
            <button onClick={fetchHighRiskPincodes} className="btn btn-secondary btn-sm" style={{ marginTop: '10px' }}>
              Retry
            </button>
          </div>
        ) : pincodes.length === 0 ? (
          <div className="top-risk-empty">
            <div className="top-risk-empty-icon">
              <CheckCircle2 size={24} />
            </div>
            <p style={{ fontWeight: 600, color: 'var(--text-1)' }}>No High-Risk Pincodes Detected</p>
            <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>
              All delivery zones have normal completion rates with no recurring fake attempt patterns.
            </p>
          </div>
        ) : (
          <div className="table-container" tabIndex={0} aria-label="High-risk pincodes table">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Pincode / City</th>
                  <th>Orders / RTO Rate</th>
                  <th>Failure Attribution</th>
                  <th>Fake Attempts</th>
                  <th>Avg Attempts</th>
                  <th>Risk Tier</th>
                  <th>Actionable Recommendation</th>
                  <th style={{ minWidth: '220px' }}>Storefront Actions</th>
                </tr>
              </thead>
              <tbody>
                {pincodes.map((item) => {
                  const isCritical = item.riskLevel === 'CRITICAL' || item.rtoRate >= 50;
                  const isHigh = item.riskLevel === 'HIGH' || item.rtoRate >= 25;
                  const badgeClass = isCritical
                    ? 'top-risk-badge--critical'
                    : isHigh
                      ? 'top-risk-badge--high'
                      : item.riskLevel === 'MEDIUM'
                        ? 'top-risk-badge--medium'
                        : 'top-risk-badge--low';

                  const fillClass = isCritical
                    ? 'rto-progress-fill--critical'
                    : isHigh
                      ? 'rto-progress-fill--high'
                      : 'rto-progress-fill--normal';

                  return (
                    <tr key={item.pincode}>
                      <td>
                        <div className="pincode-code">{item.pincode}</div>
                        <div className="pincode-city">
                          <MapPin size={11} /> {item.city}
                          {item.state ? `, ${item.state}` : ''}
                        </div>
                      </td>
                      <td style={{ minWidth: '150px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                          <span style={{ fontWeight: 700, color: isCritical ? 'var(--rose)' : 'var(--text-1)' }}>
                            {item.rtoRate}% RTO
                          </span>
                          <span style={{ color: 'var(--text-3)' }}>
                            {item.failedOrders} / {item.totalOrders}
                          </span>
                        </div>
                        <div className="rto-progress-bar">
                          <div
                            className={`rto-progress-fill ${fillClass}`}
                            style={{ width: `${Math.min(100, Math.max(8, item.rtoRate))}%` }}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="failure-attribution-breakdown">
                          <span
                            className="attribution-tag attribution-tag--courier"
                            title="Carrier reported delivery failure"
                          >
                            <Truck size={11} />
                            {item.courierReported ?? 0} Courier
                          </span>
                          <span
                            className="attribution-tag attribution-tag--customer"
                            title="Customer pre-attempt cancel or WhatsApp opt-out"
                          >
                            <UserX size={11} />
                            {item.customerCancelled ?? 0} Customer
                          </span>
                        </div>
                      </td>
                      <td>
                        {item.fakeAttempts > 0 ? (
                          <span className="fake-attempt-pill">
                            <ShieldAlert size={12} />
                            {item.fakeAttempts} Fake Attempt{item.fakeAttempts > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>0 flagged</span>
                        )}
                      </td>
                      <td>
                        <span className="attempts-pill" title="Average delivery attempts per order">
                          <RotateCw size={11} />
                          {item.avgAttempts !== undefined ? `${item.avgAttempts}x` : '1.0x'}
                        </span>
                      </td>
                      <td>
                        <span className={`top-risk-badge ${badgeClass}`}>
                          {item.riskLevel}
                        </span>
                      </td>
                      <td>
                        <div className={`action-pill ${isCritical ? 'action-pill--critical' : item.fakeAttempts >= 2 ? 'action-pill--audit' : ''}`}>
                          <Zap size={12} color={isCritical ? 'var(--rose)' : item.fakeAttempts >= 2 ? 'var(--amber)' : 'var(--indigo)'} />
                          <span>{item.recommendedAction}</span>
                        </div>
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '0.78rem',
                              cursor: syncingPincode === item.pincode ? 'wait' : 'pointer',
                              color: rules[item.pincode]?.forcePrepaid
                                ? '#ffffff'
                                : 'var(--text-3, #9ca3af)',
                              fontWeight: rules[item.pincode]?.forcePrepaid ? 600 : 400,
                            }}
                          >
                            <Switch
                              checked={!!rules[item.pincode]?.forcePrepaid}
                              onCheckedChange={(checked) =>
                                handleToggleRule(item.pincode, 'forcePrepaid', checked)
                              }
                              disabled={syncingPincode === item.pincode}
                              aria-label={`Force Prepaid Only for ${item.pincode}`}
                            />
                            <span>🚫 Force Prepaid Only</span>
                          </label>

                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '0.78rem',
                              cursor: syncingPincode === item.pincode ? 'wait' : 'pointer',
                              color: rules[item.pincode]?.mandateAdvance
                                ? '#ffffff'
                                : 'var(--text-3, #9ca3af)',
                              fontWeight: rules[item.pincode]?.mandateAdvance ? 600 : 400,
                            }}
                          >
                            <Switch
                              checked={!!rules[item.pincode]?.mandateAdvance}
                              onCheckedChange={(checked) =>
                                handleToggleRule(item.pincode, 'mandateAdvance', checked)
                              }
                              disabled={syncingPincode === item.pincode}
                              aria-label={`Mandate ₹50 Advance for ${item.pincode}`}
                            />
                            <span>💰 Mandate ₹50 Advance</span>
                          </label>

                          {rules[item.pincode]?.syncStatus && (
                            <div style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor:
                                    rules[item.pincode].syncStatus === 'synced'
                                      ? 'var(--emerald, #10b981)'
                                      : 'var(--amber, #f59e0b)',
                                }}
                              />
                              <span style={{ color: 'var(--text-3, #9ca3af)' }}>
                                {rules[item.pincode].syncStatus === 'synced' ? 'Storefront Synced' : 'Sync Pending'}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div
          className="toast-notification"
          role="status"
          style={{
            borderColor: toast.type === 'error' ? 'var(--rose, #f43f5e)' : 'var(--indigo, #4f46e5)',
          }}
        >
          {toast.type === 'error' ? (
            <AlertTriangle size={18} color="var(--rose, #f43f5e)" />
          ) : (
            <CheckCircle2 size={18} color="var(--emerald, #10b981)" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </section>
  );
};

export default TopRiskPincodes;
