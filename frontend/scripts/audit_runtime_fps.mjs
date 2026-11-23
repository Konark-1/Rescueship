import { chromium } from '@playwright/test';

async function testRuntime() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  console.log('Navigating to http://localhost:5173 ...');
  const t0 = Date.now();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  const loadTime = Date.now() - t0;
  console.log(`Page loaded in ${loadTime}ms`);

  // Verify all sections exist in the DOM
  const checks = {
    heroKicker: await page.locator('.lp-hero__kicker').isVisible(),
    heroHeading: await page.locator('.lp-intent__h1').isVisible(),
    dispatchRadar: await page.locator('.lp-console').isVisible(),
    statSaved: await page.locator('.lp-stat__n').first().innerText(),
    marquee: await page.locator('.rs-marquee__track').isVisible().catch(() => false),
    foldfolio: await page.locator('#foldfolio-demo').count() > 0,
    featuresGrid: await page.locator('.rs-mondragon-grid').count() > 0,
    studioWorkspace: await page.locator('#pricing').count() > 0 || await page.locator('.lp-workspace').count() > 0,
  };
  console.log('DOM Component Check:', checks);

  // Warm up lazy chunks by quickly scrolling through page once
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 600));
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 400));
  });

  // Measure Scroll Frame Rate & Jank
  console.log('Running 60 FPS Scroll Simulation (Post-Hydration)...');
  const scrollMetrics = await page.evaluate(async () => {
    return new Promise((resolve) => {
      let frames = 0;
      let lastTime = performance.now();
      const frameDeltas = [];
      let maxDelta = 0;
      let longFrames = 0; // frames taking > 33.3ms (dropping below 30 FPS)

      function onFrame(now) {
        const delta = now - lastTime;
        lastTime = now;
        frameDeltas.push(delta);
        if (delta > maxDelta) maxDelta = delta;
        if (delta > 33.3) longFrames++;
        frames++;

        if (frames < 120) {
          window.scrollBy(0, 45); // Smooth scrolling down
          requestAnimationFrame(onFrame);
        } else if (frames < 240) {
          window.scrollBy(0, -45); // Smooth scrolling up
          requestAnimationFrame(onFrame);
        } else {
          const avgDelta = frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length;
          const fps = Math.round(1000 / avgDelta);
          resolve({
            totalFrames: frames,
            avgFps: fps,
            maxDeltaMs: Math.round(maxDelta),
            longFrames,
            longFrameRate: `${((longFrames / frames) * 100).toFixed(1)}%`
          });
        }
      }

      requestAnimationFrame(onFrame);
    });
  });

  console.log('Scroll Performance Report:', scrollMetrics);
  console.log('Console Errors:', consoleErrors.length === 0 ? 'None ✓' : consoleErrors);

  await browser.close();
}

testRuntime().catch(console.error);
