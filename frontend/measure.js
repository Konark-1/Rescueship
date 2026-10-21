import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173');
  await page.locator('button.rs-fold-chip', { hasText: '1. Folded Cover' }).click();
  await page.waitForTimeout(600);
  const data = await page.evaluate(() => {
    const book = document.querySelector('.rs-titanium-book').getBoundingClientRect();
    const leftLeaf = document.querySelector('.rs-book-leaf--left').getBoundingClientRect();
    const rightLeaf = document.querySelector('.rs-book-leaf--right').getBoundingClientRect();
    const coverFace = document.querySelector('.rs-leaf-face--cover').getBoundingClientRect();
    return { book, leftLeaf, rightLeaf, coverFace };
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
}

main().catch(console.error);
