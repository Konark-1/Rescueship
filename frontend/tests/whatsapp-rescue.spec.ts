import { test, expect } from '@playwright/test';

test.describe('WhatsApp Rescue Flow & Carrier API Interception', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
  });

  test('should execute customer confirmation branch ("I\'m Home Now") and rescue order', async ({ page }) => {
    // 1. Mock WhatsApp webhook API or carrier webhook
    await page.route('/api/webhooks/whatsapp', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'delivered', messageId: 'wa_msg_98421' }),
      });
    });

    // 2. Verify simulator container is visible
    const phone = page.locator('.lp-wa');
    await expect(phone).toBeVisible();

    // 3. User taps "I’m Home Now" button chip
    const homeChip = page.locator('button.lp-wa__chip:has-text("Home Now")');
    await expect(homeChip).toBeVisible();
    await homeChip.click();

    // 4. Assert that system reaction banner and status row update to rescued
    const banner = page.locator('.lp-wa__banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('ORDER RESCUED');

    const statusRow = page.locator('.lp-wa__status--ok');
    await expect(statusRow).toBeVisible();
  });

  test('should execute self-funding COD to prepaid retention conversion branch', async ({ page }) => {
    // 1. User taps Cancel Order
    await page.locator('button.lp-wa__chip:has-text("Cancel Order")').click();

    // 2. User accepts self-funding UPI discount (Priya\'s ₹1,240 order -> ₹1,178)
    const payBtn = page.locator('button.lp-wa__chip:has-text("Pay ₹1,178 via UPI")');
    await expect(payBtn).toBeVisible();
    await payBtn.click();

    // 3. Assert COD to Prepaid conversion
    await expect(page.locator('.lp-wa__banner')).toContainText('RESCUED · converted to prepaid');
  });

  test('should execute GPS pin sharing address correction branch', async ({ page }) => {
    // 1. Switch to Address tab
    await page.getByRole('tab', { name: /Address/i }).click();

    // 2. User taps "Share GPS Pin"
    const pinBtn = page.locator('button.lp-wa__chip:has-text("Share GPS Pin")');
    await expect(pinBtn).toBeVisible();
    await pinBtn.click();

    // 3. User confirms delivery coordinates
    const confirmBtn = page.locator('button.lp-wa__chip:has-text("Correct, deliver here")');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 4. Assert carrier address sync
    await expect(page.locator('.lp-wa__banner')).toContainText('ADDRESS CONFIRMED');
  });
});
