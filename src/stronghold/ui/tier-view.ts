import { requireElement } from '../../shared/dom.ts';
import { tierProgress } from '../domain/tier-progress.ts';
import type { StrongholdSnapshot } from '../domain/types.ts';
import { setAttribute, setText } from './dom-updates.ts';
import type { StrongholdElements } from './view.ts';
import { applyPlayerTheme, playerTheme } from './player-theme.ts';

export function renderTierChallenge(elements: StrongholdElements, snapshot: StrongholdSnapshot, running: boolean, shown: boolean, paused: boolean): void {
  const tierList = requireElement('stronghold-tier-contributions', HTMLElement);
  const sharedBar = requireElement('stronghold-tier-progress', HTMLElement);
  const { completed, goal } = tierProgress(snapshot.players);
  setAttribute(sharedBar, 'aria-valuemax', String(goal));
  setAttribute(sharedBar, 'aria-valuenow', String(completed));
  setAttribute(sharedBar, 'aria-valuetext', `${completed} of ${goal} shared characters`);
  const ownCard = elements.playerCards.find(card => card.id === snapshot.selfId);
  if (!ownCard) throw new Error('Missing local Stronghold player panel.');
  for (const [id, entry] of elements.contributionCards) {
    if (!snapshot.players.some(player => player.id === id)) { entry.card.remove(); entry.segment.remove(); elements.contributionCards.delete(id); }
  }
  snapshot.players.forEach((player, index) => {
    let entry = elements.contributionCards.get(player.id);
    if (!entry) {
      const card = document.createElement('div');
      const name = document.createElement('strong');
      const progress = document.createElement('span');
      const typed = document.createElement('p');
      const segment = document.createElement('span');
      segment.setAttribute('aria-hidden', 'true');
      sharedBar.append(segment);
      card.append(name, progress, typed);
      tierList.append(card);
      entry = { card, name, progress, typed, segment };
      elements.contributionCards.set(player.id, entry);
    }
    applyPlayerTheme(entry.card, player.color);
    entry.segment.style.backgroundColor = playerTheme(player.color).light;
    entry.segment.style.width = `${player.contribution / goal * 100}%`;
    entry.segment.title = `Player ${index + 1}: ${player.contribution} characters`;
    setText(entry.name, `Player ${index + 1}`);
    setText(entry.progress, `${player.contribution} characters`);
    setText(entry.typed, player.typed);
    entry.typed.classList.remove('is-hidden');
  });
  const characters = snapshot.tier === 0 ? 'Letters' : snapshot.tier === 1 ? 'Letters and numbers' : 'Letters, numbers and punctuation';
  setText(requireElement('stronghold-tier-description', HTMLElement), `${paused ? 'Paused. ' : ''}${completed}/${goal} shared characters. ${characters}. Everyone can help fill the bar.`);
  if (snapshot.phase === 'tier-up' && shown) {
    setText(requireElement('stronghold-tier-title', HTMLElement), `Tier ${snapshot.tier} to Tier ${snapshot.tier + 1}`);
    if (elements.privateTyping.parentElement !== elements.tierSlot) elements.tierSlot.append(elements.privateTyping);
    if (!elements.dialog.open) {
      elements.dialog.showModal();
      if (running) elements.input.focus({ preventScroll: true });
    }
  } else {
    if (elements.dialog.open) elements.dialog.close();
    if (elements.privateTyping.parentElement !== elements.privateSlot) elements.privateSlot.append(elements.privateTyping);
  }
}
