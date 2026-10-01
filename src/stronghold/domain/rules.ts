import type { Action, BuildingKind, Point, Role, UnitKind, WorldEvent } from './types.ts';

export const ROLE_LABELS: Record<Role, string> = {
  economy: 'Economy', production: 'Army production', army: 'Army control', defenses: 'Defenses'
};
export const ROLE_ACTIONS: Record<Role, readonly Action[]> = {
  economy: ['resources', 'worker', 'relay', 'upgrade'],
  production: ['barracks', 'warrior', 'archer', 'catapult', 'upgrade'],
  army: [],
  defenses: ['builder', 'tower', 'wall', 'upgrade']
};
export const ACTION_LABELS: Record<Action, string> = {
  resources: 'Gather supplies', worker: 'Recruit gatherer', relay: 'Place relay',
  barracks: 'Place barracks', warrior: 'Train warrior', archer: 'Train archer',
  catapult: 'Train catapult', builder: 'Recruit builder', tower: 'Place tower',
  wall: 'Place wall', upgrade: 'Upgrade role'
};
export const COSTS: Record<Action, number> = {
  resources: 0, worker: 20, relay: 15, barracks: 40, warrior: 10,
  archer: 20, catapult: 35, builder: 25, tower: 25, wall: 15, upgrade: 60
};
export const MIN_TIER: Record<Action, number> = {
  resources: 0, worker: 0, relay: 0, barracks: 1, warrior: 1, archer: 2,
  catapult: 3, builder: 0, tower: 1, wall: 0, upgrade: 0
};
export const UNIT_CAPS: Record<UnitKind, number> = {
  worker: 12, builder: 4, warrior: 18, archer: 12, catapult: 6, invader: 40
};
export const BUILDING_CAPS: Record<BuildingKind, number> = {
  castle: 1, 'enemy-base': 1, relay: 16, barracks: 6, tower: 8, wall: 16
};
export const UNIT_RULES: Record<UnitKind, { hp: number; speed: number; damage: number; range: number }> = {
  worker: { hp: 35, speed: 12.6, damage: 0, range: 0 },
  builder: { hp: 55, speed: 15, damage: 0, range: 0 },
  warrior: { hp: 100, speed: 18.6, damage: 12, range: 26 },
  archer: { hp: 65, speed: 16.5, damage: 9, range: 120 },
  catapult: { hp: 110, speed: 9.6, damage: 30, range: 165 },
  invader: { hp: 60, speed: 11.4, damage: 8, range: 25 }
};
export const UNIT_HEALTH_MULTIPLIER = 2;
export const EVENT_LABELS: Record<WorldEvent, string> = {
  peace: 'Scripture watch', 'left-hand': 'Left-hand drill', vowels: 'Vowel storm',
  numbers: 'Number siege', symbols: 'Symbol storm', code: 'Code formation'
};
export const TIER_MAX = 3;
export const RELAY_RANGE = 155;
export const TIER_QUOTA = 3;
export const BASE: Point = { x: 500, y: 595 };
export const ENEMY_BASE: Point = { x: 500, y: 60 };
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export function moveToward(point: Point, target: Point, travel: number): void {
  const length = distance(point, target);
  if (length === 0) return;
  const amount = Math.min(1, travel / length);
  point.x += (target.x - point.x) * amount;
  point.y += (target.y - point.y) * amount;
}
export function validPoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
    && point.x >= 20 && point.x <= 980 && point.y >= 20 && point.y <= 630;
}
