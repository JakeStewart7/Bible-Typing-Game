import { BASE, CATAPULT_WINDUP_SECONDS, ENEMY_BASE, UNIT_HEALTH_MULTIPLIER, UNIT_RULES } from './rules.ts';
import { assignPhrase } from './phrases.ts';
import { unitUpgrade } from './technology.ts';
import { createRoleTasks } from './tasks.ts';
import { DEFAULT_MATCH_OPTIONS, DEFAULT_STARTING_COUNTS, validateMatchOptions } from './options.ts';
import type { ArmyUnitKind, Building, BuildingKind, Participant, Point, Season, StrongholdMatchOptions, StrongholdState, Unit, UnitKind } from './types.ts';
import { DAY_SECONDS, randomSeason, seasonalNodes } from './environment.ts';
import { PLAYER_COLORS, STARTING_ENTITIES } from './types.ts';
import { unitRadius, unitSpawnClear } from './navigation.ts';
import { createFog, updateFog } from './fog.ts';

export function addUnit(state: StrongholdState, kind: UnitKind, point: Point, formation: ArmyUnitKind | null = null): Unit {
  const hp = ((formation ? UNIT_RULES[formation].hp : UNIT_RULES[kind].hp)
    + (kind === 'invader' ? 0 : unitUpgrade(state, { kind }) * 15)) * UNIT_HEALTH_MULTIPLIER;
  const unit: Unit = { ...point, id: state.nextId++, kind, hp, maxHp: hp, destination: null, manualMove: false, cooldown: 0, task: null, formation, attackTarget: null, idleTime: null, attackWindup: CATAPULT_WINDUP_SECONDS };
  state.units.push(unit);
  return unit;
}
export function addBuilding(
  state: StrongholdState, kind: BuildingKind, point: Point, complete = false, enemy = false, tier = Math.max(1, state.tier)
): Building {
  const hp = kind === 'castle' || kind === 'enemy-base' ? 4000 : kind === 'wall' ? 440
    : kind === 'tower' ? 600 + 200 * Math.max(0, tier - 1)
    : kind === 'barracks' ? 320 + 100 * Math.max(0, tier - 1) : 240;
  const building: Building = {
    ...point, id: state.nextId++, kind, hp, maxHp: hp, tier,
    progress: complete ? 1 : 0, cooldown: 0, enemy, attackTarget: null, ownerId: null, rotation: 0, trainingQueue: [], rally: null
  };
  state.buildings.push(building);
  return building;
}
export function createStronghold(options: StrongholdMatchOptions = DEFAULT_MATCH_OPTIONS, season?: Season): StrongholdState {
  validateMatchOptions(options);
  const startingSeason = season ?? (options.season && options.season !== 'random' ? options.season : randomSeason());
  const roster: Pick<Participant, 'id' | 'name' | 'color' | 'role' | 'simulated'>[] = [
    { id: 'you', name: 'You', color: options.playerColor ?? PLAYER_COLORS.Red, role: 'economy', simulated: false },
    { id: 'bot-1', name: 'Miriam', color: PLAYER_COLORS.Blue, role: 'production', simulated: true },
    { id: 'bot-2', name: 'Caleb', color: PLAYER_COLORS.Yellow, role: 'army', simulated: true },
    { id: 'bot-3', name: 'Esther', color: PLAYER_COLORS.Green, role: 'defenses', simulated: true }
  ];
  const matchingTeammate = roster.find(player => player.simulated && player.color === options.playerColor);
  if (matchingTeammate) matchingTeammate.color = PLAYER_COLORS.Red;
  const state: StrongholdState = {
    season: startingSeason, environmentElapsed: options.period === 'night' ? DAY_SECONDS : 0,
    phase: 'playing', tier: options.tier ?? 0, elapsed: 0, wave: 0, waveIn: 60, resources: options.resources,
    fog: createFog(),
    event: 'peace', eventIn: 60, nextId: 1, units: [], buildings: [], chunks: [],
    players: roster.map(player => ({
      ...player, action: player.role === 'economy' ? 'worker' : player.role === 'defenses' ? 'builder' : player.role === 'production' ? 'barracks' : 'resources',
      phrase: '', typed: '', phraseId: 0, completed: 0, ready: false, contribution: 0, typingCredit: 0,
      constructionTier: 1, upgradeTarget: player.role === 'production' ? 'warrior' : player.role === 'defenses' ? 'tower-1' : 'economy',
      actionPhrases: 0, work: 0, length: options.length
    })),
    nodes: seasonalNodes(startingSeason),
    upgrades: { economy: 0, production: 0, defenses: 0 },
    technology: { economy: 0, warrior: 0, archer: 0, catapult: 0, 'tower-1': 0, 'tower-2': 0, 'tower-3': 0 },
    rally: null, message: '', events: [{ id: 1, elapsed: 0, playerId: null, text: 'Game started' }],
    computersPaused: options.computersPaused,
    roleTasks: {
      economy: createRoleTasks({ action: 'worker', constructionTier: 1, upgradeTarget: 'economy' }),
      production: createRoleTasks({ action: 'barracks', constructionTier: 1, upgradeTarget: 'warrior' }),
      army: createRoleTasks({ action: 'resources', constructionTier: 1, upgradeTarget: 'economy' }),
      defenses: createRoleTasks({ action: 'builder', constructionTier: 1, upgradeTarget: 'tower-1' })
    }
  };
  addBuilding(state, 'castle', BASE, true);
  addBuilding(state, 'enemy-base', ENEMY_BASE, true, true);
  addBuilding(state, 'tower', { x: 420, y: 125 }, true, true);
  addBuilding(state, 'tower', { x: 580, y: 125 }, true, true);
  const counts = { ...DEFAULT_STARTING_COUNTS, ...options.startingCounts };
  for (let index = 0; index < counts.tower; index++) {
    addBuilding(state, 'tower', { x: 340 + index % 4 * 100, y: 390 - Math.floor(index / 4) * 80 }, true);
  }
  const original: Partial<Record<UnitKind, Point[]>> = {
    worker: [{ x: 440, y: 560 }, { x: 560, y: 560 }], builder: [{ x: 500, y: 540 }],
    warrior: [{ x: 480, y: 465 }, { x: 520, y: 465 }]
  };
  const sites = Array.from({ length: 96 }, (_, index) => ({ x: 120 + index % 16 * 48, y: 360 + Math.floor(index / 16) * 48 }));
  for (const kind of STARTING_ENTITIES) {
    if (kind === 'tower') continue;
    for (let index = 0; index < counts[kind]; index++) {
      const radius = unitRadius({ kind });
      const preferred = original[kind]?.[index];
      const point = preferred && unitSpawnClear(state, preferred, radius) ? preferred : sites.find(point => unitSpawnClear(state, point, radius));
      if (!point) throw new Error(`Not enough space for starting ${kind}s.`);
      addUnit(state, kind, point);
    }
  }
  state.players.forEach(player => assignPhrase(state, player));
  updateFog(state);
  return state;
}
