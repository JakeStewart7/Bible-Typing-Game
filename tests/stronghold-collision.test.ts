import { test, equal } from './harness.ts';
import { addBuilding, addUnit, createStronghold } from './stronghold-fixtures.ts';
import { buildingFootprint, distanceToFootprint, footprintsOverlap, movementDestination, moveUnitToward, resourceNodeRadius, unitRadius } from '../src/stronghold/domain/navigation.ts';
import { placementBlockers } from '../src/stronghold/domain/actions.ts';
import { updateLogistics } from '../src/stronghold/domain/logistics.ts';
import { distance } from '../src/stronghold/domain/rules.ts';

test('Stronghold exact wall borders allow touching at every rotation but reject real overlap', () => {
  const state = createStronghold();
  for (let rotation = 0; rotation < 360; rotation += 22.5) {
    const wall = { kind: 'wall' as const, tier: 1, enemy: false, rotation, x: 400, y: 400 };
    const angle = rotation * Math.PI / 180;
    const next = { ...wall, x: wall.x + 49 * Math.cos(angle), y: wall.y + 49 * Math.sin(angle) };
    equal(footprintsOverlap(buildingFootprint(state, wall), buildingFootprint(state, next)), false);
    next.x -= .01 * Math.cos(angle); next.y -= .01 * Math.sin(angle);
    equal(footprintsOverlap(buildingFootprint(state, wall), buildingFootprint(state, next)), true);
  }
  state.buildings = []; state.nodes = [];
  const wall = addBuilding(state, 'wall', { x: 400, y: 400 }, true);
  equal(placementBlockers(state, state.players[0]!, 'wall', { x: 449, y: 400 }).buildings, []);
  equal(placementBlockers(state, state.players[0]!, 'wall', { x: 448.99, y: 400 }).buildings, [wall.id]);
});

test('Stronghold resource circles block construction and every unit size routes around depleted nodes and bases', () => {
  for (const kind of ['warrior', 'catapult'] as const) {
    const state = createStronghold(undefined, 'fall');
    state.units = []; state.buildings = [];
    const node = { id: 900, x: 400, y: 300, rich: false, remaining: 0 };
    state.nodes = [node];
    const base = addBuilding(state, 'castle', { x: 550, y: 300 }, true);
    equal(placementBlockers(state, state.players[0]!, 'wall', node).nodes, [node.id]);
    const unit = addUnit(state, kind, { x: 250, y: 300 });
    for (let step = 0; step < 200 && distance(unit, { x: 700, y: 300 }) > .01; step++) {
      moveUnitToward(state, unit, { x: 700, y: 300 }, 5);
      equal(distance(unit, node) >= resourceNodeRadius(node) + unitRadius(unit) - .001, true);
      equal(distanceToFootprint(unit, buildingFootprint(state, base)) >= unitRadius(unit) - .001, true);
    }
    equal(distance(unit, { x: 700, y: 300 }) < .01, true);
    const destination = movementDestination(state, unit, base);
    equal(distanceToFootprint(destination, buildingFootprint(state, base)) >= unitRadius(unit), true);
  }
});

test('Stronghold gatherers complete repeated deliveries without entering resource or castle borders', () => {
  const state = createStronghold(undefined, 'fall');
  state.units = [];
  const castle = state.buildings.find(building => building.kind === 'castle')!;
  const node = { id: 900, x: 500, y: 450, rich: false, remaining: 100 };
  state.nodes = [node];
  const worker = addUnit(state, 'worker', { x: 500, y: 490 });
  for (let step = 0; step < 900; step++) {
    updateLogistics(state, .1);
    equal(distance(worker, node) >= resourceNodeRadius(node) + unitRadius(worker) - .001, true);
    equal(distanceToFootprint(worker, buildingFootprint(state, castle)) >= unitRadius(worker) - .001, true);
  }
  equal(state.resources >= 62, true);
});
