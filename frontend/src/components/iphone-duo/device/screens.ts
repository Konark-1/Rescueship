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
   WhatsApp notification painted onto the clock chrome plate so it rides the
   exact same anchored plane as the "9:41" clock through the 3D unfold.
   The outer cover plate carries the narrow 380px card; the inner plate carries
   the wide 680px rectangular banner that spans the hinge once the phone opens.
   The wipe blend between the two plates IS the unfold-linked extension.
   ========================================================================== */
const NOTIF_CARD = { height: 118, top: 486 };
const NOTIF_STYLE = {
  // width/radius in panel screen-px (774 basis outer, 1600 basis inner); fonts in px too.
  outer: { centerX: 387, width: 410, radius: 20, titleFont: 15.5, bodyFont: 14, timeFont: 12 },
  inner: { centerX: 800, width: 750, radius: 20, titleFont: 24, bodyFont: 20.5, timeFont: 17 },
} as const;
const WHATSAPP_PATH =
  'M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771z';
const NOTIF_BODY =
  '🚚 AWB #4023118876: Delhivery marked “Door Locked”. Are you home? Scroll to confirm.';

function plateUnit(height: number): number {
  // The plates supersample the 774/1600 x 1125 panels; one screen-pixel in plate pixels.
  return height / 1125;
}

function clearNotifRegion(
  context: CanvasRenderingContext2D,
  width: number,
  unit: number,
): void {
  context.save();
  context.globalCompositeOperation = 'destination-out';
  context.fillRect(0, (NOTIF_CARD.top - 90) * unit, width, (NOTIF_CARD.height + 180) * unit);
  context.restore();
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawWhatsAppNotif(
  canvas: HTMLCanvasElement,
  pop: number,
): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  const unit = plateUnit(canvas.height);
  const style = canvas.width > 1600 ? NOTIF_STYLE.inner : NOTIF_STYLE.outer;
  const centerX = style.centerX * unit;
  const top = NOTIF_CARD.top * unit;
  const cardW = style.width * unit;
  const cardH = NOTIF_CARD.height * unit;
  const radius = style.radius * unit;
  clearNotifRegion(context, canvas.width, unit);
  if (pop <= 0.01) return;
  context.save();
  context.globalAlpha = Math.max(0, Math.min(1, pop));
  context.translate(centerX, top + cardH / 2);
  context.scale(0.88 + pop * 0.12, 0.88 + pop * 0.12);
  context.translate(0, (1 - pop) * -40 * unit);

  const x = -cardW / 2;
  const y = -cardH / 2;
  // Frosted glass card
  const fill = context.createLinearGradient(x, y, x + cardW, y + cardH);
  fill.addColorStop(0, 'rgba(18, 22, 28, 0.68)');
  fill.addColorStop(1, 'rgba(18, 22, 28, 0.50)');
  context.beginPath();
  context.roundRect(x, y, cardW, cardH, radius);
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = 1.5 * unit;
  context.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  context.stroke();

  // WhatsApp green squircle icon + red badge (left-anchored, iOS banner style)
  const isInner = canvas.width > 1600;
  const icon = (isInner ? 58 : 48) * unit;
  const iconX = x + (isInner ? 18 : 16) * unit;
  const iconY = y + (cardH - icon) / 2;
  context.beginPath();
  context.roundRect(iconX, iconY, icon, icon, (isInner ? 16 : 14) * unit);
  context.fillStyle = '#25D366';
  context.fill();
  const glyph = new Path2D(WHATSAPP_PATH);
  const glyphScale = (icon * 0.62) / 24;
  context.save();
  context.translate(iconX + icon * 0.19, iconY + icon * 0.19);
  context.scale(glyphScale, glyphScale);
  context.fillStyle = '#ffffff';
  context.fill(glyph);
  context.restore();
  context.beginPath();
  context.arc(iconX + icon - 2 * unit, iconY + 2 * unit, (isInner ? 12 : 10) * unit, 0, Math.PI * 2);
  context.fillStyle = '#FF3B1D';
  context.fill();
  context.fillStyle = '#ffffff';
  context.font = `800 ${(isInner ? 14 : 11) * unit}px "Plus Jakarta Sans", -apple-system, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('1', iconX + icon - 2 * unit, iconY + 2.5 * unit);

  // Left-aligned copy inside the remaining banner body
  const copyLeft = iconX + icon + (isInner ? 18 : 14) * unit;
  const copyRight = x + cardW - (isInner ? 20 : 16) * unit;
  const copyWidth = copyRight - copyLeft;
  context.textBaseline = 'alphabetic';

  // Title row: left-aligned title, "now" pinned to the right edge
  context.fillStyle = '#ffffff';
  context.font = `800 ${style.titleFont * unit}px -apple-system, "SF Pro Display", "Plus Jakarta Sans", sans-serif`;
  context.textAlign = 'left';
  context.fillText('RescueShip Delivery Support ✓', copyLeft, y + (isInner ? 38 : 36) * unit);
  context.fillStyle = 'rgba(255, 255, 255, 0.85)';
  context.font = `700 ${style.timeFont * unit}px -apple-system, "Plus Jakarta Sans", sans-serif`;
  context.textAlign = 'right';
  context.fillText('now', copyRight, y + (isInner ? 38 : 36) * unit);

  // Body: word-wrapped + left-aligned under the title
  context.fillStyle = 'rgba(255, 255, 255, 0.98)';
  context.font = `600 ${style.bodyFont * unit}px -apple-system, "Plus Jakarta Sans", sans-serif`;
  context.textAlign = 'left';
  const lines = wrapText(context, NOTIF_BODY, copyWidth);
  const bodyTop = y + (isInner ? 72 : 65) * unit;
  const lineGap = style.bodyFont * unit * 1.34;
  lines.forEach((line, index) => {
    context.fillText(line, copyLeft, bodyTop + index * lineGap);
  });
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
