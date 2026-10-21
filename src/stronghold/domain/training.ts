import { MIN_TIER } from './rules.ts';
import type { ArmyUnitKind, Building, StrongholdState } from './types.ts';

export const TRAINING_SECONDS = 12;
export function isArmyUnit(action: string): action is ArmyUnitKind {
  return action === 'warrior' || action === 'archer' || action === 'catapult';
}
export function trainingBarracks(world: Pick<StrongholdState, 'buildings'>, kind: ArmyUnitKind): Building | undefined {
  return world.buildings.filter(building => building.kind === 'barracks' && !building.enemy && building.hp > 0
    && building.progress === 1 && building.tier === MIN_TIER[kind])
    .sort((a, b) => a.trainingQueue.length - b.trainingQueue.length || a.cooldown - b.cooldown || a.id - b.id)[0];
}
export function queuedUnits(world: Pick<StrongholdState, 'buildings'>, kind: ArmyUnitKind): number {
  return world.buildings.filter(building => building.hp > 0)
    .reduce((total, building) => total + building.trainingQueue.filter(order => order.kind === kind).length, 0);
}
