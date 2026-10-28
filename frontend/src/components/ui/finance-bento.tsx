// @ts-nocheck
/*
 * RescueShip Financial Telemetry Bento Component
 * Grounded in Roman Vasnev's Finance Bento architecture (https://21st.dev/@romanvasnev/components/finance-bento)
 * Pure SVG, zero external chart libraries, ultra-responsive 12-column grid.
 * Dual-tone glowing gradients, dot-matrix SVG number tweens, and glitch-free courier fleet telemetry.
 */
import React, { useRef, useEffect } from 'react';

export interface FinanceBentoHistoryItem {
  date: string;
  fiat: number;      // Retained Margin
  stocks: number;    // Averted Dead Freight
  crypto: number;    // Converted COD GMV
  label?: string;    // Clean timeline tick label (e.g. "Mon", "Oct 21", "12:00")
}

export interface FinanceBentoPayment {
  name: string;
  date: string;
  amount: number;
  id?: string;
}

export interface FinanceBentoGoal {
  name: string;
  progress: number;
  detail?: string;
  target?: number;
}

export interface FinanceBentoCashflow {
  months: string[];
  income: number[][];
  spending: number[][];
  netSavings?: number;
  lossRatioSubtitle?: string;
}

export interface FinanceBentoCryptoItem {
  name: string;
  symbol: string;
  share: number;
  change?: string | number;
  price?: number;
  ndrs?: number;
  atRiskGmv?: number;
  rescueRate?: number;
  ohlc?: number[][];
}

export interface FinanceBentoStocks {
  days: string[];
  values: number[];
  reasonsSubtitle?: string;
}

export interface DeliveryProtectionData {
  rescuedCount: number;
  rescuedPct: number;
  rescuedGmv: number;
  reattemptCount: number;
  reattemptPct: number;
  reattemptGmv: number;
  rtoCount: number;
  rtoPct: number;
  rtoGmv: number;
  protectionRate: number; // central gauge % (e.g. 78)
  targetRate?: number;
}

export interface CapitalSavedData {
  savedGmv: number;
  atRiskGmv: number;
  freightSaved: number;
  convertedGmv?: number;
  ordersSavedRatio?: string; // e.g. "14 / 20 saved"
  saveRate: number; // 0..1 for ticks illumination
}

export interface FinanceBentoData {
  history: FinanceBentoHistoryItem[];
  payments: FinanceBentoPayment[];
  goals: FinanceBentoGoal[];
  cashflow: FinanceBentoCashflow;
  crypto: FinanceBentoCryptoItem[];
  stocks: FinanceBentoStocks;
  protection?: DeliveryProtectionData;
  capitalSaved?: CapitalSavedData;
  fleetRescueRate?: number;
  rescueRate?: number;
  autonomousPill?: string;
  freightSaved?: number;
}

export interface FinanceBentoProps extends React.HTMLAttributes<HTMLDivElement> {
  data: FinanceBentoData;
  title?: string;
  subtitle?: string;
  avatar?: string;
  avatarAlt?: string;
  credit?: boolean;
  className?: string;
  style?: React.CSSProperties;
  hasCustomHeader?: boolean;
  currency?: 'INR' | 'USD';
  onCurrencyChange?: (c: 'INR' | 'USD') => void;
  period?: string;
  onPeriodChange?: (p: string) => void;
  onSelectOrder?: (orderId: string) => void;
  onViewAllOrders?: () => void;
}

// Fonts loader hook
export function useFonts() {
  useEffect(() => {
    const id = "geist-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Geist:wght@200;300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(link);
  }, []);
}

const ny = `.fpb{font-family:Geist,ui-sans-serif,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;color:#fff;width:100%}
.fpb *{box-sizing:border-box}
.fpb .fpb-c{border-radius:28px}
.fpb .vbrow{display:flex;justify-content:flex-end;margin-top:16px}
.fpb{--acc:#E8FF1F;--t1:#fff;--t2:rgba(255,255,255,.56);--t3:rgba(255,255,255,.38);--hair:rgba(255,255,255,.14);--ease:cubic-bezier(.32,.72,0,1);
    --fiat:#FFFFFF;--stocks:#A9B2FF;--crypto:#FFB37A}
.fpb *{box-sizing:border-box}
.fpb .fpb-c{position:relative;padding:20px 22px 22px;background:#000;color:#fff}
.fpb .top{display:flex;align-items:center;gap:14px;height:44px;margin-bottom:16px}
.fpb .top h1{margin:0;font-size:28px;font-weight:700;letter-spacing:-.03em;flex:1}
.fpb .top h1 span{font-weight:500;color:var(--t3);font-size:15px;letter-spacing:-.01em;margin-left:12px}
.fpb .seg{display:flex;padding:3px;gap:2px;border-radius:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}
.fpb .seg button{border:0;height:28px;min-width:44px;padding:0 12px;border-radius:11px;background:transparent;color:var(--t2);font:600 12.5px Geist,sans-serif;cursor:pointer;transition:background .25s,color .25s}
.fpb .seg button[aria-pressed="true"]{background:#fff;color:#0b0b0c}
.fpb .seg button:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.fpb .ctrls{display:flex;gap:10px}
.fpb .ava{width:40px;height:40px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px rgba(255,255,255,.18);flex:0 0 auto}
.fpb .grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px}
.fpb .h1{height:376px}
.fpb .h2{height:188px}
.fpb .h3{height:330px}
.fpb #nw{grid-column:span 8}
.fpb #alloc{grid-column:span 4}
.fpb .kpi{grid-column:span 3}
.fpb #flow{grid-column:span 5}
.fpb #crypto{grid-column:span 4}
.fpb #stocks{grid-column:span 3}
@media (max-width:1199px){.fpb #nw{grid-column:span 12}
.fpb #alloc{grid-column:span 6;grid-row:span 2;height:auto}
.fpb .kpi{grid-column:span 6}
.fpb #flow{grid-column:span 12}
.fpb #crypto,.fpb #stocks{grid-column:span 6}}
@media (max-width:767px){.fpb .fpb-c{padding:16px 14px}
.fpb .top{flex-wrap:wrap;height:auto;gap:12px}
.fpb .top h1{flex:1;font-size:24px}
.fpb .top h1 span{display:block;margin:4px 0 0}
.fpb .ctrls{order:3;flex:1 0 100%;justify-content:space-between}
.fpb .ava{order:2}
.fpb #nw{height:420px}
.fpb #nw .legend{flex:1 0 100%;order:3;margin-top:8px}
.fpb #nw .hrow{flex-wrap:wrap}
.fpb #nw .nrow{flex-wrap:wrap;gap:6px 16px}
.fpb #alloc{grid-column:span 12;grid-row:auto;height:376px}
.fpb .kpi{grid-column:span 6}
.fpb #crypto,.fpb #stocks{grid-column:span 12}
.fpb .grid{gap:12px}}
@media (max-width:520px){.fpb .kpi{grid-column:span 12}}
.fpb .card{position:relative;border-radius:28px;overflow:hidden;opacity:1;transform:none}
.fpb .in .card{opacity:1;transform:none}
.fpb .card .rim{position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,.2),inset 0 0 0 1px rgba(255,255,255,.06);pointer-events:none;z-index:9}
.fpb .g{position:absolute;inset:0}
.fpb .core{position:absolute;left:10%;right:10%;top:16%;bottom:-6%;border-radius:90px;filter:blur(60px)}
.fpb .glass{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(20px)}
.fpb .glass .rim{display:none}
.fpb .solid{background:var(--acc);color:#0b0b0c}
.fpb .solid .rim{box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}
.fpb .in-c{position:absolute;inset:0;padding:22px 24px;z-index:2}
.fpb .ttl{font-size:18px;font-weight:600;letter-spacing:-.02em;display:flex;align-items:center;gap:8px}
.fpb .cap{font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--t2)}
.fpb .solid .cap{color:rgba(0,0,0,.55)}
.fpb .big{font-size:40px;font-weight:200;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums}
.fpb .delta{font:600 12.5px "Geist Mono",monospace;color:var(--acc);letter-spacing:-.02em}
.fpb .muted{font-size:12.5px;color:var(--t3);font-weight:500;letter-spacing:-.01em}
.fpb .chip{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:11px;background:rgba(0,0,0,.85);color:#fff;font:600 11px "Geist Mono",monospace;letter-spacing:-.02em}
.fpb .legend{display:flex;gap:16px;font-size:12px;font-weight:500;color:var(--t2)}
.fpb .legend span{display:inline-flex;align-items:center;gap:6px}
.fpb .legend i{width:8px;height:8px;border-radius:50%}
.fpb .row{display:flex;align-items:center;gap:12px}
.fpb .mono{font-family:"Geist Mono",monospace;font-variant-numeric:tabular-nums}
.fpb .dots circle{transition:opacity .26s,transform .26s;transform-box:fill-box;transform-origin:center}
.fpb .tip{position:fixed;z-index:50;pointer-events:none;background:rgba(14,14,16,.92);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:9px 11px;font-size:12px;
    backdrop-filter:blur(16px);box-shadow:0 12px 30px -10px rgba(0,0,0,.6);opacity:0;transform:translateY(4px);transition:opacity .15s,transform .15s;white-space:nowrap;min-width:150px}
.fpb .tip.on{opacity:1;transform:none}
.fpb .tip .t{color:var(--t2);margin-bottom:5px;font-weight:500}
.fpb .tip .r{display:flex;justify-content:space-between;gap:14px;align-items:center;line-height:19px}
.fpb .tip .r span{display:inline-flex;align-items:center;gap:6px;color:var(--t2)}
.fpb .tip i{width:7px;height:7px;border-radius:50%}
.fpb .tip b{font:500 12px "Geist Mono",monospace}
.fpb .vb-badge{--vb-on:#6a5cff;display:inline-flex;align-items:center;gap:9px;height:34px;padding:0 12px 0 11px;border-radius:17px;background:#111113;border:1px solid rgba(255,255,255,.1);color:#fff;text-decoration:none;font:500 13px/1 Geist,sans-serif;letter-spacing:-.02em;box-shadow:0 8px 24px -14px rgba(0,0,0,.25);transition:border-color .25s}
.fpb .vb-badge:hover{border-color:color-mix(in oklab,var(--vb-on) 45%,transparent)}
.fpb .vb-mark{display:grid;grid-template-columns:repeat(5,3px);grid-template-rows:repeat(3,3px);gap:2px}
.fpb .vb-mark i{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.16);transition:background .3s}
.fpb .vb-mark i.on{background:var(--vb-on)}
.fpb .vb-badge:hover .vb-mark i.on{animation:vbw .9s cubic-bezier(.3,1.4,.4,1) calc(var(--x)*60ms) 1}
.fpb .vb-badge:hover .vb-mark i:not(.on){background:color-mix(in oklab,var(--vb-on) 22%,transparent)}
@keyframes vbw{0%,100%{transform:none}40%{transform:translateY(-2px) scale(1.35)}}
.fpb .vb-by{color:rgba(255,255,255,.5)}
.fpb .vb-arr{height:12px;width:0;margin-left:-9px;opacity:0;transform:translate(-4px,4px);transition:all .3s cubic-bezier(.2,.9,.25,1)}
.fpb .vb-badge:hover .vb-arr{width:12px;margin-left:0;opacity:1;transform:none}
.fpb.custom-header .top{display:none!important}
@media (prefers-reduced-motion: reduce){.fpb .card{transition:none}}`;

const i = (fn: any, name: string) => {
  try {
    Object.defineProperty(fn, "name", { value: name, configurable: true });
  } catch {}
  return fn;
};

const di = i((M: any) => String(M ?? "").replace(/[&<>"']/g, H => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[H]), "esc");

const iy = i((M: any) => `<div class="fpb-c canvas">
      ${M.hasCustomHeader ? "" : `<div class="top">
        <h1>${di(M.title)}<span id="asof">${di(M.subtitle)}</span></h1>
        <div class="ctrls"><div class="seg" id="period" role="group" aria-label="Period"></div>
        <div class="seg" id="ccy" role="group" aria-label="Currency"></div></div>
        ${M.avatar ? `<img class="ava" alt="${di(M.avatarAlt)}" src="${di(M.avatar)}">` : ""}
      </div>`}
      <div class="grid" id="grid">
        <!-- Capital Recovery Stream -->
        <section class="card h1" id="nw" aria-label="Capital Recovery"></section>
        <!-- Outcome Allocation -->
        <section class="card h1" id="alloc" aria-label="Delivery Protection"></section>
        <!-- KPI Row -->
        <section class="card h2 kpi" id="ret" aria-label="Rescue Success Rate"></section>
        <section class="card glass h2 kpi" id="cash" aria-label="Net Capital Saved"></section>
        <section class="card glass h2 kpi" id="pay" aria-label="Urgent NDR Queue"></section>
        <section class="card glass h2 kpi" id="goals" aria-label="Recovery Benchmarks"></section>
        <!-- Bottom Row -->
        <section class="card h3" id="flow" aria-label="Mirrored Logistics Flow"></section>
        <section class="card h3" id="crypto" aria-label="Active Courier Fleet"></section>
        <section class="card h3" id="stocks" aria-label="NDR Incident Cadence"></section>
      </div>
    </div>
${M.credit ? '<div class="vbrow"><a class="vb-badge" href="https://vasnev.art" target="_blank" rel="noopener" aria-label="Made by vasnev.art"><span class="vb-mark" id="vbm" aria-hidden="true"></span><span><span class="vb-by">by</span> vasnev.art</span><svg class="vb-arr" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 8.5l5-5M4.5 3.5h4v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a></div>' : ""}
<div class="tip" id="tip"></div>`, "markup");

function cy(
  M: HTMLElement,
  H: FinanceBentoData,
  initialCurrency = "INR",
  initialPeriod = "1M",
  callbacks?: {
    onSelectOrder?: (orderId: string) => void;
    onViewAllOrders?: () => void;
  }
) {
  let V = true;
  const v = new Set<number>();
  const Y = (p: FrameRequestCallback) => {
    if (!V) return 0;
    const E = requestAnimationFrame((D) => {
      v.delete(E);
      V && p(D);
    });
    return v.add(E), E;
  };
  const N = (p: string) => M.querySelector("#" + p) as HTMLElement;
  const P = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const At = "#E8FF1F"; // Iconic electric lime accent
  const w = "rgba(255,255,255,.56)";
  const A = "rgba(255,255,255,.38)";
  const G = "rgba(255,255,255,.14)";

  // RescueShip logistics domain colors
  const it = {
    fiat: "#FFFFFF",     // Retained Margin (Pure crisp white)
    stocks: "#10B981",   // Delivered / Rescued / Averted Freight (Emerald green)
    crypto: "#38BDF8",   // In Re-attempt / COD Converted (Sky cyan)
  };

  const gt = (p: number) => 1 - Math.pow(1 - p, 3);
  const cl = "http://www.w3.org/2000/svg";
  const Pt = (p: string, E: Record<string, any> = {}, D?: SVGElement) => {
    const O = document.createElementNS(cl, p);
    for (const _ in E) O.setAttribute(_, E[_]);
    return D && D.appendChild(O), O;
  };

  // State: Period and Currency (defaults to INR ₹, toggleable to USD $)
  const Ot = { period: initialPeriod, ccy: initialCurrency };
  const It = { INR: 1, USD: 1 / 86 };
  const Hl = { INR: "₹", USD: "$" };

  const St = (p: number, { dec: E = 0, compact: D = false } = {}) => {
    p = (p || 0) * It[Ot.ccy];
    const O = Hl[Ot.ccy];
    return D && Math.abs(p) >= 1e3
      ? O + (p / 1e3).toFixed(Math.abs(p) >= 1e4 ? 0 : 1) + "K"
      : (p < 0 ? "-" : "") + O + Math.abs(p).toLocaleString("en-US", { minimumFractionDigits: E, maximumFractionDigits: E });
  };

  let Yt = (H?.history || []).map((p: any) => ({
    d: new Date(p.date),
    fiat: p.fiat,
    stocks: p.stocks,
    crypto: p.crypto,
    label: p.label,
  }));

  function xl() {
    return Yt.map((O: any) => ({
      ...O,
      l: O.label || (O.d instanceof Date && !isNaN(O.d.getTime()) ? O.d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Today"),
    }));
  }

  const tt = (p: any) => p.fiat + p.stocks + p.crypto;

  function Ct({ top: p, base: E, bottom: D, core: O }: any) {
    return `<div class="g" style="background:linear-gradient(180deg,${p} 0%,${E} 36%,${E} 74%,${D} 100%)"></div><div class="core" style="background:${O}"></div>`;
  }

  // Stunning Dual-Tone Radiant Color Palettes
  const Zt = {
    blue: { top: "#c7d2fe", base: "#4338ca", bottom: "#312e81", core: "#0f172a" },   // Capital Stream (Indigo/Deep Slate)
    graph: { top: "#a5f3fc", base: "#0e7490", bottom: "#155e75", core: "#083344" },  // Protection Allocation (Cyan/Deep Ocean)
    pink: { top: "#fecdd3", base: "#e11d48", bottom: "#9f1239", core: "#4c0519" },   // Mirrored Flow (Crimson Rose)
    copper: { top: "#fed7aa", base: "#ea580c", bottom: "#9a3412", core: "#431407" }, // Active Fleet (Amber Copper)
    green: { top: "#a7f3d0", base: "#059669", bottom: "#047857", core: "#022c22" },  // Incident Cadence (Emerald Mint)
    lime: { top: "#f4ffb8", base: "#a3c400", bottom: "#c9e03a", core: "#121700" },   // Autonomous Rescue % (Electric Lime)
  };

  function kt(p: number[][], E = true) {
    let D = (E ? "M" : "L") + `${p[0][0]},${p[0][1]}`;
    for (let O = 0; O < p.length - 1; O++) {
      const _ = p[O - 1] || p[O];
      const j = p[O];
      const U = p[O + 1];
      const L = p[O + 2] || U;
      const K = 0.17;
      D += `C${j[0] + (U[0] - _[0]) * K},${j[1] + (U[1] - _[1]) * K} ${U[0] - (L[0] - j[0]) * K},${U[1] - (L[1] - j[1]) * K} ${U[0]},${U[1]}`;
    }
    return D;
  }

  const Tl = (p: number, E: number) => [p * Math.cos((E * Math.PI) / 180), p * Math.sin((E * Math.PI) / 180)];

  // Dot Matrix 5x7 Font Bitmaps (With Indian Rupee ₹ glyph!)
  const ua = {
    0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    3: ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
    4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
    "₹": ["11111", "00100", "11110", "10001", "11110", "00110", "00011"],
    "₹": ["11111", "00100", "11110", "10001", "11110", "00110", "00011"],
    "€": ["00111", "01000", "11110", "01000", "11110", "01000", "00111"],
    ",": ["0", "0", "0", "0", "0", "1", "1"],
    " ": ["00", "00", "00", "00", "00", "00", "00"],
  };

  function Cl(p: HTMLElement, E: number) {
    const O = Pt("svg", { class: "dots", "aria-hidden": "true" }, p as any);
    const _ = [];
    for (let K = 0; K < 48; K++) {
      for (let F = 0; F < 7; F++) {
        const ot = Pt("circle", { cx: K * E + E / 2, cy: F * E + E / 2, r: E * 0.36, fill: "#fff", opacity: 0 }, O);
        ot.style.transitionDelay = K * 7 + "ms";
        _.push([K, F, ot]);
      }
    }
    const j = (K: string) => {
      const F = new Set();
      let ot = 0;
      for (const ht of K) {
        const rt = ua[ht] || ua[" "];
        const et = rt[0].length;
        for (let pt = 0; pt < 7; pt++) {
          for (let Ut = 0; Ut < et; Ut++) {
            rt[pt][Ut] === "1" && F.add((ot + Ut) * 8 + pt);
          }
        }
        ot += et + 1;
      }
      const at = Math.max(1, ot - 1);
      for (const [ht, rt, et] of _) {
        const pt = F.has(ht * 8 + rt);
        et.setAttribute("opacity", pt ? 1 : ht < at ? 0.08 : 0);
        et.style.transform = pt ? "none" : "scale(.55)";
      }
      O.setAttribute("width", at * E);
      O.setAttribute("height", 7 * E);
      O.setAttribute("viewBox", `0 0 ${at * E} ${7 * E}`);
    };
    let U = 0, L = 0;
    return {
      count(K: number, F = 900) {
        cancelAnimationFrame(U);
        if (F === 0 || P) {
          L = K;
          const Ut = Hl[Ot.ccy] + Math.round(K * It[Ot.ccy]).toLocaleString("en-US");
          j(Ut);
          return;
        }
        const ot = L, at = performance.now();
        let ht = "";
        const rt = (et: number) => {
          const pt = P ? 1 : Math.min(1, (et - at) / F);
          L = ot + (K - ot) * gt(pt);
          const Ut = Hl[Ot.ccy] + Math.round(L * It[Ot.ccy]).toLocaleString("en-US");
          Ut !== ht && (j(Ut), (ht = Ut));
          pt < 1 && (U = Y(rt));
        };
        U = Y(rt);
      },
    };
  }

  function wt(p: HTMLElement, E: number, D: (val: number) => string, O = 900) {
    const _ = +p.dataset.v || 0;
    const j = performance.now();
    p.dataset.v = String(E);
    (function U(L) {
      const K = P ? 1 : Math.min(1, (L - j) / O);
      p.textContent = D(_ + (E - _) * gt(K));
      K < 1 && Y(U);
    })(j);
  }

  const ml = N("tip");
  function Zl(p: number, E: number, D: string, O: Array<[string, string, string?]>) {
    ml.innerHTML = `<div class="t">${D}</div>` + O.map(([L, K, F]) => `<div class="r"><span>${F ? `<i style="background:${F}"></i>` : ""}${L}</span><b>${K}</b></div>`).join("");
    ml.classList.add("on");
    const _ = ml.getBoundingClientRect();
    let j = p + 14, U = E - _.height / 2;
    j + _.width > innerWidth - 12 && (j = p - _.width - 14);
    U < 12 && (U = 12);
    U + _.height > innerHeight - 12 && (U = innerHeight - _.height - 12);
    ml.style.left = j + "px";
    ml.style.top = U + "px";
  }
  const Lt = () => ml.classList.remove("on");

  // 1. TILE: Capital Recovery Stream (#nw)
  const b = N("nw");
  b.innerHTML = `${Ct(Zt.blue)}<div class="in-c">
    <div class="row hrow" style="justify-content:space-between">
      <div class="ttl">Capital Recovery Stream</div>
      <div class="legend">
        <span><i style="background:${it.fiat}"></i>Retained Margin</span>
        <span><i style="background:${it.stocks}"></i>Averted Freight</span>
        <span><i style="background:${it.crypto}"></i>COD Converted</span>
      </div>
    </div>
    <div class="row nrow" style="margin-top:16px;align-items:flex-end;gap:16px">
      <div class="nwn"></div>
      <div style="padding-bottom:6px">
        <div class="delta nwd"></div>
        <div class="muted nwc" style="margin-top:3px"></div>
      </div>
    </div>
    <svg class="nws" style="position:absolute;left:0;right:0;bottom:0;display:block" aria-hidden="true"></svg>
  </div><div class="rim"></div>`;

  const q = Cl(b.querySelector(".nwn"), innerWidth < 520 ? 5.4 : 7);
  let C = 0, vt = 0, o: any = null;

  function z() {
    const p = b.querySelector(".nws") as SVGElement;
    const E = b.clientWidth;
    const D = 226, O = 26, _ = 26, j = O + (D - O - _) / 2;
    p.setAttribute("width", String(E));
    p.setAttribute("height", String(D));
    p.setAttribute("viewBox", `0 0 ${E} ${D}`);
    const U = o, L = U.length;
    const K = U.map(tt);
    const F = Math.max(...K), ot = Math.min(...K);
    const at = ot - (F - ot) * 0.9;
    const ht = (D - O - _) / 2;
    const rt = (I: any) => (((tt(I) - at) / (F - at)) * ht * 2) / tt(I);
    const et = (I: number) => -20 + (I / (L - 1)) * (E + 40);
    const pt = gt(C);
    const Ut = U.map((I: any) => {
      const Ht = (rt(I) * pt) / 2;
      const yt = I.fiat * Ht;
      const vl = I.stocks * Ht;
      const $t = I.crypto * Ht;
      return { f: yt, fs: yt + vl, fsc: yt + vl + $t };
    });
    const Fl = (I: string) => {
      const Ht = U.map((vl: any, $t: number) => [et($t), j - Ut[$t][I]]);
      const yt = U.map((vl: any, $t: number) => [et($t), j + Ut[$t][I]]).reverse();
      return kt(Ht) + kt(yt, false) + "Z";
    };
    const Aa = [Math.round((L - 1) * 0.18), Math.round((L - 1) * 0.55), L - 1];

    p.innerHTML = `
      <defs>
        <linearGradient id="gf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${it.fiat}" stop-opacity=".75"/><stop offset="1" stop-color="${it.fiat}" stop-opacity=".35"/></linearGradient>
        <linearGradient id="gs" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${it.stocks}" stop-opacity=".85"/><stop offset="1" stop-color="${it.stocks}" stop-opacity=".45"/></linearGradient>
        <linearGradient id="gc" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${it.crypto}" stop-opacity=".9"/><stop offset="1" stop-color="${it.crypto}" stop-opacity=".5"/></linearGradient>
      </defs>
      <path d="${Fl("fsc")}" fill="url(#gc)"/>
      <path d="${Fl("fs")}" fill="url(#gs)"/>
      <path d="${Fl("f")}" fill="url(#gf)"/>
      ${Aa.map((I) => `<line x1="${et(I)}" x2="${et(I)}" y1="20" y2="${D - 20}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
        <g transform="translate(${et(I)},14)"><rect x="-24" y="-10" width="48" height="18" rx="9" fill="rgba(0,0,0,.65)"/><text y="2.5" text-anchor="middle" font-size="10" fill="#fff" font-family="Geist Mono">${St(tt(U[I]), { compact: true })}</text></g>
        <g transform="translate(${et(I)},${D - 12})"><rect x="-20" y="-8" width="40" height="16" rx="8" fill="rgba(0,0,0,.6)"/><text y="3" text-anchor="middle" font-size="9.5" fill="var(--t2)" font-family="Geist">${U[I].l || ""}</text></g>`).join("")}
      <line class="nw-ch" x1="0" x2="0" y1="0" y2="${D}" stroke="#fff" stroke-opacity=".3" stroke-dasharray="3 3" style="display:none"/>
      <rect class="nw-hit" x="0" y="0" width="${E}" height="${D}" fill="transparent"/>`;

    const Hl_elem = p.querySelector(".nw-ch") as SVGElement;
    const Bt = p.querySelector(".nw-hit") as SVGElement;
    Bt.onpointermove = (I) => {
      const Ht = I.offsetX;
      let yt = Math.round(((Ht + 20) / (E + 40)) * (L - 1));
      yt = Math.max(0, Math.min(L - 1, yt));
      const vl = U[yt];
      Hl_elem.style.display = "block";
      Hl_elem.setAttribute("x1", String(et(yt)));
      Hl_elem.setAttribute("x2", String(et(yt)));
      Zl(I.clientX, I.clientY, vl.l || "Period", [
        ["Total Saved", St(tt(vl))],
        ["Retained Margin", St(vl.fiat), it.fiat],
        ["Averted Freight", St(vl.stocks), it.stocks],
        ["COD Converted", St(vl.crypto), it.crypto],
      ]);
    };
    Bt.onpointerleave = () => {
      Hl_elem.style.display = "none";
      Lt();
    };
  }

  function B(skipAnim = false) {
    o = xl();
    const p = o[0], E = o[o.length - 1];
    const D = tt(p), O = tt(E);
    const _ = O - D, j = D > 0 ? (_ / D) * 100 : 0;
    q.count(O, skipAnim ? 0 : 400);
    const dEl = b.querySelector(".nwd");
    if (dEl) dEl.textContent = (j >= 0 ? "↑ " : "↓ ") + Math.abs(j).toFixed(1) + "%";
    const cEl = b.querySelector(".nwc");
    const periodLabelMap: Record<string, string> = {
      "24H": "today",
      "7D": "this week",
      "30D": "this month",
      "90D": "this quarter",
      "1M": "this month",
      "3M": "last 3 months",
      "1Y": "this year",
      All: "all time"
    };
    if (cEl) cEl.textContent = "+" + St(_) + " " + (periodLabelMap[Ot.period] || "this period");
    cancelAnimationFrame(vt);
    C = 1;
    z();
  }

  // 2. TILE: Delivery Protection Ratio (#alloc)
  const R = N("alloc");
  let protData = H?.protection || {
    rescuedCount: 14,
    rescuedPct: 0.70,
    rescuedGmv: 29726,
    reattemptCount: 3,
    reattemptPct: 0.15,
    reattemptGmv: 4072,
    rtoCount: 3,
    rtoPct: 0.15,
    rtoGmv: 6923,
    protectionRate: 85,
    targetRate: 80,
  };

  R.innerHTML = `${Ct(Zt.graph)}<div class="in-c">
    <div class="row" style="justify-content:space-between">
      <div class="ttl">Delivery Protection</div>
      <span class="chip alloc-target" style="background:rgba(255,255,255,.12)">Target ${protData.targetRate || 80}%</span>
    </div>
    <svg class="alg" width="300" height="168" viewBox="-150 -150 300 168" style="position:absolute;left:50%;margin-left:-150px;top:70px" aria-hidden="true"></svg>
    <div class="all" style="position:absolute;left:24px;right:24px;bottom:20px"></div>
  </div><div class="rim"></div>`;

  function Z(skipAnim = false) {
    const O = 56, _ = R.querySelector(".alg") as SVGElement;
    const targetEl = R.querySelector(".alloc-target");
    if (targetEl) targetEl.textContent = `Target ${protData.targetRate || 80}%`;

    const existingTicks = _.querySelectorAll("line");
    if (existingTicks.length === O + 1) {
      for (let L = 0; L <= O; L++) {
        const K = L / O;
        const ot = K <= protData.rescuedPct ? "stocks" : K <= protData.rescuedPct + protData.reattemptPct ? "crypto" : "fiat";
        existingTicks[L].setAttribute("stroke", it[ot]);
        existingTicks[L].setAttribute("stroke-opacity", ot === "fiat" ? "0.35" : "1");
      }
      const pctText = _.querySelector(".prot-pct");
      if (pctText) {
        pctText.innerHTML = `${protData.protectionRate}<tspan font-size="28" dy="-18">%</tspan>`;
      }
    } else {
      let j = "";
      for (let L = 0; L <= O; L++) {
        const K = L / O;
        const F = 180 + K * 180;
        const ot = K <= protData.rescuedPct ? "stocks" : K <= protData.rescuedPct + protData.reattemptPct ? "crypto" : "fiat";
        const [at, ht] = Tl(136, F);
        const [rt, et] = Tl(L % 7 === 0 ? 112 : 118, F);
        j += `<line x1="${at.toFixed(1)}" y1="${ht.toFixed(1)}" x2="${rt.toFixed(1)}" y2="${et.toFixed(1)}" stroke="${it[ot]}" stroke-opacity="${ot === "fiat" ? 0.35 : 1}" stroke-width="3.2" stroke-linecap="round" style="opacity:1"/>`;
      }
      j += `<text class="prot-pct" y="-22" text-anchor="middle" font-family="Geist" font-weight="200" font-size="52" fill="#fff">${protData.protectionRate}<tspan font-size="28" dy="-18">%</tspan></text>
        <text y="6" text-anchor="middle" font-family="Geist" font-size="12" fill="var(--t2)">protected</text>`;
      _.innerHTML = j;
    }

    R.querySelector(".all").innerHTML = [
      ["Delivered (Rescued)", protData.rescuedPct, it.stocks, protData.rescuedGmv, protData.rescuedCount],
      ["In Re-attempt", protData.reattemptPct, it.crypto, protData.reattemptGmv, protData.reattemptCount],
      ["RTO Initiated", protData.rtoPct, "rgba(255,255,255,.4)", protData.rtoGmv, protData.rtoCount],
    ].map(([L, K, F, ot, cnt]) => `<div class="row" style="justify-content:space-between;font-size:12px;line-height:22px">
      <span style="display:inline-flex;align-items:center;gap:7px"><i style="width:7px;height:7px;border-radius:50%;background:${F}"></i>${L}${cnt != null ? ` <span class="muted" style="font-size:10.5px">(${cnt})</span>` : ''}</span>
      <span class="mono" style="color:var(--t2)">${Math.round(K * 100)}% <span style="color:#fff;margin-left:6px">${St(ot)}</span></span>
    </div>`).join("");
  }

  // 3. TILE: Autonomous Rescue Rate (#ret)
  const ct = N("ret");
  let retRescueRate = H?.rescueRate || 60.0;
  let retAutonomousPill = H?.autonomousPill || "12 / 20 Auto";
  let retFreightSaved = H?.freightSaved || 8820;

  ct.innerHTML = `${Ct(Zt.lime)}<div class="in-c">
    <div class="row" style="justify-content:space-between">
      <div class="cap">Autonomous Rescue Rate</div>
      <span class="chip rtc">${retAutonomousPill}</span>
    </div>
    <div style="position:absolute;left:22px;bottom:36px;display:flex;align-items:center;gap:8px">
      <svg width="30" height="36" viewBox="0 0 34 40" aria-hidden="true">
        <path d="M17 37V5M5 17L17 5l12 12" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="big rtv" style="font-size:52px">${retRescueRate.toFixed(1)}%</span>
    </div>
    <div class="muted rtp" style="position:absolute;left:24px;bottom:16px;font-size:11.5px">Doorbell & WhatsApp AI recoveries</div>
  </div><div class="rim"></div>`;

  function W() {
    const rtv = ct.querySelector(".rtv");
    if (rtv) rtv.textContent = Math.min(99.4, Math.max(45, retRescueRate)).toFixed(1) + "%";
    const rtc = ct.querySelector(".rtc");
    if (rtc) rtc.textContent = retAutonomousPill;
  }

  // 4. TILE: Averted Reverse Freight (#cash)
  const tl = N("cash");
  let capSaved = H?.capitalSaved || {
    savedGmv: 40721,
    atRiskGmv: 40721,
    freightSaved: 8820,
    convertedGmv: 6450,
    ordersSavedRatio: "14 / 20 saved",
    saveRate: 0.70,
  };

  tl.innerHTML = `<div class="in-c">
    <div class="row" style="justify-content:space-between">
      <div class="cap">Averted Reverse Freight</div>
      <span class="muted">${capSaved.ordersSavedRatio || "14 / 20 saved"}</span>
    </div>
    <div class="row" style="margin-top:10px;align-items:baseline;justify-content:space-between">
      <span class="big csv" style="font-size:36px">${St(capSaved.freightSaved)}</span>
      <span class="mono" style="font-size:15px;font-weight:600;text-align:right">
        <span class="crw" style="color:${At}">+${St(capSaved.convertedGmv || 6450)}</span>
        <span class="muted crw-sub" style="font-size:11px;display:block;margin-top:1px">COD → Prepaid</span>
      </span>
    </div>
    <svg class="cst" width="100%" height="16" style="position:absolute;left:24px;right:24px;bottom:12px;width:calc(100% - 48px)" aria-hidden="true"></svg>
  </div>`;

  function Dt() {
    const csv = tl.querySelector(".csv");
    if (csv) csv.textContent = St(capSaved.freightSaved);
    const crw = tl.querySelector(".crw");
    if (crw) crw.textContent = `+${St(capSaved.convertedGmv || 6450)}`;
    const crwSub = tl.querySelector(".crw-sub");
    if (crwSub) crwSub.textContent = "COD → Prepaid";

    const D = tl.querySelector(".cst") as SVGElement;
    if (!D) return;
    const O = D.getBoundingClientRect().width || 220;
    const _ = 36;
    const activeCount = Math.round(_ * Math.min(1, Math.max(0.08, capSaved.saveRate)));

    const existingTicks = D.querySelectorAll("line");
    if (existingTicks.length === _) {
      for (let U = 0; U < _; U++) {
        const K = U < activeCount;
        existingTicks[U].setAttribute("stroke", K ? At : "rgba(255,255,255,.24)");
      }
    } else {
      let j = "";
      for (let U = 0; U < _; U++) {
        const L = 1 + (U * (O - 2)) / (_ - 1);
        const K = U < activeCount;
        j += `<line x1="${L}" x2="${L}" y1="${U % 6 === 0 ? 2 : 8}" y2="20" stroke="${K ? At : "rgba(255,255,255,.24)"}" stroke-width="1.6" stroke-linecap="round"/>`;
      }
      D.innerHTML = j;
    }
  }

  // 5. TILE: Urgent NDR Queue (#pay)
  const $l = N("pay");
  let se = (H?.payments || []).map((p) => ({
    name: p.name,
    date: p.date,
    amount: p.amount,
    id: p.id || p.name.replace('#', ''),
  }));

  function oe() {
    $l.innerHTML = `<div class="in-c" style="padding:16px 18px">
      <div class="row" style="justify-content:space-between;align-items:center">
        <div class="cap">Urgent NDR Queue</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="mono muted">${St(se.reduce((p, E) => p + E.amount, 0))}</span>
          <button type="button" class="btn-all-orders" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#fff;border-radius:5px;font-size:10px;padding:1px 6px;cursor:pointer;line-height:16px">All ↗</button>
        </div>
      </div>
      <div style="margin-top:8px" class="pay-rows">
        ${se.map((p, _) => `<div class="row pay-row" data-id="${p.id}" style="height:32px;${_ ? "border-top:1px solid rgba(255,255,255,.07)" : ""};gap:8px;align-items:center;cursor:pointer;border-radius:4px;padding:0 4px;transition:background .15s">
          <span class="chip" style="font-size:10px;padding:0 6px;height:19px;flex-shrink:0;background:rgba(255,255,255,.14);color:#fff;border-radius:6px">${p.name}</span>
          <span style="flex:1;min-width:0;font-size:11.5px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${p.date}">${p.date}</span>
          <span class="mono" style="flex-shrink:0;text-align:right;font-size:11.5px;font-weight:600;color:#fff">${St(p.amount)}</span>
        </div>`).join("")}
      </div>
    </div>`;

    const allBtn = $l.querySelector(".btn-all-orders");
    if (allBtn) {
      allBtn.addEventListener("click", () => {
        callbacks?.onViewAllOrders?.();
      });
    }

    $l.querySelectorAll(".pay-row").forEach((row) => {
      row.addEventListener("mouseenter", () => {
        (row as HTMLElement).style.background = "rgba(255,255,255,.06)";
      });
      row.addEventListener("mouseleave", () => {
        (row as HTMLElement).style.background = "transparent";
      });
      row.addEventListener("click", () => {
        const orderId = (row as HTMLElement).dataset.id;
        if (orderId && callbacks?.onSelectOrder) {
          callbacks.onSelectOrder(orderId);
        }
      });
    });
  }

  // 6. TILE: Recovery Benchmarks (#goals)
  const re = N("goals");
  let We = (H?.goals || []).map((p) => ({
    name: p.name,
    progress: p.progress,
    detail: p.detail || (p.target ? `of ${St(p.target, { compact: true })}` : `${Math.round(p.progress * 100)}% SLA`),
  }));

  function de() {
    const D = 240, O = 36;
    re.innerHTML = `<div class="in-c" style="padding:16px 18px">
      <div class="row" style="justify-content:space-between">
        <div class="cap">Recovery Benchmarks</div>
        <span class="muted">${We.length} Benchmarks</span>
      </div>
      ${We.map((goal) => {
        let j = "";
        for (let U = 0; U < O; U++) {
          const L = 1 + (U * (D - 2)) / (O - 1);
          const K = U / (O - 1) <= goal.progress;
          j += `<line x1="${L}" x2="${L}" y1="${U % 6 === 0 ? 0 : 3}" y2="12" stroke="${K ? At : "rgba(255,255,255,.24)"}" stroke-width="1.8" stroke-linecap="round"/>`;
        }
        return `<div style="margin-top:14px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px;font-size:12px">
            <span style="font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${goal.name}</span>
            <span class="mono" style="font-weight:600;white-space:nowrap;flex-shrink:0;font-size:11.5px;color:#fff">
              ${Math.round(goal.progress * 100)}%
              <span class="muted" style="font-size:10px;font-weight:400;margin-left:4px">(${goal.detail})</span>
            </span>
          </div>
          <svg width="100%" height="14" viewBox="0 0 ${D} 14" style="margin-top:6px;display:block" aria-hidden="true">${j}</svg>
        </div>`;
      }).join("")}
    </div>`;
  }

  // 7. TILE: Mirrored Logistics Flow (#flow)
  const Fe = N("flow");
  let flowNet = H?.cashflow?.netSavings || 29726;
  let lossRatioSub = H?.cashflow?.lossRatioSubtitle || `RTO Loss Ratio: 17.0% (₹6,923 lost vs ₹29,726 rescued)`;

  Fe.innerHTML = `${Ct(Zt.pink)}<div class="in-c">
    <div class="row" style="justify-content:space-between">
      <div>
        <div class="ttl">Mirrored Logistics Flow</div>
        <div class="muted fl-sub" style="margin-top:4px;font-size:11px;max-width:320px">${lossRatioSub}</div>
      </div>
      <div class="legend" style="flex-direction:column;gap:4px;align-items:flex-end">
        <span><i style="background:#fff"></i>Retained GMV</span>
        <span><i style="background:#FFD0E6"></i>RTO Loss & Freight Burn</span>
      </div>
    </div>
    <svg class="fls" style="position:absolute;left:0;bottom:8px" aria-hidden="true"></svg>
  </div><div class="rim"></div>`;

  let Pe = H?.cashflow?.months || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let yl = H?.cashflow?.income || [[3.8, 4.6, 6.2, 7.8, 6.5, 5.2, 5.8]];
  let Ie = H?.cashflow?.spending || [[1.2, 1.4, 1.7, 2.1, 1.8, 1.0, 1.3]];
  let ye = 0;

  function tu(skipAnim = false) {
    const E = Fe.querySelector(".fls") as SVGElement;
    if (!E) return;
    const D = Fe.clientWidth || 500;
    const O = 200, _ = 46, j = D - 28, U = 100, L = 14, K = 68, F = 15;
    E.setAttribute("width", String(D));
    E.setAttribute("height", String(O));
    E.setAttribute("viewBox", `0 0 ${D} ${O}`);
    const ot = (rt: number) => _ + (rt / (Pe.length - 1)) * (j - _);
    cancelAnimationFrame(ye);
    const et = 1;
    const pt = (Vt: number[], Bt: number) => kt(Vt.map((I, Ht) => [ot(Ht), U + Bt * (L + (Math.min(F, I) / F) * K * et)]));
    let Ut = "";
    [0, 5, 10, 15].forEach((Vt) => {
      const tickVal = Vt * 1000;
      const normalized = Vt / F;
      const I = U - L - normalized * K;
      const Ht = U + L + normalized * K;
      Ut += `<line x1="${_}" x2="${j}" y1="${I}" y2="${I}" stroke="rgba(255,255,255,.07)" stroke-width="1"/>
        <line x1="${_}" x2="${j}" y1="${Ht}" y2="${Ht}" stroke="rgba(255,255,255,.07)" stroke-width="1"/>
        <text x="${_ - 8}" y="${I + 3}" text-anchor="end" font-size="9.5" fill="${A}" font-family="Geist Mono">${Vt ? St(tickVal, { compact: true }) : ""}</text>
        <text x="${_ - 8}" y="${Ht + 3}" text-anchor="end" font-size="9.5" fill="${A}" font-family="Geist Mono">${Vt ? St(tickVal, { compact: true }) : ""}</text>`;
    });
    Ut += `<line x1="${_}" x2="${j}" y1="${U}" y2="${U}" stroke="rgba(255,255,255,.2)" stroke-width="1"/>`;
    yl.forEach((Vt, Bt) => {
      Ut += `<path d="${pt(Vt, -1)}" fill="none" stroke="#fff" stroke-opacity="${[.9, .45, .2][Bt] || 0.45}" stroke-width="${Bt === 0 ? 2 : 1.2}" stroke-linecap="round"/>`;
    });
    Ie.forEach((Vt, Bt) => {
      Ut += `<path d="${pt(Vt, 1)}" fill="none" stroke="#FFD0E6" stroke-opacity="${[.95, .5, .25][Bt] || 0.5}" stroke-width="${Bt === 0 ? 2 : 1.2}" stroke-dasharray="4 3" stroke-linecap="round"/>`;
    });
    Pe.forEach((Vt, Bt) => {
      Ut += `<text x="${ot(Bt)}" y="${O - 4}" text-anchor="middle" font-size="10" fill="${w}" font-family="Geist">${Vt}</text>
        <rect class="fl-h" x="${ot(Bt) - 18}" y="0" width="36" height="${O}" fill="transparent" data-i="${Bt}"/>`;
    });
    E.innerHTML = Ut;

    const subEl = Fe.querySelector(".fl-sub");
    if (subEl) subEl.textContent = H?.cashflow?.lossRatioSubtitle || lossRatioSub;

    E.querySelectorAll(".fl-h").forEach((Vt) => {
      (Vt as HTMLElement).onpointermove = (Bt) => {
        const I = +(Vt as HTMLElement).dataset.i;
        const valInc = (yl[0] && yl[0][I] != null) ? yl[0][I] : 5;
        const valSp = (Ie[0] && Ie[0][I] != null) ? Ie[0][I] : 1.5;
        Zl(Bt.clientX, Bt.clientY, Pe[I] + " · Logistics Net", [
          ["Retained GMV", St(valInc * 1000), "#fff"],
          ["RTO Loss & Freight", St(valSp * 1000), "#FFD0E6"],
          ["Net Retained", St((valInc - valSp) * 1000), At],
        ]);
      };
      (Vt as HTMLElement).onpointerleave = Lt;
    });
  }

  // 8. TILE: Active Courier Fleet (#crypto - 100% REAL COURIER TELEMETRY)
  const Ll = N("crypto");
  let courierFleet = H?.crypto || [
    { name: 'Delhivery Surface', symbol: 'DEL', share: 0.45, ndrs: 9, atRiskGmv: 18321, rescueRate: 78, ohlc: [[710,770,700,764],[720,780,715,764],[730,775,720,755],[740,790,735,770],[750,785,740,764]] },
    { name: 'Blue Dart Air', symbol: 'BLU', share: 0.25, ndrs: 5, atRiskGmv: 10180, rescueRate: 60, ohlc: [[800,850,790,841],[810,860,805,835],[820,855,810,845],[830,865,825,841],[835,870,830,841]] },
    { name: 'Shiprocket Multi', symbol: 'SHP', share: 0.20, ndrs: 4, atRiskGmv: 8144, rescueRate: 75, ohlc: [[700,710,670,682],[695,705,675,680],[690,700,665,678],[685,695,670,682],[680,690,675,682]] },
    { name: 'Shadowfax Express', symbol: 'SFX', share: 0.10, ndrs: 2, atRiskGmv: 4076, rescueRate: 50, ohlc: [[550,610,540,595],[560,605,550,590],[570,615,560,598],[580,620,575,595],[585,625,580,595]] },
  ];
  let fleetRescueRate = H?.fleetRescueRate || 70;

  Ll.innerHTML = `${Ct(Zt.copper)}<div class="in-c" style="display:flex;flex-direction:column;justify-content:space-between">
    <div>
      <div class="row" style="justify-content:space-between">
        <div class="ttl">Active Courier Fleet</div>
        <span class="muted">Live Carrier SLAs</span>
      </div>
      <div class="row" style="margin-top:10px;align-items:flex-end;justify-content:space-between">
        <span class="big crv" style="font-size:30px">${courierFleet.length} Carriers</span>
        <span style="padding-bottom:3px">
          <span class="delta crd" style="font-size:12px;color:${At}">↑ ${fleetRescueRate}%</span>
          <span class="muted" style="font-size:11px"> Fleet Rescue</span>
        </span>
      </div>
      <div class="crb" style="margin-top:10px"></div>
    </div>
    <div class="crl" style="margin-top:6px"></div>
  </div><div class="rim"></div>`;

  let Wu = Object.fromEntries(courierFleet.map((p) => [p.symbol, p.ohlc || []]));

  function yi(p: string, sparkHeight = 20) {
    if (!Wu[p] || !Wu[p].length) return "";
    const E = Wu[p].map((ht: number[]) => ht[3]);
    const D = 80, O = sparkHeight;
    const _ = Math.min(...E), j = Math.max(...E);
    const U = (j - _) * 0.15 || 1;
    const L = (ht: number) => O - 3 - ((ht - _ + U) / (j - _ + 2 * U)) * (O - 6);
    const K = E.map((ht: number, rt: number) => [2 + (rt / (E.length - 1)) * (D - 6), L(ht)]);
    const F = K[K.length - 1];
    const ot = E[E.length - 1] >= E[0];
    const at = "sg" + p;
    return `<svg width="${D}" height="${O}" viewBox="0 0 ${D} ${O}" aria-hidden="true">
      <defs>
        <linearGradient id="${at}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".16"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${kt(K)}L${F[0]},${O}L${K[0][0]},${O}Z" fill="url(#${at})"/>
      <path d="${kt(K)}" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${F[0]}" cy="${F[1]}" r="2.8" fill="${ot ? At : "#fff"}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
    </svg>`;
  }

  function La(skipAnim = false) {
    const crbEl = Ll.querySelector(".crb");
    if (!crbEl) return;
    const existingCrs = crbEl.querySelectorAll(".crs");
    if (existingCrs.length === courierFleet.length) {
      existingCrs.forEach((el, _) => {
        const O = courierFleet[_]?.share || 0.25;
        (el as HTMLElement).style.flex = `0 0 calc(${O * 100}% - 2px)`;
      });
    } else {
      crbEl.innerHTML = `
        <div style="display:flex;gap:3px;height:5px">
          ${courierFleet.map((item, _) => `<div style="flex:0 0 calc(${item.share * 100}% - 2px);border-radius:3px;background:rgba(255,255,255,${[.95, .6, .35, .2][_] || 0.2});transform-origin:left;transform:scaleX(1)" class="crs"></div>`).join("")}
        </div>
        <div style="display:flex;gap:3px;margin-top:4px">
          ${courierFleet.map((item) => `<span class="mono muted" style="flex:0 0 calc(${item.share * 100}% - 2px);font-size:10px;white-space:nowrap">${item.symbol} ${Math.round(item.share * 100)}%</span>`).join("")}
        </div>`;
    }

    const rowHeight = courierFleet.length > 3 ? 35 : 44;
    const sparkHeight = courierFleet.length > 3 ? 19 : 26;
    const crlEl = Ll.querySelector(".crl");
    if (!crlEl) return;

    crlEl.innerHTML = courierFleet.map((item, U) => {
      const name = item.name;
      const sym = item.symbol;
      const ndrs = item.ndrs || Math.round(item.share * 20);
      const rescue = item.rescueRate || Math.round(65 + item.share * 25);
      const atRisk = item.atRiskGmv || Math.round(item.share * 32000);
      return `
        <div class="row" style="height:${rowHeight}px;${U ? "border-top:1px solid rgba(255,255,255,.08)" : ""};align-items:center;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
            <div class="mono muted" style="font-size:9.5px">${sym} · ${ndrs} NDRs</div>
          </div>
          ${yi(sym, sparkHeight)}
          <div style="width:102px;text-align:right;flex-shrink:0">
            <div class="mono" style="font-size:11.5px;font-weight:600;color:${At}">${rescue}% rescued</div>
            <div class="mono muted" style="font-size:9.5px">${St(atRisk)} at risk</div>
          </div>
        </div>`;
    }).join("");
  }

  // 9. TILE: NDR Incident Cadence (#stocks - 7 FULL DAYS MON-SUN WITH REAL NDR SCALE)
  const ll = N("stocks");
  let Vl = H?.stocks?.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let al = H?.stocks?.values || [2, 3, 5, 4, 3, 6, 5];
  let reasonsSub = H?.stocks?.reasonsSubtitle || "Customer Unavailable (42%)";

  ll.innerHTML = `${Ct(Zt.green)}<div class="in-c">
    <div class="ttl">NDR Incident Cadence</div>
    <div style="margin-top:12px"><span class="big stv" style="font-size:30px">7-Day Curve</span></div>
    <div class="row" style="margin-top:4px;gap:6px">
      <span class="delta st-peak" style="color:var(--acc);font-size:11.5px;flex-shrink:0">Weekend Peaks</span>
      <span class="muted st-sub" style="font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">· ${reasonsSub}</span>
    </div>
    <svg class="sts" style="position:absolute;left:18px;bottom:14px" aria-hidden="true"></svg>
  </div><div class="rim"></div>`;

  function Pu(skipAnim = false) {
    const D = ll.querySelector(".sts") as SVGElement;
    if (!D) return;
    const O = ll.clientWidth - 36;
    const _ = 160, j = 18, U = 18;
    const numBars = al.length;
    const K = Math.max(4, (O - 24 - U * numBars) / Math.max(1, numBars - 1));
    D.setAttribute("width", String(O));
    D.setAttribute("height", String(_));

    const maxCount = Math.max(5, Math.ceil(Math.max(...al) * 1.25));
    const F = (at: number) => (_ - j) * (1 - at / maxCount);

    const existingBars = D.querySelectorAll(".sb");
    if (existingBars.length === al.length) {
      existingBars.forEach((bar, ht) => {
        const at = al[ht];
        const targetY = F(at);
        const targetH = Math.max(4, _ - j - targetY);
        bar.setAttribute("y", String(targetY));
        bar.setAttribute("height", String(targetH));
      });
      return;
    }

    let ot = "";
    const midCount = Math.round(maxCount / 2);
    [0, midCount, maxCount].forEach((at) => {
      ot += `<text x="0" y="${F(at) + 3.5}" font-size="9" fill="${A}" font-family="Geist Mono">${at}</text>`;
    });

    al.forEach((at, ht) => {
      const rt = 20 + ht * (U + K);
      const isWeekend = ht >= 5; // Sat & Sun
      const targetY = F(at);
      const targetH = Math.max(4, _ - j - targetY);
      ot += `<rect x="${rt}" y="${F(maxCount)}" width="${U}" height="${_ - j - F(maxCount)}" rx="${U / 2}" fill="rgba(0,0,0,.28)"/>
        <rect class="sb" x="${rt}" y="${targetY}" width="${U}" height="${targetH}" rx="${U / 2}" fill="${isWeekend ? At : "#fff"}" data-y="${targetY}" data-h="${targetH}" style="transition:y .4s var(--ease),height .4s var(--ease)"/>
        <text x="${rt + U / 2}" y="${_ - 2}" text-anchor="middle" font-size="9.5" fill="${w}" font-family="Geist Mono">${Vl[ht]}</text>
        <rect class="hit" x="${rt - 3}" y="0" width="${U + 6}" height="${_}" fill="transparent" data-i="${ht}"/>`;
    });
    D.innerHTML = ot;

    D.querySelectorAll(".hit").forEach((at) => {
      (at as HTMLElement).onpointermove = (ht) => {
        const rt = +(at as HTMLElement).dataset.i;
        const totalDayNdr = al[rt];
        const unavail = Math.round(totalDayNdr * 0.65);
        const addrIssue = Math.max(0, totalDayNdr - unavail);
        Zl(ht.clientX, ht.clientY, Vl[rt] + " · " + totalDayNdr + " Incidents", [
          ["Customer Unavailable", String(unavail) + " orders", "#fff"],
          ["Door Locked / Fake Attempt", String(addrIssue) + " orders", At],
        ]);
      };
      (at as HTMLElement).onpointerleave = Lt;
    });
  }

  // Interactive Segmented Controls (Period & Currency)
  function Iu(p: HTMLElement, E: string[], D: string) {
    if (!p) return;
    p.innerHTML = E.map((O) => `<button type="button" aria-pressed="${Ot[D] === O}">${O}</button>`).join("");
    p.querySelectorAll("button").forEach((O) => {
      O.onclick = () => {
        Ot[D] = O.textContent;
        p.querySelectorAll("button").forEach((_) => _.setAttribute("aria-pressed", String(_ === O)));
        tn();
      };
    });
  }

  const periodEl = N("period");
  if (periodEl) Iu(periodEl, ["1M", "3M", "1Y", "All"], "period");
  const ccyEl = N("ccy");
  if (ccyEl) Iu(ccyEl, ["INR", "USD"], "ccy");

  function tn(skipAnim = false) {
    B(skipAnim);
    Z(skipAnim);
    W();
    Dt();
    oe();
    de();
    tu(skipAnim);
    La(skipAnim);
    Pu(skipAnim);
  }

  // Pre-render synchronous content on mount so cards don't flicker from blank state!
  tn(true);

  let lastSnap = {
    history: JSON.stringify(H?.history || []),
    payments: JSON.stringify(H?.payments || []),
    goals: JSON.stringify(H?.goals || []),
    cashflow: JSON.stringify(H?.cashflow || {}),
    crypto: JSON.stringify(H?.crypto || []),
    stocks: JSON.stringify(H?.stocks || {}),
    protection: JSON.stringify(H?.protection || {}),
    capitalSaved: JSON.stringify(H?.capitalSaved || {}),
  };

  let Sa: any;
  let lastW = 0;
  const Va = new ResizeObserver((entries) => {
    const entry = entries[0];
    const curW = entry ? Math.round(entry.contentRect.width) : Math.round(M.clientWidth);
    if (!curW) return;
    if (lastW === 0) {
      lastW = curW;
      return; // Ignore initial layout measurement
    }
    if (Math.abs(curW - lastW) < 8) return; // Ignore subpixel or minor scrollbar layout shifts (<8px)
    lastW = curW;
    clearTimeout(Sa);
    Sa = setTimeout(() => {
      if (o && isReady) {
        C = 1;
        z();
        tu(true);
        Pu(true);
        Dt();
        de();
      }
    }, 150);
  });

  Va.observe(M);

  let isReady = true;
  N("grid")?.classList.add("in");

  return {
    setCurrency(newCcy: 'INR' | 'USD') {
      if (Ot.ccy !== newCcy) {
        Ot.ccy = newCcy;
        const cEl = N("ccy");
        if (cEl) {
          cEl.querySelectorAll("button").forEach(b => {
            b.setAttribute("aria-pressed", String(b.textContent === newCcy));
          });
        }
        tn(true);
      }
    },
    setPeriod(newPeriod: string) {
      if (Ot.period !== newPeriod) {
        Ot.period = newPeriod;
        const pEl = N("period");
        if (pEl) {
          pEl.querySelectorAll("button").forEach(b => {
            b.setAttribute("aria-pressed", String(b.textContent === newPeriod));
          });
        }
        tn(true);
      }
    },
    updateData(newH: FinanceBentoData, newSubtitle?: string) {
      if (!newH || !V) return;

      const snapHistory = JSON.stringify(newH.history || []);
      const snapPayments = JSON.stringify(newH.payments || []);
      const snapGoals = JSON.stringify(newH.goals || []);
      const snapCashflow = JSON.stringify(newH.cashflow || {});
      const snapCrypto = JSON.stringify(newH.crypto || []);
      const snapStocks = JSON.stringify(newH.stocks || {});
      const snapProt = JSON.stringify(newH.protection || {});
      const snapCap = JSON.stringify(newH.capitalSaved || {});

      const historyChanged = snapHistory !== lastSnap.history;
      const paymentsChanged = snapPayments !== lastSnap.payments;
      const goalsChanged = snapGoals !== lastSnap.goals;
      const cashflowChanged = snapCashflow !== lastSnap.cashflow;
      const cryptoChanged = snapCrypto !== lastSnap.crypto;
      const stocksChanged = snapStocks !== lastSnap.stocks;
      const protChanged = snapProt !== lastSnap.protection;
      const capChanged = snapCap !== lastSnap.capitalSaved;

      lastSnap = {
        history: snapHistory,
        payments: snapPayments,
        goals: snapGoals,
        cashflow: snapCashflow,
        crypto: snapCrypto,
        stocks: snapStocks,
        protection: snapProt,
        capitalSaved: snapCap,
      };

      if (newH.rescueRate != null) retRescueRate = newH.rescueRate;
      if (newH.autonomousPill != null) retAutonomousPill = newH.autonomousPill;
      if (newH.freightSaved != null) retFreightSaved = newH.freightSaved;
      if (newH.fleetRescueRate != null) fleetRescueRate = newH.fleetRescueRate;
      W();

      if (protChanged && newH.protection) {
        protData = newH.protection;
        Z(true);
      }

      if (capChanged && newH.capitalSaved) {
        capSaved = newH.capitalSaved;
        Dt();
      }

      if (historyChanged && newH.history && newH.history.length > 0) {
        Yt = newH.history.map((p: any) => ({
          d: new Date(p.date),
          fiat: p.fiat,
          stocks: p.stocks,
          crypto: p.crypto,
          label: p.label,
        }));
        B(true);
        if (!protChanged) Z(true);
        W();
        if (!capChanged) Dt();
      }
      if (paymentsChanged && newH.payments) {
        se = newH.payments.map((p) => ({
          name: p.name,
          date: p.date,
          amount: p.amount,
          id: p.id || p.name.replace('#', ''),
        }));
        oe();
      }
      if (goalsChanged && newH.goals) {
        We = newH.goals.map((p) => ({
          name: p.name,
          progress: p.progress,
          detail: p.detail || (p.target ? `of ${St(p.target, { compact: true })}` : `${Math.round(p.progress * 100)}% SLA`),
        }));
        de();
      }
      if (cashflowChanged && newH.cashflow) {
        Pe = newH.cashflow.months || Pe;
        yl = newH.cashflow.income || yl;
        Ie = newH.cashflow.spending || Ie;
        flowNet = newH.cashflow.netSavings || flowNet;
        if (newH.cashflow.lossRatioSubtitle) {
          lossRatioSub = newH.cashflow.lossRatioSubtitle;
        }
        tu(true);
      }
      if (cryptoChanged && newH.crypto) {
        courierFleet = newH.crypto;
        Wu = Object.fromEntries(newH.crypto.map((p) => [p.symbol, p.ohlc || []]));
        La(true);
      }
      if (stocksChanged && newH.stocks) {
        Vl = newH.stocks.days || Vl;
        al = newH.stocks.values || al;
        if (newH.stocks.reasonsSubtitle) {
          reasonsSub = newH.stocks.reasonsSubtitle;
          const subEl = ll.querySelector(".st-sub");
          if (subEl) subEl.textContent = reasonsSub;
        }
        Pu(true);
      }
      if (newSubtitle) {
        const asofEl = M.querySelector("#asof");
        if (asofEl && asofEl.textContent !== newSubtitle) {
          asofEl.textContent = newSubtitle;
        }
      }
    },
    destroy() {
      V = false;
      v.forEach((p) => cancelAnimationFrame(p));
      Va.disconnect();
      clearTimeout(Sa);
    },
  };
}

export function FinanceBento({
  data,
  title = "RescueShip Financial Telemetry",
  subtitle = "",
  avatar,
  avatarAlt = "Profile",
  credit = false,
  className = "",
  style,
  hasCustomHeader = false,
  currency = "INR",
  period = "1M",
  onSelectOrder,
  onViewAllOrders,
}: FinanceBentoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<ReturnType<typeof cy> | null>(null);
  const isMountedRef = useRef(false);

  // Mount HTML structure ONCE — never wipe DOM on data updates!
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !data) return;
    el.innerHTML = iy({ title, subtitle, avatar, avatarAlt, credit, hasCustomHeader });
    const ctrl = cy(el, data, currency, period, {
      onSelectOrder,
      onViewAllOrders,
    });
    controllerRef.current = ctrl;
    isMountedRef.current = true;

    return () => {
      ctrl && ctrl.destroy();
      controllerRef.current = null;
      isMountedRef.current = false;
      el.innerHTML = "";
    };
  }, [title, avatar, avatarAlt, credit, hasCustomHeader]);

  // Update in place smoothly whenever data or subtitle changes WITHOUT tearing down the DOM!
  useEffect(() => {
    if (!isMountedRef.current || !controllerRef.current || !data) return;
    controllerRef.current.updateData(data, subtitle);
  }, [data, subtitle]);

  // Update currency reactively without tearing down the DOM!
  useEffect(() => {
    if (controllerRef.current && currency) {
      controllerRef.current.setCurrency(currency);
    }
  }, [currency]);

  // Update period reactively without tearing down the DOM!
  useEffect(() => {
    if (controllerRef.current && period) {
      controllerRef.current.setPeriod(period);
    }
  }, [period]);

  return (
    <>
      <style>{ny}</style>
      <div ref={containerRef} className={`fpb ${hasCustomHeader ? "custom-header" : ""} ${className}`} style={style} />
    </>
  );
}

export default FinanceBento;
