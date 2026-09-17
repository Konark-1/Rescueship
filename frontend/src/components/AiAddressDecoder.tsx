import { useState } from 'react';
import { motion } from 'motion/react';

interface Scenario {
  id: string;
  tabLabel: string;
  badge: string;
  tone: 'indigo' | 'rose' | 'emerald';
  problem: string;
  rawInput: {
    channel: string;
    sender: string;
    text: string;
  };
  decodedPayload: {
    action: string;
    landmark?: string;
    coords?: string;
    note: string;
    courierApi: string;
    recoveryOutcome: string;
  };
}

const SCENARIOS: Scenario[] = [
  {
    id: 'landmark',
    tabLabel: 'Colloquial Landmark',
    badge: 'Address Disambiguation',
    tone: 'indigo',
    problem: 'Courier logs "incomplete address" because Indian residential street addresses lack standard pin codes.',
    rawInput: {
      channel: 'WhatsApp Message / Audio Note',
      sender: 'Customer (+91 98201 ····)',
      text: '“Bhaiya mandir ke peeche jo white building hai, 2nd floor pe aa jao. Gate pe call kar lena bell kharab hai.”',
    },
    decodedPayload: {
      action: 'AI_LANDMARK_EXTRACTION_AND_GEOCODE',
      landmark: 'White building, 2nd floor (behind Shiv Mandir)',
      coords: '19.0760° N, 72.8777° E (via 1-tap WhatsApp pin)',
      note: 'Driver Note: Ring on phone upon reaching gate (doorbell broken)',
      courierApi: 'Delhivery Rider App v4.2 · Waypoint Synced ✓',
      recoveryOutcome: '₹1,240 Order Saved · Re-attempt Scheduled 16:30',
    },
  },
  {
    id: 'fake-door',
    tabLabel: 'Fake Doorbell Lock',
    badge: 'NDR Fraud Intercept',
    tone: 'rose',
    problem: 'Driver marks "Customer unavailable / Door locked" in 4 minutes without calling to meet delivery quota.',
    rawInput: {
      channel: 'Shiprocket Webhook Event',
      sender: 'Courier NDR Status Stream',
      text: '“AWB 4023118876: Delivery attempt failed · Reason: Customer Unavailable / Premises Locked”',
    },
    decodedPayload: {
      action: 'AUTONOMOUS_INTERCEPT_AND_VERIFICATION',
      landmark: 'Customer Location: Geofence Verified at Home ✓',
      coords: 'Customer Timestamp: 14:32:09 · Responded in 42 seconds',
      note: 'Evidence: Customer active on WhatsApp · Dispatched hub escalation',
      courierApi: 'Shiprocket Escalation API · Marked Priority Re-attempt ✓',
      recoveryOutcome: 'Driver Re-routed · Return-to-Origin Prevented',
    },
  },
  {
    id: 'cod-conversion',
    tabLabel: 'COD Reluctance',
    badge: 'Prepaid Conversion',
    tone: 'emerald',
    problem: 'Shopper refuses delivery because they don’t have exact cash change for Cash-on-Delivery.',
    rawInput: {
      channel: 'WhatsApp 1-Tap Trigger',
      sender: 'Customer (+91 99172 ····)',
      text: '“Bhaiya change nahi hai, kal aana ya cancel kar do.”',
    },
    decodedPayload: {
      action: 'DYNAMIC_UPI_PRICE_MATCH_CONVERSION',
      landmark: 'Payment Intent: Instant 5% Prepaid Cash Discount',
      coords: 'Payment Gateway: Razorpay / Cashfree UPI Intent',
      note: 'Dynamic UPI QR: upi://pay?pa=brand@yesbank&am=1178 (₹62 saved)',
      courierApi: 'Order status changed to PREPAID in Shopify ✓',
      recoveryOutcome: 'Instant UPI Payment Completed · Zero Cash Friction',
    },
  },
];

export function AiAddressDecoder() {
  const [activeId, setActiveId] = useState<string>('landmark');
  const active = SCENARIOS.find((s) => s.id === activeId) || SCENARIOS[0];

  return (
    <div className="rs-decoder" aria-label="Interactive Logistics Scenario Decoder">
      <div className="rs-decoder__head">
        <span className="rs-decoder__kicker">scenario workbench</span>
        <h4 className="rs-decoder__title">Autonomous resolution for messy Indian delivery edge cases</h4>
        <p className="rs-decoder__sub">
          See how RescueShip takes colloquial WhatsApp messages, fake locked door remarks, and cash friction, converting them into verified courier actions.
        </p>

        {/* 21st.dev Animated Tabs with Spring Layout Indicator */}
        <div className="rs-decoder__tabs" role="tablist">
          {SCENARIOS.map((s) => {
            const isSelected = s.id === activeId;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveId(s.id)}
                className={`rs-decoder__tab ${isSelected ? 'is-active' : ''}`}
              >
                {isSelected && (
                  <motion.span
                    layoutId="scenario-pill"
                    className="rs-decoder__tab-pill"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <span className="rs-decoder__tab-text">{s.tabLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Side-by-Side Raw Input vs Decoded Carrier Payload */}
      <div className="rs-decoder__workbench">
        {/* Left: Raw Incoming Input */}
        <div className="rs-decoder__card rs-decoder__card--raw">
          <div className="rs-decoder__card-bar">
            <span className="rs-decoder__card-dot rs-decoder__card-dot--red" />
            <span className="rs-decoder__card-dot rs-decoder__card-dot--yellow" />
            <span className="rs-decoder__card-dot rs-decoder__card-dot--green" />
            <span className="rs-decoder__card-label">{active.rawInput.channel}</span>
          </div>
          <div className="rs-decoder__card-body">
            <span className="rs-decoder__card-sub">{active.rawInput.sender}</span>
            <blockquote className="rs-decoder__quote">{active.rawInput.text}</blockquote>
            <p className="rs-decoder__problem">
              <strong>The Problem:</strong> {active.problem}
            </p>
          </div>
        </div>

        {/* Arrow connector */}
        <div className="rs-decoder__arrow" aria-hidden="true">
          <span>⚡</span>
        </div>

        {/* Right: Decoded Carrier Dispatch Payload */}
        <div className={`rs-decoder__card rs-decoder__card--payload rs-decoder__card--${active.tone}`}>
          <div className="rs-decoder__card-bar">
            <span className="rs-decoder__tag">{active.badge}</span>
            <span className="rs-decoder__action">{active.decodedPayload.action}</span>
          </div>
          <div className="rs-decoder__card-body">
            {active.decodedPayload.landmark && (
              <div className="rs-decoder__row">
                <span className="rs-decoder__key">Landmark</span>
                <span className="rs-decoder__val">{active.decodedPayload.landmark}</span>
              </div>
            )}
            {active.decodedPayload.coords && (
              <div className="rs-decoder__row">
                <span className="rs-decoder__key">Coordinates</span>
                <span className="rs-decoder__val rs-decoder__val--mono">{active.decodedPayload.coords}</span>
              </div>
            )}
            <div className="rs-decoder__row">
              <span className="rs-decoder__key">Instruction</span>
              <span className="rs-decoder__val">{active.decodedPayload.note}</span>
            </div>
            <div className="rs-decoder__row">
              <span className="rs-decoder__key">Sync Target</span>
              <span className="rs-decoder__val rs-decoder__val--ok">{active.decodedPayload.courierApi}</span>
            </div>
            <div className="rs-decoder__outcome">
              <span className="rs-decoder__outcome-badge">RESULT</span>
              <span className="rs-decoder__outcome-text">{active.decodedPayload.recoveryOutcome}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AiAddressDecoder;
