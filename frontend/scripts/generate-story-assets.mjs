import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../public/assets/story');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// ═══════════════════════════════════════════════════════════════
// 1. OLD STEP 4: ORDER CANCELLED BILL (RTO LOSS + CUSTOMER LOSS)
// Aspect ratio: 1200 x 480 (Wide Landscape, fits card perfectly)
// ═══════════════════════════════════════════════════════════════
const oldStep4Html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Order Cancelled Bill</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1200px;
      height: 480px;
      background: #0B0F17;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px 20px;
      overflow: hidden;
    }
    .bill-sheet {
      width: 100%;
      height: 100%;
      background: #FFFFFF;
      border-radius: 14px;
      padding: 22px 28px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
      border: 1px solid #E2E8F0;
    }
    /* Stamped cancellation badge */
    .stamp {
      position: absolute;
      top: 18px;
      right: 28px;
      transform: rotate(3deg);
      border: 3.5px solid #DC2626;
      border-radius: 8px;
      padding: 6px 18px;
      color: #DC2626;
      font-family: "Courier New", Courier, monospace;
      font-weight: 900;
      font-size: 16px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      background: rgba(254, 242, 242, 0.95);
      box-shadow: 0 4px 14px rgba(220, 38, 38, 0.15);
      z-index: 10;
      text-align: center;
      line-height: 1.25;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #F1F5F9;
      padding-bottom: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 32px;
      height: 32px;
      background: #DC2626;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 900;
      font-size: 16px;
    }
    .brand-text h1 {
      font-size: 17px;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.01em;
    }
    .brand-text p {
      font-size: 11px;
      color: #64748B;
      font-family: monospace;
      margin-top: 1px;
    }

    /* Meta details row */
    .meta-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #F8FAFC;
      border-radius: 8px;
      padding: 10px 16px;
      margin-top: 12px;
      border: 1px solid #E2E8F0;
    }
    .meta-item .label {
      font-size: 10px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .meta-item .val {
      font-size: 13px;
      font-weight: 800;
      color: #0F172A;
      margin-top: 2px;
      font-family: monospace;
    }
    .meta-item .val.danger {
      color: #DC2626;
    }

    /* Refusal Reason Callout */
    .refusal-box {
      background: #FEF2F2;
      border-left: 4px solid #DC2626;
      border-radius: 6px;
      padding: 10px 14px;
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .refusal-badge {
      font-size: 11px;
      font-weight: 900;
      color: #991B1B;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }
    .refusal-text {
      font-size: 12px;
      color: #7F1D1D;
      line-height: 1.35;
      font-style: italic;
    }

    /* Loss Comparison Blocks (RTO Loss + Potential Customer Loss) */
    .loss-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 12px;
    }
    .loss-card {
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .loss-card.rto {
      background: #FFF1F2;
      border: 1.5px solid #FECDD3;
    }
    .loss-card.customer {
      background: #FFF7ED;
      border: 1.5px solid #FFEDD5;
    }
    .loss-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .loss-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .loss-card.rto .loss-title { color: #BE123C; }
    .loss-card.customer .loss-title { color: #C2410C; }
    .loss-amount {
      font-size: 20px;
      font-weight: 900;
      font-family: monospace;
      margin-top: 4px;
    }
    .loss-card.rto .loss-amount { color: #E11D48; }
    .loss-card.customer .loss-amount { color: #EA580C; }
    .loss-desc {
      font-size: 11px;
      margin-top: 4px;
      line-height: 1.35;
    }
    .loss-card.rto .loss-desc { color: #9F1239; }
    .loss-card.customer .loss-desc { color: #9A3412; }

    /* Footer with Barcode & Net Loss */
    .bill-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 10px;
      border-top: 1px dashed #CBD5E1;
      margin-top: 8px;
    }
    .barcode-area {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .barcode-lines {
      width: 140px;
      height: 28px;
      background: repeating-linear-gradient(
        90deg,
        #0F172A 0px,
        #0F172A 2px,
        transparent 2px,
        transparent 4px,
        #0F172A 4px,
        #0F172A 7px,
        transparent 7px,
        transparent 9px,
        #0F172A 9px,
        #0F172A 12px,
        transparent 12px,
        transparent 14px
      );
    }
    .barcode-text {
      font-size: 10px;
      font-family: monospace;
      color: #64748B;
      letter-spacing: 0.15em;
    }
    .summary-text {
      font-size: 12px;
      font-weight: 800;
      color: #DC2626;
      font-family: monospace;
      letter-spacing: 0.05em;
    }
  </style>
</head>
<body>
  <div class="bill-sheet">
    <!-- Header -->
    <div class="header-row">
      <div class="brand">
        <div class="brand-icon">✕</div>
        <div class="brand-text">
          <h1>DELHIVERY LOGISTICS · CONSIGNMENT RETURN NOTICE</h1>
          <p>AWB #89421-RS · FAILED DELIVERY DISPATCH</p>
        </div>
      </div>
    </div>

    <!-- Cancellation Stamp -->
    <div class="stamp">
      ✕ ORDER CANCELLED<br>
      <span style="font-size:11px; letter-spacing:0.18em;">RETURN TO ORIGIN (RTO)</span>
    </div>

    <!-- Metadata Details -->
    <div class="meta-row">
      <div class="meta-item">
        <div class="label">Customer</div>
        <div class="val">Priya Sharma</div>
      </div>
      <div class="meta-item">
        <div class="label">Order Value / Mode</div>
        <div class="val danger">COD ₹1,240.00</div>
      </div>
      <div class="meta-item">
        <div class="label">Reattempt Time</div>
        <div class="val">DAY 2 · 02:30 PM</div>
      </div>
      <div class="meta-item">
        <div class="label">Final Status</div>
        <div class="val danger">RTO REJECTED (₹0)</div>
      </div>
    </div>

    <!-- Customer Refusal Reason -->
    <div class="refusal-box">
      <div class="refusal-badge">⚠ DOORSTEP REFUSAL:</div>
      <div class="refusal-text">
        “Customer refused delivery at door: ‘Your first SMS came yesterday saying door locked when I was home. Now 24 hours later I already bought another product locally. Cancel this order and take it back.’”
      </div>
    </div>

    <!-- RTO Loss + Potential Customer Loss Grid -->
    <div class="loss-grid">
      <!-- 1. Direct RTO Freight Loss -->
      <div class="loss-card rto">
        <div class="loss-header">
          <span class="loss-title">1. Dead RTO Logistics Loss</span>
          <span style="font-family:monospace; font-size:11px; font-weight:800; color:#BE123C;">100% UNRECOVERABLE</span>
        </div>
        <div class="loss-amount">-₹430.00</div>
        <div class="loss-desc">
          ₹180 forward shipping burned + ₹250 reverse linehaul freight. Parcel locked in transit bags for 9 days.
        </div>
      </div>

      <!-- 2. Potential Customer & Revenue Loss -->
      <div class="loss-card customer">
        <div class="loss-header">
          <span class="loss-title">2. Potential Customer Loss</span>
          <span style="font-family:monospace; font-size:11px; font-weight:800; color:#C2410C;">BUYER CHURNED</span>
        </div>
        <div class="loss-amount">-₹1,470.00</div>
        <div class="loss-desc">
          ₹1,240 order revenue lost + ₹230 customer acquisition ad spend (CAC) permanently burned to a competitor.
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="bill-footer">
      <div class="barcode-area">
        <div class="barcode-lines"></div>
        <div class="barcode-text">AWB-89421-RTO-FAILED</div>
      </div>
      <div class="summary-text">
        TOTAL DAMAGE: -₹1,900.00 · ₹0 REVENUE RECOVERED
      </div>
    </div>
  </div>
</body>
</html>
`;

// ═══════════════════════════════════════════════════════════════
// 2. OUR STEP 2: FULL-WIDTH AUTHENTIC WHATSAPP CHAT
// Aspect ratio: 1200 x 480 (No blue/green ads, 100% real WhatsApp)
// ═══════════════════════════════════════════════════════════════
const ourStep2Html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WhatsApp Availability Intercept</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1200px;
      height: 480px;
      background: #111B21;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      overflow: hidden;
    }
    .wa-window {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #EFEAE2;
      overflow: hidden;
      position: relative;
    }
    /* WhatsApp App Top Bar (Authentic WhatsApp Web / App Header) */
    .wa-top-bar {
      height: 60px;
      background: #008069;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      color: #FFFFFF;
      box-shadow: 0 2px 5px rgba(0,0,0,0.15);
      z-index: 10;
    }
    .wa-profile {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .wa-avatar {
      width: 42px;
      height: 42px;
      background: #128C7E;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: #FFFFFF;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      border: 1.5px solid rgba(255,255,255,0.4);
    }
    .wa-meta h2 {
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
      letter-spacing: -0.01em;
    }
    .verified-check {
      width: 15px;
      height: 15px;
      background: #25D366;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #075E54;
      font-size: 10px;
      font-weight: 900;
    }
    .wa-meta p {
      font-size: 12px;
      color: rgba(255,255,255,0.85);
      margin-top: 1px;
    }
    .wa-actions {
      display: flex;
      align-items: center;
      gap: 18px;
      color: rgba(255,255,255,0.9);
      font-size: 18px;
    }
    .official-badge {
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.3);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-family: monospace;
    }

    /* Chat Area with authentic WhatsApp doodle pattern */
    .wa-chat-body {
      flex: 1;
      padding: 16px 40px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background-color: #EFEAE2;
      background-image: 
        radial-gradient(#D1D7DB 1px, transparent 1px),
        radial-gradient(#D1D7DB 1px, #EFEAE2 1px);
      background-size: 24px 24px;
      background-position: 0 0, 12px 12px;
      overflow: hidden;
    }

    .pill-center {
      align-self: center;
      background: #FFFFFF;
      color: #54656F;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 6px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.12);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .encryption-pill {
      align-self: center;
      background: #FFEECD;
      color: #54656F;
      font-size: 11px;
      padding: 5px 14px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.08);
      margin-top: 4px;
    }

    /* WhatsApp Bubbles Layout */
    .messages-flow {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 960px;
      margin: 0 auto;
      width: 100%;
    }

    /* 1. Incoming Bot Question */
    .bubble-in {
      align-self: flex-start;
      background: #FFFFFF;
      color: #111B21;
      border-radius: 8px;
      border-top-left-radius: 0px;
      padding: 10px 14px;
      box-shadow: 0 1.5px 3px rgba(0,0,0,0.15);
      max-width: 580px;
      position: relative;
    }
    .bubble-in .text {
      font-size: 14px;
      line-height: 1.4;
    }
    .bubble-in .time {
      font-size: 10px;
      color: #667781;
      text-align: right;
      margin-top: 4px;
    }
    /* Quick Action Buttons inside Bot Message */
    .btn-row {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      border-top: 1px solid #F2F2F2;
      padding-top: 8px;
    }
    .action-chip {
      background: #F0F2F5;
      color: #008069;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid #D1D7DB;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .action-chip.active {
      background: #008069;
      color: #FFFFFF;
      border-color: #008069;
      box-shadow: 0 2px 6px rgba(0, 128, 105, 0.35);
    }

    /* 2. Outgoing Buyer Response */
    .bubble-out {
      align-self: flex-end;
      background: #D9FDD3;
      color: #111B21;
      border-radius: 8px;
      border-top-right-radius: 0px;
      padding: 10px 14px;
      box-shadow: 0 1.5px 3px rgba(0,0,0,0.15);
      max-width: 540px;
    }
    .bubble-out .text {
      font-size: 14px;
      line-height: 1.4;
      font-weight: 500;
    }
    .bubble-out .footer-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      color: #667781;
      margin-top: 4px;
    }
    .blue-ticks {
      color: #53BDEB;
      font-size: 13px;
      font-weight: 900;
    }

    /* 3. Bot Confirmation */
    .bubble-in.confirm {
      background: #FFFFFF;
      max-width: 520px;
    }

    /* WhatsApp Bottom Input Bar */
    .wa-input-bar {
      height: 48px;
      background: #F0F2F5;
      padding: 0 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      border-top: 1px solid #D1D7DB;
    }
    .input-fake {
      flex: 1;
      height: 32px;
      background: #FFFFFF;
      border-radius: 8px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      color: #8696A0;
      font-size: 13px;
    }
    .send-icon {
      width: 32px;
      height: 32px;
      background: #008069;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="wa-window">
    <!-- Top Header -->
    <div class="wa-top-bar">
      <div class="wa-profile">
        <div class="wa-avatar">⚓</div>
        <div class="wa-meta">
          <h2>
            RescueShip Assistant
            <span class="verified-check">✓</span>
          </h2>
          <p>Official Business Account · Automated NDR Intercept</p>
        </div>
      </div>
      <div class="official-badge">
        ✓ 45-SECOND VERIFIED RESPONSE
      </div>
    </div>

    <!-- Chat Body -->
    <div class="wa-chat-body">
      <div class="pill-center">TODAY</div>
      <div class="encryption-pill">
        <span>🔒 Messages are end-to-end encrypted. Verified WhatsApp Cloud API.</span>
      </div>

      <div class="messages-flow">
        <!-- Message 1: Incoming from Bot -->
        <div class="bubble-in">
          <div class="text">
            Hi Priya! Carrier marked Order <strong>#89421</strong> as <em>"Door Locked"</em>.<br>
            Are you home right now?
          </div>
          <div class="btn-row">
            <div class="action-chip active">
              <span>✓ Yes, I'm home</span>
            </div>
            <div class="action-chip">
              <span>📍 Share GPS Pin</span>
            </div>
          </div>
          <div class="time">02:14 PM</div>
        </div>

        <!-- Message 2: Outgoing from Priya -->
        <div class="bubble-out">
          <div class="text">
            Yes! I'm in Flat 402. Bell didn't ring, please send him up.
          </div>
          <div class="footer-row">
            <span>02:15 PM</span>
            <span class="blue-ticks">✓✓</span>
          </div>
        </div>

        <!-- Message 3: Incoming Confirmation -->
        <div class="bubble-in confirm">
          <div class="text">
            Got it! Rider Ramesh notified immediately. He is looping back 200m to Flat 402 now.
          </div>
          <div class="time">02:15 PM</div>
        </div>
      </div>

      <!-- Input Bar -->
      <div class="wa-input-bar">
        <span style="font-size:18px; color:#54656F;">😊</span>
        <span style="font-size:18px; color:#54656F;">📎</span>
        <div class="input-fake">Type a message...</div>
        <div class="send-icon">➤</div>
      </div>
    </div>
  </div>
</body>
</html>
`;

// ═══════════════════════════════════════════════════════════════
// 3. OUR STEP 3: GOOGLE MAPS WITH ADDRESS PIN & WRITTEN ADDRESS
// Aspect ratio: 1200 x 480 (Authentic Google Maps UI & Card)
// ═══════════════════════════════════════════════════════════════
const ourStep3Html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Google Maps Address Pin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1200px;
      height: 480px;
      background: #E5E3DF;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      overflow: hidden;
      position: relative;
    }

    /* Google Maps Canvas Background */
    .map-canvas {
      position: absolute;
      inset: 0;
      background: #F4F3F0;
      overflow: hidden;
    }

    /* Map Features: Parks, Water, Roads */
    .map-park {
      position: absolute;
      top: 40px;
      right: 60px;
      width: 320px;
      height: 220px;
      background: #C8E6C9;
      border-radius: 24px;
      opacity: 0.8;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #2E7D32;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .map-building-block {
      position: absolute;
      background: #E8E5DE;
      border: 1px solid #D5D1C8;
      border-radius: 8px;
    }
    .b-1 { top: 60px; left: 440px; width: 140px; height: 110px; }
    .b-2 { top: 220px; left: 440px; width: 140px; height: 180px; }
    .b-3 { top: 300px; right: 120px; width: 220px; height: 140px; }

    /* Road Network */
    .road-main-h {
      position: absolute;
      top: 190px;
      left: 0;
      right: 0;
      height: 24px;
      background: #FFFFFF;
      border-top: 1px solid #D6D2C4;
      border-bottom: 1px solid #D6D2C4;
      display: flex;
      align-items: center;
      padding-left: 560px;
      font-size: 11px;
      color: #70757A;
      font-weight: 600;
      letter-spacing: 0.08em;
    }
    .road-arterial-v {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 390px;
      width: 28px;
      background: #FDE293;
      border-left: 1px solid #F1C661;
      border-right: 1px solid #F1C661;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .road-label-v {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      font-size: 11px;
      color: #8C6B10;
      font-weight: 700;
      letter-spacing: 0.08em;
    }

    /* Driver Route Loop */
    .driver-path {
      position: absolute;
      top: 160px;
      left: 490px;
      width: 220px;
      height: 70px;
      border: 3.5px dashed #1A73E8;
      border-radius: 35px;
      opacity: 0.85;
    }
    .driver-chip {
      position: absolute;
      top: 135px;
      left: 520px;
      background: #1A73E8;
      color: #FFFFFF;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 8px rgba(26, 115, 232, 0.4);
    }

    /* Classic Red Google Maps Pin */
    .google-pin-container {
      position: absolute;
      top: 140px;
      left: 690px;
      transform: translate(-50%, -100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 30;
      filter: drop-shadow(0 6px 10px rgba(0,0,0,0.3));
    }
    .google-pin-svg {
      width: 44px;
      height: 56px;
    }
    .pin-pulse {
      position: absolute;
      bottom: -6px;
      width: 24px;
      height: 10px;
      background: rgba(234, 67, 53, 0.3);
      border-radius: 50%;
    }

    /* Google Maps Floating Search Bar */
    .maps-search-bar {
      position: absolute;
      top: 20px;
      left: 24px;
      width: 380px;
      height: 48px;
      background: #FFFFFF;
      border-radius: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.22);
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 12px;
      z-index: 40;
    }
    .search-menu { color: #5F6368; font-size: 18px; cursor: pointer; }
    .search-text {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
      color: #202124;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .search-icon { color: #1A73E8; font-size: 16px; }

    /* Google Maps Place Info Card (Floating Left Sheet) */
    .maps-place-card {
      position: absolute;
      top: 80px;
      left: 24px;
      width: 380px;
      background: #FFFFFF;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.18);
      padding: 20px 22px;
      z-index: 40;
      display: flex;
      flex-direction: column;
      gap: 12px;
      border: 1px solid #E8EAED;
    }
    .place-header h3 {
      font-size: 18px;
      font-weight: 800;
      color: #202124;
      letter-spacing: -0.01em;
    }
    .place-sub {
      font-size: 12px;
      color: #5F6368;
      margin-top: 2px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .star-rating {
      color: #E37400;
      font-weight: 700;
    }

    /* Written Address Row */
    .address-section {
      border-top: 1px solid #F1F3F4;
      padding-top: 12px;
      display: flex;
      gap: 10px;
    }
    .loc-icon {
      color: #EA4335;
      font-size: 16px;
      margin-top: 2px;
    }
    .address-details strong {
      font-size: 13px;
      color: #202124;
      display: block;
      line-height: 1.35;
    }
    .address-details p {
      font-size: 12px;
      color: #5F6368;
      margin-top: 2px;
    }

    /* Landmark Note in Card */
    .landmark-callout {
      background: #FEF7E0;
      border-left: 3px solid #FBBC04;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 11px;
      color: #7A5300;
      line-height: 1.35;
    }

    /* Google Action Buttons */
    .action-buttons-row {
      display: flex;
      gap: 10px;
      margin-top: 4px;
    }
    .gm-button {
      flex: 1;
      height: 34px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .gm-button.primary {
      background: #1A73E8;
      color: #FFFFFF;
      box-shadow: 0 1px 3px rgba(26,115,232,0.3);
    }
    .gm-button.secondary {
      background: #F1F3F4;
      color: #1A73E8;
    }

    /* Google Map Controls at bottom right */
    .map-controls {
      position: absolute;
      bottom: 20px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 40;
    }
    .control-btn {
      width: 36px;
      height: 36px;
      background: #FFFFFF;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      color: #5F6368;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <!-- Google Maps Canvas -->
  <div class="map-canvas">
    <div class="map-park">Sector 78 Park</div>
    <div class="map-building-block b-1"></div>
    <div class="map-building-block b-2"></div>
    <div class="map-building-block b-3"></div>

    <div class="road-main-h">Sector 78 Main Road</div>
    <div class="road-arterial-v">
      <div class="road-label-v">Captain Shashi Kant Marg</div>
    </div>

    <!-- 200m Loop route -->
    <div class="driver-path"></div>
    <div class="driver-chip">
      <span>🏍️ Rider Loops Back (200m)</span>
    </div>

    <!-- Authentic Red Google Maps Pin -->
    <div class="google-pin-container">
      <svg class="google-pin-svg" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.37258 0 0 5.37258 0 12C0 20.25 12 32 12 32C12 32 24 20.25 24 12C24 5.37258 18.6274 0 12 0Z" fill="#EA4335"/>
        <circle cx="12" cy="11" r="5" fill="#FFFFFF"/>
        <circle cx="12" cy="11" r="2.5" fill="#B31412"/>
      </svg>
      <div class="pin-pulse"></div>
    </div>
  </div>

  <!-- Google Maps Search Bar -->
  <div class="maps-search-bar">
    <span class="search-menu">☰</span>
    <span class="search-text">Flat 402, Lotus Greens, Sector 78, Noida</span>
    <span class="search-icon">🔍</span>
  </div>

  <!-- Google Maps Place Info Card (Written Address + Pin Callout) -->
  <div class="maps-place-card">
    <div class="place-header">
      <h3>Flat 402, Lotus Greens</h3>
      <div class="place-sub">
        <span class="star-rating">4.8 ★★★★★</span>
        <span>· Verified Residential Destination</span>
      </div>
    </div>

    <div class="address-section">
      <div class="loc-icon">📍</div>
      <div class="address-details">
        <strong>Flat 402, 4th Floor, Tower B</strong>
        <p>Lotus Greens, Sector 78, Noida, Uttar Pradesh 201301</p>
      </div>
    </div>

    <div class="landmark-callout">
      <strong>WRITTEN DRIVER INSTRUCTIONS:</strong><br>
      Gate 2 Entrance · Behind Green Park Market · Tower B Passenger Lift · 4th Floor, Door on Right.
    </div>

    <div class="action-buttons-row">
      <div class="gm-button primary">🧭 Directions</div>
      <div class="gm-button secondary">🔖 Save</div>
      <div class="gm-button secondary">↗ Share</div>
    </div>
  </div>

  <!-- Map Zoom Controls -->
  <div class="map-controls">
    <div class="control-btn">+</div>
    <div class="control-btn">−</div>
  </div>
</body>
</html>
`;

async function generate() {
  console.log('Launching Playwright Chromium...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1200, height: 480 },
    deviceScaleFactor: 2, // 2x Retina resolution
  });

  // 1. Old Step 4: Cancelled Order Bill
  console.log('Generating Old Step 4: Order Cancelled Bill (RTO Loss + Customer Loss)...');
  await page.setContent(oldStep4Html);
  const p1 = path.join(outDir, 'old_step_4_cancelled_order.png');
  await page.screenshot({ path: p1, type: 'png' });
  console.log('Saved:', p1);

  // 2. Our Step 2: Full-width Authentic WhatsApp Chat
  console.log('Generating Our Step 2: Full-width Authentic WhatsApp Chat...');
  await page.setContent(ourStep2Html);
  const p2 = path.join(outDir, 'our_step_2_whatsapp_availability.png');
  await page.screenshot({ path: p2, type: 'png' });
  console.log('Saved:', p2);

  // 3. Our Step 3: Google Maps Address Pin & Written Address
  console.log('Generating Our Step 3: Google Maps Address Pin & Written Address...');
  await page.setContent(ourStep3Html);
  const p3 = path.join(outDir, 'our_step_3_address_pin_upi.png');
  await page.screenshot({ path: p3, type: 'png' });
  console.log('Saved:', p3);

  await browser.close();
  console.log('Successfully generated all 3 updated story images!');
}

generate().catch(err => {
  console.error('Generation failed:', err);
  process.exit(1);
});
