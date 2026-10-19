# תוכנית — Milestone 4: משחק מותקן ופעולה ב-Offline

מבוסס על PRD.md (PWA ו-Offline, Edge Cases), ARCHITECTURE.md §2.8 ו-ADR-1, MILESTONES.md, ועל הקוד הקיים אחרי Milestone 3.

## 1. גישה

- **התוסף עושה את העבודה.** `vite-plugin-pwa` במצב `generateSW` יוצר בזמן ה-Build את ה-Manifest ואת ה-Service Worker עם רשימת Precache מלאה. אין Worker שנכתב ידנית ואין לוגיקת רשת מותאמת.
- **אותו Base בכל מקום.** ה-Base הקיים `'/simon/'` (ב-`vite.config.ts`) משמש ל-Manifest, ל-`id` / `start_url` / `scope`, לקישורי האייקונים, לרישום ה-Worker ול-Navigation Fallback. ה-Worker נוצר בשורש `dist` ולכן מוגש ב-`/simon/sw.js`, וה-Scope שלו הוא `/simon/` בלבד.
- **בלי שינוי בלוגיקת המשחק.** ה-Engine, ה-Controller, ה-Views והניווט אינם משתנים. מצב המשחק נשאר בזיכרון בלבד; ה-Cache מכיל קובצי אתר בלבד.
- **בלי ממשק חדש.** אין מסך התקנה, אין Dialog עדכון ואין חיווי ״מוכן ל-Offline״ על המסך — ה-PRD וה-DESIGN אינם מגדירים כאלה. מעקב המוכנות הוא פנימי (ראה §5).
- **עדכון בלי רענון כפוי.** `registerType: 'prompt'` בלי לקרוא לפונקציית העדכון: Worker חדש ממתין, והגרסה החדשה נכנסת בפתיחה הבאה של האתר.

## 2. קבצים ליצירה / שינוי

| קובץ | שינוי |
|---|---|
| `package.json` / `package-lock.json` | Dev Dependencies: `vite-plugin-pwa` 2.0.0, `workbox-window` 7.4.1 (נדרש לרישום), ו-`@vite-pwa/assets-generator` 2.0.0 (ליצירת האייקונים פעם אחת). סקריפט `icons` להרצה ידנית של המחולל |
| `vite.config.ts` | הוספת `VitePWA({...})` (ראה §3) |
| `public/icon.svg` (חדש) | קובץ מקור לאייקון (ראה §4) |
| `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/maskable-icon-512x512.png`, `public/apple-touch-icon-180x180.png`, `public/favicon.ico` (חדשים) | אייקונים שנוצרים מה-SVG ונשמרים ב-Git |
| `pwa-assets.config.ts` (חדש) | הגדרת המחולל (Preset `minimal-2023`, רקע אייקון Maskable / Apple בצבע ה-Charcoal) |
| `index.html` | קישורי `apple-touch-icon` ו-`icon` (favicon) עם הנתיב היחסי ל-Base. ה-Manifest מוזרק אוטומטית על ידי התוסף |
| `src/app/pwa.ts` (חדש) | רישום ה-Worker ומעקב מוכנות ל-Offline (ראה §5) |
| `src/main.ts` | קריאה אחת ל-`registerPwa()` |
| `tsconfig.json` | הוספת `vite-plugin-pwa/client` ל-`types` (טיפוסים ל-`virtual:pwa-register`) |
| `e2e/offline.spec.ts` (חדש) | בדיקות Manifest, Scope ו-Offline (ראה §6) |
| `e2e/*.spec.ts` הקיימים | ללא שינוי, אלא אם ה-Worker הפעיל משבש בדיקה קיימת |
| `CLAUDE.md` | עדכון ״פקודות הרצה״: הערה שה-Worker פעיל רק ב-Build / Preview ולא ב-`npm run dev` |
| `spec/ARCHITECTURE.md` | ADRs לפי §7 |
| `spec/MILESTONES.md` | סימון 🟡 בסיום הבנייה |

## 3. הגדרת `vite-plugin-pwa`

```ts
VitePWA({
  registerType: 'prompt',
  injectRegister: false,          // registration is done in src/app/pwa.ts
  includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
  manifest: {
    id: '/simon/',
    name: 'סיימון',
    short_name: 'סיימון',
    description: 'משחק זיכרון של רצף אורות וצלילים',
    lang: 'he',
    dir: 'rtl',
    display: 'standalone',
    start_url: '/simon/',
    scope: '/simon/',
    theme_color: '#F5F5F2',
    background_color: '#F5F5F2',
    icons: [ /* 192, 512, maskable 512 (purpose: 'maskable') */ ],
  },
  workbox: {
    cacheId: 'simon',                       // project-unique cache prefix
    globPatterns: ['**/*.{html,js,css,woff2,png,svg,ico,webmanifest}'],
    navigateFallback: 'index.html',         // resolved under the /simon/ base
    navigateFallbackAllowlist: [/^\/simon\//],
    cleanupOutdatedCaches: true,
    // skipWaiting / clientsClaim stay false: a new version never takes over a running game.
  },
})
```

- **גופן:** `@fontsource/heebo` מוציא גם `woff2` וגם `woff`. דפדפנים מודרניים טוענים רק `woff2`, ולכן רק הוא נכלל ב-Precache (חוסך נפח). אם בבדיקת ה-Offline יתברר שגופן נטען מהרשת — נוסיף גם `woff`.
- **Workbox Runtime** נכלל מקומית בתוך `sw.js` / `workbox-*.js` שה-Build יוצר; אין טעינה מ-CDN.
- **ב-Dev** ה-Worker כבוי (ברירת המחדל של התוסף), כדי לא לשבש את שרת הפיתוח.

## 4. אייקונים

ה-Spec מגדיר את הגדלים (192, 512, Maskable, Apple Touch) אך לא את המראה. לפי כללי MILESTONES.md, פרט חזותי שלא הוגדר יושלם במינימום ובסגנון הקיים, ויוצג כבחירת מימוש:

- **מראה:** ריבוע Charcoal ‏(`#181A1B`) ועליו ארבעה ריבועים מעוגלים בצבעי המשחק, באותם מיקומים של הלוח: כחול ימין למעלה, אדום שמאל למעלה, צהוב ימין למטה, ירוק שמאל למטה. ללא טקסט.
- **Maskable:** אותו ציור עם שוליים רחבים יותר (Safe Zone), כדי שלא ייחתך במסכות עגולות של Android.
- **יצירה:** ה-SVG נכתב ידנית; `npm run icons` מריץ את `@vite-pwa/assets-generator` ויוצר את קובצי ה-PNG ל-`public/`. הקבצים נשמרים ב-Git, וה-Build הרגיל אינו מריץ את המחולל.

## 5. רישום ה-Worker ומעקב מוכנות (`src/app/pwa.ts`)

```ts
import { registerSW } from 'virtual:pwa-register';

export function registerPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    // Fired only after the worker installed and the full precache succeeded.
    onOfflineReady: () => { document.documentElement.dataset.offlineReady = 'true'; },
    onRegisterError: () => { /* site keeps working online; not marked ready */ },
  });
  // onNeedRefresh is intentionally not handled: the new version loads on next open.
}
```

- **מוכנות = הצלחת התקנת ה-Worker וה-Precache** (`onOfflineReady`), לא `navigator.onLine`.
- **כשל:** אם ה-Precache נכשל, ההתקנה נכשלת, `onOfflineReady` לא נקרא, והסימון לא נוסף. המשחק שכבר נטען ממשיך לעבוד כרגיל. שום הודעה לא מוצגת כהצלחה.
- הסימון `data-offline-ready` על `<html>` אינו נראה למשתמש; הוא משמש את בדיקות הדפדפן כדי לדעת מתי מותר לנתק רשת.
- כשל ברישום (למשל דפדפן ללא תמיכה) אינו זורק שגיאה ואינו משפיע על המשחק.

## 6. בדיקות

### Playwright — `e2e/offline.spec.ts` (על ה-Build, ב-`localhost:4173/simon/`, שמדמה את נתיב ה-Production)

כל תרחיש רץ ב-Browser Context חדש ומבודד של Playwright (ברירת המחדל), עם Service Workers פעילים (`serviceWorkers: 'allow'`, ברירת המחדל).

1. **Manifest ואייקונים:** ה-`<link rel="manifest">` מצביע לתוך `/simon/`; ה-Manifest נטען (200) עם `lang: he`, `dir: rtl`, `display: standalone`, ו-`id` / `start_url` / `scope` בתוך `/simon/`; כל אייקון בו, וגם ה-Apple Touch Icon, נטענים בהצלחה מתוך `/simon/`.
2. **Scope:** אחרי `navigator.serviceWorker.ready` — `registration.scope` שווה ל-`http://localhost:4173/simon/`.
3. **מוכנות:** ממתינים ל-`data-offline-ready="true"` ול-`navigator.serviceWorker.ready`; טוענים מחדש פעם אחת ברשת ומוודאים שהדף נשלט על ידי ה-Worker (`navigator.serviceWorker.controller`).
4. **טעינה ב-Offline:** `context.setOffline(true)` → `page.reload()` → הבית נטען (כותרת ״סיימון״, ארבעה כפתורים, ״התחל״), והגופן Heebo נטען (`document.fonts.check`).
5. **משחק מלא ב-Offline:** עם `Math.random` נשלט (ADR-3) ותיעוד הצלילים (ההחלפה הקיימת של `AudioContext`): התחלה, השמעת צלילים, ניצחון עד ניקוד 10; ״משחק חדש״ ומשחק עד כישלון.
6. **אודות ב-Offline:** מעבר לאודות באמצע משחק — הניקוד והחוקים מוצגים; ״חזרה למשחק״ מציג שוב את אותו רצף; ״משחק חדש״ מתחיל שלב 1.
7. **רענון ב-Offline:** באמצע משחק ובכתובת `#/about` — הרענון מחזיר לבית עם ״התחל״ וניקוד 0 באודות.
8. **Cache נקי מנתוני משחק:** קריאת כל המפתחות ב-Cache Storage: כל ה-Caches מתחילים ב-`simon`, וכל רשומה היא קובץ אתר תחת `/simon/` (HTML / JS / CSS / גופן / אייקון / Manifest). אין רשומות אחרות; Local/Session Storage ריקים.
9. **אין משאבים חיצוניים:** תיעוד כל הבקשות בטעינה ובמשחק — כולן ל-`localhost:4173`.

### בדיקות קיימות

- Vitest: ללא שינוי, חייב לעבור.
- Playwright הקיים (בית, משחק, אודות): חייב לעבור כש-Worker פעיל. אם Worker שנשאר מבדיקה קודמת מפריע — כל בדיקה כבר רצה ב-Context נפרד, כך שלא צפוי שיבוש.
- `npm run build` (כולל `tsc --noEmit`) עובר, ותיקיית `dist` מכילה `manifest.webmanifest`, `sw.js` ו-`workbox-*.js`.

### בדיקה ידנית שלי (Claude) לפני סימון 🟡

- פתיחת ה-Preview בדפדפן המובנה: בדיקת Manifest ו-Worker, ניתוק רשת ובדיקה חזותית שהמסכים נראים זהים ל-Online (כולל הגופן).
- התקנה בפועל במכשיר אמיתי אינה חלק מאבן דרך זו — תיבדק באתר החי באבן דרך 5.

## 7. החלטות שיתועדו כ-ADR (בזמן הבנייה)

- **ADR-7: אייקון האפליקציה** — עיצוב ארבעת הריבועים על רקע Charcoal, ויצירתו מ-SVG באמצעות `@vite-pwa/assets-generator` (קבצים שמורים ב-Git).
- **ADR-8: מעקב מוכנות ל-Offline** — `onOfflineReady` כמקור האמת, סימון פנימי `data-offline-ready` לבדיקות, ללא חיווי במסך; Precache של `woff2` בלבד.

## 8. סדר העבודה בבנייה

1. התקנת התלויות ועדכון `package-lock.json`.
2. כתיבת `icon.svg`, `pwa-assets.config.ts`, יצירת האייקונים ובדיקה חזותית שלהם.
3. הגדרת `VitePWA` ב-`vite.config.ts`, קישורים ב-`index.html`, עדכון `tsconfig.json`.
4. `src/app/pwa.ts` וחיבור ב-`main.ts`.
5. `npm run build` ובדיקת תוכן `dist` (Manifest, Worker, רשימת Precache כוללת גופנים ואייקונים).
6. כתיבת `e2e/offline.spec.ts` והרצת כל הבדיקות (Vitest + Playwright).
7. בדיקה ידנית ב-Preview בדפדפן המובנה, Online ו-Offline.
8. ADRs, עדכון `CLAUDE.md`, סימון 🟡 ב-MILESTONES.md וסגירת השרתים.

## 9. מיפוי ל-Definition of Done

| תנאי | איך מאומת |
|---|---|
| Manifest ואייקונים נטענים מה-Base; ה-Worker מוגבל ל-Scope | בדיקות 1–2 |
| טעינה ראשונה → Precache ושליטת Worker → ניתוק → טעינה מחדש מצליחה | בדיקות 3–4, Context מבודד, על Build אמיתי |
| ב-Offline: התחלה וסיום, צלילים, חוקים וניקוד, חזרה ומשחק חדש | בדיקות 5–6 |
| רענון ב-Offline מאפס; Cache ללא ניקוד / רצפים / היסטוריה | בדיקות 7–8 |
| אין משאבי Runtime חיצוניים | בדיקה 9 |
| Playwright Offline עם Worker פעיל; משחק, ניווט, Type Checking ו-Build עוברים | הרצת `npm test` ו-`npm run test:e2e` במלואם |

## 10. מחוץ לתחום

- פריסה ל-GitHub Pages, Workflow ובדיקות במכשירים אמיתיים (אבן דרך 5).
- מסך / כפתור התקנה, Dialog עדכון, חיווי Offline במסך.
- שמירת משחק, ניקוד או היסטוריה בכל צורה.
