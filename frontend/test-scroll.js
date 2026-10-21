import { chromium } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Konark Parihar/.gemini/antigravity/brain/24ab0b57-c727-4b10-b791-0391400ef16c';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    try { sessionStorage.setItem('rs_booted', '1'); } catch {}
  });

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(500);

  const track = page.locator('#foldfolio-demo');
  const box = await track.boundingBox();
  if (!box) throw new Error('No track box');

  console.log(`Track top: ${box.y}, height: ${box.height}`);

  // Test at scroll fractions 0.05, 0.28, 0.38, 0.50, 0.65, 0.90
  const fractions = [
    { p: 0.05, name: 'scroll-1-closed-05.png' },
    { p: 0.28, name: 'scroll-2-swinging-28.png' },
    { p: 0.38, name: 'scroll-3-mid-swing-38.png' },
    { p: 0.50, name: 'scroll-4-nearly-open-50.png' },
    { p: 0.65, name: 'scroll-5-unfolded-home-65.png' },
    { p: 0.90, name: 'scroll-6-still-home-never-wa-90.png' },
  ];

  for (const item of fractions) {
    const scrollTarget = box.y + box.height * item.p;
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrollTarget);
    await page.waitForTimeout(600);

    const telemetry = await page.evaluate(() => {
      const leftLeaf = document.querySelector('.rs-book-leaf--left');
      const transform = window.getComputedStyle(leftLeaf).transform;
      const isWaOpen = !!document.querySelector('.rs-wa-pane');
      const activeChip = document.querySelector('.rs-fold-chip.is-active')?.textContent;
      return { transform, isWaOpen, activeChip };
    });

    console.log(`Progress ${item.p}: activeChip="${telemetry.activeChip}", isWaOpen=${telemetry.isWaOpen}`);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, item.name),
      clip: { x: 260, y: 120, width: 920, height: 680 }
    });
  }

  await browser.close();
  console.log('Scroll simulation completed.');
}

main().catch(console.error);
