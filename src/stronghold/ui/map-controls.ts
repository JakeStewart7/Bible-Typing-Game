import { actionProblem, placementProblem } from '../domain/actions.ts';
import { taskWork } from '../domain/technology.ts';
import type { Building, BuildingKind, Point, StrongholdSnapshot, Unit } from '../domain/types.ts';
import { buildingMarkup, relayPreviewMarkup } from './battlefield.ts';
import { setAttribute } from './dom-updates.ts';
import { playerTheme } from './player-theme.ts';

export type PlacementKind = Extract<BuildingKind, 'relay' | 'barracks' | 'tower' | 'wall'>;
export function readyBuilding(snapshot: StrongholdSnapshot): PlacementKind | null {
  const self = snapshot.players.find(player => player.id === snapshot.selfId);
  if (!self || snapshot.phase !== 'playing' || self.work < taskWork(self) || actionProblem(snapshot, self, self.action)) return null;
  return self.action === 'barracks' || self.action === 'tower' || self.action === 'wall' ? self.action : null;
}
export function selectionBounds(start: Point, end: Point) {
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}
export function troopsInRectangle(units: readonly Unit[], start: Point, end: Point): number[] {
  const bounds = selectionBounds(start, end);
  return units.filter(unit => unit.hp > 0 && unit.kind !== 'invader'
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
  const relayPreview = document.createElementNS(namespace, 'g');
  relayPreview.setAttribute('data-relay-preview', '');
  relayPreview.setAttribute('pointer-events', 'none');
  const wallSelection = document.createElementNS(namespace, 'g');
  wallSelection.setAttribute('data-wall-selection', '');
  wallSelection.setAttribute('pointer-events', 'none');
  wallSelection.setAttribute('visibility', 'hidden');
  wallSelection.innerHTML = '<rect x="-29" y="-10" width="58" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 3"/>';
  const moveIndicator = document.createElementNS(namespace, 'g');
  moveIndicator.setAttribute('data-move-indicator', '');
  moveIndicator.setAttribute('pointer-events', 'none');
  moveIndicator.setAttribute('visibility', 'hidden');
  moveIndicator.innerHTML = '<g><circle r="12" fill="none" stroke-width="2"/><path d="M-17 0h6m22 0h6M0-17v6m0 22v6" fill="none" stroke-width="2"/><circle r="3" stroke="none"/></g>';
  const pulse = moveIndicator.firstElementChild;
  if (!pulse) throw new Error('Missing Stronghold movement indicator.');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
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
  map.append(relayPreview, wallSelection, ghost, selection, moveIndicator);
  let signature = '';
  let relaySignature = '';
  let highlight = '#ffb3c9';
  return {
    theme(color: string): void {
      const theme = playerTheme(color);
      highlight = theme.light;
      setAttribute(selection, 'fill', theme.light);
      setAttribute(selection, 'stroke', theme.bold);
      setAttribute(pulse, 'stroke', theme.bold);
      setAttribute(pulse, 'fill', theme.light);
    },
    relayPreview(snapshot: StrongholdSnapshot, point: Point | null, sourceId?: number): void {
      const markup = point && snapshot.phase === 'playing' ? relayPreviewMarkup(snapshot, point, sourceId) : '';
      if (markup !== relaySignature) { relayPreview.innerHTML = markup; relaySignature = markup; }
    },
    wallSelection(wall: Building | null): void {
      setAttribute(wallSelection, 'visibility', wall ? 'visible' : 'hidden');
      if (wall) setAttribute(wallSelection, 'transform', `translate(${wall.x} ${wall.y}) rotate(${wall.rotation ?? 0})`);
    },
    moveIndicator(point: Point | null): void {
      for (const animation of pulse.getAnimations()) animation.cancel();
      setAttribute(moveIndicator, 'visibility', point ? 'visible' : 'hidden');
      if (!point) return;
      setAttribute(moveIndicator, 'transform', `translate(${point.x} ${point.y})`);
      const animation = pulse.animate(motion.matches
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [{ opacity: 1, transform: 'scale(.6)' }, { opacity: 0, transform: 'scale(1.5)' }],
      { duration: 550, fill: 'forwards' });
      animation.onfinish = () => setAttribute(moveIndicator, 'visibility', 'hidden');
    },
    ghost(snapshot: StrongholdSnapshot, kind: PlacementKind | null, point: Point | null, rotation = 0): void {
      const self = snapshot.players.find(player => player.id === snapshot.selfId);
      if (!self || !kind || !point || snapshot.phase !== 'playing') {
        setAttribute(ghost, 'visibility', 'hidden');
        return;
      }
      const nextSignature = `${kind}/${self.constructionTier}/${rotation}`;
      if (signature !== nextSignature) {
        ghost.innerHTML = buildingMarkup({
          ...point, id: 0, kind, hp: 1, maxHp: 1, tier: self.constructionTier,
          progress: 1, cooldown: 0, enemy: false, attackTarget: null, ownerId: self.id, rotation, trainingQueue: []
        }) + (kind === 'wall'
          ? `<rect data-outline transform="rotate(${rotation})" x="-29" y="-10" width="58" height="20" fill="none" stroke-width="3" stroke-dasharray="5 3"/>`
          : '<rect data-outline x="-22" y="-28" width="44" height="58" fill="none" stroke-width="3" stroke-dasharray="5 3"/>');
        signature = nextSignature;
      }
      setAttribute(ghost, 'transform', `translate(${point.x} ${point.y})`);
      setAttribute(ghost, 'visibility', 'visible');
      const outline = ghost.querySelector('[data-outline]');
      if (!outline) throw new Error('Missing Stronghold placement outline.');
      const problem = placementProblem(snapshot, self, kind, point, rotation);
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
