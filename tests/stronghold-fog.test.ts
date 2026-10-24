import { equal, test } from './harness.ts';
import { addBuilding, addUnit, createStronghold } from './stronghold-fixtures.ts';
import { createFog, exploredPath, inVision, knownResourceNodes, updateFog, visionSources } from '../src/stronghold/domain/fog.ts';
import { StrongholdEngine } from '../src/stronghold/domain/engine.ts';
import { placementProblem } from '../src/stronghold/domain/actions.ts';
import { spawnWave, updateCombat } from '../src/stronghold/domain/combat.ts';
import { updateLogistics } from '../src/stronghold/domain/logistics.ts';
import { advanceStronghold } from '../src/stronghold/domain/simulation.ts';

test('Stronghold starts with shared local vision and does not expose unexplored live entities', () => {
  const engine = new StrongholdEngine({ resources: 50, length: 'short', computersPaused: true, season: 'summer' });
  const initial = engine.snapshot('you');
  equal(initial.units.length, 5);
  equal(initial.buildings.map(building => building.kind), ['castle']);
  equal(initial.nodes.length > 0 && initial.nodes.length < 8, true);
  equal(initial.fog.buildings, []);
  equal(initial.fog.units, []);
  equal(inVision(initial.fog.sources, { x: 500, y: 595 }), true);
  equal(inVision(initial.fog.sources, { x: 500, y: 60 }), false);
  equal(engine.snapshot('bot-1').fog, initial.fog);
  initial.fog.explored.length = 0;
  initial.fog.sources[0]!.radius = 10000;
  equal(engine.snapshot('you').fog.explored.length > 0, true);
  equal(engine.snapshot('you').fog.sources[0]!.radius, 120);
  const before = engine.snapshot('you').fog.explored.length;
  engine.send('you', { type: 'ROLE', role: 'army' });
  const worker = engine.snapshot('you').units.find(unit => unit.kind === 'worker')!;
  engine.send('you', { type: 'MOVE', ids: [worker.id], point: { x: 300, y: 450 } });
  for (let step = 0; step < 10; step++) engine.advance(1);
  equal(engine.snapshot('you').fog.explored.length > before, true);
  engine.restart();
  equal(engine.snapshot('you').fog.explored.length, before);
});

test('Stronghold sight comes from living units and completed buildings, never enemies or blueprints', () => {
  const state = createStronghold();
  state.units = []; state.buildings = [];
  const worker = addUnit(state, 'worker', { x: 100, y: 100 });
  const tower = addBuilding(state, 'tower', { x: 500, y: 300 });
  addBuilding(state, 'enemy-base', { x: 900, y: 100 }, true, true);
  equal(visionSources(state).length, 1);
  equal(inVision(visionSources(state), { x: 220, y: 100 }), true);
  equal(inVision(visionSources(state), { x: 220.01, y: 100 }), false);
  tower.progress = 1;
  equal(inVision(visionSources(state), { x: 720, y: 300 }), true);
  worker.hp = 0; tower.hp = 0;
  equal(visionSources(state), []);
});

test('Stronghold fog freezes last-seen positions and health and clears stale memories only on rediscovery', () => {
  const state = createStronghold();
  state.units = []; state.buildings = []; state.nodes = []; state.fog = createFog();
  const scout = addUnit(state, 'warrior', { x: 400, y: 300 });
  const enemy = addUnit(state, 'invader', { x: 450, y: 300 });
  const tower = addBuilding(state, 'tower', { x: 460, y: 350 }, true, true);
  const node = { id: 900, x: 440, y: 400, rich: false, remaining: 100 };
  state.nodes = [node];
  updateFog(state);
  const cells = [...state.fog.explored], hp = tower.hp;
  equal(state.fog.units[0]?.x, 450);
  scout.x = 100; scout.y = 100;
  enemy.x = 900; enemy.hp = 1;
  tower.hp = 0; tower.tier = 3;
  node.x = 850; node.remaining = 0;
  updateFog(state);
  equal(state.fog.units[0]?.x, 450);
  equal(state.fog.units[0]?.hp, enemy.maxHp);
  equal(state.fog.buildings[0]?.hp, hp);
  equal(state.fog.buildings[0]?.tier, 1);
  equal(state.fog.nodes[0]?.x, 440);
  equal(state.fog.nodes[0]?.remaining, 100);
  equal(cells.every(cell => state.fog.explored.includes(cell)), true);
  scout.x = 400; scout.y = 300;
  updateFog(state);
  equal(state.fog.units, []);
  equal(state.fog.buildings, []);
  equal(state.fog.nodes, []);
  scout.x = 850;
  updateFog(state);
  equal(state.fog.units.map(unit => unit.x), [900]);
  equal(state.fog.units[0]?.hp, 1);
  equal(state.fog.units[0]?.attackTarget, null);
});

test('Stronghold gatherers select discovered resources without reading hidden depletion or relocation', () => {
  const state = createStronghold();
  state.units = []; state.buildings = []; state.fog = createFog();
  const worker = addUnit(state, 'worker', { x: 100, y: 300 });
  const node = { id: 900, x: 500, y: 300, rich: false, remaining: 100 };
  state.nodes = [node];
  updateLogistics(state, .1);
  equal(worker.task, null);
  const scout = addUnit(state, 'warrior', { x: 500, y: 400 });
  updateFog(state);
  scout.x = 100; scout.y = 100;
  node.remaining = 0; node.x = 900;
  equal(knownResourceNodes(state).map(known => [known.x, known.remaining]), [[500, 100]]);
  updateLogistics(state, .1);
  equal(worker.task, node.id);
  equal(worker.x > 100, true);
});

test('Stronghold construction requires current vision before revealing hidden placement blockers', () => {
  const state = createStronghold();
  state.units = []; state.buildings = [];
  addUnit(state, 'builder', { x: 100, y: 300 });
  state.nodes = [{ id: 900, x: 800, y: 300, rich: false, remaining: 100 }];
  const player = { ...state.players[0]!, role: 'defenses' as const, action: 'wall' as const, work: 32 };
  equal(placementProblem(state, player, 'wall', { x: 800, y: 300 })?.includes('Explore'), true);
  addUnit(state, 'warrior', { x: 750, y: 300 });
  equal(placementProblem(state, player, 'wall', { x: 800, y: 300 }), 'Do not build over resource nodes.');
});

test('Stronghold hidden enemy changes do not leak through events or omniscient pursuit', () => {
  const state = createStronghold(undefined, 'fall');
  state.units = []; state.buildings = []; state.nodes = [];
  const base = addBuilding(state, 'enemy-base', { x: 500, y: 60 }, true, true);
  addBuilding(state, 'tower', { x: 900, y: 300 }, true);
  const invader = addUnit(state, 'invader', { x: 300, y: 300 });
  updateCombat(state, .1);
  equal(invader.y > 300, true);
  state.wave = 2;
  spawnWave(state);
  equal(base.tier, 2);
  equal(state.events.some(event => event.text === 'Enemy base upgraded' || event.text === 'Enemy created Tower'), false);
  const dead = addUnit(state, 'invader', { x: 100, y: 100 });
  dead.hp = 0;
  updateCombat(state, .1);
  equal(state.events.some(event => event.text === 'Invader destroyed'), false);
});

test('Stronghold explored terrain stays remembered without vision and uses compact horizontal SVG runs', () => {
  const state = createStronghold();
  const before = [...state.fog.explored];
  state.units = []; state.buildings = [];
  updateFog(state);
  equal(state.fog.sources, []);
  equal(state.fog.explored, before);
  equal(exploredPath([0, 1, 2, 50]), 'M0 0h60v20h-60ZM0 20h20v20h-20Z');
});

test('Stronghold computer builders choose visible clear sites rather than repeatedly building on resource nodes', () => {
  const state = createStronghold({ resources: 1000, length: 'short', computersPaused: false }, 'summer');
  state.tier = 1;
  state.waveIn = 10000;
  for (const player of state.players) player.simulated = player.role === 'defenses';
  addUnit(state, 'builder', { x: 600, y: 500 });
  const player = state.players.find(player => player.role === 'defenses')!;
  player.action = 'tower'; player.work = 50;
  // The original preferred tower site intersects this season's rich resource node.
  equal(placementProblem(state, player, 'tower', { x: 360, y: 425 }), 'Do not build over resource nodes.');
  advanceStronghold(state, .1);
  const tower = state.buildings.find(building => building.kind === 'tower' && !building.enemy);
  equal(Boolean(tower), true);
  equal(tower && inVision(visionSources(state), tower), true);
  equal(state.message, '');
});
