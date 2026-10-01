import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  DoorClosed,
  MapPin,
  IndianRupee,
  PackageX,
  BadgeCheck,
  CheckCheck,
  RotateCcw,
  BellRing,
} from 'lucide-react';

/* ═══ WhatsApp rescue chat — interactive decision tree (tap-driven, all devices) ═══ */
type MsgTone = 'ok' | 'warn' | 'cancel' | 'engine';
interface Msg { id: number; kind: 'bot' | 'user' | 'sys' | 'status'; text: string; tone?: MsgTone; }
interface Choice { id: string; label: string; danger?: boolean; run: () => void; }
export type Scenario = 'locked' | 'address' | 'cod' | 'rto' | 'predeliv';

const SCENARIOS = [
  { id: 'locked' as const, label: 'Door Locked', icon: DoorClosed },
  { id: 'address' as const, label: 'Address / GPS', icon: MapPin },
  { id: 'cod' as const, label: 'COD → UPI', icon: IndianRupee },
  { id: 'rto' as const, label: 'RTO Arrest', icon: PackageX },
  { id: 'predeliv' as const, label: 'Pre-Delivery', icon: BellRing },
];

export interface RescueSceneProps {
  active: boolean;
  reduced: boolean;
}

export function RescueScene({ active, reduced }: RescueSceneProps) {
  const idRef = useRef(0);
  const nid = () => ++idRef.current;
  const [activeScenario, setActiveScenario] = useState<Scenario>('locked');
  const [log, setLog] = useState<Msg[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [typing, setTyping] = useState(false);
  const [phase, setPhase] = useState('8:00 PM · NDR intercepted');
  const [banner, setBanner] = useState<{ text: string; tone: string } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const started = useRef(false);

  function finish(bText: string, bTone: string, sText: string, sTone: MsgTone) {
    setLog((l) => [...l, { id: nid(), kind: 'status', text: sText, tone: sTone }]);
    setBanner({ text: bText, tone: bTone });
    setChoices([]);
  }

  function say(
    user: string | null, sys: string | null, bot: string,
    after: () => void, sysTone: MsgTone = 'engine',
  ) {
    const add: Msg[] = [];
    if (user) add.push({ id: nid(), kind: 'user', text: user });
    if (sys) add.push({ id: nid(), kind: 'sys', text: sys, tone: sysTone });
    setLog((l) => [...l, ...add]);
    setChoices([]);
    setTyping(true);
    timer.current = window.setTimeout(() => {
      setLog((l) => [...l, { id: nid(), kind: 'bot', text: bot }]);
      setTyping(false);
      after();
    }, reduced ? 0 : 750);
  }

  function seed(targetScenario?: Scenario) {
    const sc = targetScenario || activeScenario;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setBanner(null);
    setTyping(false);

    if (sc === 'locked') {
      setPhase('8:00 PM · NDR intercepted');
      setLog([{ id: nid(), kind: 'bot', text: 'Hi Priya 👋 Order #89421 (₹1,240) was marked “door locked” at 7:58 PM. We couldn’t confirm a delivery attempt — what would you like to do?' }]);
      setChoices([
        { id: 'home', label: '🏠 I’m Home Now', run: doHome },
        { id: 'resched', label: '📅 Reschedule', run: doReschedule },
        { id: 'cancel', label: '❌ Cancel Order', danger: true, run: () => doCancel('Priya', 1240, 62) },
      ]);
    } else if (sc === 'address') {
      setPhase('2:14 PM · address ambiguous');
      setLog([{ id: nid(), kind: 'bot', text: 'Hi Rahul 👋 Delivery partner is near pincode 560038 but cannot locate: “Flat 402, Green Glen Layout”. Could you help us find you?' }]);
      setChoices([
        { id: 'gps', label: '📍 Share GPS Pin', run: doAddressGps },
        { id: 'landmark', label: '✏️ Type Landmark', run: doAddressLandmark },
        { id: 'cancel', label: '❌ Cancel Order', danger: true, run: () => doCancel('Rahul', 890, 45) },
      ]);
    } else if (sc === 'cod') {
      setPhase('3:45 PM · COD cash friction');
      setLog([{ id: nid(), kind: 'bot', text: 'Hi Ananya 👋 Delivery partner is at your doorstep for Order #77319 (₹1,850 COD). Pay online now to complete contactless delivery.' }]);
      setChoices([
        { id: 'pay_upi', label: '💳 Pay ₹1,757 via UPI', run: doCodPayUpi },
        { id: 'resched_cod', label: '🔄 Reschedule with Cash', run: doReschedule },
        { id: 'cancel', label: '❌ Cancel Order', danger: true, run: () => doCancel('Ananya', 1850, 93) },
      ]);
    } else if (sc === 'rto') {
      setPhase('6:20 PM · RTO arrest window (2 min)');
      setLog([{ id: nid(), kind: 'bot', text: '🚨 URGENT: Order #64201 (₹2,499) was marked for Return-to-Origin at Mumbai Hub. Pay online via UPI to halt return transit before reverse shipping begins.' }]);
      setChoices([
        { id: 'halt_rto', label: '🛑 Pay ₹2,349 via UPI (Halt RTO)', run: doRtoHalt },
        { id: 'confirm_rto', label: '📦 Confirm Return', danger: true, run: doRtoConfirmReturn },
      ]);
    } else if (sc === 'predeliv') {
      setPhase('11:20 AM · risk gate passed (pincode risk 0.31 · COD ₹1,240)');
      setLog([{
        id: nid(),
        kind: 'bot',
        text: 'Hi Priya 👋 Order #89421 (₹1,240 COD) is out for delivery today with DELHIVERY. Will you be available to receive it?',
      }]);
      setChoices([
        { id: 'pre_home', label: "✅ Yes, I'm home", run: doPreHome },
        { id: 'pre_resched', label: '📅 Reschedule', run: doPreReschedule },
        { id: 'pre_addr', label: '📍 Update address', run: doPreAddress },
        { id: 'pre_cancel', label: "❌ Don't want it", danger: true, run: doPreCancel },
      ]);
    }
  }

  /* Scenario 1: Premises Locked */
  function doHome() {
    setPhase('8:02 PM · evening exception scan');
    say('Yes I’m home! Nobody came to my door! 😤',
      '⚡ attempt flagged suspicious · OFD→NDR: 4 min · Supervisor #8812 escalated',
      'Thanks for confirming, Priya! Evening hub dispatches close at 8 PM, so a same‑day re‑visit isn’t possible tonight — we’ve flagged this attempt for review and reserved First‑Slot Priority Delivery for you tomorrow, 9 AM–12 PM. 🚚',
      () => finish('✅ ORDER RESCUED · RTO prevented', 'ok', 'Order rescued · priority slot reserved · trust restored', 'ok'),
      'warn');
  }

  function doReschedule() {
    say('Can we reschedule this?', null,
      'Of course — pick a day that works and we’ll lock it with the carrier so the same remark can’t happen twice.',
      () => setChoices([
        { id: 'r1', label: '📅 Tomorrow', run: () => pickResched('Tomorrow') },
        { id: 'r2', label: '📅 Day After Tomorrow', run: () => pickResched('Day After Tomorrow') },
        { id: 'r3', label: '📅 This Weekend', run: () => pickResched('This Weekend') },
      ]));
  }

  function pickResched(w: string) {
    say(`Reschedule for ${w}, please.`, 'reschedule synced to carrier · slot locked',
      `Locked in — your re‑attempt is set for ${w} and the carrier is updated. We’ll message you an hour before the driver arrives. 📅`,
      () => finish('✅ RESCHEDULED · slot locked', 'ok', `Rescheduled · ${w} · reminder set`, 'ok'));
  }

  /* Scenario 2: Address / GPS Pin / Landmark (2-3 Step Flow) */
  function doAddressGps() {
    setPhase('2:15 PM · Step 1/2 · reverse-geocoding');
    say('Here is my live location pin 📍',
      '📍 GPS received · 12.9279°N 77.6824°E · accuracy 4m · reverse-geocoded',
      'Got your pin! We resolved it to: “Near Neelkanth Temple, 2nd Cross, Koramangala”. Is this correct, or would you like to add floor/tower details?',
      () => setChoices([
        { id: 'gps_ok', label: '✅ Correct, deliver here', run: doAddressGpsConfirm },
        { id: 'gps_add', label: '✏️ Add floor / tower', run: doAddressGpsAddDetails },
        { id: 'cancel', label: '❌ Cancel Order', danger: true, run: () => doCancel('Rahul', 890, 45) },
      ]));
  }

  function doAddressGpsConfirm() {
    say('Correct, deliver here',
      'address synced → Delhivery Driver App · ETA 8 min',
      'Address confirmed and driver re-routed! Delivery partner has your exact coordinates. 🚚',
      () => finish('✅ ADDRESS CONFIRMED · driver re-routed', 'ok', 'GPS coordinates synced to carrier', 'ok'));
  }

  function doAddressGpsAddDetails() {
    setPhase('2:16 PM · Step 2/2 · merging GPS + text');
    say('Tower B, 4th floor, opposite lift',
      '📍+✏️ combined · GPS + landmark merged · pushed to carrier API',
      'Perfect — driver now has your exact coordinates AND floor details. Re-delivery ETA 8 minutes. 🚚',
      () => finish('✅ FULL ADDRESS SYNCED · precision delivery', 'ok', 'Coordinates + floor notes pushed to carrier', 'ok'));
  }

  function doAddressLandmark() {
    setPhase('2:15 PM · Step 1/2 · NLP extraction');
    say('Neelkanth temple ke peeche, blue gate wala building',
      '🧠 Gemini AI parsed · landmark: “Neelkanth Temple” · note: “Behind, blue gate building”',
      'Landmark noted! Would you also like to share your 1-tap GPS pin for pinpoint driver accuracy, or is the landmark enough?',
      () => setChoices([
        { id: 'add_pin', label: '📍 Drop live GPS pin too', run: doAddressGpsAddDetails },
        { id: 'landmark_ok', label: '✅ Landmark is enough', run: doAddressLandmarkOnly },
        { id: 'cancel', label: '❌ Cancel Order', danger: true, run: () => doCancel('Rahul', 890, 45) },
      ]));
  }

  function doAddressLandmarkOnly() {
    say('Landmark is enough, please deliver',
      'driver instructions updated · re-attempt scheduled today',
      'Driver instructions updated with your landmark: “Behind Neelkanth Temple, blue gate building”. Re-attempting today! 📍',
      () => finish('✅ ADDRESS CORRECTED · driver note synced', 'ok', 'Driver instructions updated · re-attempt today', 'ok'));
  }

  /* Scenario 3: COD Cash Friction → Instant UPI */
  function doCodPayUpi() {
    setPhase('3:46 PM · dynamic payment link');
    say('Pay ₹1,757 via 1-click UPI 💳',
      '⚡ Razorpay dynamic UPI link generated · ₹93 discount applied · COD→Prepaid',
      'Payment link generated! Pay securely via GPay, PhonePe, or Paytm — your order will be marked Prepaid in the driver’s handheld immediately. 📱',
      () => setChoices([
        { id: 'upi_done', label: '✅ Complete UPI Payment', run: doCodConfirmPayment },
        { id: 'cancel', label: '❌ Cancel Order', danger: true, run: () => doCancel('Ananya', 1850, 93) },
      ]));
  }

  function doCodConfirmPayment() {
    setPhase('3:47 PM · carrier COD adjustment');
    say('Paid ₹1,757 on UPI ✅',
      '✓ ₹1,757 captured · Shopify tagged: RescueShip_Prepaid · carrier COD adjusted to ₹0',
      'Payment confirmed! Order converted to prepaid. Handover verified without cash friction. Thank you! 💜',
      () => finish('✅ RESCUED · converted to prepaid', 'ok', 'COD → Prepaid · ₹93 saved · zero cash friction', 'ok'));
  }

  /* Scenario 4: High-Urgency RTO Arrest (Gated on Prepaid Payment) */
  function doRtoHalt() {
    setPhase('6:21 PM · hub line-haul halt · payment required');
    say('I want to keep my order!',
      '🛑 RTO-Arrest · generating UPI payment link · ₹150 prepaid discount applied',
      'Convert to prepaid now to halt the return and save ₹150. Pay ₹2,349 via instant UPI to lock in priority delivery tomorrow.',
      () => setChoices([
        { id: 'pay_rto', label: '💳 Pay ₹2,349 via UPI (Halt RTO)', run: doRtoPayConfirm },
        { id: 'confirm_rto', label: '📦 Confirm Return', danger: true, run: doRtoConfirmReturn },
      ]));
  }

  function doRtoPayConfirm() {
    say('Paid ₹2,349 on UPI ✅',
      '✓ ₹2,349 captured · COD→Prepaid · transit halt confirmed · BlueDart AWB override locked',
      'Return cancelled! Converted to prepaid at ₹2,349. Transit has been halted at Mumbai hub and re-routed for tomorrow morning delivery. 🛡️',
      () => finish('✅ RTO ARRESTED · COD→Prepaid · re-delivery locked', 'ok', 'RTO aborted · payment captured · transit reversed', 'ok'));
  }

  function doRtoConfirmReturn() {
    setPhase('6:21 PM · return authorized');
    say('Yes, confirm return',
      'return confirmed · refund pipeline queued',
      'Return confirmed. The package will return to the seller and any applicable refund will process within 5–7 business days. Thank you! 💜',
      () => finish('❌ RTO CONFIRMED · refund initiated', 'cancel', 'Order returned · clean exit', 'cancel'),
      'cancel');
  }

  /* Scenario 5: Pre-Delivery Prevention */
  function doPreHome() {
    setPhase('11:21 AM · delivery confirmed');
    say(
      "Yes, I'm home!",
      'presence confirmed · courier proceeds · attempt risk removed',
      'Perfect! The driver arrives today, 2–6 PM. Keep ₹1,240 ready — or pay via UPI link to skip cash entirely. 🚚',
      () => finish('✅ FAILURE PREVENTED · before it existed', 'ok', 'Presence confirmed · courier proceeds · attempt risk removed', 'ok'),
      'ok'
    );
  }

  function doPreReschedule() {
    say(
      'Can we reschedule this?',
      null,
      'Of course — pick a day that works and we’ll lock it with the carrier so the same remark can’t happen twice.',
      () => setChoices([
        { id: 'pr1', label: '📅 Tomorrow', run: () => pickPreResched('Tomorrow') },
        { id: 'pr2', label: '📅 Day After Tomorrow', run: () => pickPreResched('Day After Tomorrow') },
        { id: 'pr3', label: '📅 This Weekend', run: () => pickPreResched('This Weekend') },
      ])
    );
  }

  function pickPreResched(w: string) {
    say(
      `Reschedule for ${w}, please.`,
      'slot locked with carrier · zero failed attempts logged',
      `Locked in — your delivery is set for ${w} and the carrier is updated. We’ll message you an hour before the driver arrives. 📅`,
      () => finish('✅ RESCHEDULED PRE-EMPTIVELY', 'ok', `Slot locked with carrier · ${w} · zero failed attempts logged`, 'ok')
    );
  }

  function doPreAddress() {
    setPhase('11:21 AM · address update');
    say(
      'I need to update my address 📍',
      'initiating 2-step address correction flow',
      'No problem! You can drop a 1-tap live GPS pin or type a nearby landmark. How would you like to update?',
      () => setChoices([
        { id: 'pre_gps', label: '📍 Share GPS Pin', run: doAddressGps },
        { id: 'pre_landmark', label: '✏️ Type Landmark', run: doAddressLandmark },
      ])
    );
  }

  function doPreCancel() {
    setPhase('11:21 AM · cancelled pre-transit');
    say(
      "Don't want it",
      'parcel stopped at hub · ₹160 forward freight saved · no reverse leg created',
      'Understood — we stopped the parcel before it left the hub. Nothing shipped, nothing wasted. 💜',
      () => finish('✅ CANCELLED PRE-TRANSIT', 'cancel', 'Parcel stopped at hub · ₹160 forward freight saved · no reverse leg created', 'cancel'),
      'cancel'
    );
  }

  /* Anti-Exploitation Cancel & Self-Funding COD→Prepaid Retention */
  function doCancel(name: string = 'shopper', orderValue = 1240, discount = 62) {
    const finalAmount = orderValue - discount;
    setPhase('8:03 PM · COD→Prepaid retention offer');
    say(
      'Cancel order',
      '🛡️ retention engine · self-funding COD→Prepaid check',
      `Before we cancel, ${name} — convert to prepaid now and save ₹${discount} (5% COD fee waiver)! Your new total is ₹${finalAmount.toLocaleString('en-IN')}. Prepaid orders skip cash-collection queues and get priority dispatch.`,
      () => {
        setBanner({ text: '💳 Self-Funding Retention Active', tone: 'engine' });
        setChoices([
          { id: 'pay', label: `💳 Pay ₹${finalAmount.toLocaleString('en-IN')} via UPI`, run: () => payPrepaidRetention(finalAmount, discount) },
          { id: 'no', label: '❌ Confirm Cancellation', danger: true, run: finalCancel },
        ]);
      }
    );
  }

  function payPrepaidRetention(finalAmount: number, discount: number) {
    setPhase('8:04 PM · carrier COD adjustment');
    say(
      `Paid ₹${finalAmount.toLocaleString('en-IN')} via UPI ✅`,
      `✓ ₹${finalAmount.toLocaleString('en-IN')} captured · Shopify tagged: RescueShip_Prepaid · carrier COD adjusted to ₹0`,
      `Payment confirmed! Your order is now prepaid, saving you ₹${discount} with zero cash friction. Delivery priority confirmed with courier. Thank you! 💜`,
      () => finish('✅ RESCUED · converted to prepaid', 'ok', `COD → Prepaid · ₹${discount} saved · zero cash friction`, 'ok')
    );
  }

  function finalCancel() {
    setPhase('8:04 PM · clean cancellation');
    say(
      'Confirm cancellation',
      'order cancelled · return to warehouse initiated · stock released in Shopify',
      'Understood — your order is cancelled and the return is confirmed. Any applicable refund will process within 5–7 business days. Thanks for trying us! 💜',
      () => finish('❌ CANCELLED · return initiated', 'cancel', 'Order cancelled · clean exit · no coupon abuse', 'cancel'),
      'cancel'
    );
  }

  useEffect(() => {
    if (active && !started.current) {
      started.current = true;
      seed('locked');
    }
  }, [active]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
  }, [log, typing, choices, reduced]);

  const renderItem = (m: Msg) => {
    if (m.kind === 'sys')
      return (
        <motion.div key={m.id} className="lp-wa__row lp-wa__row--sync"
          initial={reduced ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}>
          <span className={`lp-wa__sys ${m.tone ? `lp-wa__sys--${m.tone}` : ''}`}>{m.text}</span>
        </motion.div>
      );
    if (m.kind === 'status')
      return (
        <motion.div key={m.id} className={`lp-wa__status ${m.tone ? `lp-wa__status--${m.tone}` : ''}`}
          initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>{m.text}</motion.div>
      );
    return (
      <motion.div key={m.id} className={`lp-wa__row lp-wa__row--${m.kind}`}
        initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
        <div className={`lp-wa__bubble lp-wa__bubble--${m.kind}`}>
          <span>{m.text}</span>
          {m.kind === 'user' && (
            <span className="lp-wa__ticks" aria-label="Delivered and read">
              <CheckCheck size={13} aria-hidden="true" />
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="lp-wa">
      <div className="lp-wa__notch" aria-hidden="true">
        <span className="lp-wa__notch-cam" />
        <span className="lp-wa__notch-mic" />
      </div>

      <div className="lp-wa__head">
        <span className="lp-wa__av">⚓</span>
        <div className="lp-wa__who">
          <span className="lp-wa__name">
            RescueShip · your brand
            <BadgeCheck size={14} className="lp-wa__verified" aria-label="Official Verified Account" />
          </span>
          <span className="lp-wa__meta"><i />{phase}</span>
        </div>
        {active && (
          <button
            type="button"
            className="lp-wa__reset"
            onClick={() => seed()}
            aria-label="Reset conversation"
            title="Reset demo"
          >
            <RotateCcw size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      {active && (
        <div className="lp-wa__tabs" role="tablist" aria-label="Rescue scenario switcher">
          {SCENARIOS.map((s) => {
            const Icon = s.icon;
            const isActive = activeScenario === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`lp-wa__tab ${isActive ? 'lp-wa__tab--active' : ''}`}
                onClick={() => {
                  setActiveScenario(s.id);
                  seed(s.id);
                }}
              >
                <Icon size={12} aria-hidden="true" />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {active && banner && (
        <div className={`lp-wa__banner lp-wa__banner--${banner.tone}`} role="status" aria-live="assertive">
          {banner.text}
        </div>
      )}

      <div className="lp-wa__body" ref={bodyRef} role="log" aria-live="polite">
        <div className="lp-wa__spacer" aria-hidden="true" />
        {!active && (
          <div className="lp-wa__idle"><span>⚓</span><p>Initializing demo…</p></div>
        )}
        {active && log.map(renderItem)}
        {active && typing && (
          <div className="lp-wa__row lp-wa__row--bot">
            <div className="lp-wa__bubble lp-wa__bubble--bot lp-wa__typing" role="status" aria-label="Agent is typing">
              <i /><i /><i />
            </div>
          </div>
        )}
        {active && choices.length > 0 && (
          <div
            className={`lp-wa__choices ${typing ? 'lp-wa__choices--locked' : ''}`}
            role="group"
            aria-label="Quick reply options"
          >
            {choices.map((c) => (
              <button key={c.id} type="button"
                className={`lp-wa__chip ${c.danger ? 'lp-wa__chip--danger' : ''}`}
                disabled={typing} onClick={c.run}>{c.label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
