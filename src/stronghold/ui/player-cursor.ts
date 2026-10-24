import { playerCursor } from './player-theme.ts';

export function createPlayerCursor() {
  const root = document.documentElement;
  let key = '';
  let style = '';
  return {
    update(color: string, placing: boolean, shown: boolean): void {
      if (!shown) {
        root.removeAttribute('data-stronghold-cursor');
        root.style.removeProperty('--stronghold-cursor');
        return;
      }
      const next = `${color}/${placing}`;
      if (key !== next) { style = playerCursor(color, placing); key = next; }
      if (root.style.getPropertyValue('--stronghold-cursor') !== style) root.style.setProperty('--stronghold-cursor', style);
      if (!root.hasAttribute('data-stronghold-cursor')) root.setAttribute('data-stronghold-cursor', '');
    },
    dispose(): void {
      root.removeAttribute('data-stronghold-cursor'); root.style.removeProperty('--stronghold-cursor');
    }
  };
}
