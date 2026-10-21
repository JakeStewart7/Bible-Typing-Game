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
  const percent = Math.round(completed / goal * 1000) / 10;
  setAttribute(sharedBar, 'aria-valuemax', '100');
  setAttribute(sharedBar, 'aria-valuenow', String(percent));
  setAttribute(sharedBar, 'aria-valuetext', `${percent}% complete`);
  const ownCard = elements.playerCards.find(card => card.id === snapshot.selfId);
  if (!ownCard) throw new Error('Missing local Stronghold player panel.');
  for (const [id, entry] of elements.contributionCards) {
    if (!snapshot.players.some(player => player.id === id)) { entry.card.remove(); entry.segment.remove(); elements.contributionCards.delete(id); }
  }
  snapshot.players.forEach((player, index) => {
    const contribution = Math.round(player.contribution / goal * 1000) / 10;
    let entry = elements.contributionCards.get(player.id);
    if (!entry) {
      const card = document.createElement('div');
      const name = document.createElement('strong');
      const progress = document.createElement('span');
      const segment = document.createElement('span');
      segment.setAttribute('aria-hidden', 'true');
      sharedBar.append(segment);
      card.append(name, progress);
      tierList.append(card);
      entry = { card, name, progress, segment };
      elements.contributionCards.set(player.id, entry);
    }
    applyPlayerTheme(entry.card, player.color);
    entry.segment.style.backgroundColor = playerTheme(player.color).light;
    entry.segment.style.width = `${player.contribution / goal * 100}%`;
    entry.segment.title = `Player ${index + 1}: ${contribution}%`;
    setText(entry.name, `Player ${index + 1}`);
    setText(entry.progress, `${contribution}%`);
  });
  const characters = snapshot.tier === 0 ? 'Letters' : snapshot.tier === 1 ? 'Letters and numbers' : 'Letters, numbers and punctuation';
  setText(requireElement('stronghold-tier-description', HTMLElement), `${paused ? 'Paused. ' : ''}${percent}% complete. ${characters}. Complete phrases to fill the shared bar.`);
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
