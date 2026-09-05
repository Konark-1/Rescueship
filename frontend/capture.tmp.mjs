import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';

const FRONTEND = 'C:/Users/Konark Parihar/Desktop/wa/rescueship/frontend';
const OUT = 'C:/Users/KONARK~1/AppData/Local/Temp/opencode/shots';
const BASE = 'http://localhost:5199';

function waitForServer(url, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      http.get(url, (res) => resolve()).on('error', () => {
        if (Date.now() - start > timeout) reject(new Error('timeout'));
        else setTimeout(tick, 500);
      });
    };
    tick();
  });
}

const user = {
  completed: JSON.stringify({ id: 'm1', name: 'Aarav Sharma', email: 'aarav@demo.in', platform: 'shopify', onboardingStatus: 'completed' }),
  pending: JSON.stringify({ id: 'm1', name: 'Aarav Sharma', email: 'aarav@demo.in', platform: 'shopify', onboardingStatus: 'pending' }),
};

async function mockApi(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const method = route.request().method();
    const ok = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

    if (p === '/api/analytics/dashboard') {
      return ok({
        totalOrders: 12458,
        codToPrepaid: { count: 3210, conversionRate: 25.7 },
        ndrRescues: { count: 854, rescueRate: 42.3 },
        revenueSaved: 1254000,
        activeNdrCases: 142,
        creditsRemaining: 100,
        dailyConversions: [
          { date: 'Mon', conversions: 120 }, { date: 'Tue', conversions: 150 }, { date: 'Wed', conversions: 180 },
          { date: 'Thu', conversions: 140 }, { date: 'Fri', conversions: 210 }, { date: 'Sat', conversions: 236 }, { date: 'Sun', conversions: 190 },
        ],
        ndrReasons: [
          { name: 'Customer Unavailable', value: 45 }, { name: 'Address Incomplete', value: 25 },
          { name: 'Refused Delivery', value: 15 }, { name: 'Fake Failure Remark', value: 15 },
        ],
        carrierPerformance: [
          { carrier: 'Delhivery', rto: 120, rescued: 80 }, { carrier: 'Bluedart', rto: 50, rescued: 40 },
          { carrier: 'Xpressbees', rto: 90, rescued: 60 }, { carrier: 'Shadowfax', rto: 30, rescued: 20 },
        ],
        recentOrders: [
          { id: 'ORD-9874', customer: 'Rahul Sharma', status: 'Delivered', amount: 1299, date: 'Today, 10:42 AM' },
          { id: 'ORD-9873', customer: 'Priya Singh', status: 'NDR Initiated', amount: 3499, date: 'Today, 09:15 AM' },
          { id: 'ORD-9872', customer: 'Amit Kumar', status: 'Converted', amount: 899, date: 'Yesterday, 04:30 PM' },
          { id: 'ORD-9871', customer: 'Sneha Gupta', status: 'RTO', amount: 2100, date: 'Yesterday, 02:10 PM' },
        ],
      });
    }
    if (p === '/api/metrics/my') {
      return ok({ success: true, metrics: { ndrReceived: 312, rescuesAttempted: 298, rescuesSucceeded: 132, rescuesFailed: 166, rescueRate: 0.443, conversionRate: 0.381, avgRescueTimeMin: 4, revenue: 486200 } });
    }
    if (p === '/api/orders') {
      return ok({
        orders: [
          { id: 'o1', orderId: '#1001', customerName: 'Aarav Sharma', phone: '+91 98201 11223', status: 'Delivered', carrier: 'Delhivery', timeline: [{ event: 'Order created', date: '10:00 AM' }, { event: 'NDR detected', date: '12:04 PM' }, { event: 'WhatsApp rescue sent', date: '12:05 PM' }, { event: 'Address confirmed + delivered', date: '06:42 PM' }] },
          { id: 'o2', orderId: '#1002', customerName: 'Priya Patel', phone: '+91 98201 44556', status: 'NDR Initiated', carrier: 'Shiprocket', timeline: [{ event: 'Order created', date: '09:12 AM' }, { event: 'NDR detected - customer unavailable', date: '11:20 AM' }] },
          { id: 'o3', orderId: '#1003', customerName: 'Vikram Rao', phone: '+91 98201 77889', status: 'Converted to Prepaid', carrier: 'Bluedart', timeline: [{ event: 'Order created', date: 'Yesterday' }] },
          { id: 'o4', orderId: '#1004', customerName: 'Sneha Gupta', phone: '+91 98201 90112', status: 'RTO', carrier: 'Xpressbees', timeline: [{ event: 'Order created', date: '2 days ago' }, { event: 'RTO initiated', date: 'Yesterday' }] },
          { id: 'o5', orderId: '#1005', customerName: 'Kabir Mehta', phone: '+91 98201 33445', status: 'Delivered', carrier: 'Shadowfax', timeline: [{ event: 'Delivered', date: 'Today' }] },
        ],
      });
    }
    if (p === '/api/settings') return ok({ platformUrl: 'urbanthreadz.myshopify.com', platformApiKey: 'shpat_live_9f8d7c', carrierName: 'Shiprocket', carrierApiKey: 'sr_live_2234', whatsappToken: 'wa_live_5512', paymentGatewayKey: 'rzp_live_8843', enableNotifications: true, enableAutoFulfillment: false });
    if (p.startsWith('/api/connect')) return ok({ paid: false, ownerPhone: '+91 98201 11111', connections: { shopify: { status: 'connected', shopDomain: 'urbanthreadz.myshopify.com' }, whatsapp: { status: 'templates_pending' }, carrier: { status: 'disconnected', provider: null }, payment: { status: 'disconnected', gateway: null } }, templates: [{ name: 'ndr_rescue_en', status: 'APPROVED' }, { name: 'cod_prepay_offer', status: 'PENDING' }] });
    if (p.startsWith('/api/billing')) return ok({ active: false });
    if (p.startsWith('/api/sandbox')) return ok({ sandbox: { enabled: false, testRescuesSent: 0, testRescuesSucceeded: 0, graduationThreshold: 3, graduated: false }, quality: { qualityRating: 'GREEN' }, alerts: [] });
    if (p.startsWith('/api/export')) return ok({ ok: true });
    if (p.startsWith('/api/plg')) return ok({ success: true });
    return ok({});
  });
}

const run = async () => {
  const fs = await import('node:fs');
  fs.mkdirSync(OUT, { recursive: true });

  const dev = spawn('npm', ['run', 'dev', '--', '--port', '5199', '--strictPort'], { cwd: FRONTEND, shell: true, stdio: 'ignore' });
  try {
    await waitForServer(BASE);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1.5 });
    await ctx.addInitScript(() => {
      class MockES extends EventTarget { constructor(u) { super(); setTimeout(() => this.onopen?.(new Event('open')), 10); } close() {} }
      Object.defineProperty(window, 'EventSource', { value: MockES, writable: true });
    });
    const page = await ctx.newPage();
    await mockApi(page);

    const shot = async (name, opts = {}) => {
      if (opts.settle) await page.waitForTimeout(opts.settle);
      else await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: !!opts.full });
      console.log('shot:', name);
    };

    const auth = async (kind) => page.evaluate((u) => { localStorage.setItem('token', 'e2e-token'); localStorage.setItem('user', u); }, user[kind]);

    // Landing — kill boot overlay for a stable capture
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => { for (let i = 1; i < 99999; i++) { window.clearInterval(i); window.clearTimeout(i); } document.querySelector('.lp-boot')?.remove(); });
    await shot('01-landing', { full: false, settle: 800 });
    await page.evaluate(() => window.scrollTo(0, 99999));
    await shot('01b-landing-bottom', { settle: 800 });

    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await shot('02-login');
    await page.goto(BASE + '/register', { waitUntil: 'networkidle' });
    await shot('03-register');

    // Onboarding (pending)
    await auth('pending');
    await page.goto(BASE + '/onboarding', { waitUntil: 'networkidle' });
    await shot('04-onboarding', { settle: 1500 });

    // App pages (completed)
    await auth('completed');
    const pages = [
      ['05-dashboard', '/dashboard', 2200],
      ['06-orders', '/orders', 1500],
      ['07-settings', '/settings', 1500],
      ['08-templates', '/templates', 1500],
      ['09-billing', '/billing', 1800],
      ['10-audit-logs', '/audit-logs', 1500],
      ['11-docs', '/docs', 1500],
      ['12-sandbox', '/sandbox', 1500],
    ];
    for (const [name, url, settle] of pages) {
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      await shot(name, { settle });
    }

    // Orders modal
    await page.goto(BASE + '/orders', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.locator('tbody tr').first().click().catch(() => {});
    await shot('06b-orders-modal', { settle: 800 });

    await browser.close();
  } finally {
    dev.kill('SIGTERM');
  }
};

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
