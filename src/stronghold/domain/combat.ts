import { distance, ENEMY_BASE, moveToward, UNIT_CAPS, UNIT_RULES } from './rules.ts';
import { addBuilding, addUnit } from './state.ts';
import { towerUpgrade, unitUpgrade } from './technology.ts';
import { ENTITY_LABELS, recordEvent } from './events.ts';
import type { Building, Point, StrongholdState, Unit } from './types.ts';

type Target = (Unit | Building) & Point;
function closest(origin: Point, targets: Target[]): Target | undefined {
  return targets.filter(target => target.hp > 0).sort((a, b) => distance(origin, a) - distance(origin, b))[0];
}
function isFighter(unit: Unit): boolean {
  return unit.kind === 'warrior' || unit.kind === 'archer' || unit.kind === 'catapult';
}
function attack(origin: Unit | Building, target: Target, damage: number): void {
  if (origin.cooldown > 0) return;
  target.hp -= damage;
  origin.cooldown = 1;
  origin.attackTarget = { x: target.x, y: target.y };
}
function updateUnit(state: StrongholdState, unit: Unit, seconds: number): void {
  const rule = UNIT_RULES[unit.formation ?? unit.kind];
  if (rule.damage === 0 || unit.hp <= 0) return;
  unit.cooldown = Math.max(0, unit.cooldown - seconds);
  const enemies = state.units.filter(other => other.hp > 0 && (unit.kind === 'invader' ? other.kind !== 'invader' : other.kind === 'invader'));
  const buildings = state.buildings.filter(building => building.hp > 0 && building.enemy === (unit.kind !== 'invader'));
  let target: Target | undefined;
  if (unit.kind === 'invader') {
    const defenders = enemies.filter(other => isFighter(other) && distance(unit, other) < 140);
    const workers = enemies.filter(other => (other.kind === 'worker' || other.kind === 'builder') && distance(unit, other) < 100);
    target = closest(unit, defenders) ?? closest(unit, workers) ?? closest(unit, buildings);
  } else {
    target = closest(unit, enemies.filter(other => distance(unit, other) < Math.max(140, rule.range)));
    if (!target && unit.destination) {
      moveToward(unit, unit.destination, seconds * rule.speed);
      if (distance(unit, unit.destination) < 5) unit.destination = null;
    }
    if (!target) target = closest(unit, buildings.filter(building => distance(unit, building) < rule.range + 20));
  }
  if (!target) return;
  if (distance(unit, target) > rule.range) moveToward(unit, target, seconds * rule.speed);
  else attack(unit, target, rule.damage + (unit.kind === 'invader' ? state.wave : unitUpgrade(state, unit) * 3));
}

export function spawnWave(state: StrongholdState): void {
  state.wave++;
  const amount = Math.min(18, 3 + state.wave * 2);
  const remaining = UNIT_CAPS.invader - state.units.filter(unit => unit.kind === 'invader').length;
  for (let index = 0; index < Math.min(amount, remaining); index++) {
    const side = index % 3;
    const formation = state.wave >= 6 && index % 5 === 0 ? 'catapult' : state.wave >= 3 && index % 3 === 0 ? 'archer' : null;
    addUnit(state, 'invader', {
      x: side === 0 ? 30 : side === 1 ? 970 : 300 + index * 23,
      y: side === 2 ? 35 : 100 + (index * 57) % 280
    }, formation);
  }
  state.waveIn = Math.max(18, 35 - state.wave);
  state.message = `Wave ${state.wave}: invaders are approaching. Protect the gatherers!`;
  recordEvent(state, `Wave ${state.wave} approaching`);
  if (state.wave % 3 === 0) {
    const base = state.buildings.find(building => building.kind === 'enemy-base');
    if (base) { base.maxHp += 100; base.hp += 100; base.tier++; recordEvent(state, 'Enemy base upgraded'); }
    if (state.buildings.filter(building => building.enemy && building.kind === 'tower').length < 6) {
      addBuilding(state, 'tower', { x: 280 + (state.wave % 5) * 95, y: 190 }, true, true);
      recordEvent(state, 'Enemy created Tower');
    }
  }
}

export function updateCombat(state: StrongholdState, seconds: number): void {
  if (state.phase === 'won' || state.phase === 'lost') return;
  for (const unit of state.units) updateUnit(state, unit, seconds);
  for (const tower of state.buildings) {
    if (tower.kind !== 'tower' || tower.progress < 1 || tower.hp <= 0) continue;
    tower.cooldown = Math.max(0, tower.cooldown - seconds);
    const target = closest(tower, state.units.filter(unit => (unit.kind === 'invader') !== tower.enemy
      && distance(unit, tower) <= 150 + tower.tier * 15));
    if (target) attack(tower, target, tower.enemy ? 8 + state.wave : 18 + tower.tier * 3 + towerUpgrade(state, tower.tier) * 5);
  }
  const enemyBase = state.buildings.find(building => building.kind === 'enemy-base');
  const castle = state.buildings.find(building => building.kind === 'castle');
  if (castle && castle.hp <= 0) {
    state.phase = 'lost';
    state.message = 'The castle has fallen. Regroup and rebuild your stronghold.';
    recordEvent(state, 'Home base destroyed: defeat');
  } else if (enemyBase && enemyBase.hp <= 0) {
    state.phase = 'won';
    state.message = 'Victory! Your united army has destroyed the enemy stronghold.';
    recordEvent(state, 'Enemy base destroyed: victory');
  }
  for (const unit of state.units) if (unit.hp <= 0) recordEvent(state, `${ENTITY_LABELS[unit.kind]} destroyed`);
  for (const building of state.buildings) {
    if (building.hp <= 0 && building.kind !== 'castle' && building.kind !== 'enemy-base') {
      recordEvent(state, `${ENTITY_LABELS[building.kind]} destroyed`, building.ownerId);
    }
  }
  state.units = state.units.filter(unit => unit.hp > 0);
  state.buildings = state.buildings.filter(building => building.hp > 0 || building.kind === 'castle' || building.kind === 'enemy-base');
}

export function rallyArmy(state: StrongholdState, point = ENEMY_BASE): void {
  for (const unit of state.units) {
    if (isFighter(unit)) unit.destination = { ...point };
  }
}
