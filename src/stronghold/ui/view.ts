import { requireElement } from '../../shared/dom.ts';
import { ACTION_LABELS, EVENT_LABELS, MIN_TIER, ROLE_ACTIONS, ROLE_LABELS, TIER_MAX, TIER_QUOTA, UNIT_CAPS } from '../domain/rules.ts';
import { ROLES, type StrongholdSnapshot } from '../domain/types.ts';
import { battlefieldMarkup } from './battlefield.ts';

export function strongholdElements() {
  const map = document.getElementById('stronghold-map');
  if (!(map instanceof SVGSVGElement)) throw new Error('Missing Stronghold battlefield SVG.');
  return {
    screen: requireElement('stronghold-screen', HTMLElement),
    map,
    input: requireElement('stronghold-input', HTMLInputElement),
    phrase: requireElement('stronghold-phrase', HTMLElement),
    typedBar: requireElement('stronghold-typed-bar', HTMLElement),
    progressFill: requireElement('stronghold-typing-progress', HTMLElement),
    typing: requireElement('stronghold-typing', HTMLElement),
    orders: requireElement('stronghold-army-orders', HTMLElement),
    placement: requireElement('stronghold-placement', HTMLElement),
    dialog: requireElement('stronghold-tier-dialog', HTMLDialogElement),
    tierSlot: requireElement('stronghold-tier-typing-slot', HTMLElement),
    feedback: requireElement('stronghold-feedback', HTMLElement)
  };
}
export type StrongholdElements = ReturnType<typeof strongholdElements>;
function text(id: string, value: string): void {
  requireElement(id, HTMLElement).textContent = value;
}
export function renderStronghold(
  elements: StrongholdElements, snapshot: StrongholdSnapshot, selected: ReadonlySet<number>,
  running: boolean, paused: boolean
): void {
  const self = snapshot.players.find(player => player.id === snapshot.selfId);
  if (!self) throw new Error('Stronghold snapshot has no local player.');
  const castle = snapshot.buildings.find(building => building.kind === 'castle');
  const terminal = snapshot.phase === 'won' || snapshot.phase === 'lost';
  const challenge = snapshot.phase === 'tier-up';
  const army = self.role === 'army' && !challenge;
  text('stronghold-resources', String(Math.floor(snapshot.resources)));
  text('stronghold-castle', `${Math.max(0, Math.ceil(castle?.hp ?? 0))} / ${castle?.maxHp ?? 1000}`);
  text('stronghold-wave', `Wave ${snapshot.wave + 1} / ${Math.ceil(snapshot.waveIn)}s`);
  text('stronghold-event', EVENT_LABELS[snapshot.event]);
  const ready = requireElement('stronghold-ready', HTMLButtonElement);
  ready.textContent = `Tier ${snapshot.tier} / ${self.ready ? 'Cancel ready' : snapshot.tier === TIER_MAX ? 'Maximum tier' : 'Ready up'}`;
  ready.disabled = terminal || challenge || snapshot.tier >= TIER_MAX;
  text('stronghold-pause', paused ? 'Resume' : 'Pause');
  elements.map.innerHTML = battlefieldMarkup(snapshot, selected);
  requireElement('stronghold-outcome', HTMLElement).classList.toggle('is-hidden', !terminal);
  text('stronghold-outcome-title', snapshot.phase === 'won' ? 'A united victory' : 'The stronghold has fallen');
  text('stronghold-outcome-copy', snapshot.message);
  elements.orders.classList.toggle('is-hidden', !army || terminal);
  elements.typing.classList.toggle('is-hidden', army || terminal);
  const placing = !challenge && self.typed === self.phrase
    && (self.action === 'relay' || self.action === 'barracks' || self.action === 'tower' || self.action === 'wall');
  elements.placement.classList.toggle('is-hidden', !placing || terminal);
  elements.input.disabled = !running || terminal || (challenge && self.contribution >= TIER_QUOTA) || placing;
  text('stronghold-typing-label', challenge ? `YOUR TIER ${snapshot.tier + 1} PHRASE` : `${ROLE_LABELS[self.role]} / ${ACTION_LABELS[self.action]}`);
  text('stronghold-selection', `${selected.size} selected / ${snapshot.units.filter(unit => unit.kind === 'warrior').length}/${UNIT_CAPS.warrior} warriors / ${snapshot.units.filter(unit => unit.kind === 'archer').length}/${UNIT_CAPS.archer} archers / ${snapshot.units.filter(unit => unit.kind === 'catapult').length}/${UNIT_CAPS.catapult} catapults`);
  for (const role of ROLES) {
    const player = snapshot.players.find(candidate => candidate.role === role);
    if (!player) continue;
    const own = player.id === self.id;
    const card = elements.screen.querySelector<HTMLElement>(`.stronghold-player[data-role="${role}"]`);
    card?.classList.toggle('is-you', own);
    text(`stronghold-name-${role}`, `${player.name} / ${own ? 'YOU' : 'SIMULATED'}${player.ready && !challenge ? ' / READY' : ''}`);
    text(`stronghold-task-${role}`, challenge ? `${player.contribution} / ${TIER_QUOTA} tier phrases` : role === 'army' ? 'Direct troops with map orders' : `${ACTION_LABELS[player.action]} / role level ${snapshot.upgrades[role]}`);
    text(`stronghold-typed-${role}`, player.typed || (role === 'army' && !challenge ? 'Protect the gatherers. Lead the final push.' : 'Preparing a phrase...'));
    requireElement(`stronghold-progress-${role}`, HTMLElement).style.width = `${challenge ? Math.min(100, player.contribution / TIER_QUOTA * 100) : player.progress * 100}%`;
    card?.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
      const action = ROLE_ACTIONS[role].find(candidate => candidate === button.dataset.action);
      const tier = action ? MIN_TIER[action] : 0;
      button.disabled = !own || !running || challenge || terminal || snapshot.tier < tier;
      button.classList.toggle('selected', own && button.dataset.action === player.action);
    });
    const take = card?.querySelector<HTMLButtonElement>('.stronghold-take-role');
    if (take) { take.disabled = challenge || terminal || own; take.textContent = own ? 'Your role' : 'Take role'; }
  }
  const tierList = requireElement('stronghold-tier-contributions', HTMLElement);
  tierList.replaceChildren(...snapshot.players.map(player => {
    const card = document.createElement('div');
    card.style.setProperty('--player-color', player.color);
    const name = document.createElement('strong');
    name.textContent = player.name;
    const progress = document.createElement('span');
    progress.textContent = `${player.contribution} / ${TIER_QUOTA}`;
    const typed = document.createElement('p');
    typed.textContent = player.typed || (player.contribution >= TIER_QUOTA ? 'Ready for the next tier' : 'Typing...');
    card.append(name, progress, typed);
    return card;
  }));
  if (challenge && running) {
    if (elements.typing.parentElement !== elements.tierSlot) elements.tierSlot.append(elements.typing);
    if (!elements.dialog.open) { elements.dialog.showModal(); elements.input.focus({ preventScroll: true }); }
  } else {
    if (elements.dialog.open) elements.dialog.close();
    if (elements.typing.parentElement === elements.tierSlot) elements.orders.before(elements.typing);
  }
}
