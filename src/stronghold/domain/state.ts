import { BASE, ENEMY_BASE, TOWER_STRENGTH_MULTIPLIER, UNIT_HEALTH_MULTIPLIER, UNIT_RULES } from './rules.ts';
import { assignPhrase } from './phrases.ts';
import { unitUpgrade } from './technology.ts';
import { createRoleTasks } from './tasks.ts';
import { DEFAULT_MATCH_OPTIONS, validateMatchOptions } from './options.ts';
import type { ArmyUnitKind, Building, BuildingKind, Participant, Point, Season, StrongholdMatchOptions, StrongholdState, Unit, UnitKind } from './types.ts';
import { randomSeason, seasonalNodes } from './environment.ts';
import { PLAYER_COLORS } from './types.ts';

export function addUnit(state: StrongholdState, kind: UnitKind, point: Point, formation: ArmyUnitKind | null = null): Unit {
  const hp = ((formation ? UNIT_RULES[formation].hp : UNIT_RULES[kind].hp)
    + (kind === 'invader' ? 0 : unitUpgrade(state, { kind }) * 10)) * UNIT_HEALTH_MULTIPLIER;
  const unit: Unit = { ...point, id: state.nextId++, kind, hp, maxHp: hp, destination: null, cooldown: 0, task: null, formation, attackTarget: null, idleTime: null };
  state.units.push(unit);
  return unit;
}
export function addBuilding(
  state: StrongholdState, kind: BuildingKind, point: Point, complete = false, enemy = false, tier = Math.max(1, state.tier)
): Building {
  const baseHp = kind === 'castle' || kind === 'enemy-base' ? 4000 : kind === 'wall' ? 260
    : 160 + (kind === 'tower' ? 60 : kind === 'barracks' ? 40 : 0) * Math.max(0, tier - 1);
  const hp = baseHp * (kind === 'tower' ? TOWER_STRENGTH_MULTIPLIER : 1);
  const building: Building = {
    ...point, id: state.nextId++, kind, hp, maxHp: hp, tier,
    progress: complete ? 1 : 0, cooldown: 0, enemy, attackTarget: null, ownerId: null, rotation: 0, trainingQueue: []
  };
  state.buildings.push(building);
  return building;
}
export function createStronghold(options: StrongholdMatchOptions = DEFAULT_MATCH_OPTIONS, season: Season = randomSeason()): StrongholdState {
  validateMatchOptions(options);
  const roster: Pick<Participant, 'id' | 'name' | 'color' | 'role' | 'simulated'>[] = [
    { id: 'you', name: 'You', color: options.playerColor ?? PLAYER_COLORS.Red, role: 'economy', simulated: false },
    { id: 'bot-1', name: 'Miriam', color: PLAYER_COLORS.Blue, role: 'production', simulated: true },
    { id: 'bot-2', name: 'Caleb', color: PLAYER_COLORS.Yellow, role: 'army', simulated: true },
    { id: 'bot-3', name: 'Esther', color: PLAYER_COLORS.Green, role: 'defenses', simulated: true }
  ];
  const matchingTeammate = roster.find(player => player.simulated && player.color === options.playerColor);
  if (matchingTeammate) matchingTeammate.color = PLAYER_COLORS.Red;
  const state: StrongholdState = {
    season, environmentElapsed: 0,
    phase: 'playing', tier: 0, elapsed: 0, wave: 0, waveIn: 60, resources: options.resources,
    event: 'peace', eventIn: 60, nextId: 1, units: [], buildings: [], chunks: [],
    players: roster.map(player => ({
      ...player, action: player.role === 'defenses' ? 'builder' : 'resources',
      phrase: '', typed: '', phraseId: 0, completed: 0, ready: false, contribution: 0, typingCredit: 0, tierPhraseCredit: 0,
      constructionTier: 1, upgradeTarget: player.role === 'production' ? 'warrior' : player.role === 'defenses' ? 'tower-1' : 'economy',
      actionPhrases: 0, work: 0, length: options.length
    })),
    nodes: seasonalNodes(season),
    upgrades: { economy: 0, production: 0, defenses: 0 },
    technology: { economy: 0, warrior: 0, archer: 0, catapult: 0, 'tower-1': 0, 'tower-2': 0, 'tower-3': 0 },
    rally: { x: 500, y: 450 }, message: '', events: [{ id: 1, elapsed: 0, playerId: null, text: 'Game started' }],
    computersPaused: options.computersPaused,
    roleTasks: {
      economy: createRoleTasks({ action: 'resources', constructionTier: 1, upgradeTarget: 'economy' }),
      production: createRoleTasks({ action: 'resources', constructionTier: 1, upgradeTarget: 'warrior' }),
      army: createRoleTasks({ action: 'resources', constructionTier: 1, upgradeTarget: 'economy' }),
      defenses: createRoleTasks({ action: 'builder', constructionTier: 1, upgradeTarget: 'tower-1' })
    }
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
