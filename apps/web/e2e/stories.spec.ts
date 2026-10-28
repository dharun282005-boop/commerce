import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const rupees = (s: string) => Number(s.replace(/[^\d.]/g, ''));

async function cards(page: Page) {
  // Wait for the results region to finish loading (a preset click triggers a new request).
  await expect(page.locator('main [aria-live="polite"][aria-busy="false"]').first()).toBeAttached();
  const list = page.locator('main ol > li article');
  await expect(list.first()).toBeVisible();
  return list;
}

test('US-1: S24 FE 128GB in Velachery: only 128 GB, several sources, fresh and labelled, scam listing last', async ({
  page,
}) => {
  await page.goto('/en');
  await page.getByRole('tab', { name: 'Shopping' }).click();
  await page.getByLabel('What are you looking for?').fill('Samsung Galaxy S24 FE 128GB');
  await page.getByLabel('Locality or pincode').fill('Velachery');
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.getByRole('button', { name: 'Cheapest' }).click();
  await expect(page).toHaveURL(/preset=cheapest/);
  const list = await cards(page);
  const n = await list.count();
  expect(n).toBeGreaterThanOrEqual(4);
  const text = await list.allInnerTexts();
  expect(text.every((t) => /128/.test(t) && !/256/.test(t))).toBe(true);
  expect(
    new Set(text.map((t) => t.match(/(Amazon\.in|Flipkart|Croma|Reliance Digital)/)?.[1])).size,
  ).toBeGreaterThanOrEqual(3);
  expect(text.every((t) => /Sample data/.test(t) && /checked \d+ min ago/.test(t))).toBe(true);
  await expect(list.last()).toContainText('Price looks too low');
  await expect(page.locator('main')).not.toContainText('IGNORE PREVIOUS INSTRUCTIONS');
  // Why is this #1? breakdown
  await list.first().getByText('Why is this #1?').click();
  await expect(list.first()).toContainText('Score');
});

test('US-2: veg biryani for 2 under ₹300 in 40 min to Adyar', async ({ page }) => {
  await page.goto('/en');
  await page.getByRole('link', { name: /Veg biryani for 2 in Adyar/ }).click();
  const list = await cards(page);
  expect(await list.count()).toBeGreaterThanOrEqual(2);
  for (const t of await list.allInnerTexts()) {
    const total = rupees(t.match(/₹[\d,.]+/)![0]);
    expect(total).toBeLessThanOrEqual(300);
    expect(t).toContain('Veg');
  }
});

test('US-3: weekly grocery list split across apps in T Nagar', async ({ page }) => {
  await page.goto('/en');
  await page.getByRole('link', { name: /Weekly groceries in T Nagar/ }).click();
  await expect(page.getByText(/^Total ₹/)).toBeVisible();
  await expect(page.getByText('Method: exhaustive')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('No plan meets');
  await expect(page.locator('main')).not.toContainText('Not found:');
});

test('US-4: 2 BHK rent near OMR ≤ ₹30,000, semi-furnished: duplicates merged, scams flagged, no phone numbers', async ({
  page,
}) => {
  await page.goto('/en');
  await page.getByRole('link', { name: /2 BHK rent near OMR/ }).click();
  const list = await cards(page);
  expect(await list.count()).toBeGreaterThanOrEqual(5);
  const text = (await list.allInnerTexts()).join('\n');
  expect(text).toContain('Also listed on');
  expect(text).toContain('Asks for money or ID');
  expect(await page.locator('main').innerText()).not.toMatch(/\b[6-9]\d{9}\b/);
  for (const t of await list.allInnerTexts())
    expect(rupees(t.match(/₹[\d,]+/)![0])).toBeLessThanOrEqual(30000);
});

test('assistant answers from tools and shows what it checked', async ({ page }) => {
  await page.goto('/en/agent');
  await page
    .getByPlaceholder('Ask about prices in Chennai…')
    .fill('Cheapest veg biryani for 2 under Rs 300 in Adyar');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/What I checked/)).toBeVisible({ timeout: 15000 });
  await expect(page.locator('main')).toContainText('Marina Biryani House');
  await expect(page.locator('main')).not.toContainText('UPI');
});

test('Tamil UI', async ({ page }) => {
  await page.goto('/ta');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ta');
  await expect(page.getByRole('button', { name: 'ஒப்பிடு' })).toBeVisible();
});

for (const path of [
  '/en',
  '/en/results?vertical=food&q=veg+biryani&locality=Adyar',
  '/en/grocery',
  '/en/agent',
  '/en/about',
  '/en/saved',
  '/ta',
]) {
  test(`accessibility: no serious or critical axe violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}

test('performance: home LCP under 2.5 s on a throttled mobile profile', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await page.goto('/en', { waitUntil: 'load' });
  const lcp = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const e = list.getEntries().at(-1);
          resolve(e ? e.startTime : 0);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => resolve(-1), 5000);
      }),
  );
  console.log(`LCP (4x CPU, ~1.6 Mbps, 150 ms RTT): ${Math.round(lcp)} ms`);
  expect(lcp).toBeGreaterThan(0);
  expect(lcp).toBeLessThan(2500);
});

test('offline: saved items still show without a network', async ({ page, context }) => {
  await page.goto('/en/results?vertical=shopping&q=iPhone+16&locality=Adyar');
  const list = await cards(page);
  await list.first().getByRole('button', { name: 'Save' }).click();
  await page.goto('/en/saved');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator('main')).toContainText('iPhone 16');
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('main')).toContainText('iPhone 16');
  await context.setOffline(false);
});
