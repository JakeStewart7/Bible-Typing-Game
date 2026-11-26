import { test, equal } from './harness.ts';
import { addBuilding, addUnit, createStronghold } from './stronghold-fixtures.ts';
import { actionUnlockProblem, executeCommand } from '../src/stronghold/domain/actions.ts';
import { FOG_CELL_SIZE, FOG_COLUMNS, FOG_ROWS, inVision, updateFog, visibleCells, visionSources } from '../src/stronghold/domain/fog.ts';
import { updateLogistics } from '../src/stronghold/domain/logistics.ts';
import { buildingFootprint, footprintsOverlap, nodeOverlapsFootprint, resourceNodeRadius, unitRadius } from '../src/stronghold/domain/navigation.ts';
import { buildingMarkup, unitMarkup } from '../src/stronghold/ui/battlefield.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { ROLES, SEASONS } from '../src/stronghold/domain/types.ts';
import { spawnWave, updateCombat } from '../src/stronghold/domain/combat.ts';
import { towerRange, UNIT_RULES } from '../src/stronghold/domain/rules.ts';

test('Stronghold builder site orders take over automatic assignments quietly in every role', () => {
  for (const role of ROLES) {
    const state = createStronghold();
    state.units = []; state.buildings = []; state.nodes = [];
    const site = addBuilding(state, 'wall', { x: 500, y: 500 });
    const automatic = addUnit(state, 'builder', { x: 520, y: 480 });
    automatic.task = site.id;
    const chosen = addUnit(state, 'builder', { x: 500, y: 480 });
    const farther = addUnit(state, 'builder', { x: 100, y: 550 });
    const warrior = addUnit(state, 'warrior', { x: 550, y: 480 });
    const player = state.players[0]!;
    executeCommand(state, player, { type: 'ROLE', role });
    const events = state.events.length;
    executeCommand(state, player, { type: 'MOVE', ids: [farther.id, chosen.id, warrior.id], point: site, buildingId: site.id });
    equal(chosen.task, site.id); equal(chosen.manualMove, false);
    equal(automatic.task, null); equal(warrior.manualMove, true);
    equal(farther.task, null); equal(farther.manualMove, true);
    equal(state.events.length, events);
    updateLogistics(state, 1);
    equal(chosen.task, site.id); equal(site.progress > 0, true);
    site.progress = 1; site.hp -= 10;
    executeCommand(state, player, { type: 'MOVE', ids: [chosen.id], point: site, buildingId: site.id });
    const hp = site.hp;
    updateLogistics(state, 1);
    equal(site.hp > hp, true);
    const before = structuredClone(state);
    let rejected = false;
    try { executeCommand(state, player, { type: 'MOVE', ids: [chosen.id, 999999], point: site, buildingId: site.id }); }
    catch (error) { rejected = error instanceof Error && error.message.includes('friendly units'); }
    equal(rejected, true); equal(state, before);
  }
});

test('Stronghold uncapped friendly units can receive one movement order beyond the old selection limit', () => {
  const state = createStronghold();
  state.units = [];
  for (let index = 0; index < 70; index++) addUnit(state, 'worker', { x: 100 + index % 20 * 30, y: 250 + Math.floor(index / 20) * 30 });
  const point = { x: 500, y: 500 }, events = state.events.length;
  executeCommand(state, state.players[0]!, { type: 'MOVE', ids: state.units.map(unit => unit.id), point });
  equal(state.units.every(unit => unit.manualMove && unit.destination?.x === point.x && unit.destination.y === point.y), true);
  equal(state.events.length, events);
});

test('Stronghold enemy reinforcement counts exceed old caps without overlapping towers', () => {
  const state = createStronghold();
  for (let wave = 0; wave < 24; wave++) spawnWave(state);
  equal(state.units.filter(unit => unit.kind === 'invader').length > 40, true);
  const towers = state.buildings.filter(building => building.kind === 'tower' && building.enemy);
  equal(towers.length > 6, true);
  for (const tower of towers) {
    equal(state.buildings.every(other => other === tower
      || !footprintsOverlap(buildingFootprint(state, tower), buildingFootprint(state, other))), true);
    equal(state.nodes.every(node => !nodeOverlapsFootprint(node, buildingFootprint(state, tower))), true);
  }
});

test('Stronghold blocked enemy reinforcements do not disclose hidden map conditions', () => {
  for (const visible of [false, true]) {
    const state = createStronghold();
    state.units = []; state.buildings = []; state.nodes = []; state.wave = 2;
    for (let index = 0; index < 60; index++) addBuilding(state, 'tower',
      { x: 80 + index % 15 * 60, y: 145 + Math.floor(index / 15) * 60 }, true, true, 3);
    if (visible) addUnit(state, 'worker', { x: 565, y: 190 });
    spawnWave(state);
    equal(state.buildings.length, 60);
    equal(state.events.some(event => event.text.includes('reinforcement blocked')), visible);
  }
});

test('Stronghold tower ranges stay slightly beyond archers and firing reveals hidden damage sources temporarily', () => {
  equal([1, 2, 3].map(towerRange), [130, 135, 140]);
  equal([1, 2, 3].every(tier => towerRange(tier) > UNIT_RULES.archer.range && towerRange(tier) <= UNIT_RULES.archer.range + 20), true);
  for (const tier of [1, 2, 3]) for (const extra of [0, .001]) {
    const state = createStronghold();
    state.units = []; state.buildings = []; state.nodes = [];
    const worker = addUnit(state, 'worker', { x: 300, y: 300 });
    addBuilding(state, 'tower', { x: worker.x + towerRange(tier) + extra, y: worker.y }, true, true, tier);
    updateCombat(state, .1);
    equal(worker.hp, worker.maxHp - (extra === 0 ? 8 + tier * 4 : 0));
  }
  const state = createStronghold();
  state.units = []; state.buildings = []; state.nodes = [];
  const worker = addUnit(state, 'worker', { x: 400, y: 300 });
  const tower = addBuilding(state, 'tower', { x: 525, y: 300 }, true, true, 1);
  equal(inVision(visionSources(state), tower), false);
  updateCombat(state, .1); updateFog(state);
  equal(worker.hp, worker.maxHp - 12);
  equal(inVision(state.fog.sources, tower), true);
  equal(state.fog.buildings.some(building => building.id === tower.id), true);
  worker.x = 300;
  updateCombat(state, 1); updateFog(state);
  equal(inVision(state.fog.sources, tower), false);
  equal(state.fog.buildings[0]?.attackTarget, null);
});

test('Stronghold builder site orders reject invalid projects or selections without partial movement', () => {
  for (const invalid of ['enemy', 'complete', 'missing', 'no-builder']) {
    const state = createStronghold();
    state.units = []; state.buildings = []; state.nodes = [];
    const site = addBuilding(state, 'wall', { x: 500, y: 300 }, invalid === 'complete', invalid === 'enemy');
    const chosen = addUnit(state, invalid === 'no-builder' ? 'warrior' : 'builder', { x: 500, y: 330 });
    const before = structuredClone(state);
    let rejected = false;
    try { executeCommand(state, state.players[0]!, { type: 'MOVE', ids: [chosen.id], point: site, buildingId: invalid === 'missing' ? 999999 : site.id }); }
    catch (error) { rejected = error instanceof Error; }
    equal(rejected, true); equal(state, before);
  }
});

test('Stronghold production bots reserve the next tier budget once an assault force is ready', () => {
  const state = createStronghold({ resources: 300, length: 'short', computersPaused: false, tier: 1 });
  state.units = [];
  for (let index = 0; index < 8; index++) addUnit(state, 'warrior', { x: 300 + index * 40, y: 450 });
  advanceStronghold(state, .1);
  equal(state.players[1]?.action, 'resources');
  equal(state.resources, 300);
});

test('Stronghold enemies break a blocking wall rather than idle on an embedded builder at every wall angle', () => {
  for (let step = 0; step < 16; step++) {
    const state = createStronghold();
    state.units = []; state.buildings = []; state.nodes = [];
    const wall = addBuilding(state, 'wall', { x: 400, y: 400 }, true);
    wall.rotation = step * 22.5;
    const angle = wall.rotation * Math.PI / 180;
    const point = { x: wall.x + Math.cos(angle) * 24, y: wall.y + Math.sin(angle) * 24 };
    const builder = addUnit(state, 'builder', point);
    const enemy = addUnit(state, 'invader', point);
    for (let tick = 0; tick < 60; tick++) updateCombat(state, .1);
    equal(wall.hp < wall.maxHp, true);
    equal(builder.hp, builder.maxHp);
    equal(Math.hypot(enemy.x - point.x, enemy.y - point.y) > 1, true);
  }
});

test('Stronghold paid troops finish training beyond each former population cap', () => {
  for (const [kind, tier, former] of [['warrior', 1, 18], ['archer', 2, 12], ['catapult', 3, 6]] as const) {
    const state = createStronghold({ resources: 1000, length: 'short', computersPaused: true, tier: 3 });
    state.units = []; state.buildings = []; state.nodes = []; state.waveIn = 1000;
    for (let index = 0; index < former + 1; index++) addUnit(state, kind, { x: 100 + index % 10 * 40, y: 200 + Math.floor(index / 10) * 45 });
    addBuilding(state, 'barracks', { x: 650, y: 500 }, true, false, tier);
    const player = state.players[0]!;
    executeCommand(state, player, { type: 'ROLE', role: 'production' });
    executeCommand(state, player, { type: 'ACTION', action: kind });
    for (let second = 0; second < 24; second++) advanceStronghold(state, 1);
    equal(state.units.filter(unit => unit.kind === kind).length, former + 2);
  }
});

test('Stronghold gatherers harvest and deposit on exact visible contact, even during manual orders or idle waiting', () => {
  for (const manual of [false, true]) {
    const state = createStronghold(undefined, 'fall');
    state.units = [];
    const node = { id: 900, x: 500, y: 450, rich: false, remaining: 100, cooldown: 0 };
    state.nodes = [node];
    const worker = addUnit(state, 'worker', { x: node.x + resourceNodeRadius(node) + 9 + .2, y: node.y });
    equal(unitRadius(worker), 9);
    worker.cooldown = 2;
    if (manual) { worker.destination = { x: 700, y: 450 }; worker.manualMove = true; }
    updateLogistics(state, .001);
    equal(state.chunks.length, 0);
    worker.x = node.x + resourceNodeRadius(node) + unitRadius(worker);
    updateLogistics(state, 1 / 60);
    equal(state.nodes[0]!.remaining, 97);
    equal(state.chunks.length, 1);
    equal(state.chunks[0]!.carrier, worker.id);
    equal(state.resources, 50);
    const castle = state.buildings.find(building => building.kind === 'castle')!;
    worker.x = castle.x;
    worker.y = castle.y - buildingFootprint(state, castle).halfY - unitRadius(worker) - .2;
    worker.destination = null; worker.idleTime = 0;
    updateLogistics(state, .001);
    equal(state.resources, 50);
    worker.y = castle.y - buildingFootprint(state, castle).halfY - unitRadius(worker);
    updateLogistics(state, .001);
    equal(state.resources, 53);
    equal(state.chunks.length, 0);
    equal(state.nodes[0]!.remaining, 97);
  }
});

test('Stronghold resource nodes share an exact 0.8-second harvest cooldown across gatherers', () => {
  const state = createStronghold();
  state.units = []; state.buildings = [];
  const node = { id: 900, x: 500, y: 300, rich: false, remaining: 600, cooldown: 0 };
  state.nodes = [node];
  const first = addUnit(state, 'worker', node);
  const second = addUnit(state, 'worker', node);
  updateLogistics(state, 0);
  equal(state.chunks.map(chunk => [chunk.carrier, chunk.amount]), [[first.id, 3]]);
  equal(node.remaining, 597);
  equal(node.cooldown, .8);
  updateLogistics(state, .7999);
  equal(state.chunks.length, 1);
  equal(node.remaining, 597);
  updateLogistics(state, .0001);
  equal(state.chunks.map(chunk => [chunk.carrier, chunk.amount]), [[first.id, 3], [second.id, 3]]);
  equal(node.remaining, 594);
  equal(node.cooldown, .8);
});

test('Stronghold independent nodes can be harvested together and every seasonal node starts with 600 supplies', () => {
  for (const season of SEASONS) {
    const state = createStronghold(undefined, season);
    equal(state.nodes.length, 8);
    equal(state.nodes.every(node => node.remaining === 600 && node.cooldown === 0), true);
  }
  const state = createStronghold();
  state.units = []; state.buildings = [];
  state.nodes = [{ id: 900, x: 500, y: 300, rich: false, remaining: 600, cooldown: 0 },
    { id: 901, x: 650, y: 300, rich: true, remaining: 600, cooldown: 0 }];
  state.nodes.forEach(node => addUnit(state, 'worker', node));
  updateLogistics(state, 0);
  equal(state.chunks.map(chunk => chunk.amount), [3, 6]);
  equal(state.nodes.map(node => node.remaining), [597, 594]);
  state.phase = 'tier-up';
  advanceStronghold(state, .5);
  equal(state.nodes.map(node => node.cooldown), [.8, .8]);
});

test('Stronghold gathering preserves economy and seasonal bonuses and never overdraws a depleted node', () => {
  for (const rich of [false, true]) for (const season of ['spring', 'winter'] as const) {
    const state = createStronghold(undefined, season);
    state.units = [];
    state.upgrades.economy = 1;
    const node = { id: 900, x: 500, y: 450, rich, remaining: 600, cooldown: 0 };
    state.nodes = [node];
    const worker = addUnit(state, 'worker', node);
    updateLogistics(state, 0);
    const amount = rich ? 8 : 5;
    equal(state.chunks[0]?.amount, amount);
    const castle = state.buildings.find(building => building.kind === 'castle')!;
    worker.x = castle.x;
    worker.y = castle.y - buildingFootprint(state, castle).halfY - unitRadius(worker);
    updateLogistics(state, 0);
    equal(state.resources, 50 + amount * (season === 'spring' ? 1.2 : .8));
  }
  const state = createStronghold();
  state.units = []; state.buildings = [];
  const node = { id: 900, x: 500, y: 300, rich: false, remaining: 2, cooldown: 0 };
  state.nodes = [node]; addUnit(state, 'worker', node);
  updateLogistics(state, 0);
  equal(state.chunks[0]?.amount, 2);
  equal(node.remaining, 0);
  addUnit(state, 'worker', node); updateLogistics(state, .8);
  equal(state.chunks.length, 1);
  equal(node.remaining, 0);
});

test('Stronghold Army typing is locked at Tier 0, including hidden legacy Supplies tasks, but challenges remain available', () => {
  const state = createStronghold({ resources: 300, length: 'short', computersPaused: true });
  const player = state.players[0]!;
  executeCommand(state, player, { type: 'ROLE', role: 'production' });
  equal(player.action, 'barracks');
  player.action = 'resources';
  equal(Boolean(actionUnlockProblem(state, player)), true);
  const before = structuredClone(state);
  let rejected = false;
  try { executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase }); }
  catch (error) { rejected = error instanceof Error && error.message.includes('tier 1'); }
  equal(rejected, true);
  equal(state, before);
  executeCommand(state, player, { type: 'READY', ready: true });
  executeCommand(state, player, { type: 'TYPE', phraseId: player.phraseId, text: player.phrase });
  equal(player.contribution > 0, true);
  state.tier = 1;
  equal(actionUnlockProblem(state, player), null);
});

test('Stronghold pixelated current sight and gameplay visibility agree for every cell and both sides of grid boundaries', () => {
  const sources = [{ id: 'test', x: 400, y: 300, radius: 120 }, { id: 'other', x: 705.3, y: 521.4, radius: 150 }];
  const cells = new Set(visibleCells(sources));
  for (let y = 0; y < FOG_ROWS; y++) for (let x = 0; x < FOG_COLUMNS; x++) {
    for (const offset of [.01, FOG_CELL_SIZE / 2, FOG_CELL_SIZE - .01]) {
      equal(inVision(sources, { x: x * FOG_CELL_SIZE + offset, y: y * FOG_CELL_SIZE + offset }), cells.has(y * FOG_COLUMNS + x));
    }
  }
});

test('Stronghold shadow silhouettes omit all health and training bars while visible entities retain theirs', () => {
  const state = createStronghold();
  const unit = state.units[0]!;
  const building = state.buildings[0]!;
  equal(unitMarkup(unit, false).includes('data-health'), true);
  equal(unitMarkup(unit, false, false).includes('data-health'), false);
  equal(buildingMarkup(building).includes('data-health'), true);
  equal(buildingMarkup(building, false).includes('data-health'), false);
  const barracks = { ...building, kind: 'barracks' as const };
  equal(buildingMarkup(barracks, false).includes('data-training'), false);
});

test('Stronghold computer placement planning never emits teammate collision warnings across seasons', () => {
  for (const season of SEASONS) {
    const state = createStronghold({ resources: 1000, length: 'short', computersPaused: false }, season);
    state.waveIn = 10000;
    for (let step = 0; step < 80; step++) {
      advanceStronghold(state, .5);
      equal(state.message.includes('Esther:') || state.message.includes('Leave space between buildings.'), false);
    }
  }
});
