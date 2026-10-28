import { expect, test } from '@playwright/test';

/** Every page, in both languages, loads with no JavaScript errors, console errors or failed requests. */
const PATHS = [
  '/',
  '/results?vertical=shopping&q=iPhone+16&locality=Adyar',
  '/results?vertical=food&q=veg+biryani&locality=Adyar&veg=1',
  '/results?vertical=property&q=2+bhk&locality=OMR&bhk=2&listingType=rent',
  '/item/fixture-flipkart%3As24fe-128-1',
  '/property/fixture-magicbricks%3Amb-per-2bhk-a',
  '/grocery?list=2+kg+rice%2C+1+L+milk%2C+12+eggs&locality=T+Nagar',
  '/agent',
  '/saved',
  '/admin/sources',
  '/about',
  '/alerts/verify?token=invalid',
];

for (const locale of ['en', 'ta']) {
  for (const p of PATHS) {
    test(`no errors: /${locale}${p}`, async ({ page }) => {
      const problems: string[] = [];
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        // The alert-verify page deliberately sends an invalid token and gets a 400.
        if (m.type() === 'error' && !(p.startsWith('/alerts/verify') && /400/.test(m.text())))
          problems.push(`console: ${m.text()}`);
      });
      page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
      page.on('response', (r) => {
        if (r.status() >= 500) problems.push(`HTTP ${r.status()}: ${r.url()}`);
      });
      const res = await page.goto(`/${locale}${p === '/' ? '' : p}`);
      expect(res?.status()).toBeLessThan(400);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).not.toContainText('Something went wrong');
      expect(problems).toEqual([]);
    });
  }
}

test('the item detail page shows a price-history chart', async ({ page }) => {
  await page.goto('/en/item/fixture-flipkart%3As24fe-128-1');
  await expect(page.getByRole('img', { name: /Price history/ })).toBeVisible();
  await expect(page.getByText(/Lowest ₹/)).toBeVisible();
});

test('price alert form explains when email is not configured', async ({ page }) => {
  await page.goto('/en/item/fixture-flipkart%3As24fe-128-1');
  await page.getByLabel('Email').fill('demo@example.com');
  await page.getByRole('button', { name: 'Create alert' }).click();
  await expect(page.getByText(/not available on this deployment/)).toBeVisible();
});

test('mobile menu opens and navigates', async ({ page }) => {
  await page.goto('/en');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.locator('#mobile-nav').getByRole('link', { name: 'Grocery list' }).click();
  await expect(page).toHaveURL(/\/en\/grocery/);
});
