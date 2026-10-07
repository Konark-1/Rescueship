import { test, expect } from '@playwright/test';

const mockUserCompleted = {
  id: 'merchant_e2e',
  name: 'E2E Merchant',
  email: 'e2e@rescueship.test',
  platform: 'shopify',
  onboardingStatus: 'completed',
};

test.describe('TASK 3.3: Recharts High-Volume Aggregation & Performance', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate test session
    await page.addInitScript((user) => {
      window.localStorage.setItem('token', 'e2e-token');
      window.localStorage.setItem('user', JSON.stringify(user));
      try { sessionStorage.setItem('rs_booted', '1'); } catch {}
    }, mockUserCompleted);

    // Mock summary stats
    await page.route('**/api/dashboard/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalSaved: 1400000,
          rescuedCount: 850,
          conversionCount: 420,
          rtoArrestCount: 190,
          ordersNeedingAttention: [],
        }),
      });
    });
  });

  test('3.3.1: aggregates 10,000 records seamlessly in Recharts BarChart without memory crashes or errors', async ({ page }) => {
    // 1. Mock massive dataset (10,000 records) for ROI dashboard API endpoint
    // 10,000 records * ₹140 amount each = ₹14,00,000 total mathematically calculated sum
    const highVolumeRecords = Array.from({ length: 10000 }, (_, i) => ({
      id: `roi_rec_${i}`,
      orderId: `ORD_AGG_${i + 1}`,
      amount: 140,
      timestamp: new Date().toISOString(),
      status: 'rescued',
    }));

    await page.route('**/api/analytics/roi', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          records: highVolumeRecords,
          totalCount: 10000,
          totalSum: 1400000,
        }),
      });
    });

    // Capture console errors and page crashes
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // 2. Navigate to Dashboard
    await page.goto('/dashboard');

    // 3. Assert that Recharts ResponsiveContainer and BarChart render cleanly
    const chartContainer = page.getByTestId('roi-chart-container');
    await expect(chartContainer).toBeVisible();

    const responsiveContainer = page.locator('.recharts-responsive-container');
    await expect(responsiveContainer).toBeVisible();

    const barChart = page.locator('.recharts-surface');
    await expect(barChart).toBeVisible();

    // Verify zero memory or unhandled exceptions occurred
    expect(pageErrors.length).toBe(0);

    // 4. Assert Bars render and hover tooltip correctly computes aggregate values
    const bars = page.locator('.recharts-bar-rectangle');
    await expect(bars.first()).toBeVisible();

    // Hover over bar to trigger tooltip
    await bars.first().hover();

    // Verify tooltip shows mathematically aggregated value without clipping
    const tooltip = page.locator('.recharts-default-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('saved');
    // Sum across 4 aggregated buckets: 14,00,000 / 4 = 3,50,000 each
    await expect(tooltip).toContainText('3,50,000');
  });
});
