import { expect, test, type Page } from '@playwright/test';

// Test-only control of randomness: Math.random always returns 0, so every
// sequence item is blue. Production code is unchanged.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
    // Record every tone that starts, to check sound accompanies the light.
    const tones: { hz: number; lit: string | null }[] = [];
    (window as unknown as { __tones: typeof tones }).__tones = tones;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (this: OscillatorNode, ...args: [number?]) {
      const lit = document.querySelector<HTMLElement>('.pad.is-active')?.dataset.color ?? null;
      tones.push({ hz: this.frequency.value, lit });
      return start.apply(this, args);
    };
  });
});

const screen = (page: Page) => page.locator('.screen--home');
const pad = (page: Page, label: string) => page.getByRole('button', { name: label, exact: true });
const status = (page: Page) => page.locator('.status');

async function waitFor(page: Page, phase: string) {
  await expect(screen(page)).toHaveAttribute('data-phase', phase, { timeout: 15_000 });
}

// Plays stages 1..count correctly (all-blue sequences).
async function playStages(page: Page, count: number) {
  for (let stage = 1; stage <= count; stage++) {
    await waitFor(page, 'accepting');
    await expect(status(page)).toHaveText(`שלב ${stage} · ניקוד ${stage - 1}`);
    for (let i = 0; i < stage; i++) await pad(page, 'כחול').click();
  }
}

test.describe('game', () => {
  test('counter is hidden before the game starts', async ({ page }) => {
    await page.goto('./');
    await expect(status(page)).toHaveText('');
    await page.getByRole('button', { name: 'התחל' }).click();
    await expect(status(page)).toHaveText('שלב 1 · ניקוד 0');
    await expect(page.getByRole('button', { name: 'התחל' })).toBeHidden();
  });

  test('win: completes all 10 stages with score 10', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('./');
    await page.getByRole('button', { name: 'התחל' }).click();
    await playStages(page, 10);
    await waitFor(page, 'won');
    await expect(page.getByRole('heading', { name: 'ניצחון!' })).toBeVisible();
    await expect(page.getByText('הניקוד שלך: 10')).toBeVisible();
    await expect(page.getByRole('button', { name: 'משחק חדש' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'התחל' })).toBeHidden();
    await expect(status(page)).toHaveText('');
    await page.screenshot({ path: 'test-results/game-won.png', fullPage: true });
  });

  test('loss: a wrong press ends the game and later presses change nothing', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'התחל' }).click();
    await playStages(page, 1);
    await waitFor(page, 'accepting');
    await pad(page, 'כחול').click();
    await pad(page, 'אדום').click();
    await waitFor(page, 'lost');
    await expect(page.getByRole('heading', { name: 'המשחק נגמר' })).toBeVisible();
    await expect(page.getByText('הניקוד שלך: 1')).toBeVisible();
    // force: skip Playwright's wait for aria-disabled pads to become enabled.
    for (const label of ['כחול', 'אדום', 'צהוב', 'ירוק']) await pad(page, label).click({ force: true });
    await page.waitForTimeout(500);
    await expect(screen(page)).toHaveAttribute('data-phase', 'lost');
    await expect(page.getByText('הניקוד שלך: 1')).toBeVisible();
    await page.screenshot({ path: 'test-results/game-lost.png', fullPage: true });
  });

  test('new game restarts at stage 1 with score 0', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'התחל' }).click();
    await playStages(page, 2);
    await waitFor(page, 'accepting');
    await pad(page, 'ירוק').click();
    await waitFor(page, 'lost');
    await page.getByRole('button', { name: 'משחק חדש' }).click();
    await expect(status(page)).toHaveText('שלב 1 · ניקוד 0');
    await expect(page.getByRole('heading', { name: 'המשחק נגמר' })).toBeHidden();
    await waitFor(page, 'accepting');
    await pad(page, 'כחול').click();
    await waitFor(page, 'accepting');
    await expect(status(page)).toHaveText('שלב 2 · ניקוד 1');
  });

  test('presses during presentation are ignored', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'התחל' }).click();
    await expect(screen(page)).toHaveAttribute('data-phase', 'presenting');
    // force: a real click, without waiting for the locked pad to become enabled.
    await pad(page, 'אדום').click({ force: true });
    await waitFor(page, 'accepting');
    await expect(status(page)).toHaveText('שלב 1 · ניקוד 0');
  });

  test('locked pads are dimmed, lit pad and accepting pads are not', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'התחל' }).click();
    await expect(pad(page, 'כחול')).toHaveClass(/is-active/);
    await expect(pad(page, 'אדום')).toHaveCSS('opacity', '0.6');
    await expect(pad(page, 'כחול')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: 'test-results/game-presenting.png', fullPage: true });
    await waitFor(page, 'accepting');
    for (const label of ['כחול', 'אדום', 'צהוב', 'ירוק']) {
      await expect(pad(page, label)).toHaveCSS('opacity', '1');
    }
    await page.screenshot({ path: 'test-results/game-accepting.png', fullPage: true });
  });

  test('light and sound play together, one distinct tone per color', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'התחל' }).click();
    await waitFor(page, 'accepting');
    // Wrong press: red feedback with the red tone.
    await pad(page, 'אדום').click();
    await waitFor(page, 'lost');
    const tones = await page.evaluate(() => (window as unknown as { __tones: { hz: number; lit: string }[] }).__tones);
    expect(tones).toEqual([
      { hz: 209, lit: 'blue' }, // sequence item
      { hz: 310, lit: 'red' }, // press feedback
    ]);
  });

  test('refresh resets to the start state without web storage', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'התחל' }).click();
    await playStages(page, 1);
    await waitFor(page, 'accepting');
    await page.reload();
    await expect(page.getByRole('button', { name: 'התחל' })).toBeVisible();
    await expect(status(page)).toHaveText('');
    await expect(screen(page)).toHaveAttribute('data-phase', 'idle');
    const storage = await page.evaluate(() => localStorage.length + sessionStorage.length);
    expect(storage).toBe(0);
  });

  test('audio failure shows a message and does not start or fail the game', async ({ page }) => {
    await page.addInitScript(() => {
      window.AudioContext = class {
        constructor() {
          throw new Error('audio unavailable');
        }
      } as unknown as typeof AudioContext;
    });
    await page.goto('./');
    await page.getByRole('button', { name: 'התחל' }).click();
    await expect(page.getByRole('alert')).toHaveText('לא ניתן להפעיל את הצליל. נסו שוב.');
    await expect(page.getByRole('button', { name: 'התחל' })).toBeVisible();
    await expect(screen(page)).toHaveAttribute('data-phase', 'idle');
    await expect(status(page)).toHaveText('');
  });
});
