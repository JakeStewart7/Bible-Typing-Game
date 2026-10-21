import { playerCursor, playerCursorImage } from './player-theme.ts';

export function createPlayerCursor() {
  const root = document.documentElement;
  const cursor = document.createElement('div');
  cursor.className = 'stronghold-pointer';
  cursor.setAttribute('popover', 'manual');
  cursor.setAttribute('aria-hidden', 'true');
  const image = document.createElement('img');
  image.alt = ''; image.draggable = false;
  cursor.append(image);
  document.body.append(cursor);
  let active = false;
  let inside = false;
  let point: { x: number; y: number } | null = null;
  let key = '';
  let style = '';
  let modal: Element | null = null;

  function hide(): void {
    if (cursor.matches(':popover-open')) cursor.hidePopover();
    if (root.hasAttribute('data-pointer-visible')) root.removeAttribute('data-pointer-visible');
  }
  function render(front = false): void {
    if (!active || !inside || !point || document.hidden || !image.complete || !image.naturalWidth) { hide(); return; }
    const left = `${point.x - 3}px`, top = `${point.y - 2}px`;
    if (cursor.style.left !== left) cursor.style.left = left;
    if (cursor.style.top !== top) cursor.style.top = top;
    if (front && cursor.matches(':popover-open')) cursor.hidePopover();
    if (!cursor.matches(':popover-open')) cursor.showPopover();
    if (!root.hasAttribute('data-pointer-visible')) root.setAttribute('data-pointer-visible', '');
  }
  const move = (event: PointerEvent): void => {
    inside = event.pointerType !== 'touch';
    point = inside ? { x: event.clientX, y: event.clientY } : null;
    render();
  };
  const leave = (event: PointerEvent): void => {
    if (event.relatedTarget === null) { inside = false; hide(); }
  };
  const blur = (): void => { inside = false; hide(); };
  const focus = (): void => { inside = point !== null; render(); };
  const visibility = (): void => render();
  const topLayer = (event: Event): void => {
    if (event.target instanceof Element && event.target !== cursor && event.target.matches('dialog[open], :popover-open')) render(true);
  };
  document.addEventListener('pointermove', move, true);
  document.addEventListener('pointerdown', move, true);
  image.addEventListener('load', visibility);
  document.addEventListener('pointerover', move, true);
  document.addEventListener('pointerout', leave, true);
  document.addEventListener('visibilitychange', visibility);
  document.addEventListener('toggle', topLayer, true);
  window.addEventListener('blur', blur);
  window.addEventListener('focus', focus);
  return {
    update(color: string, placing: boolean, shown: boolean): void {
      active = shown;
      if (!shown) {
        hide();
        root.removeAttribute('data-stronghold-cursor');
        root.style.removeProperty('--stronghold-cursor');
        return;
      }
      const next = `${color}/${placing}`;
      if (key !== next) { image.src = playerCursorImage(color, placing); style = playerCursor(color, placing); key = next; }
      if (root.style.getPropertyValue('--stronghold-cursor') !== style) root.style.setProperty('--stronghold-cursor', style);
      if (!root.hasAttribute('data-stronghold-cursor')) root.setAttribute('data-stronghold-cursor', '');
      const dialogs = document.querySelectorAll('dialog[open]');
      const nextModal = dialogs[dialogs.length - 1] ?? null;
      const changed = nextModal !== modal;
      modal = nextModal;
      render(changed);
    },
    dispose(): void {
      active = false; hide(); cursor.remove();
      image.removeEventListener('load', visibility);
      root.removeAttribute('data-stronghold-cursor'); root.style.removeProperty('--stronghold-cursor');
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerdown', move, true);
      document.removeEventListener('pointerover', move, true);
      document.removeEventListener('pointerout', leave, true);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('toggle', topLayer, true);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
    }
  };
}
