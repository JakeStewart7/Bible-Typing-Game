import { distance, moveToward, validPoint } from './rules.ts';
import type { Building, Point, StrongholdState, Unit } from './types.ts';
import { SEASON_BONUSES } from './environment.ts';

export const WALL_HALF_LENGTH = 24.5;
export const WALL_HALF_WIDTH = 5.5;
const UNIT_RADIUS = 10;
type World = Pick<StrongholdState, 'buildings'>;
type Obstacle = { wall: Building; x: number; y: number; cosine: number; sine: number; halfX: number; halfY: number };
type Layout = { signature: string; obstacles: Obstacle[]; corners: Point[]; edges: { to: number; cost: number }[][] };
const layouts = new WeakMap<World, Layout>();
const routes = new WeakMap<Unit, { layout: Layout; target: Point; path: Point[] }>();

export function wallLocal(point: Point, wall: Point & { rotation?: number }): Point {
  const angle = (wall.rotation ?? 0) * Math.PI / 180;
  const x = point.x - wall.x, y = point.y - wall.y;
  return { x: x * Math.cos(angle) + y * Math.sin(angle), y: -x * Math.sin(angle) + y * Math.cos(angle) };
}
export function wallContains(point: Point, wall: Point & { rotation?: number }, padding = 0): boolean {
  const local = wallLocal(point, wall);
  return Math.abs(local.x) < WALL_HALF_LENGTH + padding && Math.abs(local.y) < WALL_HALF_WIDTH + padding;
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
function clear(start: Point, end: Point, obstacles: readonly Obstacle[], ignore?: Building): boolean {
  return obstacles.every(obstacle => obstacle.wall === ignore || !intersects(start, end, obstacle));
}
function layoutFor(world: World): Layout {
  const walls = world.buildings.filter(building => building.kind === 'wall' && building.hp > 0);
  const signature = walls.map(wall => `${wall.id}:${wall.x}:${wall.y}:${wall.rotation ?? 0}`).join('|');
  const cached = layouts.get(world);
  if (cached?.signature === signature) return cached;
  const obstacles = walls.map(wall => {
    const radians = (wall.rotation ?? 0) * Math.PI / 180;
    return { wall, x: wall.x, y: wall.y, cosine: Math.cos(radians), sine: Math.sin(radians),
      halfX: WALL_HALF_LENGTH + UNIT_RADIUS, halfY: WALL_HALF_WIDTH + UNIT_RADIUS };
  });
  const corners = obstacles.flatMap(obstacle => [-1, 1].flatMap(x => [-1, 1].map(y => {
    const dx = x * (obstacle.halfX + .5), dy = y * (obstacle.halfY + .5);
    return { x: obstacle.x + dx * obstacle.cosine - dy * obstacle.sine,
      y: obstacle.y + dx * obstacle.sine + dy * obstacle.cosine };
  }))).filter(point => validPoint(point) && clear(point, point, obstacles));
  const edges: Layout['edges'] = corners.map(() => []);
  corners.forEach((a, from) => corners.forEach((b, to) => {
    if (from !== to && clear(a, b, obstacles)) edges[from]?.push({ to, cost: distance(a, b) });
  }));
  const layout = { signature, obstacles, corners, edges };
  layouts.set(world, layout);
  return layout;
}

export function wallBetween(world: World, start: Point, end: Point, ignore?: Building): Building | undefined {
  return layoutFor(world).obstacles.find(obstacle => obstacle.wall !== ignore && intersects(start, end, {
    ...obstacle, halfX: WALL_HALF_LENGTH, halfY: WALL_HALF_WIDTH
  }))?.wall;
}
function findPath(layout: Layout, start: Point, target: Point): Point[] {
  if (clear(start, target, layout.obstacles)) return [{ ...target }];
  const points = [...layout.corners, target];
  const costs = points.map(point => clear(start, point, layout.obstacles) ? distance(start, point) : Infinity);
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
    const edges = [...(layout.edges[current] ?? [])];
    if (clear(point, target, layout.obstacles)) edges.push({ to: points.length - 1, cost: distance(point, target) });
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
  const layout = layoutFor(world);
  let route = routes.get(unit);
  if (!route || route.layout !== layout || distance(route.target, target) > .1) {
    route = { layout, target: { ...target }, path: findPath(layout, unit, target) };
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

export function wallApproach(unit: Point, wall: Building): Point {
  const angle = (wall.rotation ?? 0) * Math.PI / 180;
  const point = wallLocal(unit, wall);
  const x = Math.max(-WALL_HALF_LENGTH - UNIT_RADIUS - .5, Math.min(WALL_HALF_LENGTH + UNIT_RADIUS + .5, point.x));
  let y = Math.max(-WALL_HALF_WIDTH - UNIT_RADIUS - .5, Math.min(WALL_HALF_WIDTH + UNIT_RADIUS + .5, point.y));
  if (Math.abs(x) < WALL_HALF_LENGTH + UNIT_RADIUS + .5) y = (point.y < 0 ? -1 : 1) * (WALL_HALF_WIDTH + UNIT_RADIUS + .5);
  return { x: wall.x + x * Math.cos(angle) - y * Math.sin(angle), y: wall.y + x * Math.sin(angle) + y * Math.cos(angle) };
}
