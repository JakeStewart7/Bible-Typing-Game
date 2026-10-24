import { executeCommand, placementProblem } from '../src/stronghold/domain/actions.ts';
import { spawnWave, updateCombat } from '../src/stronghold/domain/combat.ts';
import { StrongholdEngine } from '../src/stronghold/domain/engine.ts';
import { addBuilding, addUnit, createStronghold } from './stronghold-fixtures.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { phraseWork, taskWork } from '../src/stronghold/domain/technology.ts';
import { COSTS, isTypingAction, TEXT_LENGTH_BONUSES, TEXT_LENGTH_RANGES, TIER_CHARACTER_GOAL } from '../src/stronghold/domain/rules.ts';
import { PHRASE_LENGTHS, type Action, type Role, type UpgradeTarget, type UnitKind } from '../src/stronghold/domain/types.ts';
import { selectionBounds, troopsInRectangle } from '../src/stronghold/ui/map-controls.ts';
import { strongholdWorkspaceMarkup } from '../src/stronghold/ui/workspace.ts';
import { playerCursor, playerTheme } from '../src/stronghold/ui/player-theme.ts';
import { workProgress } from '../src/stronghold/ui/work-progress.ts';
import { equal, test } from './harness.ts';

test('Stronghold completed entries, not partial typing, fill the shared task bar for every length', () => {
  for (const length of PHRASE_LENGTHS) {
    const state = createStronghold();
    const player = state.players[0];
    if (!player) throw new Error('Missing player.');
    executeCommand(state, player, { type: 'LENGTH', length });
    executeCommand(state, player, { type: 'ACTION', action: 'worker' });
    state.resources = 0;
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase.slice(0, -1) });
    equal(player.work, 0);
    let expected = 0;
    for (let entry = 0; entry < 32; entry++) {
      expected = Math.round((expected + phraseWork(player)) * 100) / 100;
      const finished = expected >= taskWork(player);
      executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
      equal(state.resources, 0);
      equal(state.units.filter(unit => unit.kind === 'worker').length, finished ? 3 : 2);
      equal(player.work, finished ? Math.round((expected - taskWork(player)) * 100) / 100 : expected);
      equal(player.typed, '');
      if (finished) break;
    }
    equal(state.events.at(-1)?.text, 'Player 1 created Gatherer');
  }
});

test('Stronghold role mates have private text lengths and contribute their own character counts to shared work', () => {
  const state = createStronghold();
  executeCommand(state, state.players[0]!, { type: 'ACTION', action: 'resources' });
  const [you, teammate] = state.players;
  if (!you || !teammate) throw new Error('Missing players.');
  executeCommand(state, teammate, { type: 'ROLE', role: 'economy' });
  executeCommand(state, you, { type: 'LENGTH', length: 'short' });
  const firstWork = phraseWork(you);
  executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase });
  equal(you.work, firstWork);
  equal(teammate.work, firstWork);
  const oldId = you.phraseId;
  const phrase = you.phrase;
  const partial = phrase.slice(0, -1);
  executeCommand(state, you, { type: 'TYPE', phraseId: oldId, text: partial });
  executeCommand(state, teammate, { type: 'LENGTH', length: 'extra-long' });
  equal(you.work, firstWork);
  equal(you.length, 'short');
  equal(teammate.length, 'extra-long');
  equal(you.phraseId, oldId);
  equal(you.phrase, phrase);
  equal(you.typed, partial);
  const work = firstWork + phraseWork(you);
  executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase });
  equal(you.work, work);
  equal(teammate.work, work);
  const total = Math.round((work + phraseWork(teammate)) * 100) / 100;
  const rewards = Math.floor(total / 32);
  const overflow = Math.round((total - rewards * 32) * 100) / 100;
  executeCommand(state, teammate, { type: 'TYPE', phraseId: teammate.phraseId, text: teammate.phrase });
  equal(you.work, overflow);
  equal(teammate.work, overflow);
  equal(state.resources, 50 + rewards * 18);
});

test('Stronghold role mates keep independent task choices and private input while sharing matching work', () => {
  const state = createStronghold({ resources: 10000, length: 'medium', computersPaused: true });
  const [you, teammate] = state.players;
  if (!you || !teammate) throw new Error('Missing players.');
  executeCommand(state, teammate, { type: 'ROLE', role: 'economy' });
  const phrase = teammate.phrase, phraseId = teammate.phraseId;
  executeCommand(state, teammate, { type: 'TYPE', phraseId, text: phrase.slice(0, 2) });
  executeCommand(state, you, { type: 'ACTION', action: 'resources' });
  equal(teammate.action, 'worker');
  equal([teammate.phrase, teammate.phraseId, teammate.typed], [phrase, phraseId, phrase.slice(0, 2)]);
  executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase });
  equal(teammate.work, 0);
  executeCommand(state, teammate, { type: 'ACTION', action: 'resources' });
  equal(teammate.work, you.work);
  executeCommand(state, teammate, { type: 'ACTION', action: 'worker' });
  executeCommand(state, you, { type: 'READY', ready: true });
  for (let step = 0; state.phase === 'tier-up' && step < 200; step++) {
    executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase });
  }
  equal([you.action, teammate.action], ['resources', 'worker']);
});

test('Stronghold text length selections never add event log entries', () => {
  const state = createStronghold();
  const events = structuredClone(state.events);
  for (const player of state.players) {
    for (const length of PHRASE_LENGTHS) {
      executeCommand(state, player, { type: 'LENGTH', length });
      equal(player.length, length);
      equal(state.events, events);
    }
  }
});

test('Stronghold four players on one role keep unique phrases and private typing state for every length', () => {
  for (const length of PHRASE_LENGTHS) {
    const state = createStronghold({ resources: 50, length, computersPaused: true });
    executeCommand(state, state.players[0]!, { type: 'ACTION', action: 'resources' });
    for (const player of state.players) {
      executeCommand(state, player, { type: 'ROLE', role: 'economy' });
      executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase.slice(0, Math.min(2, player.phrase.length - 1)) });
      player.typingCredit = .4;
    }
    equal(new Set(state.players.map(player => player.phrase)).size, 4);
    const privateState = state.players.map(player => [player.phrase, player.phraseId, player.typed, player.length, player.typingCredit]);
    const first = state.players[0];
    if (!first) throw new Error('Missing player.');
    let points = phraseWork(first);
    let rewards = Math.floor(points / 32);
    let expected = Math.round((points - rewards * 32) * 100) / 100;
    executeCommand(state, first, { type: 'TYPE', phraseId: first.phraseId, text: first.phrase });
    equal(state.players.slice(1).map(player => [player.phrase, player.phraseId, player.typed, player.length, player.typingCredit]), privateState.slice(1));
    equal(state.players.every(player => player.work === expected), true);
    for (const player of state.players.slice(1)) {
      points = Math.round((expected + phraseWork(player)) * 100) / 100;
      const completed = Math.floor(points / 32);
      rewards += completed;
      expected = Math.round((points - completed * 32) * 100) / 100;
      executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
    }
    equal(state.players.every(player => player.work === expected), true);
    equal(state.resources, 50 + rewards * 18);
  }
});

test('Stronghold private lengths survive role switches and world events refresh only each idle player', () => {
  const state = createStronghold({ resources: 50, length: 'medium', computersPaused: true });
  const [you, teammate] = state.players;
  if (!you || !teammate) throw new Error('Missing players.');
  executeCommand(state, you, { type: 'LENGTH', length: 'short' });
  executeCommand(state, you, { type: 'ROLE', role: 'production' });
  equal(you.length, 'short');
  equal(teammate.length, 'medium');
  you.phrase = 'tree';
  executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase.slice(0, 2) });
  const phrase = you.phrase;
  const phraseId = you.phraseId;
  const teammateId = teammate.phraseId;
  state.elapsed = 59.9;
  state.waveIn = 100;
  advanceStronghold(state, .1);
  equal(state.event !== 'peace', true);
  equal(you.phrase, phrase);
  equal(you.phraseId, phraseId);
  equal(you.typed, phrase.slice(0, 2));
  equal(teammate.phraseId, teammateId + 1);
  equal(teammate.typed, '');
  executeCommand(state, you, { type: 'ROLE', role: 'economy' });
  equal(you.length, 'short');
  equal(teammate.length, 'medium');
});

test('Stronghold completed characters and spaces earn the requested bonuses and retain entry overflow', () => {
  for (const [length, phrase] of [['short', 'sun'], ['short', 'light'], ['medium', 'garden'],
    ['medium', 'a river'], ['long', 'gentle river'], ['long', 'a peaceful home'],
    ['extra-long', 'a quiet walk along the river'], ['extra-long', 'walking together beneath the stars']] as const) {
    const state = createStronghold();
    const player = state.players[0];
    if (!player) throw new Error('Missing player.');
    executeCommand(state, player, { type: 'ROLE', role: 'defenses' });
    executeCommand(state, player, { type: 'ACTION', action: 'wall' });
    executeCommand(state, player, { type: 'LENGTH', length });
    player.phrase = phrase;
    const before = 3;
    player.work = before;
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: phrase.slice(0, -1) });
    equal(player.work, before);
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: phrase });
    const points = Math.round(phrase.length * TEXT_LENGTH_BONUSES[length] * 100) / 100;
    equal(phraseWork({ phrase, length }), points);
    equal(player.work, Math.round((before + points) * 100) / 100);
    if (player.work >= taskWork(player)) {
      const readyWork = player.work;
      executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
      equal(player.work, readyWork);
    }
  }
});

test('Stronghold one progress bar fills to 100 percent without completion counts or stacked layers', () => {
  equal(workProgress(8, 32).percent, 25);
  equal(workProgress(32, 32).percent, 100);
  equal(workProgress(64, 32).percent, 100);
  equal(workProgress(32, 32).label, 'Ready');
  equal(workProgress(0, 32).label, '0%');
  equal(strongholdWorkspaceMarkup().includes('stronghold-ready-count'), false);
});

test('Stronghold free construction has proportional requirements, preserves word overflow and never accumulates further ready entries', () => {
  equal(PHRASE_LENGTHS.map(length => TEXT_LENGTH_RANGES[length]), [[1, 5], [6, 11], [12, 24], [25, 40]]);
  equal(PHRASE_LENGTHS.map(length => TEXT_LENGTH_BONUSES[length]), [1, 1.1, 1.25, 1.5]);
  for (const tier of [1, 2, 3]) {
    equal(taskWork({ action: 'tower', constructionTier: tier }), 25 * tier);
    equal(taskWork({ action: 'barracks', constructionTier: tier }), 40 * tier);
  }
  const state = createStronghold();
  state.tier = 3;
  const player = state.players[0];
  if (!player) throw new Error('Missing player.');
  executeCommand(state, player, { type: 'ROLE', role: 'defenses' });
  executeCommand(state, player, { type: 'ACTION', action: 'tower', tier: 1 });
  executeCommand(state, player, { type: 'LENGTH', length: 'extra-long' });
  player.phrase = 'a'.repeat(40);
  executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  equal(player.work, 60);
  for (let entry = 0; entry < 10; entry++) executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  equal(player.work, 60);
  executeCommand(state, player, { type: 'PLACE', kind: 'tower', point: { x: 350, y: 500 } });
  equal(player.work, 35);
  executeCommand(state, player, { type: 'PLACE', kind: 'tower', point: { x: 400, y: 500 } });
  equal(player.work, 10);
  equal(state.resources, 50);
  equal(state.buildings.filter(building => building.kind === 'tower' && !building.enemy).length, 2);
  equal(placementProblem(state, player, 'tower', { x: 450, y: 500 }), 'Complete the construction work first.');
});

test('Stronghold paid troop queues and upgrades never spend or change typing progress', () => {
  const cases: { role: Role; action: Action; cost: number; kind?: UnitKind; upgrade?: UpgradeTarget }[] = [
    { role: 'production', action: 'warrior', cost: 25, kind: 'warrior' },
    { role: 'production', action: 'archer', cost: 45, kind: 'archer' },
    { role: 'production', action: 'catapult', cost: 80, kind: 'catapult' },
    { role: 'economy', action: 'upgrade', cost: 120, upgrade: 'economy' },
    { role: 'production', action: 'upgrade', cost: 60, upgrade: 'warrior' },
    { role: 'production', action: 'upgrade', cost: 100, upgrade: 'archer' },
    { role: 'production', action: 'upgrade', cost: 160, upgrade: 'catapult' },
    { role: 'defenses', action: 'upgrade', cost: 75, upgrade: 'tower-1' },
    { role: 'defenses', action: 'upgrade', cost: 125, upgrade: 'tower-2' },
    { role: 'defenses', action: 'upgrade', cost: 180, upgrade: 'tower-3' }
  ];
  for (const purchase of cases) {
    const state = createStronghold();
    state.tier = 3; state.resources = 1000;
    for (const tier of [1, 2, 3]) addBuilding(state, 'barracks', { x: 600 + tier * 50, y: 550 }, true, false, tier);
    const player = state.players[0];
    if (!player) throw new Error('Missing player.');
    executeCommand(state, player, { type: 'ROLE', role: purchase.role });
    executeCommand(state, player, { type: 'ACTION', action: purchase.role === 'production' ? 'barracks' : purchase.role === 'defenses' ? 'wall' : 'worker', tier: 1 });
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase.slice(0, 2) });
    const beforePlayer = structuredClone(player);
    const beforeTasks = structuredClone(state.roleTasks);
    state.resources = purchase.cost - 1;
    const unaffordable = structuredClone(state);
    let insufficient = false;
    try { executeCommand(state, player, { type: 'ACTION', action: purchase.action, upgrade: purchase.upgrade }); }
    catch (error) { insufficient = error instanceof Error && error.message.includes(`Need ${purchase.cost}`); }
    equal(insufficient, true);
    equal(state, unaffordable);
    state.resources = 1000;
    const count = state.units.filter(unit => unit.kind === purchase.kind).length;
    executeCommand(state, player, { type: 'ACTION', action: purchase.action, upgrade: purchase.upgrade });
    equal(state.resources, 1000 - purchase.cost);
    equal(player, beforePlayer);
    equal(state.roleTasks, beforeTasks);
    if (purchase.kind) {
      equal(state.units.filter(unit => unit.kind === purchase.kind).length, count);
      equal(state.buildings.flatMap(building => building.trainingQueue).filter(order => order.kind === purchase.kind).length, 1);
    }
    if (purchase.upgrade) equal(state.technology[purchase.upgrade], 1);
    equal(state.events.at(-1)?.text.startsWith('Player 1 '), true);
    state.resources = 0;
    const beforeFailure = structuredClone(state);
    let rejected = false;
    try { executeCommand(state, player, { type: 'ACTION', action: purchase.action, upgrade: purchase.upgrade }); }
    catch (error) { rejected = error instanceof Error; }
    equal(rejected, true);
    equal(state, beforeFailure);
  }
});

test('Stronghold only the six typing actions have mini experience bars instead of price or Free badges', () => {
  const expected: Action[] = ['resources', 'worker', 'barracks', 'builder', 'wall', 'tower'];
  for (const action of expected) {
    equal(COSTS[action], 0);
    equal(isTypingAction(action), true);
  }
  const markup = strongholdWorkspaceMarkup();
  const tiles = [...markup.matchAll(/<button[^>]*data-action="([^"]+)"[\s\S]*?<\/button>/g)];
  equal(tiles.length > 0, true);
  for (const tile of tiles) {
    const typing = expected.some(action => action === tile[1]);
    equal(tile[0].includes('data-task-progress'), typing);
    equal(tile[0].includes('class="stronghold-cost"'), !typing);
    equal(tile[0].includes('>Free'), false);
  }
});

test('Stronghold free builders and walls retain only one full bar and placement resets progress', () => {
  const state = createStronghold();
  const player = state.players[0];
  if (!player) throw new Error('Missing player.');
  state.resources = 0;
  executeCommand(state, player, { type: 'ROLE', role: 'defenses' });
  executeCommand(state, player, { type: 'ACTION', action: 'builder' });
  let builderWork = 0, builders = 1;
  for (let entry = 0; entry < 20; entry++) {
    if (builderWork < 32) builderWork = Math.round((builderWork + phraseWork(player)) * 100) / 100;
    if (builderWork >= 32 && builders < 4) { builderWork = Math.round((builderWork - 32) * 100) / 100; builders++; }
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
    equal(player.work, builderWork);
  }
  equal(state.units.filter(unit => unit.kind === 'builder').length, 4);
  equal(player.work, builderWork);
  equal(state.resources, 0);
  executeCommand(state, player, { type: 'ACTION', action: 'wall' });
  let wallWork = 0;
  for (let entry = 0; entry < 9; entry++) {
    if (wallWork < 32) wallWork = Math.round((wallWork + phraseWork(player)) * 100) / 100;
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
    equal(player.work, wallWork);
  }
  equal(player.work, wallWork);
  executeCommand(state, player, { type: 'PLACE', kind: 'wall', point: { x: 350, y: 500 } });
  equal(player.work, Math.round((wallWork - 32) * 100) / 100);
  equal(placementProblem(state, player, 'wall', { x: 400, y: 500 }), 'Complete the construction work first.');
  equal(state.resources, 0);
  executeCommand(state, player, { type: 'ACTION', action: 'builder' });
  equal(player.work, builderWork);
});

test('Stronghold relays require only legal placement and do not spend typing work', () => {
  const state = createStronghold();
  const player = state.players[0];
  if (!player) throw new Error('Missing player.');
  const points = phraseWork(player);
  executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  equal(player.work, points);
  const phraseId = player.phraseId;
  equal(placementProblem(state, player, 'relay', { x: 500, y: 595 }), 'Leave space between buildings.');
  executeCommand(state, player, { type: 'PLACE', kind: 'relay', point: { x: 350, y: 540 } });
  equal(state.resources, 20);
  equal(player.work, points);
  equal(player.phraseId, phraseId);
  equal(state.events.at(-1)?.text, 'Player 1 placed Relay');
  executeCommand(state, player, { type: 'ROLE', role: 'army' });
  equal(placementProblem(state, player, 'relay', { x: 650, y: 540 }), 'This action belongs to another role.');
});

test('Stronghold army control can always type for shared supplies', () => {
  const engine = new StrongholdEngine();
  engine.send('you', { type: 'SET_SEASON', season: 'summer' });
  engine.send('you', { type: 'ROLE', role: 'army' });
  engine.send('you', { type: 'ACTION', action: 'resources' });
  let work = 0;
  for (let entry = 0; work < 32 && entry < 10; entry++) {
    const player = engine.snapshot('you').players.find(candidate => candidate.id === 'you');
    if (!player) throw new Error('Missing player.');
    work = Math.round((work + phraseWork(player)) * 100) / 100;
    engine.send('you', { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  }
  const snapshot = engine.snapshot('you');
  equal(snapshot.resources, 68);
  equal(snapshot.players.filter(player => player.role === 'army').every(player => player.work === Math.round((work - 32) * 100) / 100), true);
  equal(snapshot.players.every(player => player.id === 'you' || player.phrase === ''), true);
});

test('Stronghold event history retains player attribution, world waves and terminal outcomes', () => {
  const state = createStronghold();
  spawnWave(state);
  equal(state.events.at(-1)?.playerId, null);
  equal(state.events.at(-1)?.text, 'Wave 1 approaching');
  const firstEvent = state.events[0];
  const castle = state.buildings.find(building => building.kind === 'castle');
  if (!castle) throw new Error('Missing castle.');
  castle.hp = 0;
  updateCombat(state, .1);
  const eventCount = state.events.length;
  updateCombat(state, .1);
  equal(state.events.length, eventCount);
  equal(state.events[0], firstEvent);
  equal(state.events.some(event => event.text === 'Home base destroyed: defeat'), true);
});

test('Stronghold drag selection includes builders and gatherers in both directions but excludes enemies', () => {
  const state = createStronghold();
  state.units = [];
  const warrior = addUnit(state, 'warrior', { x: 100, y: 100 });
  const archer = addUnit(state, 'archer', { x: 150, y: 150 });
  addUnit(state, 'invader', { x: 120, y: 120 });
  const worker = addUnit(state, 'worker', { x: 130, y: 130 });
  const builder = addUnit(state, 'builder', { x: 140, y: 140 });
  addUnit(state, 'catapult', { x: 300, y: 300 });
  const start = { x: 90, y: 90 }, end = { x: 170, y: 170 };
  equal(troopsInRectangle(state.units, start, end), [warrior.id, archer.id, worker.id, builder.id]);
  equal(troopsInRectangle(state.units, end, start), [warrior.id, archer.id, worker.id, builder.id]);
  equal(selectionBounds(end, start), { x: 90, y: 90, width: 80, height: 80 });
});

test('Stronghold central private typing, length controls and distinct costs replace obsolete captions and coordinates', () => {
  const markup = strongholdWorkspaceMarkup();
  equal(markup.includes('id="stronghold-private"'), true);
  equal(markup.includes('id="stronghold-event-log"'), true);
  equal(markup.includes('class="stronghold-cost">Free'), false);
  equal(markup.includes('data-task-progress role="progressbar"'), true);
  equal(markup.includes('id="stronghold-task-'), false);
  equal(markup.includes('stronghold-build-x'), false);
  equal(markup.includes('stronghold-order-x'), false);
  for (const length of PHRASE_LENGTHS) equal(markup.includes(`value="${length}"`), true);
  equal(markup.includes('aria-label="Army"'), true);
  equal(markup.includes('aria-label="Unit Control"'), true);
  equal(markup.includes('Army production'), false);
  equal(markup.includes('Army control'), false);
  equal(markup.includes('id="stronghold-world-event" class="stronghold-world-event is-hidden"'), true);
  equal(markup.includes('class="stronghold-work-track"'), true);
});

test('Stronghold Army bot waits for Tier 1 before preparing barracks and training units', () => {
  const state = createStronghold();
  state.resources = 1000;
  state.waveIn = 10000;
  for (let step = 0; step < 100; step++) advanceStronghold(state, .25);
  equal(state.tier, 0);
  equal(state.buildings.some(building => building.kind === 'barracks'), false);
  equal(state.players.find(player => player.role === 'production')?.action, 'resources');
  equal(state.roleTasks.production.progress['barracks:1'], undefined);
  const player = state.players[0]!;
  executeCommand(state, player, { type: 'READY', ready: true });
  for (let entry = 0; state.phase === 'tier-up' && entry < TIER_CHARACTER_GOAL; entry++) {
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  }
  equal(state.tier, 1);
  for (let step = 0; step < 480; step++) advanceStronghold(state, .25);
  equal(state.buildings.some(building => building.kind === 'barracks' && building.progress === 1), true);
  equal(state.events.some(event => event.playerId === 'bot-1' && event.text === 'Player 2 created Warrior'), true);
});

test('Stronghold player themes pair light highlights and dark basic cursors for every squad member', () => {
  for (const player of createStronghold().players) {
    const theme = playerTheme(player.color);
    equal(theme.color, player.color);
    equal(theme.light !== theme.bold, true);
    equal(decodeURIComponent(playerCursor(player.color)).includes(`color="${theme.bold}"`), true);
    equal(decodeURIComponent(playerCursor(player.color)).includes('fill="none" stroke="currentColor"'), true);
    const placementCursor = decodeURIComponent(playerCursor(player.color, true));
    equal(placementCursor.includes('M20 23.5h7m-3.5-3.5v7'), true);
    equal(placementCursor.includes(`stroke="${theme.bold}"`), true);
    equal(placementCursor !== decodeURIComponent(playerCursor(player.color)), true);
  }
});

test('Stronghold every player has a distinct muted text shade readable on all shared panel backgrounds', () => {
  function luminance(hex: string): number {
    equal(/^#[a-f0-9]{6}$/.test(hex), true);
    const channels = [1, 3, 5].map(offset => {
      const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
  }
  const themes = createStronghold(undefined, 'spring').players.map(player => playerTheme(player.color));
  equal(new Set(themes.map(theme => theme.text)).size, 4);
  for (const theme of themes) {
    const accents: readonly string[] = [theme.color, theme.bold];
    equal(accents.includes(theme.text), false);
    const text = luminance(theme.text);
    for (const background of ['#ffffff', '#c3c3c3', theme.light]) {
      const surface = luminance(background);
      equal((Math.max(text, surface) + .05) / (Math.min(text, surface) + .05) >= 4.5, true);
    }
  }
});
