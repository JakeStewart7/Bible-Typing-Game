import { test, equal } from './harness.ts';
import { addUnit, createStronghold } from './stronghold-fixtures.ts';
import { actionUnlockProblem, executeCommand } from '../src/stronghold/domain/actions.ts';
import { FOG_CELL_SIZE, FOG_COLUMNS, FOG_ROWS, inVision, visibleCells } from '../src/stronghold/domain/fog.ts';
import { updateLogistics } from '../src/stronghold/domain/logistics.ts';
import { buildingFootprint, resourceNodeRadius, unitRadius } from '../src/stronghold/domain/navigation.ts';
import { buildingMarkup, unitMarkup } from '../src/stronghold/ui/battlefield.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';
import { SEASONS } from '../src/stronghold/domain/types.ts';

test('Stronghold gatherers harvest and deposit on exact visible contact, even during manual orders or idle waiting', () => {
  for (const manual of [false, true]) {
    const state = createStronghold(undefined, 'fall');
    state.units = [];
    const node = { id: 900, x: 500, y: 450, rich: false, remaining: 100 };
    state.nodes = [node];
    const worker = addUnit(state, 'worker', { x: node.x + resourceNodeRadius(node) + 9 + .2, y: node.y });
    equal(unitRadius(worker), 9);
    worker.cooldown = 2;
    if (manual) { worker.destination = { x: 700, y: 450 }; worker.manualMove = true; }
    updateLogistics(state, .001);
    equal(state.chunks.length, 0);
    worker.x = node.x + resourceNodeRadius(node) + unitRadius(worker);
    updateLogistics(state, 1 / 60);
    equal(state.nodes[0]!.remaining, 96);
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
    equal(state.resources, 54);
    equal(state.chunks.length, 0);
    equal(state.nodes[0]!.remaining, 96);
  }
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
