import { addBuilding, addUnit, createStronghold } from './stronghold-fixtures.ts';
import { buildingDescription, buildingMarkup, constructionProgress, resourceNodeDescription, unitDescription, unitMarkup } from '../src/stronghold/ui/battlefield.ts';
import { lengthTooltip, orderTooltip, strongholdWorkspaceMarkup } from '../src/stronghold/ui/workspace.ts';
import { equal, test } from './harness.ts';
import { PLAYER_COLORS } from '../src/stronghold/domain/types.ts';
import { StrongholdEngine } from '../src/stronghold/domain/engine.ts';
import { playerPanelName, taskAvailability, tierAvailability } from '../src/stronghold/ui/view.ts';
import { taskButtonPresentation, taskProgress } from '../src/stronghold/ui/work-progress.ts';
import { readyBuilding } from '../src/stronghold/ui/map-controls.ts';
import { taskWork } from '../src/stronghold/domain/technology.ts';

test('Stronghold role and order icons are outlined and cost badges reuse the resource symbol', () => {
  const markup = strongholdWorkspaceMarkup();
  const sword = /id="stronghold-role-you-production"[\s\S]*?<\/button>/.exec(markup)?.[0];
  const economy = /id="stronghold-role-you-economy"[\s\S]*?<\/button>/.exec(markup)?.[0];
  if (!sword || !economy) throw new Error('Missing role icons.');
  equal(sword.includes('fill="none"'), true);
  equal(sword.includes('fill="currentColor"'), false);
  equal(economy.includes('class="stronghold-symbol stronghold-symbol--resource"'), true);
  equal(economy.includes('<svg'), false);
  equal(sword.includes('M7 15L17 3L22 2L21 7L11 19Z'), true);
  const cursor = /id="stronghold-role-you-army"[\s\S]*?<\/button>/.exec(markup)?.[0];
  equal(cursor?.includes('fill="none" stroke="currentColor"'), true);
  equal(cursor?.includes('fill="currentColor"'), false);
  equal(markup.includes('id="stronghold-phrase" class="text-display" data-horizontal-scroll="true"'), true);
  equal(markup.includes('id="stronghold-tier-price">300</span>'), true);
  const prices = [...markup.matchAll(/class="stronghold-cost"[^>]*>([\s\S]*?)<\/i>/g)];
  equal(prices.length > 10, true);
  equal(prices.every(price => price[1]?.includes('stronghold-symbol--resource')), true);
  for (const id of ['select-army', 'defend', 'assault', 'rally']) {
    const button = new RegExp(`id="stronghold-${id}"[\\s\\S]*?<\\/button>`).exec(markup)?.[0];
    equal(button?.includes('<svg'), true);
    equal(button?.includes('<kbd aria-hidden="true">'), true);
  }
});

test('Stronghold enemies use dark-red squares, diamonds and siege carts with red outlines', () => {
  const state = createStronghold();
  for (const formation of [null, 'warrior', 'archer', 'catapult'] as const) {
    const markup = unitMarkup(addUnit(state, 'invader', { x: 500, y: 100 }, formation), false);
    equal(markup.includes('fill="#870018" stroke="#ff1726" stroke-width="2"'), true);
    equal(markup.includes(formation === 'archer' ? 'M0 -10 L8 0 L0 10 L-8 0 Z'
      : formation === 'catapult' ? 'data-catapult' : '<rect x="-8" y="-8" width="16" height="16"'), true);
    equal(markup.includes('#91a8b7'), false);
  }
  equal(unitMarkup(addUnit(state, 'warrior', { x: 500, y: 500 }), false).includes('fill="#dce2e8" stroke="#65727e"'), true);
});

test('Stronghold concise controls retain accessible labels and essential costs', () => {
  const markup = strongholdWorkspaceMarkup();
  equal(markup.includes("Private phrase / teammate's typing below"), false);
  equal(markup.includes('Waiting to type...'), false);
  equal(markup.includes('(T1 unit)'), false);
  equal(markup.includes('class="stronghold-tier-help"'), false);
  equal(markup.includes('<span>Supplies</span>'), false);
  equal(markup.includes('<span class="sr-only">Shared supplies: </span>'), true);
  equal(markup.includes('Typing produces shared supplies.'), true);
  equal(markup.indexOf('id="stronghold-resources"') < markup.indexOf('id="stronghold-tower-count"'), true);
  equal(markup.includes('<span class="sr-only"> supplies</span>'), true);
  equal(markup.includes('for="stronghold-input"'), true);
  equal(markup.includes('role="group" aria-label="Player 1 role"'), true);
  equal(markup.includes('class="stronghold-role-select"'), false);
  for (const id of ['stronghold-castle', 'stronghold-enemy', 'stronghold-wave']) {
    equal(markup.includes(`id="${id}"`), false);
  }
  equal(markup.includes('id="stronghold-season" class="stronghold-season"'), true);
  equal(markup.includes('class="stronghold-tier-mount"'), true);
  equal(markup.includes('id="stronghold-dev-color"'), true);
  for (const [name, color] of Object.entries(PLAYER_COLORS)) equal(markup.includes(`<option value="${color}">${name}</option>`), true);
});

test('Stronghold repeated instructions live in focusable tooltips rather than player panels', () => {
  const markup = strongholdWorkspaceMarkup();
  const cards = [...markup.matchAll(/<section class="stronghold-player"[\s\S]*?<\/section>/g)];
  equal(cards.length, 4);
  for (const [card] of cards) {
    const visible = card.replace(/<[^>]*>/g, '');
    equal(visible.includes('Typing produces shared supplies.'), false);
    equal(visible.includes('Right-click to move.'), false);
    equal(visible.includes('Supplies'), true);
    equal(card.includes('data-tooltip="Unit Control. Typing produces shared supplies.'), true);
  }
  equal(markup.includes('id="stronghold-placement-label" tabindex="0"'), true);
  equal(markup.includes('aria-label="Current selection" title="Right-click'), true);
  equal(markup.includes('aria-label="Shared tier challenge progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"'), true);
  equal(markup.includes('id="stronghold-typing-lock-label">Needs Tier 1'), true);
  equal(markup.includes('stronghold-guide-content'), true);
});

test('Stronghold compact command bar retains unique controls and leaves the map and player panels outside it', () => {
  const markup = strongholdWorkspaceMarkup();
  const bar = markup.match(/<header class="stronghold-command-bar"[\s\S]*?<\/header>/)?.[0];
  if (!bar) throw new Error('Missing Stronghold command bar.');
  for (const id of ['stronghold-pause', 'stronghold-restart', 'stronghold-computers', 'stronghold-music',
    'stronghold-volume', 'stronghold-open-credits', 'stronghold-ready', 'stronghold-dev-form']) {
    equal(bar.includes(`id="${id}"`), true);
    equal(markup.split(`id="${id}"`).length, 2);
  }
  equal(bar.includes('stronghold-guide-content'), true);
  equal(bar.includes('stronghold-map-camera'), false);
  equal(bar.includes('stronghold-squad'), false);
  for (const tier of [1, 2, 3]) equal(markup.includes(`Barracks T${tier}`), true);
});

test('Stronghold tier locks take precedence over shortages and explain the next upgrade tier', () => {
  const engine = new StrongholdEngine({ resources: 0, length: 'short', computersPaused: true });
  engine.send('you', { type: 'ROLE', role: 'production' });
  const snapshot = engine.snapshot('you'), player = snapshot.players[0]!;
  const archer = taskAvailability(snapshot, player, { action: 'archer', constructionTier: 1, upgradeTarget: 'archer' }, true);
  equal(archer.disabled, true);
  equal(archer.blocker?.kind, 'tier');
  equal(archer.blocker?.label, 'Needs Tier 2');
  const economy = new StrongholdEngine({ resources: 0, length: 'short', computersPaused: true }).snapshot('you');
  economy.technology.economy = 2;
  const upgrade = { action: 'upgrade' as const, constructionTier: 1, upgradeTarget: 'economy' as const };
  equal(taskAvailability(economy, economy.players[0]!, upgrade, true).blocker?.label, 'Needs Tier 1');
  economy.tier = 3; economy.technology.economy = 5;
  equal(taskAvailability(economy, economy.players[0]!, upgrade, true).blocker?.label, 'Max level');
});

test('Stronghold troop availability distinguishes missing barracks, construction, shortages and queued population limits', () => {
  const engine = new StrongholdEngine({ resources: 0, tier: 1, length: 'short', computersPaused: true });
  engine.send('you', { type: 'ROLE', role: 'production' });
  const snapshot = engine.snapshot('you'), player = snapshot.players[0]!;
  const selection = { action: 'warrior' as const, constructionTier: 1, upgradeTarget: 'warrior' as const };
  equal(taskAvailability(snapshot, player, selection, true).blocker?.label, 'Build T1 barracks');
  const state = createStronghold();
  const barracks = addBuilding(state, 'barracks', { x: 620, y: 570 }, false, false, 1);
  snapshot.buildings.push(barracks);
  equal(taskAvailability(snapshot, player, selection, true).blocker?.label, 'Finish T1 barracks');
  barracks.progress = 1;
  equal(taskAvailability(snapshot, player, selection, true).blocker?.label, '60 supplies short');
  snapshot.resources = 60;
  equal(taskAvailability(snapshot, player, selection, true).disabled, false);
  equal(taskAvailability(snapshot, player, selection, true).blocker, null);
  barracks.trainingQueue = Array.from({ length: 16 }, () => ({ kind: 'warrior', playerId: 'you' }));
  snapshot.resources = 0;
  equal(taskAvailability(snapshot, player, selection, true).blocker?.label, 'Limit 18/18');
});

test('Stronghold construction can bank work without builders but ready placement explains builder and building caps', () => {
  const engine = new StrongholdEngine({ resources: 0, tier: 1, length: 'short', computersPaused: true });
  engine.send('you', { type: 'ROLE', role: 'defenses' });
  engine.send('you', { type: 'ACTION', action: 'tower', tier: 1 });
  const snapshot = engine.snapshot('you'), player = snapshot.players[0]!;
  snapshot.units = snapshot.units.filter(unit => unit.kind !== 'builder');
  const selection = { action: 'tower' as const, constructionTier: 1, upgradeTarget: 'economy' as const };
  equal(taskAvailability(snapshot, player, selection, true).disabled, false);
  equal(taskAvailability(snapshot, player, selection, true).blocker?.label, 'Needs builder');
  player.work = taskWork(player);
  equal(taskAvailability(snapshot, player, selection, true).disabled, true);
  equal(readyBuilding(snapshot), null);
  const state = createStronghold();
  snapshot.units.push(addUnit(state, 'builder', { x: 500, y: 540 }));
  equal(taskAvailability(snapshot, player, selection, true).ready, true);
  equal(readyBuilding(snapshot), 'tower');
  for (let count = 0; count < 8; count++) snapshot.buildings.push(addBuilding(state, 'tower', { x: 300 + count * 40, y: 400 }, false));
  equal(taskAvailability(snapshot, player, selection, true).blocker?.label, 'Limit 8/8');
  equal(taskAvailability(snapshot, player, selection, true).disabled, true);
  equal(readyBuilding(snapshot), null);
});

test('Stronghold unavailable controls identify pauses, tier challenges, finished matches and teammate ownership', () => {
  const snapshot = new StrongholdEngine({ resources: 50, length: 'short', computersPaused: true }).snapshot('you');
  const player = snapshot.players[0]!;
  const selection = { action: 'resources' as const, constructionTier: 1, upgradeTarget: 'economy' as const };
  equal(taskAvailability(snapshot, player, selection, false).blocker?.label, 'Paused');
  const teammate = snapshot.players.find(other => other.role === 'army')!;
  equal(taskAvailability(snapshot, teammate, selection, true).blocker?.label, 'Computer');
  equal(taskAvailability(snapshot, teammate, selection, true).disabled, true);
  snapshot.phase = 'tier-up';
  equal(taskAvailability(snapshot, player, selection, true).blocker?.label, 'Tier challenge');
  snapshot.phase = 'lost';
  equal(taskAvailability(snapshot, player, selection, true).blocker?.label, 'Match over');
});

test('Stronghold tier button contains only the tier and price, keeping blockers in accessible help', () => {
  const markup = strongholdWorkspaceMarkup();
  const button = /id="stronghold-ready"[\s\S]*?<\/button>/.exec(markup)?.[0];
  if (!button) throw new Error('Missing tier button.');
  equal(button.includes('stronghold-tier-action'), false);
  equal(button.includes('Tier Up'), false);
  equal(button.includes('id="stronghold-tier-label">Tier 0'), true);
  equal(button.includes('id="stronghold-tier-price">300'), true);
  equal(button.includes('aria-pressed="false"'), true);
  equal(markup.includes('id="stronghold-tier-blocker"'), false);
  equal((markup.match(/data-action-blocker/g) ?? []).length, 64);
  const snapshot = new StrongholdEngine({ resources: 50, length: 'short', computersPaused: true }).snapshot('you');
  const player = snapshot.players[0]!;
  equal(tierAvailability(snapshot, player, true).blocker?.label, '250 supplies short');
  snapshot.resources = 300;
  equal(tierAvailability(snapshot, player, true).disabled, false);
  equal(tierAvailability(snapshot, player, false).blocker?.label, 'Paused');
  player.ready = true; snapshot.resources = 0;
  equal(tierAvailability(snapshot, player, true).disabled, false);
  snapshot.tier = 3;
  equal(tierAvailability(snapshot, player, true).blocker?.label, 'Max tier');
});

test('Stronghold player panels show names once without redundant ownership or computer state captions', () => {
  const state = createStronghold();
  equal(state.players.map((player, index) => playerPanelName(player, index)), ['Player 1', 'Miriam', 'Caleb', 'Esther']);
  for (const player of state.players) {
    const original = playerPanelName(player, state.players.indexOf(player));
    player.ready = true; player.simulated = !player.simulated;
    equal(playerPanelName(player, state.players.indexOf(player)), original);
  }
  equal(playerPanelName({ name: 'Alex' }, 0), 'Alex');
  const markup = strongholdWorkspaceMarkup();
  for (const id of ['you', 'bot-1', 'bot-2', 'bot-3']) {
    equal(markup.includes(`<h3 id="stronghold-name-${id}">`), true);
    equal(markup.includes(`<small id="stronghold-name-${id}"`), false);
    equal(markup.split(`id="stronghold-name-${id}"`).length, 2);
  }
});

test('Stronghold work bars contain only percentages while buttons explain output and the next action', () => {
  const player = createStronghold().players[0]!;
  for (const action of ['worker', 'builder', 'resources', 'tower', 'barracks', 'wall'] as const) {
    for (const work of [0, 16, 32, 64, 100]) {
      equal(/^\d+%$/.test(taskProgress({ ...player, action, work }, 64, 21.6).label), true);
    }
  }
  equal(taskButtonPresentation({ ...player, action: 'worker' }, 'Gatherer', 18).label, '+1 Gatherer');
  equal(taskButtonPresentation({ ...player, action: 'builder' }, 'Builder', 18).label, '+1 Builder');
  equal(taskButtonPresentation({ ...player, action: 'resources' }, 'Supplies', 21.6).label, '+21.6 Supplies');
  equal(taskButtonPresentation({ ...player, action: 'tower' }, 'Tower T1', 18).label, '+1 Tower T1');
  equal(taskButtonPresentation({ ...player, action: 'tower' }, 'Tower T1', 18, true).label, 'Place Tower T1');
  equal(taskButtonPresentation({ ...player, action: 'barracks', constructionTier: 3 }, 'Barracks T3', 18, true).label, 'Place Barracks T3');
  equal(taskButtonPresentation({ ...player, action: 'warrior' }, 'Warrior', 18).label, '+1 Warrior');
  equal(taskButtonPresentation({ ...player, action: 'warrior' }, 'Warrior', 18).description.includes('training order'), true);
  equal(taskButtonPresentation({ ...player, action: 'relay' }, 'Relay', 18).label, 'Place Relay');
  equal(taskButtonPresentation({ ...player, action: 'upgrade' }, 'Upgrade Economy', 18).label, 'Upgrade Economy');
});

test('Stronghold task tooltips describe distinct abilities, barracks specializations and upgrade effects', () => {
  const player = createStronghold().players[0]!;
  const descriptions = (['worker', 'builder', 'resources', 'tower', 'wall', 'relay', 'warrior', 'archer', 'catapult'] as const)
    .map(action => taskButtonPresentation({ ...player, action }, action, 18).description);
  equal(new Set(descriptions).size, descriptions.length);
  equal(descriptions[0]?.includes('delivers them'), true);
  equal(descriptions[1]?.includes('repairs'), true);
  equal(descriptions[3]?.includes('Automatically fires'), true);
  equal(descriptions[4]?.includes('Scroll to rotate'), true);
  equal(descriptions[8]?.includes('extra damage to buildings'), true);
  for (const [index, troop] of ['Warriors', 'Archers', 'Catapults'].entries()) {
    equal(taskButtonPresentation({ ...player, action: 'barracks', constructionTier: index + 1 }, 'Barracks', 18).description.includes(`Trains ${troop}`), true);
  }
  equal(taskButtonPresentation({ ...player, action: 'upgrade', upgradeTarget: 'economy' }, 'Economy', 18).description.includes('2 base supplies'), true);
  for (const upgradeTarget of ['warrior', 'archer', 'catapult'] as const) {
    equal(taskButtonPresentation({ ...player, action: 'upgrade', upgradeTarget }, upgradeTarget, 18).description.includes('future recruits'), true);
  }
});

test('Stronghold construction bars and builder descriptions show the remaining job rather than full health', () => {
  const state = createStronghold();
  const project = addBuilding(state, 'wall', { x: 500, y: 400 });
  const builder = addUnit(state, 'builder', { x: 480, y: 400 });
  for (const [progress, remaining] of [[0, 100], [.25, 75], [.5, 50], [.999, 1], [1, 0]]) {
    project.progress = progress!;
    equal(constructionProgress(project).remaining, remaining);
    equal(constructionProgress(project).label, `${remaining}% left`);
  }
  project.progress = .25;
  equal(unitDescription(builder, 0, project).includes('75% left'), true);
  equal(buildingDescription(project).includes('75% left'), true);
  equal(buildingMarkup(project).includes('data-construction-fill'), true);
  equal(unitMarkup(builder, false).includes('data-construction-left'), true);
  equal(buildingMarkup(project, false).includes('data-construction'), false);
  equal(unitMarkup(builder, false, false).includes('data-construction'), false);
});

test('Stronghold map and control tooltips explain gameplay instead of repeating labels', () => {
  const state = createStronghold();
  const purposes = { worker: 'harvests supplies', builder: 'constructs placed buildings', warrior: 'close-range combat',
    archer: 'attacks from a distance', catapult: 'Strong against buildings', invader: 'advancing on your castle' };
  for (const kind of ['worker', 'builder', 'warrior', 'archer', 'catapult', 'invader'] as const) {
    const unit = addUnit(state, kind, { x: 500, y: 400 });
    equal(unitDescription(unit).includes(purposes[kind]), true);
    equal(unitDescription(unit).includes('/'), true);
  }
  const node = { id: 900, x: 500, y: 400, remaining: 600, rich: false, cooldown: 0 };
  equal(resourceNodeDescription(state, node).includes('600 base supplies'), true);
  equal(resourceNodeDescription(state, node).includes('yield 3 before seasonal bonuses'), true);
  equal(resourceNodeDescription(state, node).includes('0.8s per node'), true);
  equal(resourceNodeDescription(state, { ...node, rich: true }).includes('yield 6'), true);
  equal(resourceNodeDescription(state, { ...node, remaining: 0 }).includes('find another source'), true);
  equal(orderTooltip('stronghold-defend').includes('in front of your castle'), true);
  equal(orderTooltip('stronghold-assault').includes('enemy base'), true);
  equal(lengthTooltip('extra-long'), 'Extra Long text: 25-40 characters. Correct entries earn 1.5x typing work.');
  const markup = strongholdWorkspaceMarkup();
  for (const id of ['stronghold-pause', 'stronghold-restart', 'stronghold-volume', 'stronghold-open-credits', 'stronghold-dev-resources']) {
    const control = new RegExp(`id="${id}"[^>]*>`).exec(markup)?.[0];
    equal(control?.includes('title='), true);
  }
});
