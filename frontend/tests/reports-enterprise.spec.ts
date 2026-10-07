import { test, expect } from '@playwright/test';

const mockUserCompleted = {
  id: 'merchant_e2e',
  name: 'E2E Merchant',
  email: 'e2e@rescueship.test',
  platform: 'shopify',
  onboardingStatus: 'completed',
};

const mockFraudData = {
  carriers: [
    {
      carrier: 'Shadowfax',
      totalOrders: 300,
      totalNDR: 120,
      fakeAttempts: 36,
      fakeAttemptRate: 30.0,
      disputedFreightValue: 5040,
      legitimateNDR: 84,
      avgFakeScore: 82,
    },
    {
      carrier: 'Delhivery',
      totalOrders: 500,
      totalNDR: 250,
      fakeAttempts: 15,
      fakeAttemptRate: 6.0,
      disputedFreightValue: 2100,
      legitimateNDR: 235,
      avgFakeScore: 40,
    },
    {
      carrier: 'BlueDart',
      totalOrders: 150,
      totalNDR: 80,
      fakeAttempts: 2,
      fakeAttemptRate: 2.5,
      disputedFreightValue: 280,
      legitimateNDR: 78,
      avgFakeScore: 25,
    },
  ],
  totalOrders: 950,
  totalNDR: 450,
  totalFakeAttempts: 53,
  overallFakeRate: 11.8,
  totalDisputedFreight: 7420,
  flaggedCarriersCount: 1,
  period: {
    startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
    endDate: new Date().toISOString(),
  },
};

const mockFunnelData = {
  stages: [
    {
      stage: 'ndr_triggered',
      label: 'NDR Triggered',
      count: 450,
      conversionRateFromPrevious: 100,
      conversionRateFromStart: 100,
      dropOffCount: 0,
    },
    {
      stage: 'whatsapp_sent',
      label: 'WhatsApp Sent',
      count: 432,
      conversionRateFromPrevious: 96.0,
      conversionRateFromStart: 96.0,
      dropOffCount: 18,
    },
    {
      stage: 'customer_replied',
      label: 'Customer Replied',
      count: 310,
      conversionRateFromPrevious: 71.8,
      conversionRateFromStart: 68.9,
      dropOffCount: 122,
    },
    {
      stage: 'rescued',
      label: 'Delivery Rescued',
      count: 228,
      conversionRateFromPrevious: 73.5,
      conversionRateFromStart: 50.7,
      dropOffCount: 82,
    },
  ],
  ndrTriggered: 450,
  whatsappSent: 432,
  customerReplied: 310,
  rescued: 228,
  overallRescueRate: 50.7,
  aiTelemetry: {
    parserSuccessRate: 95.8,
    sampleBefore: 'peeli kothi ke peeche ram lal dukan ke paas sec 12 noida call on arrival',
    sampleAfter: 'H-12, Near Peeli Kothi, Opp. Ram Lal Store, Sector 12, Noida 201301. Note: Call on arrival',
    addressesParsedCount: 310,
  },
  period: {
    startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
    endDate: new Date().toISOString(),
  },
};

test.describe('PHASE 3: Carrier Fraud Watchtower & AI Rescue Funnel', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate test session
    await page.addInitScript((user) => {
      window.localStorage.setItem('token', 'e2e-token');
      window.localStorage.setItem('user', JSON.stringify(user));
      try { sessionStorage.setItem('rs_booted', '1'); } catch {}
    }, mockUserCompleted);

    // Mock Fraud Index Endpoint
    await page.route('**/api/analytics/fraud-index', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockFraudData),
      });
    });

    // Mock Dispute CSV Export Endpoint
    await page.route('**/api/analytics/fraud-disputes/export**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/csv',
        headers: {
          'Content-Disposition': 'attachment; filename="rescueship-fake-attempt-disputes.csv"',
        },
        body: 'AWB,Carrier,Order ID,Customer Name,Phone,Courier Remark,Fake Attempt Score (%),Customer Reply Timestamp,Customer Stated Reason,Disputed Freight Amount (INR),Evidence Summary\nAWB123,Shadowfax,ORD-101,Rahul,9999999991,Customer Refused,88,2026-10-01T12:00:00Z,Never called,140,High suspicion',
      });
    });

    // Mock Funnel Endpoint
    await page.route('**/api/analytics/funnel', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockFunnelData),
      });
    });

    // Navigate to Reports Page
    await page.goto('/reports');
  });

  test('3.1 & 3.2: Carrier Fraud Watchtower tab renders leaderboard and dispute CSV export triggers correctly', async ({ page }) => {
    // 1. Locate and click Carrier Fraud Watchtower tab
    const fraudTab = page.getByRole('button', { name: /Carrier Fraud Watchtower/i });
    await expect(fraudTab).toBeVisible();
    await fraudTab.click();

    // 2. Assert Fraud Watchtower UI headers and KPIs
    await expect(page.locator('body')).toContainText(/Carrier Fraud Watchtower/i);
    await expect(page.locator('body')).toContainText(/Disputed Freight Value/i);
    await expect(page.locator('body')).toContainText(/Overall Fake Rate/i);

    // 3. Assert Leaderboard Table rows
    await expect(page.locator('body')).toContainText('Shadowfax');
    await expect(page.locator('body')).toContainText('Delhivery');
    await expect(page.locator('body')).toContainText('BlueDart');

    // 4. Assert Shadowfax is flagged with high fake rate (>10% badge)
    await expect(page.locator('body')).toContainText('30.0% High');

    // 5. Test Export Dispute CSV button
    const exportBtn = page.getByRole('button', { name: /Export Dispute CSV/i });
    await expect(exportBtn).toBeVisible();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('3.3: AI Rescue Funnel tab renders funnel metrics and Gemini AI Telemetry widget', async ({ page }) => {
    // 1. Locate and click AI Rescue Funnel tab
    const funnelTab = page.getByRole('button', { name: /AI Rescue Funnel/i });
    await expect(funnelTab).toBeVisible();
    await funnelTab.click();

    // 2. Assert Funnel Chart headers and stages
    await expect(page.locator('body')).toContainText(/NDR Recovery Conversion Funnel/i);
    await expect(page.locator('body')).toContainText(/NDR Triggered/i);
    await expect(page.locator('body')).toContainText(/WhatsApp Sent/i);
    await expect(page.locator('body')).toContainText(/Customer Replied/i);
    await expect(page.locator('body')).toContainText(/Delivery Rescued/i);

    // 3. Assert Gemini AI Telemetry Widget
    await expect(page.locator('body')).toContainText(/Gemini AI Telemetry/i);
    await expect(page.locator('body')).toContainText(/AI Parser Success Rate/i);
    await expect(page.locator('body')).toContainText(/95.8%/i);
    await expect(page.locator('body')).toContainText(/peeli kothi ke peeche/i);
    await expect(page.locator('body')).toContainText(/H-12, Near Peeli Kothi/i);
    await expect(page.locator('body')).toContainText(/Gemini 3.8 Flash/i);
  });

  test('4.1: TopRiskPincodes renders Storefront Actions column and handles optimistic toggles with API sync', async ({ page }) => {
    // 1. Mock high-risk pincodes endpoint
    await page.route('**/api/analytics/high-risk-pincodes**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              pincode: '110001',
              city: 'New Delhi',
              state: 'Delhi',
              totalOrders: 120,
              deliveredOrders: 58,
              failedOrders: 62,
              courierReported: 40,
              customerCancelled: 22,
              fakeAttempts: 18,
              avgAttempts: 2.1,
              rtoRate: 51.7,
              riskScore: 88,
              riskLevel: 'CRITICAL',
              recommendedAction: 'Restrict to Prepaid or Advance Deposit',
              failureReasons: ['Fake Attempt', 'Customer Unreachable'],
            },
          ],
        }),
      });
    });

    let putPayload: any = null;
    await page.route('**/api/settings/pincode-rules', async (route) => {
      if (route.request().method() === 'PUT') {
        putPayload = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            pincode: putPayload?.pincode,
            rules: putPayload?.rules,
            syncStatus: 'synced',
            message: 'Pincode rule updated and synced',
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          rules: [],
        }),
      });
    });

    // 2. Navigate / re-render Reports Page default tab (Top Risk Pincodes)
    await page.goto('/reports');

    // 3. Assert Table Header has Storefront Actions
    await expect(page.locator('body')).toContainText(/Top 5 High-Risk Pincodes/i);
    await expect(page.locator('body')).toContainText(/Storefront Actions/i);
    await expect(page.locator('body')).toContainText('110001');

    // 4. Locate switches for Force Prepaid Only and Mandate Advance
    const prepaidSwitch = page.getByRole('switch', { name: /Force Prepaid Only for 110001/i });
    const advanceSwitch = page.getByRole('switch', { name: /Mandate ₹50 Advance for 110001/i });

    await expect(prepaidSwitch).toBeVisible();
    await expect(advanceSwitch).toBeVisible();
    expect(await prepaidSwitch.getAttribute('aria-checked')).toBe('false');

    // 5. Toggle Force Prepaid Only switch
    await prepaidSwitch.click();

    // Verify optimistic UI update immediately
    expect(await prepaidSwitch.getAttribute('aria-checked')).toBe('true');

    // Verify PUT request was dispatched with correct payload
    expect(putPayload).toEqual({
      pincode: '110001',
      rules: {
        forcePrepaid: true,
        mandateAdvance: false,
        advanceAmount: 50,
      },
    });

    // Verify status indicator and toast appear
    await expect(page.locator('body')).toContainText(/Storefront Synced/i);
  });
});
