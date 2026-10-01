import { placementProblem } from '../domain/actions.ts';
import { taskWork } from '../domain/technology.ts';
import type { BuildingKind, Point, StrongholdSnapshot, Unit } from '../domain/types.ts';
import { buildingMarkup } from './battlefield.ts';
import { setAttribute } from './dom-updates.ts';
import { playerTheme } from './player-theme.ts';

export type PlacementKind = Extract<BuildingKind, 'relay' | 'barracks' | 'tower' | 'wall'>;
export function readyBuilding(snapshot: StrongholdSnapshot): PlacementKind | null {
  const self = snapshot.players.find(player => player.id === snapshot.selfId);
  if (!self || snapshot.phase !== 'playing' || self.work < taskWork(self)) return null;
  return self.action === 'barracks' || self.action === 'tower' || self.action === 'wall' ? self.action : null;
}
export function selectionBounds(start: Point, end: Point) {
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}
export function troopsInRectangle(units: readonly Unit[], start: Point, end: Point): number[] {
  const bounds = selectionBounds(start, end);
  return units.filter(unit => unit.hp > 0 && ['warrior', 'archer', 'catapult'].includes(unit.kind)
    && unit.x >= bounds.x && unit.x <= bounds.x + bounds.width && unit.y >= bounds.y && unit.y <= bounds.y + bounds.height)
    .map(unit => unit.id);
}
export function mapPoint(map: SVGSVGElement, clientX: number, clientY: number): Point | null {
  const matrix = map.getScreenCTM();
  if (!matrix) return null;
  const point = map.createSVGPoint();
  point.x = clientX; point.y = clientY;
  const location = point.matrixTransform(matrix.inverse());
  return { x: location.x, y: location.y };
}
export function createMapControls(map: SVGSVGElement) {
  const namespace = 'http://www.w3.org/2000/svg';
  const ghost = document.createElementNS(namespace, 'g');
  ghost.setAttribute('data-placement-ghost', '');
  ghost.setAttribute('pointer-events', 'none');
  ghost.setAttribute('opacity', '.55');
  ghost.setAttribute('visibility', 'hidden');
  const selection = document.createElementNS(namespace, 'rect');
  selection.setAttribute('data-drag-selection', '');
  selection.setAttribute('pointer-events', 'none');
  selection.setAttribute('fill', '#ffffff33');
  selection.setAttribute('fill-opacity', '.3');
  selection.setAttribute('stroke', '#fff');
  selection.setAttribute('stroke-width', '2');
  selection.setAttribute('visibility', 'hidden');
  map.append(ghost, selection);
  let signature = '';
  let highlight = '#ffb3c9';
  return {
    theme(color: string): void {
      const theme = playerTheme(color);
      highlight = theme.light;
      setAttribute(selection, 'fill', theme.light);
      setAttribute(selection, 'stroke', theme.bold);
    },
    ghost(snapshot: StrongholdSnapshot, kind: PlacementKind | null, point: Point | null): void {
      const self = snapshot.players.find(player => player.id === snapshot.selfId);
      if (!self || !kind || !point || snapshot.phase !== 'playing') {
        setAttribute(ghost, 'visibility', 'hidden');
        return;
      }
      const nextSignature = `${kind}/${self.constructionTier}`;
      if (signature !== nextSignature) {
        ghost.innerHTML = buildingMarkup({
          ...point, id: 0, kind, hp: 1, maxHp: 1, tier: self.constructionTier,
          progress: 1, cooldown: 0, enemy: false, attackTarget: null, ownerId: self.id
        }) + '<rect data-outline x="-22" y="-28" width="44" height="58" fill="none" stroke-width="3" stroke-dasharray="5 3"/>';
        signature = nextSignature;
      }
      setAttribute(ghost, 'transform', `translate(${point.x} ${point.y})`);
      setAttribute(ghost, 'visibility', 'visible');
      const outline = ghost.querySelector('[data-outline]');
      if (!outline) throw new Error('Missing Stronghold placement outline.');
      const problem = placementProblem(snapshot, self, kind, point);
      setAttribute(outline, 'stroke', problem ? '#ff1726' : highlight);
      setAttribute(ghost, 'data-valid', String(!problem));
    },
    selection(start: Point | null, end: Point | null): void {
      setAttribute(selection, 'visibility', start && end ? 'visible' : 'hidden');
      if (!start || !end) return;
      const bounds = selectionBounds(start, end);
      for (const [name, value] of Object.entries(bounds)) setAttribute(selection, name, String(value));
    }
  };
}
