import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './sandbox.css';

/* ─── API client ─── */
const TOKEN_KEY = 'token';
const getToken = () => localStorage.getItem(TOKEN_KEY);
async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

const sandboxApi = {
  status: () => api('/sandbox/status'),
  toggle: (enabled: boolean) =>
    api('/sandbox/toggle', { method: 'POST', body: JSON.stringify({ enabled }) }),
  simulate: () => api('/sandbox/simulate-ndr', { method: 'POST' }),
  graduate: () => api('/sandbox/graduate', { method: 'POST' }),
  alerts: () => api('/sandbox/alerts'),
  alertRead: (id: string) =>
    api(`/sandbox/alerts/${id}/read`, { method: 'POST' }),
  quality: () => api('/sandbox/quality'),
};

/* ─── Types ─── */
interface SandboxState {
  enabled: boolean;
  testRescuesSent: number;
  testRescuesSucceeded: number;
  graduationThreshold: number;
  graduated: boolean;
}

interface Alert {
  id: string;
  kind?: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

/* ─── Component ─── */
export default function SandboxPage() {
  const [status, setStatus] = useState<SandboxState | null>(null);
  const [quality, setQuality] = useState<any>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [feed, setFeed] = useState<string[]>([]);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSim, setLastSim] = useState<any>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const pushFeed = useCallback((line: string) => {
    const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });
    setFeed((f) => [...f.slice(-30), `${ts} › ${line}`]);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const [s, q] = await Promise.all([
        sandboxApi.status(),
        sandboxApi.quality().catch(() => null),
      ]);
      if (s?.sandbox) setStatus(s.sandbox);
      else if (s) setStatus(s);
      setQuality(q?.quality || q);
    } catch { /* ignore */ }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const list = await sandboxApi.alerts();
      setAlerts(list?.alerts || list || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadStatus();
    loadAlerts();
  }, [loadStatus, loadAlerts]);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [feed]);

  /* ── Actions ── */
  const handleToggle = async () => {
    if (!status) return;
    const next = !status.enabled;
    pushFeed(`toggling sandbox ${next ? 'ON' : 'OFF'}…`);
    try {
      const s = await sandboxApi.toggle(next);
      setStatus(s?.sandbox || s);
      pushFeed(next ? 'sandbox enabled — outbound WhatsApp redirects to your phone' : 'sandbox disabled');
    } catch (e: any) {
      setError(e.message);
      pushFeed(`toggle failed: ${e.message}`);
    }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    setError(null);
    pushFeed('generating simulated NDR…');
    try {
      const sim = await sandboxApi.simulate();
      setLastSim(sim?.simulation || sim);
      pushFeed(`NDR simulated · AWB ${sim?.simulation?.awb || sim?.awb || 'SIM'} · reason: ${sim?.simulation?.reason || sim?.reason || 'NDR'}`);
      pushFeed(`rescue dispatched → ${sim?.template || 'ndr_rescue_en'}`);
      pushFeed(`WhatsApp redirected to owner phone ✓`);
      await loadStatus();
    } catch (e: any) {
      setError(e.message);
      pushFeed(`simulate failed: ${e.message}`);
    } finally {
      setSimulating(false);
    }
  };

  const handleGraduate = async () => {
    pushFeed('requesting graduation to live mode…');
    try {
      const s = await sandboxApi.graduate();
      setStatus(s?.sandbox || s);
      pushFeed('graduated — sandbox disabled, live mode active ✓');
    } catch (e: any) {
      setError(e.message);
      pushFeed(`graduation failed: ${e.message}`);
    }
  };

  const handleAlertRead = async (id: string) => {
    try {
      await sandboxApi.alertRead(id);
      setAlerts((a) => a.map((al) => (al.id === id ? { ...al, read: true } : al)));
    } catch { /* ignore */ }
  };

  const gradPct =
    status && status.graduationThreshold > 0
      ? Math.min(100, (status.testRescuesSucceeded / status.graduationThreshold) * 100)
      : 0;

  const unreadAlerts = alerts.filter((a) => !a.read);

  const qualityRating = quality?.qualityRating ?? quality?.rating ?? null;
  const qualityCls =
    qualityRating === 'GREEN' ? 'ok' :
    qualityRating === 'YELLOW' ? 'warn' :
    qualityRating === 'RED' ? 'crit' : '';

  return (
    <div className="sb">
      <div className="sb-grid-bg" aria-hidden="true" />
      <div className="sb-grain" aria-hidden="true" />
      <div className="sb-scan" aria-hidden="true" />

      {/* Header */}
      <header className="sb-top">
        <Link to="/dashboard" className="sb-back">← Dashboard</Link>
        <h1 className="sb-title">Sandbox & Safety</h1>
        <span className="sb-top__tag">test deck</span>
      </header>

      <div className="sb-body">
        {/* ── Left: status + controls ── */}
        <div className="sb-main">
          {/* Mode toggle card */}
          <section className="sb-card">
            <div className="sb-card__head">
              <h2>Sandbox Mode</h2>
              {qualityRating && (
                <span className={`sb-quality sb-quality--${qualityCls}`}>
                  WABA {qualityRating}
                </span>
              )}
            </div>
            <p className="sb-card__desc">
              When enabled, all outbound WhatsApp rescue messages redirect to your
              registered phone number. No customer is contacted.
            </p>
            <div className="sb-toggle-row">
              <button
                className={`sb-toggle ${status?.enabled ? 'sb-toggle--on' : ''}`}
                onClick={handleToggle}
                aria-pressed={status?.enabled}
              >
                <span className="sb-toggle__knob" />
              </button>
              <span className="sb-toggle__label">
                {status?.enabled ? 'Sandbox ON' : 'Sandbox OFF'}
              </span>
              {status?.graduated && (
                <span className="sb-badge sb-badge--grad">✓ Graduated</span>
              )}
            </div>
            {error && <p className="sb-error">⚠ {error}</p>}
          </section>

          {/* Graduation progress */}
          <section className="sb-card">
            <h2>Graduation Progress</h2>
            <p className="sb-card__desc">
              Complete {status?.graduationThreshold ?? 3} successful test rescues to
              auto-graduate to live mode.
            </p>
            <div className="sb-geo">
              <div className="sb-geo__track">
                <div
                  className="sb-geo__fill"
                  style={{ width: `${gradPct}%` }}
                />
              </div>
              <span className="sb-geo__label">
                {status?.testRescuesSucceeded ?? 0} / {status?.graduationThreshold ?? 3}
              </span>
            </div>
            <div className="sb-sim-row">
              <button
                className="sb-sim-btn"
                onClick={handleSimulate}
                disabled={simulating || !status?.enabled}
              >
                {simulating ? 'Simulating…' : '⚡ Simulate NDR'}
              </button>
              {!status?.enabled && (
                <span className="sb-sim-hint">Enable sandbox first</span>
              )}
            </div>
            {lastSim && (
              <div className="sb-sim-result">
                <span className="sb-sim-result__awb">AWB {lastSim.awb || 'SIM'}</span>
                <span className="sb-sim-result__reason">{lastSim.reason || 'simulated_ndr'}</span>
              </div>
            )}
            {status && !status.graduated && status.testRescuesSucceeded >= status.graduationThreshold && (
              <button className="sb-grad-btn" onClick={handleGraduate}>
                🎓 Graduate to Live
              </button>
            )}
          </section>

          {/* Status feed */}
          <section className="sb-card sb-card--feed">
            <h2>Status Feed</h2>
            <div className="sb-feed" ref={feedRef}>
              {feed.length === 0 && (
                <div className="sb-feed__line sb-feed__line--idle">
                  <span className="sb-feed__prefix">›</span> awaiting activity…
                </div>
              )}
              {feed.map((line, i) => (
                <div key={i} className="sb-feed__line">
                  <span className="sb-feed__prefix">›</span> {line}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Right: alerts sidebar ── */}
        <aside className="sb-side">
          <h2 className="sb-side__h">
            Alerts
            {unreadAlerts.length > 0 && (
              <span className="sb-side__count">{unreadAlerts.length}</span>
            )}
          </h2>
          {alerts.length === 0 && (
            <p className="sb-side__empty">No alerts. All systems nominal.</p>
          )}
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`sb-alert sb-alert--${a.severity} ${a.read ? 'sb-alert--read' : ''}`}
              onClick={() => !a.read && handleAlertRead(a.id)}
              role="button"
              tabIndex={0}
            >
              <span className="sb-alert__kind">{a.kind || a.severity}</span>
              <span className="sb-alert__title">{a.title}</span>
              <span className="sb-alert__body">{a.body}</span>
              <span className="sb-alert__time">
                {new Date(a.createdAt).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
