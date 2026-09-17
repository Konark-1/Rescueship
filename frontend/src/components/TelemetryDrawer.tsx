import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TelemetryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_PAYLOAD = {
  _id: 'rec_ledger_66d92f1b4023118876',
  orderId: '#89421',
  awb: '4023118876',
  carrier: 'Shiprocket',
  merchantId: 'merch_7719a0',
  amountRecovered: 1240,
  currency: 'INR',
  ndrAttempt: 2,
  maxAttempts: 3,
  initialRemark: 'Customer unavailable / Door locked',
  resolutionChannel: 'WhatsApp Cloud API',
  timeToRescueSeconds: 84,
  events: [
    { t: '14:32:07.124', stage: 'WEBHOOK_INGEST', details: 'Ingested NDR event from Shiprocket API' },
    { t: '14:32:08.012', stage: 'RULE_ENGINE', details: 'Triggered pipeline ndr_rescue_en (attempt 2/3)' },
    { t: '14:32:09.450', stage: 'WHATSAPP_DELIVERY', details: 'Template delivered to customer (+91 98201 ····)' },
    { t: '14:34:51.218', stage: 'CUSTOMER_CONFIRMATION', details: 'Customer confirmed availability via 1-tap button' },
    { t: '14:34:52.004', stage: 'CARRIER_API_DISPATCH', details: 'Synced re-delivery coordinates to carrier driver' },
    { t: '14:34:52.880', stage: 'LEDGER_COMMITTED', details: 'Order marked RESCUED · ₹1,240 saved' },
  ],
};

export function TelemetryDrawer({ isOpen, onClose }: TelemetryDrawerProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const copyJson = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(SAMPLE_PAYLOAD, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="rs-drawer__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Slide-over Drawer Panel */}
          <motion.aside
            className="rs-drawer__panel"
            role="dialog"
            aria-modal="true"
            aria-label="Rescue Forensics Audit Trail"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="rs-drawer__head">
              <div>
                <span className="rs-drawer__kicker">mongodb · live ledger forensics</span>
                <h3 className="rs-drawer__title">Rescue Forensics Audit Trail</h3>
              </div>
              <button
                type="button"
                className="rs-drawer__close"
                onClick={onClose}
                aria-label="Close telemetry audit drawer"
              >
                ✕
              </button>
            </div>

            {/* Summary card */}
            <div className="rs-drawer__summary">
              <div className="rs-drawer__stat">
                <span className="rs-drawer__stat-lbl">Order</span>
                <span className="rs-drawer__stat-val">{SAMPLE_PAYLOAD.orderId}</span>
              </div>
              <div className="rs-drawer__stat">
                <span className="rs-drawer__stat-lbl">AWB</span>
                <span className="rs-drawer__stat-val">{SAMPLE_PAYLOAD.awb}</span>
              </div>
              <div className="rs-drawer__stat">
                <span className="rs-drawer__stat-lbl">Time to Rescue</span>
                <span className="rs-drawer__stat-val rs-drawer__stat-val--ok">
                  {SAMPLE_PAYLOAD.timeToRescueSeconds}s
                </span>
              </div>
              <div className="rs-drawer__stat">
                <span className="rs-drawer__stat-lbl">Recovered</span>
                <span className="rs-drawer__stat-val rs-drawer__stat-val--ok">
                  ₹{SAMPLE_PAYLOAD.amountRecovered}
                </span>
              </div>
            </div>

            {/* Timeline Stream */}
            <div className="rs-drawer__timeline">
              <h4 className="rs-drawer__section-title">Audit Log Stream</h4>
              <ol className="rs-drawer__events">
                {SAMPLE_PAYLOAD.events.map((ev, i) => (
                  <li key={i} className="rs-drawer__event">
                    <div className="rs-drawer__event-time">{ev.t}</div>
                    <div className="rs-drawer__event-body">
                      <span className="rs-drawer__event-stage">{ev.stage}</span>
                      <p className="rs-drawer__event-desc">{ev.details}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Raw JSON viewer */}
            <div className="rs-drawer__json-wrap">
              <div className="rs-drawer__json-head">
                <span>Raw Ledger Document (MongoDB)</span>
                <button type="button" className="rs-drawer__copy-btn" onClick={copyJson}>
                  {copied ? '✓ Copied JSON' : 'Copy JSON'}
                </button>
              </div>
              <pre className="rs-drawer__json">
                <code>{JSON.stringify(SAMPLE_PAYLOAD, null, 2)}</code>
              </pre>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default TelemetryDrawer;
