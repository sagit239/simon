import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// These tests run against the production build served at /simon/ (the same path
// as the GitHub Pages project site), with service workers enabled. Every test
// gets a fresh, isolated browser context, so each one starts with an empty cache.

const ORIGIN = 'http://localhost:4173';
const SCOPE = `${ORIGIN}/simon/`;

test.beforeEach(async ({ page }) => {
  // Test-only: every sequence item is blue (see ADR-3). Tones are recorded.
  await page.addInitScript(() => {
    Math.random = () => 0;
    const tones: number[] = [];
    (window as unknown as { __tones: number[] }).__tones = tones;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (this: OscillatorNode, ...args: [number?]) {
      tones.push(this.frequency.value);
      return start.apply(this, args);
    };
  });
});

const home = (page: Page) => page.locator('.screen--home');
const about = (page: Page) => page.locator('.screen--about');
const status = (page: Page) => page.locator('.status');
const aboutScore = (page: Page) => page.locator('.about-score__value');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const tones = (page: Page) => page.evaluate(() => (window as unknown as { __tones: number[] }).__tones.length);

async function waitFor(page: Page, phase: string) {
  await expect(home(page)).toHaveAttribute('data-phase', phase, { timeout: 15_000 });
}

// Plays stages from..to correctly (all-blue sequences).
async function playStages(page: Page, from: number, to: number) {
  for (let stage = from; stage <= to; stage++) {
    await waitFor(page, 'accepting');
    for (let i = 0; i < stage; i++) await button(page, 'כחול').click();
  }
}

// First visit online: wait until the precache finished and the worker controls the page.
async function prepareOffline(page: Page) {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-offline-ready', 'true', { timeout: 30_000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The first page load is not controlled yet (no clientsClaim); a reload is.
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

async function goOffline(context: BrowserContext, page: Page) {
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'סיימון' })).toBeVisible();
}

test.describe('PWA and offline', () => {
  test('manifest and icons load from the /simon/ base', async ({ page, request }) => {
    await page.goto('./');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/simon/manifest.webmanifest');

    const response = await request.get(`${ORIGIN}${href}`);
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest).toMatchObject({
      name: 'סיימון',
      lang: 'he',
      dir: 'rtl',
      display: 'standalone',
      id: '/simon/',
      start_url: '/simon/',
      scope: '/simon/',
    });
    const purposes = manifest.icons.map((icon: { purpose?: string }) => icon.purpose ?? 'any');
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );
    expect(purposes).toContain('maskable');

    const iconUrls = manifest.icons.map((icon: { src: string }) => new URL(icon.src, `${ORIGIN}${href}`).href);
    const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    iconUrls.push(`${ORIGIN}${apple}`);
    for (const url of iconUrls) {
      expect(url.startsWith(SCOPE)).toBe(true);
      const icon = await request.get(url);
      expect(icon.ok(), url).toBe(true);
      expect(icon.headers()['content-type']).toContain('image/png');
    }
  });

  test('the service worker is limited to the project scope', async ({ page }) => {
    await page.goto('./');
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toBe(SCOPE);
    const script = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL);
    expect(script).toBe(`${SCOPE}sw.js`);
  });

  test('offline: reload, full game with sound, about, return and new game', async ({ context, page }) => {
    test.setTimeout(180_000);
    const requests: string[] = [];
    context.on('request', (r) => requests.push(r.url()));

    await prepareOffline(page);
    await goOffline(context, page);

    // The bundled Heebo font is served from the cache.
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Heebo') && f.status === 'loaded')),
    ).toBe(true);
    for (const label of ['כחול', 'אדום', 'צהוב', 'ירוק']) await expect(button(page, label)).toBeVisible();

    // Play to the middle of stage 3, then check the about screen.
    await button(page, 'התחל').click();
    await playStages(page, 1, 2);
    await waitFor(page, 'accepting');
    expect(await tones(page)).toBeGreaterThan(0);
    await button(page, 'אודות').click();
    await expect(about(page)).toBeVisible();
    await expect(aboutScore(page)).toHaveText('2');
    await expect(page.getByRole('heading', { name: 'חוקי המשחק' })).toBeVisible();
    await expect(about(page).locator('p')).not.toHaveCount(0);

    // Return: the same stage 3 sequence is shown again, then finish to a win.
    await button(page, 'חזרה למשחק').click();
    await expect(home(page)).toBeVisible();
    await waitFor(page, 'accepting');
    await expect(status(page)).toHaveText('שלב 3 · ניקוד 2');
    await playStages(page, 3, 10);
    await waitFor(page, 'won');
    await expect(page.getByRole('heading', { name: 'ניצחון!' })).toBeVisible();
    await expect(page.getByText('הניקוד שלך: 10')).toBeVisible();

    // New game, then end it with a mistake.
    await button(page, 'משחק חדש').click();
    await waitFor(page, 'accepting');
    await expect(status(page)).toHaveText('שלב 1 · ניקוד 0');
    await button(page, 'אדום').click();
    await waitFor(page, 'lost');
    await expect(page.getByRole('heading', { name: 'המשחק נגמר' })).toBeVisible();
    await page.screenshot({ path: 'test-results/offline-lost.png', fullPage: true });

    // Nothing was requested from another origin.
    const external = requests.filter((url) => !url.startsWith(ORIGIN) && !url.startsWith('data:'));
    expect(external).toEqual([]);
  });

  test('offline refresh resets to home; the cache holds site files only', async ({ context, page }) => {
    test.setTimeout(120_000);
    await prepareOffline(page);
    await goOffline(context, page);

    // Refresh in the middle of a game.
    await button(page, 'התחל').click();
    await playStages(page, 1, 2);
    await waitFor(page, 'accepting');
    await page.reload();
    await expect(button(page, 'התחל')).toBeVisible();
    await expect(status(page)).toHaveText('');

    // Refresh on the about screen.
    await button(page, 'התחל').click();
    await playStages(page, 1, 1);
    await button(page, 'אודות').click();
    await expect(aboutScore(page)).toHaveText('1');
    await page.reload();
    await expect(home(page)).toBeVisible();
    await expect(about(page)).toBeHidden();
    await expect(button(page, 'התחל')).toBeVisible();
    await button(page, 'אודות').click();
    await expect(aboutScore(page)).toHaveText('0');

    // Cache Storage contains only this project's site files; no game data anywhere.
    const stored = await page.evaluate(async () => {
      const entries: { cache: string; url: string }[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) entries.push({ cache: name, url: req.url });
      }
      return { entries, local: localStorage.length, session: sessionStorage.length };
    });
    expect(stored.entries.length).toBeGreaterThan(0);
    for (const { cache, url } of stored.entries) {
      expect(cache.startsWith('simon')).toBe(true);
      const path = new URL(url).pathname;
      expect(path.startsWith('/simon/'), url).toBe(true);
      expect(path, url).toMatch(/\.(html|js|css|woff2|png|svg|ico|webmanifest)$/);
    }
    expect(stored.local).toBe(0);
    expect(stored.session).toBe(0);
  });
});
