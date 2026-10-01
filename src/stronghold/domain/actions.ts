import { assignPhrase, copyRoleTask, synchronizeRoleTask } from './phrases.ts';
import { addBuilding, addUnit } from './state.ts';
import { ACTION_LABELS, BASE, BUILDING_CAPS, distance, LENGTH_LABELS, MIN_TIER, PHRASE_WORK, ROLE_ACTIONS, ROLE_LABELS, TIER_MAX, TIER_QUOTA, UNIT_CAPS, validPoint } from './rules.ts';
import { applyUpgrade, taskCost, taskWork, upgradeLimit, UPGRADE_OPTIONS } from './technology.ts';
import { ENTITY_LABELS, playerEvent, recordEvent } from './events.ts';
import { PHRASE_LENGTHS, type Action, type BuildingKind, type Participant, type Point, type StrongholdCommand, type StrongholdState } from './types.ts';
import { restoreRoleTask, saveRoleTask, taskKey } from './tasks.ts';

type ActionWorld = Pick<StrongholdState, 'tier' | 'resources' | 'units' | 'technology'>;
type TaskPlayer = Pick<Participant, 'role' | 'action' | 'constructionTier' | 'upgradeTarget' | 'work'>;
export function actionProblem(state: ActionWorld, player: TaskPlayer, action: Action): string | null {
  if (!ROLE_ACTIONS[player.role].includes(action)) return 'This action belongs to another role.';
  if (state.tier < MIN_TIER[action]) return `Requires tier ${MIN_TIER[action]}. Ready up to advance together.`;
  if ((action === 'tower' || action === 'barracks') && state.tier < player.constructionTier) return `Requires tier ${player.constructionTier}.`;
  if (state.resources < taskCost({ ...player, action })) return `Need ${taskCost({ ...player, action })} shared supplies.`;
  if (action === 'upgrade') {
    if (player.role === 'army') return 'Unit Control does not have typing upgrades.';
    if (UPGRADE_OPTIONS[player.upgradeTarget].role !== player.role) return 'This upgrade belongs to another role.';
    if (state.technology[player.upgradeTarget] >= upgradeLimit(state.tier, player.upgradeTarget)) return 'Upgrade limit reached for this tier.';
  }
  if (action === 'worker' || action === 'builder' || action === 'warrior' || action === 'archer' || action === 'catapult') {
    if (state.units.filter(unit => unit.kind === action).length >= UNIT_CAPS[action]) return `${ACTION_LABELS[action]} population limit reached.`;
  }
  return null;
}

export function placementProblem(
  state: ActionWorld & Pick<StrongholdState, 'buildings'>,
  player: TaskPlayer, kind: Extract<BuildingKind, 'relay' | 'barracks' | 'tower' | 'wall'>, point: Point
): string | null {
  if (!validPoint(point)) return 'Choose a location inside the battlefield.';
  if (kind !== 'relay' && (player.action !== kind || player.work < taskWork(player))) return 'Complete the construction work first.';
  const problem = actionProblem(state, player, kind);
  if (problem) return problem;
  if (!state.units.some(unit => unit.kind === 'builder' && unit.hp > 0)) return 'Recruit a builder in Defenses first.';
  if (state.buildings.filter(building => building.kind === kind && !building.enemy && building.hp > 0).length >= BUILDING_CAPS[kind]) return 'Building limit reached.';
  if (state.buildings.some(building => building.hp > 0 && distance(point, building) < 38)) return 'Leave space between buildings.';
  if (point.y < 130) return 'The enemy stronghold cannot be used as a construction site.';
  return null;
}

export function completePhrase(state: StrongholdState, player: Participant): void {
  player.completed++;
  if (state.phase === 'tier-up') {
    if (player.contribution >= TIER_QUOTA) { assignPhrase(state, player); return; }
    player.contribution++;
    if (state.players.every(other => other.contribution >= TIER_QUOTA)) {
      state.tier++;
      state.phase = 'playing';
      state.message = `Tier ${state.tier} unlocked! New units, defenses and upgrades are available.`;
      recordEvent(state, `Tier ${state.tier} unlocked`);
      state.players.forEach(other => { other.ready = false; restoreRoleTask(state, other); assignPhrase(state, other); });
      return;
    }
  } else {
    const action = player.action === 'relay' ? 'resources' : player.action;
    const problem = actionProblem(state, player, action);
    if (problem) { assignPhrase(state, player); state.message = problem; return; }
    if (player.work >= taskWork(player)) { assignPhrase(state, player); return; }
    player.actionPhrases++;
    player.work = Math.min(taskWork(player), player.work + PHRASE_WORK[player.length]);
    if (player.work < taskWork(player)) {
      assignPhrase(state, player);
      return;
    }
    if (action === 'barracks' || action === 'tower' || action === 'wall') {
      state.message = 'Choose a location on the battlefield; builders will construct it.';
      assignPhrase(state, player);
      return;
    }
    state.resources -= taskCost({ ...player, action });
    state.message = '';
    if (action === 'resources') {
      state.resources += 18 + state.upgrades.economy * 6;
      playerEvent(state, player, 'gathered Supplies');
    } else if (action === 'upgrade') {
      applyUpgrade(state, player);
      playerEvent(state, player, `upgraded ${UPGRADE_OPTIONS[player.upgradeTarget].label}`);
    } else if (action === 'worker' || action === 'builder'
      || action === 'warrior' || action === 'archer' || action === 'catapult') {
      const unit = addUnit(state, action, { x: BASE.x + (state.nextId % 5 - 2) * 16, y: BASE.y - 40 });
      if (player.role === 'production') unit.destination = { ...state.rally };
      playerEvent(state, player, `created ${ENTITY_LABELS[action]}`);
    }
    player.actionPhrases = 0;
    player.work = 0;
  }
  assignPhrase(state, player);
}

export function executeCommand(state: StrongholdState, player: Participant, command: StrongholdCommand): void {
  if (state.phase === 'won' || state.phase === 'lost') throw new Error('This match is over. Start a new stronghold.');
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
    if (partner) copyRoleTask(partner, player, true);
    else {
      restoreRoleTask(state, player);
      assignPhrase(state, player);
    }
    return;
  }
  if (command.type === 'LENGTH') {
    if (!PHRASE_LENGTHS.includes(command.length)) throw new Error('Unknown phrase length.');
    player.length = command.length;
    state.roleTasks[player.role].length = command.length;
    assignPhrase(state, player);
    playerEvent(state, player, `selected ${LENGTH_LABELS[player.length]} text`);
    return;
  }
  if (command.type === 'TYPE') {
    if (command.phraseId !== player.phraseId) throw new Error('That phrase has expired.');
    if (typeof command.text !== 'string' || command.text.length > player.phrase.length) throw new Error('Invalid typing update.');
    player.typed = command.text;
    if (player.typed === player.phrase) completePhrase(state, player);
    else synchronizeRoleTask(state, player);
    return;
  }
  if (command.type === 'READY') {
    if (state.phase !== 'playing' || state.tier >= TIER_MAX) throw new Error('Tier-up is not available right now.');
    player.ready = command.ready;
    playerEvent(state, player, command.ready ? 'is ready' : 'cancelled ready');
    if (state.players.every(other => other.ready)) {
      state.phase = 'tier-up';
      state.message = 'All players locked in. Complete three phrases each to advance. The battlefield is paused.';
      recordEvent(state, 'Tier challenge started');
      state.players.forEach(other => { other.contribution = 0; assignPhrase(state, other); });
    }
    return;
  }
  if (state.phase !== 'playing') throw new Error('Battlefield orders are paused during tier-up.');
  if (command.type === 'ACTION') {
    if (!ROLE_ACTIONS[player.role].includes(command.action)) throw new Error('This action belongs to another role.');
    const tier = command.tier ?? Math.max(1, state.tier);
    if (!Number.isInteger(tier) || tier < 1 || tier > 3) throw new Error('Choose building tier 1, 2 or 3.');
    const upgrade = command.upgrade ?? (player.role === 'production' ? 'warrior' : player.role === 'defenses' ? 'tower-1' : 'economy');
    if (!Object.prototype.hasOwnProperty.call(UPGRADE_OPTIONS, upgrade)
      || ((command.action === 'upgrade' || command.upgrade !== undefined) && UPGRADE_OPTIONS[upgrade].role !== player.role)) throw new Error('This upgrade belongs to another role.');
    const selection = { action: command.action, constructionTier: tier, upgradeTarget: upgrade };
    if (player.action === command.action && taskKey(player) === taskKey(selection)) return;
    saveRoleTask(state, player);
    restoreRoleTask(state, player, selection);
    assignPhrase(state, player);
    return;
  }
  if (command.type === 'PLACE') {
    const problem = placementProblem(state, player, command.kind, command.point);
    if (problem) throw new Error(problem);
    state.resources -= taskCost({ ...player, action: command.kind });
    const building = addBuilding(state, command.kind, command.point, false, false, player.constructionTier);
    building.ownerId = player.id;
    state.message = '';
    playerEvent(state, player, `placed ${ENTITY_LABELS[command.kind]}`);
    if (command.kind !== 'relay') {
      player.actionPhrases = 0;
      player.work = 0;
      assignPhrase(state, player);
    }
    return;
  }
  if (player.role !== 'army') throw new Error('Switch to Unit Control to issue orders.');
  if (!validPoint(command.point)) throw new Error('Choose a location inside the battlefield.');
  if (command.type === 'RALLY') {
    state.rally = { ...command.point };
    playerEvent(state, player, 'set Rally point');
    return;
  }
  if (command.ids.length > 36) throw new Error('Too many units selected.');
  for (const id of command.ids) {
    const unit = state.units.find(candidate => candidate.id === id);
    if (!unit || !['warrior', 'archer', 'catapult'].includes(unit.kind)) throw new Error('Select only friendly army units.');
  }
  for (const unit of state.units) if (command.ids.includes(unit.id)) unit.destination = { ...command.point };
  if (command.ids.length > 0) playerEvent(state, player, 'ordered Army');
}
