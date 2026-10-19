import type { View, ViewModel } from '../app/controller';
import { el, header } from './dom';

// Game rules, in order, as worded in DESIGN.md 1.2.
const RULES = [
  'צפו ברצף האורות והצלילים וחזרו עליו באותו סדר.',
  'בכל שלב נוסף צבע אחד לסוף הרצף.',
  'יש 10 שלבים. כל שלב שהושלם מזכה בנקודה.',
  'טעות אחת מסיימת את המשחק.',
  'השלמת כל השלבים היא ניצחון בניקוד 10.',
  'אין מגבלת זמן לתשובה.',
];

export interface AboutActions {
  onBack(): void;
}

export function renderAbout(root: HTMLElement, actions: AboutActions): View {
  const screen = el('main', 'screen screen--about');
  screen.hidden = true;

  const score = el('section', 'about-score');
  score.setAttribute('aria-label', 'הניקוד שלך');
  const scoreValue = el('p', 'about-score__value');
  score.append(el('p', 'about-score__label', 'הניקוד שלך'), scoreValue);

  const rules = el('section', 'rules');
  rules.append(el('h2', 'rules__title', 'חוקי המשחק'));
  for (const rule of RULES) rules.append(el('p', 'rules__item', rule));

  screen.append(header('אודות', 'חזרה למשחק', actions.onBack), score, el('hr', 'divider'), rules);
  root.append(screen);

  function update({ state, screen: current }: ViewModel): void {
    screen.hidden = current !== 'about';
    scoreValue.textContent = String(state.score);
  }

  return { update };
}
