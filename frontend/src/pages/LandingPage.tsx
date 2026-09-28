import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  DeliveryTruckIcon,
  LockedDoorIcon,
  RescueRadarIcon,
  WhatsAppChatIcon,
  MapPinRerouteIcon,
  PackageDeliveredIcon,
  CheckmarkIcon,
} from '../components/icons';
import { CarrierMarquee } from '../components/CarrierMarquee';
import { SpotlightCard } from '../components/SpotlightCard';
import { AiAddressDecoder } from '../components/AiAddressDecoder';
import {
  DoorClosed,
  MapPin,
  IndianRupee,
  PackageX,
  BadgeCheck,
  CheckCheck,
  RotateCcw,
} from 'lucide-react';
import './landing.css';

/* ═══ BOOT SEQUENCE ═══ */
const BOOT_LINES = [
  { text: 'RescueShip NDR Recovery System', cls: 'brand' },
  { text: '› connecting courier webhooks ………… ✓', cls: 'ok' },
  { text: '› syncing carrier APIs ………… ✓', cls: 'ok' },
  { text: '› loading WhatsApp templates ………… ✓', cls: 'ok' },
  { text: '› automated recovery pipeline ready ………… ✓', cls: 'ok' },
  { text: '✓ system active — monitoring deliveries', cls: 'ready' },
];

/* ═══ SIMULATED RESCUE FEED — Indian couriers & webhooks ═══ */
interface FeedEvent {
  t: string;
  msg: string;
  cls?: 'ndr' | 'action' | 'ok' | 'warn' | 'rescued' | 'cancelled';
  orderId?: string;
  outcome?: 'rescued' | 'cancelled';
  amt?: number;
}

const FEED_SCRIPT: FeedEvent[] = [
  // Order #89421 (₹1,240) — Customer home & re-delivery confirmed
  { t: '14:32:07', msg: 'NDR received · AWB 4023118876 · Shiprocket', cls: 'ndr' },
  { t: '14:32:07', msg: 'reason: customer unavailable · attempt 2/3' },
  { t: '14:32:08', msg: 'dispatching rescue → ndr_reschedule_en', cls: 'action' },
  { t: '14:32:09', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:34:51', msg: 'customer confirmed re-delivery: "I am home"' },
  { t: '14:34:51', msg: 'ORDER RESCUED · ₹1,240 recovered', cls: 'rescued', orderId: '#89421', outcome: 'rescued', amt: 1240 },

  // Order #89435 (₹890) — GPS pin shared & synced
  { t: '14:41:12', msg: 'NDR received · AWB 7719004523 · Delhivery', cls: 'ndr' },
  { t: '14:41:12', msg: 'reason: incomplete address / wrong landmark · attempt 1/3' },
  { t: '14:41:13', msg: 'multiple saved addresses detected · initiating GPS pin flow', cls: 'warn' },
  { t: '14:41:14', msg: 'dispatching rescue → ndr_address_en', cls: 'action' },
  { t: '14:41:15', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:43:02', msg: 'customer shared 1-tap GPS pin on WhatsApp ✓', cls: 'ok' },
  { t: '14:43:03', msg: 'verified GPS address synced → Delhivery API', cls: 'action' },
  { t: '14:43:03', msg: 'ORDER RESCUED · ₹890 recovered', cls: 'rescued', orderId: '#89435', outcome: 'rescued', amt: 890 },

  // Order #89448 (₹2,150) — Cancelled by customer on WhatsApp (Return transit aborted early)
  { t: '14:48:20', msg: 'NDR received · AWB 9921004182 · ClickPost', cls: 'ndr' },
  { t: '14:48:21', msg: 'reason: customer refused · attempt 1/3' },
  { t: '14:48:22', msg: 'dispatching rescue → ndr_retention_en', cls: 'action' },
  { t: '14:48:23', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:49:10', msg: 'customer reply: "Ordered by mistake, please cancel"' },
  { t: '14:49:11', msg: 'ORDER CANCELLED · return transit aborted · ₹160 freight saved', cls: 'cancelled', orderId: '#89448', outcome: 'cancelled' },

  // Order #89452 (₹1,560) — Rescheduled for next morning
  { t: '14:52:30', msg: 'NDR received · AWB 3301998871 · Delhivery', cls: 'ndr' },
  { t: '14:52:31', msg: 'reason: out of station · attempt 1/3' },
  { t: '14:52:32', msg: 'dispatching rescue → ndr_reschedule_en', cls: 'action' },
  { t: '14:52:33', msg: 'WhatsApp delivered ✓', cls: 'ok' },
  { t: '14:55:18', msg: 'customer rescheduled → Tomorrow, 9 AM–12 PM', cls: 'ok' },
  { t: '14:55:18', msg: 'ORDER RESCUED · ₹1,560 recovered', cls: 'rescued', orderId: '#89452', outcome: 'rescued', amt: 1560 },

  // Order #89467 (₹740) — Cancelled by customer on WhatsApp (Stock returned to store)
  { t: '14:57:04', msg: 'NDR received · AWB 8812903112 · Shiprocket', cls: 'ndr' },
  { t: '14:57:05', msg: 'reason: COD cash not ready · attempt 2/3' },
  { t: '14:57:06', msg: 'dispatching 1-click UPI conversion link', cls: 'action' },
  { t: '14:58:12', msg: 'customer opted to cancel on WhatsApp' },
  { t: '14:58:13', msg: 'ORDER CANCELLED · return to hub · stock released in Shopify', cls: 'cancelled', orderId: '#89467', outcome: 'cancelled' },
];

const WATCHED = ['Shiprocket', 'Delhivery', 'ClickPost', 'webhook'];

type OrderStatus = 'failed' | 'pending' | 'rescued' | 'cancelled';
interface OrderCard { id: string; awb: string; amount: string; status: OrderStatus; }
const ORDER_BOARD: OrderCard[] = [
  { id: '#89421', awb: '4023118876', amount: '₹1,240', status: 'failed' },
  { id: '#89435', awb: '7719004523', amount: '₹890', status: 'failed' },
  { id: '#89448', awb: '9921004182', amount: '₹2,150', status: 'failed' },
  { id: '#89452', awb: '3301998871', amount: '₹1,560', status: 'pending' },
  { id: '#89460', awb: '5512093844', amount: '₹3,400', status: 'pending' },
  { id: '#89467', awb: '8812903112', amount: '₹740', status: 'pending' },
];

const LOSS_PARTS = [
  { label: 'Ad spend to acquire', amount: 230 },
  { label: 'Forward shipping', amount: 80 },
  { label: 'Reverse shipping (RTO)', amount: 80 },
  { label: 'Repackaging + QC', amount: 40 },
];

const SPINE_STEPS = [
  { n: '01', t: 'NDR intercepted', d: 'A courier logs a failed remark. We catch it in real-time via webhook — before the package starts its return journey.' },
  { n: '02', t: 'WhatsApp rescue dispatched', d: 'Your customer gets a branded message: confirm they’re home, reschedule, drop a GPS pin, or cancel. Their choice, your brand.' },
  { n: '03', t: 'Multiple addresses & GPS resolved', d: 'Shoppers often order with old or multiple saved addresses. RescueShip prompts for a 1-tap live GPS pin, parses with AI, and pushes verified coordinates straight to the courier driver.' },
  { n: '04', t: 'Revenue recovered', d: 'Order delivered on reattempt. COD optionally converted to prepaid via payment link. You keep the money.' },
];

/* ═══ Scroll reel — the same order, told in motion (desktop only) ═══ */
const REEL_BEATS = [
  { tag: '11:43', role: 'move', t: 'Out for delivery.', d: 'The parcel leaves the warehouse. So far, so normal.' },
  { tag: '11:47', role: 'wound', t: '“Door locked.” No knock.', d: 'Logged four minutes after the scan. No call, no doorbell.' },
  { tag: '11:47', role: 'engine', t: 'RescueShip intercepts.', d: 'The NDR is caught before the return journey begins.' },
  { tag: '11:48', role: 'engine', t: 'WhatsApp: “are you home?”', d: 'Verification, never accusation. The customer taps Yes.' },
  { tag: '11:49', role: 'engine', t: 'Driver re‑routed.', d: 'Corrected intent synced straight to the carrier.' },
  { tag: '15:20', role: 'rescue', t: 'Delivered. ₹1,240 kept.', d: 'No reverse freight. No repack. No wasted ad spend.' },
];

const REEL_ICONS = [
  <DeliveryTruckIcon key="truck" />,
  <LockedDoorIcon key="door" />,
  <RescueRadarIcon key="radar" />,
  <WhatsAppChatIcon key="wa" />,
  <MapPinRerouteIcon key="pin" />,
  <PackageDeliveredIcon key="package" />,
];

/* ═══ Helpers ═══ */
function SpawnWords({ text, booted, baseDelay = 0, className = '' }: {
  text: string; booted: boolean; baseDelay?: number; className?: string;
}) {
  return (
    <span className={className}>
      {text.split(' ').map((w, i, arr) => (
        <span key={i}>
          <motion.span
            className="lp-word"
            initial={{ opacity: 0, y: 26, filter: 'blur(7px)' }}
            animate={booted ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 26, filter: 'blur(7px)' }}
            transition={{ duration: 0.55, delay: baseDelay + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
          >
            {w}
          </motion.span>
          {i < arr.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}

function CountUp({ target, booted, prefix = '', suffix = '', duration = 1.6, delay = 0 }: {
  target: number; booted: boolean; prefix?: string; suffix?: string; duration?: number; delay?: number;
}) {
  const [val, setVal] = useState(0);
  const prevTargetRef = useRef(0);

  useEffect(() => {
    if (!booted) return;
    let raf = 0, start = 0;
    const startVal = prevTargetRef.current;
    const diff = target - startVal;
    prevTargetRef.current = target;

    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / (duration * 1000), 1);
        const easeP = 1 - Math.pow(1 - p, 3);
        setVal(Math.floor(startVal + easeP * diff));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay * 1000);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [booted, target, duration, delay]);
  return <>{prefix}{val.toLocaleString('en-IN')}{suffix}</>;
}

/* ═══ WhatsApp rescue chat — interactive decision tree (tap‑driven, all devices) ═══ */
type MsgTone = 'ok' | 'warn' | 'cancel' | 'engine';
interface Msg { id: number; kind: 'bot' | 'user' | 'sys' | 'status'; text: string; tone?: MsgTone; }
interface Choice { id: string; label: string; danger?: boolean; run: () => void; }
type Scenario = 'locked' | 'address' | 'cod' | 'rto';

const SCENARIOS = [
  { id: 'locked' as const, label: 'Door Locked', icon: DoorClosed },
  { id: 'address' as const, label: 'Address / GPS', icon: MapPin },
  { id: 'cod' as const, label: 'COD → UPI', icon: IndianRupee },
  { id: 'rto' as const, label: 'RTO Arrest', icon: PackageX },
];

function WaPhone({ active, reduced }: { active: boolean; reduced: boolean }) {
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

  useEffect(() => { if (active && !started.current) { started.current = true; seed('locked'); } }, [active]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const el = bodyRef.current; if (!el) return;
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

/* ═══ MAIN ═══ */
export default function LandingPage() {
  const [reduced, setReduced] = useState(() => {
    try { return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });
  const [booted, setBooted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(() => {
    try {
      return typeof window !== 'undefined' ? !(window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!sessionStorage.getItem('rs_booted')) : true;
    } catch { return true; }
  });

  const feedCounterRef = useRef(0);
  const [feedLines, setFeedLines] = useState<{ id: string; t: string; msg: string; cls?: string }[]>([]);
  const [feedIdx, setFeedIdx] = useState(0);
  const [recovered, setRecovered] = useState(4_83_750);
  const [rescuedCount, setRescuedCount] = useState(387);
  const [orders, setOrders] = useState<OrderCard[]>(ORDER_BOARD);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let r = false;
    try { r = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}
    setReduced(r);
    let seen = false;
    try { seen = !!sessionStorage.getItem('rs_booted'); } catch {}
    if (r || seen) {
      setShowOverlay(false);
      const t = setTimeout(() => setBooted(true), 40);
      return () => clearTimeout(t);
    }
    const t1 = setTimeout(() => setBooted(true), 1200);
    const t2 = setTimeout(() => { setShowOverlay(false); try { sessionStorage.setItem('rs_booted', '1'); } catch {} }, 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const skipBoot = () => {
    setBooted(true); setShowOverlay(false);
    try { sessionStorage.setItem('rs_booted', '1'); } catch {}
  };

  useEffect(() => {
    if (!booted) return;
    if (feedIdx >= FEED_SCRIPT.length) {
      const reset = setTimeout(() => { setFeedLines([]); setOrders(ORDER_BOARD); setFeedIdx(0); }, 1500);
      return () => clearTimeout(reset);
    }
    const currentEvt = FEED_SCRIPT[feedIdx];
    const delay = currentEvt.cls === 'rescued' || currentEvt.cls === 'cancelled' ? 800 : 350;
    const timer = setTimeout(() => {
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
          const next = [...prev];
          next[idx] = { ...next[idx], status: 'rescued' };
          return next;
        });
      } else if (currentEvt.outcome === 'cancelled') {
        setOrders((prev) => {
          const idx = currentEvt.orderId ? prev.findIndex((o) => o.id === currentEvt.orderId) : prev.findIndex((o) => o.status === 'failed' || o.status === 'pending');
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], status: 'cancelled' };
          return next;
        });
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [booted, feedIdx]);

  useEffect(() => {
    if (!booted) return;
    const iv = setInterval(() => setRecovered((r) => r + Math.floor(Math.random() * 80 + 20)), 5000);
    return () => clearInterval(iv);
  }, [booted]);

  /* ── Scroll reel: desktop gate + scroll‑scrubbed parcel (no state on scroll) ── */
  const trackRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });
  const reelTop = useTransform(scrollYProgress, [0, 1], ['8.333%', '91.667%']);

  /* Beat reveal — array-based useTransform (clamped by construction).
     Parcel reaches dot i at scrollYProgress = i/5.
     Each beat fades 0→1 + slides 24px→0 just before the parcel arrives. */
  const bo0 = useTransform(scrollYProgress, [0, 1], [1, 1]);
  const bo1 = useTransform(scrollYProgress, [0, 0.08, 0.18, 1], [0, 0, 1, 1]);
  const bo2 = useTransform(scrollYProgress, [0, 0.28, 0.38, 1], [0, 0, 1, 1]);
  const bo3 = useTransform(scrollYProgress, [0, 0.48, 0.58, 1], [0, 0, 1, 1]);
  const bo4 = useTransform(scrollYProgress, [0, 0.68, 0.78, 1], [0, 0, 1, 1]);
  const bo5 = useTransform(scrollYProgress, [0, 0.88, 0.98, 1], [0, 0, 1, 1]);
  const beatO = [bo0, bo1, bo2, bo3, bo4, bo5];
  const by0 = useTransform(scrollYProgress, [0, 1], [0, 0]);
  const by1 = useTransform(scrollYProgress, [0, 0.08, 0.18, 1], [24, 24, 0, 0]);
  const by2 = useTransform(scrollYProgress, [0, 0.28, 0.38, 1], [24, 24, 0, 0]);
  const by3 = useTransform(scrollYProgress, [0, 0.48, 0.58, 1], [24, 24, 0, 0]);
  const by4 = useTransform(scrollYProgress, [0, 0.68, 0.78, 1], [24, 24, 0, 0]);
  const by5 = useTransform(scrollYProgress, [0, 0.88, 0.98, 1], [24, 24, 0, 0]);
  const beatY = [by0, by1, by2, by3, by4, by5];

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !storeUrl) return;
    setSubmitting(true); setError(null);
    try {
      const API = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API}/api/plg/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, storeUrl }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || d.message || 'Signup failed. Try again.');
      }
      setSubmitted(true);
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const failedOrders = orders.filter((o) => o.status === 'failed' || o.status === 'pending');
  const rescuedOrders = orders.filter((o) => o.status === 'rescued');
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled');

  return (
    <div className="lp">
      {/* BOOT OVERLAY */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div className={`lp-boot ${booted ? 'lp-boot--exit' : ''}`} onClick={skipBoot}
            initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.03 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
            <div className="lp-boot__grid" aria-hidden="true" />
            <div className="lp-boot__term">
              {BOOT_LINES.map((line, i) => (
                <div key={i} className={`lp-boot__line lp-boot__line--${line.cls}`}
                  style={{ animationDelay: `${0.2 + i * 0.32}s` }}>{line.text}</div>
              ))}
              <span className="lp-boot__cursor" />
            </div>
            <div className="lp-boot__bar"><div className="lp-boot__bar-fill" /></div>
            <span className="lp-boot__skip">click to skip</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AMBIENT LAYERS */}
      <div className="lp-orb lp-orb--1" aria-hidden="true" />
      <div className="lp-orb lp-orb--2" aria-hidden="true" />
      <div className="lp-orb lp-orb--3" aria-hidden="true" />
      <div className="lp-grid-bg" aria-hidden="true" />
      <div className="lp-grain" aria-hidden="true" />
      <div className="lp-scan" aria-hidden="true" />

      {/* TOP BAR */}
      <motion.header className="lp-top"
        initial={reduced ? false : { opacity: 0, y: -16 }}
        animate={booted ? { opacity: 1, y: 0 } : { opacity: 0, y: -16 }}
        transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}>
        <a href="/" className="lp-brand"><span className="lp-brand__mark" aria-hidden="true">⚓</span> RescueShip</a>
        <span className="lp-top__tag">Autonomous NDR Rescue</span>
        <nav className="lp-top__nav" aria-label="Landing Navigation">
          <Link to="/login" className="lp-top__link">Log in</Link>
          <Link to="/register" className="lp-top__cta">Get started</Link>
        </nav>
      </motion.header>

      {/* HERO */}
      <section className="lp-hero">
        <motion.div className="lp-console"
          initial={reduced ? false : { opacity: 0, y: 50, scale: 0.95 }}
          animate={booted ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 50, scale: 0.95 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ willChange: 'transform, opacity' }}>
          <div className="lp-console__head">
            <span className="lp-console__dot lp-console__dot--r" />
            <span className="lp-console__dot lp-console__dot--a" />
            <span className="lp-console__dot lp-console__dot--g" />
            <span className="lp-console__title">rescue_feed — live interception</span>
            <motion.span className="lp-console__live" animate={reduced ? {} : { opacity: [1, 0.78, 1] }}
              transition={{ duration: 2, repeat: Infinity }}>● LIVE</motion.span>
          </div>

          <div className="lp-console__body">
            <div className="lp-console__channels">
              <span className="lp-console__watch">watching</span>
              {WATCHED.map((c, i) => (
                <span key={c} className="lp-console__chip">
                  <i style={{ animationDelay: `${i * 0.4}s` }} /> {c}
                </span>
              ))}
            </div>
            <div className="lp-console__scroll">
              <AnimatePresence mode="popLayout">
                {feedLines.map((line) => (
                  <motion.div key={line.id}
                    className={`lp-feed__line ${line.cls ? `lp-feed__line--${line.cls}` : ''}`}
                    initial={reduced ? false : { x: -8 }} animate={{ x: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
                    <span className="lp-feed__t">{line.t}</span>
                    <span className="lp-feed__prefix">›</span>
                    <span className="lp-feed__msg">{line.msg}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {feedLines.length === 0 && (
                <div className="lp-feed__line lp-feed__line--idle">
                  <span className="lp-feed__prefix">›</span>
                  <span className="lp-feed__msg">awaiting next NDR event…</span>
                </div>
              )}
            </div>
          </div>

          <div className="lp-console__stats">
            <div className="lp-stat">
              <span className="lp-stat__n"><CountUp target={recovered} booted={booted} prefix="₹" delay={0.6} /></span>
              <span className="lp-stat__l">recovered today</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat__n"><CountUp target={rescuedCount} booted={booted} delay={0.7} /></span>
              <span className="lp-stat__l">orders rescued</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat__n"><CountUp target={90} booted={booted} suffix="s" delay={0.8} duration={1} /></span>
              <span className="lp-stat__l">avg intercept</span>
            </div>
          </div>
        </motion.div>

        <div className="lp-intent">
          <motion.p className="lp-intent__kicker"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={booted ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            For D2C brands shipping on WhatsApp
          </motion.p>

          <h1 className="lp-intent__h1">
            <span className="lp-intent__line">
              <SpawnWords text="He never" booted={booted} baseDelay={0.35} />{' '}
              <SpawnWords text="knocked." booted={booted} baseDelay={0.58} className="lp-intent__accent" />
            </span>
            <span className="lp-intent__line">
              <SpawnWords text="You lost" booted={booted} baseDelay={0.78} />{' '}
              <SpawnWords text="the sale." booted={booted} baseDelay={1.0} className="lp-intent__accent" />
            </span>
          </h1>

          <motion.p className="lp-intent__sub"
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={booted ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
            transition={{ duration: 0.6, delay: 1.15, ease: [0.16, 1, 0.3, 1] }}>
            Every failed delivery is a wound — forward freight, reverse freight,
            repackaging, wasted ad spend. RescueShip intercepts the NDR, rescues
            the order on WhatsApp, and syncs the fix back to the carrier.
            In 90 seconds. Without a human.
          </motion.p>

          {submitted ? (
            <motion.div className="lp-pass lp-pass--done"
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}>
              <CheckmarkIcon className="lp-pass__check" />
              <p className="lp-pass__done-t">Integration request received!</p>
              <p className="lp-pass__done-s">Check your inbox — our team will contact you within 24–48 hours to set up your store.</p>
            </motion.div>
          ) : (
            <motion.form className="lp-pass" onSubmit={handleSignup}
              initial={reduced ? false : { opacity: 0, x: 48, y: 10 }}
              animate={booted ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: 48, y: 10 }}
              transition={{ duration: 0.65, delay: 1.25, ease: [0.16, 1, 0.3, 1] }}
              style={{ willChange: 'transform, opacity' }}>
              <div className="lp-pass__row">
                <label className="lp-pass__label">Full name</label>
                <input className="lp-pass__input" type="text" placeholder="John Doe"
                  autoComplete="name" spellCheck={false}
                  value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="lp-pass__row">
                <label className="lp-pass__label">Work email</label>
                <input className="lp-pass__input" type="email" placeholder="founder@yourbrand.com"
                  autoComplete="email" spellCheck={false}
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="lp-pass__row">
                <label className="lp-pass__label">Shopify / WooCommerce store domain</label>
                <input className="lp-pass__input" type="text" placeholder="yourbrand.myshopify.com (or yourstore.com)"
                  autoComplete="url" spellCheck={false}
                  value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} required />
              </div>
              <motion.button
                className="lp-pass__btn"
                type="submit"
                disabled={submitting}
                whileHover={reduced ? {} : { scale: 1.015 }}
                whileTap={reduced ? {} : { scale: 0.985 }}
                transition={{ duration: 0.15 }}
              >
                {submitting ? 'Boarding…' : 'Start rescuing →'}
              </motion.button>
              {error && <p className="lp-pass__err">⚠ {error}</p>}
              <p className="lp-pass__fine">Free test rescue · no card · live in 4 minutes</p>
            </motion.form>
          )}
        </div>
      </section>

      {/* CARRIER & COMMERCE INTERCEPT MESH (21st.dev Infinite Marquee) */}
      <CarrierMarquee />

      {/* ORDER BOARD */}
      <section className="lp-board">
        <motion.p className="lp-section__kicker" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}>Live order board</motion.p>
        <div className="lp-board__cols">
          <div className="lp-board__col">
            <div className="lp-board__col-h lp-board__col-h--fail">
              <span>NDR In-Flight</span>
              <span className="lp-board__col-count">{failedOrders.length}</span>
            </div>
            <AnimatePresence mode="popLayout">
              {failedOrders.map((o) => (
                <motion.div key={o.id} layout
                  exit={{ opacity: 0, x: 50, scale: 0.94 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
                  <SpotlightCard className="lp-order lp-order--fail" spotlightColor="rgba(244, 63, 94, 0.12)">
                    <span className="lp-order__id">{o.id}</span>
                    <span className="lp-order__awb">AWB {o.awb}</span>
                    <span className="lp-order__amt">{o.amount}</span>
                  </SpotlightCard>
                </motion.div>
              ))}
            </AnimatePresence>
            {failedOrders.length === 0 && (
              <div className="lp-order lp-order--ghost">all NDRs resolved</div>
            )}
          </div>

          <div className="lp-board__arrow" aria-hidden="true">→</div>

          <div className="lp-board__col">
            <div className="lp-board__col-h lp-board__col-h--ok">
              <span>Rescued &amp; Accepted</span>
              <span className="lp-board__col-count">{rescuedOrders.length}</span>
            </div>
            <AnimatePresence mode="popLayout">
              {rescuedOrders.map((o) => (
                <motion.div key={o.id} layout
                  initial={{ opacity: 0, x: -50, scale: 0.94 }} animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}>
                  <SpotlightCard className="lp-order lp-order--ok" spotlightColor="rgba(16, 185, 129, 0.12)">
                    <span className="lp-order__id">{o.id}</span>
                    <span className="lp-order__awb">AWB {o.awb}</span>
                    <span className="lp-order__amt">{o.amount} ✓</span>
                  </SpotlightCard>
                </motion.div>
              ))}
            </AnimatePresence>
            {rescuedOrders.length === 0 && (
              <div className="lp-order lp-order--ghost">awaiting customer reply…</div>
            )}
          </div>

          <div className="lp-board__col">
            <div className="lp-board__col-h lp-board__col-h--cancel">
              <span>Cancelled by Shopper</span>
              <span className="lp-board__col-count">{cancelledOrders.length}</span>
            </div>
            <AnimatePresence mode="popLayout">
              {cancelledOrders.map((o) => (
                <motion.div key={o.id} layout
                  initial={{ opacity: 0, x: -50, scale: 0.94 }} animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}>
                  <SpotlightCard className="lp-order lp-order--cancel" spotlightColor="rgba(251, 191, 36, 0.12)">
                    <span className="lp-order__id">{o.id}</span>
                    <span className="lp-order__awb">AWB {o.awb}</span>
                    <span className="lp-order__amt lp-order__amt--cancel">{o.amount} ✕</span>
                  </SpotlightCard>
                </motion.div>
              ))}
            </AnimatePresence>
            {cancelledOrders.length === 0 && (
              <div className="lp-order lp-order--ghost">no cancellations yet</div>
            )}
          </div>
        </div>
      </section>

      {/* COST / LEDGER */}
      <section className="lp-cost">
        <p className="lp-section__kicker">The anatomy of a lost order</p>
        <div className="lp-cost__shell">
          <div className="lp-cost__total">
            <div className="lp-cost__val">
              <span className="lp-cost__cur">₹</span>
              <span className="lp-cost__n">430</span>
            </div>
            <span className="lp-cost__lbl">average cost per failed delivery — your currency, your math</span>
          </div>
          <div className="lp-cost__bars">
            {LOSS_PARTS.map((p) => (
              <div key={p.label} className="lp-cost__row">
                <span className="lp-cost__row-l">{p.label}</span>
                <div className="lp-cost__bar-track">
                  <div className="lp-cost__bar-fill" style={{ width: `${(p.amount / 230) * 100}%` }} />
                </div>
                <span className="lp-cost__row-n">₹{p.amount}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="lp-cost__note">
          At 7,500 orders/mo with a 15% failure rate, that’s 1,125 lost orders.
          Multiply by <strong>your</strong> cost per failure.{' '}
          <em>Modelled projection — your numbers replace these when you connect.</em>
        </p>
      </section>

      {/* RESCUE LOOP — spine + interactive WhatsApp proof */}
      <section className="lp-how">
        <div className="lp-how__main">
          <p className="lp-section__kicker">The rescue loop</p>
          <h2 className="lp-how__h2">
            Four stations. <em>Zero humans.</em>
          </h2>
          <div className="lp-spine">
            {SPINE_STEPS.map((s, i) => (
              <div key={s.n} className="lp-spine__node">
                <div className="lp-spine__rail">
                  <span className="lp-spine__dot">{s.n}</span>
                  {i < SPINE_STEPS.length - 1 && <span className="lp-spine__line" />}
                </div>
                <div className="lp-spine__content">
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lp-how__aside">
          <p className="lp-section__kicker">
            <span className="lp-console__live">● LIVE DEMO</span>
            Autonomous WhatsApp rescue
          </p>
          <WaPhone active={booted} reduced={reduced} />
          <p className="lp-how__aside-note">The customer taps. The carrier syncs. No one on your team lifts a finger.</p>
        </div>
      </section>

      {/* AI ADDRESS & SCENARIO DECODER (shadcn Workbench Tabs & Diff) */}
      <section className="lp-decoder-wrap" aria-label="Interactive Logistics Scenario Decoder">
        <AiAddressDecoder />
      </section>

      {/* TRUST */}
      <section className="lp-trust">
        <div className="lp-trust__grid">
          {[
            { n: '2B+', l: 'WhatsApp users reachable' },
            { n: '90s', l: 'NDR → rescue intercept' },
            { n: '0', l: 'humans in the loop' },
            { n: '∞', l: 'carriers via webhook' },
          ].map((item) => (
            <div key={item.l} className="lp-trust__item">
              <span className="lp-trust__n">{item.n}</span>
              <span className="lp-trust__l">{item.l}</span>
            </div>
          ))}
        </div>
        <p className="lp-trust__disc">
          Built for India. Ready for every WhatsApp market.
          Stats are modelled projections — pilot data replaces them when available.
        </p>
      </section>

      {/* ═══ SCROLL REEL — the story in motion ═══ */}
      <section className={`lp-reel${reduced ? ' lp-reel--static' : ''}`} aria-label="How a single rescue plays out">
        <div className="lp-reel__track" ref={trackRef}>
          <div className="lp-reel__stage">
            <p className="lp-section__kicker lp-reel__kicker">The same order, in motion</p>
            <div className="lp-reel__grid">
              <div className="lp-reel__route" aria-hidden="true">
                <span className="lp-reel__line" />
                {REEL_BEATS.map((b, i) => (
                  <span key={i} className={`lp-reel__dot lp-reel__dot--${b.role}`} />
                ))}
                <motion.span
                  className="lp-reel__parcel"
                  style={reduced ? undefined : { top: reelTop }}
                  role="img"
                  aria-label="Delivery parcel"
                >📦</motion.span>
              </div>
              <ol className="lp-reel__beats">
                {REEL_BEATS.map((b, i) => (
                  <motion.li
                    key={i}
                    className={`lp-reel__beat lp-reel__beat--${b.role}`}
                    style={reduced ? { opacity: 1 } : { opacity: beatO[i], y: beatY[i] }}
                  >
                    <span className={`lp-reel__tile lp-reel__tile--${b.role}`}>
                      {REEL_ICONS[i]}
                    </span>
                    <span className="lp-reel__beat-txt">
                      <span className="lp-reel__beat-tag">{b.tag}</span>
                      <span className="lp-reel__beat-t">{b.t}</span>
                      <span className="lp-reel__beat-d">{b.d}</span>
                    </span>
                  </motion.li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA — framed boarding gate */}
      <section className="lp-final">
        <motion.div className="lp-final__panel"
          initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          <div className="lp-final__glow" aria-hidden="true" />
          <span className="lp-final__kicker">ready when you are</span>
          <h2 className="lp-final__h2">Stop losing revenue<br /><em>every single time.</em></h2>
          <p className="lp-final__sub">
            Connect your store, verify WhatsApp, link your carrier.
            Live in four minutes — no sales call, no demo.
          </p>
          <Link to="/register" className="lp-final__btn">Board the ship →</Link>
          <div className="lp-final__chips">
            <span>no credit card</span><span>no sales call</span><span>live in 4 min</span>
          </div>
        </motion.div>
      </section>

      <footer className="lp-foot">
        <span className="lp-foot__brand">
          <span className="lp-brand__mark" aria-hidden="true">⚓</span>
          <strong>RescueShip</strong>
          <span className="lp-foot__tag">autonomous ndr rescue · whatsapp</span>
        </span>
        <span className="lp-foot__links">
          <Link to="/docs">API Docs</Link>
          <Link to="/login">Log in</Link>
          <Link to="/register" className="lp-foot__cta">Get started →</Link>
        </span>
      </footer>
    </div>
  );
}
