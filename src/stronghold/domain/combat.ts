import { CATAPULT_WINDUP_SECONDS, distance, UNIT_CAPS, UNIT_RULES } from './rules.ts';
import { moveUnitToward, wallApproach, wallBetween } from './navigation.ts';
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
  const siege = (unit.formation ?? unit.kind) === 'catapult';
  const moving = (): void => {
    if (siege) { unit.cooldown = 0; unit.attackWindup = CATAPULT_WINDUP_SECONDS; unit.attackTarget = null; }
  };
  const fire = (target: Target, damage: number): void => {
    if (siege) {
      unit.attackWindup = Math.max(0, unit.attackWindup - seconds);
      if (unit.attackWindup > 1e-9) return;
    }
    attack(unit, target, damage);
  };
  if (rule.damage === 0 || unit.hp <= 0) return;
  unit.cooldown = Math.max(0, unit.cooldown - seconds);
  if (unit.kind !== 'invader' && unit.manualMove && unit.destination) {
    moving();
    unit.attackTarget = null;
    moveUnitToward(state, unit, unit.destination, seconds * rule.speed);
    if (distance(unit, unit.destination) < 5) {
      unit.destination = null;
      unit.manualMove = false;
    }
    return;
  }
  const enemies = state.units.filter(other => other.hp > 0 && (unit.kind === 'invader' ? other.kind !== 'invader' : other.kind === 'invader'));
  const buildings = state.buildings.filter(building => building.hp > 0 && building.enemy === (unit.kind !== 'invader'));
  let target: Target | undefined;
  if (unit.kind === 'invader') {
    const defenders = enemies.filter(other => isFighter(other) && distance(unit, other) < 140);
    const workers = enemies.filter(other => (other.kind === 'worker' || other.kind === 'builder') && distance(unit, other) < 100);
    target = closest(unit, defenders) ?? closest(unit, workers)
      ?? closest(unit, buildings.filter(building => building.kind !== 'wall')) ?? closest(unit, buildings);
  } else {
    target = closest(unit, enemies.filter(other => distance(unit, other) < Math.max(140, rule.range)));
    if (!target && unit.kind === 'warrior') target = closest(unit, buildings.filter(building => building.kind === 'tower' && distance(unit, building) < 140));
    if (!target && siege) target = closest(unit, buildings.filter(building => distance(unit, building) <= rule.range));
    if (!target && unit.destination) {
      moving();
      moveUnitToward(state, unit, unit.destination, seconds * rule.speed);
      if (distance(unit, unit.destination) < 5) unit.destination = null;
      if (siege) return;
    }
    if (!target) target = closest(unit, buildings.filter(building => distance(unit, building) < rule.range + 20));
  }
  if (!target) { moving(); return; }
  const targetWall = 'enemy' in target && target.kind === 'wall' ? target : undefined;
  const approach = targetWall ? wallApproach(unit, targetWall) : target;
  const blocked = wallBetween(state, unit, target, targetWall);
  if (distance(unit, approach) > (targetWall ? 1 : rule.range) || blocked) {
    if (moveUnitToward(state, unit, approach, seconds * rule.speed)) moving();
    else if (unit.kind === 'invader') {
      const wall = closest(unit, buildings.filter(building => building.kind === 'wall'));
      if (wall && 'enemy' in wall) {
        const point = wallApproach(unit, wall);
        if (distance(unit, point) <= 1) {
          fire(wall, rule.damage);
        }
        else { moving(); moveUnitToward(state, unit, point, seconds * rule.speed); }
      }
    }
  } else {
    const damage = rule.damage + (unit.kind === 'invader' ? 0 : unitUpgrade(state, unit));
    fire(target, damage * (siege ? 'enemy' in target ? 1.5 : .5 : 1));
  }
}

export function spawnWave(state: StrongholdState): void {
  state.wave++;
  const amount = Math.min(12, Math.ceil(state.wave / 2));
  const remaining = UNIT_CAPS.invader - state.units.filter(unit => unit.kind === 'invader').length;
  for (let index = 0; index < Math.min(amount, remaining); index++) {
    const side = index % 3;
    const formation = state.wave >= 6 && index % 5 === 0 ? 'catapult' : state.wave >= 3 && index % 3 === 0 ? 'archer' : null;
    addUnit(state, 'invader', {
      x: side === 0 ? 30 : side === 1 ? 970 : 300 + index * 23,
      y: side === 2 ? 35 : 100 + (index * 57) % 280
    }, formation);
  }
  state.waveIn = Math.max(65, 95 - state.wave * 2);
  state.message = `Wave ${state.wave}: invaders are approaching. Protect the gatherers!`;
  recordEvent(state, `Wave ${state.wave} approaching`);
  if (state.wave % 3 === 0) {
    const base = state.buildings.find(building => building.kind === 'enemy-base');
    if (base) { base.tier++; recordEvent(state, 'Enemy base upgraded'); }
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
    const damage = 8 + tower.tier * 4 + (tower.enemy ? 0 : towerUpgrade(state, tower.tier) * 2);
    if (target) attack(tower, target, damage);
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

export function rallyArmy(state: StrongholdState, point: Point | null): void {
  if (!point) return;
  for (const unit of state.units) {
    if (isFighter(unit) && !unit.manualMove) unit.destination = { ...point };
  }
}
