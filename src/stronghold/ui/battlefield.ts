import { connectedRelays, relayNeighbors } from '../domain/logistics.ts';
import { distance, RELAY_RANGE } from '../domain/rules.ts';
import { towerUpgrade, unitUpgrade } from '../domain/technology.ts';
import type { Building, Point, ResourceChunk, ResourceNode, StrongholdSnapshot, Unit } from '../domain/types.ts';
import { createSvgLayer, setAttribute, setText } from './dom-updates.ts';
import { playerTheme } from './player-theme.ts';
import { TRAINING_SECONDS } from '../domain/training.ts';

function health(hp: number, max: number, y: number, width = 26): string {
  return `<rect x="${-width / 2}" y="${y}" width="${width}" height="3" fill="#1d3029"/><rect data-health x="${-width / 2}" y="${y}" width="${width * Math.max(0, hp / max)}" height="3" fill="#a6ed89"/>`;
}
function actionActive(entity: Unit | Building): boolean {
  return entity.attackTarget !== null && entity.cooldown > (entity.kind === 'worker' ? 2.72 : .72);
}
function actionEffectMarkup(working = false): string {
  if (working) return `<g data-work visibility="hidden" pointer-events="none" filter="url(#stronghold-work-glow)">
    <path data-beam fill="none" stroke="#dce7f0" stroke-width="1.5" stroke-dasharray="3 5"/>
    <g data-impact><circle r="7" fill="#eef5ff" fill-opacity=".18" stroke="#c5d2dc" stroke-width="1.5"/>
      <path d="M-11 0H-7 M7 0H11 M0 -11V-7 M0 7V11" stroke="#fff" stroke-width="2"/>
      <rect x="-2" y="-2" width="4" height="4" fill="#fff"/></g></g>`;
  return `<g data-attack visibility="hidden" pointer-events="none">
    <path data-trail fill="none" stroke="#483526" stroke-width="5" stroke-linejoin="bevel"/>
    <path data-beam fill="none" stroke="#ed914c" stroke-width="2" stroke-linejoin="bevel" filter="url(#stronghold-attack-glow)"/>
    <g data-impact filter="url(#stronghold-attack-glow)">
      <path d="M0 -11L3 -4L10 -7L6 0L11 4L4 5L0 12L-3 5L-11 7L-6 0L-11 -4L-4 -5Z" fill="#9c572d" fill-opacity=".55" stroke="#ed914c" stroke-width="1.5"/>
      <path d="M-7 5L6 -6 M-1 8L7 0" stroke="#fff1d2" stroke-width="2"/></g></g>`;
}
export function unitMotionTransform(unit: Unit, previous: Point | undefined, elapsed: number, reducedMotion = false): string {
  if (reducedMotion) return '';
  const active = actionActive(unit);
  const archer = unit.kind === 'archer' || (unit.kind === 'invader' && unit.formation === 'archer');
  const bob = archer ? `translate(0 ${Math.sin(elapsed * 2.2 + unit.id) * 2.5})` : '';
  if (active && unit.kind === 'builder') return `translate(0 ${Math.sin(elapsed * 24 + unit.id) * 1.25})`;
  if (active && unit.kind === 'worker') return 'scale(1.04)';
  if (active) return `${bob ? bob + ' ' : ''}scale(1.15)`;
  if (archer) return bob;
  if (!previous || distance(unit, previous) < .001) return '';
  const stride = Math.sin(elapsed * 16 + unit.id);
  if (unit.kind === 'warrior' || (unit.kind === 'invader' && (unit.formation === null || unit.formation === 'warrior'))) {
    // Pivot on the planted bottom corner; the opposite corner lifts on each stride.
    return `rotate(${stride * 14} ${stride >= 0 ? 8 : -8} 8)`;
  }
  return `translate(0 ${stride * 1.5}) rotate(${stride * 5})`;
}
export function unitMarkup(unit: Unit, selected: boolean): string {
  const shape = unit.kind === 'worker' ? '<circle r="8" fill="#fff" stroke="#b88051" stroke-width="2"/>'
    : unit.kind === 'builder' ? '<path d="M0 -11 L10 8 L-10 8 Z" fill="#cec0df" stroke="#a64caf" stroke-width="2"/>'
    : unit.kind === 'warrior' ? '<rect x="-8" y="-8" width="16" height="16" fill="#e5c2a0" stroke="#9a5b2e" stroke-width="2"/>'
    : unit.kind === 'archer' ? '<path d="M0 -10 L8 0 L0 10 L-8 0 Z" fill="#9ed7e6" stroke="#00aeef" stroke-width="2"/>'
    : unit.kind === 'catapult' ? '<path d="M0 -12 L10 9 L-10 9 Z" fill="#f0e3a7" stroke="#cfb000" stroke-width="2"/>'
    : unit.formation === 'archer' ? '<path d="M0 -10 L8 0 L0 10 L-8 0 Z" fill="#870018" stroke="#ff1726" stroke-width="2"/>'
    : unit.formation === 'catapult' ? '<path d="M0 -12 L10 9 L-10 9 Z" fill="#870018" stroke="#ff1726" stroke-width="2"/>'
    : '<rect x="-8" y="-8" width="16" height="16" fill="#870018" stroke="#ff1726" stroke-width="2"/>';
  return `${actionEffectMarkup(unit.kind === 'worker' || unit.kind === 'builder')}<circle data-selected r="16" fill="none" stroke="#fff" stroke-width="2" visibility="${selected ? 'visible' : 'hidden'}"/><g data-visual>${shape}</g>${health(unit.hp, unit.maxHp, 13, 20)}<desc>${unit.kind}${unit.formation ? ' ' + unit.formation : ''}: ${Math.ceil(unit.hp)} HP</desc>`;
}
export function buildingMarkup(building: Building): string {
  const color = building.enemy ? '#870018' : building.kind === 'relay' ? '#b0b0b0' : '#c3c3c3';
  const size = building.kind === 'castle' || building.kind === 'enemy-base' ? 34 : 14;
  const shape = building.kind === 'tower' ? `<path d="M-16 -20 H16 V-10 H5 V20 H-5 V-10 H-16 Z" fill="${building.enemy ? color : '#fff'}" stroke="${building.enemy ? '#ff1726' : '#ffd500'}" stroke-width="3"/>`
    : building.kind === 'relay' ? `<path d="M-4 16 L-4 -7 L-9 -12 L0 -18 L9 -12 L4 -7 L4 16 Z" fill="${color}" stroke="#7f7f7f" stroke-width="2"/>`
    : building.kind === 'wall' ? `<rect data-wall-shape transform="rotate(${building.rotation ?? 0})" x="-23" y="-4" width="46" height="8" fill="${building.enemy ? color : '#ffdb58'}" stroke="${building.enemy ? '#ff1726' : '#e8ad23'}" stroke-width="3"/>`
    : `<rect x="${-size}" y="${-size}" width="${size * 2}" height="${size * 2}" fill="${color}" stroke="${building.enemy ? '#ff1726' : '#7f7f7f'}" stroke-width="4"/>`;
  return `${actionEffectMarkup()}${shape}${health(building.hp, building.maxHp, building.kind === 'tower' ? 26 : size + 6, size * 2)}<desc></desc>${building.kind === 'barracks' ? `<text data-tier y="5" text-anchor="middle" fill="#111" font-size="16">T${building.tier}</text><g data-training><rect x="-17" y="26" width="34" height="8" fill="#23372e"/><rect x="-16" y="27" width="32" height="6" fill="#333"/><rect data-training-fill x="-16" y="27" width="0" height="6" fill="#a6ed89"/><text data-training-count y="43" text-anchor="middle" fill="#111" stroke="white" stroke-width="2" paint-order="stroke" font-size="12"></text></g>` : ''}`;
}
export function relayPreviewMarkup(snapshot: Pick<StrongholdSnapshot, 'buildings'>, point: Point, sourceId?: number): string {
  const connected = connectedRelays(snapshot);
  const neighbors = relayNeighbors(snapshot, point, sourceId);
  const powered = connected.some(building => building.id === sourceId || neighbors.includes(building));
  const color = powered ? '#65eb98' : '#ffd76a';
  return `<circle data-relay-preview-radius cx="${point.x}" cy="${point.y}" r="${RELAY_RANGE}" fill="${color}" fill-opacity=".1" stroke="${color}" stroke-width="2" stroke-dasharray="7 4"/>`
    + neighbors.map(building => `<g data-relay-connection="${building.id}" data-powered="${connected.includes(building)}">
      <line x1="${point.x}" y1="${point.y}" x2="${building.x}" y2="${building.y}" stroke="${color}" stroke-width="3" stroke-dasharray="5 4"/>
      <circle cx="${building.x}" cy="${building.y}" r="${building.kind === 'castle' ? 43 : 25}" fill="${color}" fill-opacity=".16" stroke="${color}" stroke-width="3"/>
    </g>`).join('');
}
export function resourceChunkMarkup(chunk: Pick<ResourceChunk, 'rich'>, transporting: boolean): string {
  return `<rect x="-4" y="-4" width="8" height="8" fill="${transporting ? '#bdc9c2' : chunk.rich ? '#a64caf' : '#00aeef'}" stroke="#263c33" stroke-width="1"${transporting ? ' filter="url(#stronghold-resource-glow)"' : ''}/><desc></desc>`;
}
function relayLinks(snapshot: StrongholdSnapshot): string {
  const connected = connectedRelays(snapshot);
  const relays = snapshot.buildings.filter(building => (building.kind === 'relay' || building.kind === 'castle') && !building.enemy && building.hp > 0);
  const links: string[] = [];
  for (let index = 0; index < relays.length; index++) {
    const a = relays[index];
    if (!a || a.progress < 1) continue;
    for (const b of relays.slice(index + 1)) {
      if (b.progress === 1 && distance(a, b) <= RELAY_RANGE) links.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${connected.includes(a) && connected.includes(b) ? '#526d65' : '#8e7770'}" stroke-width="3"/>`);
    }
  }
  return links.join('');
}
function child(element: Element, selector: string): Element {
  const found = element.querySelector(selector);
  if (!found) throw new Error(`Missing Stronghold SVG element: ${selector}`);
  return found;
}
function describe(element: Element, description: string): void {
  setText(child(element, 'desc'), description);
  setAttribute(element, 'data-tooltip', description);
}
function position(element: Element, point: { x: number; y: number }, scale = 1): void {
  setAttribute(element, 'transform', `translate(${point.x} ${point.y}) scale(${scale})`);
}
function renderActionEffect(element: Element, entity: Unit | Building, scale: number, elapsed: number, reducedMotion: boolean): void {
  const working = entity.kind === 'worker' || entity.kind === 'builder';
  const effect = child(element, working ? '[data-work]' : '[data-attack]');
  const active = actionActive(entity);
  setAttribute(effect, 'visibility', active ? 'visible' : 'hidden');
  if (!active || !entity.attackTarget) return;
  const x = (entity.attackTarget.x - entity.x) / scale;
  const y = (entity.attackTarget.y - entity.y) / scale;
  const beam = child(effect, '[data-beam]');
  if (working) {
    setAttribute(beam, 'd', `M0 0L${x} ${y}`);
    setAttribute(beam, 'stroke-dashoffset', String(reducedMotion ? 0 : -elapsed * 24 % 8));
  } else {
    const reach = Math.max(1, Math.hypot(x, y));
    const offsetX = -y / reach * 3, offsetY = x / reach * 3;
    const path = `M0 0L${x * .6 + offsetX} ${y * .6 + offsetY}L${x * .8 - offsetX} ${y * .8 - offsetY}L${x} ${y}`;
    setAttribute(beam, 'd', path);
    setAttribute(child(effect, '[data-trail]'), 'd', path);
  }
  const pulse = reducedMotion ? 0 : working ? Math.sin(elapsed * 22) : Math.min(1, (1 - entity.cooldown) / .28);
  setAttribute(effect, 'opacity', String(reducedMotion ? 1 : working ? .8 + pulse * .2 : 1 - pulse * .7));
  setAttribute(child(effect, '[data-impact]'), 'transform', `translate(${x} ${y}) rotate(${working ? reducedMotion ? 0 : elapsed * 100 % 360 : Math.atan2(y, x) * 180 / Math.PI}) scale(${1 + pulse * (working ? .15 : .6)})`);
}
export function createBattlefieldRenderer(map: SVGSVGElement) {
  map.innerHTML = `<defs>
    <filter id="stronghold-resource-glow" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#effff2" flood-opacity=".95"/></filter>
    <filter id="stronghold-work-glow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="1.5" flood-color="#f0f5ff" flood-opacity=".7"/></filter>
    <filter id="stronghold-attack-glow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="1.8" flood-color="#ed914c" flood-opacity=".8"/></filter></defs>
    <g data-layer="coverage" pointer-events="none"></g><g data-layer="links" pointer-events="none"></g><g data-layer="nodes"></g><g data-layer="chunks" pointer-events="none"></g><g data-layer="buildings"></g><g data-layer="units"></g>
    <g data-layer="rally" data-tooltip="Production rally point"><path d="M0 14V-15l20 7-20 7" fill="#e7d98b" stroke="#e7d98b" opacity=".6"/><desc>Production rally point</desc></g>`;
  function layer(name: string): SVGGElement {
    const found = map.querySelector(`[data-layer="${name}"]`);
    if (!(found instanceof SVGGElement)) throw new Error(`Missing Stronghold SVG layer: ${name}`);
    return found;
  }
  let selection: ReadonlySet<number> = new Set();
  let technology: Pick<StrongholdSnapshot, 'technology'> | null = null;
  let elapsed = 0;
  let selectionColor = '#ffb3c9';
  const previousUnits = new Map<number, Point>();
  let connectedRelayIds = new Set<number>();
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const renderCoverage = createSvgLayer<Building>(layer('coverage'), () =>
    `<circle data-relay-radius r="${RELAY_RANGE}" fill="#8ce4db" fill-opacity=".035" stroke="#b4ede2" stroke-opacity=".3" stroke-width="1" stroke-dasharray="4 5"/>`,
  (element, building) => { position(element, building); setAttribute(element, 'data-relay-source', String(building.id)); });
  const renderUnits = createSvgLayer<Unit>(layer('units'), unit => unitMarkup(unit, false), (element, unit) => {
    if (!technology) throw new Error('Missing Stronghold technology snapshot.');
    const level = unitUpgrade(technology, unit);
    const scale = 1 + level * .08;
    position(element, unit, scale);
    setAttribute(child(element, '[data-visual]'), 'transform', unitMotionTransform(unit, previousUnits.get(unit.id), elapsed, motionPreference.matches));
    previousUnits.set(unit.id, { x: unit.x, y: unit.y });
    renderActionEffect(element, unit, scale, elapsed, motionPreference.matches);
    setAttribute(element, 'data-unit', String(unit.id));
    setAttribute(element, 'class', 'stronghold-map-unit');
    setAttribute(child(element, '[data-selected]'), 'visibility', selection.has(unit.id) ? 'visible' : 'hidden');
    setAttribute(child(element, '[data-selected]'), 'stroke', selectionColor);
    setAttribute(child(element, '[data-selected]'), 'fill', selectionColor);
    setAttribute(child(element, '[data-selected]'), 'fill-opacity', '.2');
    setAttribute(child(element, '[data-health]'), 'width', String(20 * Math.max(0, unit.hp / unit.maxHp)));
    describe(element, `${unit.kind}${unit.formation ? ' ' + unit.formation : ''}: ${Math.ceil(unit.hp)} HP / upgrade ${level}`);
  }, unit => `${unit.kind}/${unit.formation}`);
  const renderBuildings = createSvgLayer<Building>(layer('buildings'), buildingMarkup, (element, building) => {
    if (!technology) throw new Error('Missing Stronghold technology snapshot.');
    const level = building.kind === 'tower' && !building.enemy ? towerUpgrade(technology, building.tier) : 0;
    const scale = building.kind === 'tower' || building.kind === 'enemy-base' ? 1 + Math.min(3, building.tier) * .08 + level * .05 : 1;
    position(element, building, scale);
    setAttribute(element, 'data-building', String(building.id));
    const wallShape = element.querySelector('[data-wall-shape]');
    if (wallShape) setAttribute(wallShape, 'transform', `rotate(${building.rotation ?? 0})`);
    renderActionEffect(element, building, scale, elapsed, motionPreference.matches);
    setAttribute(element, 'opacity', building.progress < 1 ? String(.3 + building.progress * .7) : '1');
    const width = building.kind === 'castle' || building.kind === 'enemy-base' ? 68 : 28;
    setAttribute(child(element, '[data-health]'), 'width', String(width * Math.max(0, building.hp / building.maxHp)));
    describe(element, `${building.kind} / T${building.tier}: ${Math.ceil(building.hp)} HP, ${Math.round(building.progress * 100)}% built${building.kind === 'wall' && !building.enemy ? '. Defenses: click to select; Rotate or Alt+R turns the wall. Shift-click rotates immediately.' : ''}`);
    const tier = element.querySelector('[data-tier]');
    if (tier) setText(tier, `T${building.tier}`);
    const training = element.querySelector('[data-training]');
    if (training) {
      const order = building.trainingQueue[0];
      setAttribute(training, 'visibility', order ? 'visible' : 'hidden');
      setAttribute(child(training, '[data-training-fill]'), 'width', String(order ? 32 * Math.max(0, 1 - building.cooldown / TRAINING_SECONDS) : 0));
      setText(child(training, '[data-training-count]'), order ? `${order.kind}: ${building.trainingQueue.length} queued` : '');
      if (order) describe(element, `T${building.tier} Barracks: ${order.kind}, ${Math.ceil(building.cooldown)}s remaining; ${building.trainingQueue.length} queued`);
    }
  }, building => `${building.kind}/${building.enemy}`);
  const renderNodes = createSvgLayer<ResourceNode>(layer('nodes'), node =>
    `<circle r="${node.rich ? 27 : 24}" stroke="${node.rich ? '#a64caf' : '#00aeef'}" stroke-width="3"/><desc></desc>`, (element, node) => {
    position(element, node);
    setAttribute(child(element, 'circle'), 'fill', node.remaining <= 0 ? '#aaa' : node.rich ? '#ccc0e0' : '#9ed7e6');
    describe(element, `${node.rich ? 'Rich' : 'Standard'} resource node: ${Math.ceil(node.remaining)} remaining`);
  }, node => String(node.rich));
  const transporting = (chunk: ResourceChunk) => chunk.carrier === null && chunk.target !== null && connectedRelayIds.has(chunk.target);
  const renderChunks = createSvgLayer<ResourceChunk>(layer('chunks'), chunk => resourceChunkMarkup(chunk, transporting(chunk)), (element, chunk) => {
    position(element, { x: chunk.x + (chunk.carrier === null ? 0 : 12), y: chunk.y });
    setAttribute(element, 'data-resource-chunk', String(chunk.id));
    setAttribute(element, 'data-transporting', String(transporting(chunk)));
    describe(element, `${chunk.amount} ${chunk.rich ? 'rich' : 'standard'} supplies${chunk.carrier !== null ? ', carried by gatherer' : transporting(chunk) ? ', relay delivery' : ', waiting for a relay connection'}`);
  }, chunk => `${chunk.rich}/${transporting(chunk)}`);
  let linkSignature = '';
  const links = layer('links');
  const rally = layer('rally');
  return (snapshot: StrongholdSnapshot, selected: ReadonlySet<number>): void => {
    selection = selected;
    technology = snapshot;
    elapsed = snapshot.elapsed;
    const self = snapshot.players.find(player => player.id === snapshot.selfId);
    if (self) selectionColor = playerTheme(self.color).light;
    const livingUnits = new Set(snapshot.units.map(unit => unit.id));
    for (const id of previousUnits.keys()) if (!livingUnits.has(id)) previousUnits.delete(id);
    const signature = snapshot.buildings.filter(building => building.kind === 'castle' || building.kind === 'relay')
      .map(building => `${building.id}:${building.x}:${building.y}:${building.hp > 0}:${building.progress === 1}`).join('|');
    if (signature !== linkSignature) {
      links.innerHTML = relayLinks(snapshot); linkSignature = signature;
      connectedRelayIds = new Set(connectedRelays(snapshot).map(building => building.id));
    }
    renderCoverage(snapshot.buildings.filter(building => (building.kind === 'relay' || building.kind === 'castle')
      && !building.enemy && building.hp > 0));
    renderNodes(snapshot.nodes); renderChunks(snapshot.chunks);
    renderBuildings(snapshot.buildings); renderUnits(snapshot.units);
    position(rally, snapshot.rally);
  };
}
