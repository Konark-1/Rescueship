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
   Rendered with native Retina supersampling directly onto the canvas plates.
   Safe lower-stack placement below clock digits (never overlapping "9:41").
   ========================================================================== */

export function drawIosWhatsAppNotification(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  cardWidth: number,
  cardHeight = 175,
): void {
  const scale = cardHeight / 175;
  const x = Math.round(centerX - cardWidth / 2);
  const y = Math.round(topY);
  const radius = Math.round(34 * scale);

  ctx.save();

  // 1. Soft iOS ambient drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = Math.round(28 * scale);
  ctx.shadowOffsetY = Math.round(10 * scale);

  // 2. High-contrast authentic iOS 18 smoked glass fill
  const bgGrad = ctx.createLinearGradient(x, y, x, y + cardHeight);
  bgGrad.addColorStop(0, 'rgba(28, 30, 36, 0.88)');
  bgGrad.addColorStop(1, 'rgba(14, 16, 20, 0.94)');
  ctx.fillStyle = bgGrad;

  ctx.beginPath();
  ctx.roundRect(x, y, cardWidth, cardHeight, radius);
  ctx.fill();

  // Reset shadow before drawing inner elements
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 3. Crisp iOS specular glass rim
  const borderGrad = ctx.createLinearGradient(x, y, x, y + cardHeight);
  borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.48)');
  borderGrad.addColorStop(1, 'rgba(255, 255, 255, 0.20)');
  ctx.lineWidth = Math.max(2, Math.round(2.5 * scale));
  ctx.strokeStyle = borderGrad;
  ctx.stroke();

  // 4. WhatsApp iOS Squircle Icon
  const iconSize = Math.round(72 * scale);
  const iconX = x + Math.round(26 * scale);
  const iconY = y + Math.round((cardHeight - iconSize) / 2);

  const waGrad = ctx.createLinearGradient(iconX, iconY, iconX, iconY + iconSize);
  waGrad.addColorStop(0, '#25D366');
  waGrad.addColorStop(1, '#1DA851');
  ctx.fillStyle = waGrad;
  ctx.beginPath();
  ctx.roundRect(iconX, iconY, iconSize, iconSize, Math.round(18 * scale));
  ctx.fill();

  // Draw real WhatsApp Speech Bubble + Handset Vector inside the squircle
  ctx.save();
  ctx.translate(iconX + 16 * scale, iconY + 16 * scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(19, 19, 16, 0.25 * Math.PI, 1.95 * Math.PI, false);
  ctx.lineTo(6, 33);
  ctx.closePath();
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(19, 19, 8.5, 0.15 * Math.PI, 0.85 * Math.PI, false);
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  // Notification Unread Badge ("1")
  const badgeX = iconX + iconSize - Math.round(4 * scale);
  const badgeY = iconY + Math.round(2 * scale);
  const badgeR = Math.round(13 * scale);
  ctx.fillStyle = '#FF3B30';
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${Math.round(15 * scale)}px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1', badgeX, badgeY + 1);

  // 5. Crisp Native Typography Hierarchy (Large, high-contrast, razor-sharp)
  const textX = iconX + iconSize + Math.round(24 * scale);
  const maxTextW = cardWidth - (textX - x) - Math.round(26 * scale);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Row 1: App/Sender Title + Timestamp
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${Math.round(26 * scale)}px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillText('RescueShip Support', textX, y + Math.round(52 * scale));

  // Verified Checkmark Pill
  const titleWidth = ctx.measureText('RescueShip Support').width;
  ctx.fillStyle = '#25D366';
  ctx.font = `700 ${Math.round(24 * scale)}px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillText('✓', textX + titleWidth + Math.round(8 * scale), y + Math.round(52 * scale));

  // "now" timestamp aligned right
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.font = `500 ${Math.round(21 * scale)}px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('now · Delhivery NDR', x + cardWidth - Math.round(26 * scale), y + Math.round(52 * scale));

  // Row 2: Subtitle (Order AWB & Status)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `600 ${Math.round(23 * scale)}px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillText('AWB #4023118876 · Marked "Door Locked"', textX, y + Math.round(94 * scale), maxTextW);

  // Row 3: Body Action Prompt
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.font = `400 ${Math.round(20 * scale)}px "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillText('Are you home? Scroll to unlock & confirm re-delivery.', textX, y + Math.round(132 * scale), maxTextW);

  ctx.restore();
}

export function drawWhatsAppNotif(
  canvas: HTMLCanvasElement,
  pop: number,
): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  // Outer canvas is portrait (1398 x 2034, width < height); inner canvas is landscape (2048 x 1441, width > height)
  const isInner = canvas.width > canvas.height;

  // Exact safe vertical placement:
  // Outer (1398 x 2034): clock ends at y = 779, flashlight/camera starts at y = 1584.
  //   topY = 960, cardHeight = 270 -> sits y: 960 to 1230 (181px below clock, 354px above buttons).
  //   centerX = Math.round(canvas.width / 2) = 699, cardWidth = 1140 -> centered horizontally.
  // Inner (2048 x 1441): clock ends at y = 556, bottom starts at y = 1117.
  //   Center crease is at x = 1024.
  //   centerX = 1580 (safely right of the center crease), cardWidth = 780.
  //   topY = 660, cardHeight = 220 -> sits y: 660 to 880 (104px below clock, 237px above buttons).
  const topY = isInner ? 660 : 960;
  const cardHeight = isInner ? 220 : 270;
  const centerX = isInner ? 1580 : Math.round(canvas.width / 2);
  const cardWidth = isInner ? 780 : 1140;

  // Clear previous notification pixels cleanly
  context.save();
  context.globalCompositeOperation = 'destination-out';
  const clearY = Math.max(0, topY - 40);
  const clearH = cardHeight + 80;
  context.fillRect(0, clearY, canvas.width, clearH);
  context.restore();

  if (pop <= 0.01) return;

  context.save();
  context.globalAlpha = Math.max(0, Math.min(1, pop));

  const animScale = 0.92 + pop * 0.08;
  const animY = (1 - pop) * -18;

  context.translate(centerX, topY + cardHeight / 2);
  context.scale(animScale, animScale);
  context.translate(-centerX, -(topY + cardHeight / 2));
  context.translate(0, animY);

  drawIosWhatsAppNotification(context, centerX, topY, cardWidth, cardHeight);

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
  context.drawImage(clock.time, 0, 0, frame.width, frame.height);
  context.drawImage(foreground, 0, 0);
  context.drawImage(clock.chrome, 0, 0, frame.width, frame.height);
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
