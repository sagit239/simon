import { expect, test, type Page } from '@playwright/test';

// Test-only control of randomness: Math.random cycles 0, 0.3, 0.6, 0.9, so
// the sequence grows as blue, red, yellow, green, blue, ... Production code
// is unchanged. Every tone start records the pad lit at that moment.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const values = [0, 0.3, 0.6, 0.9];
    let i = 0;
    Math.random = () => values[i++ % values.length];
    const w = window as unknown as { __lit: (string | null)[] };
    w.__lit = [];
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (this: OscillatorNode, ...args: [number?]) {
      w.__lit.push(document.querySelector<HTMLElement>('.pad.is-active')?.dataset.color ?? null);
      return start.apply(this, args);
    };
  });
});

const ORDER = ['blue', 'red', 'yellow', 'green'] as const;
const LABEL: Record<string, string> = { blue: 'כחול', red: 'אדום', yellow: 'צהוב', green: 'ירוק' };
const sequenceFor = (stage: number) => Array.from({ length: stage }, (_, i) => ORDER[i % 4]);

const RULES = [
  'צפו ברצף האורות והצלילים וחזרו עליו באותו סדר.',
  'בכל שלב נוסף צבע אחד לסוף הרצף.',
  'יש 10 שלבים. כל שלב שהושלם מזכה בנקודה.',
  'טעות אחת מסיימת את המשחק.',
  'השלמת כל השלבים היא ניצחון בניקוד 10.',
  'אין מגבלת זמן לתשובה.',
];

const home = (page: Page) => page.locator('.screen--home');
const about = (page: Page) => page.locator('.screen--about');
const status = (page: Page) => page.locator('.status');
const pad = (page: Page, color: string) => page.getByRole('button', { name: LABEL[color], exact: true });
const aboutScore = (page: Page) => page.locator('.about-score__value');

async function waitFor(page: Page, phase: string) {
  await expect(home(page)).toHaveAttribute('data-phase', phase, { timeout: 15_000 });
}

const clearLit = (page: Page) => page.evaluate(() => ((window as unknown as { __lit: unknown[] }).__lit.length = 0));
const lit = (page: Page) => page.evaluate(() => (window as unknown as { __lit: (string | null)[] }).__lit);

async function answer(page: Page, stage: number) {
  for (const color of sequenceFor(stage)) await pad(page, color).click();
}

// Starts a game and completes stages 1..count.
async function playTo(page: Page, count: number) {
  await page.getByRole('button', { name: 'התחל' }).click();
  for (let stage = 1; stage <= count; stage++) {
    await waitFor(page, 'accepting');
    await answer(page, stage);
  }
}

// Each navigation waits until the screen has actually switched (hashchange is async).
async function goAbout(page: Page) {
  await page.getByRole('button', { name: 'אודות' }).click();
  await expect(about(page)).toBeVisible();
}
async function goBack(page: Page) {
  await page.getByRole('button', { name: 'חזרה למשחק' }).click();
  await expect(home(page)).toBeVisible();
}

// After a return: the same sequence is presented again in full, from the start.
async function expectReplay(page: Page, stage: number, score: number) {
  await waitFor(page, 'accepting');
  expect((await lit(page)).slice(0, stage)).toEqual(sequenceFor(stage));
  await expect(status(page)).toHaveText(`שלב ${stage} · ניקוד ${score}`);
}

test.describe('about screen', () => {
  test('before a game: score 0, all six rules in order, no horizontal overflow', async ({ page }) => {
    await page.goto('./');
    await goAbout(page);
    await expect(page).toHaveURL(/#\/about$/);
    await expect(home(page)).toBeHidden();
    await expect(page.getByRole('heading', { name: 'אודות' })).toBeVisible();
    await expect(page.getByText('הניקוד שלך')).toBeVisible();
    await expect(aboutScore(page)).toHaveText('0');
    await expect(page.getByRole('heading', { name: 'חוקי המשחק' })).toBeVisible();
    await expect(page.locator('.rules__item')).toHaveText(RULES);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const backButton = (await page.getByRole('button', { name: 'חזרה למשחק' }).boundingBox())!;
    expect(backButton.height).toBeGreaterThanOrEqual(48);
    await page.screenshot({ path: 'test-results/about-mobile.png', fullPage: true });

    await goBack(page);
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('button', { name: 'התחל' })).toBeVisible();
    await expect(status(page)).toHaveText('');
    await expect(home(page)).toHaveAttribute('data-phase', 'idle');
  });

  test('leaving mid-presentation pauses; returning replays the same sequence', async ({ page }) => {
    await page.goto('./');
    await playTo(page, 2);
    await waitFor(page, 'presenting');
    await goAbout(page);
    await expect(aboutScore(page)).toHaveText('2');
    await expect(home(page)).toHaveAttribute('data-phase', 'paused');
    // Nothing keeps playing while paused.
    await clearLit(page);
    await page.waitForTimeout(1500);
    expect(await lit(page)).toEqual([]);
    await expect(page.locator('.pad.is-active')).toHaveCount(0);

    await goBack(page);
    await expectReplay(page, 3, 2);
    await answer(page, 3);
    await waitFor(page, 'accepting');
    await expect(status(page)).toHaveText('שלב 4 · ניקוד 3');
  });

  test('leaving mid-answer drops the partial answer; browser back returns to the game', async ({ page }) => {
    await page.goto('./');
    await playTo(page, 2);
    await waitFor(page, 'accepting');
    await pad(page, 'blue').click(); // partial answer
    await goAbout(page);
    await expect(aboutScore(page)).toHaveText('2');
    await clearLit(page);
    await page.goBack();
    await expect(about(page)).toBeHidden();
    await expectReplay(page, 3, 2);
    // The answer starts over from the first item.
    await answer(page, 3);
    await waitFor(page, 'accepting');
    await expect(status(page)).toHaveText('שלב 4 · ניקוד 3');
  });

  test('rapid switching leaves one presentation and no stuck light', async ({ page }) => {
    await page.goto('./');
    await playTo(page, 2);
    await waitFor(page, 'presenting');
    for (let i = 0; i < 4; i++) {
      await goAbout(page);
      await goBack(page);
    }
    await goAbout(page);
    await clearLit(page);
    await goBack(page);
    await waitFor(page, 'accepting');
    // Exactly one presentation of the stage's three items, no extra tones.
    await page.waitForTimeout(1000);
    expect(await lit(page)).toEqual(sequenceFor(3));
    await expect(page.locator('.pad.is-active')).toHaveCount(0);
    await expect(status(page)).toHaveText('שלב 3 · ניקוד 2');
  });

  test('after a loss: about shows the final score and the result stays', async ({ page }) => {
    await page.goto('./');
    await playTo(page, 1);
    await waitFor(page, 'accepting');
    await pad(page, 'green').click(); // wrong
    await waitFor(page, 'lost');
    await goAbout(page);
    await expect(aboutScore(page)).toHaveText('1');
    await goBack(page);
    await expect(page.getByRole('heading', { name: 'המשחק נגמר' })).toBeVisible();
    await expect(page.getByText('הניקוד שלך: 1')).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(home(page)).toHaveAttribute('data-phase', 'lost');
    // A new game resets the about score too.
    await page.getByRole('button', { name: 'משחק חדש' }).click();
    await goAbout(page);
    await expect(aboutScore(page)).toHaveText('0');
  });

  test('a fresh load at the about URL opens home with score 0', async ({ page }) => {
    await page.goto('./#/about');
    await expect(home(page)).toBeVisible();
    await expect(about(page)).toBeHidden();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('button', { name: 'התחל' })).toBeVisible();
  });

  test('refresh on either screen resets to home with score 0', async ({ page }) => {
    await page.goto('./');
    await playTo(page, 2);
    await waitFor(page, 'accepting');
    await goAbout(page);
    await expect(aboutScore(page)).toHaveText('2');
    await page.reload();
    await expect(home(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('button', { name: 'התחל' })).toBeVisible();
    await expect(status(page)).toHaveText('');
    await goAbout(page);
    await expect(aboutScore(page)).toHaveText('0');

    await goBack(page);
    await page.getByRole('button', { name: 'התחל' }).click();
    await waitFor(page, 'accepting');
    await page.reload();
    await expect(page.getByRole('button', { name: 'התחל' })).toBeVisible();
    await expect(home(page)).toHaveAttribute('data-phase', 'idle');
  });

  test('hiding the page pauses the game; continue replays the same sequence', async ({ page }) => {
    // Emulated: Playwright cannot really background a page.
    const setHidden = (hidden: boolean) =>
      page.evaluate((h) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);

    await page.goto('./');
    await playTo(page, 2);
    await waitFor(page, 'presenting');
    await setHidden(true);
    await waitFor(page, 'paused');
    await clearLit(page);
    await page.waitForTimeout(1500);
    expect(await lit(page)).toEqual([]);
    await setHidden(false);

    // Still on home, with "continue" instead of "start".
    await expect(home(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'המשך' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'התחל' })).toBeHidden();
    await expect(status(page)).toHaveText('שלב 3 · ניקוד 2');
    await expect(pad(page, 'red')).toHaveCSS('opacity', '0.6');
    await page.screenshot({ path: 'test-results/home-paused.png', fullPage: true });

    await page.getByRole('button', { name: 'המשך' }).click();
    await expect(page.getByRole('button', { name: 'המשך' })).toBeHidden();
    await expectReplay(page, 3, 2);
  });
});
