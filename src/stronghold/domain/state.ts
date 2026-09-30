import { BASE, ENEMY_BASE, UNIT_RULES } from './rules.ts';
import { assignPhrase } from './phrases.ts';
import { unitUpgrade } from './technology.ts';
import type { ArmyUnitKind, Building, BuildingKind, Participant, Point, StrongholdState, Unit, UnitKind } from './types.ts';

export function addUnit(state: StrongholdState, kind: UnitKind, point: Point, formation: ArmyUnitKind | null = null): Unit {
  const hp = (formation ? UNIT_RULES[formation].hp : UNIT_RULES[kind].hp)
    + (kind === 'invader' ? state.wave * 5 : unitUpgrade(state, { kind }) * 10);
  const unit: Unit = { ...point, id: state.nextId++, kind, hp, maxHp: hp, destination: null, cooldown: 0, task: null, formation };
  state.units.push(unit);
  return unit;
}
export function addBuilding(
  state: StrongholdState, kind: BuildingKind, point: Point, complete = false, enemy = false, tier = state.tier
): Building {
  const hp = kind === 'castle' ? 1000 : kind === 'enemy-base' ? 1200 : kind === 'wall' ? 260
    : 160 + (kind === 'tower' ? 60 : kind === 'barracks' ? 40 : 0) * Math.max(0, tier - 1);
  const building: Building = {
    ...point, id: state.nextId++, kind, hp, maxHp: hp, tier,
    progress: complete ? 1 : 0, cooldown: 0, enemy
  };
  state.buildings.push(building);
  return building;
}
export function createStronghold(): StrongholdState {
  const roster: Pick<Participant, 'id' | 'name' | 'color' | 'role' | 'simulated'>[] = [
    { id: 'you', name: 'You', color: '#ff1726', role: 'economy', simulated: false },
    { id: 'bot-1', name: 'Miriam', color: '#00aeef', role: 'production', simulated: true },
    { id: 'bot-2', name: 'Caleb', color: '#ead500', role: 'army', simulated: true },
    { id: 'bot-3', name: 'Esther', color: '#18b644', role: 'defenses', simulated: true }
  ];
  const state: StrongholdState = {
    phase: 'playing', tier: 0, elapsed: 0, wave: 0, waveIn: 30, resources: 100,
    event: 'peace', eventIn: 60, nextId: 1, units: [], buildings: [], chunks: [],
    players: roster.map(player => ({
      ...player, action: player.role === 'economy' ? 'resources' : player.role === 'defenses' ? 'builder' : 'warrior',
      phrase: '', typed: '', phraseId: 0, completed: 0, ready: false, contribution: 0, typingCredit: 0,
      constructionTier: 1, upgradeTarget: player.role === 'production' ? 'warrior' : player.role === 'defenses' ? 'tower-1' : 'economy', actionPhrases: 0
    })),
    nodes: [
      { x: 290, y: 530, rich: false }, { x: 730, y: 520, rich: false },
      { x: 200, y: 370, rich: false }, { x: 840, y: 345, rich: false },
      { x: 370, y: 390, rich: false }, { x: 680, y: 325, rich: true },
      { x: 145, y: 235, rich: true }, { x: 805, y: 170, rich: false }
    ].map(node => ({ ...node, id: 100 + node.x, remaining: node.rich ? 1200 : 800 })),
    upgrades: { economy: 0, production: 0, defenses: 0 },
    technology: { economy: 0, warrior: 0, archer: 0, catapult: 0, 'tower-1': 0, 'tower-2': 0, 'tower-3': 0 },
    rally: { x: 500, y: 450 }, message: ''
  };
  addBuilding(state, 'castle', BASE, true);
  addBuilding(state, 'enemy-base', ENEMY_BASE, true, true);
  addBuilding(state, 'tower', { x: 420, y: 125 }, true, true);
  addBuilding(state, 'tower', { x: 580, y: 125 }, true, true);
  addUnit(state, 'worker', { x: 440, y: 560 });
  addUnit(state, 'worker', { x: 560, y: 560 });
  addUnit(state, 'builder', { x: 500, y: 540 });
  addUnit(state, 'warrior', { x: 480, y: 465 });
  addUnit(state, 'warrior', { x: 520, y: 465 });
  state.players.forEach(player => assignPhrase(state, player));
  return state;
}
