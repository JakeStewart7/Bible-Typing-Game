import type { Action, BuildingKind, PhraseLength, Point, Role, UnitKind, WorldEvent } from './types.ts';

export const ROLE_LABELS: Record<Role, string> = {
  economy: 'Economy', production: 'Army', army: 'Unit Control', defenses: 'Defenses'
};
export const ROLE_ACTIONS: Record<Role, readonly Action[]> = {
  economy: ['resources', 'worker', 'relay', 'upgrade'],
  production: ['resources', 'barracks', 'warrior', 'archer', 'catapult', 'upgrade'],
  army: ['resources'],
  defenses: ['builder', 'tower', 'wall', 'upgrade']
};
export const ACTION_LABELS: Record<Action, string> = {
  resources: 'Gather supplies', worker: 'Recruit gatherer', relay: 'Place relay',
  barracks: 'Place barracks', warrior: 'Train warrior', archer: 'Train archer',
  catapult: 'Train catapult', builder: 'Recruit builder', tower: 'Place tower',
  wall: 'Place wall', upgrade: 'Upgrade role'
};
export const COSTS: Record<Action, number> = {
  resources: 0, worker: 0, relay: 30, barracks: 0, warrior: 60,
  archer: 100, catapult: 180, builder: 0, tower: 0, wall: 0, upgrade: 120
};
export function isTypingAction(action: Action): boolean {
  return action === 'resources' || action === 'worker' || action === 'barracks'
    || action === 'builder' || action === 'wall' || action === 'tower';
}
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
  worker: { hp: 50, speed: 13, damage: 0, range: 0 },
  builder: { hp: 70, speed: 14, damage: 0, range: 0 },
  warrior: { hp: 150, speed: 19, damage: 8, range: 26 },
  archer: { hp: 105, speed: 16, damage: 6, range: 120 },
  catapult: { hp: 180, speed: 8, damage: 18, range: 165 },
  invader: { hp: 150, speed: 19, damage: 8, range: 26 }
};
export const UNIT_HEALTH_MULTIPLIER = 2;
export const CATAPULT_WINDUP_SECONDS = .8;
export const WALL_ROTATION_STEP = 22.5;
export const TEXT_LENGTH_RANGES: Record<PhraseLength, readonly [number, number]> = {
  short: [1, 5], medium: [6, 11], long: [12, 24], 'extra-long': [25, 40]
};
export const TEXT_LENGTH_BONUSES: Record<PhraseLength, number> = { short: 1, medium: 1.1, long: 1.25, 'extra-long': 1.5 };
export const LENGTH_LABELS: Record<PhraseLength, string> = { short: 'Short', medium: 'Medium', long: 'Long', 'extra-long': 'Extra Long' };
export const EVENT_LABELS: Record<WorldEvent, string> = {
  peace: 'Scripture watch', 'left-hand': 'Left-hand drill', vowels: 'Vowel storm',
  numbers: 'Number siege', symbols: 'Symbol storm', code: 'Code formation'
};
export const TIER_MAX = 3;
export const TIER_COSTS = [300, 600, 1500] as const;
export const RELAY_RANGE = 155;
export const TIER_CHARACTER_GOAL = 500;
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
