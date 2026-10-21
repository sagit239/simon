# תוכנית — Milestone 5: GitHub Pages, פריסה אוטומטית ואימות במכשירים

מבוסס על ARCHITECTURE.md §1 (Hosting), §2.8, §2.10, §3 ו-ADR-6/8, על MILESTONES.md ועל הקוד הקיים אחרי Milestone 4.

## 1. גישה

- **אין שינוי באפליקציה.** המשחק, המסכים, ה-PWA וה-Base `'/simon/'` כבר מוכנים. אבן הדרך מוסיפה רק את תהליך הפריסה, תיקון קטן בהגדרת Playwright כדי שה-CI יבדוק את אותו `dist` שמתפרסם, ואימות באתר החי ובמכשירים.
- **Workflow אחד, שני Jobs:** `build` (התקנה, בדיקות, Build, Playwright על אותו `dist`, העלאת ה-Artifact) ו-`deploy` (פרסום ה-Artifact שהועלה, בלי Build נוסף). `deploy` רץ רק אם `build` הצליח — כך כשל בדיקות או Build מונע פריסה.
- **בלי Secrets ובלי Token אישי.** ההרשאות המובנות של GitHub Actions (`pages: write`, `id-token: write`) מספיקות.
- **חלוקת עבודה:** אני כותב ובודק את הקבצים מקומית. את הגדרת Pages בחשבון GitHub המשתמש מבצע בעצמו בהדרכה צעד אחר צעד. ה-Push (שמפעיל את הפריסה) מתבצע **רק אחרי אישור מפורש** של המשתמש, לפי CLAUDE.md. הבדיקות במכשירים האמיתיים נעשות על ידי המשתמש לפי רשימה (§6), ואני מתעד את התוצאות.

## 2. קבצים ליצירה / שינוי

| קובץ | שינוי |
|---|---|
| `.github/workflows/deploy.yml` (חדש) | ה-Workflow (ראה §3) |
| `playwright.config.ts` | ב-CI שרת הבדיקות מריץ רק `npm run preview` על ה-`dist` הקיים, בלי Build נוסף; `forbidOnly` ב-CI (ראה §4) |
| `package.json` | אין צורך בתלויות חדשות. ייתכן סקריפט `preview` נשאר כמו שהוא |
| `index.html` | שינוי בלתי נראה אחד לבדיקת עדכון גרסה (ראה §5), רק בשלב בדיקת העדכון |
| `spec/ARCHITECTURE.md` | ADRs לפי §8 |
| `CLAUDE.md` | עדכון ״פקודות הרצה״: כתובת האתר החי והערה שכל Push ל-`main` מפרסם |
| `spec/MILESTONES.md` | סימון 🟡 בסיום |

## 3. ה-Workflow — `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:          # manual re-run from the Actions tab

permissions:
  contents: read

concurrency:
  group: pages
  cancel-in-progress: false   # never cut a deployment in the middle

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      CI: true
    steps:
      - uses: actions/checkout@<major>
      - uses: actions/setup-node@<major>
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx vitest run
      - run: npx vite build
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test          # serves the same dist via vite preview
      - uses: actions/upload-pages-artifact@<major>
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@<major>
```

- **גרסאות ה-Actions:** רק Actions רשמיים של GitHub, בגרסה ראשית קבועה (`@vN`). בזמן הבנייה אוודא מה הגרסה הראשית העדכנית של כל אחד (`checkout`, `setup-node`, `upload-pages-artifact`, `deploy-pages`) ואקבע אותה.
- **הסדר** תואם בדיוק את ARCHITECTURE.md §3: `npm ci` → `tsc --noEmit` → `vitest run` → `vite build` → Playwright על אותו `dist` → `upload-pages-artifact` → `deploy-pages`.
- **ה-Artifact שמתפרסם הוא אותו `dist` שנבדק.** אין שלב Build ב-Job של הפריסה.
- **כשל:** כל שלב שנכשל עוצר את `build`, ולכן `deploy` לא רץ והאתר הקודם נשאר באוויר.
- **Concurrency אחד** (`pages`): פריסות מסודרות בתור; פריסה רצה אינה נקטעת.
- **חזרה לגרסה קודמת:** `git revert` ו-Push ל-`main` (לפי הארכיטקטורה). לא נדרש קוד נוסף.

## 4. התאמת Playwright ל-CI

היום `webServer.command` הוא `npm run build && npm run preview` — כלומר Playwright בונה בעצמו. ב-CI זה היה יוצר Build שני, בניגוד לדרישה.

```ts
const isCI = !!process.env.CI;

webServer: {
  // In CI the dist was already built by the previous step and is the exact
  // artifact that gets deployed, so only serve it.
  command: isCI ? 'npm run preview' : 'npm run build && npm run preview',
  ...
},
forbidOnly: isCI,
```

- מקומית שום דבר לא משתנה (`npm run test:e2e` ממשיך לבנות ולבדוק).
- אם בדיקות ה-Offline / התזמונים יתגלו כלא יציבות ב-Runner של GitHub, אפשר להגביל ל-`workers: 1` ב-CI. לא נוסיף Retries שמסתירים כשלים, אלא אם יתברר שיש בעיה אמיתית בסביבת ה-CI — ואז אתעד ב-ADR.

## 5. בדיקת עדכון גרסה

ה-DoD דורש שאחרי פריסת גרסה חדשה, פתיחה מחדש של האתר תקבל אותה בלי למחוק Cache. ה-Worker מוגדר `registerType: 'prompt'` בלי `skipWaiting` (ADR-8): הגרסה החדשה נכנסת כשכל החלונות של האתר נסגרו ונפתחו מחדש.

- **שינוי לבדיקה:** אחרי הפריסה הראשונה, פריסה שנייה עם שינוי בלתי נראה ב-`index.html` — הערת HTML עם מספר גרסה (למשל `<!-- build 2 -->`). זה משנה את ה-Precache ומפעיל עדכון, בלי להוסיף שום דבר לממשק. (בחירת מימוש: שום דבר במסך לא משתנה.)
- **אימות אוטומטי שלי (בדפדפן המובנה, מחשב):** פתיחת האתר החי, המתנה להכנת Offline, פריסת הגרסה השנייה, סגירת הלשונית ופתיחה מחדש (פעמיים אם צריך — פעם להורדת ה-Worker החדש ופעם לכניסתו) → ה-HTML שמוגש מכיל את ההערה החדשה.
- **במכשירים:** המשתמש סוגר את האפליקציה המותקנת לגמרי (גם מרשימת האפליקציות הפתוחות), פותח שוב (פעמיים אם צריך), ומוודא שהמשחק עובד. אני אאמת מצדי שהגרסה התחלפה. מגבלה ידועה: אם האפליקציה לא נסגרת לגמרי במכשיר, הגרסה הישנה נשארת עד הסגירה המלאה — זו ההתנהגות המכוונת (לא קוטעים משחק רץ).

## 6. צעדי ההדרכה למשתמש והבדיקות במכשירים

### א. הגדרת GitHub Pages (המשתמש, פעם אחת, לפני ה-Push)
1. לוודא שה-Repository `sagit239/simon` ציבורי (Settings → General → Danger Zone → Visibility).
2. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. אין צורך ב-Secrets, Tokens או דומיין מותאם.

### ב. Push ראשון (באישור המשתמש)
- Commit של קובצי אבן הדרך ו-Push ל-`main` → מעקב אחר ה-Workflow בלשונית Actions (אני בודק דרך `gh run watch` / `gh run view`).
- הכתובת הצפויה: `https://sagit239.github.io/simon/`.
- **בדיקת חסימה (חובה ב-DoD):** ה-Workflow רץ רק על `main`, ולא נדחוף קוד שבור ל-`main` רק כדי להדגים כשל. במקום זה: אציג שהמבנה עצמו מבטיח זאת (`deploy` תלוי ב-`build`), ואבדוק מקומית ש-`npx playwright test` עם `CI=true` מחזיר שגיאה כשהבדיקה נכשלת. אם המשתמש ירצה הוכחה חיה — אפשר להריץ ידנית (`workflow_dispatch`) מענף זמני, באישורו.

### ג. אימות האתר החי (אני, בדפדפן המובנה)
- HTTPS ונתיב `/simon/`; Manifest, אייקונים ו-Worker מתוך `/simon/` עם Scope `/simon/`.
- בית ואודות, משחק שלם (ניצחון וכישלון), חוקים, ניקוד, רענון בכל מסך, טעינה חדשה ב-`#/about`.
- Offline: המתנה להכנה, ניתוק רשת, טעינה מחדש ומשחק.
- אין בקשות למקורות חיצוניים.

### ד. בדיקה ידנית של המשתמש ב-Android וב-iPhone אמיתיים
אמסור רשימה קצרה בשפה פשוטה, ואתעד תוצאה לכל סעיף (עבר / נכשל / לא נבדק):
1. פתיחת הכתובת, משחק קצר — ארבעת הצלילים נשמעים ושונים זה מזה, האור והצליל יחד, המגע מגיב, הטקסט קריא מימין לשמאל.
2. **התקנה:** Android (Chrome) → תפריט ⋮ → ״התקנת אפליקציה״ / ״הוספה למסך הבית״. iPhone (Safari) → כפתור השיתוף → ״הוסף למסך הבית״.
3. פתיחה מהאייקון — נפתח בלי שורת כתובת (Standalone).
4. **Offline:** אחרי פתיחה אחת עם רשת — מצב טיסה, סגירה מלאה ופתיחה מהאייקון → המשחק נטען ועובד, כולל אודות.
5. **נעילה ורקע:** באמצע הצגת רצף — נעילת המסך / מעבר לאפליקציה אחרת וחזרה → אין צליל או אור שממשיכים, מופיע ״המשך״, השלב והניקוד נשמרו, ״המשך״ מציג שוב את אותו רצף.
6. **עדכון גרסה:** לפי §5.

אמולציה בדפדפן לא תוצג כהוכחה לבדיקה במכשיר אמיתי. סעיף שהמשתמש לא יוכל לבדוק יסומן ״לא נבדק״, ואבן הדרך לא תיחשב שלמה עד שיאומת או שהמשתמש יחליט אחרת.

## 7. סקירה סופית מול PRD.md ו-DESIGN.md
- שני מסכים בלבד; מראה תואם ל-Mockups באתר החי (צילום מסך במובייל לשני המסכים).
- ללא Backend, Database, היסטוריה, Analytics או בקשות רשת בזמן המשחק אחרי הכנת Offline.
- מסירה למשתמש: כתובת האתר, קישור ל-Repository, סיכום כל הבדיקות, מגבלות ידועות (למשל: עדכון נכנס רק אחרי סגירה מלאה; בכניסה ראשונה בלי רשת האתר לא ייטען — לפי ה-PRD).

## 8. החלטות שיתועדו כ-ADR (בזמן הבנייה)
- **ADR-9: Playwright ב-CI מגיש את ה-`dist` הקיים** — זיהוי `CI` בהגדרת Playwright כדי שה-Artifact שנבדק הוא זה שמתפרסם; מקומית נשאר Build + Preview.
- **ADR-10: בדיקת עדכון גרסה בשינוי בלתי נראה** — הערת HTML ב-`index.html`, והוכחת החלפת הגרסה בצד שלי (אם ההחלטה תיושם).
- ADR נוסף רק אם יתגלה צורך (למשל `workers: 1` או התאמה אחרת ל-Runner של GitHub).

## 9. סדר העבודה בבנייה
1. בדיקת הגרסאות הראשיות העדכניות של ה-Actions הרשמיים.
2. כתיבת `deploy.yml` ועדכון `playwright.config.ts`.
3. הרצה מקומית של הרצף המלא כמו ב-CI (`npm ci` → `tsc` → `vitest` → `vite build` → `CI=true playwright test`), ובדיקה ש-Playwright לא בונה מחדש.
4. **עצירה:** הדרכת המשתמש בהגדרת Pages (§6א) ובקשת אישור ל-Push.
5. Push, מעקב אחר ה-Workflow עד פריסה מוצלחת.
6. אימות האתר החי בדפדפן המובנה (§6ג).
7. **עצירה:** מסירת רשימת הבדיקות במכשירים למשתמש (§6ד) והמתנה לתוצאות.
8. פריסה שנייה לבדיקת עדכון (§5) — Push נוסף, גם הוא באישור המשתמש.
9. תיעוד התוצאות, ADRs, עדכון `CLAUDE.md`, סקירה סופית (§7) וסימון 🟡.

## 10. מיפוי ל-Definition of Done

| תנאי | איך מאומת |
|---|---|
| הקוד וה-lockfile ב-GitHub | `git ls-files` ו-Push מוצלח; קישור ל-Repository |
| Push ל-`main` מפעיל Pipeline מוצלח ומפרסם את אותו Artifact, בלי Build נוסף | ריצה ירוקה ב-Actions; מבנה ה-Workflow ו-ADR-9 |
| כשל מונע פריסה; אין Secrets או Token | `needs: build` במבנה; בדיקה מקומית שכשל מחזיר שגיאה; ה-Workflow ללא `secrets.*` |
| האתר החי ב-HTTPS וב-Base הנכון; מסכים, משחק, חוקים, ניקוד ורענון | §6ג בדפדפן המובנה |
| התקנה, Standalone ו-Offline ב-Android וב-iPhone אמיתיים | §6ד סעיפים 2–4 (המשתמש) |
| צלילים, מגע, RTL, נעילה וחזרה מרקע במכשירים | §6ד סעיפים 1, 5 (המשתמש) |
| גרסה חדשה מתקבלת בפתיחה מחדש בלי מחיקת Cache | §5 |
| סקירה סופית מול PRD ו-DESIGN | §7 |
| מסירה: כתובת, Repository, סיכום, מגבלות; עצירה לסקירה | סיכום הבנייה |

## 11. מחוץ לתחום
- דומיין מותאם, Analytics, ניטור, Pull Requests או סביבת Staging.
- כפתור / Dialog עדכון, חיווי Offline במסך, שינויים במשחק או בעיצוב (אלא אם בדיקות המכשירים יחשפו באג — אז תיקון במסגרת אבן הדרך).
- בדיקות אוטומטיות ב-Safari / WebKit (לפי הארכיטקטורה — iPhone נבדק ידנית).
