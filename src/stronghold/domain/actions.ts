import { assignPhrase, copyRoleTask } from './phrases.ts';
import { addBuilding, addUnit } from './state.ts';
import { ACTION_LABELS, BASE, BUILDING_CAPS, distance, isTypingAction, MIN_TIER, ROLE_ACTIONS, ROLE_LABELS, TIER_MAX, UNIT_CAPS, validPoint, WALL_ROTATION_STEP } from './rules.ts';
import { applyUpgrade, phraseWork, taskCost, taskWork, upgradeLimit, UPGRADE_OPTIONS } from './technology.ts';
import { ENTITY_LABELS, playerEvent, recordEvent } from './events.ts';
import { PHRASE_LENGTHS, SEASONS, type Action, type BuildingKind, type Participant, type Point, type StrongholdCommand, type StrongholdState } from './types.ts';
import { restoreRoleTask, saveRoleTask, taskKey } from './tasks.ts';
import { spawnWave } from './combat.ts';
import { creditResources, daylight, DAY_SECONDS, NIGHT_SECONDS, SEASON_BONUSES, SEASON_LABELS, seasonalNodes } from './environment.ts';
import { tierProgress } from './tier-progress.ts';
import { buildingFootprint, footprintCorners, footprintsOverlap, unitRadius, unitSpawnPoint } from './navigation.ts';
import { isArmyUnit, queuedUnits, trainingBarracks, TRAINING_SECONDS } from './training.ts';

type ActionWorld = Pick<StrongholdState, 'tier' | 'resources' | 'units' | 'technology' | 'buildings'>;
type TaskPlayer = Pick<Participant, 'role' | 'action' | 'constructionTier' | 'upgradeTarget' | 'work'>;
export function actionUnlockProblem(state: Pick<StrongholdState, 'tier'>, task: Pick<Participant, 'action' | 'constructionTier' | 'upgradeTarget'>): string | null {
  const tier = Math.max(MIN_TIER[task.action], task.action === 'tower' || task.action === 'barracks' ? task.constructionTier
    : task.action === 'upgrade' ? UPGRADE_OPTIONS[task.upgradeTarget].tier : 0);
  return state.tier < tier ? `Requires tier ${tier}. Ready up to advance together.` : null;
}
export function actionProblem(state: ActionWorld, player: TaskPlayer, action: Action): string | null {
  if (!ROLE_ACTIONS[player.role].includes(action)) return 'This action belongs to another role.';
  const locked = actionUnlockProblem(state, { ...player, action });
  if (locked) return locked;
  if (state.resources < taskCost({ ...player, action })) return `Need ${taskCost({ ...player, action })} shared supplies.`;
  if (action === 'upgrade') {
    if (player.role === 'army') return 'Unit Control does not have typing upgrades.';
    if (UPGRADE_OPTIONS[player.upgradeTarget].role !== player.role) return 'This upgrade belongs to another role.';
    if (state.technology[player.upgradeTarget] >= upgradeLimit(state.tier, player.upgradeTarget)) return 'Upgrade limit reached for this tier.';
  }
  if (action === 'worker' || action === 'builder' || action === 'warrior' || action === 'archer' || action === 'catapult') {
    const queued = isArmyUnit(action) ? queuedUnits(state, action) : 0;
    if (state.units.filter(unit => unit.kind === action && unit.hp > 0).length + queued >= UNIT_CAPS[action]) return `${ACTION_LABELS[action]} population limit reached.`;
    if ((action === 'worker' || action === 'builder') && !unitSpawnPoint(state, BASE)) return 'Clear space near the castle to recruit another unit.';
  }
  if (isArmyUnit(action) && !trainingBarracks(state, action)) return `Build and finish Tier ${MIN_TIER[action]} Barracks to queue ${action}s.`;
  return null;
}

export function placementProblem(
  state: ActionWorld & Pick<StrongholdState, 'buildings'>,
  player: TaskPlayer, kind: Extract<BuildingKind, 'relay' | 'barracks' | 'tower' | 'wall'>, point: Point, rotation = 0
): string | null {
  if (!validPoint(point)) return 'Choose a location inside the battlefield.';
  if (!Number.isFinite(rotation) || rotation < 0 || rotation >= 360 || rotation % WALL_ROTATION_STEP !== 0) return 'Choose one of the 16 wall angles, 22.5 degrees apart.';
  const footprint = buildingFootprint(state, { ...point, kind, rotation, tier: player.constructionTier, enemy: false });
  if (footprintCorners(footprint).some(corner => !validPoint(corner) || corner.y < 130)) return `Keep the entire ${kind} inside the construction area.`;
  const blockers = placementBlockers(state, player, kind, point, rotation);
  if (blockers.units.length) return 'Leave space for units before placing or rotating a building.';
  if (kind !== 'relay' && (player.action !== kind || player.work < taskWork(player))) return 'Complete the construction work first.';
  const problem = actionProblem(state, player, kind);
  if (problem) return problem;
  if (!state.units.some(unit => unit.kind === 'builder' && unit.hp > 0)) return 'Recruit a builder in Defenses first.';
  if (state.buildings.filter(building => building.kind === kind && !building.enemy && building.hp > 0).length >= BUILDING_CAPS[kind]) return 'Building limit reached.';
  if (blockers.buildings.length) return 'Leave space between buildings.';
  if (point.y < 130) return 'The enemy stronghold cannot be used as a construction site.';
  return null;
}
export function placementBlockers(state: ActionWorld, player: Pick<Participant, 'constructionTier'>,
  kind: Extract<BuildingKind, 'relay' | 'barracks' | 'tower' | 'wall'>, point: Point, rotation = 0): { buildings: number[]; units: number[] } {
  const footprint = buildingFootprint(state, { ...point, kind, rotation, tier: player.constructionTier, enemy: false });
  return {
    buildings: state.buildings.filter(building => building.hp > 0 && (distance(point, building) < 38
      || footprintsOverlap(footprint, buildingFootprint(state, building)))).map(building => building.id),
    units: state.units.filter(unit => unit.hp > 0 && footprintsOverlap(footprint, { ...unit, halfX: unitRadius(unit), halfY: unitRadius(unit), rotation: 0 }, 0)).map(unit => unit.id)
  };
}

function performAction(state: StrongholdState, player: Participant, action: Action, upgrade = player.upgradeTarget): void {
  if (action === 'resources') {
    creditResources(state, 18 + state.upgrades.economy * 6);
    playerEvent(state, player, 'gathered Supplies');
  } else if (action === 'upgrade') {
    applyUpgrade(state, { ...player, upgradeTarget: upgrade });
    playerEvent(state, player, `upgraded ${UPGRADE_OPTIONS[upgrade].label}`);
  } else if (isArmyUnit(action)) {
    const barracks = trainingBarracks(state, action);
    if (!barracks) throw new Error('No completed matching-tier barracks are available.');
    if (!barracks.trainingQueue.length) barracks.cooldown = TRAINING_SECONDS;
    barracks.trainingQueue.push({ kind: action, playerId: player.id });
    playerEvent(state, player, `queued ${ENTITY_LABELS[action]} at T${barracks.tier} Barracks`);
  } else if (action === 'worker' || action === 'builder') {
    const point = unitSpawnPoint(state, BASE);
    if (!point) throw new Error('Clear space near the castle to recruit another unit.');
    const recruit = addUnit(state, action, point);
    const rally = state.buildings.find(building => building.kind === 'castle' && !building.enemy && building.hp > 0)?.rally;
    if (rally) { recruit.destination = { ...rally }; recruit.manualMove = true; }
    playerEvent(state, player, `created ${ENTITY_LABELS[action]}`);
  }
}

export function completePhrase(state: StrongholdState, player: Participant): void {
  if (state.phase === 'playing') {
    const locked = actionUnlockProblem(state, player);
    if (locked) throw new Error(locked);
  }
  player.completed++;
  if (state.phase === 'tier-up') {
    const progress = tierProgress(state.players);
    const work = player.phrase.length * SEASON_BONUSES[state.season].typing;
    player.contribution = Math.round((player.contribution + Math.min(progress.goal - progress.completed, work)) * 100) / 100;
    if (tierProgress(state.players).completed === progress.goal) {
      state.tier++;
      state.phase = 'playing';
      state.message = `Tier ${state.tier} unlocked! New units, defenses and upgrades are available.`;
      recordEvent(state, `Tier ${state.tier} unlocked`);
      state.players.forEach(other => { other.ready = false; restoreRoleTask(state, other); assignPhrase(state, other); });
      return;
    }
  } else {
    const action = player.action === 'relay' ? 'resources' : player.action;
    player.actionPhrases++;
    if (player.work < taskWork(player)) player.work = Math.round((player.work + phraseWork(player) * SEASON_BONUSES[state.season].typing) * 100) / 100;
    if (player.work < taskWork(player)) {
      assignPhrase(state, player);
      return;
    }
    if (action === 'barracks' || action === 'tower' || action === 'wall') {
      state.message = actionProblem(state, player, action) ?? 'Choose a location on the battlefield; builders will construct it.';
      assignPhrase(state, player);
      return;
    }
    while (player.work >= taskWork(player)) {
      const problem = actionProblem(state, player, action);
      if (problem) { state.message = problem; break; }
      player.work = Math.round((player.work - taskWork(player)) * 100) / 100;
      player.actionPhrases = 0;
      state.message = '';
      performAction(state, player, action);
    }
  }
  assignPhrase(state, player);
}

export function executeCommand(state: StrongholdState, player: Participant, command: StrongholdCommand): void {
  if (state.phase === 'won' || state.phase === 'lost') throw new Error('This match is over. Start a new stronghold.');
  if (command.type === 'SET_SEASON' || command.type === 'TIME_OF_DAY') {
    if (player.simulated) throw new Error('Only a human player can change the environment.');
    if (state.phase !== 'playing') throw new Error('Finish the shared tier challenge before changing the environment.');
    if (command.type === 'SET_SEASON') {
      if (!SEASONS.includes(command.season)) throw new Error('Choose a valid season.');
      if (state.season === command.season) return;
      const layout = seasonalNodes(command.season);
      if (layout.length !== state.nodes.length) throw new Error('This map does not support seasonal layout changes.');
      state.nodes = state.nodes.map((node, index) => {
        const point = layout[index];
        if (!point) throw new Error('Missing seasonal resource position.');
        return { ...node, x: point.x, y: point.y };
      });
      state.season = command.season;
      recordEvent(state, `Season changed to ${SEASON_LABELS[command.season]}`);
    } else {
      if (command.period !== 'day' && command.period !== 'night') throw new Error('Choose day or night.');
      const light = daylight(state.environmentElapsed);
      if (light.period === command.period) return;
      state.environmentElapsed = (light.cycle + (command.period === 'day' ? 1 : 0)) * (DAY_SECONDS + NIGHT_SECONDS)
        + (command.period === 'night' ? DAY_SECONDS : 0);
      recordEvent(state, `Skipped to ${command.period === 'day' ? 'Day' : 'Night'}`);
    }
    return;
  }
  if (command.type === 'NEXT_WAVE') {
    if (player.simulated) throw new Error('Only a human player can advance waves.');
    if (state.phase !== 'playing') throw new Error('Finish the shared tier challenge before advancing waves.');
    spawnWave(state);
    return;
  }
  if (command.type === 'COMPUTERS') {
    if (player.simulated) throw new Error('Only a human player can control the computers.');
    if (typeof command.paused !== 'boolean') throw new Error('Invalid computer pause state.');
    if (state.computersPaused === command.paused) return;
    state.computersPaused = command.paused;
    recordEvent(state, command.paused ? 'Computers stopped' : 'Computers resumed');
    return;
  }
  if (command.type === 'ROLE') {
    if (state.phase !== 'playing') throw new Error('Finish the shared tier challenge before switching roles.');
    if (!Object.prototype.hasOwnProperty.call(ROLE_ACTIONS, command.role)) throw new Error('Unknown role.');
    if (player.role === command.role) return;
    saveRoleTask(state, player);
    const partner = state.players.find(other => other.role === command.role);
    player.role = command.role;
    player.ready = false;
    playerEvent(state, player, `joined ${ROLE_LABELS[player.role]}`);
    if (partner) copyRoleTask(partner, player);
    else restoreRoleTask(state, player);
    if (!player.simulated && player.role === 'production' && player.action === 'resources' && state.tier >= 1) {
      restoreRoleTask(state, player, { action: 'barracks', constructionTier: 1, upgradeTarget: player.upgradeTarget });
    }
    assignPhrase(state, player);
    return;
  }
  if (command.type === 'LENGTH') {
    if (!PHRASE_LENGTHS.includes(command.length)) throw new Error('Unknown phrase length.');
    player.length = command.length;
    assignPhrase(state, player);
    return;
  }
  if (command.type === 'TYPE') {
    if (command.phraseId !== player.phraseId) throw new Error('That phrase has expired.');
    if (typeof command.text !== 'string' || command.text.length > player.phrase.length) throw new Error('Invalid typing update.');
    if (state.phase === 'playing') {
      const locked = actionUnlockProblem(state, player);
      if (locked) throw new Error(locked);
    }
    player.typed = command.text;
    if (player.typed === player.phrase) completePhrase(state, player);
    return;
  }
  if (command.type === 'READY') {
    if (state.phase !== 'playing' || state.tier >= TIER_MAX) throw new Error('Tier-up is not available right now.');
    player.ready = command.ready;
    if (!player.simulated) state.players.filter(other => other.simulated).forEach(other => { other.ready = command.ready; });
    playerEvent(state, player, command.ready ? 'is ready' : 'cancelled ready');
    if (state.players.every(other => other.ready)) {
      state.phase = 'tier-up';
      state.message = 'Complete phrases together to fill the shared progress bar. Anyone can contribute; the battlefield is paused.';
      recordEvent(state, 'Tier challenge started');
      state.players.forEach(other => { other.contribution = 0; assignPhrase(state, other); });
    }
    return;
  }
  if (state.phase !== 'playing') throw new Error('Battlefield orders are paused during tier-up.');
  if (command.type === 'ROTATE_WALL') {
    const wall = state.buildings.find(building => building.id === command.id && building.kind === 'wall' && !building.enemy && building.hp > 0);
    if (!wall) throw new Error('Choose a friendly wall.');
    const direction = command.direction ?? 1;
    if (direction !== 1 && direction !== -1) throw new Error('Choose a valid rotation direction.');
    const rotation = ((wall.rotation ?? 0) + direction * WALL_ROTATION_STEP + 360) % 360;
    // Validate geometry without spending or requiring another completed construction task.
    const problem = placementProblem({ ...state, buildings: state.buildings.filter(building => building !== wall) },
      { ...player, role: 'defenses', action: 'wall', work: taskWork({ ...player, action: 'wall' }) }, 'wall', wall, rotation);
    if (problem) throw new Error(problem);
    wall.rotation = rotation;
    playerEvent(state, player, 'rotated Wall');
    return;
  }
  if (command.type === 'ACTION') {
    if (!ROLE_ACTIONS[player.role].includes(command.action)) throw new Error('This action belongs to another role.');
    const tier = command.tier ?? Math.max(1, state.tier);
    if (!Number.isInteger(tier) || tier < 1 || tier > 3) throw new Error('Choose building tier 1, 2 or 3.');
    const upgrade = command.upgrade ?? (player.role === 'production' ? 'warrior' : player.role === 'defenses' ? 'tower-1' : 'economy');
    if (!Object.prototype.hasOwnProperty.call(UPGRADE_OPTIONS, upgrade)
      || ((command.action === 'upgrade' || command.upgrade !== undefined) && UPGRADE_OPTIONS[upgrade].role !== player.role)) throw new Error('This upgrade belongs to another role.');
    const selection = { action: command.action, constructionTier: tier, upgradeTarget: upgrade };
    const locked = actionUnlockProblem(state, selection);
    if (locked) throw new Error(locked);
    if (!isTypingAction(command.action) && command.action !== 'relay') {
      const purchase = { ...player, ...selection };
      const problem = actionProblem(state, purchase, command.action);
      if (problem) throw new Error(problem);
      state.resources -= taskCost(purchase);
      state.message = '';
      performAction(state, player, command.action, upgrade);
      return;
    }
    if (player.action === command.action && taskKey(player) === taskKey(selection)) return;
    saveRoleTask(state, player);
    restoreRoleTask(state, player, selection);
    assignPhrase(state, player);
    return;
  }
  if (command.type === 'PLACE') {
    const problem = placementProblem(state, player, command.kind, command.point, command.rotation);
    if (problem) throw new Error(problem);
    state.resources -= taskCost({ ...player, action: command.kind });
    const building = addBuilding(state, command.kind, command.point, false, false, player.constructionTier);
    building.ownerId = player.id;
    if (command.kind === 'wall') building.rotation = command.rotation ?? 0;
    state.message = '';
    playerEvent(state, player, `placed ${ENTITY_LABELS[command.kind]}`);
    if (command.kind !== 'relay') {
      player.actionPhrases = 0;
      player.work = Math.round((player.work - taskWork(player)) * 100) / 100;
      assignPhrase(state, player);
    }
    return;
  }
  if (command.type === 'RALLY' && command.ids !== undefined) {
    if (!validPoint(command.point)) throw new Error('Choose a location inside the battlefield.');
    if (!command.ids.length || command.ids.length > 64) throw new Error('Select friendly buildings first.');
    const buildings = command.ids.map(id => state.buildings.find(building => building.id === id && !building.enemy && building.hp > 0));
    if (buildings.some(building => !building)) throw new Error('Select only friendly buildings.');
    for (const building of buildings) if (building) building.rally = { ...command.point };
    playerEvent(state, player, 'set building Rally points');
    return;
  }
  if (player.role !== 'army') throw new Error('Switch to Unit Control to issue orders.');
  if (!validPoint(command.point)) throw new Error('Choose a location inside the battlefield.');
  if (command.type === 'RALLY') {
    state.rally = { ...command.point };
    for (const building of state.buildings) if (!building.enemy && building.hp > 0) building.rally = { ...command.point };
    playerEvent(state, player, 'set Rally point');
    return;
  }
  if (command.ids.length > 52) throw new Error('Too many units selected.');
  for (const id of command.ids) {
    const unit = state.units.find(candidate => candidate.id === id);
    if (!unit || unit.hp <= 0 || unit.kind === 'invader') throw new Error('Select only friendly units.');
  }
  for (const unit of state.units) if (command.ids.includes(unit.id)) {
    unit.destination = { ...command.point };
    unit.manualMove = true;
    unit.attackTarget = null;
    if (unit.kind === 'worker' || unit.kind === 'builder') {
      unit.task = null;
      unit.idleTime = 0;
      unit.attackTarget = null;
    }
  }
  if (command.ids.length > 0) playerEvent(state, player, 'ordered units');
}
