import { PADS, type PadColor } from '../config';
import type { View, ViewModel } from '../app/controller';
import { button, el, header } from './dom';

export interface HomeActions {
  onStart(): void;
  onResume(): void;
  onPress(color: PadColor): void;
  onAbout(): void;
}

// Builds the home screen once; update() reflects each new view model.
export function renderHome(root: HTMLElement, actions: HomeActions): View {
  const screen = el('main', 'screen screen--home');

  // Always present so the board does not jump when it fills in.
  const status = el('p', 'status');
  status.setAttribute('aria-live', 'polite');

  const board = el('div', 'board');
  const pads = new Map<PadColor, HTMLButtonElement>();
  for (const pad of PADS) {
    const node = button(`pad pad--${pad.color}`, pad.label);
    node.dataset.color = pad.color;
    node.addEventListener('click', () => actions.onPress(pad.color));
    pads.set(pad.color, node);
    board.append(node);
  }

  const actionsArea = el('div', 'actions');
  const error = el('p', 'actions__error', 'לא ניתן להפעיל את הצליל. נסו שוב.');
  error.setAttribute('role', 'alert');
  const startButton = button('btn btn--primary btn--wide', 'התחל');
  startButton.addEventListener('click', actions.onStart);
  // Shown after an interruption (locked device, app switch, failed audio on return).
  const resumeButton = button('btn btn--primary btn--wide', 'המשך');
  resumeButton.addEventListener('click', actions.onResume);

  const result = el('section', 'result');
  const resultTitle = el('h2', 'result__title');
  const resultScore = el('p', 'result__score');
  const newGameButton = button('btn btn--primary btn--wide', 'משחק חדש');
  newGameButton.addEventListener('click', actions.onStart);
  result.append(resultTitle, resultScore, newGameButton);

  actionsArea.append(error, startButton, resumeButton, result);
  screen.append(header('סיימון', 'אודות', actions.onAbout), status, board, actionsArea);
  root.replaceChildren(screen);

  function update({ state, screen: current, lit, audioError }: ViewModel): void {
    const { phase, stage, score } = state;
    const inGame = phase === 'presenting' || phase === 'accepting' || phase === 'paused';
    const over = phase === 'won' || phase === 'lost';

    screen.hidden = current !== 'home';
    screen.dataset.phase = phase;
    status.textContent = inGame ? `שלב ${stage} · ניקוד ${score}` : '';

    for (const [color, node] of pads) {
      node.classList.toggle('is-active', color === lit);
      node.setAttribute('aria-disabled', String(phase !== 'accepting'));
    }

    startButton.hidden = phase !== 'idle';
    resumeButton.hidden = phase !== 'paused';
    error.hidden = !((phase === 'idle' || phase === 'paused') && audioError);
    result.hidden = !over;
    if (over) {
      resultTitle.textContent = phase === 'won' ? 'ניצחון!' : 'המשחק נגמר';
      resultScore.textContent = `הניקוד שלך: ${score}`;
    }
  }

  return { update };
}
