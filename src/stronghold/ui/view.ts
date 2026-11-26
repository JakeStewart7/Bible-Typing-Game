import { requireElement } from '../../shared/dom.ts';
import { ACTION_LABELS, BUILDING_CAPS, EVENT_LABELS, isTypingAction, ROLE_ACTIONS, TIER_COSTS, TIER_MAX, UNIT_CAPS } from '../domain/rules.ts';
import { tierProgress } from '../domain/tier-progress.ts';
import { taskCost, taskWork } from '../domain/technology.ts';
import { actionBlocker, actionRequiredTier, actionUnlockProblem, constructionBlocker, type ActionBlocker } from '../domain/actions.ts';
import { taskKey } from '../domain/tasks.ts';
import { PHRASE_LENGTHS, ROLES, UPGRADE_TARGETS, type StrongholdSnapshot, type TaskSelection } from '../domain/types.ts';
import { createMapCamera } from './map-camera.ts';
import { createBattlefieldRenderer } from './battlefield.ts';
import { setAttribute, setText } from './dom-updates.ts';
import { LENGTH_CONTROL_HELP, PLAYER_IDS } from './workspace.ts';
import { renderTierChallenge } from './tier-view.ts';
import { createEventLog } from './event-log.ts';
import { createMapControls, readyBuilding } from './map-controls.ts';
import { applyPlayerTheme, playerCursor } from './player-theme.ts';
import { taskProgress, workProgress } from './work-progress.ts';
import { renderEnvironment } from './environment.ts';
import { daylight, SEASON_BONUSES, typingSupplyBase } from '../domain/environment.ts';
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
        const label = button.querySelector<HTMLElement>('.stronghold-action-label');
        const blocker = button.querySelector<HTMLElement>('[data-action-blocker]');
        if (!label || !blocker) throw new Error('Missing Stronghold action feedback.');
        return { element: button, action, label: label.textContent ?? ACTION_LABELS[action], labelElement: label, blockerElement: blocker,
          miniBar: button.querySelector<HTMLElement>('[data-task-progress]'),
          miniFill: button.querySelector<HTMLElement>('[data-task-fill]'), lockIcon: button.querySelector<SVGElement>('[data-tier-lock]'),
          tier: button.dataset.tier ? Number(button.dataset.tier) : undefined,
          upgrade: UPGRADE_TARGETS.find(target => target === button.dataset.strongholdUpgrade), minimumTier: Number(button.dataset.minTier) };
      });
      return { role, element, buttons };
    });
    return { id, card, groups, roleButtons: ROLES.map(role => {
      const element = requireElement(`stronghold-role-${id}-${role}`, HTMLButtonElement);
      return { role, element, help: element.dataset.tooltip ?? '' };
    }),
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
    typingLock: requireElement('stronghold-typing-lock', HTMLElement),
    typingLockLabel: requireElement('stronghold-typing-lock-label', HTMLElement),
    tierBlocker: requireElement('stronghold-tier-blocker', HTMLElement),
    devStatus: requireElement('stronghold-dev-status', HTMLElement),
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
    selection: requireElement('stronghold-selection', HTMLElement),
    dialog: requireElement('stronghold-tier-dialog', HTMLDialogElement), tierSlot: requireElement('stronghold-tier-typing-slot', HTMLElement),
    feedback: requireElement('stronghold-feedback', HTMLElement)
  };
}
export type StrongholdElements = ReturnType<typeof strongholdElements>;
type ControlBlocker = ActionBlocker | { kind: 'paused' | 'phase' | 'teammate'; label: string; description: string };
function controlBlocker(snapshot: StrongholdSnapshot, player: StrongholdSnapshot['players'][number], running: boolean): ControlBlocker | null {
  if (snapshot.phase === 'won' || snapshot.phase === 'lost') return { kind: 'phase', label: 'Match over', description: 'Start a new game to use these controls.' };
  if (snapshot.phase === 'tier-up') return { kind: 'phase', label: 'Tier challenge', description: 'Finish the shared tier challenge before changing tasks or issuing battlefield orders.' };
  if (!running) return { kind: 'paused', label: 'Paused', description: 'Resume gameplay before using this control.' };
  return player.id !== snapshot.selfId ? { kind: 'teammate', label: player.simulated ? 'Computer' : 'Teammate',
    description: `These are ${player.name}'s read-only ${player.simulated ? 'computer' : 'teammate'} controls. Use the role buttons in your own player panel.` } : null;
}
export function taskAvailability(snapshot: StrongholdSnapshot, player: StrongholdSnapshot['players'][number], selection: TaskSelection, running: boolean) {
  const context = controlBlocker(snapshot, player, running);
  const problem = actionBlocker(snapshot, { ...player, ...selection }, selection.action);
  const construction = selection.action === 'tower' || selection.action === 'barracks' || selection.action === 'wall';
  const placement = selection.action === 'relay' || selection.action === 'tower' || selection.action === 'barracks' || selection.action === 'wall'
    ? constructionBlocker(snapshot, selection.action) : null;
  const requirement = problem ?? placement;
  const key = taskKey(selection);
  const work = key === taskKey(player) ? player.work : snapshot.roleTasks[player.role].progress[key]?.work ?? 0;
  const prepared = construction && work >= taskWork(selection);
  const recruitment = selection.action === 'worker' || selection.action === 'builder';
  const selectionBlocked = Boolean(problem) && (!isTypingAction(selection.action) || recruitment || problem?.kind === 'tier' || problem?.kind === 'role');
  // Construction work can be prepared without a builder; placement cannot.
  const placementBlocked = Boolean(placement) && (selection.action === 'relay' || prepared);
  return {
    disabled: Boolean(context) || selectionBlocked || placementBlocked,
    ready: prepared && !requirement && !context,
    requirement,
    blocker: requirement ?? context,
    description: [requirement?.description, context?.description].filter(Boolean).join(' ')
  };
}
export function tierAvailability(snapshot: StrongholdSnapshot, player: StrongholdSnapshot['players'][number], running: boolean): {
  cost: number; disabled: boolean; blocker: ControlBlocker | null; description: string;
} {
  const cost = TIER_COSTS[snapshot.tier] ?? 0;
  const context = controlBlocker(snapshot, player, running);
  const limit: ControlBlocker | null = snapshot.tier >= TIER_MAX ? { kind: 'limit', label: 'Max tier', description: 'The highest tier is already unlocked.' } : null;
  const shortage = Math.ceil(cost - snapshot.resources);
  const supplies: ControlBlocker | null = !player.ready && shortage > 0
    ? { kind: 'supplies', label: `${shortage} supplies short`, description: `Need ${cost} shared supplies to advance; ${Math.floor(snapshot.resources)} available, ${shortage} short.` } : null;
  const blocker = limit ?? context ?? supplies;
  const action = limit ? 'All tiers are unlocked.' : player.ready ? 'Cancel your ready state.'
    : `Unlock Tier ${snapshot.tier + 1} for ${cost} shared supplies when the team is ready.`;
  return { cost, disabled: Boolean(blocker), blocker, description: `${blocker ? blocker.description + ' ' : ''}${action}` };
}
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
  const context = controlBlocker(snapshot, self, running);
  const period = daylight(snapshot.environmentElapsed).period;
  setText(elements.timer, formatBattleTime(snapshot.elapsed));
  setAttribute(elements.timer, 'datetime', `PT${Math.floor(snapshot.elapsed)}S`);
  elements.devSeason.disabled = environmentDisabled;
  setText(elements.devStatus, environmentDisabled ? context?.label ?? '' : '');
  elements.devStatus.classList.toggle('is-hidden', !environmentDisabled);
  setAttribute(elements.devStatus, 'aria-description', environmentDisabled ? context?.description ?? '' : '');
  if (elements.devSeason.value !== snapshot.season) elements.devSeason.value = snapshot.season;
  elements.nextNight.disabled = environmentDisabled || period === 'night';
  elements.nextDay.disabled = environmentDisabled || period === 'day';
  setText(elements.nextNight, period === 'night' ? 'Already night' : 'Skip to Night');
  setText(elements.nextDay, period === 'day' ? 'Already day' : 'Skip to Day');
  for (const [element, description] of [
    [elements.devSeason, environmentDisabled ? context?.description ?? '' : 'Preview a season and its effects in the current match.'],
    [elements.nextWave, environmentDisabled ? context?.description ?? '' : 'Start the next enemy wave.'],
    [elements.nextNight, environmentDisabled ? context?.description ?? '' : period === 'night' ? 'It is already night.' : 'Skip the environment clock to night without advancing battle time.'],
    [elements.nextDay, environmentDisabled ? context?.description ?? '' : period === 'day' ? 'It is already day.' : 'Skip the environment clock to day without advancing battle time.']
  ] as const) {
    setAttribute(element, 'data-tooltip', description);
    setAttribute(element, 'aria-description', description);
  }
  text('stronghold-resources', String(Math.floor(snapshot.resources)));
  text('stronghold-event', EVENT_LABELS[snapshot.event]);
  text('stronghold-event-time', `${Math.ceil(snapshot.eventIn)}s`);
  elements.worldEvent.classList.toggle('is-hidden', snapshot.event === 'peace');
  for (const button of elements.computerButtons) {
    setText(button, snapshot.computersPaused ? 'Resume computers' : 'Stop computers');
    setAttribute(button, 'aria-pressed', String(snapshot.computersPaused));
    button.disabled = !running || terminal;
    const description = button.disabled ? terminal ? 'Start a new game to control the computers.' : 'Resume gameplay before controlling the computers.'
      : 'Pause or resume simulated teammates and their training queues without stopping the battlefield or human typing.';
    setAttribute(button, 'data-tooltip', description);
    setAttribute(button, 'aria-description', description);
  }
  text('stronghold-tower-count', `${snapshot.buildings.filter(building => building.kind === 'tower' && !building.enemy && building.hp > 0).length}/${BUILDING_CAPS.tower}`);
  for (const kind of ['warrior', 'archer', 'catapult', 'builder', 'worker'] as const) text(`stronghold-${kind}-count`, `${snapshot.units.filter(unit => unit.kind === kind && unit.hp > 0).length}/${UNIT_CAPS[kind]}`);
  text('stronghold-tier-label', `Tier ${snapshot.tier}`);
  const ready = requireElement('stronghold-ready', HTMLButtonElement);
  const tier = tierAvailability(snapshot, self, running);
  text('stronghold-tier-price', String(tier.cost));
  requireElement('stronghold-tier-cost', HTMLElement).classList.toggle('is-hidden', snapshot.tier >= TIER_MAX);
  if (ready.disabled !== tier.disabled) ready.disabled = tier.disabled;
  setAttribute(ready, 'aria-label', `Tier ${snapshot.tier}. ${tier.description}`);
  setAttribute(ready, 'aria-pressed', String(self.ready));
  setAttribute(ready, 'data-tooltip', tier.description);
  setAttribute(ready, 'aria-description', tier.description);
  ready.classList.toggle('is-ready', self.ready && !challenge);
  setText(elements.tierBlocker, tier.blocker?.label ?? (self.ready ? 'Waiting for team' : ''));
  elements.tierBlocker.classList.toggle('is-hidden', !tier.blocker && !self.ready);
  text('stronghold-pause', paused ? 'Resume' : 'Pause');
  text('stronghold-tier-pause', paused ? 'Resume challenge' : 'Pause challenge');
  elements.renderBattlefield(snapshot, selected);
  elements.renderEventLog(snapshot);
  requireElement('stronghold-outcome', HTMLElement).classList.toggle('is-hidden', !terminal);
  text('stronghold-outcome-title', snapshot.phase === 'won' ? 'Victory!' : 'Your castle has fallen');
  text('stronghold-outcome-copy', snapshot.message);
  if (elements.orders.parentElement !== ownCard.actions) ownCard.actions.append(elements.orders);
  elements.orders.classList.toggle('is-hidden', !army || terminal);
  const troops = snapshot.units.filter(unit => unit.hp > 0 && isArmyUnit(unit.kind)).length;
  for (const button of elements.orders.querySelectorAll<HTMLButtonElement>('button')) {
    const noTroops = button.id !== 'stronghold-rally' && troops === 0;
    button.disabled = !running || !army || terminal || noTroops;
    const blocker = button.querySelector('[data-order-blocker]');
    if (!blocker) throw new Error('Missing Stronghold order feedback.');
    setText(blocker, context?.label ?? (noTroops ? 'No troops' : ''));
    blocker.classList.toggle('is-hidden', !context && !noTroops);
    const description = context?.description ?? (noTroops ? 'Train combat troops in Army first.'
      : button.id === 'stronghold-select-army' ? 'Select all friendly combat troops, not gatherers or builders.'
      : button.id === 'stronghold-rally' ? 'Set a shared rally point for castles and barracks.'
      : 'Move all friendly combat troops, not only the selected units.');
    setAttribute(button, 'data-tooltip', `${description} (Alt+${button.dataset.shortcut})`);
    setAttribute(button, 'aria-description', description);
  }
  setAttribute(requireElement('stronghold-rally', HTMLButtonElement), 'aria-pressed', String(rallyPlacement));
  elements.privateTyping.classList.toggle('is-hidden', terminal);
  const placing = running && !challenge && !placementCancelled && (relayPlacement || readyBuilding(snapshot) !== null);
  const cursorMode = running && !terminal && !challenge && (placing || rallyPlacement) ? 'placement' : 'default';
  if (elements.screen.dataset.cursorColor !== self.color || elements.screen.dataset.cursorMode !== cursorMode) {
    elements.screen.style.setProperty('--stronghold-cursor', playerCursor(self.color, cursorMode === 'placement'));
    elements.screen.dataset.cursorColor = self.color;
    elements.screen.dataset.cursorMode = cursorMode;
  }
  elements.placement.classList.toggle('is-hidden', !placing || terminal);
  const typingLocked = !challenge && Boolean(actionUnlockProblem(snapshot, self));
  setText(elements.typingLockLabel, `Needs Tier ${actionRequiredTier(self)}`);
  const typingDescription = !running ? 'Resume gameplay before typing.' : terminal ? 'Start a new game to type.'
    : typingLocked ? actionUnlockProblem(snapshot, self) ?? '' : 'Complete the phrase exactly to contribute typing work to the team.';
  setAttribute(elements.input, 'aria-description', typingDescription);
  setAttribute(elements.input, 'placeholder', !running ? 'Paused' : terminal ? 'Match over' : typingLocked ? `Needs Tier ${actionRequiredTier(self)}` : 'Type here');
  setAttribute(elements.typingLock, 'data-tooltip', typingLocked ? typingDescription : '');
  setAttribute(elements.typingLock, 'aria-description', typingLocked ? typingDescription : '');
  elements.typing.classList.toggle('is-tier-locked', typingLocked);
  elements.typingLock.classList.toggle('is-hidden', !typingLocked);
  elements.typingLock.querySelector('[data-typing-lock]')?.classList.remove('is-hidden');
  const inputDisabled = !running || terminal || typingLocked;
  if (elements.input.disabled !== inputDisabled) elements.input.disabled = inputDisabled;
  setAttribute(elements.length, 'aria-activedescendant', `stronghold-length-${self.length}`);
  setAttribute(elements.length, 'aria-disabled', String(!running || terminal));
  const lengthHelp = !running ? 'Resume gameplay before changing text length.' : terminal ? 'Start a new game to change text length.' : LENGTH_CONTROL_HELP;
  setAttribute(elements.length, 'data-tooltip', lengthHelp);
  setAttribute(elements.length, 'aria-description', lengthHelp);
  for (const option of elements.lengthOptions) {
    const offset = PHRASE_LENGTHS.indexOf(self.length) - PHRASE_LENGTHS.indexOf(option.length);
    option.element.style.setProperty('--length-offset', String(offset));
    option.element.style.setProperty('--length-opacity', offset === 0 ? '1' : Math.abs(offset) === 1 ? '.4' : '.18');
    setAttribute(option.element, 'aria-selected', String(option.length === self.length));
    option.element.disabled = !running || terminal;
  }
  for (const entry of elements.playerCards) {
    const player = snapshot.players.find(candidate => candidate.id === entry.id);
    if (!player) continue;
    const own = player.id === self.id;
    applyPlayerTheme(entry.card, player.color);
    entry.card.classList.toggle('is-you', own);
    const playerContext = controlBlocker(snapshot, player, running);
    const owner = own ? 'You' : `${player.name} / ${player.simulated ? 'Computer' : 'Teammate'}`;
    setText(entry.name, `${owner}${!running ? ' / paused' : !own && player.simulated && snapshot.computersPaused ? ' / stopped' : ''}${player.ready && !challenge ? ', ready' : ''}`);
    setText(entry.typed, player.typed);
    const locked = !challenge && actionUnlockProblem(snapshot, player);
    entry.typed.classList.toggle('is-hidden', Boolean(locked));
    const supplies = Math.round(typingSupplyBase(snapshot) * SEASON_BONUSES[snapshot.season].resources * 100) / 100;
    const bank = taskProgress(player, taskWork(player), supplies);
    const construction = (player.action === 'tower' || player.action === 'barracks' || player.action === 'wall') && bank.percent === 100
      ? constructionBlocker(snapshot, player.action) : null;
    const blockedTask = !challenge ? actionBlocker(snapshot, player, player.action) ?? construction : null;
    const goal = tierProgress(snapshot.players).goal;
    const percent = locked ? 0 : challenge ? player.contribution / goal * 100 : bank.percent;
    const displayPercent = challenge ? Math.round(percent * 10) / 10 : Math.round(percent);
    const width = `${percent}%`;
    if (entry.progress.style.width !== width) entry.progress.style.width = width;
    const progressBar = entry.progress.closest('[role="progressbar"]');
    if (progressBar) {
      setAttribute(progressBar, 'aria-valuenow', String(displayPercent));
      setAttribute(progressBar, 'aria-label', challenge ? `Player ${snapshot.players.indexOf(player) + 1} shared tier contribution`
        : `Player ${snapshot.players.indexOf(player) + 1} ${bank.label}`);
      const progressHelp = locked || (challenge ? `${displayPercent}% of shared tier progress`
        : `${blockedTask ? blockedTask.description + ' ' : ''}${bank.description}`);
      setAttribute(progressBar, 'aria-valuetext', progressHelp);
      setAttribute(progressBar, 'data-tooltip', progressHelp);
      setAttribute(progressBar, 'aria-description', progressHelp);
      setAttribute(progressBar, 'aria-disabled', String(Boolean(locked)));
      progressBar.classList.toggle('is-tier-locked', Boolean(locked));
      progressBar.querySelector('[data-progress-lock]')?.classList.toggle('is-hidden', !locked);
    }
    setText(entry.progressLabel, locked ? `Needs Tier ${actionRequiredTier(player)}` : challenge ? `${displayPercent}%` : blockedTask?.label ?? bank.label);
    const roleDisabled = !own || challenge || terminal || !running;
    for (const button of entry.roleButtons) {
      setAttribute(button.element, 'aria-pressed', String(button.role === player.role));
      button.element.disabled = roleDisabled;
      const description = `${button.help}${playerContext ? ' ' + playerContext.description : ''}`;
      setAttribute(button.element, 'data-tooltip', description);
      setAttribute(button.element, 'aria-description', description);
    }
    for (const group of entry.groups) {
      group.element.classList.toggle('is-hidden', group.role !== player.role);
      for (const button of group.buttons) {
        const selection = { action: button.action, constructionTier: button.tier ?? 1, upgradeTarget: button.upgrade ?? player.upgradeTarget };
        const availability = taskAvailability(snapshot, player, selection, running);
        const cost = taskCost(selection);
        const unaffordable = snapshot.resources < cost;
        button.element.classList.toggle('is-unaffordable', unaffordable);
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
        const tierLocked = availability.requirement?.kind === 'tier';
        button.element.classList.toggle('is-unavailable', availability.disabled);
        button.element.classList.toggle('is-tier-locked', tierLocked);
        button.lockIcon?.classList.toggle('is-hidden', !tierLocked);
        if (button.element.disabled !== availability.disabled) button.element.disabled = availability.disabled;
        button.element.classList.toggle('is-ready', availability.ready);
        setAttribute(button.element, 'data-blocker', availability.blocker?.kind ?? '');
        setText(button.blockerElement, availability.blocker?.label ?? '');
        button.blockerElement.classList.toggle('is-hidden', !availability.blocker);
        if (button.action === 'tower' || button.action === 'barracks' || button.action === 'wall') {
          setText(button.labelElement, `${availability.ready ? 'Place ' : ''}${button.label}`);
        }
        const selectedAction = own && relayPlacement ? button.action === 'relay' : Boolean(button.miniBar) && button.action === player.action
          && (!button.tier || button.tier === player.constructionTier) && (!button.upgrade || button.upgrade === player.upgradeTarget);
        button.element.classList.toggle('selected', selectedAction);
        setAttribute(button.element, 'aria-pressed', String(selectedAction));
        const label = button.labelElement.textContent ?? button.label;
        const detail = cost > 0 ? `Costs ${cost} shared supplies.` : 'Complete correct phrases to prepare this task.';
        const description = `${availability.description}${availability.description ? ' ' : ''}${detail}`;
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
