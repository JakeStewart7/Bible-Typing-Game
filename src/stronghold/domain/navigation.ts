import { distance, moveToward, validPoint } from './rules.ts';
import type { Building, Point, StrongholdState, Unit } from './types.ts';
import { buildingScale } from './technology.ts';
import { SEASON_BONUSES } from './environment.ts';

export const WALL_HALF_LENGTH = 24.5;
export const WALL_HALF_WIDTH = 6.875;
const UNIT_RADIUS = 10;
type World = Pick<StrongholdState, 'buildings' | 'technology'>;
type Obstacle = { wall: Building; x: number; y: number; cosine: number; sine: number; halfX: number; halfY: number;
  kind: Building['kind']; tier: number; rotation: number; scale: number };
type Layout = { obstacles: Obstacle[]; corners: Point[]; edges: ({ to: number; cost: number }[] | undefined)[] };
const layouts = new WeakMap<World, Map<number, Layout>>();
const routes = new WeakMap<Unit, { layout: Layout; target: Point; path: Point[]; fallback: boolean }>();
export function unitRadius(unit: Partial<Pick<Unit, 'kind' | 'formation'>>): number {
  return (unit.formation ?? unit.kind) === 'catapult' ? 20 : UNIT_RADIUS;
}

export function buildingFootprint(world: Pick<StrongholdState, 'technology'>, building: Pick<Building, 'kind' | 'tier' | 'enemy' | 'rotation'> & Point) {
  const scale = buildingScale(world, building);
  const halfX = building.kind === 'wall' ? WALL_HALF_LENGTH : building.kind === 'castle' || building.kind === 'enemy-base' ? 36
    : building.kind === 'tower' ? 12 + building.tier * 3 : building.kind === 'relay' ? 11 : 16;
  const halfY = building.kind === 'wall' ? WALL_HALF_WIDTH : building.kind === 'castle' || building.kind === 'enemy-base' ? 36
    : building.kind === 'tower' ? 18 + building.tier * 3 : building.kind === 'relay' ? 20 : 16;
  return { x: building.x, y: building.y, halfX: halfX * scale, halfY: halfY * scale, rotation: building.kind === 'wall' ? building.rotation ?? 0 : 0 };
}
type Footprint = ReturnType<typeof buildingFootprint>;
export function footprintCorners(box: Footprint): Point[] {
  const angle = box.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return [-1, 1].flatMap(x => [-1, 1].map(y => ({ x: box.x + x * box.halfX * c - y * box.halfY * s,
    y: box.y + x * box.halfX * s + y * box.halfY * c })));
}
export function footprintsOverlap(a: Footprint, b: Footprint, gap = 3): boolean {
  const ac = footprintCorners(a), bc = footprintCorners(b);
  return [a.rotation, a.rotation + 90, b.rotation, b.rotation + 90].every(angle => {
    const x = Math.cos(angle * Math.PI / 180), y = Math.sin(angle * Math.PI / 180);
    const ap = ac.map(p => p.x * x + p.y * y), bp = bc.map(p => p.x * x + p.y * y);
    return Math.max(...ap) + gap > Math.min(...bp) && Math.max(...bp) + gap > Math.min(...ap);
  });
}
export function wallLocal(point: Point, wall: Point & { rotation?: number }): Point {
  const angle = (wall.rotation ?? 0) * Math.PI / 180;
  const x = point.x - wall.x, y = point.y - wall.y;
  return { x: x * Math.cos(angle) + y * Math.sin(angle), y: -x * Math.sin(angle) + y * Math.cos(angle) };
}
export function wallContains(point: Point, wall: Point & { rotation?: number }, padding = 0): boolean {
  const local = wallLocal(point, wall);
  return Math.abs(local.x) < WALL_HALF_LENGTH + padding && Math.abs(local.y) < WALL_HALF_WIDTH + padding;
}
export function unitSpawnPoint(world: Pick<StrongholdState, 'buildings' | 'units'>, origin: Point, radiusPadding = UNIT_RADIUS): Point | undefined {
  const directions = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 },
    { x: 1, y: -1 }, { x: -1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }];
  for (const radius of [30, 50, 70, 90]) for (const direction of directions) {
    const point = { x: origin.x + direction.x * radius, y: origin.y + direction.y * radius };
    if (unitSpawnClear(world, point, radiusPadding)) return point;
  }
  return undefined;
}
export function unitSpawnClear(world: Pick<StrongholdState, 'buildings' | 'units'>, point: Point, padding = UNIT_RADIUS): boolean {
  return validPoint(point) && world.units.every(unit => unit.hp <= 0 || distance(unit, point) >= padding + unitRadius(unit))
    && world.buildings.every(building => building.hp <= 0 || (building.kind === 'wall'
      ? !wallContains(point, building, padding)
      : distance(point, building) >= (building.kind === 'castle' || building.kind === 'enemy-base' ? 34 : 14) + padding));
}
function local(point: Point, obstacle: Obstacle): Point {
  const x = point.x - obstacle.x, y = point.y - obstacle.y;
  return { x: x * obstacle.cosine + y * obstacle.sine, y: -x * obstacle.sine + y * obstacle.cosine };
}
function intersects(start: Point, end: Point, obstacle: Obstacle): boolean {
  const a = local(start, obstacle), b = local(end, obstacle);
  let enter = 0, leave = 1;
  for (const [origin, delta, half] of [[a.x, b.x - a.x, obstacle.halfX], [a.y, b.y - a.y, obstacle.halfY]]) {
    if (origin === undefined || delta === undefined || half === undefined) throw new Error('Invalid wall bounds.');
    if (Math.abs(delta) < 1e-9) {
      if (Math.abs(origin) >= half) return false;
    } else {
      const first = (-half - origin) / delta, second = (half - origin) / delta;
      enter = Math.max(enter, Math.min(first, second));
      leave = Math.min(leave, Math.max(first, second));
      if (enter >= leave) return false;
    }
  }
  return enter < leave;
}
function clear(start: Point, end: Point, obstacles: readonly Obstacle[], ignore: readonly Building[] = []): boolean {
  return obstacles.every(obstacle => ignore.includes(obstacle.wall) || !intersects(start, end, obstacle));
}
function layoutFor(world: World, padding = UNIT_RADIUS): Layout {
  const cache = layouts.get(world) ?? new Map<number, Layout>();
  const cached = cache.get(padding);
  if (cached) {
    let index = 0;
    const unchanged = world.buildings.every(building => {
      if (building.hp <= 0) return true;
      const previous = cached.obstacles[index++];
      return previous?.wall === building && previous.x === building.x && previous.y === building.y
        && previous.kind === building.kind && previous.tier === building.tier
        && previous.rotation === (building.rotation ?? 0) && previous.scale === buildingScale(world, building);
    });
    if (unchanged && index === cached.obstacles.length) return cached;
  }
  const buildings = world.buildings.filter(building => building.hp > 0);
  const obstacles = buildings.map(wall => {
    const box = buildingFootprint(world, wall), radians = box.rotation * Math.PI / 180;
    return { wall, x: wall.x, y: wall.y, cosine: Math.cos(radians), sine: Math.sin(radians),
      halfX: box.halfX + padding, halfY: box.halfY + padding,
      kind: wall.kind, tier: wall.tier, rotation: wall.rotation ?? 0, scale: buildingScale(world, wall) };
  });
  const corners = obstacles.flatMap(obstacle => [-1, 1].flatMap(x => [-1, 1].map(y => {
    const dx = x * (obstacle.halfX + .5), dy = y * (obstacle.halfY + .5);
    return { x: obstacle.x + dx * obstacle.cosine - dy * obstacle.sine,
      y: obstacle.y + dx * obstacle.sine + dy * obstacle.cosine };
  }))).filter(point => validPoint(point) && clear(point, point, obstacles));
  const layout: Layout = { obstacles, corners, edges: [] };
  cache.set(padding, layout);
  layouts.set(world, cache);
  return layout;
}

export function wallBetween(world: World, start: Point, end: Point, ignore?: Building): Building | undefined {
  return layoutFor(world).obstacles.find(obstacle => obstacle.wall.kind === 'wall' && obstacle.wall !== ignore && intersects(start, end, {
    ...obstacle, halfX: WALL_HALF_LENGTH, halfY: WALL_HALF_WIDTH
  }))?.wall;
}
function findPath(layout: Layout, start: Point, target: Point): Point[] {
  const containing = (point: Point) => layout.obstacles.filter(obstacle => {
    const p = local(point, obstacle);
    return Math.abs(p.x) < obstacle.halfX && Math.abs(p.y) < obstacle.halfY;
  }).map(obstacle => obstacle.wall);
  const startBuildings = containing(start), targetBuildings = containing(target);
  if (clear(start, target, layout.obstacles, [...startBuildings, ...targetBuildings])) return [{ ...target }];
  const points = [...layout.corners, target];
  const costs = points.map((point, index) => clear(start, point, layout.obstacles,
    index === points.length - 1 ? [...startBuildings, ...targetBuildings] : startBuildings) ? distance(start, point) : Infinity);
  const previous = points.map(() => -1);
  const visited = new Set<number>();
  for (let step = 0; step < points.length; step++) {
    let current = -1, cost = Infinity;
    costs.forEach((value, index) => { if (!visited.has(index) && value < cost) { current = index; cost = value; } });
    if (current < 0) return [];
    if (current === points.length - 1) {
      const path: Point[] = [];
      for (let index = current; index >= 0; index = previous[index] ?? -1) {
        const point = points[index];
        if (!point) throw new Error('Missing navigation waypoint.');
        path.unshift(point);
      }
      return path;
    }
    visited.add(current);
    const point = points[current];
    if (!point) throw new Error('Missing navigation vertex.');
    let neighbors = layout.edges[current];
    if (!neighbors) {
      neighbors = layout.corners.flatMap((candidate, to) =>
        to !== current && clear(point, candidate, layout.obstacles) ? [{ to, cost: distance(point, candidate) }] : []);
      layout.edges[current] = neighbors;
    }
    const edges = [...neighbors];
    if (clear(point, target, layout.obstacles, targetBuildings)) edges.push({ to: points.length - 1, cost: distance(point, target) });
    for (const edge of edges) {
      if (cost + edge.cost < (costs[edge.to] ?? Infinity)) {
        costs[edge.to] = cost + edge.cost; previous[edge.to] = current;
      }
    }
  }
  return [];
}
export function moveUnitToward(world: World & Pick<StrongholdState, 'season'>, unit: Unit, target: Point, travel: number): boolean {
  travel *= SEASON_BONUSES[world.season].movement;
  const layout = layoutFor(world, unitRadius(unit));
  let route = routes.get(unit);
  // Moving combat targets do not need a new graph search for every subpixel step.
  if (!route || route.fallback || route.layout !== layout || distance(route.target, target) > 4
    || (!route.path.length && distance(unit, target) > .1)) {
    const path = findPath(layout, unit, target);
    route = { layout, target: { ...target }, path, fallback: !path.length };
    if (!route.path.length) route.path.push({ ...target });
    routes.set(unit, route);
  }
  if (!route.path.length) return distance(unit, target) < .1;
  while (travel > 0 && route.path.length) {
    const next = route.path[0];
    if (!next) break;
    const length = distance(unit, next);
    moveToward(unit, next, travel);
    travel -= length;
    if (distance(unit, next) < .001) route.path.shift();
  }
  return true;
}

export function wallApproach(unit: Point & Partial<Pick<Unit, 'kind' | 'formation'>>, wall: Building): Point {
  const angle = (wall.rotation ?? 0) * Math.PI / 180;
  const point = wallLocal(unit, wall);
  const padding = unitRadius(unit);
  const x = Math.max(-WALL_HALF_LENGTH - padding - .5, Math.min(WALL_HALF_LENGTH + padding + .5, point.x));
  let y = Math.max(-WALL_HALF_WIDTH - padding - .5, Math.min(WALL_HALF_WIDTH + padding + .5, point.y));
  if (Math.abs(x) < WALL_HALF_LENGTH + padding + .5) y = (point.y < 0 ? -1 : 1) * (WALL_HALF_WIDTH + padding + .5);
  return { x: wall.x + x * Math.cos(angle) - y * Math.sin(angle), y: wall.y + x * Math.sin(angle) + y * Math.cos(angle) };
}
