import { actionProblem, placementBlockers, placementProblem } from '../domain/actions.ts';
import { buildingScale, taskWork } from '../domain/technology.ts';
import type { Building, BuildingKind, Point, StrongholdSnapshot, Unit } from '../domain/types.ts';
import { buildingMarkup, relayPreviewMarkup } from './battlefield.ts';
import { setAttribute } from './dom-updates.ts';
import { playerTheme } from './player-theme.ts';
import { buildingFootprint, WALL_HALF_WIDTH } from '../domain/navigation.ts';

export type PlacementKind = Extract<BuildingKind, 'relay' | 'barracks' | 'tower' | 'wall'>;
const WALL_OUTLINE_HEIGHT = WALL_HALF_WIDTH * 2 + 9;
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
  wallSelection.innerHTML = `<rect x="-29" y="${-WALL_OUTLINE_HEIGHT / 2}" width="58" height="${WALL_OUTLINE_HEIGHT}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 3"/>`;
  const moveIndicator = document.createElementNS(namespace, 'g');
  moveIndicator.setAttribute('data-move-indicator', '');
  moveIndicator.setAttribute('pointer-events', 'none');
  moveIndicator.setAttribute('visibility', 'hidden');
  moveIndicator.innerHTML = '<g><circle r="12" fill="none" stroke-width="2"/><path d="M-17 0h6m22 0h6M0-17v6m0 22v6" fill="none" stroke-width="2"/><circle r="3" stroke="none"/></g>';
  const pulse = moveIndicator.firstElementChild;
  if (!pulse) throw new Error('Missing Stronghold movement indicator.');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ghost = document.createElementNS(namespace, 'g');
  const obstructions = document.createElementNS(namespace, 'g');
  obstructions.setAttribute('data-placement-blockers', '');
  obstructions.setAttribute('pointer-events', 'none');
  const buildingSelection = document.createElementNS(namespace, 'g');
  buildingSelection.setAttribute('data-building-selection', '');
  buildingSelection.setAttribute('pointer-events', 'none');
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
  map.append(relayPreview, wallSelection, buildingSelection, obstructions, ghost, selection, moveIndicator);
  let signature = '';
  let relaySignature = '';
  let highlight = '#ffb3c9';
  let ink = '#b00020';
  return {
    theme(color: string): void {
      const theme = playerTheme(color);
      highlight = theme.light;
      ink = theme.bold;
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
    buildingSelection(snapshot: StrongholdSnapshot, ids: ReadonlySet<number>): void {
      buildingSelection.innerHTML = snapshot.buildings.filter(building => ids.has(building.id) && !building.enemy && building.hp > 0).map(building => {
        const box = buildingFootprint(snapshot, building), rally = building.rally ?? (building.kind === 'barracks' ? snapshot.rally : null);
        return `<g data-selected-building="${building.id}"><rect transform="translate(${box.x} ${box.y}) rotate(${box.rotation})" x="${-box.halfX - 4}" y="${-box.halfY - 4}" width="${box.halfX * 2 + 8}" height="${box.halfY * 2 + 8}" fill="${highlight}" fill-opacity=".15" stroke="${ink}" stroke-width="2"/>
          ${rally ? `<path d="M${building.x} ${building.y}L${rally.x} ${rally.y}" stroke="${ink}" stroke-width="2" stroke-dasharray="5 4"/><g transform="translate(${rally.x} ${rally.y})" data-building-rally="${building.id}"><path d="M0 8V-14L15 -8L0 -2" fill="${highlight}" stroke="${ink}" stroke-width="2"/></g>` : ''}</g>`;
      }).join('');
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
    ghost(snapshot: StrongholdSnapshot, kind: PlacementKind | null, point: Point | null, rotation = 0): string | null {
      const self = snapshot.players.find(player => player.id === snapshot.selfId);
      if (!self || !kind || !point || snapshot.phase !== 'playing') {
        setAttribute(ghost, 'visibility', 'hidden');
        obstructions.innerHTML = '';
        return null;
      }
      const building = { ...point, kind, tier: self.constructionTier, rotation, enemy: false };
      const scale = buildingScale(snapshot, building), box = buildingFootprint(snapshot, building);
      const nextSignature = `${kind}/${self.constructionTier}/${rotation}/${scale}`;
      if (signature !== nextSignature) {
        ghost.innerHTML = buildingMarkup({
          ...point, id: 0, kind, hp: 1, maxHp: 1, tier: self.constructionTier,
          progress: 1, cooldown: 0, enemy: false, attackTarget: null, ownerId: self.id, rotation, trainingQueue: [], rally: null
        }) + `<rect data-outline transform="rotate(${box.rotation})" x="${-box.halfX / scale}" y="${-box.halfY / scale}" width="${box.halfX * 2 / scale}" height="${box.halfY * 2 / scale}" fill="none" stroke-width="2" stroke-dasharray="5 3"/>`;
        signature = nextSignature;
      }
      setAttribute(ghost, 'transform', `translate(${point.x} ${point.y}) scale(${scale})`);
      setAttribute(ghost, 'visibility', 'visible');
      const outline = ghost.querySelector('[data-outline]');
      if (!outline) throw new Error('Missing Stronghold placement outline.');
      const problem = placementProblem(snapshot, self, kind, point, rotation);
      const blockers = placementBlockers(snapshot, self, kind, point, rotation);
      obstructions.innerHTML = snapshot.buildings.filter(building => blockers.buildings.includes(building.id)).map(building => {
        const box = buildingFootprint(snapshot, building);
        return `<rect data-blocking-building="${building.id}" transform="translate(${box.x} ${box.y}) rotate(${box.rotation})" x="${-box.halfX - 2}" y="${-box.halfY - 2}" width="${box.halfX * 2 + 4}" height="${box.halfY * 2 + 4}" fill="#ff1726" fill-opacity=".35" stroke="#ff1726" stroke-width="3"/>`;
      }).join('') + snapshot.units.filter(unit => blockers.units.includes(unit.id)).map(unit => `<circle data-blocking-unit="${unit.id}" cx="${unit.x}" cy="${unit.y}" r="15" fill="#ff1726" fill-opacity=".35" stroke="#ff1726" stroke-width="3"/>`).join('');
      setAttribute(outline, 'stroke', problem ? '#ff1726' : highlight);
      setAttribute(ghost, 'data-valid', String(!problem));
      return problem;
    },
    selection(start: Point | null, end: Point | null): void {
      setAttribute(selection, 'visibility', start && end ? 'visible' : 'hidden');
      if (!start || !end) return;
      const bounds = selectionBounds(start, end);
      for (const [name, value] of Object.entries(bounds)) setAttribute(selection, name, String(value));
    }
  };
}
