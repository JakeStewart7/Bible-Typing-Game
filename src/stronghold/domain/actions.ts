import { assignPhrase, copyRoleTask } from './phrases.ts';
import { addBuilding, addUnit } from './state.ts';
import { BASE, BUILDING_CAPS, distance, isTypingAction, MIN_TIER, ROLE_ACTIONS, ROLE_LABELS, TIER_COSTS, TIER_MAX, validPoint, WALL_ROTATION_STEP } from './rules.ts';
import { applyUpgrade, phraseWork, taskCost, taskWork, towerHealth, TOWER_UPGRADE_COSTS, upgradeLimit, UPGRADE_OPTIONS } from './technology.ts';
import { ENTITY_LABELS, playerEvent, recordEvent } from './events.ts';
import { PHRASE_LENGTHS, SEASONS, type Action, type BuildingKind, type Participant, type Point, type StrongholdCommand, type StrongholdState } from './types.ts';
import { restoreRoleTask, saveRoleTask, taskKey } from './tasks.ts';
import { spawnWave } from './combat.ts';
import { creditResources, daylight, DAY_SECONDS, NIGHT_SECONDS, SEASON_BONUSES, SEASON_LABELS, seasonalNodes, typingSupplyBase } from './environment.ts';
import { tierProgress } from './tier-progress.ts';
import { buildingFootprint, footprintCorners, footprintsOverlap, nodeOverlapsFootprint, unitSpawnPoint } from './navigation.ts';
import { isArmyUnit, supportsRally, trainingBarracks, TRAINING_SECONDS } from './training.ts';
import { inVision, visionSources } from './fog.ts';

type ActionWorld = Pick<StrongholdState, 'tier' | 'resources' | 'units' | 'technology' | 'buildings' | 'nodes'>;
type TaskPlayer = Pick<Participant, 'role' | 'action' | 'constructionTier' | 'upgradeTarget' | 'work'>;
type UnlockTask = Pick<Participant, 'action' | 'constructionTier' | 'upgradeTarget'> & Partial<Pick<Participant, 'role'>>;
export type ActionBlocker = {
  kind: 'tier' | 'role' | 'supplies' | 'limit' | 'space' | 'barracks' | 'builder' | 'selection' | 'construction';
  label: string; description: string; tier?: number;
};
export function actionRequiredTier(task: UnlockTask): number {
  return Math.max(MIN_TIER[task.action], task.action === 'tower' || task.action === 'barracks' ? task.constructionTier
    : task.action === 'upgrade' ? UPGRADE_OPTIONS[task.upgradeTarget].tier : 0, task.role === 'production' ? 1 : 0);
}
export function actionUnlockProblem(state: Pick<StrongholdState, 'tier'>, task: UnlockTask): string | null {
  const tier = actionRequiredTier(task);
  if (state.tier >= tier) return null;
  return task.role === 'production' && task.action === 'resources' ? 'Requires tier 1. Army typing unlocks then.'
    : `Requires tier ${tier}. Ready up to advance together.`;
}
export function actionBlocker(state: ActionWorld, player: TaskPlayer, action: Action): ActionBlocker | null {
  if (!ROLE_ACTIONS[player.role].includes(action)) return { kind: 'role', label: 'Other role', description: 'This action belongs to another role.' };
  const locked = actionUnlockProblem(state, { ...player, action });
  if (locked) {
    const tier = actionRequiredTier({ ...player, action });
    return { kind: 'tier', tier, label: `Needs Tier ${tier}`, description: locked };
  }
  if (action === 'upgrade') {
    if (player.role === 'army') return { kind: 'role', label: 'Other role', description: 'Unit Control does not have typing upgrades.' };
    if (UPGRADE_OPTIONS[player.upgradeTarget].role !== player.role) return { kind: 'role', label: 'Other role', description: 'This upgrade belongs to another role.' };
    const level = state.technology[player.upgradeTarget];
    if (level >= upgradeLimit(state.tier, player.upgradeTarget)) {
      for (let tier = state.tier + 1; tier <= TIER_MAX; tier++) {
        if (level < upgradeLimit(tier, player.upgradeTarget)) {
          return { kind: 'tier', tier, label: `Needs Tier ${tier}`, description: `Upgrade limit reached for this tier. Requires tier ${tier} to upgrade again.` };
        }
      }
      return { kind: 'limit', label: 'Max level', description: 'Upgrade limit reached for this tier. Maximum upgrade level reached.' };
    }
  }
  if (action === 'worker' || action === 'builder' || action === 'warrior' || action === 'archer' || action === 'catapult') {
    if ((action === 'worker' || action === 'builder') && !unitSpawnPoint(state, BASE)) {
      return { kind: 'space', label: 'Clear castle space', description: 'Clear space near the castle to recruit another unit.' };
    }
  }
  if (isArmyUnit(action) && !trainingBarracks(state, action)) {
    const tier = MIN_TIER[action];
    const started = state.buildings.some(building => building.kind === 'barracks' && !building.enemy && building.hp > 0 && building.tier === tier);
    return { kind: 'barracks', label: `${started ? 'Finish' : 'Build'} T${tier} barracks`,
      description: `Build and finish Tier ${tier} Barracks to queue ${action}s.` };
  }
  const cost = taskCost({ ...player, action });
  if (state.resources < cost) {
    const shortage = Math.ceil(cost - state.resources);
    return { kind: 'supplies', label: `${shortage} supplies short`,
      description: `Need ${cost} shared supplies. ${Math.floor(state.resources)} available; ${shortage} short.` };
  }
  return null;
}
export function actionProblem(state: ActionWorld, player: TaskPlayer, action: Action): string | null {
  return actionBlocker(state, player, action)?.description ?? null;
}
export function constructionBlocker(state: ActionWorld, kind: Extract<BuildingKind, 'relay' | 'barracks' | 'tower' | 'wall'>): ActionBlocker | null {
  if (!state.units.some(unit => unit.kind === 'builder' && unit.hp > 0)) {
    return { kind: 'builder', label: 'Needs builder', description: 'Recruit a builder in Defenses first.' };
  }
  if (kind === 'tower') return null;
  const count = state.buildings.filter(building => building.kind === kind && !building.enemy && building.hp > 0).length;
  return count >= BUILDING_CAPS[kind] ? { kind: 'limit', label: `Limit ${count}/${BUILDING_CAPS[kind]}`, description: 'Building limit reached.' } : null;
}

export function towerUpgradeBlocker(state: ActionWorld, player: Pick<Participant, 'role'>, id: number | null, tier: 2 | 3): ActionBlocker | null {
  if (player.role !== 'defenses') return { kind: 'role', label: 'Needs Defenses', description: 'Switch to Defenses to upgrade a selected tower.' };
  if (state.tier < tier) return { kind: 'tier', tier, label: `Needs Tier ${tier}`, description: `Unlock team Tier ${tier} before buying this tower upgrade.` };
  const tower = state.buildings.find(building => building.id === id && building.kind === 'tower' && !building.enemy && building.hp > 0);
  if (!tower) return { kind: 'selection', label: 'Select one tower', description: 'Select a single friendly tower on the map. This purchase upgrades only that tower.' };
  if (tower.tier >= tier) return { kind: 'limit', label: tower.tier === 3 ? 'Max tier' : `Already T${tier}`, description: `The selected tower is already T${tower.tier}.` };
  if (tower.tier !== tier - 1) return { kind: 'tier', label: 'Upgrade to T2 first', description: 'Upgrade this tower to T2 before purchasing T3.' };
  if (tower.progress !== 1) return { kind: 'construction', label: 'Finish building', description: 'Wait for a builder to finish this tower before upgrading it.' };
  const footprint = buildingFootprint(state, { ...tower, tier });
  if (footprintCorners(footprint).some(corner => !validPoint(corner) || corner.y < 130)
    || state.buildings.some(building => building.id !== id && building.hp > 0 && footprintsOverlap(footprint, buildingFootprint(state, building)))
    || state.nodes.some(node => nodeOverlapsFootprint(node, footprint))) {
    return { kind: 'space', label: 'Needs more space', description: 'The upgraded tower is larger. Leave room around buildings, resource nodes and map edges.' };
  }
  const cost = TOWER_UPGRADE_COSTS[tier];
  if (state.resources < cost) return { kind: 'supplies', label: `${Math.ceil(cost - state.resources)} supplies short`, description: `Need ${cost} shared supplies to upgrade this tower.` };
  return null;
}

export function placementProblem(
  state: ActionWorld & Pick<StrongholdState, 'buildings'>,
  player: TaskPlayer, kind: Extract<BuildingKind, 'relay' | 'barracks' | 'tower' | 'wall'>, point: Point, rotation = 0, excludeBuildingId?: number
): string | null {
  if (kind === 'tower' && player.constructionTier !== 1) return 'Build a T1 tower, then purchase its T2 and T3 upgrades.';
  if (!validPoint(point)) return 'Choose a location inside the battlefield.';
  if (!Number.isFinite(rotation) || rotation < 0 || rotation >= 360 || rotation % WALL_ROTATION_STEP !== 0) return 'Choose one of the 16 wall angles, 22.5 degrees apart.';
  const footprint = buildingFootprint(state, { ...point, kind, rotation, tier: player.constructionTier, enemy: false });
  if (footprintCorners(footprint).some(corner => !validPoint(corner) || corner.y < 130)) return `Keep the entire ${kind} inside the construction area.`;
  if (!inVision(visionSources(state), point)) return 'Explore this location with a unit before building here.';
  const blockers = placementBlockers(state, player, kind, point, rotation);
  if (kind !== 'relay' && (player.action !== kind || player.work < taskWork(player))) return 'Complete the construction work first.';
  const problem = actionProblem(state, player, kind);
  if (problem) return problem;
  const construction = constructionBlocker(state, kind);
  if (construction) return construction.description;
  if (blockers.buildings.some(id => id !== excludeBuildingId)) return 'Leave space between buildings.';
  if (blockers.nodes.length) return 'Do not build over resource nodes.';
  if (point.y < 130) return 'The enemy stronghold cannot be used as a construction site.';
  return null;
}
export function placementBlockers(state: ActionWorld, player: Pick<Participant, 'constructionTier'>,
  kind: Extract<BuildingKind, 'relay' | 'barracks' | 'tower' | 'wall'>, point: Point, rotation = 0): { buildings: number[]; units: number[]; nodes: number[] } {
  const footprint = buildingFootprint(state, { ...point, kind, rotation, tier: player.constructionTier, enemy: false });
  return {
    buildings: state.buildings.filter(building => building.hp > 0
      && footprintsOverlap(footprint, buildingFootprint(state, building))).map(building => building.id),
    nodes: state.nodes.filter(node => nodeOverlapsFootprint(node, footprint)).map(node => node.id),
    units: []
  };
}

function performAction(state: StrongholdState, player: Participant, action: Action, upgrade = player.upgradeTarget): void {
  if (action === 'resources') {
    creditResources(state, typingSupplyBase(state));
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
      state.players.forEach(other => { other.ready = false; restoreRoleTask(state, other, other); assignPhrase(state, other); });
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
      state.message = actionProblem(state, player, action) ?? constructionBlocker(state, action)?.description
        ?? 'Choose a location on the battlefield; builders will construct it.';
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
    const cost = TIER_COSTS[state.tier];
    if (cost === undefined) throw new Error('No further tier challenge is available.');
    if (command.ready && state.resources < cost) throw new Error(`Need ${cost} shared supplies to tier up.`);
    player.ready = command.ready;
    if (!player.simulated) state.players.filter(other => other.simulated).forEach(other => { other.ready = command.ready; });
    playerEvent(state, player, command.ready ? 'is ready' : 'cancelled ready');
    if (state.players.every(other => other.ready)) {
      state.resources -= cost;
      state.phase = 'tier-up';
      state.message = 'Complete phrases together to fill the shared progress bar. Anyone can contribute; the battlefield is paused.';
      recordEvent(state, 'Tier challenge started');
      state.players.forEach(other => { other.contribution = 0; assignPhrase(state, other); });
    }
    return;
  }
  if (state.phase !== 'playing') throw new Error('Battlefield orders are paused during tier-up.');
  if (command.type === 'UPGRADE_TOWER') {
    if (!Number.isInteger(command.id) || (command.tier !== 2 && command.tier !== 3)) throw new Error('Choose a tower and upgrade tier 2 or 3.');
    const problem = towerUpgradeBlocker(state, player, command.id, command.tier);
    if (problem) throw new Error(problem.description);
    const tower = state.buildings.find(building => building.id === command.id);
    if (!tower) throw new Error('The selected tower is no longer available.');
    const maxHp = towerHealth(command.tier);
    state.resources -= TOWER_UPGRADE_COSTS[command.tier];
    tower.hp += maxHp - tower.maxHp;
    tower.maxHp = maxHp;
    tower.tier = command.tier;
    state.message = '';
    playerEvent(state, player, `upgraded Tower to T${tower.tier}`);
    return;
  }
  if (command.type === 'ROTATE_WALL') {
    const wall = state.buildings.find(building => building.id === command.id && building.kind === 'wall' && !building.enemy && building.hp > 0);
    if (!wall) throw new Error('Choose a friendly wall.');
    const direction = command.direction ?? 1;
    if (direction !== 1 && direction !== -1) throw new Error('Choose a valid rotation direction.');
    const rotation = ((wall.rotation ?? 0) + direction * WALL_ROTATION_STEP + 360) % 360;
    // Validate geometry without spending or requiring another completed construction task.
    const problem = placementProblem(state,
      { ...player, role: 'defenses', action: 'wall', work: taskWork({ ...player, action: 'wall' }) }, 'wall', wall, rotation, wall.id);
    if (problem) throw new Error(problem);
    wall.rotation = rotation;
    playerEvent(state, player, 'rotated Wall');
    return;
  }
  if (command.type === 'ACTION') {
    if (!ROLE_ACTIONS[player.role].includes(command.action)) throw new Error('This action belongs to another role.');
    const tier = command.tier ?? (command.action === 'tower' ? 1 : Math.max(1, state.tier));
    if (!Number.isInteger(tier) || tier < 1 || tier > 3) throw new Error('Choose building tier 1, 2 or 3.');
    if (command.action === 'tower' && tier !== 1) throw new Error('Build a T1 tower, then purchase its T2 and T3 upgrades.');
    const upgrade = command.upgrade ?? (player.role === 'production' ? 'warrior' : 'economy');
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
    if (buildings.some(building => building && !supportsRally(building))) throw new Error('Only castles and barracks have rally points.');
    for (const building of buildings) if (building) building.rally = { ...command.point };
    playerEvent(state, player, 'set building Rally points');
    return;
  }
  if (command.type === 'RALLY' && player.role !== 'army') throw new Error('Switch to Unit Control to set the shared rally.');
  if (!validPoint(command.point)) throw new Error('Choose a location inside the battlefield.');
  if (command.type === 'RALLY') {
    state.rally = { ...command.point };
    for (const building of state.buildings) if (!building.enemy && building.hp > 0 && supportsRally(building)) building.rally = { ...command.point };
    playerEvent(state, player, 'set Rally point');
    return;
  }
  for (const id of command.ids) {
    const unit = state.units.find(candidate => candidate.id === id);
    if (!unit || unit.hp <= 0 || unit.kind === 'invader') throw new Error('Select only friendly units.');
  }
  const selected = new Set(command.ids);
  const project = command.buildingId === undefined ? undefined
    : state.buildings.find(building => building.id === command.buildingId && !building.enemy && building.hp > 0
      && (building.progress < 1 || building.hp < building.maxHp));
  if (command.buildingId !== undefined && !project) throw new Error('Choose an unfinished or damaged friendly building.');
  const builder = project ? state.units.filter(unit => selected.has(unit.id) && unit.kind === 'builder')
    .sort((a, b) => distance(a, project) - distance(b, project) || a.id - b.id)[0] : undefined;
  if (project && !builder) throw new Error('Select a builder first.');
  if (project && builder) for (const unit of state.units) {
    if (unit.kind === 'builder' && unit.task === project.id) unit.task = null;
  }
  for (const unit of state.units) if (selected.has(unit.id)) {
    if (unit === builder && project) {
      unit.destination = null; unit.manualMove = false; unit.task = project.id;
      unit.idleTime = null; unit.cooldown = 0; unit.attackTarget = null;
      continue;
    }
    unit.destination = { ...command.point };
    unit.manualMove = true;
    unit.attackTarget = null;
    if (unit.kind === 'worker' || unit.kind === 'builder') {
      unit.task = null;
      unit.idleTime = 0;
      unit.attackTarget = null;
    }
  }
}
