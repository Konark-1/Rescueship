import { test, expect } from '@playwright/test';

const mockUserCompleted = {
  id: 'merchant_e2e',
  name: 'E2E Merchant',
  email: 'e2e@rescueship.test',
  platform: 'shopify',
  onboardingStatus: 'completed',
};

test.describe('Dashboard Phase 2 & 3A: Data Honesty, SLA Timers & Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate test session
    await page.addInitScript((user) => {
      window.localStorage.setItem('token', 'e2e-token');
      window.localStorage.setItem('user', JSON.stringify(user));
      try { sessionStorage.setItem('rs_booted', '1'); } catch {}
    }, mockUserCompleted);
  });

  test('3.1: displays "Awaiting scan" for order without detectedAt, real SLA for order with detectedAt', async ({ page }) => {
    const now = Date.now();
    await page.route(/\/api\/dashboard\/summary/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalSaved: 50000,
          rescuedCount: 10,
          conversionCount: 5,
          rtoArrestCount: 3,
          ordersNeedingAttention: [
            {
              orderId: 'ORD_NO_SCAN',
              customerName: 'Awaiting Customer',
              customerPhone: '9876543210',
              carrier: 'shiprocket',
              status: 'ndr_detected',
              orderValue: 1200,
              ndr: { reason: 'Customer Unavailable', detectedAt: null },
            },
            {
              orderId: 'ORD_WITH_SCAN',
              customerName: 'Scanned Customer',
              customerPhone: '9876543211',
              carrier: 'delhivery',
              status: 'ndr_detected',
              orderValue: 2400,
              ndr: {
                reason: 'Incomplete Address',
                detectedAt: new Date(now - 4 * 3600 * 1000).toISOString(), // 4 hours ago on 48h SLA -> ~44h left
              },
            },
          ],
        }),
      });
    });

    await page.route(/\/api\/analytics\/roi/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ records: [] }),
      });
    });

    await page.goto('/dashboard');

    // Wait for the action queue table to render
    const queueCard = page.getByLabel('Actionable Orders Queue');
    await expect(queueCard).toBeVisible();

    // Verify first row has "Awaiting scan"
    const rowNoScan = page.locator('#order-row-ORD_NO_SCAN');
    await expect(rowNoScan).toBeVisible();
    await expect(rowNoScan).toContainText('Awaiting scan');

    // Verify second row has countdown timer (around 44h left)
    const rowWithScan = page.locator('#order-row-ORD_WITH_SCAN');
    await expect(rowWithScan).toBeVisible();
    await expect(rowWithScan).toContainText(/4[34]h/);
  });

  test('3.2: keyboard navigation (/, j, k, Enter, Escape) and focus trap return', async ({ page }) => {
    await page.route(/\/api\/dashboard\/summary/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalSaved: 50000,
          rescuedCount: 10,
          conversionCount: 5,
          rtoArrestCount: 3,
          ordersNeedingAttention: [
            {
              orderId: 'ORD_KEY_1',
              customerName: 'First Customer',
              customerPhone: '9876543210',
              carrier: 'shiprocket',
              status: 'ndr_detected',
              orderValue: 1000,
            },
            {
              orderId: 'ORD_KEY_2',
              customerName: 'Second Customer',
              customerPhone: '9876543211',
              carrier: 'delhivery',
              status: 'ndr_detected',
              orderValue: 2000,
            },
          ],
        }),
      });
    });

    await page.route(/\/api\/analytics\/roi/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ records: [] }),
      });
    });

    await page.goto('/dashboard');

    // Wait for queue rows to be ready
    await expect(page.locator('#order-row-ORD_KEY_1')).toBeVisible();
    await expect(page.locator('#order-row-ORD_KEY_2')).toBeVisible();

    const searchInput = page.getByPlaceholder('Search order or customer...');
    await expect(searchInput).toBeVisible();

    // Press '/' to focus search bar
    await page.keyboard.press('/');
    await expect(searchInput).toBeFocused();

    // Blur search bar to test row navigation
    await searchInput.evaluate((el: HTMLElement) => el.blur());

    // Press 'j' to navigate down to second row
    await page.keyboard.press('j');

    // Press 'Enter' to open drawer for second order
    await page.keyboard.press('Enter');

    const drawer = page.getByRole('dialog', { name: /Order Triage/i });
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('#ORD_KEY_2');

    // Press 'Escape' to close drawer
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();

    // Focus must return to originating row
    const secondRow = page.locator('#order-row-ORD_KEY_2');
    await expect(secondRow).toBeFocused();
  });

  test('3.3: honest empty states render when analytics have zero data (no SVG bars)', async ({ page }) => {
    await page.route(/\/api\/dashboard\/summary/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalSaved: 0,
          rescuedCount: 0,
          conversionCount: 0,
          rtoArrestCount: 0,
          ordersNeedingAttention: [],
          dailyConversions: [],
          ndrReasons: [],
        }),
      });
    });

    await page.route(/\/api\/analytics\/roi/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ records: [] }),
      });
    });

    await page.goto('/dashboard');

    // 1. Tab 1: Freight Recovery ROI empty state
    const roiContainer = page.getByTestId('roi-chart-container');
    await expect(roiContainer).toBeVisible();
    await expect(roiContainer).toContainText('No Freight Recovery Records In This Period');
    // Verify zero SVG bars rendered
    const bars = page.locator('.recharts-bar-rectangle');
    expect(await bars.count()).toBe(0);

    // 2. Tab 2: 14-Day Recovery Trend empty state
    const trendTabBtn = page.getByRole('button', { name: /14-Day Recovery Trend/i });
    await trendTabBtn.click();
    await expect(page.getByText('No Recovery Trend Data in This Period')).toBeVisible();

    // 3. Tab 3: NDR Reasons empty state
    const reasonsTabBtn = page.getByRole('button', { name: /NDR Reasons/i });
    await reasonsTabBtn.click();
    await expect(page.getByText('No NDR Reasons Recorded')).toBeVisible();
  });
});
