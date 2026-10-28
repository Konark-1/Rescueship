import { test, expect } from '@playwright/test';
import path from 'path';

const mockUserCompleted = {
  id: 'merchant_e2e',
  name: 'Apex Goods Store',
  email: 'merchant@apexgoods.com',
  platform: 'shopify',
  onboardingStatus: 'completed',
};

const mockOrders = [
  // 3 Escalations
  {
    id: 'ord_1001',
    orderId: '1001',
    externalOrderId: '1001',
    customerName: 'Aarav Sharma',
    customerPhone: '+919876543210',
    orderValue: 2499,
    carrier: 'Delhivery',
    platform: 'shopify',
    status: 'ndr_pending_review',
    ndr: {
      reason: 'Customer Unavailable / Door Locked',
      fakeRemarkScore: 0.92,
      isFakeAttempt: true,
      detectedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    rtoRisk: { level: 'HIGH', score: 88 },
    shippingAddress: '402, Lotus Heights, Bandra West, Mumbai 400050',
    aiAddress: {
      original: '402 Lotus Hgts nr bandra stn',
      parsed: 'Flat 402, Lotus Heights, Station Road, Bandra West, Mumbai 400050',
      confidence: 0.96,
    },
  },
  {
    id: 'ord_1002',
    orderId: '1002',
    externalOrderId: '1002',
    customerName: 'Priya Patel',
    customerPhone: '+919876543211',
    orderValue: 1850,
    carrier: 'Blue Dart',
    platform: 'shopify',
    status: 'action_required',
    ndr: {
      reason: 'Address Incomplete / Landmark Missing',
      fakeRemarkScore: 0.84,
      isFakeAttempt: false,
      detectedAt: new Date(Date.now() - 7200000).toISOString(),
    },
    rtoRisk: { level: 'HIGH', score: 82 },
    shippingAddress: 'House 12, Behind Hanuman Temple, Ahmedabad 380001',
    aiAddress: {
      original: 'H 12 behnd mandir',
      parsed: 'House No. 12, Behind Hanuman Mandir, Old City, Ahmedabad 380001',
      confidence: 0.94,
    },
  },
  {
    id: 'ord_1003',
    orderId: '1003',
    externalOrderId: '1003',
    customerName: 'Vikram Malhotra',
    customerPhone: '+919876543212',
    orderValue: 3200,
    carrier: 'Delhivery',
    platform: 'shopify',
    status: 'ndr_pending_review',
    ndr: {
      reason: 'Fake Remark Intercepted',
      fakeRemarkScore: 0.95,
      isFakeAttempt: true,
      detectedAt: new Date(Date.now() - 5400000).toISOString(),
    },
    rtoRisk: { level: 'HIGH', score: 91 },
    shippingAddress: 'Plot 45, Sector 18, Gurugram 122001',
  },
  // Auto-Recovering orders (12 orders)
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `ord_rec_${i + 4}`,
    orderId: `${1004 + i}`,
    externalOrderId: `${1004 + i}`,
    customerName: `Customer ${i + 4}`,
    customerPhone: `+9198765432${20 + i}`,
    orderValue: 1200 + i * 150,
    carrier: i % 2 === 0 ? 'Delhivery' : 'Shiprocket',
    platform: 'shopify',
    status: 'ndr_rescue_sent',
    ndr: {
      reason: i % 3 === 0 ? 'Customer Unavailable' : 'Delivery Rescheduled by Customer',
      fakeRemarkScore: 0.15,
      isFakeAttempt: false,
      detectedAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
    },
    rtoRisk: { level: 'MEDIUM', score: 45 },
  })),
  // Auto-Resolved orders (5 orders)
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `ord_res_${i + 16}`,
    orderId: `${1016 + i}`,
    externalOrderId: `${1016 + i}`,
    customerName: `Resolved Customer ${i + 1}`,
    customerPhone: `+9198765432${50 + i}`,
    orderValue: 1650 + i * 200,
    carrier: 'Delhivery',
    platform: 'shopify',
    status: 'ndr_rescued',
    ndr: {
      reason: 'Delivered / Rescued',
      fakeRemarkScore: 0.10,
      isFakeAttempt: false,
      customerResponse: 'tomorrow_morning',
      resolvedAt: new Date(Date.now() - 1800000).toISOString(),
    },
    rtoRisk: { level: 'LOW', score: 18 },
  })),
];

test('Verify Dashboard Harmony, Triage Bucketing, and OrderDrawer', async ({ page }) => {
  page.on('console', (msg) => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message, err.stack));

  // Set auth tokens in localStorage before navigation
  await page.addInitScript((mockUser) => {
    window.localStorage.setItem('token', 'mock_jwt_test_token_for_playwright');
    window.localStorage.setItem('user', JSON.stringify(mockUser));
    try { sessionStorage.setItem('rs_booted', '1'); } catch {}
  }, mockUserCompleted);

  // Mock all API endpoints
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());

    
    if (url.pathname === '/api/dashboard/summary') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalSaved: 40721,
          rescuedCount: 14,
          conversionCount: 14,
          rtoArrestCount: 14,
          ordersNeedingAttention: mockOrders,
          metaTier: {
            metaTierLimit: 1000,
            current24hCount: 84,
            isLimitReached: false,
          },
        }),
      });
    }
    if (url.pathname === '/api/billing/status') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ active: true, plan: 'growth', status: 'active' }),
      });
    }

    if (url.pathname === '/api/store/sync-status') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          syncInProgress: false,
          ordersProcessed: 1284,
          lastSyncAt: new Date().toISOString(),
        }),
      });
    }

    if (url.pathname === '/api/analytics/dashboard') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalOrders: 1284,
          totalSaved: 40721,
          revenueSaved: 40721,
          rtoArrestCount: 14,
          rescuedOrders: 14,
          activeNdrCases: 20,
          metaTier: {
            metaTierLimit: 1000,
            current24hCount: 84,
            isLimitReached: false,
          },
          dailyConversions: [
            { date: '2026-10-22', conversions: 3, rto: 1 },
            { date: '2026-10-23', conversions: 4, rto: 0 },
            { date: '2026-10-24', conversions: 2, rto: 1 },
            { date: '2026-10-25', conversions: 5, rto: 0 },
            { date: '2026-10-26', conversions: 3, rto: 1 },
            { date: '2026-10-27', conversions: 4, rto: 0 },
            { date: '2026-10-28', conversions: 6, rto: 1 },
          ],
          ndrReasons: [
            { reason: 'Customer Unavailable', count: 9 },
            { reason: 'Address Incomplete', count: 5 },
            { reason: 'Door Locked', count: 4 },
            { reason: 'Cash Not Ready', count: 2 },
          ],
        }),
      });
    }

    if (url.pathname === '/api/analytics/roi') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          netSavings: 40721,
          freightSavings: 8738,
          gmvMarginSavings: 31983,
          rescuedOrders: 14,
          retainedGmv: 29726,
          whatsappHsmCosts: 580,
          platformRoiMultiple: '46.8x',
        }),
      });
    }

    if (url.pathname === '/api/orders') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orders: mockOrders,
          total: mockOrders.length,
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  // Set viewport to large desktop to see all Bento tiles cleanly
  await page.setViewportSize({ width: 1440, height: 1200 });

  // Navigate to dashboard
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  const artifactDir = 'C:\\Users\\Konark Parihar\\.gemini\\antigravity\\brain\\fe47d14e-feb8-4b77-b896-8392289b7b8b';

  // Verify the top badge displays "3 Escalations" (NOT 20 Action Needed!)
  const escalationBadge = page.locator('button:has-text("3 Escalations")');
  await expect(escalationBadge).toBeVisible();

  // 1. Capture Bento Dashboard full overview in INR
  const bentoGrid = page.locator('.fpb');
  await expect(bentoGrid).toBeVisible();

  // Mathematical & Forensic Redundancy Assertions (Zero fake data)
  await expect(page.locator('#alloc')).toContainText('85%');
  await expect(page.locator('#alloc')).toContainText('₹29,726');
  await expect(page.locator('#alloc')).toContainText('₹4,072');
  await expect(page.locator('#alloc')).toContainText('₹6,923');

  await expect(page.locator('#ret')).toContainText('60.0%');
  await expect(page.locator('#ret')).toContainText('12 / 20 Auto');

  await expect(page.locator('#cash')).toContainText('Averted Reverse Freight');
  await expect(page.locator('#cash')).toContainText('₹8,820');
  await expect(page.locator('#cash')).toContainText('+₹6,450');

  await expect(page.locator('#flow')).toContainText('RTO Loss Ratio: 17.0%');

  await expect(page.locator('#crypto')).toContainText('4 Carriers');
  await expect(page.locator('#crypto')).toContainText('70% Fleet Rescue');

  await bentoGrid.screenshot({
    path: path.join(artifactDir, 'bento_harmonized_inr.png'),
  });

  // 2. Scroll to and capture ActionQueue with new Triage Tabs & Bulk Approve
  const queue = page.locator('#urgent-ndr-queue');
  await queue.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  // Assert Triage Tabs are visible with correct counts: All (20), Escalations (3), Auto-Recovering (12), Auto-Resolved (5)
  await expect(page.locator('button:has-text("All (20)")')).toBeVisible();
  await expect(page.locator('button:has-text("Escalations (3)")')).toBeVisible();
  await expect(page.locator('button:has-text("Auto-Recovering (12)")')).toBeVisible();
  await expect(page.locator('button:has-text("Auto-Resolved (5)")')).toBeVisible();

  await page.screenshot({
    path: path.join(artifactDir, 'action_queue_triage_tabs.png'),
    fullPage: false,
  });

  // 3. Test Bulk Approve click
  const bulkBtn = page.locator('button:has-text("Bulk Approve AI (3)")');
  await expect(bulkBtn).toBeVisible();
  await bulkBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(artifactDir, 'action_queue_bulk_approved.png'),
    fullPage: false,
  });

  // 4. Click first order row (#1001) to open OrderDrawer
  const firstRow = page.locator('#order-row-ord_1001');
  await expect(firstRow).toBeVisible();
  await firstRow.click();
  await page.waitForTimeout(600);

  // Assert Shopify Admin deep-link and Gemini AI Auto-Pushed badge are visible in the drawer
  await expect(page.locator('a:has-text("Shopify Admin #1001")')).toBeVisible();
  await expect(page.locator('text=Auto-Pushed by Gemini AI')).toBeVisible();

  await page.screenshot({
    path: path.join(artifactDir, 'order_drawer_shopify_gemini.png'),
    fullPage: false,
  });

  // 5. Close drawer, scroll back up and toggle currency to USD
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator('h1').scrollIntoViewIfNeeded();

  const usdBtn = page.locator('button:has-text("$ USD")');
  await expect(usdBtn).toBeVisible();
  await usdBtn.click();
  await page.waitForTimeout(500);

  await bentoGrid.screenshot({
    path: path.join(artifactDir, 'bento_harmonized_usd.png'),
  });
});
