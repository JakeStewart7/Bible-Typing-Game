import { COSTS, TEXT_LENGTH_BONUSES, UNIT_HEALTH_MULTIPLIER } from './rules.ts';
import type { Building, Participant, Role, StrongholdState, UpgradeTarget, Unit } from './types.ts';

export const UPGRADE_OPTIONS: Record<UpgradeTarget, { label: string; role: Role; tier: number; cost: number }> = {
  economy: { label: 'Economy', role: 'economy', tier: 0, cost: 120 },
  warrior: { label: 'Warrior', role: 'production', tier: 1, cost: 60 },
  archer: { label: 'Archer', role: 'production', tier: 2, cost: 100 },
  catapult: { label: 'Catapult', role: 'production', tier: 3, cost: 160 },
  'tower-1': { label: 'T1 tower', role: 'defenses', tier: 1, cost: 75 },
  'tower-2': { label: 'T2 tower', role: 'defenses', tier: 2, cost: 125 },
  'tower-3': { label: 'T3 tower', role: 'defenses', tier: 3, cost: 180 }
};
export function upgradeLimit(tier: number, target: UpgradeTarget): number {
  return target === 'economy' ? tier + 2 : Math.max(0, tier - UPGRADE_OPTIONS[target].tier + 1);
}
export function taskCost(player: Pick<Participant, 'action' | 'constructionTier' | 'upgradeTarget'>): number {
  if (player.action === 'upgrade') return UPGRADE_OPTIONS[player.upgradeTarget].cost;
  if (player.action === 'tower' || player.action === 'barracks') return COSTS[player.action] * player.constructionTier;
  return COSTS[player.action];
}
export function taskWork(player: Pick<Participant, 'action' | 'constructionTier'>): number {
  if (player.action === 'tower') return 50 * player.constructionTier;
  if (player.action === 'barracks') return 60 * player.constructionTier;
  if (player.action === 'worker' || player.action === 'builder') return 64;
  return 32;
}
export function phraseWork(player: Pick<Participant, 'phrase' | 'length'>): number {
  return Math.round(player.phrase.length * TEXT_LENGTH_BONUSES[player.length] * 100) / 100;
}
export function unitUpgrade(state: Pick<StrongholdState, 'technology'>, unit: Pick<Unit, 'kind'>): number {
  return unit.kind === 'warrior' || unit.kind === 'archer' || unit.kind === 'catapult'
    ? state.technology[unit.kind] : 0;
}
export function towerUpgrade(state: Pick<StrongholdState, 'technology'>, tier: number): number {
  return tier >= 3 ? state.technology['tower-3'] : tier === 2 ? state.technology['tower-2'] : state.technology['tower-1'];
}
export function buildingScale(state: Pick<StrongholdState, 'technology'>, building: Pick<Building, 'kind' | 'enemy' | 'tier'>): number {
  const level = building.kind === 'tower' && !building.enemy ? towerUpgrade(state, building.tier) : 0;
  return building.kind === 'tower' || building.kind === 'enemy-base' ? 1 + Math.min(3, building.tier) * .08 + level * .05 : 1;
}
export function applyUpgrade(state: StrongholdState, player: Participant): void {
  state.technology[player.upgradeTarget]++;
  if (player.role !== 'army') state.upgrades[player.role]++;
  for (const unit of state.units) {
    if (unit.kind === player.upgradeTarget) { unit.maxHp += 15 * UNIT_HEALTH_MULTIPLIER; unit.hp += 15 * UNIT_HEALTH_MULTIPLIER; }
  }
}
