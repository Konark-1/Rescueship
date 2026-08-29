import { test, expect } from '@playwright/test';

test.describe('WhatsApp Rescue Flow & Carrier API Interception', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
  });

  test('should execute customer confirmation branch ("Yes, I\'m home") and rescue order', async ({ page }) => {
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

    // 3. User taps "Yes, I’m home" button chip
    const homeChip = page.locator('button.lp-wa__chip:has-text("Yes, I’m home")');
    await expect(homeChip).toBeVisible();
    await homeChip.click();

    // 4. Assert that system reaction banner and status row update to rescued
    const banner = page.locator('.lp-wa__banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('ORDER RESCUED');

    const statusRow = page.locator('.lp-wa__status--ok');
    await expect(statusRow).toBeVisible();
  });

  test('should execute price-match & UPI payment conversion branch', async ({ page }) => {
    // 1. User taps Cancel
    await page.locator('button.lp-wa__chip:has-text("Cancel")').click();

    // 2. User taps "Found it cheaper"
    await page.locator('button.lp-wa__chip:has-text("Found it cheaper")').click();

    // 3. User accepts UPI discount
    const payBtn = page.locator('button.lp-wa__chip:has-text("Pay ₹1,224 via UPI")');
    await expect(payBtn).toBeVisible();
    await payBtn.click();

    // 4. Assert COD to Prepaid conversion
    await expect(page.locator('.lp-wa__banner')).toContainText('RESCUED · converted to prepaid');
  });

  test('should execute GPS pin sharing address correction branch', async ({ page }) => {
    // 1. User taps "Share my pin"
    const pinBtn = page.locator('button.lp-wa__chip:has-text("Share my pin")');
    await pinBtn.click();

    // 2. Assert carrier address sync
    await expect(page.locator('.lp-wa__banner')).toContainText('ADDRESS SYNCED');
  });
});
