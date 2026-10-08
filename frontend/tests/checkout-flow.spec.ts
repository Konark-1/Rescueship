import { test, expect } from '@playwright/test';

test.describe('PART 3.1: Full E2E Checkout Flow & The ₹4,999 Mandate', () => {
  test('Navigates from Landing → Register → Billing and triggers Razorpay with canonical ₹4,999 payload', async ({ page }) => {
    // 1. Mock Razorpay SDK globally
    await page.addInitScript(() => {
      (window as any).__lastRazorpayPayload = null;
      (window as any).__razorpayModalOpened = false;

      (window as any).Razorpay = function (options: any) {
        (window as any).__lastRazorpayPayload = options;
        return {
          open: () => {
            (window as any).__razorpayModalOpened = true;
          },
        };
      };
    });

    // 2. Intercept Auth, Billing and Connect API routes
    await page.route('**/api/auth/register', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'jwt-e2e-checkout-token-4999',
          merchant: {
            id: 'merchant_e2e_4999',
            name: 'Test Merchant',
            email: 'founder@brand4999.test',
            platform: 'shopify',
            onboardingStatus: 'pending',
          },
        }),
      });
    });

    await page.route('**/api/billing/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ active: false }),
      });
    });

    await page.route('**/api/connect/state', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connections: {}, ready: false }),
      });
    });

    await page.route('**/api/store/metrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ available: false }),
      });
    });

    let checkoutPayloadCaptured: any = null;
    await page.route('**/api/billing/checkout', async (route) => {
      checkoutPayloadCaptured = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          orderId: 'order_test_4999',
          amountInr: 4999 * 3, // quarterly
          currency: 'INR',
          keyId: 'rzp_test_key_123',
        }),
      });
    });

    // 3. Step 1: Landing Page Verification
    await page.goto('/');
    await expect(page.locator('body')).toContainText(/RescueShip/i);
    // Verify Starter canonical ₹4,999 pricing is on the page
    await expect(page.locator('body')).toContainText(/4,999/);

    // 4. Step 2: Register Flow
    await page.goto('/register');
    await page.locator('input[placeholder="Your full name"]').fill('Test Merchant');
    await page.locator('input[placeholder="Your email address"]').fill('founder@brand4999.test');
    await page.locator('input[placeholder="Create a strong password"]').fill('P@ssword1234!');

    // Check Terms and DPA checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.nth(0).check({ force: true });
    await checkboxes.nth(1).check({ force: true });

    const registerBtn = page.getByRole('button', { name: /Start Free Trial/i });
    await expect(registerBtn).toBeEnabled();
    await registerBtn.click();

    // 5. Step 3: Verified navigation to Billing to select plan
    await expect(page).toHaveURL(/\/billing/);
    await expect(page.locator('body')).toContainText(/Starter/i);
    await expect(page.locator('body')).toContainText(/4,999/);

    // 6. Step 4: Trigger Checkout Modal
    const payBtn = page.locator('.bl-btn-checkout');
    await expect(payBtn).toBeVisible();
    await payBtn.click();

    // Wait for checkout API intercept
    await page.waitForTimeout(500);

    // 7. Step 5: Assertions: Exact ₹4,999 payload verification
    expect(checkoutPayloadCaptured).not.toBeNull();
    expect(checkoutPayloadCaptured.tier).toBe('starter');

    const lastRzp = await page.evaluate(() => (window as any).__lastRazorpayPayload);
    expect(lastRzp).not.toBeNull();
    expect(lastRzp.key).toBe('rzp_test_key_123');
    expect(lastRzp.order_id).toBe('order_test_4999');
    expect(lastRzp.description).toContain('4,999');

    const modalOpened = await page.evaluate(() => (window as any).__razorpayModalOpened);
    expect(modalOpened).toBe(true);
  });
});
