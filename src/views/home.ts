import { PADS } from '../config';

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

// Initial home screen. Buttons are wired to game logic in later milestones.
export function renderHome(root: HTMLElement): void {
  const screen = el('main', 'screen');

  const header = el('header', 'header');
  header.append(el('h1', 'header__title', 'סיימון'));
  const aboutButton = el('button', 'btn btn--secondary', 'אודות');
  aboutButton.type = 'button';
  header.append(aboutButton);

  const board = el('div', 'board');
  for (const pad of PADS) {
    const button = el('button', `pad pad--${pad.color}`, pad.label);
    button.type = 'button';
    button.dataset.color = pad.color;
    board.append(button);
  }

  const actions = el('div', 'actions');
  const startButton = el('button', 'btn btn--primary btn--wide', 'התחל');
  startButton.type = 'button';
  actions.append(startButton);

  screen.append(header, board, actions);
  root.replaceChildren(screen);
}
