import * as THREE from 'three';

export interface RescueScreenSurfaces {
  outerCanvas: HTMLCanvasElement;
  innerCanvas: HTMLCanvasElement;
  outerTexture: THREE.CanvasTexture;
  innerTexture: THREE.CanvasTexture;
  dispose: () => void;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function paintStatusBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  time = '9:41'
): void {
  ctx.save();
  ctx.fillStyle = '#F5F5F0';
  ctx.font = '600 28px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(time, x + 44, y);

  // Signal bars + 5G + Battery
  const rightX = x + width - 44;
  ctx.textAlign = 'right';
  ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('5G', rightX - 66, y + 1);

  // Battery outline
  ctx.strokeStyle = 'rgba(245, 245, 240, 0.72)';
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, rightX - 50, y - 10, 42, 20, 6);
  ctx.stroke();

  ctx.fillStyle = '#34D399';
  drawRoundedRect(ctx, rightX - 46, y - 6, 30, 12, 3);
  ctx.fill();

  ctx.fillStyle = 'rgba(245, 245, 240, 0.72)';
  ctx.fillRect(rightX - 6, y - 4, 3, 8);
  ctx.restore();
}

function paintOuterNdrLockscreen(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // OLED dark wallpaper matching RescueShip void
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.28, 40, w * 0.5, h * 0.48, h * 0.78);
  bg.addColorStop(0, '#132A20');
  bg.addColorStop(0.45, '#0B1110');
  bg.addColorStop(1, '#050505');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle geometric wave glow
  const glow = ctx.createRadialGradient(w * 0.75, h * 0.65, 10, w * 0.65, h * 0.62, w * 0.65);
  glow.addColorStop(0, 'rgba(37, 211, 102, 0.18)');
  glow.addColorStop(1, 'rgba(37, 211, 102, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  paintStatusBar(ctx, 0, 66, w, '9:41');

  // Lock icon
  ctx.save();
  ctx.strokeStyle = 'rgba(245, 245, 240, 0.78)';
  ctx.lineWidth = 3.5;
  drawRoundedRect(ctx, w / 2 - 14, 134, 28, 22, 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, 134, 9, Math.PI, 0);
  ctx.stroke();
  ctx.restore();

  // Date & Clock
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(245, 245, 240, 0.76)';
  ctx.font = '500 34px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('Thursday, May 14', w / 2, 216);

  ctx.fillStyle = '#F5F5F0';
  ctx.font = '700 176px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
  ctx.fillText('9:41', w / 2, 382);

  // WhatsApp NDR Intercept Card
  const cardX = 52;
  const cardY = 536;
  const cardW = w - 104;
  const cardH = 448;

  ctx.save();
  ctx.fillStyle = 'rgba(18, 22, 20, 0.88)';
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.42)';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.fill();
  ctx.stroke();

  // App Badge
  ctx.fillStyle = '#25D366';
  drawRoundedRect(ctx, cardX + 34, cardY + 34, 62, 62, 18);
  ctx.fill();

  ctx.fillStyle = '#05150C';
  ctx.font = '800 32px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('WA', cardX + 65, cardY + 66);

  // Header metadata
  ctx.textAlign = 'left';
  ctx.fillStyle = '#34D399';
  ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('RESCUESHIP • WHATSAPP INTERCEPT', cardX + 116, cardY + 52);

  ctx.fillStyle = 'rgba(245, 245, 240, 0.56)';
  ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('just now', cardX + cardW - 124, cardY + 52);

  ctx.fillStyle = '#F5F5F0';
  ctx.font = '700 36px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('Delivery Attempt Failed (NDR)', cardX + 116, cardY + 94);

  // Divider
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(cardX + 34, cardY + 132, cardW - 68, 2);

  // Alert body
  ctx.fillStyle = '#D6D6D0';
  ctx.font = '400 30px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('Order #RS-84920 flagged: Gate Locked.', cardX + 34, cardY + 186);
  ctx.fillText('AI agent intercepted courier webhook.', cardX + 34, cardY + 230);
  ctx.fillText('Unfold to approve live pin & slot.', cardX + 34, cardY + 274);

  // Action pill
  ctx.fillStyle = 'rgba(37, 211, 102, 0.16)';
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, cardX + 34, cardY + 328, cardW - 68, 82, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#34D399';
  ctx.font = '600 28px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NDR Auto-Rescue Active  •  Unfold →', cardX + cardW / 2, cardY + 370);
  ctx.restore();

  // Bottom home indicator
  ctx.fillStyle = 'rgba(245, 245, 240, 0.72)';
  drawRoundedRect(ctx, w / 2 - 140, h - 46, 280, 10, 5);
  ctx.fill();
}

function paintInnerRescueDashboard(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const half = w / 2;
  const gutter = 48; // Safe margin around center hinge fold

  // Base dark surface
  ctx.fillStyle = '#070808';
  ctx.fillRect(0, 0, w, h);

  // Subtle ambient split highlight
  const leftGlow = ctx.createRadialGradient(half * 0.5, h * 0.2, 20, half * 0.5, h * 0.4, h * 0.7);
  leftGlow.addColorStop(0, 'rgba(37, 211, 102, 0.09)');
  leftGlow.addColorStop(1, 'rgba(7, 8, 8, 0)');
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, half, h);

  paintStatusBar(ctx, 0, 52, w, '9:41');

  // Subtle center hinge divider guide
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(half - 1, 90, 2, h - 150);

  // =========================================================================
  // LEFT DISPLAY: Autonomous WhatsApp AI NDR Resolution Thread
  // =========================================================================
  const lx = 48;
  const lw = half - lx - gutter;

  // Header bar
  ctx.fillStyle = '#101413';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, lx, 104, lw, 108, 28);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#25D366';
  ctx.beginPath();
  ctx.arc(lx + 54, 158, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#05150C';
  ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RS', lx + 54, 159);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#F5F5F0';
  ctx.font = '700 30px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('RescueShip AI Concierge', lx + 98, 144);

  ctx.fillStyle = '#34D399';
  ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('● Live WhatsApp Recovery • #RS-84920', lx + 98, 178);

  // Bubble 1: AI Outbound Intercept
  ctx.fillStyle = '#151918';
  drawRoundedRect(ctx, lx, 248, lw - 64, 212, 28);
  ctx.fill();
  ctx.fillStyle = '#E6E6E0';
  ctx.font = '400 28px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('Hi Aarav, courier flagged Gate Locked', lx + 28, 296);
  ctx.fillText('for #RS-84920. Reply:', lx + 28, 336);
  ctx.fillStyle = '#34D399';
  ctx.font = '600 28px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('1 — Drop with Security   2 — 6PM Slot', lx + 28, 388);
  ctx.fillStyle = 'rgba(245, 245, 240, 0.45)';
  ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('09:41:04 • Auto-dispatched in 1.2s', lx + 28, 434);

  // Bubble 2: Customer Reply
  const replyW = lw - 110;
  const replyX = lx + lw - replyW;
  ctx.fillStyle = '#0B4631';
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, replyX, 496, replyW, 152, 28);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#F5F5F0';
  ctx.font = '500 28px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('1 — Please leave with Tower B', replyX + 28, 548);
  ctx.fillText('Security, gate pin 4829.', replyX + 28, 588);
  ctx.fillStyle = 'rgba(245, 245, 240, 0.6)';
  ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('09:41:36 • Verified ✓✓', replyX + 28, 626);

  // Bubble 3: AI Confirmation + Manifest Patch
  ctx.fillStyle = '#151918';
  drawRoundedRect(ctx, lx, 684, lw - 44, 194, 28);
  ctx.fill();
  ctx.fillStyle = '#34D399';
  ctx.font = '700 26px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('✓ Manifest Patched & Re-routed', lx + 28, 734);
  ctx.fillStyle = '#E6E6E0';
  ctx.font = '400 27px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('Courier updated with Gate Pin 4829.', lx + 28, 780);
  ctx.fillText('Re-attempt confirmed for 4:15 PM.', lx + 28, 820);

  // Input bar
  ctx.fillStyle = '#101212';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  drawRoundedRect(ctx, lx, h - 156, lw, 78, 39);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(245, 245, 240, 0.45)';
  ctx.font = '400 25px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('Autonomous NDR Resolution Complete', lx + 34, h - 117);

  // =========================================================================
  // RIGHT DISPLAY: Real-Time Telemetry & RTO Prevention Ledger
  // =========================================================================
  const rx = half + gutter;
  const rw = w - rx - 48;

  // Status badge card
  ctx.fillStyle = '#101413';
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, rx, 104, rw, 234, 32);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(37, 211, 102, 0.16)';
  drawRoundedRect(ctx, rx + 30, 134, 248, 44, 22);
  ctx.fill();
  ctx.fillStyle = '#34D399';
  ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('● RTO PREVENTED', rx + 56, 157);

  ctx.fillStyle = '#F5F5F0';
  ctx.font = '700 68px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('42 sec', rx + 30, 236);

  ctx.fillStyle = '#A8A8A2';
  ctx.font = '500 26px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('Total resolution time • ₹1,450 margin saved', rx + 30, 298);

  // Webhook Timeline Card
  ctx.fillStyle = '#111313';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  drawRoundedRect(ctx, rx, 372, rw, 446, 32);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#A8A8A2';
  ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('CARRIER WEBHOOK PIPELINE', rx + 30, 422);

  const steps = [
    { time: '09:41:02', label: 'NDR Webhook: GATE_LOCKED', active: false },
    { time: '09:41:04', label: 'WhatsApp Intercept Triggered', active: false },
    { time: '09:41:36', label: 'Customer Approved Pin 4829', active: false },
    { time: '09:41:44', label: 'Courier Manifest Synced Live', active: true },
  ];

  steps.forEach((step, idx) => {
    const sy = 492 + idx * 82;
    ctx.fillStyle = step.active ? '#25D366' : '#34D399';
    ctx.beginPath();
    ctx.arc(rx + 44, sy, step.active ? 10 : 7, 0, Math.PI * 2);
    ctx.fill();

    if (idx < steps.length - 1) {
      ctx.fillStyle = 'rgba(52, 211, 153, 0.25)';
      ctx.fillRect(rx + 43, sy + 14, 2, 54);
    }

    ctx.fillStyle = 'rgba(245, 245, 240, 0.5)';
    ctx.font = '500 22px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(step.time, rx + 76, sy);

    ctx.fillStyle = step.active ? '#34D399' : '#F5F5F0';
    ctx.font = step.active
      ? '700 26px -apple-system, BlinkMacSystemFont, "Inter", sans-serif'
      : '500 26px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
    ctx.fillText(step.label, rx + 210, sy);
  });

  // Bottom Telemetry Footer Card
  ctx.fillStyle = 'rgba(37, 211, 102, 0.1)';
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
  drawRoundedRect(ctx, rx, h - 220, rw, 142, 28);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#34D399';
  ctx.font = '700 26px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('NEXT-ATTEMPT SUCCESS PROBABILITY', rx + 30, h - 170);
  ctx.fillStyle = '#F5F5F0';
  ctx.font = '700 44px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText('98.4% Verified', rx + 30, h - 116);

  // Home bar spanning center
  ctx.fillStyle = 'rgba(245, 245, 240, 0.65)';
  drawRoundedRect(ctx, w / 2 - 180, h - 38, 360, 10, 5);
  ctx.fill();
}

export function createRescueScreenSurfaces(maxAnisotropy = 8): RescueScreenSurfaces {
  const outerCanvas = document.createElement('canvas');
  outerCanvas.width = 1024;
  outerCanvas.height = 2048;
  paintOuterNdrLockscreen(outerCanvas);

  const innerCanvas = document.createElement('canvas');
  innerCanvas.width = 2048;
  innerCanvas.height = 1440;
  paintInnerRescueDashboard(innerCanvas);

  const outerTexture = new THREE.CanvasTexture(outerCanvas);
  outerTexture.colorSpace = THREE.SRGBColorSpace;
  outerTexture.anisotropy = Math.min(8, maxAnisotropy);
  outerTexture.needsUpdate = true;

  const innerTexture = new THREE.CanvasTexture(innerCanvas);
  innerTexture.colorSpace = THREE.SRGBColorSpace;
  innerTexture.anisotropy = Math.min(8, maxAnisotropy);
  innerTexture.needsUpdate = true;

  return {
    outerCanvas,
    innerCanvas,
    outerTexture,
    innerTexture,
    dispose: () => {
      outerTexture.dispose();
      innerTexture.dispose();
    },
  };
}
