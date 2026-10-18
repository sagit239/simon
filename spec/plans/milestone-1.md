# תוכנית — Milestone 1: בסיס פרויקט ומסך בית מעוצב

מבוסס על `MILESTONES.md` (Milestone 1), `ARCHITECTURE.md` סעיפים 1, 2.2–2.3, ו-`DESIGN.md` סעיפים 1.1, 2.

## 0. דרישה מקדימה (פעולה של המשתמש)

Node.js **לא מותקן** כרגע במחשב. לפני הבנייה המשתמש מתקין את **Node.js 24 LTS** (Windows Installer מ-nodejs.org), בהדרכה צעד אחר צעד. npm מגיע איתו. אחרי ההתקנה Claude מוודא עם `node -v` ו-`npm -v`.

## 1. גישה

- הפרויקט מוקם **ידנית** (בלי `npm create vite`, שלא עובד טוב בתיקייה שאינה ריקה), עם המבנה של תבנית `vanilla-ts`.
- התקנת תלויות עם `--save-exact`, כדי שהגרסאות יהיו קבועות ב-`package.json` וב-`package-lock.json`. נבחרות הגרסאות היציבות העדכניות שזמינות בזמן ההתקנה.
- `base: '/simon/'` ב-Vite כבר עכשיו, כדי שהנתיבים יתאימו ל-GitHub Pages (`sagit239.github.io/simon/`). לכן שרת הפיתוח נפתח בכתובת `http://localhost:5173/simon/`.
- **גופן:** Heebo נכלל מקומית דרך החבילה `@fontsource/heebo`, במשקלים 400 ו-700. הגופן נארז עם האתר, ואין טעינה מ-Google Fonts. (החלטה זו תתועד כ-ADR-1.)
- נבנים רק הקבצים שנחוצים עכשיו. Engine, Controller, Playback, Audio ו-Navigation יתווספו באבני הדרך 2–3, כשיהיה להם תוכן אמיתי. המבנה המתוכנן מתועד בסעיף 3.

## 2. קבצים ליצירה / שינוי

| קובץ | תוכן |
|---|---|
| `package.json` | `"type": "module"`, `engines: { node: ">=24" }`, סקריפטים (ראה סעיף 4) |
| `package-lock.json` | נוצר בהתקנה |
| `tsconfig.json` | `strict: true`, `noEmit`, `moduleResolution: "bundler"`, `target/lib: ES2022 + DOM`, כולל `src`, `e2e` והגדרות |
| `vite.config.ts` | `base: '/simon/'`; הגדרת Vitest (`include: ['src/**/*.test.ts']`, סביבה `node`) |
| `playwright.config.ts` | תיקייה `e2e`; `webServer` שמריץ `npm run build && npm run preview` על פורט 4173; `baseURL: http://localhost:4173/simon/`; פרויקט יחיד: Chromium עם `devices['Pixel 7']` |
| `index.html` | `lang="he"`, `dir="rtl"`, `viewport` עם `viewport-fit=cover`, `<title>סיימון</title>`, `theme-color` בצבע Surface, `<div id="app">` ו-`<script type="module" src="/src/main.ts">` |
| `src/main.ts` | ייבוא הגופן וקובצי ה-CSS, ורינדור מסך הבית לתוך `#app` |
| `src/config.ts` | קבועי המשחק (`STAGE_COUNT = 10`, `LIGHT_MS = 500`, `GAP_MS = 250`) ו-`PADS`: רשימה מסודרת של ארבעת הצבעים (`id`, תווית בעברית) בסדר: blue, red, yellow, green |
| `src/views/home.ts` | בניית מסך הבית ב-DOM (`createElement` + `textContent`, בלי `innerHTML`) |
| `src/styles/tokens.css` | CSS Custom Properties: צבעים, טיפוגרפיה, Radius, Spacing, Shadow, Stroke מתוך DESIGN.md |
| `src/styles/app.css` | Reset בסיסי, Layout, Header, לוח, כפתורים |
| `src/config.test.ts` | בדיקת Vitest ראשונה |
| `e2e/home.spec.ts` | בדיקת Playwright ראשונה |
| `.gitignore` | הוספת `node_modules/`, `dist/`, `test-results/`, `playwright-report/` (בלי לגעת בשורות קיימות) |
| `CLAUDE.md` | מילוי "פקודות הרצה": `npm run dev`, `npm test` |
| `spec/ARCHITECTURE.md` | הוספת `## החלטות מרכזיות (ADRs)` עם ADR-1 (גופן מקומי) |
| `spec/MILESTONES.md` | סימון 🟡 ליד Milestone 1 בסיום |

## 3. מבנה התיקיות המתוכנן (לאבני הדרך הבאות)

```
src/
  main.ts            — M1
  config.ts          — M1
  views/home.ts      — M1   (views/about.ts — M3)
  styles/            — M1
  game/engine.ts     — M2   (State Machine טהור)
  game/sequence.ts   — M2
  app/controller.ts  — M2
  app/playback.ts    — M2
  app/audio.ts       — M2
  app/navigation.ts  — M3
  pwa.ts             — M4
e2e/                 — בדיקות Playwright
```

## 4. סקריפטים ב-package.json

| סקריפט | פקודה |
|---|---|
| `dev` | `vite` |
| `typecheck` | `tsc --noEmit` |
| `build` | `tsc --noEmit && vite build` |
| `preview` | `vite preview --port 4173 --strictPort` |
| `test` | `vitest run` |
| `test:e2e` | `playwright test` |

תלויות: `@fontsource/heebo` (רגילה); `vite`, `typescript`, `vitest`, `@playwright/test` (פיתוח). בנוסף `npx playwright install chromium` (מוריד דפדפן בדיקות, פעם אחת).

## 5. מסך הבית — מבנה ועיצוב

**מבנה DOM:**
```
<main class="screen">
  <header class="header">
    <h1>סיימון</h1>
    <button class="btn-secondary">אודות</button>
  </header>
  <div class="board">            ← 4 × <button class="pad pad--blue|red|yellow|green">כחול…</button>
  <div class="actions">
    <button class="btn-primary">התחל</button>
  </div>
</main>
```
- הכפתורים ״אודות״, ״התחל״ והצבעים עדיין לא עושים כלום. הם מחוברים באבני הדרך 2–3.
- שורת מונה ההתקדמות לא נבנית עכשיו. היא מתווספת באבן דרך 2.

**Layout:**
- עמודה אחת ממורכזת, ברוחב מרבי של כ-480px, עם ריפוד של 16px בצדדים ו-`env(safe-area-inset-*)`.
- Header: Flex, הכותרת מימין והכפתור משמאל (סדר טבעי ב-RTL), עם קו הפרדה דק מתחת.
- לוח: `display: grid; grid-template-columns: 1fr 1fr; gap: 16px;` כל כפתור `aspect-ratio: 1`. סדר ה-DOM blue, red, yellow, green ב-RTL ממקם את הכחול מימין למעלה. בדיקת Playwright מוודאת את המיקום בפועל.
- ״התחל״ ברוחב הלוח, 24–32px מתחתיו.

**גימור (לפי ה-Mockup וה-Style Guide):**
- Pad: צבע הבסיס, `border-radius: 16px`, מעטפת Charcoal (`border` כהה + `box-shadow` חיצוני), Gradient עדין מהבסיס לגוון כהה מעט, והברקה רכה בפינה העליונה (`::before` עם Gradient לבן שקוף). התווית בצבע Text, מודגשת וממורכזת.
- מצב Active (`.pad.is-active`) מוגדר כבר ב-CSS, עם הבהרה ו-Glow בגוון הכפתור. בשימוש רק מאבן דרך 2.
- Primary: רקע Charcoal, טקסט לבן 18px/700, Radius 16px, Gradient/הברקה עדינים.
- Secondary: רקע בהיר, קו 2px Charcoal, טקסט כהה 18px/700, Radius כ-8–12px כמו ב-Mockup.
- כל כפתור בגובה של 48px לפחות.
- רקע המסך Surface `#F5F5F2`.

## 6. בדיקות

**Vitest (`src/config.test.ts`):**
- `PADS` מכיל בדיוק 4 צבעים ייחודיים בסדר blue, red, yellow, green, עם התוויות כחול, אדום, צהוב, ירוק.
- הקבועים: 10 שלבים, 500 ו-250 מילישניות.

**Playwright (`e2e/home.spec.ts`), על Build אמיתי (`vite preview`), במובייל:**
1. הדף נטען, יש `lang="he"` ו-`dir="rtl"`, וקיימים הכותרת ״סיימון״, ״אודות״ ו״התחל״.
2. ארבע תוויות הצבעים מופיעות.
3. מיקומים לפי Bounding Box: כחול ימין-למעלה, אדום שמאל-למעלה, צהוב ימין-למטה, ירוק שמאל-למטה.
4. כל הכפתורים בגובה וברוחב של 48px לפחות.
5. אין גלילה אופקית (`scrollWidth <= clientWidth`), וכל הכפתורים בתוך ה-Viewport ברוחבו.
6. אין בקשות רשת למקור חיצוני (מאזינים ל-`request` ומוודאים שכולן ל-`localhost`).
7. צילום מסך נשמר לבדיקה חזותית ידנית של Claude מול ה-Mockup (לא השוואת פיקסלים אוטומטית).

## 7. סדר העבודה בבנייה

1. אימות Node.js ו-npm.
2. יצירת `package.json`, התקנת תלויות, `npx playwright install chromium`.
3. קובצי הגדרה: `tsconfig`, `vite.config`, `playwright.config`, `.gitignore`.
4. `index.html`, `config.ts`, `tokens.css`, `app.css`, `home.ts`, `main.ts`.
5. בדיקות Vitest ו-Playwright.
6. הרצה: `npm ci`, `npm run typecheck`, `npm run build`, `npm test`, `npm run test:e2e`.
7. בדיקה חזותית של צילום המסך מול `mockups.png`, ותיקון פערים.
8. ADR-1, פקודות הרצה ב-CLAUDE.md, ו-🟡 ב-MILESTONES.md. סגירת שרתים. בלי commit.

## 8. מיפוי ל-Definition of Done

| תנאי | איך מאומת |
|---|---|
| `npm ci`, `tsc --noEmit`, `vite build` מצליחים | הרצת הפקודות (שלב 6) |
| Vitest ו-Playwright רצים; בדיקת הבית ו-4 התוויות | `npm test`, `npm run test:e2e` (בדיקות 1–2) |
| בדיקה חזותית במובייל, ללא גלילה אופקית או חיתוך | בדיקה 5 + צילום מסך מול ה-Mockup |
| מיקום הצבעים נכון ולא מתהפך ב-RTL | בדיקה 3 |
| כפתורים ≥ 48px, טקסטים בעברית, בלי מסגרת טלפון | בדיקה 4 + סקירת הקוד |
| אין Scripts או גופנים חיצוניים; קבצים ו-lockfile ב-Git | בדיקה 6; `git status` מציג את `package-lock.json` כקובץ שאינו מוחרג |
