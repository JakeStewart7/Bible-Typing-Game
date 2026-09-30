import { distance, moveToward, RELAY_RANGE } from './rules.ts';
import type { Building, StrongholdState, Unit } from './types.ts';

export function connectedRelays(state: StrongholdState): Building[] {
  const connected = state.buildings.filter(building => building.kind === 'castle' && building.hp > 0);
  const relays = state.buildings.filter(building => building.kind === 'relay' && building.hp > 0 && building.progress === 1);
  let changed = true;
  while (changed) {
    changed = false;
    for (const relay of relays) {
      if (!connected.includes(relay) && connected.some(other => distance(relay, other) <= RELAY_RANGE)) {
        connected.push(relay);
        changed = true;
      }
    }
  }
  return connected;
}

function updateWorker(state: StrongholdState, worker: Unit, seconds: number): void {
  let node = state.nodes.find(candidate => candidate.id === worker.task && candidate.remaining > 0);
  if (!node) {
    node = state.nodes.filter(candidate => candidate.remaining > 0)
      .sort((a, b) => distance(worker, a) - distance(worker, b))[0];
    worker.task = node?.id ?? null;
  }
  if (!node) return;
  moveToward(worker, node, seconds * 42);
  worker.cooldown -= seconds;
  if (distance(worker, node) > 14 || worker.cooldown > 0) return;
  const amount = Math.min(node.remaining, (node.rich ? 8 : 4) + state.upgrades.economy * 2);
  node.remaining -= amount;
  const depot = state.buildings.filter(building => (building.kind === 'relay' || building.kind === 'castle')
    && building.hp > 0 && building.progress === 1).sort((a, b) => distance(node, a) - distance(node, b))[0];
  if (depot && distance(node, depot) <= RELAY_RANGE) {
    state.chunks.push({ id: state.nextId++, x: node.x, y: node.y, amount, target: depot.id });
  } else {
    // Resources without a nearby depot remain on the map until a relay reaches them.
    state.chunks.push({ id: state.nextId++, x: node.x, y: node.y, amount, target: null });
  }
  worker.cooldown = 3;
}

function updateBuilder(state: StrongholdState, builder: Unit, seconds: number, claimed: Set<number>): void {
  const projects = state.buildings.filter(building => !building.enemy && building.hp > 0
    && ((building.progress < 1 && !claimed.has(building.id)) || (building.progress === 1 && building.hp < building.maxHp)));
  const project = projects.sort((a, b) =>
    (a.progress === 1 ? 1 : 0) - (b.progress === 1 ? 1 : 0) || distance(builder, a) - distance(builder, b))[0];
  if (!project) return;
  if (project.progress < 1) claimed.add(project.id);
  moveToward(builder, project, seconds * 50);
  if (distance(builder, project) > 22) return;
  if (project.progress < 1) project.progress = Math.min(1, project.progress + seconds / 8);
  else project.hp = Math.min(project.maxHp, project.hp + seconds * (5 + state.upgrades.defenses));
}

export function updateLogistics(state: StrongholdState, seconds: number): void {
  const claimed = new Set<number>();
  for (const unit of state.units) {
    if (unit.hp <= 0) continue;
    if (unit.kind === 'worker') updateWorker(state, unit, seconds);
    if (unit.kind === 'builder') updateBuilder(state, unit, seconds, claimed);
  }
  const connected = connectedRelays(state);
  const routes = new Map<number, Building>();
  const castle = connected.find(building => building.kind === 'castle');
  const visited = new Set<number>(castle ? [castle.id] : []);
  const queue = castle ? [castle] : [];
  for (let index = 0; index < queue.length; index++) {
    const parent = queue[index];
    if (!parent) continue;
    for (const relay of connected) {
      if (!visited.has(relay.id) && distance(parent, relay) <= RELAY_RANGE) {
        visited.add(relay.id);
        routes.set(relay.id, parent);
        queue.push(relay);
      }
    }
  }
  for (const chunk of state.chunks) {
    let depot = state.buildings.find(building => building.id === chunk.target && building.hp > 0);
    if (!depot) depot = state.buildings.filter(building => (building.kind === 'relay' || building.kind === 'castle')
      && building.hp > 0 && building.progress === 1 && distance(chunk, building) <= RELAY_RANGE)
      .sort((a, b) => distance(chunk, a) - distance(chunk, b))[0];
    if (!depot) { chunk.target = null; continue; }
    chunk.target = depot.id;
    if (!connected.includes(depot)) continue;
    moveToward(chunk, depot, seconds * 85);
    if (distance(chunk, depot) < 6) {
      if (depot.kind === 'castle') { state.resources += chunk.amount; chunk.amount = 0; }
      else chunk.target = routes.get(depot.id)?.id ?? null;
    }
  }
  state.chunks = state.chunks.filter(chunk => chunk.amount > 0);
}
