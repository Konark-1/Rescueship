import { test, expect } from '@playwright/test';

const mockUserCompleted = {
  id: 'merchant_e2e',
  name: 'E2E Merchant',
  email: 'e2e@rescueship.test',
  platform: 'shopify',
  onboardingStatus: 'completed',
};

test.describe('Negative Flows: Fake Remark Interception', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate test session
    await page.addInitScript((user) => {
      window.localStorage.setItem('token', 'e2e-token');
      window.localStorage.setItem('user', JSON.stringify(user));
      try { sessionStorage.setItem('rs_booted', '1'); } catch {}
    }, mockUserCompleted);

    // Mock dashboard metrics endpoints
    await page.route('**/api/dashboard/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalSaved: 420000,
          rescuedCount: 38,
          conversionCount: 19,
          rtoArrestCount: 12,
          ordersNeedingAttention: [],
        }),
      });
    });

    await page.route('**/api/analytics/roi', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ records: [] }),
      });
    });
  });

  test('TASK 3.2: should intercept fake remark NDR in sandbox and disable customer quick-replies while exposing dispute verification', async ({ page }) => {
    // 1. Intercept & Mock: Use page.route('**/api/sandbox/simulate-ndr', ...) to intercept the sandbox NDR trigger.
    // Force the mock response to include fakeRemarkScore: 0.85 and category: 'FAKE_REMARK'.
    await page.route('**/api/sandbox/simulate-ndr', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          awb: 'AWB-FAKE-9988',
          reason: 'Customer not available (Fraudulent claim)',
          fakeRemarkScore: 0.85,
          category: 'FAKE_REMARK',
        }),
      });
    });

    await page.goto('/dashboard');

    // 2. Trigger UI: Click the "Simulate NDR" button in the dashboard to render the WhatsApp chat bubble.
    const simBtn = page.getByTestId('btn-simulate-ndr');
    await expect(simBtn).toBeVisible();
    await simBtn.click();

    // Verify WhatsApp simulator chat bubble is rendered
    await expect(page.getByTestId('whatsapp-chat-bubble')).toBeVisible();

    // 3. Assert Disabled States: Verify that the standard customer quick-reply buttons are disabled
    await expect(page.getByTestId('btn-reschedule')).toBeDisabled();
    await expect(page.getByTestId('btn-home-now')).toBeDisabled();

    // 4. Assert Warning Banner: Verify that a new UI element is visible
    await expect(page.getByTestId('fake-remark-warning')).toBeVisible();
    await expect(page.getByTestId('fake-remark-warning')).toContainText('Suspicious Courier Attempt');

    // 5. Assert Action Button: Verify that the merchant-facing "Verify Fake Remark" button is enabled and clickable
    const verifyBtn = page.getByTestId('btn-verify-fake-remark');
    await expect(verifyBtn).toBeVisible();
    await expect(verifyBtn).toBeEnabled();
    await verifyBtn.click();
    await expect(verifyBtn).toContainText('Dispute Verified');
  });
});
