import { executeCommand } from '../src/stronghold/domain/actions.ts';
import { updateCombat } from '../src/stronghold/domain/combat.ts';
import { EVENT_WORD_POOLS } from '../src/stronghold/domain/event-phrases.ts';
import { connectedRelays, relayNeighbors, updateLogistics } from '../src/stronghold/domain/logistics.ts';
import { moveUnitToward, wallBetween, wallContains } from '../src/stronghold/domain/navigation.ts';
import { assignPhrase, TIER_WORD_POOLS } from '../src/stronghold/domain/phrases.ts';
import { tierProgress } from '../src/stronghold/domain/tier-progress.ts';
import { distance, MIN_TIER, TEXT_LENGTH_RANGES, UNIT_CAPS, UNIT_RULES } from '../src/stronghold/domain/rules.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { addBuilding, addUnit, createStronghold } from './stronghold-fixtures.ts';
import { queuedUnits, TRAINING_SECONDS } from '../src/stronghold/domain/training.ts';
import { PHRASE_LENGTHS } from '../src/stronghold/domain/types.ts';
import { wheelZoom } from '../src/stronghold/ui/map-camera.ts';
import { relayPreviewMarkup, resourceChunkMarkup } from '../src/stronghold/ui/battlefield.ts';
import { equal, test } from './harness.ts';

function rejects(run: () => void, text: string): void {
  try { run(); } catch (error) { equal(error instanceof Error && error.message.includes(text), true); return; }
  throw new Error(`Expected rejection: ${text}`);
}

test('Stronghold event drills are unique, length-correct and specific to each event', () => {
  const patterns = {
    'left-hand': /^[qwertasdfgzxcvb ]+$/, vowels: /^[aeiou ]+$/,
    numbers: /^[0-9 ]+$/, symbols: /^[()[\]{}<>+=!&|: ]+$/, code: /[=+()<!-]/
  };
  for (const event of ['left-hand', 'vowels', 'numbers', 'symbols', 'code'] as const) {
    for (const length of PHRASE_LENGTHS) {
      const pool = EVENT_WORD_POOLS[event][length];
      const [min, max] = TEXT_LENGTH_RANGES[length];
      equal(pool.length >= 5, true);
      equal(new Set(pool).size, pool.length);
      equal(pool.every(phrase => phrase.length >= min && phrase.length <= max && patterns[event].test(phrase)), true);
      const state = createStronghold({ resources: 50, length, computersPaused: true });
      state.event = event;
      for (const player of state.players) assignPhrase(state, player, () => .5);
      equal(state.players.every(player => pool.includes(player.phrase)), true);
      equal(new Set(state.players.map(player => player.phrase)).size, 4);
    }
  }
});

test('Stronghold phrase shuffles respond to random choices rather than phrase IDs or alphabetical order', () => {
  const first = createStronghold(), second = createStronghold();
  const a = first.players[0]!, b = second.players[0]!;
  a.length = 'extra-long'; b.length = 'extra-long';
  assignPhrase(first, a, () => 0);
  assignPhrase(second, b, () => .999);
  equal(a.phrase !== b.phrase, true);
});

test('Stronghold tier drills progress from letters to numbers to punctuation at every text length', () => {
  for (const [tier, pools] of TIER_WORD_POOLS.entries()) for (const length of PHRASE_LENGTHS) {
    const pool = pools[length], [min, max] = TEXT_LENGTH_RANGES[length];
    equal(pool.length >= 5, true);
    equal(new Set(pool).size, pool.length);
    equal(pool.every(phrase => phrase.length >= min && phrase.length <= max && /[a-z]/i.test(phrase)), true);
    equal(pool.every(phrase => tier === 0 ? /^[a-z ]+$/i.test(phrase) : /\d/.test(phrase)), true);
    equal(pool.every(phrase => tier < 2 ? /^[a-z0-9 ]+$/i.test(phrase) : /[^a-z0-9 ]/i.test(phrase)), true);
    const state = createStronghold({ resources: 50, length, computersPaused: true });
    state.tier = tier;
    executeCommand(state, state.players[0]!, { type: 'READY', ready: true });
    equal(state.players.every(player => pool.includes(player.phrase)), true);
    equal(new Set(state.players.map(player => player.phrase)).size, state.players.length);
  }
});

test('Stronghold tier progress counts only completed correct phrases without length bonuses or duplicate credit', () => {
  const state = createStronghold({ resources: 50, length: 'long', computersPaused: true }), player = state.players[0]!;
  executeCommand(state, player, { type: 'READY', ready: true });
  const phraseId = player.phraseId, prefix = player.phrase.slice(0, 3);
  const type = (text: string) => executeCommand(state, player, { type: 'TYPE', phraseId, text });
  type(prefix); equal(player.contribution, 0);
  type(prefix); type(''); type(prefix); equal(player.contribution, 0);
  const wrong = player.phrase[3] === 'x' ? 'y' : 'x';
  type(prefix + wrong); equal(player.contribution, 0);
  type(player.phrase.slice(0, 4)); equal(player.contribution, 0);
  const phraseLength = player.phrase.length;
  type(player.phrase.slice(0, -1) + '!');
  equal(player.contribution, 0); equal(player.completed, 0);
  type(player.phrase); equal(player.contribution, phraseLength);
  equal(player.completed, 1);
  rejects(() => type(prefix), 'expired');
  equal(player.contribution, phraseLength);
  player.contribution = 498;
  executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase.slice(0, 2) });
  equal(state.tier, 0); equal(state.phase, 'tier-up'); equal(player.contribution, 498);
  executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  equal(state.tier, 1); equal(state.phase, 'playing');
  equal(player.completed, 2);
  equal(tierProgress(state.players), { completed: 500, goal: 500 });
});

test('Stronghold all unit types route around horizontal, diagonal and vertical walls without crossing them', () => {
  for (const rotation of [0, 45, 90, 135]) {
    for (const kind of ['warrior', 'invader', 'worker', 'builder'] as const) {
      const state = createStronghold();
      state.units = []; state.buildings = [];
      const wall = addBuilding(state, 'wall', { x: 500, y: 350 }, true);
      wall.rotation = rotation;
      const unit = addUnit(state, kind, { x: 430, y: 280 });
      const target = { x: 570, y: 420 };
      let routed = false;
      for (let step = 0; step < 300; step++) {
        const before = { x: unit.x, y: unit.y };
        equal(moveUnitToward(state, unit, target, 2), true);
        equal(wallContains(unit, wall, 9.9), false);
        equal(wallBetween(state, before, unit), undefined);
        if (Math.abs((unit.x - 430) - (unit.y - 280)) > 1) routed = true;
      }
      equal({ x: unit.x, y: unit.y }, target);
      if (rotation !== 45) equal(routed, true);
    }
  }
});

test('Stronghold enemies route around walls to attack defenders instead of walking through or attacking an avoidable wall', () => {
  const state = createStronghold();
  state.units = []; state.buildings = [];
  const wall = addBuilding(state, 'wall', { x: 500, y: 350 }, true);
  const invader = addUnit(state, 'invader', { x: 500, y: 290 });
  const defender = addUnit(state, 'worker', { x: 500, y: 410 });
  for (let step = 0; step < 180 && defender.hp === defender.maxHp; step++) {
    const before = { x: invader.x, y: invader.y };
    updateCombat(state, .1);
    equal(wallBetween(state, before, invader), undefined);
  }
  equal(defender.hp < defender.maxHp, true);
  equal(wall.hp, wall.maxHp);
});

test('Stronghold navigation reroutes after wall rotation and destruction and builders construct walls from outside', () => {
  const state = createStronghold();
  state.units = []; state.buildings = [];
  const wall = addBuilding(state, 'wall', { x: 500, y: 350 });
  const builder = addUnit(state, 'builder', { x: 500, y: 410 });
  for (let step = 0; step < 150; step++) updateLogistics(state, .1);
  equal(wall.progress, 1);
  equal(wallContains(builder, wall, 9.9), false);
  const unit = addUnit(state, 'warrior', { x: 500, y: 290 });
  const target = { x: 500, y: 420 };
  moveUnitToward(state, unit, target, 1);
  wall.rotation = 90;
  for (let step = 0; step < 5; step++) moveUnitToward(state, unit, target, 1);
  wall.hp = 0;
  for (let step = 0; step < 100; step++) moveUnitToward(state, unit, target, 2);
  equal({ x: unit.x, y: unit.y }, target);
});

test('Stronghold enemies attack an enclosing wall when no route to their target exists', () => {
  const state = createStronghold();
  state.units = []; state.buildings = [];
  for (const point of [{ x: 500, y: 320 }, { x: 500, y: 380 }, { x: 470, y: 350 }, { x: 530, y: 350 }]) {
    const wall = addBuilding(state, 'wall', point, true);
    if (point.x !== 500) wall.rotation = 90;
  }
  const invader = addUnit(state, 'invader', { x: 410, y: 350 });
  addUnit(state, 'worker', { x: 500, y: 350 });
  for (let frame = 0; frame < 120; frame++) {
    const before = { x: invader.x, y: invader.y };
    updateCombat(state, .1);
    equal(wallBetween(state, before, invader), undefined);
  }
  equal(state.buildings.some(wall => wall.hp < wall.maxHp), true);
});

test('Stronghold wall placement and existing rotation preserve angle, reject unit overlap and leave typing work untouched on failure', () => {
  const state = createStronghold();
  const player = state.players[0]!;
  executeCommand(state, player, { type: 'ROLE', role: 'defenses' });
  executeCommand(state, player, { type: 'ACTION', action: 'wall' });
  player.work = 32;
  executeCommand(state, player, { type: 'PLACE', kind: 'wall', point: { x: 300, y: 400 }, rotation: 90 });
  const wall = state.buildings.find(building => building.kind === 'wall')!;
  equal(wall.rotation, 90);
  executeCommand(state, player, { type: 'ROTATE_WALL', id: wall.id });
  equal(wall.rotation, 135);
  equal(player.work, 0);
  player.work = 32;
  rejects(() => executeCommand(state, player, { type: 'PLACE', kind: 'wall', point: { x: 400, y: 400 }, rotation: 22 }), 'angle');
  equal(player.work, 32);
  rejects(() => executeCommand(state, player, { type: 'PLACE', kind: 'wall', point: { x: 21, y: 400 }, rotation: 0 }), 'entire wall');
  addUnit(state, 'worker', { x: 330, y: 400 });
  rejects(() => executeCommand(state, player, { type: 'ROTATE_WALL', id: wall.id }), 'space for units');
  equal(wall.rotation, 135);
});

test('Stronghold warriors and opposing formations have identical base health, damage, range and speed even in later waves', () => {
  equal(UNIT_RULES.invader, UNIT_RULES.warrior);
  for (const kind of ['warrior', 'archer', 'catapult'] as const) {
    const state = createStronghold();
    state.wave = 12; state.units = []; state.buildings = [];
    const friendly = addUnit(state, kind, { x: 500, y: 300 });
    const enemy = addUnit(state, 'invader', { x: 500, y: 320 }, kind);
    equal(friendly.maxHp, enemy.maxHp);
    updateCombat(state, .1);
    equal(friendly.maxHp - friendly.hp, enemy.maxHp - enemy.hp);
  }
});

test('Stronghold paid queues train FIFO at matching barracks, pay only once and stop when empty', () => {
  for (const kind of ['warrior', 'archer', 'catapult'] as const) {
    const state = createStronghold({ resources: 1000, length: 'medium', computersPaused: true }, 'fall');
    state.tier = 3; state.units = []; state.buildings = [];
    const player = state.players[0]!;
    executeCommand(state, player, { type: 'ROLE', role: 'production' });
    const barracks = addBuilding(state, 'barracks', { x: 600, y: 550 }, false, false, MIN_TIER[kind]);
    rejects(() => executeCommand(state, player, { type: 'ACTION', action: kind }), 'Barracks');
    equal(state.resources, 1000);
    barracks.progress = 1;
    executeCommand(state, player, { type: 'ACTION', action: kind });
    executeCommand(state, player, { type: 'ACTION', action: kind });
    const supplies = state.resources;
    equal(queuedUnits(state, kind), 2);
    equal(state.units.length, 0);
    for (let second = 0; second < TRAINING_SECONDS - 1; second++) advanceStronghold(state, 1);
    equal(state.units.length, 0);
    advanceStronghold(state, 1);
    equal(state.units.length, 1);
    equal(distance(state.units[0]!, { x: barracks.x, y: barracks.y - 30 }) <= UNIT_RULES[kind].speed + .001, true);
    equal(state.units[0]?.destination, state.rally);
    equal(queuedUnits(state, kind), 1);
    for (let second = 0; second < TRAINING_SECONDS * 3; second++) advanceStronghold(state, 1);
    equal(state.units.length, 2);
    equal(state.resources, supplies);
    equal(barracks.trainingQueue.length, 0);
  }
});

test('Stronghold troop queues balance matching barracks, count against caps and stop when destroyed', () => {
  const state = createStronghold({ resources: 1000, length: 'medium', computersPaused: true });
  state.tier = 1;
  const player = state.players[0]!;
  executeCommand(state, player, { type: 'ROLE', role: 'production' });
  const first = addBuilding(state, 'barracks', { x: 600, y: 550 }, true);
  const second = addBuilding(state, 'barracks', { x: 700, y: 550 }, true);
  addBuilding(state, 'barracks', { x: 800, y: 550 }, true, false, 2);
  for (let count = 2; count < UNIT_CAPS.warrior; count++) executeCommand(state, player, { type: 'ACTION', action: 'warrior' });
  equal(first.trainingQueue.length, 8); equal(second.trainingQueue.length, 8);
  const resources = state.resources;
  rejects(() => executeCommand(state, player, { type: 'ACTION', action: 'warrior' }), 'population limit');
  equal(state.resources, resources);
  first.hp = 0; second.hp = 0;
  for (let second = 0; second < 20; second++) advanceStronghold(state, 1);
  equal(state.units.filter(unit => unit.kind === 'warrior').length, 2);
});

test('Stronghold wheel zoom normalizes deltas and clamps at the full map and maximum zoom', () => {
  equal(wheelZoom(1.2, -100, 0) > 1.2, true);
  equal(wheelZoom(1.2, 100, 0) < 1.2, true);
  equal(wheelZoom(1.2, 1, 1), wheelZoom(1.2, 16, 0));
  equal(wheelZoom(2, -500, 0), 2);
  equal(wheelZoom(1, 500, 0), 1);
});

test('Stronghold relay previews include the base at exactly 155 units and exclude unavailable or out-of-range sites', () => {
  const state = createStronghold();
  state.buildings = [];
  const castle = addBuilding(state, 'castle', { x: 0, y: 0 }, true);
  const source = addBuilding(state, 'relay', { x: 155, y: 0 }, true);
  const neighbor = addBuilding(state, 'relay', { x: 310, y: 0 }, true);
  addBuilding(state, 'relay', { x: 310.001, y: 0 }, true);
  const incomplete = addBuilding(state, 'relay', { x: 100, y: 0 });
  const destroyed = addBuilding(state, 'relay', { x: 120, y: 0 }, true); destroyed.hp = 0;
  const enemy = addBuilding(state, 'relay', { x: 130, y: 0 }, true, true);
  equal(relayNeighbors(state, source, source.id).map(building => building.id), [castle.id, neighbor.id]);
  const connected = connectedRelays(state);
  equal(connected.includes(neighbor), true);
  for (const building of [incomplete, destroyed, enemy]) equal(connected.includes(building), false);
  const markup = relayPreviewMarkup(state, source, source.id);
  equal(markup.includes('r="155"'), true);
  for (const building of [castle, neighbor]) equal(markup.includes(`data-relay-connection="${building.id}"`), true);
  equal(markup.includes(`data-relay-connection="${source.id}"`), false);
  equal(markup.includes('stroke="#65eb98"'), true);
  const pending = relayPreviewMarkup(state, incomplete, incomplete.id);
  equal(pending.includes('r="155"'), true);
  equal(pending.includes(`data-relay-connection="${castle.id}"`), true);
  equal(pending.includes(`data-relay-connection="${incomplete.id}"`), false);
});

test('Stronghold relay previews distinguish castle-connected extensions from disconnected relay groups', () => {
  const state = createStronghold();
  state.buildings = [];
  const castle = addBuilding(state, 'castle', { x: 100, y: 500 }, true);
  const relay = addBuilding(state, 'relay', { x: 250, y: 500 }, true);
  const isolated = addBuilding(state, 'relay', { x: 600, y: 500 }, true);
  const connected = relayPreviewMarkup(state, { x: 400, y: 500 });
  equal(connected.includes(`data-relay-connection="${relay.id}" data-powered="true"`), true);
  equal(connected.includes(`data-relay-connection="${castle.id}"`), false);
  equal(connected.includes('stroke="#65eb98"'), true);
  const disconnected = relayPreviewMarkup(state, { x: 500, y: 500 });
  equal(disconnected.includes(`data-relay-connection="${isolated.id}" data-powered="false"`), true);
  equal(disconnected.includes('stroke="#ffd76a"'), true);
  equal(relayPreviewMarkup(state, { x: 900, y: 100 }).includes('data-relay-connection='), false);
});

test('Stronghold cargo retains its blue or purple origin independently of yield and glows only during relay transport', () => {
  for (const rich of [false, true]) {
    const state = createStronghold();
    state.units = [];
    state.nodes = [{ id: 500, x: 500, y: 540, rich, remaining: 100 }];
    state.upgrades.economy = rich ? 0 : 2;
    const worker = addUnit(state, 'worker', { x: 500, y: 540 });
    updateLogistics(state, .1);
    const chunk = state.chunks[0];
    if (!chunk) throw new Error('Missing harvested cargo.');
    equal(chunk.amount, 8);
    equal(chunk.rich, rich);
    equal(chunk.carrier, worker.id);
    const carried = resourceChunkMarkup(chunk, false);
    equal(carried.includes(`fill="${rich ? '#a64caf' : '#00aeef'}"`), true);
    equal(carried.includes('filter='), false);
    const transported = resourceChunkMarkup(chunk, true);
    equal(transported.includes('fill="#bdc9c2"'), true);
    equal(transported.includes('filter="url(#stronghold-resource-glow)"'), true);
    worker.hp = 0;
    updateLogistics(state, .1);
    equal(chunk.carrier, null);
    equal(chunk.rich, rich);
  }
});
