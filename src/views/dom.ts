export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(className: string, text: string): HTMLButtonElement {
  const node = el('button', className, text);
  node.type = 'button';
  return node;
}

// Shared header: screen title on the right, outline nav button on the left.
export function header(title: string, navLabel: string, onNav: () => void): HTMLElement {
  const node = el('header', 'header');
  const nav = button('btn btn--secondary', navLabel);
  nav.addEventListener('click', onNav);
  node.append(el('h1', 'header__title', title), nav);
  return node;
}
