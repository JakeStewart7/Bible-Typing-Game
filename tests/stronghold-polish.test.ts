import { executeCommand } from '../src/stronghold/domain/actions.ts';
import { updateCombat } from '../src/stronghold/domain/combat.ts';
import { EVENT_WORD_POOLS } from '../src/stronghold/domain/event-phrases.ts';
import { updateLogistics } from '../src/stronghold/domain/logistics.ts';
import { moveUnitToward, wallBetween, wallContains } from '../src/stronghold/domain/navigation.ts';
import { assignPhrase } from '../src/stronghold/domain/phrases.ts';
import { distance, MIN_TIER, TEXT_LENGTH_RANGES, UNIT_CAPS, UNIT_RULES } from '../src/stronghold/domain/rules.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { addBuilding, addUnit, createStronghold } from '../src/stronghold/domain/state.ts';
import { queuedUnits, TRAINING_SECONDS } from '../src/stronghold/domain/training.ts';
import { PHRASE_LENGTHS } from '../src/stronghold/domain/types.ts';
import { edgePan, wheelZoom } from '../src/stronghold/ui/map-camera.ts';
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
    const state = createStronghold({ resources: 1000, length: 'medium', computersPaused: true });
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

test('Stronghold wheel zoom normalizes deltas and edge panning respects map bounds', () => {
  equal(wheelZoom(1.2, -100, 0) > 1.2, true);
  equal(wheelZoom(1.2, 100, 0) < 1.2, true);
  equal(wheelZoom(1.2, 1, 1), wheelZoom(1.2, 16, 0));
  equal(wheelZoom(2, -500, 0), 2);
  equal(wheelZoom(1, 500, 0), 1);
  const bounds = { left: 0, top: 100, right: 800, bottom: 500 };
  equal(edgePan({ x: 400, y: 300 }, bounds), { x: 0, y: 0 });
  equal(edgePan({ x: 0, y: 100 }, bounds), { x: -1, y: -1 });
  equal(edgePan({ x: 800, y: 500 }, bounds), { x: 1, y: 1 });
  equal(edgePan({ x: -1, y: 99 }, bounds), { x: 0, y: 0 });
});
