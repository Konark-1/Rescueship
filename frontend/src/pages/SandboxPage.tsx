import React, { useState, useEffect, useCallback } from 'react';
import './sandbox.css';

interface SandboxState {
  enabled: boolean;
  activatedAt?: string;
  testRescuesSent: number;
  testRescuesSucceeded: number;
  graduationThreshold: number;
  graduated: boolean;
  graduatedAt?: string;
}

interface SimulateResult {
  simulation: { orderId: string; reason: string; courier: string; awb: string };
  whatsapp: { success: boolean; error?: string };
  sandbox: SandboxState;
  graduationProgress: string;
}

interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const SandboxPage: React.FC = () => {
  const [sandbox, setSandbox] = useState<SandboxState | null>(null);
  const [quality, setQuality] = useState<any>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [lastSim, setLastSim] = useState<SimulateResult | null>(null);
  const [statusFeed, setStatusFeed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem('token') || '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const log = (msg: string) => {
    setStatusFeed(prev => [...prev.slice(-19), `› ${msg}`]);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/sandbox/status`, { headers });
      const data = await res.json();
      if (data.success) setSandbox(data.sandbox);
    } catch (err: any) {
      setError(err.message);
    }
  }, [token]);

  const fetchQuality = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/sandbox/quality`, { headers });
      const data = await res.json();
      if (data.success) setQuality(data.quality);
    } catch {}
  }, [token]);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/sandbox/alerts`, { headers });
      const data = await res.json();
      if (data.success) {
        setAlerts(data.alerts);
        setUnreadCount(data.unreadCount);
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchStatus();
    fetchAlerts();
    fetchQuality();
  }, [fetchStatus, fetchAlerts, fetchQuality]);

  const toggleSandbox = async (enabled: boolean) => {
    log(enabled ? 'enabling sandbox mode…' : 'disabling sandbox mode…');
    try {
      const res = await fetch(`${API}/api/sandbox/toggle`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setSandbox(data.sandbox);
        log(enabled ? 'sandbox ON — all messages redirect to your phone' : 'sandbox OFF');
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const simulateNDR = async () => {
    setSimulating(true);
    setError(null);
    log('generating simulated NDR event…');
    try {
      const res = await fetch(`${API}/api/sandbox/simulate-ndr`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (data.success) {
        setLastSim(data);
        setSandbox(data.sandbox);
        log(`NDR simulated: ${data.simulation.orderId} (${data.simulation.reason})`);
        log(data.whatsapp.success
          ? `✓ rescue WhatsApp sent to your phone`
          : `✗ WhatsApp failed: ${data.whatsapp.error}`);
        log(`graduation progress: ${data.graduationProgress}`);
        if (data.sandbox.graduated) {
          log('🎉 GRADUATED — you are ready to go live!');
        }
      } else {
        setError(data.error);
        log(`✗ ${data.error}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSimulating(false);
    }
  };

  const graduate = async () => {
    log('requesting manual graduation…');
    try {
      const res = await fetch(`${API}/api/sandbox/graduate`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (data.success) {
        setSandbox(data.sandbox);
        log('🎉 graduated — sandbox disabled, you are live');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const markAlertRead = async (alertId: string) => {
    await fetch(`${API}/api/sandbox/alerts/${alertId}/read`, { method: 'POST', headers });
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  if (!sandbox) return <div className="sandbox-loading">Loading sandbox…</div>;

  const progressPct = sandbox && sandbox.graduationThreshold > 0
    ? Math.min(100, (sandbox.testRescuesSucceeded / sandbox.graduationThreshold) * 100)
    : 0;

  return (
    <div className="sandbox-page">
      <header className="sandbox-header">
        <h1>🧪 Sandbox & Safety</h1>
        <p className="sandbox-subtitle">
          Test your rescue flow safely before going live. All messages go to your phone.
        </p>
      </header>

      {/* Status Banner */}
      <div className={`sandbox-banner ${sandbox.enabled ? 'active' : 'inactive'} ${sandbox.graduated ? 'graduated' : ''}`}>
        {sandbox.graduated ? (
          <span>✅ Graduated — Live Mode {quality?.rating ? `(Meta Quality: ${quality.rating})` : ''}</span>
        ) : sandbox.enabled ? (
          <span>🧪 Sandbox Active — messages redirect to your phone</span>
        ) : (
          <span>⚪ Sandbox Inactive {quality?.rating ? `(Meta Quality: ${quality.rating})` : ''}</span>
        )}
      </div>

      {/* Toggle */}
      <section className="sandbox-section">
        <h2>Sandbox Mode</h2>
        <div className="sandbox-toggle-row">
          <button
            className={`btn-toggle ${sandbox.enabled ? 'on' : 'off'}`}
            onClick={() => toggleSandbox(!sandbox.enabled)}
            disabled={sandbox.graduated}
          >
            {sandbox.enabled ? 'Disable Sandbox' : 'Enable Sandbox'}
          </button>
          {sandbox.graduated && (
            <span className="graduated-note">Already graduated. Disable & re-enable to reset.</span>
          )}
        </div>
      </section>

      {/* Graduation Progress */}
      {sandbox.enabled && !sandbox.graduated && (
        <section className="sandbox-section">
          <h2>Graduation Progress</h2>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="progress-label">
            {sandbox.testRescuesSucceeded} / {sandbox.graduationThreshold} successful test rescues
          </p>
          <p className="progress-hint">
            Send {sandbox.graduationThreshold - sandbox.testRescuesSucceeded} more successful rescue(s) to auto-graduate,
            or skip below.
          </p>
          <button className="btn-graduate" onClick={graduate}>
            Skip → Go Live Now
          </button>
        </section>
      )}

      {/* Simulate NDR */}
      {sandbox.enabled && !sandbox.graduated && (
        <section className="sandbox-section">
          <h2>Simulate NDR Event</h2>
          <p className="section-desc">
            Triggers a fake failed-delivery event and sends a rescue WhatsApp message to your phone.
          </p>
          <button
            className="btn-simulate"
            onClick={simulateNDR}
            disabled={simulating}
          >
            {simulating ? 'Simulating…' : '🚨 Simulate Failed Delivery'}
          </button>

          {lastSim && (
            <div className="sim-result">
              <div className="sim-row"><span className="sim-label">Order:</span> {lastSim.simulation.orderId}</div>
              <div className="sim-row"><span className="sim-label">Reason:</span> {lastSim.simulation.reason}</div>
              <div className="sim-row"><span className="sim-label">Courier:</span> {lastSim.simulation.courier}</div>
              <div className="sim-row"><span className="sim-label">AWB:</span> {lastSim.simulation.awb}</div>
              <div className={`sim-row ${lastSim.whatsapp.success ? 'success' : 'fail'}`}>
                <span className="sim-label">WhatsApp:</span>
                {lastSim.whatsapp.success ? '✓ Sent' : `✗ ${lastSim.whatsapp.error}`}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Status Feed */}
      {statusFeed.length > 0 && (
        <section className="sandbox-section">
          <h2>Status Feed</h2>
          <pre className="status-feed">{statusFeed.join('\n')}</pre>
        </section>
      )}

      {/* Alerts */}
      <section className="sandbox-section">
        <h2>
          Alerts {unreadCount > 0 && <span className="alert-badge">{unreadCount}</span>}
        </h2>
        {alerts.length === 0 ? (
          <p className="no-alerts">No alerts. You're all clear. ✓</p>
        ) : (
          <div className="alert-list">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={`alert-card ${alert.severity} ${alert.read ? 'read' : 'unread'}`}
                onClick={() => !alert.read && markAlertRead(alert.id)}
              >
                <div className="alert-title">{alert.title}</div>
                <div className="alert-body">{alert.body}</div>
                <div className="alert-time">
                  {new Date(alert.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && <div className="sandbox-error">⚠️ {error}</div>}
    </div>
  );
};

export default SandboxPage;
