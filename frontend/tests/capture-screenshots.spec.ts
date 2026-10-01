import { test } from '@playwright/test';

test('capture ROI calculator and Pricing section screenshots at 3,000 orders', async ({ page }) => {
  await page.addInitScript(() => {
    try { sessionStorage.setItem('rs_booted', '1'); } catch {}
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  // Set ROI calculator to 3,000 orders
  const ordersSlider = page.locator('input.roi__range').first();
  await ordersSlider.waitFor({ state: 'visible' });
  await ordersSlider.fill('3000');
  await ordersSlider.dispatchEvent('change');
  await page.waitForTimeout(500);

  // Take screenshot of ROI calculator
  const roiSection = page.locator('.roi');
  await roiSection.scrollIntoViewIfNeeded();
  await roiSection.screenshot({
    path: 'C:/Users/Konark Parihar/.gemini/antigravity/brain/81b39a84-6fbc-4848-aa86-072d684b18f5/roi-calculator-3000.png',
  });

  // Take screenshot of Pricing section
  const pricingSection = page.locator('#pricing');
  await pricingSection.scrollIntoViewIfNeeded();
  await pricingSection.screenshot({
    path: 'C:/Users/Konark Parihar/.gemini/antigravity/brain/81b39a84-6fbc-4848-aa86-072d684b18f5/pricing-section-3000.png',
  });
});
