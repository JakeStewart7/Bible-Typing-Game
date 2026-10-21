import { distance, moveToward, RELAY_RANGE, UNIT_RULES } from './rules.ts';
import type { Building, StrongholdState, Unit } from './types.ts';
import { ENTITY_LABELS, recordEvent } from './events.ts';
import { moveUnitToward, wallApproach } from './navigation.ts';

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

function automaticWorkTime(state: StrongholdState, unit: Unit, seconds: number): number {
  if (unit.destination) {
    const travelTime = distance(unit, unit.destination) / UNIT_RULES[unit.kind].speed;
    moveUnitToward(state, unit, unit.destination, seconds * UNIT_RULES[unit.kind].speed);
    if (distance(unit, unit.destination) > .001) return 0;
    unit.destination = null;
    unit.idleTime = 0;
    seconds = Math.max(0, seconds - travelTime);
  }
  if (unit.idleTime === null) return seconds;
  const remaining = Math.max(0, 2 - unit.idleTime);
  unit.idleTime += seconds;
  if (unit.idleTime <= 2) return 0;
  unit.idleTime = null;
  unit.task = null;
  return seconds - remaining;
}

function updateWorker(state: StrongholdState, worker: Unit, seconds: number): void {
  worker.cooldown = Math.max(0, worker.cooldown - seconds);
  if (worker.cooldown <= 2.72 || worker.idleTime !== null) worker.attackTarget = null;
  seconds = automaticWorkTime(state, worker, seconds);
  const cargo = state.chunks.find(chunk => chunk.carrier === worker.id);
  if (seconds === 0) {
    if (cargo) { cargo.x = worker.x; cargo.y = worker.y; }
    return;
  }
  if (cargo) {
    const depot = state.buildings.filter(building => (building.kind === 'relay' || building.kind === 'castle')
      && building.hp > 0 && building.progress === 1).sort((a, b) => distance(worker, a) - distance(worker, b))[0];
    if (depot) moveUnitToward(state, worker, depot, seconds * UNIT_RULES.worker.speed);
    cargo.x = worker.x;
    cargo.y = worker.y;
    if (depot && distance(worker, depot) <= 14) {
      cargo.carrier = null;
      cargo.x = depot.x;
      cargo.y = depot.y;
      cargo.target = depot.id;
    }
    return;
  }
  let node = state.nodes.find(candidate => candidate.id === worker.task && candidate.remaining > 0);
  if (!node) {
    node = state.nodes.filter(candidate => candidate.remaining > 0)
      .sort((a, b) => distance(worker, a) - distance(worker, b))[0];
    worker.task = node?.id ?? null;
  }
  if (!node) return;
  moveUnitToward(state, worker, node, seconds * UNIT_RULES.worker.speed);
  if (distance(worker, node) > 14 || worker.cooldown > 0) return;
  const amount = Math.min(node.remaining, (node.rich ? 8 : 4) + state.upgrades.economy * 2);
  node.remaining -= amount;
  if (node.remaining === 0) recordEvent(state, 'Resource node depleted');
  state.chunks.push({ id: state.nextId++, x: worker.x, y: worker.y, amount, target: null, carrier: worker.id });
  worker.attackTarget = { x: node.x, y: node.y };
  worker.cooldown = 3;
}

function updateBuilder(state: StrongholdState, builder: Unit, seconds: number, project: Building): void {
  const approach = project.kind === 'wall' ? wallApproach(builder, project) : project;
  moveUnitToward(state, builder, approach, seconds * UNIT_RULES.builder.speed);
  if (distance(builder, approach) > (project.kind === 'wall' ? 1 : 22)) return;
  builder.attackTarget = { x: project.x, y: project.y };
  builder.cooldown = 1;
  if (project.progress < 1) {
    project.progress = Math.min(1, project.progress + seconds / 8);
    if (project.progress === 1) recordEvent(state, `${ENTITY_LABELS[project.kind]} constructed`, project.ownerId);
  }
  else project.hp = Math.min(project.maxHp, project.hp + seconds * (5 + state.upgrades.defenses));
}

function updateBuilders(state: StrongholdState, seconds: number): void {
  type BuilderTime = { builder: Unit; seconds: number };
  const available: BuilderTime[] = [];
  const assigned: (BuilderTime & { project: Building })[] = [];
  const claimed = new Set<number>();
  const projects = state.buildings.filter(building => !building.enemy && building.hp > 0
    && (building.progress < 1 || building.hp < building.maxHp));
  for (const builder of state.units) {
    if (builder.kind !== 'builder' || builder.hp <= 0) continue;
    builder.attackTarget = null;
    builder.cooldown = 0;
    const workTime = automaticWorkTime(state, builder, seconds);
    if (workTime === 0) { builder.task = null; continue; }
    const project = projects.find(project => project.id === builder.task
      && (project.progress === 1 || !claimed.has(project.id)));
    if (project) {
      assigned.push({ builder, seconds: workTime, project });
      if (project.progress < 1) claimed.add(project.id);
    } else {
      builder.task = null;
      available.push({ builder, seconds: workTime });
    }
  }
  for (const project of projects) {
    if (project.progress === 1 || claimed.has(project.id)) continue;
    available.sort((a, b) => distance(a.builder, project) - distance(b.builder, project) || a.builder.id - b.builder.id);
    const next = available.shift();
    if (!next) break;
    next.builder.task = project.id;
    claimed.add(project.id);
    assigned.push({ ...next, project });
  }
  for (const next of available) {
    const project = projects.filter(project => project.progress === 1)
      .sort((a, b) => distance(next.builder, a) - distance(next.builder, b) || a.id - b.id)[0];
    if (!project) continue;
    next.builder.task = project.id;
    assigned.push({ ...next, project });
  }
  for (const { builder, seconds: workTime, project } of assigned) updateBuilder(state, builder, workTime, project);
}

export function updateLogistics(state: StrongholdState, seconds: number): void {
  for (const unit of state.units) {
    if (unit.hp <= 0) continue;
    if (unit.kind === 'worker') updateWorker(state, unit, seconds);
  }
  updateBuilders(state, seconds);
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
    if (chunk.carrier !== null) {
      const carrier = state.units.find(unit => unit.id === chunk.carrier && unit.hp > 0);
      if (carrier) continue;
      chunk.carrier = null;
      chunk.target = null;
    }
    let depot = state.buildings.find(building => building.id === chunk.target && building.hp > 0 && building.progress === 1);
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
