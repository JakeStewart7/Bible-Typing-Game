import { requireElement } from '../../shared/dom.ts';
import { TIER_QUOTA } from '../domain/rules.ts';
import type { StrongholdSnapshot } from '../domain/types.ts';
import { setText } from './dom-updates.ts';
import type { StrongholdElements } from './view.ts';

export function renderTierChallenge(elements: StrongholdElements, snapshot: StrongholdSnapshot, running: boolean): void {
  const tierList = requireElement('stronghold-tier-contributions', HTMLElement);
  const ownCard = elements.playerCards.find(card => card.id === snapshot.selfId);
  if (!ownCard) throw new Error('Missing local Stronghold player panel.');
  for (const [id, entry] of elements.contributionCards) {
    if (!snapshot.players.some(player => player.id === id)) { entry.card.remove(); elements.contributionCards.delete(id); }
  }
  snapshot.players.forEach((player, index) => {
    let entry = elements.contributionCards.get(player.id);
    if (!entry) {
      const card = document.createElement('div');
      const name = document.createElement('strong');
      const progress = document.createElement('span');
      const typed = document.createElement('p');
      card.style.setProperty('--player-color', player.color);
      card.append(name, progress, typed);
      tierList.append(card);
      entry = { card, name, progress, typed };
      elements.contributionCards.set(player.id, entry);
    }
    setText(entry.name, `Player ${index + 1}`);
    setText(entry.progress, `${player.contribution}/${TIER_QUOTA}`);
    setText(entry.typed, player.typed || (player.contribution >= TIER_QUOTA ? 'Contribution complete' : 'Typing...'));
    entry.typed.classList.toggle('is-hidden', player.id === snapshot.selfId);
  });
  setText(requireElement('stronghold-tier-title', HTMLElement), `Tier ${snapshot.tier + 1}`);
  setText(requireElement('stronghold-tier-description', HTMLElement), `Complete ${TIER_QUOTA} phrases each to upgrade every role. The battlefield is paused.`);
  if (snapshot.phase === 'tier-up' && running) {
    if (elements.typing.parentElement !== elements.tierSlot) elements.tierSlot.append(elements.typing);
    const ownContribution = elements.contributionCards.get(snapshot.selfId);
    if (!ownContribution) throw new Error('Missing local Stronghold contribution.');
    if (elements.typedArea.parentElement !== ownContribution.card) ownContribution.card.append(elements.typedArea);
    if (!elements.dialog.open) { elements.dialog.showModal(); elements.input.focus({ preventScroll: true }); }
  } else {
    if (elements.dialog.open) elements.dialog.close();
    if (elements.typing.parentElement !== ownCard.phraseSlot) ownCard.phraseSlot.append(elements.typing);
    if (elements.typedArea.parentElement !== ownCard.typedSlot) ownCard.typedSlot.append(elements.typedArea);
  }
}
