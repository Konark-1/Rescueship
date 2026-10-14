import { test, expect } from '@playwright/test';

test.describe('PART 3.1: Full E2E Checkout Flow (plan × order band)', () => {
  test('Navigates from Landing → Register → Billing and triggers Razorpay with the plan + band payload', async ({ page }) => {
    // 1. Mock Razorpay SDK globally
    await page.addInitScript(() => {
      try { sessionStorage.setItem('rs_booted', '1'); } catch {}
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
    await page.route('**/api/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

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
          orderId: 'order_test_prevent_1000',
          amountInr: 2999 * 3 * 100, // Prevent, up to 1,000 orders, quarterly (paise)
          currency: 'INR',
          keyId: 'rzp_test_key_123',
        }),
      });
    });

    // 3. Step 1: Landing Page Verification
    await page.goto('/');
    await expect(page.locator('body')).toContainText(/RescueShip/i);
    // Pricing shows the three plans (Rescue / Convert / Prevent)
    await expect(page.locator('body')).toContainText(/Rescue/);
    await expect(page.locator('body')).toContainText(/Prevent/);

    // 4. Step 2: Register Flow
    await page.goto('/register');
    await page.locator('input[placeholder="Your full name"]').fill('Test Merchant');
    await page.locator('input[placeholder="Your email address"]').fill('founder@brand4999.test');
    await page.locator('input[placeholder="Create a strong password"]').fill('P@ssword1234!');

    // Check Terms and DPA checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.nth(0).check({ force: true });
    await checkboxes.nth(1).check({ force: true });

    const registerBtn = page.getByRole('button', { name: /Start Free Trial|Create account/i });
    await expect(registerBtn).toBeEnabled();
    await registerBtn.click();

    // 5. Step 3: New accounts go to setup first (free test rescues), then choose a plan on /billing
    await expect(page).toHaveURL(/\/onboarding/);
    await page.goto('/billing?from=onboarding');
    await expect(page).toHaveURL(/\/billing/);
    // Default 1,000 orders → Prevent is recommended at ₹2,999/mo
    await expect(page.locator('body')).toContainText(/Prevent/);
    await expect(page.locator('body')).toContainText(/2,999/);

    // 6. Step 4: Trigger Checkout Modal
    const payBtn = page.locator('.bl-btn-checkout');
    await expect(payBtn).toBeVisible();
    await payBtn.click();

    // Wait for checkout API intercept
    await page.waitForTimeout(500);

    // 7. Step 5: Assertions: plan + band + cycle payload
    expect(checkoutPayloadCaptured).not.toBeNull();
    expect(checkoutPayloadCaptured.plan).toBe('prevent');
    expect(checkoutPayloadCaptured.band).toBe(1000);
    expect(checkoutPayloadCaptured.cycle).toBe('quarterly');

    const lastRzp = await page.evaluate(() => (window as any).__lastRazorpayPayload);
    expect(lastRzp).not.toBeNull();
    expect(lastRzp.key).toBe('rzp_test_key_123');
    expect(lastRzp.order_id).toBe('order_test_prevent_1000');
    expect(lastRzp.description).toContain('Prevent');

    const modalOpened = await page.evaluate(() => (window as any).__razorpayModalOpened);
    expect(modalOpened).toBe(true);
  });
});
