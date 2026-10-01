import { connectedRelays } from '../domain/logistics.ts';
import { distance, RELAY_RANGE } from '../domain/rules.ts';
import { towerUpgrade, unitUpgrade } from '../domain/technology.ts';
import type { Building, Point, ResourceChunk, ResourceNode, StrongholdSnapshot, Unit } from '../domain/types.ts';
import { createSvgLayer, setAttribute, setText } from './dom-updates.ts';
import { playerTheme } from './player-theme.ts';

function health(hp: number, max: number, y: number, width = 26): string {
  return `<rect x="${-width / 2}" y="${y}" width="${width}" height="3" fill="#1d3029"/><rect data-health x="${-width / 2}" y="${y}" width="${width * Math.max(0, hp / max)}" height="3" fill="#a6ed89"/>`;
}
function attackMarkup(): string {
  return '<g data-attack visibility="hidden" pointer-events="none"><line stroke="#fff4a3" stroke-width="3"/><circle r="6" fill="none" stroke="#fff4a3" stroke-width="3"/></g>';
}
export function unitMotionTransform(unit: Unit, previous: Point | undefined, elapsed: number, reducedMotion = false): string {
  if (reducedMotion) return '';
  const attacking = unit.attackTarget !== null && unit.cooldown > (unit.kind === 'worker' ? 2.72 : .72);
  if (attacking) return 'scale(1.15)';
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
    : unit.kind === 'warrior' ? '<rect x="-8" y="-8" width="16" height="16" fill="#ffb3c9" stroke="#ff1726" stroke-width="2"/>'
    : unit.kind === 'archer' ? '<path d="M0 -10 L8 0 L0 10 L-8 0 Z" fill="#9ed7e6" stroke="#00aeef" stroke-width="2"/>'
    : unit.kind === 'catapult' ? '<path d="M0 -12 L10 9 L-10 9 Z" fill="#f0e3a7" stroke="#cfb000" stroke-width="2"/>'
    : unit.formation === 'archer' ? '<path d="M0 -10 L8 0 L0 10 L-8 0 Z" fill="#870018" stroke="#ff1726" stroke-width="2"/>'
    : unit.formation === 'catapult' ? '<path d="M0 -12 L10 9 L-10 9 Z" fill="#870018" stroke="#ff1726" stroke-width="2"/>'
    : '<rect x="-8" y="-8" width="16" height="16" fill="#870018" stroke="#ff1726" stroke-width="2"/>';
  return `${attackMarkup()}<circle data-selected r="16" fill="none" stroke="#fff" stroke-width="2" visibility="${selected ? 'visible' : 'hidden'}"/><g data-visual>${shape}</g>${health(unit.hp, unit.maxHp, 13, 20)}<title>${unit.kind}${unit.formation ? ' ' + unit.formation : ''}: ${Math.ceil(unit.hp)} HP</title>`;
}
export function buildingMarkup(building: Building): string {
  const color = building.enemy ? '#870018' : building.kind === 'relay' ? '#b0b0b0' : '#c3c3c3';
  const size = building.kind === 'castle' || building.kind === 'enemy-base' ? 34 : 14;
  const shape = building.kind === 'tower' ? `<path d="M-16 -20 H16 V-10 H5 V20 H-5 V-10 H-16 Z" fill="${building.enemy ? color : '#fff'}" stroke="${building.enemy ? '#ff1726' : '#ffd500'}" stroke-width="3"/>`
    : building.kind === 'relay' ? `<path d="M-4 16 L-4 -7 L-9 -12 L0 -18 L9 -12 L4 -7 L4 16 Z" fill="${color}" stroke="#7f7f7f" stroke-width="2"/>`
    : building.kind === 'wall' ? `<rect x="-23" y="-4" width="46" height="8" fill="${building.enemy ? color : '#ffdb58'}" stroke="${building.enemy ? '#ff1726' : '#e8ad23'}" stroke-width="3"/>`
    : `<rect x="${-size}" y="${-size}" width="${size * 2}" height="${size * 2}" fill="${color}" stroke="${building.enemy ? '#ff1726' : '#7f7f7f'}" stroke-width="4"/>`;
  return `${attackMarkup()}${shape}${health(building.hp, building.maxHp, building.kind === 'tower' ? 26 : size + 6, size * 2)}<title></title>${building.kind === 'barracks' ? `<text data-tier y="5" text-anchor="middle" fill="#111" font-size="16">T${building.tier}</text>` : ''}`;
}
function relayLinks(snapshot: StrongholdSnapshot): string {
  // Snapshot world data matches the logistics inputs; private player fields are not needed.
  const world = { ...snapshot, nextId: 0, players: [] };
  const connected = connectedRelays(world);
  const relays = snapshot.buildings.filter(building => building.kind === 'relay' || building.kind === 'castle');
  const links: string[] = [];
  for (let index = 0; index < relays.length; index++) {
    const a = relays[index];
    if (!a || a.progress < 1) continue;
    for (const b of relays.slice(index + 1)) {
      if (b.progress === 1 && distance(a, b) <= RELAY_RANGE) links.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${connected.includes(a) && connected.includes(b) ? '#3344da' : '#8e6060'}" stroke-width="3"/>`);
    }
  }
  return links.join('');
}
function child(element: Element, selector: string): Element {
  const found = element.querySelector(selector);
  if (!found) throw new Error(`Missing Stronghold SVG element: ${selector}`);
  return found;
}
function position(element: Element, point: { x: number; y: number }, scale = 1): void {
  setAttribute(element, 'transform', `translate(${point.x} ${point.y}) scale(${scale})`);
}
function renderAttack(element: Element, entity: Unit | Building, scale: number): void {
  const effect = child(element, '[data-attack]');
  const active = entity.attackTarget !== null && entity.cooldown > (entity.kind === 'worker' ? 2.72 : .72);
  setAttribute(effect, 'visibility', active ? 'visible' : 'hidden');
  if (!active || !entity.attackTarget) return;
  const x = (entity.attackTarget.x - entity.x) / scale;
  const y = (entity.attackTarget.y - entity.y) / scale;
  setAttribute(child(effect, 'line'), 'x2', String(x));
  setAttribute(child(effect, 'line'), 'y2', String(y));
  setAttribute(child(effect, 'circle'), 'cx', String(x));
  setAttribute(child(effect, 'circle'), 'cy', String(y));
}
export function createBattlefieldRenderer(map: SVGSVGElement) {
  map.innerHTML = `<g data-layer="links"></g><g data-layer="nodes"></g><g data-layer="chunks"></g><g data-layer="buildings"></g><g data-layer="units"></g>
    <g data-layer="rally"><path d="M0 14V-15l20 7-20 7" fill="#e7d98b" stroke="#e7d98b" opacity=".6"/><title>Production rally point</title></g>`;
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
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const renderUnits = createSvgLayer<Unit>(layer('units'), unit => unitMarkup(unit, false), (element, unit) => {
    if (!technology) throw new Error('Missing Stronghold technology snapshot.');
    const level = unitUpgrade(technology, unit);
    const scale = 1 + level * .08;
    position(element, unit, scale);
    setAttribute(child(element, '[data-visual]'), 'transform', unitMotionTransform(unit, previousUnits.get(unit.id), elapsed, motionPreference.matches));
    previousUnits.set(unit.id, { x: unit.x, y: unit.y });
    renderAttack(element, unit, scale);
    setAttribute(element, 'data-unit', String(unit.id));
    setAttribute(element, 'class', 'stronghold-map-unit');
    setAttribute(child(element, '[data-selected]'), 'visibility', selection.has(unit.id) ? 'visible' : 'hidden');
    setAttribute(child(element, '[data-selected]'), 'stroke', selectionColor);
    setAttribute(child(element, '[data-selected]'), 'fill', selectionColor);
    setAttribute(child(element, '[data-selected]'), 'fill-opacity', '.2');
    setAttribute(child(element, '[data-health]'), 'width', String(20 * Math.max(0, unit.hp / unit.maxHp)));
    setText(child(element, 'title'), `${unit.kind}${unit.formation ? ' ' + unit.formation : ''}: ${Math.ceil(unit.hp)} HP / upgrade ${level}`);
  }, unit => `${unit.kind}/${unit.formation}`);
  const renderBuildings = createSvgLayer<Building>(layer('buildings'), buildingMarkup, (element, building) => {
    if (!technology) throw new Error('Missing Stronghold technology snapshot.');
    const level = building.kind === 'tower' && !building.enemy ? towerUpgrade(technology, building.tier) : 0;
    const scale = building.kind === 'tower' || building.kind === 'enemy-base' ? 1 + Math.min(3, building.tier) * .08 + level * .05 : 1;
    position(element, building, scale);
    renderAttack(element, building, scale);
    setAttribute(element, 'opacity', building.progress < 1 ? String(.3 + building.progress * .7) : '1');
    const width = building.kind === 'castle' || building.kind === 'enemy-base' ? 68 : 28;
    setAttribute(child(element, '[data-health]'), 'width', String(width * Math.max(0, building.hp / building.maxHp)));
    setText(child(element, 'title'), `${building.kind} / T${building.tier}: ${Math.ceil(building.hp)} HP, ${Math.round(building.progress * 100)}% built`);
    const tier = element.querySelector('[data-tier]');
    if (tier) setText(tier, `T${building.tier}`);
  }, building => `${building.kind}/${building.enemy}`);
  const renderNodes = createSvgLayer<ResourceNode>(layer('nodes'), node =>
    `<circle r="${node.rich ? 27 : 24}" stroke="${node.rich ? '#a64caf' : '#00aeef'}" stroke-width="3"/><title></title>`, (element, node) => {
    position(element, node);
    setAttribute(child(element, 'circle'), 'fill', node.remaining <= 0 ? '#aaa' : node.rich ? '#ccc0e0' : '#9ed7e6');
    setText(child(element, 'title'), `${node.rich ? 'Rich' : 'Standard'} resource node: ${Math.ceil(node.remaining)} remaining`);
  }, node => String(node.rich));
  const renderChunks = createSvgLayer<ResourceChunk>(layer('chunks'), () => '<rect x="-4" y="-4" width="8" height="8" stroke="#111" stroke-width="1"/><title></title>', (element, chunk) => {
    position(element, { x: chunk.x + (chunk.carrier === null ? 0 : 12), y: chunk.y });
    setAttribute(child(element, 'rect'), 'fill', chunk.carrier !== null ? '#ffe64c' : chunk.target === null ? '#ddd' : '#00aeef');
    setText(child(element, 'title'), `${chunk.amount} supplies${chunk.carrier !== null ? ', carried by gatherer' : ', relay delivery'}`);
  });
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
    if (signature !== linkSignature) { links.innerHTML = relayLinks(snapshot); linkSignature = signature; }
    renderNodes(snapshot.nodes); renderChunks(snapshot.chunks);
    renderBuildings(snapshot.buildings); renderUnits(snapshot.units);
    position(rally, snapshot.rally);
  };
}
