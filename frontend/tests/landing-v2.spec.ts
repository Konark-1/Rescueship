import { test, expect } from '@playwright/test';

test.describe('Landing Page v2 Specifications', () => {
  test.use({
    reducedMotion: 'reduce',
  });

  test.beforeEach(async ({ page }) => {
    // Set reduced-motion and skip boot sequence via rs_booted
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('rs_booted', '1');
      } catch {}
    });
    await page.goto('/');
    await page.locator('.lp').waitFor({ state: 'visible' });
  });

  test('1. Nav anchors: StickyNav links scroll to sections', async ({ page, isMobile }) => {
    test.skip(isMobile, 'StickyNav links are hidden on mobile viewports (< 768px) per responsive design');

    const stickyNav = page.locator('.lnav');
    await expect(stickyNav).toBeVisible();

    // Verify anchor links exist using specific .lnav__link class
    const links = [
      { name: 'Pricing', href: '#pricing' },
      { name: 'Calculate RTO', href: '#calculator' },
      { name: 'Product', href: '#product' },
      { name: 'Features', href: '#features' },
      { name: 'FAQ', href: '#faq' },
    ];

    for (const { name, href } of links) {
      const link = stickyNav.locator(`.lnav__link[href="${href}"]`);
      await expect(link).toBeVisible();
      await expect(link).toContainText(name);
    }

    // Clicking Pricing scrolls to #pricing
    await stickyNav.locator(`.lnav__link[href="#pricing"]`).click();
    const pricingTarget = page.locator('#pricing');
    await expect(pricingTarget).toBeVisible();
    await page.waitForFunction(() => {
      const el = document.getElementById('pricing');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.top >= -100 && rect.top < 300;
    }, { timeout: 5000 });
    const pricingBox = await pricingTarget.boundingBox();
    expect(pricingBox).not.toBeNull();

    // Test other anchor links
    for (const { href } of [{ href: '#calculator' }, { href: '#product' }, { href: '#features' }, { href: '#faq' }]) {
      await stickyNav.locator(`.lnav__link[href="${href}"]`).click();
      const target = page.locator(href);
      await expect(target).toBeVisible();
      await page.waitForTimeout(200);
      const box = await target.boundingBox();
      expect(box).not.toBeNull();
    }
  });

  test('2. ROI math: reactive sliders compute savings correctly at 3,000 orders', async ({ page }) => {
    const roiSection = page.locator('.roi');
    await expect(roiSection).toBeVisible();

    // Check default values for COD share (60%) and RTO rate (25%)
    const codSlider = page.locator('input[aria-label="COD share"]');
    const rtoSlider = page.locator('input[aria-label="Current RTO rate"]');
    await expect(codSlider).toHaveValue('60');
    await expect(rtoSlider).toHaveValue('25');

    // Find orders slider and set to 3000
    const ordersSlider = page.locator('input[aria-label="Monthly orders"]');
    await ordersSlider.fill('3000');
    await ordersSlider.dispatchEvent('input');
    await ordersSlider.dispatchEvent('change');

    // Verify output panel:
    // failures = 3000 * 0.6 * 0.25 = 450
    // rescued = 450 * 0.6 = 270
    // savings = 270 * 250 = ₹67,500
    // plan = Growth
    const roiOut = page.locator('.roi__out');
    await expect(roiOut).toContainText('~450');
    await expect(roiOut).toContainText('failed deliveries intercepted / month');
    await expect(roiOut).toContainText('~270');
    await expect(roiOut).toContainText('rescued at a typical 60% rescue rate');
    await expect(roiOut).toContainText('67,500');
    await expect(roiOut).toContainText('freight saved / month');
    await expect(roiOut.locator('.roi__out-plan-name')).toHaveText('Growth');
  });

  test('3. Sync: PlanPicker selection updates ROI Calculator recommended plan', async ({ page }) => {
    // In PlanPicker, click Scale tier card
    const scaleCard = page.locator('.plan-picker__card, .bl-tier-card').filter({ hasText: 'Scale' }).first();
    await expect(scaleCard).toBeVisible();
    await scaleCard.click();

    // Verify PlanPicker reflects selection
    await expect(scaleCard).toHaveClass(/is-selected/);

    // Verify ROI calculator "Recommended plan" updates to Scale (two-way shared state)
    const roiPlanName = page.locator('.roi__out-plan-name');
    await expect(roiPlanName).toHaveText('Scale');
  });

  test('4. Break-even line: renders coverage multiple > 1 and 90-day guarantee banner', async ({ page }) => {
    const breakeven = page.locator('.pricing__breakeven-text');
    await expect(breakeven).toBeVisible();
    const breakevenText = await breakeven.textContent();
    expect(breakevenText).not.toBeNull();

    // Verify coverage multiple pattern (e.g. 2.8× return or matches \d+(\.\d+)?×)
    const match = breakevenText!.match(/(\d+(\.\d+)?)×/);
    expect(match).not.toBeNull();
    const coverageMultiplier = parseFloat(match![1]);
    expect(coverageMultiplier).toBeGreaterThan(1);

    // Verify 90-day guarantee banner
    const guarantee = page.locator('.pricing__guarantee');
    await expect(guarantee).toBeVisible();
    await expect(guarantee).toContainText('90-day guarantee');
    await expect(guarantee).toContainText("if your ROI ledger doesn't cover the license fee, we refund the difference");
  });

  test('5. FAQ: renders 6 items and accordion expands/collapses with correct aria-expanded state', async ({ page }) => {
    const faqSection = page.locator('.faq');
    await expect(faqSection).toBeVisible();

    // Verify 6 FAQ items
    const faqItems = page.locator('.faq__item');
    await expect(faqItems).toHaveCount(6);

    // First question button aria-expanded is initially 'true'
    const firstFaqBtn = page.locator('.faq__q').first();
    await expect(firstFaqBtn).toHaveAttribute('aria-expanded', 'true');

    // Click it -> check aria-expanded becomes 'false'
    await firstFaqBtn.click();
    await expect(firstFaqBtn).toHaveAttribute('aria-expanded', 'false');

    // Click it again -> check aria-expanded becomes 'true'
    await firstFaqBtn.click();
    await expect(firstFaqBtn).toHaveAttribute('aria-expanded', 'true');
  });

  test('6. Simulator 5th scenario (Pre-Delivery): all 4 interactive paths verify finish banners', async ({ page }) => {
    const simulator = page.locator('.lp-wa');
    await expect(simulator).toBeVisible();
    await simulator.scrollIntoViewIfNeeded();

    // Helper to click Pre-Delivery tab and assert initial 4 choices
    const activatePreDelivery = async () => {
      const preDelivTab = page.locator('.lp-wa__tab', { hasText: 'Pre-Delivery' });
      await preDelivTab.evaluate((el) => {
        el.scrollIntoView({ inline: 'center', block: 'nearest' });
        (el as HTMLElement).click();
      });
      await expect(preDelivTab).toHaveClass(/lp-wa__tab--active/);

      // Verify 4 choices are visible
      const expectedChoices = [
        "✅ Yes, I'm home",
        "📅 Reschedule",
        "📍 Update address",
        "❌ Don't want it",
      ];
      for (const choice of expectedChoices) {
        await expect(page.locator('.lp-wa__chip', { hasText: choice })).toBeVisible();
      }
    };

    // Path 1: Click "✅ Yes, I'm home" -> verify banner contains "FAILURE PREVENTED · before it existed"
    await activatePreDelivery();
    await page.locator('.lp-wa__chip', { hasText: "✅ Yes, I'm home" }).click();
    const banner = page.locator('.lp-wa__banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('FAILURE PREVENTED · before it existed');

    // Path 2: Click Pre-Delivery -> click "📅 Reschedule" -> sub-choices appear -> click "Tomorrow" -> verify banner
    await activatePreDelivery();
    await page.locator('.lp-wa__chip', { hasText: '📅 Reschedule' }).click();
    const tomorrowBtn = page.locator('.lp-wa__chip').filter({ hasText: /^📅 Tomorrow$/ });
    await expect(tomorrowBtn).toBeVisible();
    await tomorrowBtn.click();
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('RESCHEDULED PRE-EMPTIVELY');

    // Path 3: Click Pre-Delivery -> click "📍 Update address" -> click "Share GPS Pin" -> click "Correct, deliver here" -> verify banner
    await activatePreDelivery();
    await page.locator('.lp-wa__chip', { hasText: '📍 Update address' }).click();
    const gpsBtn = page.locator('.lp-wa__chip', { hasText: 'Share GPS Pin' });
    await expect(gpsBtn).toBeVisible();
    await gpsBtn.click();
    const confirmAddrBtn = page.locator('.lp-wa__chip', { hasText: 'Correct, deliver here' });
    await expect(confirmAddrBtn).toBeVisible();
    await confirmAddrBtn.click();
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('ADDRESS CONFIRMED');

    // Path 4: Click Pre-Delivery -> click "❌ Don't want it" -> verify banner
    await activatePreDelivery();
    await page.locator('.lp-wa__chip', { hasText: "❌ Don't want it" }).click();
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('CANCELLED PRE-TRANSIT');
  });

  test('7. Timeline renders 8 steps, updated 11:49 copy, TrustStrip badges, and sample case tag', async ({ page }) => {
    const beats = page.locator('.lp-reel__beat');
    await expect(beats).toHaveCount(8);
    await expect(beats.first()).toContainText('Risk gate');
    await expect(beats.nth(5)).toContainText('Escalation raised · attempt flagged · next-day slot committed to carrier');

    // TrustStrip assertions
    const trust = page.locator('.trust');
    await expect(trust).toBeVisible();
    await expect(trust).toContainText('24/7 uptime monitoring');
    await expect(trust).toContainText('Privacy-first data handling');

    // AccountabilityScene sample case tag
    const logHeader = page.locator('.account__log-header');
    await expect(logHeader).toContainText('sample case');
  });

  test('8. Order Board Geometry: columns maintain fixed height stability without layout shifts', async ({ page, isMobile }) => {
    const boardCols = page.locator('.lp-board__cols');
    await expect(boardCols).toBeVisible();

    if (!isMobile) {
      // On desktop, columns have locked min-height of 387px
      const col1 = page.locator('.lp-board__col').first();
      const col1Box = await col1.boundingBox();
      expect(col1Box?.height).toBeGreaterThanOrEqual(386);
    }

    // Cost section below board must remain vertically stable as orders transition
    const costSection = page.locator('.lp-cost');
    await page.waitForFunction(() => document.fonts.status === 'loaded').catch(() => {});
    await page.waitForTimeout(800);
    const costInitial = await costSection.boundingBox();
    await page.waitForTimeout(2500);
    const costLater = await costSection.boundingBox();
    expect(Math.abs((costLater?.y ?? 0) - (costInitial?.y ?? 0))).toBeLessThanOrEqual(2);
  });
});
