import { requireElement } from '../../shared/dom.ts';
import { BUILDING_CAPS, EVENT_LABELS, ROLE_ACTIONS, TIER_MAX, TIER_QUOTA, UNIT_CAPS } from '../domain/rules.ts';
import { taskWork, upgradeLimit } from '../domain/technology.ts';
import { ROLES, UPGRADE_TARGETS, type StrongholdSnapshot } from '../domain/types.ts';
import { createBattlefieldRenderer } from './battlefield.ts';
import { setAttribute, setText } from './dom-updates.ts';
import { PLAYER_IDS } from './workspace.ts';
import { renderTierChallenge } from './tier-view.ts';
import { createEventLog } from './event-log.ts';
import { createMapControls, readyBuilding } from './map-controls.ts';
import { applyPlayerTheme, playerCursor } from './player-theme.ts';

export function strongholdElements() {
  const map = document.getElementById('stronghold-map');
  if (!(map instanceof SVGSVGElement)) throw new Error('Missing Stronghold battlefield SVG.');
  const playerCards = PLAYER_IDS.map(id => {
    const card = document.querySelector(`.stronghold-player[data-player="${id}"]`);
    if (!(card instanceof HTMLElement)) throw new Error(`Missing Stronghold player card: ${id}`);
    const groups = ROLES.map(role => {
      const element = card.querySelector(`.stronghold-actions[data-role="${role}"]`);
      if (!(element instanceof HTMLElement)) throw new Error(`Missing Stronghold role controls: ${role}`);
      const buttons = [...element.querySelectorAll<HTMLButtonElement>('[data-action]')].map(button => {
        const action = ROLE_ACTIONS[role].find(candidate => candidate === button.dataset.action);
        if (!action) throw new Error('Unknown Stronghold action button.');
        return { element: button, action, tier: button.dataset.tier ? Number(button.dataset.tier) : undefined,
          upgrade: UPGRADE_TARGETS.find(target => target === button.dataset.strongholdUpgrade), minimumTier: Number(button.dataset.minTier) };
      });
      return { role, element, buttons };
    });
    return { id, card, groups, roleSelect: requireElement(`stronghold-role-${id}`, HTMLSelectElement),
      name: requireElement(`stronghold-name-${id}`, HTMLElement),
      typed: requireElement(`stronghold-typed-${id}`, HTMLElement), progress: requireElement(`stronghold-progress-${id}`, HTMLElement),
      actions: requireElement(`stronghold-player-actions-${id}`, HTMLElement) };
  });
  return {
    screen: requireElement('stronghold-screen', HTMLElement), map, playerCards,
    renderBattlefield: createBattlefieldRenderer(map),
    mapControls: createMapControls(map),
    renderEventLog: createEventLog(requireElement('stronghold-event-log', HTMLElement)),
    contributionCards: new Map<string, { card: HTMLElement; name: HTMLElement; progress: HTMLElement; typed: HTMLElement }>(),
    input: requireElement('stronghold-input', HTMLInputElement), phrase: requireElement('stronghold-phrase', HTMLElement),
    typedBar: requireElement('stronghold-typed-bar', HTMLElement), progressFill: requireElement('stronghold-typing-progress', HTMLElement),
    typing: requireElement('stronghold-typing', HTMLElement), typedArea: requireElement('stronghold-typed-area', HTMLElement),
    privateTyping: requireElement('stronghold-private', HTMLElement), privateSlot: requireElement('stronghold-private-slot', HTMLElement),
    length: requireElement('stronghold-length', HTMLSelectElement),
    worldEvent: requireElement('stronghold-world-event', HTMLElement),
    computerButtons: ['stronghold-computers', 'stronghold-tier-computers'].map(id => requireElement(id, HTMLButtonElement)),
    orders: requireElement('stronghold-army-orders', HTMLElement), placement: requireElement('stronghold-placement', HTMLElement),
    dialog: requireElement('stronghold-tier-dialog', HTMLDialogElement), tierSlot: requireElement('stronghold-tier-typing-slot', HTMLElement),
    feedback: requireElement('stronghold-feedback', HTMLElement)
  };
}
export type StrongholdElements = ReturnType<typeof strongholdElements>;
const textElements = new Map<string, HTMLElement>();
function text(id: string, value: string): void {
  let element = textElements.get(id);
  if (!element?.isConnected) { element = requireElement(id, HTMLElement); textElements.set(id, element); }
  setText(element, value);
}
export function renderStronghold(
  elements: StrongholdElements, snapshot: StrongholdSnapshot, selected: ReadonlySet<number>, running: boolean, paused: boolean,
  relayPlacement = false, placementCancelled = false
): void {
  const self = snapshot.players.find(player => player.id === snapshot.selfId);
  const ownCard = elements.playerCards.find(card => card.id === snapshot.selfId);
  if (!self || !ownCard) throw new Error('Stronghold snapshot has no local player.');
  applyPlayerTheme(elements.screen, self.color);
  if (elements.screen.dataset.cursorColor !== self.color) {
    elements.screen.style.setProperty('--stronghold-cursor', playerCursor(self.color));
    elements.screen.dataset.cursorColor = self.color;
  }
  elements.mapControls.theme(self.color);
  const castle = snapshot.buildings.find(building => building.kind === 'castle');
  const terminal = snapshot.phase === 'won' || snapshot.phase === 'lost';
  const challenge = snapshot.phase === 'tier-up';
  const army = self.role === 'army' && !challenge;
  text('stronghold-resources', String(Math.floor(snapshot.resources)));
  text('stronghold-castle', `${Math.max(0, Math.ceil(castle?.hp ?? 0))}/${castle?.maxHp ?? 10000}`);
  text('stronghold-enemy', String(Math.max(0, Math.ceil(snapshot.buildings.find(building => building.kind === 'enemy-base')?.hp ?? 0))));
  text('stronghold-wave', `Wave ${snapshot.wave + 1}: ${Math.ceil(snapshot.waveIn)}s`);
  text('stronghold-event', EVENT_LABELS[snapshot.event]);
  text('stronghold-event-time', `${Math.ceil(snapshot.eventIn)}s`);
  elements.worldEvent.classList.toggle('is-hidden', snapshot.event === 'peace');
  for (const button of elements.computerButtons) {
    setText(button, snapshot.computersPaused ? 'Resume computers' : 'Stop computers');
    setAttribute(button, 'aria-pressed', String(snapshot.computersPaused));
    button.disabled = !running || terminal;
  }
  text('stronghold-tower-count', `${snapshot.buildings.filter(building => building.kind === 'tower' && !building.enemy).length}/${BUILDING_CAPS.tower}`);
  for (const kind of ['warrior', 'builder', 'worker'] as const) text(`stronghold-${kind}-count`, `${snapshot.units.filter(unit => unit.kind === kind).length}/${UNIT_CAPS[kind]}`);
  text('stronghold-tier-label', `Tier ${snapshot.tier}`);
  text('stronghold-tier-action', self.ready ? 'Ready!' : snapshot.tier === TIER_MAX ? 'Max Tier' : 'Tier Up');
  const ready = requireElement('stronghold-ready', HTMLButtonElement);
  const readyDisabled = terminal || challenge || snapshot.tier >= TIER_MAX;
  if (ready.disabled !== readyDisabled) ready.disabled = readyDisabled;
  ready.setAttribute('aria-label', `Tier ${snapshot.tier}. ${self.ready ? 'Cancel ready' : 'Ready up for the next tier'}`);
  text('stronghold-pause', paused ? 'Resume' : 'Pause');
  elements.renderBattlefield(snapshot, selected);
  elements.renderEventLog(snapshot);
  requireElement('stronghold-outcome', HTMLElement).classList.toggle('is-hidden', !terminal);
  text('stronghold-outcome-title', snapshot.phase === 'won' ? 'Victory!' : 'Your castle has fallen');
  text('stronghold-outcome-copy', snapshot.message);
  if (elements.orders.parentElement !== ownCard.actions) ownCard.actions.append(elements.orders);
  elements.orders.classList.toggle('is-hidden', !army || terminal);
  elements.privateTyping.classList.toggle('is-hidden', terminal);
  const placing = !challenge && !placementCancelled && (relayPlacement || readyBuilding(snapshot) !== null);
  elements.placement.classList.toggle('is-hidden', !placing || terminal);
  const inputDisabled = !running || terminal;
  if (elements.input.disabled !== inputDisabled) elements.input.disabled = inputDisabled;
  if (elements.length.value !== self.length) elements.length.value = self.length;
  elements.length.disabled = !running || terminal;
  text('stronghold-selection', `${selected.size} selected / ${snapshot.units.filter(unit => ['warrior', 'archer', 'catapult'].includes(unit.kind)).length} army units`);
  for (const entry of elements.playerCards) {
    const player = snapshot.players.find(candidate => candidate.id === entry.id);
    if (!player) continue;
    const own = player.id === self.id;
    applyPlayerTheme(entry.card, player.color);
    entry.card.classList.toggle('is-you', own);
    setText(entry.name, `${own ? 'You' : `${player.name}, simulated teammate`}${player.ready && !challenge ? ', ready' : ''}`);
    setText(entry.typed, player.typed);
    entry.typed.classList.remove('is-hidden');
    const percent = Math.min(100, challenge ? player.contribution / TIER_QUOTA * 100 : player.work / taskWork(player) * 100);
    const width = `${percent}%`;
    if (entry.progress.style.width !== width) entry.progress.style.width = width;
    const progressBar = entry.progress.closest('[role="progressbar"]');
    if (progressBar) setAttribute(progressBar, 'aria-valuenow', String(Math.round(percent)));
    if (entry.roleSelect.value !== player.role) entry.roleSelect.value = player.role;
    const roleDisabled = !own || challenge || terminal || !running;
    if (entry.roleSelect.disabled !== roleDisabled) entry.roleSelect.disabled = roleDisabled;
    for (const group of entry.groups) {
      group.element.classList.toggle('is-hidden', group.role !== player.role);
      for (const button of group.buttons) {
        const capped = button.upgrade ? snapshot.technology[button.upgrade] >= upgradeLimit(snapshot.tier, button.upgrade) : false;
        const disabled = !own || !running || challenge || terminal || snapshot.tier < button.minimumTier || capped;
        if (button.element.disabled !== disabled) button.element.disabled = disabled;
        const selectedAction = own && button.action === 'relay' ? relayPlacement : button.action === player.action
          && (!button.tier || button.tier === player.constructionTier) && (!button.upgrade || button.upgrade === player.upgradeTarget);
        button.element.classList.toggle('selected', selectedAction);
        setAttribute(button.element, 'aria-pressed', String(selectedAction));
        const level = button.element.querySelector('[data-upgrade-level]');
        if (level && button.upgrade) setText(level, `Level ${snapshot.technology[button.upgrade]}`);
      }
    }
  }
  renderTierChallenge(elements, snapshot, running);
}
