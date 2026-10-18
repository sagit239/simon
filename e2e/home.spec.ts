import { expect, test } from '@playwright/test';

test.describe('home screen', () => {
  test('loads in Hebrew RTL with title and buttons', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'סיימון' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'אודות' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'התחל' })).toBeVisible();
    for (const label of ['כחול', 'אדום', 'צהוב', 'ירוק']) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
  });

  test('places pads in fixed positions regardless of RTL', async ({ page }) => {
    await page.goto('./');
    const box = async (label: string) => {
      const b = await page.getByRole('button', { name: label }).boundingBox();
      if (!b) throw new Error(`no box for ${label}`);
      return b;
    };
    const blue = await box('כחול');
    const red = await box('אדום');
    const yellow = await box('צהוב');
    const green = await box('ירוק');

    // Top row: blue right, red left. Bottom row: yellow right, green left.
    expect(blue.x).toBeGreaterThan(red.x);
    expect(yellow.x).toBeGreaterThan(green.x);
    expect(blue.y).toBe(red.y);
    expect(yellow.y).toBe(green.y);
    expect(yellow.y).toBeGreaterThan(blue.y);
    expect(blue.x).toBe(yellow.x);
    expect(red.x).toBe(green.x);
  });

  test('all buttons are at least 48px and nothing overflows horizontally', async ({ page }) => {
    await page.goto('./');
    const viewportWidth = page.viewportSize()!.width;
    const buttons = page.getByRole('button');
    const count = await buttons.count();
    expect(count).toBe(6);
    for (let i = 0; i < count; i++) {
      const b = (await buttons.nth(i).boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(48);
      expect(b.height).toBeGreaterThanOrEqual(48);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(viewportWidth);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('loads no resources from external origins', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.hostname !== 'localhost') external.push(req.url());
    });
    await page.goto('./');
    await page.waitForLoadState('networkidle');
    expect(external).toEqual([]);
  });

  test('uses the bundled Heebo font', async ({ page }) => {
    await page.goto('./');
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() => document.fonts.check('700 32px Heebo', 'סיימון'));
    expect(loaded).toBe(true);
    await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  });
});
