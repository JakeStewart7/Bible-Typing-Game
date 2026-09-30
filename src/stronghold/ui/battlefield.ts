import { connectedRelays } from '../domain/logistics.ts';
import { distance, RELAY_RANGE } from '../domain/rules.ts';
import type { Building, ResourceChunk, ResourceNode, StrongholdSnapshot, Unit } from '../domain/types.ts';
import { createSvgLayer, setAttribute, setText } from './dom-updates.ts';

function health(hp: number, max: number, y: number, width = 26): string {
  return `<rect x="${-width / 2}" y="${y}" width="${width}" height="3" fill="#1d3029"/><rect data-health x="${-width / 2}" y="${y}" width="${width * Math.max(0, hp / max)}" height="3" fill="#a6ed89"/>`;
}
function unitMarkup(unit: Unit, selected: boolean): string {
  const shape = unit.kind === 'worker' ? '<circle r="7" fill="#f7e9ce" stroke="#b78955"/>'
    : unit.kind === 'builder' ? '<path d="M0 -9 L9 8 L-9 8 Z" fill="#dec0ed" stroke="#bd75cb"/>'
    : unit.kind === 'warrior' ? '<rect x="-8" y="-8" width="16" height="16" fill="#ffc0cc" stroke="#ff7188"/>'
    : unit.kind === 'archer' ? '<path d="M0 -10 L8 0 L0 10 L-8 0 Z" fill="#9fddf4" stroke="#65d9ff"/>'
    : unit.kind === 'catapult' ? '<path d="M0 -12 L10 9 L-10 9 Z" fill="#f4dc73" stroke="#b18d38"/>'
    : unit.formation === 'archer' ? '<path d="M0 -10 L8 0 L0 10 L-8 0 Z" fill="#ad5361" stroke="#ff7c87"/>'
    : unit.formation === 'catapult' ? '<path d="M0 -12 L10 9 L-10 9 Z" fill="#ad5361" stroke="#ff7c87"/>'
    : '<path d="M0 -11 L4 -4 L11 -4 L7 2 L10 10 L0 6 L-10 10 L-7 2 L-11 -4 L-4 -4 Z" fill="#ad5361" stroke="#ff7c87"/>';
  return `<circle data-selected r="16" fill="none" stroke="#fff" stroke-width="2" visibility="${selected ? 'visible' : 'hidden'}"/>${shape}${health(unit.hp, unit.maxHp, 13, 20)}<title>${unit.kind}${unit.formation ? ' ' + unit.formation : ''}: ${Math.ceil(unit.hp)} HP</title>`;
}
function buildingMarkup(building: Building): string {
  const color = building.enemy ? '#cd5369' : building.kind === 'relay' ? '#93a8ba' : '#d6cda7';
  const size = building.kind === 'castle' || building.kind === 'enemy-base' ? 34 : 14;
  const shape = building.kind === 'tower' ? `<path d="M-8 12 L-8 -8 L-14 -15 L-3 -15 L0 -22 L4 -15 L14 -15 L8 -8 L8 12 Z" fill="${color}" stroke="#f4dc73"/>`
    : building.kind === 'relay' ? `<path d="M-4 12 L-4 -7 L-9 -12 L0 -18 L9 -12 L4 -7 L4 12 Z" fill="${color}"/>`
    : building.kind === 'wall' ? `<rect x="-20" y="-5" width="40" height="10" rx="2" fill="${color}"/>`
    : `<rect x="${-size}" y="${-size}" width="${size * 2}" height="${size * 2}" rx="5" fill="${color}" stroke="${building.enemy ? '#ff7188' : '#f9e9af'}" stroke-width="2"/><path d="M${-size} ${-size} v-10 h10 v10 h10 v-10 h10 v10" fill="none" stroke="${color}" stroke-width="7"/>`;
  return `${shape}${health(building.hp, building.maxHp, size + 6, size * 2)}<title></title>${building.kind === 'barracks' ? `<text data-tier y="5" text-anchor="middle" fill="#263c32" font-size="12">T${building.tier}</text>` : ''}${building.kind === 'castle' || building.kind === 'enemy-base' ? '<text y="-50" text-anchor="middle" class="stronghold-base-label"></text>' : ''}`;
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
      if (b.progress === 1 && distance(a, b) <= RELAY_RANGE) links.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${connected.includes(a) && connected.includes(b) ? '#65d9ff' : '#a26476'}" stroke-width="3" stroke-dasharray="6 4"/>`);
    }
  }
  return links.join('');
}
function child(element: Element, selector: string): Element {
  const found = element.querySelector(selector);
  if (!found) throw new Error(`Missing Stronghold SVG element: ${selector}`);
  return found;
}
function position(element: Element, point: { x: number; y: number }): void {
  setAttribute(element, 'transform', `translate(${point.x} ${point.y})`);
}
export function createBattlefieldRenderer(map: SVGSVGElement) {
  map.innerHTML = `<defs><pattern id="stronghold-grass" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M5 15l3-4 3 4 M32 40l3-4 3 4" fill="none" stroke="#365948" stroke-width="1"/></pattern><radialGradient id="stronghold-ground"><stop stop-color="#345e47"/><stop offset="1" stop-color="#18392f"/></radialGradient></defs>
    <rect width="1000" height="650" rx="20" fill="url(#stronghold-ground)"/><rect width="1000" height="650" rx="20" fill="url(#stronghold-grass)"/>
    <path d="M480 570 Q410 450 490 320 T510 70" fill="none" stroke="#a9a082" stroke-opacity=".13" stroke-width="80"/>
    <ellipse cx="500" cy="60" rx="175" ry="110" fill="#7c263d" opacity=".17"/>
    <circle cx="500" cy="595" r="155" fill="#a6ed89" opacity=".035"/>
    <g data-layer="links"></g><g data-layer="nodes"></g><g data-layer="chunks"></g><g data-layer="buildings"></g><g data-layer="units"></g>
    <g data-layer="rally"><path d="M0 14V-15l20 7-20 7" fill="#e7d98b" stroke="#e7d98b" opacity=".6"/><title>Production rally point</title></g>`;
  function layer(name: string): SVGGElement {
    const found = map.querySelector(`[data-layer="${name}"]`);
    if (!(found instanceof SVGGElement)) throw new Error(`Missing Stronghold SVG layer: ${name}`);
    return found;
  }
  let selection: ReadonlySet<number> = new Set();
  const renderUnits = createSvgLayer<Unit>(layer('units'), unit => unitMarkup(unit, false), (element, unit) => {
    position(element, unit);
    setAttribute(element, 'data-unit', String(unit.id));
    setAttribute(element, 'class', 'stronghold-map-unit');
    setAttribute(child(element, '[data-selected]'), 'visibility', selection.has(unit.id) ? 'visible' : 'hidden');
    setAttribute(child(element, '[data-health]'), 'width', String(20 * Math.max(0, unit.hp / unit.maxHp)));
    setText(child(element, 'title'), `${unit.kind}${unit.formation ? ' ' + unit.formation : ''}: ${Math.ceil(unit.hp)} HP`);
  }, unit => `${unit.kind}/${unit.formation}`);
  const renderBuildings = createSvgLayer<Building>(layer('buildings'), buildingMarkup, (element, building) => {
    position(element, building);
    setAttribute(element, 'opacity', building.progress < 1 ? String(.3 + building.progress * .7) : '1');
    const width = building.kind === 'castle' || building.kind === 'enemy-base' ? 68 : 28;
    setAttribute(child(element, '[data-health]'), 'width', String(width * Math.max(0, building.hp / building.maxHp)));
    setText(child(element, 'title'), `${building.kind}: ${Math.ceil(building.hp)} HP, ${Math.round(building.progress * 100)}% built`);
    const label = element.querySelector('.stronghold-base-label');
    if (label) setText(label, `${building.enemy ? 'ENEMY STRONGHOLD' : 'YOUR CASTLE'} / ${Math.max(0, Math.ceil(building.hp))}`);
    const tier = element.querySelector('[data-tier]');
    if (tier) setText(tier, `T${building.tier}`);
  }, building => `${building.kind}/${building.enemy}`);
  const renderNodes = createSvgLayer<ResourceNode>(layer('nodes'), node =>
    `<circle r="${node.rich ? 24 : 20}" stroke="${node.rich ? '#e0b6ed' : '#78d4ef'}" stroke-width="3"/><text y="4" text-anchor="middle" font-size="10" fill="#162d26"></text><title>${node.rich ? 'Rich' : 'Standard'} resource node</title>`, (element, node) => {
    position(element, node);
    setAttribute(child(element, 'circle'), 'fill', node.remaining <= 0 ? '#435248' : node.rich ? '#b08bc9' : '#57a1ba');
    setText(child(element, 'text'), String(Math.ceil(node.remaining)));
  }, node => String(node.rich));
  const renderChunks = createSvgLayer<ResourceChunk>(layer('chunks'), () => '<circle r="3"/>', (element, chunk) => {
    position(element, chunk);
    setAttribute(child(element, 'circle'), 'fill', chunk.target === null ? '#e5b577' : '#7ae3ff');
  });
  let linkSignature = '';
  const links = layer('links');
  const rally = layer('rally');
  return (snapshot: StrongholdSnapshot, selected: ReadonlySet<number>): void => {
    selection = selected;
    const signature = snapshot.buildings.filter(building => building.kind === 'castle' || building.kind === 'relay')
      .map(building => `${building.id}:${building.x}:${building.y}:${building.hp > 0}:${building.progress === 1}`).join('|');
    if (signature !== linkSignature) { links.innerHTML = relayLinks(snapshot); linkSignature = signature; }
    renderNodes(snapshot.nodes); renderChunks(snapshot.chunks);
    renderBuildings(snapshot.buildings); renderUnits(snapshot.units);
    position(rally, snapshot.rally);
  };
}
