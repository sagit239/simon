# תוכנית — Milestone 2: משחק מלא מהתחלה ועד תוצאה ומשחק חדש

מבוסס על `MILESTONES.md` (Milestone 2), `PRD.md` סעיפים 3–4, `ARCHITECTURE.md` סעיפים 2.2, 2.4–2.6, 4, ו-`DESIGN.md` סעיף 1.1.

## 1. גישה

- **Engine טהור** (`src/game/engine.ts`): פונקציות שמקבלות מצב ואירוע ומחזירות מצב חדש. בלי DOM, אודיו או טיימרים. ההגרלה מקבלת פונקציית Random כפרמטר (ברירת מחדל `Math.random`), כדי שהבדיקות ישלטו בה.
- **Controller יחיד** (`src/app/controller.ts`): מחזיק את ה-State, מעביר אירועים ל-Engine, ומפעיל Playback, אודיו ועדכון תצוגה. הוא מקבל את ה-View, ה-Audio וה-Playback כממשקים, כך שאפשר לבדוק אותו ב-Vitest בלי דפדפן.
- **Playback** (`src/app/playback.ts`): מציג רצף בעזרת `setTimeout` שרשורי (פריט אחרי פריט), ולא מתזמן מראש את כל הרצף. כל ריצה מקבלת `runId`; ביטול מנקה טיימרים, מכבה הארה ועוצר צליל, וכל Callback בודק שה-`runId` עדיין בתוקף.
- **Audio** (`src/app/audio.ts`): `AudioContext` יחיד שנוצר/מתחדש רק בתוך לחיצה של המשתמש. צליל = Oscillator קצר עם Gain Envelope (עלייה/ירידה של כ-10ms, נגד "קליקים").
- **View** (`src/views/home.ts`): בונה את ה-DOM פעם אחת, רושם Listeners פעם אחת, ומתעדכן לפי State (`update`). בלי `innerHTML`.
- מצב `paused`, ניווט לאודות ו-`visibilitychange` — **לא** באבן דרך זו (Milestone 3). כפתור ״אודות״ נשאר לא מחובר.

## 2. קבצים ליצירה / שינוי

| קובץ | תוכן |
|---|---|
| `src/config.ts` | הוספה: `TONE_HZ` (מפת צבע → תדר), `FEEDBACK_MS = 300`, `STAGE_PAUSE_MS = 500` |
| `src/game/sequence.ts` | `generateSequence(length, random = Math.random)` → מערך צבעים; `Math.floor(random() * 4)` לכל פריט |
| `src/game/engine.ts` | טיפוסי `Phase` ו-`GameState`, ופעולות `initialState`, `startGame`, `presentationDone`, `pressColor` |
| `src/app/audio.ts` | `createAudio()` → `{ unlock(): Promise<boolean>, play(color, ms), stopAll() }` |
| `src/app/playback.ts` | `createPlayback(audio, setLit)` → `{ play(sequence, onDone), cancel() }` |
| `src/app/controller.ts` | `createController({ view, audio, playback, random })` → `{ start(), press(color), newGame() }` |
| `src/views/home.ts` | הוספת שורת מונה, אזור תוצאה, הודעת שגיאה; `update(state, litColor)`; חיבור הכפתורים ל-Controller |
| `src/main.ts` | יצירת Audio, Playback, View ו-Controller וחיבורם |
| `src/styles/app.css` | מונה, עמעום כפתורים בקלט חסום, אזור תוצאה, הודעת שגיאה, שמירת מקום ל-actions |
| `src/game/sequence.test.ts`, `src/game/engine.test.ts`, `src/app/playback.test.ts`, `src/app/controller.test.ts` | בדיקות Vitest |
| `e2e/game.spec.ts` | בדיקות Playwright לזרימות המשחק |
| `spec/ARCHITECTURE.md` | ADR-3 (שליטה ב-Random בבדיקות דפדפן), ADR-4 (משכי משוב ומעבר שלב, תדרים) |
| `spec/MILESTONES.md` | 🟡 ליד Milestone 2 בסיום |

## 3. Engine — מצב וכללים

```ts
type Phase = 'idle' | 'presenting' | 'accepting' | 'won' | 'lost';
interface GameState { phase; stage /*1–10*/; score /*0–10*/; sequence: PadColor[]; inputIndex }
```

| פעולה | תוצאה |
|---|---|
| `initialState()` | `idle`, שלב 1, ניקוד 0, רצף ריק |
| `startGame(random)` | `presenting`, שלב 1, ניקוד 0, רצף חדש באורך 1. משמש גם ל״משחק חדש״ |
| `presentationDone(state)` | רק מ-`presenting`: `accepting`, `inputIndex = 0`. אחרת — ללא שינוי |
| `pressColor(state, color, random)` | מחזיר `{ state, outcome }`; `outcome` הוא `ignored` / `correct` / `stageComplete` / `won` / `lost` |

כללי `pressColor`:
- כל מצב שאינו `accepting` → `ignored`, המצב לא משתנה (לחיצה בהצגה או אחרי סיום לא נחשבת).
- צבע שגוי → `lost`, הניקוד לא משתנה (`score = stage - 1`).
- צבע נכון שאינו האחרון → `inputIndex + 1`.
- השלמת שלב < 10 → ניקוד +1, שלב +1, **הרצף הקודם + צבע אקראי אחד בסופו**, ומעבר מיידי ל-`presenting` (הקלט ננעל מיד — לחיצות מהירות נוספות יוחזרו `ignored`, ולכן אין ניקוד כפול).
- השלמת שלב 10 → `won`, ניקוד 10.

## 4. Controller — זרימה ותזמון

- **״התחל״ / ״משחק חדש״:** ביטול כל פעולה קודמת (Playback, טיימר מעבר שלב, צלילים) → `await audio.unlock()` (בתוך הלחיצה) → אם נכשל: נשארים במצב הנוכחי, מוצגת הודעה ״לא ניתן להפעיל את הצליל. נסו שוב.״ והכפתור נשאר; אין התחלת שלב. אם הצליח: `startGame` → Playback.
- **Playback:** לכל פריט — הארה + צליל 500ms, ואז כיבוי. הפסקה של 250ms **רק בין פריטים**. אחרי כיבוי הפריט האחרון → `presentationDone` והקלט נפתח. אין Timeout לתשובה.
- **לחיצה על צבע:** ה-Engine מעדכן מיד (סינכרוני). אם התוצאה אינה `ignored` — משוב: הארה + צליל של 300ms (משוב קודם נקטע). לחיצות בזמן הצגה או סיום — בלי משוב ובלי השפעה.
- **מעבר שלב:** אחרי `stageComplete` הרצף הבא מתחיל 800ms אחרי הלחיצה (300ms משוב + 500ms הפסקה), כשהקלט כבר נעול.
- **ניצחון / כישלון:** המשוב של הלחיצה האחרונה מושמע, והתוצאה מוצגת מיד.
- **ביטול:** כל פעולה מתוזמנת נושאת `runId`; ״משחק חדש״ מגדיל אותו ומבטל הכול, כך ש-Callback ישן לא ישנה את המשחק החדש.
- **אודיו באמצע משחק:** כל לחיצה על צבע קוראת גם ל-`unlock()` (זו מחוות משתמש), כדי לשמור על ה-AudioContext פעיל. טיפול בהפרעה (מסך נעול / רקע) — באבן דרך 3.
- **תדרים** (פרט מימוש, ארבעה צלילים שונים בבירור, בהשראת ה-Simon הקלאסי): ירוק 415Hz, אדום 310Hz, צהוב 252Hz, כחול 209Hz; צורת גל `triangle`. מתועדים ב-ADR-4.

## 5. מסך הבית — מבנה ועיצוב

```
<main class="screen" data-phase="idle|presenting|accepting|won|lost">
  <header>…סיימון / אודות…</header>
  <p class="status">שלב 3 · ניקוד 2</p>      ← ריק לפני התחלה ובסיום; גובהו נשמר תמיד
  <div class="board">4 × pad</div>
  <div class="actions">                      ← גובה מינימלי קבוע, כדי שהמסך לא יקפוץ
    idle:        [הודעת שגיאה אם יש] + ״התחל״
    presenting/accepting:  ריק
    won/lost:    <h2>ניצחון! | המשחק נגמר</h2> <p>הניקוד שלך: 7</p> + ״משחק חדש״
  </div>
</main>
```

- **מונה:** Body מודגש (16px/700) בצבע Text, ממורכז, בין ה-Header ללוח.
- **עמעום:** כש-`data-phase` הוא `presenting`, `won` או `lost` — כפתורי צבע שאינם מוארים ב-`opacity: 0.6`; המואר במלוא הבהירות וה-Glow (`.is-active` הקיים). ב-`accepting` — הכול בבהירות מלאה. בנוסף `aria-disabled="true"` על הכפתורים כשהקלט חסום (הנעילה האמיתית נאכפת ב-Engine).
- **תוצאה:** H2 (24px/700), שורת Body, וכפתור Primary רחב ״משחק חדש״ באותו סגנון של ״התחל״, ממורכזים, במקום ״התחל״. אין Modal ואין מסך נוסף.
- **בחירות מימוש שיוצגו בסקירה** (לא מוגדרות במסמכים): המונה מוסתר במצב תוצאה (הניקוד מופיע בתוצאה); משך משוב לחיצה 300ms; הפסקה של 500ms לפני רצף חדש; נוסח ומיקום הודעת שגיאת האודיו; התדרים.

## 6. בדיקות

**Vitest:**
- `sequence.test.ts`: אורכים 1–10; כל פריט אחד מארבעת הצבעים; Random נשלט שמחזיר תמיד 0 → כל הפריטים כחולים (חזרות מותרות, אין כפיית גיוון); מיפוי ערכי Random לכל ארבעת הצבעים.
- `engine.test.ts`: התחלה → שלב 1, ניקוד 0, רצף באורך 1; לחיצה ב-`presenting`/`won`/`lost` → `ignored`; טעות → `lost` בלי ניקוד חלקי (גם באמצע שלב 5); השלמת שלב → נקודה אחת בדיוק ורצף **חדש** (Random נשלט שמחזיר ערכים שונים בכל שלב); השלמת 10 שלבים → `won` עם ניקוד 10 בדיוק; לחיצה כפולה מהירה אחרי השלמה → `ignored`.
- `playback.test.ts` (Fake Timers): הארה ב-0ms, כיבוי ב-500ms, הפריט הבא ב-750ms; אין הפסקה אחרי הפריט האחרון; `onDone` נקרא בדיוק ב-`n×500 + (n−1)×250`; `cancel()` מכבה הארה, עוצר צליל, ושום Callback לא רץ אחריו; הצליל וההארה של כל פריט מתחילים באותו רגע.
- `controller.test.ts` (Fake Timers + Audio/View מזויפים): הקלט נפתח רק בסוף ההצגה; אין Timeout לתשובה (התקדמות שעון של שעות לא משנה מצב); לחיצות בהצגה/אחרי סיום לא משנות תוצאה; ״משחק חדש״ → שלב 1 ניקוד 0, ו-Callbacks מהמשחק הקודם לא משפיעים; `unlock` שנכשל → נשארים `idle`, מוצגת שגיאה, אין Playback ואין כישלון במשחק.
- `config.test.ts`: ארבעה תדרים שונים זה מזה.

**Playwright (`e2e/game.spec.ts`, על Build, מובייל):**
- Random נשלט **רק בבדיקות**: `page.addInitScript` מחליף את `Math.random` בפונקציה שמחזירה תמיד 0 → כל הרצפים כחולים. קוד ה-Production לא משתנה (ADR-3).
- המתנה למצב לפי `data-phase` על `.screen`.
1. **ניצחון:** ״התחל״ → בכל שלב ממתינים ל-`accepting`, בודקים שהמונה מציג ״שלב N · ניקוד N−1״, ולוחצים כחול N פעמים → ״ניצחון!״, ״הניקוד שלך: 10״, ״משחק חדש״. (כ-45 שניות; Timeout מוגדל לבדיקה זו.)
2. **כישלון:** שלב 1 נכון, בשלב 2 לוחצים אדום → ״המשחק נגמר״, ״הניקוד שלך: 1״; לחיצות נוספות על צבעים לא משנות את התוצאה.
3. **משחק חדש:** אחרי סיום → ״משחק חדש״ → מונה ״שלב 1 · ניקוד 0״, התוצאה נעלמת.
4. **לחיצה בזמן הצגה:** לחיצה על אדום ב-`presenting` לא גורמת לכישלון.
5. **מונה:** לא מוצג לפני התחלה.
6. **רענון:** באמצע משחק → חוזרים ל״התחל״ בלי מונה; `localStorage` ו-`sessionStorage` ריקים.
7. **עמעום:** ב-`presenting` כפתור לא מואר עם `opacity` של 0.6; ב-`accepting` — 1.
8. **כשל אודיו:** `addInitScript` שגורם ל-`AudioContext.resume` להיכשל → אחרי ״התחל״ מוצגת הודעת השגיאה, ״התחל״ נשאר, אין מונה.
9. צילומי מסך של מצב הצגה, מצב תשובה ומצב תוצאה — לבדיקה חזותית שלי מול השפה העיצובית.
- `e2e/home.spec.ts` הקיים ממשיך לעבור (מצב התחלתי עם 6 כפתורים).

**בדיקה ידנית של המשתמש** (ב״הרץ כדי שאבדוק״): שמיעת ארבעת הצלילים והבחנה ביניהם, ושהאור והצליל מגיעים יחד — AI לא יכול לשמוע.

## 7. סדר העבודה בבנייה

1. `config.ts` → `sequence.ts` → `engine.ts` + בדיקות.
2. `audio.ts` → `playback.ts` + בדיקות.
3. `controller.ts` + בדיקות.
4. `home.ts`, `main.ts`, `app.css`.
5. `e2e/game.spec.ts`.
6. הרצה: `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`.
7. בדיקה חזותית של צילומי המסך ותיקון פערים; בדיקה ידנית קצרה ב-Browser.
8. ADR-3, ADR-4, 🟡 ב-MILESTONES.md. סגירת שרתים. בלי commit.

## 8. מיפוי ל-Definition of Done

| תנאי | איך מאומת |
|---|---|
| רצפים 1–10, הרצף הקודם נשמר וצבע אחד נוסף, חזרות מותרות, אין כפיית גיוון | `sequence.test.ts`, `engine.test.ts` |
| כישלון בלי ניקוד חלקי, נקודה אחת לשלב, ניצחון בדיוק ב-10 | `engine.test.ts` (Random נשלט) |
| משכי הארה/הפסקה, קלט נפתח רק בסוף, ביטול פעולות ישנות, אין Timeout | `playback.test.ts`, `controller.test.ts` (Fake Timers) |
| לחיצות בהצגה/אחרי סיום לא משנות; אין ניקוד כפול | `engine.test.ts`, `controller.test.ts`, Playwright 2 ו-4 |
| Playwright: ניצחון, כישלון, התחלה מחדש על Build עם Random נשלט | Playwright 1–3 |
| ״משחק חדש״ → שלב 1 ניקוד 0; רענון → ״התחל״, בלי Web Storage | Playwright 3 ו-6 |
| ארבעה צלילים מובחנים, אור וצליל יחד; כשל אודיו לא מקדם ולא נחשב טעות | `config.test.ts`, `playback.test.ts`, `controller.test.ts`, Playwright 8 + האזנה ידנית של המשתמש |
| מונה נכון ולא מוצג לפני התחלה; עמעום בקלט חסום | Playwright 1, 5, 7 |
| מצבי Rest/Active/תוצאה תואמים לעיצוב; Type Checking ו-Build עוברים | צילומי מסך (Playwright 9) + `npm run build` |
