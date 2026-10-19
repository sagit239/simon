import { PADS, type PadColor } from '../config';
import type { View, ViewModel } from '../app/controller';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className: string, text: string): HTMLButtonElement {
  const node = el('button', className, text);
  node.type = 'button';
  return node;
}

export interface HomeActions {
  onStart(): void;
  onPress(color: PadColor): void;
}

// Builds the home screen once; update() reflects each new view model.
export function renderHome(root: HTMLElement, actions: HomeActions): View {
  const screen = el('main', 'screen');

  const header = el('header', 'header');
  header.append(el('h1', 'header__title', 'סיימון'), button('btn btn--secondary', 'אודות'));

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

  const result = el('section', 'result');
  const resultTitle = el('h2', 'result__title');
  const resultScore = el('p', 'result__score');
  const newGameButton = button('btn btn--primary btn--wide', 'משחק חדש');
  newGameButton.addEventListener('click', actions.onStart);
  result.append(resultTitle, resultScore, newGameButton);

  actionsArea.append(error, startButton, result);
  screen.append(header, status, board, actionsArea);
  root.replaceChildren(screen);

  function update({ state, lit, audioError }: ViewModel): void {
    const { phase, stage, score } = state;
    const playing = phase === 'presenting' || phase === 'accepting';
    const over = phase === 'won' || phase === 'lost';

    screen.dataset.phase = phase;
    status.textContent = playing ? `שלב ${stage} · ניקוד ${score}` : '';

    for (const [color, node] of pads) {
      node.classList.toggle('is-active', color === lit);
      node.setAttribute('aria-disabled', String(phase !== 'accepting'));
    }

    startButton.hidden = phase !== 'idle';
    error.hidden = !(phase === 'idle' && audioError);
    result.hidden = !over;
    if (over) {
      resultTitle.textContent = phase === 'won' ? 'ניצחון!' : 'המשחק נגמר';
      resultScore.textContent = `הניקוד שלך: ${score}`;
    }
  }

  return { update };
}
