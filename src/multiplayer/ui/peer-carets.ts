import type { PlayerState } from '../domain/types';

const peerCarets = new WeakMap<HTMLElement, Map<string, HTMLElement>>();

export function renderPeerCarets(
  container: HTMLElement,
  players: readonly PlayerState[],
  selfId: string
): void {
  const peers = players.filter(player => player.id !== selfId);
  const carets = peerCarets.get(container) ?? new Map<string, HTMLElement>();
  const activeIds = new Set(peers.map(player => player.id));
  for (const [playerId, caret] of carets) {
    if (activeIds.has(playerId)) continue;
    caret.remove();
    carets.delete(playerId);
  }
  const characters = [...container.querySelectorAll<HTMLElement>('.char')];
  const containerRect = container.getBoundingClientRect();
  for (const player of peers) {
    const target = characters[player.cursor] ?? characters[characters.length - 1];
    if (!target) continue;
    const targetRect = target.getBoundingClientRect();
    const atEnd = player.cursor >= characters.length;
    const caret = carets.get(player.id) ?? createPeerCaret(container, player, carets);
    if (!caret.isConnected) container.appendChild(caret);
    caret.style.setProperty('--peer-color', player.color);
    caret.style.transform = `translate3d(${
      targetRect.left - containerRect.left + container.scrollLeft + (atEnd ? targetRect.width : 0)
    }px, ${targetRect.top - containerRect.top + container.scrollTop}px, 0)`;
    caret.style.height = `${targetRect.height}px`;
    caret.title = `${player.name}: ${player.typingComplete ? 'finished' : `${player.cursor} characters`}`;
  }
  peerCarets.set(container, carets);
}

function createPeerCaret(
  container: HTMLElement,
  player: PlayerState,
  carets: Map<string, HTMLElement>
): HTMLElement {
  const caret = document.createElement('span');
  caret.className = 'peer-caret';
  caret.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = player.name;
  caret.appendChild(label);
  container.appendChild(caret);
  carets.set(player.id, caret);
  return caret;
}
