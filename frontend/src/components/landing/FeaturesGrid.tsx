import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { Zap, MapPin, CreditCard, ShieldCheck, SearchCheck, LineChart } from 'lucide-react';
import { SpotlightCard } from '../SpotlightCard';

const FEATURES = [
  {
    index: '01',
    code: 'SYS/NDR.90S',
    icon: Zap,
    title: 'Autonomous NDR Rescue',
    desc: 'Every failed attempt gets a WhatsApp response inside 90 seconds.',
    color: 'var(--signal-soft)',
    sla: '< 90s SLA',
  },
  {
    index: '02',
    code: 'SYS/ADR.FIX',
    icon: MapPin,
    title: '2-Step AI Address Fix',
    desc: 'GPS pin + Hinglish landmark merged and pushed to the driver app.',
    color: 'var(--amber-10)',
    sla: 'GEO-RESOLVE',
  },
  {
    index: '03',
    code: 'SYS/UPI.CNV',
    icon: CreditCard,
    title: 'COD → UPI Conversion',
    desc: 'Doorstep & cancel-time UPI links with self-funding discounts.',
    color: 'var(--emerald-15)',
    sla: 'INSTANT UPI',
  },
  {
    index: '04',
    code: 'SYS/RTO.GTE',
    icon: ShieldCheck,
    title: 'Payment-Gated RTO Arrest',
    desc: 'Return transit halts only when money is actually captured.',
    color: 'var(--signal-soft)',
    sla: 'GATE LOCKED',
  },
  {
    index: '05',
    code: 'SYS/NDR.DEC',
    icon: SearchCheck,
    title: 'Fake Remark Detection',
    desc: 'Odd-hour scans and 4-minute attempts auto-escalate to carrier supervisors.',
    color: 'var(--amber-10)',
    sla: 'AUTO-ESCALATE',
  },
  {
    index: '06',
    code: 'SYS/PIN.IDX',
    icon: LineChart,
    title: 'Pincode Intelligence',
    desc: 'Every pincode scored by real outcomes: courier vs customer vs address.',
    color: 'var(--emerald-15)',
    sla: 'TELEMETRY LIVE',
  },
];

export function FeaturesGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = !!useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const marqueeX = useTransform(scrollYProgress, [0, 1], ['0%', '-25%']);

  return (
    <div ref={containerRef} className="fgrid" aria-labelledby="features-heading">
      {/* ── Scroll-Linked Parallax Marquee Header ── */}
      <div className="nt-fgrid__marquee-wrap" aria-hidden="true">
        <motion.div
          className="nt-fgrid__marquee"
          style={reduced ? { transform: 'none' } : { x: marqueeX }}
        >
          AUTONOMOUS NDR ENGINE // ZERO HUMANS // 90s SLA // OVERRIDE FAKE SCANS // AUTOMATED RE-DELIVERY // GPS PIN GEO-RESOLUTION //
        </motion.div>
      </div>

      <div className="fgrid__container">
        <div className="fgrid__header">
          <span className="fgrid__eyebrow">CHAPTER 04 // 01–06 AUTONOMOUS SYSTEMS</span>
          <h2 id="features-heading" className="fgrid__heading nt-display">
            Six engines. <em className="nt-serif">Zero human delay.</em>
          </h2>
          <p className="fgrid__sub">
            Built for instantaneous execution so you never bleed freight or lose customers to fraudulent delivery remarks.
          </p>
        </div>

        <div className="fgrid__list">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <SpotlightCard
                key={feat.title}
                className="fgrid__card nt-bento-card"
                spotlightColor={feat.color}
              >
                <div className="fgrid__card-head">
                  <span className="fgrid__card-index">SYS / {feat.index}</span>
                  <span className="fgrid__card-code">{feat.code}</span>
                </div>
                <div className="fgrid__icon-wrap">
                  <Icon size={20} className="fgrid__icon" aria-hidden="true" />
                </div>
                <h3 className="fgrid__card-title">{feat.title}</h3>
                <p className="fgrid__card-desc">{feat.desc}</p>
                <div className="fgrid__card-foot">
                  <span className="fgrid__card-status">AUTONOMOUS GATE · {feat.sla}</span>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default FeaturesGrid;
