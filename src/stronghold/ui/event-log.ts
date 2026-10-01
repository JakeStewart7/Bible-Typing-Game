import type { StrongholdSnapshot } from '../domain/types.ts';

export function createEventLog(element: HTMLElement) {
  let count = 0;
  let lastText = '';
  function updateFade(): void {
    const overflowing = String(element.scrollHeight > element.clientHeight);
    if (element.dataset.overflowing !== overflowing) element.dataset.overflowing = overflowing;
  }
  return (snapshot: StrongholdSnapshot): void => {
    const following = element.scrollHeight - element.clientHeight - element.scrollTop < 24;
    if (snapshot.events.length < count || (count > 0 && snapshot.events[count - 1]?.text !== lastText)) {
      element.replaceChildren();
      count = 0;
    }
    if (snapshot.events.length === count) { updateFade(); return; }
    const additions = document.createDocumentFragment();
    for (const event of snapshot.events.slice(count)) {
      const entry = document.createElement('p');
      entry.dataset.event = String(event.id);
      entry.style.color = snapshot.players.find(player => player.id === event.playerId)?.color ?? '#c3c3c3';
      entry.textContent = event.text;
      additions.append(entry);
    }
    element.append(additions);
    count = snapshot.events.length;
    lastText = snapshot.events[count - 1]?.text ?? '';
    if (following) element.scrollTop = element.scrollHeight;
    updateFade();
  };
}
