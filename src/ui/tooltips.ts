export function initTooltips() {
  const bubble = document.createElement('div');
  bubble.id = 'game-hover-tooltip';
  bubble.className = 'game-tooltip';
  bubble.setAttribute('role', 'tooltip');
  bubble.setAttribute('popover', 'manual');
  document.body.append(bubble);
  let owner: Element | null = null;
  let pointer: { x: number; y: number } | null = null;

  function adopt(element: Element): void {
    const title = element.getAttribute('title');
    if (title === null) return;
    const previous = element.getAttribute('data-tooltip');
    if (!element.hasAttribute('aria-description') || element.getAttribute('aria-description') === previous) element.setAttribute('aria-description', title);
    element.setAttribute('data-tooltip', title);
    element.removeAttribute('title');
  }
  function scan(root: Element | Document): void {
    if (root instanceof Element) adopt(root);
    root.querySelectorAll('[title]').forEach(adopt);
  }
  function hide(): void {
    if (owner) {
      const ids = (owner.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(id => id && id !== bubble.id);
      if (ids.length) owner.setAttribute('aria-describedby', ids.join(' '));
      else owner.removeAttribute('aria-describedby');
    }
    owner = null;
    if (bubble.matches(':popover-open')) bubble.hidePopover();
  }
  function position(): void {
    if (!owner) return;
    const anchor = owner.getBoundingClientRect();
    const x = pointer?.x ?? anchor.left;
    const y = pointer?.y ?? anchor.bottom;
    const { width, height } = bubble.getBoundingClientRect();
    const left = Math.max(8, Math.min(x + (pointer ? 20 : 0), innerWidth - width - 8));
    const below = y + (pointer ? 24 : 8);
    const top = below + height <= innerHeight - 8 ? below : Math.max(8, y - height - 12);
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
  }
  function show(target: EventTarget | null): void {
    const next = target instanceof Element ? target.closest('[data-tooltip], [title]') : null;
    if (next) adopt(next);
    const text = next?.getAttribute('data-tooltip')?.trim();
    if (!next || !text) { hide(); return; }
    if (next !== owner) {
      hide();
      owner = next;
      const ids = (owner.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
      owner.setAttribute('aria-describedby', [...ids, bubble.id].join(' '));
    }
    if (bubble.textContent !== text) bubble.textContent = text;
    if (!bubble.matches(':popover-open')) bubble.showPopover();
    position();
  }
  const hover = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') { hide(); return; }
    pointer = { x: event.clientX, y: event.clientY };
    show(event.target);
  };
  const leave = (event: PointerEvent): void => {
    if (owner && (!(event.relatedTarget instanceof Node) || !owner.contains(event.relatedTarget))) hide();
  };
  const focus = (event: FocusEvent): void => { pointer = null; show(event.target); };
  const key = (event: KeyboardEvent): void => { if (event.key === 'Escape') hide(); };
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes' && record.attributeName === 'title' && record.target instanceof Element) adopt(record.target);
      for (const node of record.addedNodes) if (node instanceof Element) scan(node);
    }
    if (!owner) return;
    if (!owner.isConnected || !owner.getAttribute('data-tooltip')) { hide(); return; }
    const text = owner.getAttribute('data-tooltip') ?? '';
    if (bubble.textContent !== text) { bubble.textContent = text; position(); }
  });
  scan(document);
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title', 'data-tooltip'] });
  document.addEventListener('pointerover', hover);
  document.addEventListener('pointermove', hover);
  document.addEventListener('pointerout', leave);
  document.addEventListener('focusin', focus);
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide);
  document.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', key);
  window.addEventListener('blur', hide);
  window.addEventListener('resize', hide);
  return {
    dispose(): void {
      observer.disconnect(); hide(); bubble.remove();
      document.removeEventListener('pointerover', hover);
      document.removeEventListener('pointermove', hover);
      document.removeEventListener('pointerout', leave);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide);
      document.removeEventListener('scroll', hide, true);
      document.removeEventListener('keydown', key);
      window.removeEventListener('blur', hide);
      window.removeEventListener('resize', hide);
    }
  };
}
