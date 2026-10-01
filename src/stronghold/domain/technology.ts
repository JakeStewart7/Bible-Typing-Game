import { COSTS, MIN_TIER, UNIT_HEALTH_MULTIPLIER } from './rules.ts';
import type { Participant, Role, StrongholdState, UpgradeTarget, Unit } from './types.ts';

export const UPGRADE_OPTIONS: Record<UpgradeTarget, { label: string; role: Role; tier: number; cost: number }> = {
  economy: { label: 'Economy', role: 'economy', tier: 0, cost: 60 },
  warrior: { label: 'Warrior', role: 'production', tier: 1, cost: 10 },
  archer: { label: 'Archer', role: 'production', tier: 2, cost: 20 },
  catapult: { label: 'Catapult', role: 'production', tier: 3, cost: 35 },
  'tower-1': { label: 'T1 tower', role: 'defenses', tier: 1, cost: 25 },
  'tower-2': { label: 'T2 tower', role: 'defenses', tier: 2, cost: 40 },
  'tower-3': { label: 'T3 tower', role: 'defenses', tier: 3, cost: 60 }
};
export function upgradeLimit(tier: number, target: UpgradeTarget): number {
  return target === 'economy' ? tier + 2 : Math.max(0, tier - UPGRADE_OPTIONS[target].tier + 1);
}
export function taskCost(player: Pick<Participant, 'action' | 'constructionTier' | 'upgradeTarget'>): number {
  if (player.action === 'upgrade') return UPGRADE_OPTIONS[player.upgradeTarget].cost;
  if (player.action === 'tower' || player.action === 'barracks') return COSTS[player.action] * player.constructionTier;
  return COSTS[player.action];
}
export function taskPhrases(player: Pick<Participant, 'action' | 'constructionTier'>): number {
  if (player.action === 'tower' || player.action === 'barracks') return player.constructionTier;
  return Math.max(1, MIN_TIER[player.action]);
}
export function taskWork(player: Pick<Participant, 'action' | 'constructionTier'>): number {
  return taskPhrases(player) * 8;
}
export function unitUpgrade(state: Pick<StrongholdState, 'technology'>, unit: Pick<Unit, 'kind'>): number {
  return unit.kind === 'warrior' || unit.kind === 'archer' || unit.kind === 'catapult'
    ? state.technology[unit.kind] : 0;
}
export function towerUpgrade(state: Pick<StrongholdState, 'technology'>, tier: number): number {
  return tier >= 3 ? state.technology['tower-3'] : tier === 2 ? state.technology['tower-2'] : state.technology['tower-1'];
}
export function applyUpgrade(state: StrongholdState, player: Participant): void {
  state.technology[player.upgradeTarget]++;
  if (player.role !== 'army') state.upgrades[player.role]++;
  for (const unit of state.units) {
    if (unit.kind === player.upgradeTarget) { unit.maxHp += 10 * UNIT_HEALTH_MULTIPLIER; unit.hp += 10 * UNIT_HEALTH_MULTIPLIER; }
  }
}
