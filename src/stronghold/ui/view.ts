import { requireElement } from '../../shared/dom.ts';
import { BUILDING_CAPS, EVENT_LABELS, ROLE_ACTIONS, TIER_MAX, UNIT_CAPS } from '../domain/rules.ts';
import { tierProgress } from '../domain/tier-progress.ts';
import { taskCost, taskWork, upgradeLimit } from '../domain/technology.ts';
import { actionProblem, actionUnlockProblem } from '../domain/actions.ts';
import { taskKey } from '../domain/tasks.ts';
import { PHRASE_LENGTHS, ROLES, UPGRADE_TARGETS, type StrongholdSnapshot } from '../domain/types.ts';
import { createMapCamera } from './map-camera.ts';
import { createBattlefieldRenderer } from './battlefield.ts';
import { setAttribute, setText } from './dom-updates.ts';
import { PLAYER_IDS } from './workspace.ts';
import { renderTierChallenge } from './tier-view.ts';
import { createEventLog } from './event-log.ts';
import { createMapControls, readyBuilding } from './map-controls.ts';
import { applyPlayerTheme, playerCursor } from './player-theme.ts';
import { workProgress } from './work-progress.ts';
import { renderEnvironment } from './environment.ts';
import { daylight } from '../domain/environment.ts';
import { isArmyUnit, queuedUnits } from '../domain/training.ts';

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
        return { element: button, action, miniBar: button.querySelector<HTMLElement>('[data-task-progress]'),
          miniFill: button.querySelector<HTMLElement>('[data-task-fill]'), lockIcon: button.querySelector<SVGElement>('[data-tier-lock]'),
          tier: button.dataset.tier ? Number(button.dataset.tier) : undefined,
          upgrade: UPGRADE_TARGETS.find(target => target === button.dataset.strongholdUpgrade), minimumTier: Number(button.dataset.minTier) };
      });
      return { role, element, buttons };
    });
    return { id, card, groups, roleButtons: ROLES.map(role => ({ role, element: requireElement(`stronghold-role-${id}-${role}`, HTMLButtonElement) })),
      name: requireElement(`stronghold-name-${id}`, HTMLElement),
      typed: requireElement(`stronghold-typed-${id}`, HTMLElement), progress: requireElement(`stronghold-progress-${id}`, HTMLElement),
      progressLabel: requireElement(`stronghold-progress-label-${id}`, HTMLElement),
      actions: requireElement(`stronghold-player-actions-${id}`, HTMLElement) };
  });
  return {
    screen: requireElement('stronghold-screen', HTMLElement), map, playerCards,
    renderBattlefield: createBattlefieldRenderer(map),
    mapControls: createMapControls(map),
    camera: createMapCamera(map),
    renderEventLog: createEventLog(requireElement('stronghold-event-log', HTMLElement)),
    contributionCards: new Map<string, { card: HTMLElement; name: HTMLElement; typed: HTMLElement; segment: HTMLElement }>(),
    input: requireElement('stronghold-input', HTMLInputElement), phrase: requireElement('stronghold-phrase', HTMLElement),
    typedBar: requireElement('stronghold-typed-bar', HTMLElement), progressFill: requireElement('stronghold-typing-progress', HTMLElement),
    typing: requireElement('stronghold-typing', HTMLElement), typedArea: requireElement('stronghold-typed-area', HTMLElement),
    privateTyping: requireElement('stronghold-private', HTMLElement), privateSlot: requireElement('stronghold-private-slot', HTMLElement),
    length: requireElement('stronghold-length', HTMLElement),
    lengthOptions: PHRASE_LENGTHS.map(length => ({ length, element: requireElement(`stronghold-length-${length}`, HTMLButtonElement) })),
    worldEvent: requireElement('stronghold-world-event', HTMLElement),
    computerButtons: ['stronghold-computers', 'stronghold-tier-computers'].map(id => requireElement(id, HTMLButtonElement)),
    nextWave: requireElement('stronghold-next-wave', HTMLButtonElement),
    timer: requireElement('stronghold-timer', HTMLTimeElement),
    devSeason: requireElement('stronghold-dev-season', HTMLSelectElement),
    nextNight: requireElement('stronghold-next-night', HTMLButtonElement),
    nextDay: requireElement('stronghold-next-day', HTMLButtonElement),
    orders: requireElement('stronghold-army-orders', HTMLElement), placement: requireElement('stronghold-placement', HTMLElement),
    dialog: requireElement('stronghold-tier-dialog', HTMLDialogElement), tierSlot: requireElement('stronghold-tier-typing-slot', HTMLElement),
    feedback: requireElement('stronghold-feedback', HTMLElement)
  };
}
export type StrongholdElements = ReturnType<typeof strongholdElements>;
const textElements = new Map<string, HTMLElement>();
export function formatBattleTime(elapsed: number): string {
  const seconds = Math.floor(elapsed);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function text(id: string, value: string): void {
  let element = textElements.get(id);
  if (!element?.isConnected) { element = requireElement(id, HTMLElement); textElements.set(id, element); }
  setText(element, value);
}
export function renderStronghold(
  elements: StrongholdElements, snapshot: StrongholdSnapshot, selected: ReadonlySet<number>, running: boolean, paused: boolean,
  relayPlacement = false, placementCancelled = false, rallyPlacement = false, shown = true
): void {
  const self = snapshot.players.find(player => player.id === snapshot.selfId);
  const ownCard = elements.playerCards.find(card => card.id === snapshot.selfId);
  if (!self || !ownCard) throw new Error('Stronghold snapshot has no local player.');
  applyPlayerTheme(elements.screen, self.color);
  renderEnvironment(elements.screen, snapshot, running);
  elements.mapControls.theme(self.color);
  const terminal = snapshot.phase === 'won' || snapshot.phase === 'lost';
  const challenge = snapshot.phase === 'tier-up';
  const army = self.role === 'army' && !challenge;
  elements.nextWave.disabled = !running || snapshot.phase !== 'playing';
  const environmentDisabled = !running || snapshot.phase !== 'playing';
  const period = daylight(snapshot.environmentElapsed).period;
  setText(elements.timer, formatBattleTime(snapshot.elapsed));
  setAttribute(elements.timer, 'datetime', `PT${Math.floor(snapshot.elapsed)}S`);
  elements.devSeason.disabled = environmentDisabled;
  if (elements.devSeason.value !== snapshot.season) elements.devSeason.value = snapshot.season;
  elements.nextNight.disabled = environmentDisabled || period === 'night';
  elements.nextDay.disabled = environmentDisabled || period === 'day';
  text('stronghold-resources', String(Math.floor(snapshot.resources)));
  text('stronghold-event', EVENT_LABELS[snapshot.event]);
  text('stronghold-event-time', `${Math.ceil(snapshot.eventIn)}s`);
  elements.worldEvent.classList.toggle('is-hidden', snapshot.event === 'peace');
  for (const button of elements.computerButtons) {
    setText(button, snapshot.computersPaused ? 'Resume computers' : 'Stop computers');
    setAttribute(button, 'aria-pressed', String(snapshot.computersPaused));
    button.disabled = !running || terminal;
  }
  text('stronghold-tower-count', `${snapshot.buildings.filter(building => building.kind === 'tower' && !building.enemy && building.hp > 0).length}/${BUILDING_CAPS.tower}`);
  for (const kind of ['warrior', 'archer', 'catapult', 'builder', 'worker'] as const) text(`stronghold-${kind}-count`, `${snapshot.units.filter(unit => unit.kind === kind && unit.hp > 0).length}/${UNIT_CAPS[kind]}`);
  text('stronghold-tier-label', `Tier ${snapshot.tier}`);
  text('stronghold-tier-action', self.ready ? 'Ready!' : snapshot.tier === TIER_MAX ? 'Max Tier' : 'Tier Up');
  const ready = requireElement('stronghold-ready', HTMLButtonElement);
  const readyDisabled = terminal || challenge || snapshot.tier >= TIER_MAX;
  if (ready.disabled !== readyDisabled) ready.disabled = readyDisabled;
  ready.setAttribute('aria-label', `Tier ${snapshot.tier}. ${self.ready ? 'Cancel ready' : 'Ready up for the next tier'}`);
  text('stronghold-pause', paused ? 'Resume' : 'Pause');
  text('stronghold-tier-pause', paused ? 'Resume challenge' : 'Pause challenge');
  elements.renderBattlefield(snapshot, selected);
  elements.renderEventLog(snapshot);
  requireElement('stronghold-outcome', HTMLElement).classList.toggle('is-hidden', !terminal);
  text('stronghold-outcome-title', snapshot.phase === 'won' ? 'Victory!' : 'Your castle has fallen');
  text('stronghold-outcome-copy', snapshot.message);
  if (elements.orders.parentElement !== ownCard.actions) ownCard.actions.append(elements.orders);
  elements.orders.classList.toggle('is-hidden', !army || terminal);
  elements.privateTyping.classList.toggle('is-hidden', terminal);
  const placing = running && !challenge && !placementCancelled && (relayPlacement || readyBuilding(snapshot) !== null);
  const cursorMode = running && !terminal && !challenge && (placing || rallyPlacement) ? 'placement' : 'default';
  if (elements.screen.dataset.cursorColor !== self.color || elements.screen.dataset.cursorMode !== cursorMode) {
    elements.screen.style.setProperty('--stronghold-cursor', playerCursor(self.color, cursorMode === 'placement'));
    elements.screen.dataset.cursorColor = self.color;
    elements.screen.dataset.cursorMode = cursorMode;
  }
  elements.placement.classList.toggle('is-hidden', !placing || terminal);
  const inputDisabled = !running || terminal || (!challenge && Boolean(actionUnlockProblem(snapshot, self)));
  if (elements.input.disabled !== inputDisabled) elements.input.disabled = inputDisabled;
  setAttribute(elements.length, 'aria-activedescendant', `stronghold-length-${self.length}`);
  setAttribute(elements.length, 'aria-disabled', String(!running || terminal));
  for (const option of elements.lengthOptions) {
    const offset = PHRASE_LENGTHS.indexOf(self.length) - PHRASE_LENGTHS.indexOf(option.length);
    option.element.style.setProperty('--length-offset', String(offset));
    option.element.style.setProperty('--length-opacity', offset === 0 ? '1' : Math.abs(offset) === 1 ? '.4' : '.18');
    setAttribute(option.element, 'aria-selected', String(option.length === self.length));
    option.element.disabled = !running || terminal;
  }
  text('stronghold-selection', `${selected.size} selected / ${snapshot.units.filter(unit => unit.kind !== 'invader').length} friendly units`);
  for (const entry of elements.playerCards) {
    const player = snapshot.players.find(candidate => candidate.id === entry.id);
    if (!player) continue;
    const own = player.id === self.id;
    applyPlayerTheme(entry.card, player.color);
    entry.card.classList.toggle('is-you', own);
    setText(entry.name, `${own ? 'You' : `${player.name}, simulated teammate`}${player.ready && !challenge ? ', ready' : ''}`);
    setText(entry.typed, player.typed);
    entry.typed.classList.remove('is-hidden');
    const bank = workProgress(player.work, taskWork(player));
    const goal = tierProgress(snapshot.players).goal;
    const percent = challenge ? player.contribution / goal * 100 : bank.percent;
    const displayPercent = challenge ? Math.round(percent * 10) / 10 : Math.round(percent);
    const width = `${percent}%`;
    if (entry.progress.style.width !== width) entry.progress.style.width = width;
    const progressBar = entry.progress.closest('[role="progressbar"]');
    if (progressBar) {
      setAttribute(progressBar, 'aria-valuenow', String(displayPercent));
      setAttribute(progressBar, 'aria-valuetext', challenge ? `${displayPercent}% of shared tier progress` : bank.description);
    }
    const recruitCount = player.action === 'worker' || player.action === 'builder'
      ? snapshot.units.filter(unit => unit.kind === player.action && unit.hp > 0).length : null;
    const recruitLimit = player.action === 'worker' || player.action === 'builder' ? UNIT_CAPS[player.action] : null;
    const recruitCapped = recruitCount !== null && recruitLimit !== null && recruitCount >= recruitLimit;
    setText(entry.progressLabel, challenge ? `${displayPercent}%` : recruitCapped ? `Limit ${recruitCount}/${recruitLimit}` : bank.label);
    const roleDisabled = !own || challenge || terminal || !running;
    for (const button of entry.roleButtons) {
      setAttribute(button.element, 'aria-pressed', String(button.role === player.role));
      button.element.disabled = roleDisabled;
    }
    for (const group of entry.groups) {
      group.element.classList.toggle('is-hidden', group.role !== player.role);
      for (const button of group.buttons) {
        const capped = button.upgrade ? snapshot.technology[button.upgrade] >= upgradeLimit(snapshot.tier, button.upgrade) : false;
        const selection = { action: button.action, constructionTier: button.tier ?? 1, upgradeTarget: button.upgrade ?? player.upgradeTarget };
        const cost = taskCost(selection);
        const unaffordable = snapshot.resources < cost;
        button.element.classList.toggle('is-unaffordable', unaffordable);
        const recruitment = button.action === 'worker' || button.action === 'builder';
        const purchaseProblem = button.miniBar && !recruitment ? null : actionProblem(snapshot, { ...player, ...selection }, button.action);
        const population = button.element.querySelector('[data-unit-population]');
        if (population && (button.action === 'worker' || button.action === 'builder' || isArmyUnit(button.action))) {
          const kind = button.action;
          const count = snapshot.units.filter(unit => unit.kind === kind && unit.hp > 0).length;
          setText(population, `${count}/${UNIT_CAPS[kind]}`);
        }
        if (isArmyUnit(button.action)) {
          const queued = button.element.querySelector('[data-training-queued]');
          if (queued) setText(queued, `${queuedUnits(snapshot, button.action)} queued`);
        }
        const tierLocked = snapshot.tier < button.minimumTier;
        button.element.classList.toggle('is-unavailable', tierLocked || capped || Boolean(purchaseProblem));
        button.element.classList.toggle('is-tier-locked', tierLocked);
        button.lockIcon?.classList.toggle('is-hidden', !tierLocked);
        const disabled = !own || !running || challenge || terminal || tierLocked || capped || (Boolean(purchaseProblem) && button.action !== 'relay');
        if (button.element.disabled !== disabled) button.element.disabled = disabled;
        const selectedAction = own && relayPlacement ? button.action === 'relay' : Boolean(button.miniBar) && button.action === player.action
          && (!button.tier || button.tier === player.constructionTier) && (!button.upgrade || button.upgrade === player.upgradeTarget);
        button.element.classList.toggle('selected', selectedAction);
        setAttribute(button.element, 'aria-pressed', String(selectedAction));
        const label = button.element.querySelector('.stronghold-action-label')?.textContent ?? button.action;
        const description = unaffordable ? `Need ${cost} shared supplies; ${Math.floor(snapshot.resources)} available (${Math.ceil(cost - snapshot.resources)} short).`
          : tierLocked ? `Requires Tier ${button.minimumTier}.`
          : purchaseProblem ?? (cost > 0 ? `Costs ${cost} shared supplies.` : 'Complete phrases to prepare this task.');
        setAttribute(button.element, 'aria-description', description);
        setAttribute(button.element, 'data-tooltip', `${label}. ${description} (Alt+${button.element.dataset.shortcut})`);
        if (button.miniBar && button.miniFill) {
          const saved = snapshot.roleTasks[group.role].progress[taskKey(selection)];
          const progress = workProgress(saved?.work ?? 0, taskWork(selection));
          const width = `${progress.percent}%`;
          if (button.miniFill.style.width !== width) button.miniFill.style.width = width;
          setAttribute(button.miniBar, 'aria-valuenow', String(Math.round(progress.percent)));
          setAttribute(button.miniBar, 'aria-valuetext', progress.description);
        }
        const level = button.element.querySelector('[data-upgrade-level]');
        if (level && button.upgrade) setText(level, `Level ${snapshot.technology[button.upgrade]}`);
      }
    }
  }
  renderTierChallenge(elements, snapshot, running, shown, paused);
}
