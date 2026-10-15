import { executeCommand, placementProblem } from '../src/stronghold/domain/actions.ts';
import { spawnWave, updateCombat } from '../src/stronghold/domain/combat.ts';
import { StrongholdEngine } from '../src/stronghold/domain/engine.ts';
import { addUnit, createStronghold } from '../src/stronghold/domain/state.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { taskWork } from '../src/stronghold/domain/technology.ts';
import { PHRASE_LENGTHS } from '../src/stronghold/domain/types.ts';
import { selectionBounds, troopsInRectangle } from '../src/stronghold/ui/map-controls.ts';
import { strongholdWorkspaceMarkup } from '../src/stronghold/ui/workspace.ts';
import { playerCursor, playerTheme } from '../src/stronghold/ui/player-theme.ts';
import { bankedWork } from '../src/stronghold/ui/work-progress.ts';
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
    const points = player.phrase.length;
    const entries = Math.ceil(taskWork(player) / points);
    for (let entry = 1; entry <= entries; entry++) {
      executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
      equal(state.resources, 0);
      equal(state.units.filter(unit => unit.kind === 'worker').length, entry === entries ? 3 : 2);
      equal(player.work, entry * points % taskWork(player));
      equal(player.typed, '');
    }
    equal(state.events.at(-1)?.text, 'Player 1 created Gatherer');
  }
});

test('Stronghold changing length preserves earned work and synchronizes role mates', () => {
  const state = createStronghold();
  const [you, teammate] = state.players;
  if (!you || !teammate) throw new Error('Missing players.');
  executeCommand(state, teammate, { type: 'ROLE', role: 'economy' });
  executeCommand(state, you, { type: 'LENGTH', length: 'short' });
  executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase });
  equal(you.work, 4);
  equal(teammate.work, 4);
  const oldId = you.phraseId;
  executeCommand(state, teammate, { type: 'LENGTH', length: 'extra-long' });
  equal(you.work, 4);
  equal(you.length, 'extra-long');
  equal(you.phraseId > oldId, true);
  executeCommand(state, you, { type: 'TYPE', phraseId: you.phraseId, text: you.phrase });
  equal(you.work, 20);
  equal(teammate.work, 20);
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

test('Stronghold work equals completed character count including spaces, with no length multiplier or truncation', () => {
  for (const [length, phrase] of [['short', 'sun'], ['short', 'light'], ['medium', 'garden'],
    ['medium', 'a river'], ['long', 'sunshine'], ['long', 'a peaceful home'],
    ['extra-long', 'a peaceful home'], ['extra-long', 'a quiet walk in the woods']] as const) {
    const state = createStronghold();
    const player = state.players[0];
    if (!player) throw new Error('Missing player.');
    executeCommand(state, player, { type: 'ROLE', role: 'defenses' });
    executeCommand(state, player, { type: 'ACTION', action: 'wall' });
    executeCommand(state, player, { type: 'LENGTH', length });
    player.phrase = phrase;
    const before = taskWork(player) * 5 + 3;
    player.work = before;
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: phrase.slice(0, -1) });
    equal(player.work, before);
    executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: phrase });
    equal(player.work, before + phrase.length);
  }
});

test('Stronghold bank colors loop through three light red shades without losing the ready count', () => {
  const first = bankedWork(32, 32);
  const second = bankedWork(64, 32);
  const third = bankedWork(96, 32);
  equal(new Set([first.base, second.base, third.base]).size, 3);
  equal(bankedWork(128, 32).base, first.base);
  equal(bankedWork(160, 32).base, second.base);
  const bank = bankedWork(32 * 100 + 8, 32);
  equal(bank.ready, 100);
  equal(bank.percent, 25);
  equal(bank.label, '100 ready');
  equal(bank.base, first.base);
  equal(bankedWork(0, 32).base, '#fff');
});

test('Stronghold builders and walls use character work without supplies, and capped builder work remains banked', () => {
  const state = createStronghold();
  const player = state.players[0];
  if (!player) throw new Error('Missing player.');
  state.resources = 0;
  executeCommand(state, player, { type: 'ROLE', role: 'defenses' });
  executeCommand(state, player, { type: 'ACTION', action: 'builder' });
  for (let entry = 0; entry < 20; entry++) executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  equal(state.units.filter(unit => unit.kind === 'builder').length, 4);
  equal(player.work, 64);
  equal(state.resources, 0);
  executeCommand(state, player, { type: 'ACTION', action: 'wall' });
  for (let entry = 0; entry < 9; entry++) executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  equal(player.work, 72);
  executeCommand(state, player, { type: 'PLACE', kind: 'wall', point: { x: 350, y: 500 } });
  equal(player.work, 40);
  executeCommand(state, player, { type: 'PLACE', kind: 'wall', point: { x: 400, y: 500 } });
  equal(player.work, 8);
  equal(state.resources, 0);
  executeCommand(state, player, { type: 'ACTION', action: 'builder' });
  equal(player.work, 64);
});

test('Stronghold relays require only legal placement and do not spend typing work', () => {
  const state = createStronghold();
  const player = state.players[0];
  if (!player) throw new Error('Missing player.');
  executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  equal(player.work, 8);
  const phraseId = player.phraseId;
  equal(placementProblem(state, player, 'relay', { x: 500, y: 595 }), 'Leave space between buildings.');
  executeCommand(state, player, { type: 'PLACE', kind: 'relay', point: { x: 350, y: 540 } });
  equal(state.resources, 35);
  equal(player.work, 8);
  equal(player.phraseId, phraseId);
  equal(state.events.at(-1)?.text, 'Player 1 placed Relay');
  executeCommand(state, player, { type: 'ROLE', role: 'army' });
  equal(placementProblem(state, player, 'relay', { x: 650, y: 540 }), 'This action belongs to another role.');
});

test('Stronghold army control can always type for shared supplies', () => {
  const engine = new StrongholdEngine();
  engine.send('you', { type: 'ROLE', role: 'army' });
  engine.send('you', { type: 'ACTION', action: 'resources' });
  for (let entry = 0; entry < 4; entry++) {
    const player = engine.snapshot('you').players.find(candidate => candidate.id === 'you');
    if (!player) throw new Error('Missing player.');
    engine.send('you', { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  }
  const snapshot = engine.snapshot('you');
  equal(snapshot.resources, 68);
  equal(snapshot.players.filter(player => player.role === 'army').every(player => player.work === 0), true);
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
  equal(markup.includes('class="stronghold-cost">Free'), true);
  equal(markup.includes('id="stronghold-task-'), false);
  equal(markup.includes('stronghold-build-x'), false);
  equal(markup.includes('stronghold-order-x'), false);
  for (const length of PHRASE_LENGTHS) equal(markup.includes(`value="${length}"`), true);
  equal(markup.includes('>Army</option>'), true);
  equal(markup.includes('>Unit Control</option>'), true);
  equal(markup.includes('Army production'), false);
  equal(markup.includes('Army control'), false);
  equal(markup.includes('id="stronghold-world-event" class="stronghold-world-event is-hidden"'), true);
  equal(markup.includes('class="stronghold-work-track"'), true);
});

test('Stronghold Army bot earns supplies before unlock then constructs barracks and trains units', () => {
  const state = createStronghold();
  state.resources = 1000;
  state.waveIn = 10000;
  for (let step = 0; step < 100; step++) advanceStronghold(state, .25);
  equal(state.events.some(event => event.playerId === 'bot-1' && event.text === 'Player 2 gathered Supplies'), true);
  equal(state.buildings.some(building => building.kind === 'barracks'), false);
  state.tier = 1;
  for (let step = 0; step < 480; step++) advanceStronghold(state, .25);
  equal(state.buildings.some(building => building.kind === 'barracks' && building.progress === 1), true);
  equal(state.events.some(event => event.playerId === 'bot-1' && event.text === 'Player 2 created Warrior'), true);
});

test('Stronghold player themes pair light highlights and dark basic cursors for every squad member', () => {
  for (const player of createStronghold().players) {
    const theme = playerTheme(player.color);
    equal(theme.color, player.color);
    equal(theme.light !== theme.bold, true);
    equal(decodeURIComponent(playerCursor(player.color)).includes(`fill="${theme.bold}"`), true);
  }
});
