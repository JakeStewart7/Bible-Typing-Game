export function setHidden(element: HTMLElement, hidden: boolean): void {
  element.classList.toggle('is-hidden', hidden);
}

export function renderEmptyState(container: HTMLElement, message: string): void {
  const empty = document.createElement('span');
  empty.className = 'empty-state';
  empty.textContent = message;
  container.replaceChildren(empty);
}

export function createTextBadge(text: string, tone: 'accent' | 'muted' = 'muted'): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.className = `text-badge text-badge--${tone}`;
  badge.textContent = text;
  return badge;
}
