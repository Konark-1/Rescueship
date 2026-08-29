import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const mockUserCompleted = {
  id: 'merchant_e2e',
  name: 'E2E Merchant',
  email: 'e2e@rescueship.test',
  platform: 'shopify',
  onboardingStatus: 'completed',
};

const mockUserPending = {
  ...mockUserCompleted,
  onboardingStatus: 'pending',
};

function json(data: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  };
}

async function installBrowserStubs(page: Page) {
  await page.addInitScript(() => {
    class MockEventSource extends EventTarget {
      url: string;
      readyState = 1;
      onopen: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;

      constructor(url: string) {
        super();
        this.url = url;

        setTimeout(() => {
          const event = new Event('open');
          this.dispatchEvent(event);
          this.onopen?.(event);
        }, 10);
      }

      close() {
        this.readyState = 2;
      }
    }

    Object.defineProperty(window, 'EventSource', {
      value: MockEventSource,
      writable: true,
    });

    Object.defineProperty(window, 'FB', {
      value: {
        init: () => {},
        login: (cb: Function) => {
          cb({
            authResponse: {
              code: 'mock_meta_code',
              business_id: 'mock_business_id',
            },
          });
        },
      },
      writable: true,
    });

    Object.defineProperty(window, 'fbAsyncInit', {
      value: () => {},
      writable: true,
    });

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {},
      },
      writable: true,
    });
  });
}

async function mockBackend(page: Page) {
  let sandboxEnabled = false;
  let sandboxSucceeded = 0;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    /**
     * Auth
     */
    if (path === '/api/auth/login' && method === 'POST') {
      return route.fulfill(
        json({
          token: 'e2e-token',
          merchant: mockUserCompleted,
        }),
      );
    }

    if (path === '/api/auth/register' && method === 'POST') {
      return route.fulfill(
        json({
          token: 'e2e-token',
          merchant: mockUserPending,
        }),
      );
    }

    if (path === '/api/auth/google' && method === 'POST') {
      return route.fulfill(
        json({
          token: 'e2e-token',
          merchant: mockUserCompleted,
        }),
      );
    }

    /**
     * Dashboard
     */
    if (path === '/api/analytics/dashboard') {
      return route.fulfill(
        json({
          totalOrders: 1284,
          codToPrepaid: {
            count: 214,
            conversionRate: 16.7,
          },
          ndrRescues: {
            count: 92,
            rescueRate: 41.2,
          },
          revenueSaved: 184500,
          activeNdrCases: 17,
          creditsRemaining: 83,
          dailyConversions: [
            { date: 'Mon', conversions: 12 },
            { date: 'Tue', conversions: 18 },
            { date: 'Wed', conversions: 15 },
          ],
          ndrReasons: [
            { reason: 'Customer unavailable', count: 44 },
            { reason: 'Door locked', count: 31 },
          ],
          carrierPerformance: [
            { carrier: 'Shiprocket', rescued: 52, failed: 12 },
            { carrier: 'Delhivery', rescued: 40, failed: 9 },
          ],
          recentOrders: [
            {
              id: '#1001',
              customer: 'Aarav Sharma',
              status: 'rescued',
              amount: 1240,
              date: 'Today',
            },
            {
              id: '#1002',
              customer: 'Priya Patel',
              status: 'pending',
              amount: 890,
              date: 'Yesterday',
            },
          ],
        }),
      );
    }

    /**
     * Orders
     */
    if (path === '/api/orders') {
      return route.fulfill(
        json({
          orders: [
            {
              id: 'ord_1001',
              orderId: '#1001',
              customerName: 'Aarav Sharma',
              phone: '+919999999991',
              status: 'rescued',
              carrier: 'Shiprocket',
              timeline: [
                { event: 'Order created', date: '2026-08-29T10:00:00Z' },
                { event: 'NDR detected', date: '2026-08-29T12:00:00Z' },
                { event: 'WhatsApp rescue sent', date: '2026-08-29T12:02:00Z' },
              ],
            },
            {
              id: 'ord_1002',
              orderId: '#1002',
              customerName: 'Priya Patel',
              phone: '+919999999992',
              status: 'pending',
              carrier: 'Delhivery',
              timeline: [{ event: 'Order created', date: '2026-08-28T10:00:00Z' }],
            },
          ],
        }),
      );
    }

    /**
     * Settings
     */
    if (path === '/api/settings' && method === 'GET') {
      return route.fulfill(
        json({
          platformUrl: 'rescueship-demo.myshopify.com',
          platformApiKey: 'shpat_mock',
          carrierName: 'Shiprocket',
          carrierApiKey: 'carrier_mock',
          whatsappToken: 'wa_mock',
          paymentGatewayKey: 'rzp_mock',
          enableNotifications: true,
          enableAutoFulfillment: false,
        }),
      );
    }

    if (path === '/api/settings' && method === 'PUT') {
      return route.fulfill(
        json({
          ok: true,
          message: 'Settings saved successfully!',
        }),
      );
    }

    /**
     * Onboarding connect API
     */
    if (path === '/api/connect/state') {
      return route.fulfill(
        json({
          paid: false,
          ownerPhone: '+919999999999',
          connections: {
            shopify: {
              status: 'disconnected',
              shopDomain: null,
            },
            whatsapp: {
              status: 'disconnected',
            },
            carrier: {
              status: 'disconnected',
              provider: null,
            },
            payment: {
              status: 'disconnected',
              gateway: null,
            },
          },
          templates: [],
        }),
      );
    }

    if (path === '/api/connect/shopify/url') {
      return route.fulfill(
        json({
          url: 'http://localhost:5173/onboarding?connected=shopify',
        }),
      );
    }

    if (path === '/api/connect/whatsapp/signup') {
      return route.fulfill(json({ ok: true }));
    }

    if (path === '/api/connect/whatsapp/templates/status') {
      return route.fulfill(
        json({
          status: 'connected',
          templates: [
            {
              name: 'ndr_rescue_en',
              status: 'APPROVED',
            },
          ],
        }),
      );
    }

    if (path === '/api/connect/whatsapp/test-pulse') {
      return route.fulfill(json({ ok: true }));
    }

    if (path === '/api/connect/carrier') {
      return route.fulfill(json({ ok: true }));
    }

    if (path === '/api/connect/payment') {
      return route.fulfill(json({ ok: true }));
    }

    if (path === '/api/connect/owner-phone') {
      return route.fulfill(json({ ok: true }));
    }

    if (path === '/api/connect/finalize') {
      return route.fulfill(json({ ok: true }));
    }

    /**
     * Billing
     */
    if (path === '/api/billing/status') {
      return route.fulfill(
        json({
          active: false,
        }),
      );
    }

    if (path === '/api/billing/checkout') {
      return route.fulfill(
        json({
          keyId: 'rzp_test_mock',
          subscriptionId: 'sub_mock',
          orderId: 'order_mock',
          amountInr: 99900,
          currency: 'INR',
        }),
      );
    }

    if (path === '/api/billing/checkout/verify') {
      return route.fulfill(
        json({
          active: true,
          plan: 'Growth',
          cycle: 'Annual',
          limit: 10000,
          renewMonthly: 4999,
          nextInvoice: new Date(Date.now() + 30 * 86400000).toISOString(),
          activatedAt: new Date().toISOString(),
        }),
      );
    }

    /**
     * Sandbox
     */
    if (path === '/api/sandbox/status') {
      return route.fulfill(
        json({
          enabled: sandboxEnabled,
          testRescuesSent: sandboxSucceeded,
          testRescuesSucceeded: sandboxSucceeded,
          graduationThreshold: 3,
          graduated: false,
        }),
      );
    }

    if (path === '/api/sandbox/toggle') {
      sandboxEnabled = !sandboxEnabled;

      return route.fulfill(
        json({
          enabled: sandboxEnabled,
          testRescuesSent: sandboxSucceeded,
          testRescuesSucceeded: sandboxSucceeded,
          graduationThreshold: 3,
          graduated: false,
        }),
      );
    }

    if (path === '/api/sandbox/simulate-ndr') {
      sandboxSucceeded += 1;

      return route.fulfill(
        json({
          ok: true,
          testRescuesSent: sandboxSucceeded,
          testRescuesSucceeded: sandboxSucceeded,
        }),
      );
    }

    if (path === '/api/sandbox/graduate') {
      return route.fulfill(
        json({
          graduated: true,
          enabled: false,
        }),
      );
    }

    if (path === '/api/sandbox/alerts') {
      return route.fulfill(
        json([
          {
            id: 'alert_1',
            kind: 'sandbox',
            severity: 'info',
            title: 'Sandbox ready',
            body: 'You can safely simulate NDR rescues.',
            read: false,
            createdAt: new Date().toISOString(),
          },
        ]),
      );
    }

    if (path.includes('/api/sandbox/alerts/') && path.endsWith('/read')) {
      return route.fulfill(json({ ok: true }));
    }

    if (path === '/api/sandbox/quality') {
      return route.fulfill(
        json({
          rating: 'GREEN',
          qualityRating: 'GREEN',
        }),
      );
    }

    /**
     * Default safe mock
     */
    return route.fulfill(json({ ok: true }));
  });
}

async function seedAuth(page: Page, user = mockUserCompleted) {
  await page.addInitScript((mockUser) => {
    window.localStorage.setItem('token', 'e2e-token');
    window.localStorage.setItem('user', JSON.stringify(mockUser));
  }, user);
}

async function expectNoCriticalConsoleErrors(page: Page) {
  const errors: string[] = [];

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();

      /**
       * Ignore noisy third-party extension/runtime noise if any exists locally.
       */
      if (!text.includes('ResizeObserver loop')) {
        errors.push(text);
      }
    }
  });

  return errors;
}

async function runA11y(page: Page) {
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(
    results.violations,
    results.violations
      .map((v) => `${v.id}: ${v.help}\n${v.nodes.map((n) => `  - ${n.target.join(', ')}`).join('\n')}`)
      .join('\n\n'),
  ).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await installBrowserStubs(page);
  await mockBackend(page);
});

/**
 * Public pages
 */
test.describe('Public pages', () => {
  test('Landing page renders and exposes primary navigation', async ({ page }) => {
    const consoleErrors = await expectNoCriticalConsoleErrors(page);

    await page.goto('/');
    await expect(page).toHaveTitle(/RescueShip/i);
    await expect(page.locator('body')).toContainText(/RescueShip/i);

    await expect(consoleErrors).toEqual([]);
  });

  test('Login page renders and logs in to dashboard', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('body')).toContainText(/Log In|Command Center|Email/i);

    await page.getByPlaceholder('Enter your email').fill('e2e@rescueship.test');
    await page.getByPlaceholder('Enter your password').fill('correct-horse-battery-staple');

    await page.getByRole('button', { name: /Log In to Command Center/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('body')).toContainText(/Dashboard|Total Orders|Recent Orders|Revenue/i);
  });

  test('Register page renders and routes new users to onboarding', async ({ page }) => {
    await page.goto('/register');

    await expect(page.locator('body')).toContainText(/Create Account/i);

    await page.getByPlaceholder('Your full name').fill('E2E Merchant');
    await page.getByPlaceholder('Your email address').fill('new-e2e@rescueship.test');
    await page.getByPlaceholder('Create a strong password').fill('correct-horse-battery-staple');

    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Start Free Trial/i }).click();

    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.locator('body')).toContainText(/Setup route|Connect/i);
  });

  test('Unknown public route redirects safely', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page).toHaveURL(/\/$/);
  });
});

/**
 * Auth guard
 */
test.describe('Auth guard', () => {
  test('Protected routes redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

/**
 * Protected pages smoke coverage
 */
test.describe('Protected app pages', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page, mockUserCompleted);
  });

  const protectedPages = [
    {
      path: '/dashboard',
      text: /Dashboard|Total Orders|Recent Orders|Revenue|NDR/i,
    },
    {
      path: '/orders',
      text: /Orders Management/i,
    },
    {
      path: '/settings',
      text: /System Settings/i,
    },
    {
      path: '/templates',
      text: /WhatsApp Templates/i,
    },
    {
      path: '/billing',
      text: /Pick the line|Monthly orders|Subscribe/i,
    },
    {
      path: '/audit-logs',
      text: /System Audit Logs/i,
    },
    {
      path: '/docs',
      text: /API Sandbox|Test Request|Copy Code/i,
    },
    {
      path: '/sandbox',
      text: /Sandbox & Safety|Sandbox Mode/i,
    },
  ];

  for (const route of protectedPages) {
    test(`${route.path} renders without crashing`, async ({ page }) => {
      const consoleErrors = await expectNoCriticalConsoleErrors(page);

      await page.goto(route.path);

      await expect(page).toHaveURL(new RegExp(route.path.replace('/', '\\/')));
      await expect(page.locator('body')).toContainText(route.text);
      await expect(consoleErrors).toEqual([]);
    });
  }

  test('Dashboard renders mocked analytics', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.locator('body')).toContainText(/1,284|1284|Total Orders|Revenue/i);
    await expect(page.locator('body')).toContainText(/Aarav Sharma|Priya Patel|Recent Orders/i);
  });

  test('Orders page supports search, row details modal, and close', async ({ page }) => {
    await page.goto('/orders');

    await page.getByPlaceholder(/Search by Order ID or Phone/i).fill('#1001');

    await expect(page.locator('body')).toContainText('#1001');
    await expect(page.locator('body')).toContainText('Aarav Sharma');

    await page.locator('tbody tr').first().click();

    await expect(page.locator('body')).toContainText(/Order Details/i);
    await expect(page.locator('body')).toContainText(/Timeline/i);

    await page.getByRole('button', { name: /Close/i }).click();
    await expect(page.locator('body')).not.toContainText(/Order Details - #1001/i);
  });

  test('Settings page loads, toggles settings, sends test message, and saves', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.locator('body')).toContainText(/Platform Connection/i);
    await expect(page.locator('body')).toContainText(/Carrier Config/i);
    await expect(page.locator('body')).toContainText(/WhatsApp Meta/i);
    await expect(page.locator('body')).toContainText(/Payment Gateway/i);

    // Switch to WhatsApp Meta tab and send test message
    await page.getByRole('button', { name: /WhatsApp Meta/i }).click({ force: true });
    await page.waitForTimeout(250);
    await page.getByRole('button', { name: /Send Test WhatsApp Message/i }).click({ force: true });
    await expect(page.locator('body')).toContainText(/Test Message Dispatched/i);

    // Switch to Feature Toggles tab and toggle notification
    await page.getByRole('button', { name: /Feature Toggles/i }).click({ force: true });
    await page.waitForTimeout(250);
    const notifications = page.getByRole('checkbox').first();
    await notifications.click({ force: true });

    await page.getByRole('button', { name: /Save Configuration/i }).click({ force: true });
    await expect(page.locator('body')).toContainText(/Settings saved successfully/i);
  });

  test('Templates page opens create/test flows', async ({ page }) => {
    await page.goto('/templates');

    await expect(page.locator('body')).toContainText(/Template Library/i);
    await expect(page.locator('body')).toContainText(/Live Preview/i);

    await page.getByRole('button', { name: /New Template/i }).click();
    await expect(page.locator('body')).toContainText(/Create Template|Template/i);

    /**
     * If your modal has required inputs later, fill them here.
     * This click works with the current stub-style modal implementation.
     */
    const createButton = page.getByRole('button', { name: /^Create Template$/i });
    if (await createButton.isVisible().catch(() => false)) {
      await createButton.click();
      await expect(page.locator('body')).toContainText(/Template created|sent for review/i);
    }
  });

  test('Billing page opens checkout drawer', async ({ page }) => {
    await page.goto('/billing');

    await expect(page.locator('body')).toContainText(/Monthly orders/i);
    await expect(page.locator('body')).toContainText(/Due today/i);

    await page.getByRole('button', { name: /Subscribe & go live/i }).click();

    await expect(page.locator('body')).toContainText(/Checkout/i);
    await expect(page.locator('body')).toContainText(/Pay .*activate|activate/i);

    await page.getByRole('button', { name: /Close/i }).click();
  });

  test('Audit logs page filters and opens JSON modal', async ({ page }) => {
    await page.goto('/audit-logs');

    await expect(page.locator('body')).toContainText(/System Audit Logs/i);

    await page.getByPlaceholder(/Search events or sources/i).fill('webhook');

    await expect(page.locator('body')).toContainText(/Shopify Webhook|webhook/i);

    await page.getByRole('button', { name: /View JSON/i }).first().click();

    await expect(page.locator('body')).toContainText(/Event Payload/i);
    await expect(page.locator('pre')).toBeVisible();
  });

  test('Docs page API sandbox test request works', async ({ page }) => {
    await page.goto('/docs');

    await expect(page.locator('body')).toContainText(/API Sandbox/i);

    await page.getByRole('button', { name: /Test Request/i }).click();

    await expect(page.locator('body')).toContainText(/RESPONSE \(200 OK\)/i);
    await expect(page.locator('body')).toContainText(/queued/i);
  });

  test('Sandbox page toggles sandbox and simulates NDR', async ({ page }) => {
    await page.goto('/sandbox');

    await expect(page.locator('body')).toContainText(/Sandbox & Safety/i);
    await expect(page.locator('body')).toContainText(/Sandbox Mode/i);
    await expect(page.locator('body')).toContainText(/Enable sandbox first|Sandbox OFF/i);

    await page.getByRole('button', { name: /Toggle Sandbox Mode/i }).click({ force: true });

    await expect(page.locator('body')).toContainText(/Sandbox ON/i);

    await page.locator('.sb-sim-btn').click({ force: true });

    await expect(page.locator('body')).toContainText(/Status Feed|awaiting activity|rescues|NDR simulated/i);
  });
});

/**
 * Onboarding flow
 */
test.describe('Onboarding page', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page, mockUserPending);
  });

  test('Onboarding renders setup route and Shopify station', async ({ page }) => {
    await page.goto('/onboarding');

    await expect(page.locator('body')).toContainText(/Setup route/i);
    await expect(page.locator('body')).toContainText(/Store address/i);
    await expect(page.getByPlaceholder('your-brand.myshopify.com')).toBeVisible();
    await expect(page.getByRole('button', { name: /Connect Shopify/i })).toBeDisabled();

    await page.getByPlaceholder('your-brand.myshopify.com').fill('demo-store.myshopify.com');

    await expect(page.getByRole('button', { name: /Connect Shopify/i })).toBeEnabled();
  });

  test('Onboarding station navigation exposes WhatsApp, carrier, and payment steps', async ({ page }) => {
    await page.goto('/onboarding');

    await page.getByRole('button', { name: /Skip for now/i }).click();
    await expect(page.locator('body')).toContainText(/Connect WhatsApp number/i);

    await page.getByRole('button', { name: /Skip for now/i }).click();
    await expect(page.locator('body')).toContainText(/shiprocket|delhivery|clickpost/i);
    await expect(page.locator('body')).toContainText(/Validate & connect/i);

    await page.getByRole('button', { name: /Skip for now/i }).click();
    await expect(page.locator('body')).toContainText(/razorpay|cashfree/i);
    await expect(page.locator('body')).toContainText(/Key \/ Client ID/i);
    await expect(page.locator('body')).toContainText(/Secret/i);
  });
});

/**
 * Accessibility scans
 *
 * Keep this enabled if your goal is strict WCAG enforcement across all app pages.
 * If this reveals failures, do not delete the test — fix the page semantics/contrast.
 */
test.describe('WCAG 2.1 AA scans for all pages', () => {
  const publicPages = ['/', '/login', '/register'];

  for (const path of publicPages) {
    test(`A11y scan: public ${path}`, async ({ page }) => {
      await page.goto(path);
      await runA11y(page);
    });
  }

  const protectedPages = [
    '/dashboard',
    '/orders',
    '/settings',
    '/templates',
    '/billing',
    '/audit-logs',
    '/docs',
    '/sandbox',
  ];

  for (const path of protectedPages) {
    test(`A11y scan: protected ${path}`, async ({ page }) => {
      await seedAuth(page, mockUserCompleted);
      await page.goto(path);
      await runA11y(page);
    });
  }

  test('A11y scan: onboarding', async ({ page }) => {
    await seedAuth(page, mockUserPending);
    await page.goto('/onboarding');
    await runA11y(page);
  });
});
