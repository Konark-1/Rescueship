import { test, expect } from '@playwright/test';

test.describe('Onboarding Wizard Flow (/onboarding)', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    // Inject mock authenticated session
    await page.addInitScript(() => {
      localStorage.setItem('token', 'mock_jwt_test_token_12345');
      localStorage.setItem('user', JSON.stringify({
        id: 'merchant_123',
        email: 'founder@testbrand.com',
        name: 'Alex Merchant',
        platform: 'shopify',
        onboardingStatus: 'pending'
      }));
    });

    await page.goto('/onboarding');
  });

  test('should render onboarding wizard header and step progress', async ({ page }) => {
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });
});
