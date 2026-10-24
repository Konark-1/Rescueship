const INNER_WIDTH = 1600;
const OUTER_WIDTH = 774;
const HEIGHT = 1125;
const UI_ASSETS = `${import.meta.env.BASE_URL}assets/ui/`;

const CLOCK_TIME_BOX = { width: 0.73, height: 0.54 };
const OUTER_WALLPAPER_BIAS = -0.1;

export type ScreenImage = HTMLImageElement | HTMLCanvasElement;
export type RollDirection = 'clockwise' | 'anticlockwise';
export type ScreenPanel = 'inner' | 'outer';

export interface ClockPlates {
  readonly time: ScreenImage;
  readonly chrome: ScreenImage;
}

export interface LockScreen {
  readonly backdrop: ScreenImage;
  readonly sky: ScreenImage;
  readonly mountain: ScreenImage;
  readonly innerClock: ClockPlates;
  readonly outerClock: ClockPlates;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

function canvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('A 2D canvas context is not available.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  return context;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function keepBox(plate: HTMLImageElement, box: { width: number; height: number }, inside: boolean): HTMLCanvasElement {
  const canvas = createCanvas(plate.naturalWidth, plate.naturalHeight);
  const context = canvasContext(canvas);
  context.drawImage(plate, 0, 0);
  if (inside) {
    context.clearRect(box.width, 0, canvas.width - box.width, canvas.height);
    context.clearRect(0, box.height, box.width, canvas.height - box.height);
  } else {
    context.clearRect(0, 0, box.width, box.height);
  }
  return canvas;
}

function splitClock(plate: HTMLImageElement): ClockPlates {
  const box = {
    width: Math.round(plate.naturalWidth * CLOCK_TIME_BOX.width),
    height: Math.round(plate.naturalHeight * CLOCK_TIME_BOX.height),
  };
  return { time: keepBox(plate, box, true), chrome: keepBox(plate, box, false) };
}

/* ==========================================================================
   AUTHENTIC APPLE iOS 18 GLASS WHATSAPP NOTIFICATION
   Rendered with 2x/3x Retina supersampling directly onto the canvas plates.
   Features:
   - Smoked-sand frosted glass gradient blending with desert wallpaper
   - Ultra-subtle 1px specular glass rim (no thick grey borders)
   - Real WhatsApp speech bubble + handset vector logo inside iOS squircle
   - High-contrast 3-row iOS 18 notification typography hierarchy
   ========================================================================== */

export function drawIosWhatsAppNotification(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  cardWidth: number,
  cssScale = 1
): void {
  const cardHeight = 96;
  const x = centerX - cardWidth / 2;
  const y = topY;
  const radius = 22;

  ctx.save();
  ctx.scale(cssScale, cssScale);

  // 1. Soft iOS ambient drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;

  // 2. Authentic iOS 18 translucent smoked-sand glass fill (blends with desert wallpaper)
  const bgGrad = ctx.createLinearGradient(x, y, x, y + cardHeight);
  bgGrad.addColorStop(0, 'rgba(38, 36, 34, 0.68)');
  bgGrad.addColorStop(1, 'rgba(24, 23, 22, 0.76)');
  ctx.fillStyle = bgGrad;

  ctx.beginPath();
  ctx.roundRect(x, y, cardWidth, cardHeight, radius);
  ctx.fill();

  // Reset shadow before drawing inner elements
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 3. Ultra-subtle 0.75px-1px iOS specular glass rim (NOT a thick grey border)
  const borderGrad = ctx.createLinearGradient(x, y, x, y + cardHeight);
  borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
  borderGrad.addColorStop(1, 'rgba(255, 255, 255, 0.12)');
  ctx.lineWidth = 1;
  ctx.strokeStyle = borderGrad;
  ctx.stroke();

  // 4. Authentic WhatsApp iOS Squircle Icon (46x46)
  const iconSize = 46;
  const iconX = x + 18;
  const iconY = y + (cardHeight - iconSize) / 2;

  const waGrad = ctx.createLinearGradient(iconX, iconY, iconX, iconY + iconSize);
  waGrad.addColorStop(0, '#25D366');
  waGrad.addColorStop(1, '#1DA851');
  ctx.fillStyle = waGrad;
  ctx.beginPath();
  ctx.roundRect(iconX, iconY, iconSize, iconSize, 12);
  ctx.fill();

  // Draw real WhatsApp Speech Bubble + Handset Vector inside the squircle
  ctx.save();
  ctx.translate(iconX + 11, iconY + 11);
  ctx.fillStyle = '#FFFFFF';
  // Outer speech bubble ring
  ctx.beginPath();
  ctx.arc(12, 12, 10, 0.25 * Math.PI, 1.95 * Math.PI, false);
  ctx.lineTo(4, 21);
  ctx.closePath();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  // Inner telephone handset curve
  ctx.beginPath();
  ctx.arc(12, 12, 5.2, 0.15 * Math.PI, 0.85 * Math.PI, false);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  // Notification Unread Badge ("1")
  const badgeX = iconX + iconSize - 2;
  const badgeY = iconY + 2;
  ctx.fillStyle = '#FF3B30';
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 11.5px -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1', badgeX, badgeY + 0.5);

  // 5. Crisp iOS 18 Notification Typography Hierarchy
  const textX = iconX + iconSize + 14;
  const maxTextW = cardWidth - (textX - x) - 18;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Row 1: App/Sender Title + Timestamp
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif';
  ctx.fillText('RescueShip Delivery Support', textX, y + 31);

  // Verified Checkmark Pill
  const titleWidth = ctx.measureText('RescueShip Delivery Support').width;
  ctx.fillStyle = '#25D366';
  ctx.font = '700 14px -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif';
  ctx.fillText('✓', textX + titleWidth + 5, y + 31);

  // "now" timestamp aligned right
  ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
  ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('now', x + cardWidth - 18, y + 30);

  // Row 2: Subtitle (Order AWB & Status) — Zero blurry Windows emoji
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif';
  ctx.fillText('AWB #4023118876 · Delhivery Marked "Door Locked"', textX, y + 54, maxTextW);

  // Row 3: Body Action Prompt
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.font = '400 13.5px -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Are you home? Scroll to unlock & confirm re-delivery.', textX, y + 75, maxTextW);

  ctx.restore();
}

export function drawWhatsAppNotif(
  canvas: HTMLCanvasElement,
  pop: number,
): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  const isInner = canvas.width > 1600;

  // Outer plate: 1398 x 2034 representing 470px CSS width. cssScale = 1398 / 470 = 2.974
  // Inner plate: 2048 x 1441 representing 956px CSS width. cssScale = 2048 / 956 = 2.142
  const cssScale = isInner ? canvas.width / 956 : canvas.width / 470;
  const centerX = isInner ? 956 / 2 : 470 / 2;
  const topY = 285;
  const cardWidth = isInner ? 560 : 412;
  const cardHeight = 96;

  // Clear previous notification pixels cleanly
  context.save();
  context.globalCompositeOperation = 'destination-out';
  const clearY = Math.max(0, (topY - 50) * cssScale);
  const clearH = (cardHeight + 100) * cssScale;
  context.fillRect(0, clearY, canvas.width, clearH);
  context.restore();

  if (pop <= 0.01) return;

  context.save();
  context.globalAlpha = Math.max(0, Math.min(1, pop));

  // iOS subtle spring pop-in
  const animScale = 0.92 + pop * 0.08;
  const animY = (1 - pop) * -20;
  context.translate(centerX * cssScale, (topY + cardHeight / 2) * cssScale);
  context.scale(animScale, animScale);
  context.translate(-centerX * cssScale, -(topY + cardHeight / 2) * cssScale);
  context.translate(0, animY * cssScale);

  drawIosWhatsAppNotification(context, centerX, topY, cardWidth, cssScale);

  context.restore();
}

export async function loadLockScreen(): Promise<LockScreen> {
  const [backdrop, sky, mountain, innerClock, outerClock] = await Promise.all([
    loadImage(`${UI_ASSETS}base.webp`),
    loadImage(`${UI_ASSETS}top.webp`),
    loadImage(`${UI_ASSETS}middle.webp`),
    loadImage(`${UI_ASSETS}clock-inner.avif`),
    loadImage(`${UI_ASSETS}clock-outer.avif`),
  ]);
  return { backdrop, sky, mountain, innerClock: splitClock(innerClock), outerClock: splitClock(outerClock) };
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: ScreenImage,
  width: number,
  height: number,
  bias = 0,
): void {
  const source = image instanceof HTMLCanvasElement ? { width: image.width, height: image.height } : image;
  const scale = Math.max(width / source.width, height / source.height);
  const drawn = { width: source.width * scale, height: source.height * scale };
  const left = Math.min(0, Math.max(width - drawn.width, (width - drawn.width) / 2 + bias * width));
  context.drawImage(image, left, (height - drawn.height) / 2, drawn.width, drawn.height);
}

export type ScreenTurn = 'none' | RollDirection;

export function paintPanelLockScreen(
  lockScreen: LockScreen,
  panel: ScreenPanel,
  turn: ScreenTurn,
): HTMLCanvasElement {
  const width = panel === 'inner' ? INNER_WIDTH : OUTER_WIDTH;
  const upright = turn === 'none';
  const clock =
    (panel === 'inner') === upright ? lockScreen.innerClock : lockScreen.outerClock;
  const canvas = createCanvas(width, HEIGHT);
  const context = canvasContext(canvas);
  if (turn === 'clockwise') {
    context.translate(width, 0);
    context.rotate(Math.PI / 2);
  } else if (turn === 'anticlockwise') {
    context.translate(0, HEIGHT);
    context.rotate(-Math.PI / 2);
  }
  const frame = upright ? { width, height: HEIGHT } : { width: HEIGHT, height: width };
  const bias = panel === 'outer' ? OUTER_WALLPAPER_BIAS : 0;
  const foreground = createCanvas(frame.width, frame.height);
  const front = canvasContext(foreground);
  drawCover(front, lockScreen.backdrop, frame.width, frame.height, bias);
  front.globalCompositeOperation = 'destination-out';
  drawCover(front, lockScreen.sky, frame.width, frame.height, bias);
  drawCover(context, lockScreen.backdrop, frame.width, frame.height, bias);
  if (panel === 'outer') {
    context.drawImage(clock.time, 0, 0, frame.width, frame.height);
    context.drawImage(foreground, 0, 0);
    context.drawImage(clock.chrome, 0, 0, frame.width, frame.height);
  }
  return canvas;
}

function paintFittedImage(image: ScreenImage): HTMLCanvasElement {
  const canvas = createCanvas(INNER_WIDTH, HEIGHT);
  const context = canvasContext(canvas);
  context.fillStyle = '#101418';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const source = image instanceof HTMLCanvasElement ? { width: image.width, height: image.height } : image;
  const scale = Math.min(canvas.width / source.width, canvas.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  return canvas;
}

export async function paintCustomImage(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    return paintFittedImage(await loadImage(url));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadStaticImage(src: string): Promise<HTMLCanvasElement> {
  return paintFittedImage(await loadImage(src));
}
