import React, { useEffect, useRef, useState, memo } from 'react';

/* ═══ SIMULATED RESCUE FEED DATA ═══ */
interface FeedEvent {
  t: string;
  msg: string;
  cls?: 'ndr' | 'action' | 'ok' | 'warn' | 'rescued' | 'cancelled';
  orderId?: string;
  outcome?: 'rescued' | 'cancelled';
  amt?: number;
}

const FEED_SCRIPT: FeedEvent[] = [
  { t: '14:32:07', msg: 'NDR received · AWB 4023118876 · Shiprocket', cls: 'ndr' },
  { t: '14:32:07', msg: 'reason: customer unavailable · attempt 2/3' },
  { t: '14:32:08', msg: 'dispatching rescue → ndr_reschedule_en', cls: 'action' },
  { t: '14:32:09', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:34:51', msg: 'customer confirmed re-delivery: "I am home"' },
  { t: '14:34:51', msg: 'ORDER RESCUED · ₹1,240 recovered', cls: 'rescued', orderId: '#89421', outcome: 'rescued', amt: 1240 },

  { t: '14:41:12', msg: 'NDR received · AWB 7719004523 · Delhivery', cls: 'ndr' },
  { t: '14:41:12', msg: 'reason: incomplete address / wrong landmark · attempt 1/3' },
  { t: '14:41:13', msg: 'multiple saved addresses detected · initiating GPS pin flow', cls: 'warn' },
  { t: '14:41:14', msg: 'dispatching rescue → ndr_address_en', cls: 'action' },
  { t: '14:41:15', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:43:02', msg: 'customer shared 1-tap GPS pin on WhatsApp ✓', cls: 'ok' },
  { t: '14:43:03', msg: 'verified GPS address synced → Delhivery API', cls: 'action' },
  { t: '14:43:03', msg: 'ORDER RESCUED · ₹890 recovered', cls: 'rescued', orderId: '#89435', outcome: 'rescued', amt: 890 },

  { t: '14:48:20', msg: 'NDR received · AWB 9921004182 · ClickPost', cls: 'ndr' },
  { t: '14:48:21', msg: 'reason: customer refused · attempt 1/3' },
  { t: '14:48:22', msg: 'dispatching rescue → ndr_retention_en', cls: 'action' },
  { t: '14:48:23', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:49:10', msg: 'customer reply: "Ordered by mistake, please cancel"' },
  { t: '14:49:11', msg: 'ORDER CANCELLED · return transit aborted · ₹160 freight saved', cls: 'cancelled', orderId: '#89448', outcome: 'cancelled' },

  { t: '14:52:30', msg: 'NDR received · AWB 3301998871 · Delhivery', cls: 'ndr' },
  { t: '14:52:31', msg: 'reason: out of station · attempt 1/3' },
  { t: '14:52:32', msg: 'dispatching rescue → ndr_reschedule_en', cls: 'action' },
  { t: '14:52:33', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:55:18', msg: 'customer rescheduled → Tomorrow, 9 AM–12 PM', cls: 'ok' },
  { t: '14:55:18', msg: 'ORDER RESCUED · ₹1,560 recovered', cls: 'rescued', orderId: '#89452', outcome: 'rescued', amt: 1560 },

  { t: '14:57:04', msg: 'NDR received · AWB 8812903112 · Shiprocket', cls: 'ndr' },
  { t: '14:57:05', msg: 'reason: COD cash not ready · attempt 2/3' },
  { t: '14:57:06', msg: 'dispatching 1-click UPI conversion link', cls: 'action' },
  { t: '14:58:12', msg: 'customer opted to cancel on WhatsApp' },
  { t: '14:58:13', msg: 'ORDER CANCELLED · return to hub · stock released in Shopify', cls: 'cancelled', orderId: '#89467', outcome: 'cancelled' },
];

type OrderStatus = 'failed' | 'pending' | 'rescued' | 'cancelled';
interface OrderCard { id: string; awb: string; amount: string; status: OrderStatus; }
const ORDER_BOARD: OrderCard[] = [
  { id: '#89421', awb: '4023118876', amount: '₹1,240', status: 'failed' },
  { id: '#89435', awb: '7719004523', amount: '₹890', status: 'failed' },
  { id: '#89448', awb: '9921004182', amount: '₹2,150', status: 'failed' },
  { id: '#89452', awb: '3301998871', amount: '₹1,560', status: 'pending' },
  { id: '#89467', awb: '8812903112', amount: '₹740', status: 'pending' },
];

interface HeroDispatchRadarProps {
  booted: boolean;
}

export const HeroDispatchRadar: React.FC<HeroDispatchRadarProps> = memo(({ booted }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisibleRef = useRef(true);
  const feedCounterRef = useRef(0);

  const [feedLines, setFeedLines] = useState<{ id: string; t: string; msg: string; cls?: string }[]>([]);
  const [feedIdx, setFeedIdx] = useState(0);
  const [recovered, setRecovered] = useState(483750);
  const [rescuedCount, setRescuedCount] = useState(387);
  const [_orders, setOrders] = useState<OrderCard[]>(ORDER_BOARD);

  // Pause telemetry loop when off-screen or tab hidden to consume ZERO idle CPU
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        isVisibleRef.current = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.1 }
    );
    observer.observe(el);

    const handleVisibility = () => {
      isVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Autonomous NDR simulation loop isolated exclusively to this component
  useEffect(() => {
    if (!booted) return;

    if (feedIdx >= FEED_SCRIPT.length) {
      const reset = setTimeout(() => {
        if (isVisibleRef.current) {
          setFeedLines([]);
          setOrders(ORDER_BOARD);
          setFeedIdx(0);
        }
      }, 1500);
      return () => clearTimeout(reset);
    }

    const currentEvt = FEED_SCRIPT[feedIdx];
    const delay = currentEvt.cls === 'rescued' || currentEvt.cls === 'cancelled' ? 800 : 350;

    const timer = setTimeout(() => {
      if (!isVisibleRef.current) {
        // Still advance idx so feed stays progressing when user scrolls back up
        setFeedIdx((i) => i + 1);
        return;
      }

      const lineObj = { ...currentEvt, id: `feed-${++feedCounterRef.current}` };
      setFeedLines((prev) => [...prev.slice(-8), lineObj]);
      setFeedIdx((i) => i + 1);

      if (currentEvt.outcome === 'rescued') {
        const amt = currentEvt.amt || 1000;
        setRecovered((r) => r + amt);
        setRescuedCount((c) => c + 1);
        setOrders((prev) => {
          const idx = currentEvt.orderId ? prev.findIndex((o) => o.id === currentEvt.orderId) : prev.findIndex((o) => o.status === 'failed' || o.status === 'pending');
          if (idx === -1) return prev;
          const copy = [...prev];
          copy[idx] = { ...copy[idx]!, status: 'rescued' };
          return copy;
        });
      } else if (currentEvt.outcome === 'cancelled') {
        setOrders((prev) => {
          const idx = currentEvt.orderId ? prev.findIndex((o) => o.id === currentEvt.orderId) : prev.findIndex((o) => o.status === 'failed' || o.status === 'pending');
          if (idx === -1) return prev;
          const copy = [...prev];
          copy[idx] = { ...copy[idx]!, status: 'cancelled' };
          return copy;
        });
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [booted, feedIdx]);

  // Subtle real-time increment to recovered amount ticker
  useEffect(() => {
    if (!booted) return;
    const iv = setInterval(() => {
      if (isVisibleRef.current) {
        setRecovered((r) => r + Math.floor(Math.random() * 80 + 20));
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [booted]);

  return (
    <div
      ref={containerRef}
      className="lp-console"
      aria-label="Interactive live NDR intercept demonstration"
    >
      <div className="lp-console__head">
        <div className="flex items-center gap-2">
          <span className="lp-console__dot lp-console__dot--r" />
          <span className="lp-console__dot lp-console__dot--a" />
          <span className="lp-console__dot lp-console__dot--g" />
          <span className="lp-console__title">RESCUESHIP // DISPATCH RADAR</span>
        </div>
        <span className="lp-console__live">
          DEMO FEED · ACTIVE
        </span>
      </div>

      <div className="lp-console__channels">
        <span className="lp-console__watch">LISTENERS:</span>
        <span className="lp-console__chip"><i />Shiprocket</span>
        <span className="lp-console__chip"><i />Delhivery</span>
        <span className="lp-console__chip"><i />Blue Dart</span>
        <span className="lp-console__chip"><i />ClickPost</span>
      </div>

      <div className="lp-console__scroll" role="log" aria-live="polite">
        <div className="lp-feed">
          {feedLines.length > 0 ? (
            feedLines.map((line) => (
              <div key={line.id} className={`lp-feed__line lp-feed__line--${line.cls || 'idle'}`}>
                <span className="lp-feed__t">[{line.t}]</span>
                <span className="lp-feed__msg">{line.msg}</span>
              </div>
            ))
          ) : (
            <div className="lp-feed__line lp-feed__line--idle">
              <span className="lp-feed__t">[14:32:00]</span>
              <span className="lp-feed__msg">listening for incoming carrier NDR webhooks…</span>
            </div>
          )}
        </div>
      </div>

      {/* Compact Bottom 3-Metric Strip (Preserves Playwright .lp-stat__n hooks) */}
      <div className="lp-console__stats" role="group" aria-label="Sample recovery metrics">
        <div className="lp-stat">
          <div className="lp-stat__n">₹{recovered.toLocaleString('en-IN')}</div>
          <div className="lp-stat__l">Simulated monthly save</div>
        </div>
        <div className="lp-stat">
          <div className="lp-stat__n">{rescuedCount}</div>
          <div className="lp-stat__l">Orders rescued</div>
        </div>
        <div className="lp-stat">
          <div className="lp-stat__n">&lt; 90s</div>
          <div className="lp-stat__l">Avg intercept SLA</div>
        </div>
      </div>
    </div>
  );
});

export default HeroDispatchRadar;
