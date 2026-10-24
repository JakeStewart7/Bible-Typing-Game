import type { BuildingKind, FogOfWar, Point, StrongholdState, UnitKind, VisionSource } from './types.ts';

export const FOG_CELL_SIZE = 20;
export const FOG_COLUMNS = 50;
export const FOG_ROWS = 33;
const UNIT_SIGHT: Record<UnitKind, number> = { worker: 80, builder: 80, warrior: 110, archer: 140, catapult: 170, invader: 110 };
const BUILDING_SIGHT: Record<BuildingKind, number> = { castle: 200, 'enemy-base': 200, barracks: 160, tower: 220, relay: 120, wall: 80 };
type World = Pick<StrongholdState, 'units' | 'buildings'>;

export function visionSources(world: World, enemy = false): VisionSource[] {
  return [
    ...world.units.filter(unit => unit.hp > 0 && (unit.kind === 'invader') === enemy).map(unit => ({
      id: `unit-${unit.id}`, x: unit.x, y: unit.y, radius: UNIT_SIGHT[unit.formation ?? unit.kind]
    })),
    ...world.buildings.filter(building => building.hp > 0 && building.enemy === enemy && building.progress === 1).map(building => ({
      id: `building-${building.id}`, x: building.x, y: building.y, radius: BUILDING_SIGHT[building.kind]
    }))
  ];
}
export function inVision(sources: readonly VisionSource[], point: Point): boolean {
  const x = Math.floor(point.x / FOG_CELL_SIZE), y = Math.floor(point.y / FOG_CELL_SIZE);
  return x >= 0 && x < FOG_COLUMNS && y >= 0 && y < FOG_ROWS && sources.some(source => seesCell(source, x, y));
}
function seesCell(source: VisionSource, x: number, y: number): boolean {
  const dx = Math.max(0, Math.abs((x + .5) * FOG_CELL_SIZE - source.x) - FOG_CELL_SIZE / 2);
  const dy = Math.max(0, Math.abs((y + .5) * FOG_CELL_SIZE - source.y) - FOG_CELL_SIZE / 2);
  return dx * dx + dy * dy < source.radius ** 2;
}
export function visibleCells(sources: readonly VisionSource[]): number[] {
  const cells = new Set<number>();
  for (const source of sources) {
    const minX = Math.max(0, Math.floor((source.x - source.radius) / FOG_CELL_SIZE));
    const maxX = Math.min(FOG_COLUMNS - 1, Math.floor((source.x + source.radius) / FOG_CELL_SIZE));
    const minY = Math.max(0, Math.floor((source.y - source.radius) / FOG_CELL_SIZE));
    const maxY = Math.min(FOG_ROWS - 1, Math.floor((source.y + source.radius) / FOG_CELL_SIZE));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      if (seesCell(source, x, y)) cells.add(y * FOG_COLUMNS + x);
    }
  }
  return [...cells];
}
export function createFog(): FogOfWar {
  return { sources: [], explored: [], units: [], buildings: [], nodes: [] };
}
export function updateFog(state: StrongholdState): void {
  const fog = state.fog;
  const sources = visionSources(state);
  fog.sources = sources;
  const explored = new Set(fog.explored);
  for (const cell of visibleCells(sources)) explored.add(cell);
  if (explored.size !== fog.explored.length) fog.explored = [...explored];
  // A memory is replaced only by a current sighting, or cleared by revisiting its empty location.
  const remember = <T extends Point & { id: number }>(previous: T[], current: T[]): T[] => {
    const visible = current.filter(entity => inVision(sources, entity));
    const seen = new Set(visible.map(entity => entity.id));
    return [...previous.filter(entity => !seen.has(entity.id) && !inVision(sources, entity)), ...visible.map(entity => ({ ...entity }))];
  };
  fog.units = remember(fog.units, state.units.filter(unit => unit.kind === 'invader' && unit.hp > 0).map(unit => ({
    ...unit, destination: null, manualMove: false, attackTarget: null, cooldown: 0, task: null
  })));
  fog.buildings = remember(fog.buildings, state.buildings.filter(building => building.enemy && building.hp > 0).map(building => ({
    ...building, attackTarget: null, cooldown: 0, rally: null, trainingQueue: []
  })));
  fog.nodes = remember(fog.nodes, state.nodes);
}

export function knownResourceNodes(state: Pick<StrongholdState, 'nodes' | 'fog' | 'units' | 'buildings'>) {
  const sources = visionSources(state);
  const visible = state.nodes.filter(node => inVision(sources, node));
  const seen = new Set(visible.map(node => node.id));
  return [...visible, ...state.fog.nodes.filter(node => !seen.has(node.id) && !inVision(sources, node))];
}

export function exploredPath(cells: readonly number[]): string {
  const explored = new Set(cells);
  const segments: string[] = [];
  for (let y = 0; y < FOG_ROWS; y++) {
    for (let x = 0; x < FOG_COLUMNS; x++) {
      if (!explored.has(y * FOG_COLUMNS + x)) continue;
      const start = x;
      while (x + 1 < FOG_COLUMNS && explored.has(y * FOG_COLUMNS + x + 1)) x++;
      segments.push(`M${start * FOG_CELL_SIZE} ${y * FOG_CELL_SIZE}h${(x - start + 1) * FOG_CELL_SIZE}v${FOG_CELL_SIZE}h${-(x - start + 1) * FOG_CELL_SIZE}Z`);
    }
  }
  return segments.join('');
}
