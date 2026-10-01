import { assignPhrase, copyRoleTask, synchronizeRoleTask } from './phrases.ts';
import { addBuilding, addUnit } from './state.ts';
import { ACTION_LABELS, BASE, BUILDING_CAPS, distance, MIN_TIER, ROLE_ACTIONS, TIER_MAX, TIER_QUOTA, UNIT_CAPS, validPoint } from './rules.ts';
import { applyUpgrade, taskCost, taskPhrases, upgradeLimit, UPGRADE_OPTIONS } from './technology.ts';
import type { Action, Participant, StrongholdCommand, StrongholdState } from './types.ts';

export function actionProblem(state: StrongholdState, player: Participant, action: Action): string | null {
  if (!ROLE_ACTIONS[player.role].includes(action)) return 'This action belongs to another role.';
  if (state.tier < MIN_TIER[action]) return `Requires tier ${MIN_TIER[action]}. Ready up to advance together.`;
  if ((action === 'tower' || action === 'barracks') && state.tier < player.constructionTier) return `Requires tier ${player.constructionTier}.`;
  if (state.resources < taskCost({ ...player, action })) return `Need ${taskCost({ ...player, action })} shared supplies.`;
  if (action === 'upgrade') {
    if (player.role === 'army') return 'Army control does not have typing upgrades.';
    if (UPGRADE_OPTIONS[player.upgradeTarget].role !== player.role) return 'This upgrade belongs to another role.';
    if (state.technology[player.upgradeTarget] >= upgradeLimit(state.tier, player.upgradeTarget)) return 'Upgrade limit reached for this tier.';
  }
  if (action === 'worker' || action === 'builder' || action === 'warrior' || action === 'archer' || action === 'catapult') {
    if (state.units.filter(unit => unit.kind === action).length >= UNIT_CAPS[action]) return `${ACTION_LABELS[action]} population limit reached.`;
  }
  return null;
}

export function completePhrase(state: StrongholdState, player: Participant): void {
  player.completed++;
  if (state.phase === 'tier-up') {
    player.contribution++;
    if (state.players.every(other => other.contribution >= TIER_QUOTA)) {
      state.tier++;
      state.phase = 'playing';
      state.message = `Tier ${state.tier} unlocked! New units, defenses and upgrades are available.`;
      state.players.forEach(other => { other.ready = false; other.actionPhrases = 0; assignPhrase(state, other); });
      return;
    }
    if (player.contribution >= TIER_QUOTA) return;
  } else {
    const problem = actionProblem(state, player, player.action);
    if (problem) { player.actionPhrases = 0; assignPhrase(state, player); state.message = problem; return; }
    player.actionPhrases++;
    if (player.actionPhrases < taskPhrases(player)) {
      state.message = `${player.name}: ${player.actionPhrases}/${taskPhrases(player)} construction or training phrases completed.`;
      assignPhrase(state, player);
      return;
    }
    if (player.action === 'relay' || player.action === 'barracks' || player.action === 'tower' || player.action === 'wall') {
      synchronizeRoleTask(state, player);
      state.message = 'Choose a location on the battlefield; builders will construct it.';
      return;
    }
    state.resources -= taskCost(player);
    if (player.action === 'resources') state.resources += 18 + state.upgrades.economy * 6;
    else if (player.action === 'upgrade') applyUpgrade(state, player);
    else if (player.action === 'worker' || player.action === 'builder'
      || player.action === 'warrior' || player.action === 'archer' || player.action === 'catapult') {
      const unit = addUnit(state, player.action, { x: BASE.x + (state.nextId % 5 - 2) * 16, y: BASE.y - 40 });
      if (player.role === 'production') unit.destination = { ...state.rally };
    }
    state.message = `${player.name}: ${ACTION_LABELS[player.action]} completed.`;
    player.actionPhrases = 0;
  }
  assignPhrase(state, player);
}

export function executeCommand(state: StrongholdState, player: Participant, command: StrongholdCommand): void {
  if (state.phase === 'won' || state.phase === 'lost') throw new Error('This match is over. Start a new stronghold.');
  if (command.type === 'ROLE') {
    if (state.phase !== 'playing') throw new Error('Finish the shared tier challenge before switching roles.');
    if (!Object.prototype.hasOwnProperty.call(ROLE_ACTIONS, command.role)) throw new Error('Unknown role.');
    if (player.role === command.role) return;
    const partner = state.players.find(other => other.role === command.role);
    player.role = command.role;
    player.ready = false;
    if (partner) copyRoleTask(partner, player, true);
    else {
      player.action = ROLE_ACTIONS[player.role][0] ?? 'resources';
      player.actionPhrases = 0;
      player.constructionTier = Math.max(1, state.tier);
      player.upgradeTarget = player.role === 'production' ? 'warrior' : player.role === 'defenses' ? 'tower-1' : 'economy';
      assignPhrase(state, player);
    }
    return;
  }
  if (command.type === 'TYPE') {
    if (command.phraseId !== player.phraseId) throw new Error('That phrase has expired.');
    if (typeof command.text !== 'string' || command.text.length > player.phrase.length) throw new Error('Invalid typing update.');
    if (state.phase === 'playing' && player.role === 'army') throw new Error('Army control uses map orders, not typing.');
    if (state.phase === 'tier-up' && player.contribution >= TIER_QUOTA) return;
    if (state.phase === 'playing' && ['relay', 'barracks', 'tower', 'wall'].includes(player.action) && player.actionPhrases >= taskPhrases(player)) {
      if (command.text !== player.typed) throw new Error('Place this building or select another task before typing again.');
      return;
    }
    player.typed = command.text;
    if (player.typed === player.phrase) completePhrase(state, player);
    else synchronizeRoleTask(state, player);
    return;
  }
  if (command.type === 'READY') {
    if (state.phase !== 'playing' || state.tier >= TIER_MAX) throw new Error('Tier-up is not available right now.');
    player.ready = command.ready;
    if (state.players.every(other => other.ready)) {
      state.phase = 'tier-up';
      state.message = 'All players locked in. Complete three phrases each to advance. The battlefield is paused.';
      state.players.forEach(other => { other.contribution = 0; other.actionPhrases = 0; assignPhrase(state, other); });
    }
    return;
  }
  if (state.phase !== 'playing') throw new Error('Battlefield orders are paused during tier-up.');
  if (command.type === 'ACTION') {
    if (!ROLE_ACTIONS[player.role].includes(command.action)) throw new Error('This action belongs to another role.');
    const tier = command.tier ?? Math.max(1, state.tier);
    if (!Number.isInteger(tier) || tier < 1 || tier > 3) throw new Error('Choose building tier 1, 2 or 3.');
    const upgrade = command.upgrade ?? (player.role === 'production' ? 'warrior' : player.role === 'defenses' ? 'tower-1' : 'economy');
    if (!Object.prototype.hasOwnProperty.call(UPGRADE_OPTIONS, upgrade) || UPGRADE_OPTIONS[upgrade].role !== player.role) throw new Error('This upgrade belongs to another role.');
    player.action = command.action;
    player.constructionTier = tier;
    player.upgradeTarget = upgrade;
    player.actionPhrases = 0;
    assignPhrase(state, player);
    return;
  }
  if (command.type === 'PLACE') {
    if (!validPoint(command.point)) throw new Error('Choose a location inside the battlefield.');
    if (player.action !== command.kind || player.typed !== player.phrase || player.actionPhrases < taskPhrases(player)) throw new Error('Complete the construction phrase first.');
    const problem = actionProblem(state, player, command.kind);
    if (problem) throw new Error(problem);
    if (!state.units.some(unit => unit.kind === 'builder')) throw new Error('Recruit a builder in Defenses first.');
    if (state.buildings.filter(building => building.kind === command.kind && !building.enemy).length >= BUILDING_CAPS[command.kind]) throw new Error('Building limit reached.');
    if (state.buildings.some(building => distance(command.point, building) < 38)) throw new Error('Leave space between buildings.');
    if (command.point.y < 130) throw new Error('The enemy stronghold cannot be used as a construction site.');
    state.resources -= taskCost(player);
    addBuilding(state, command.kind, command.point, false, false, player.constructionTier);
    player.actionPhrases = 0;
    assignPhrase(state, player);
    return;
  }
  if (player.role !== 'army') throw new Error('Switch to Army control to issue orders.');
  if (!validPoint(command.point)) throw new Error('Choose a location inside the battlefield.');
  if (command.type === 'RALLY') {
    state.rally = { ...command.point };
    return;
  }
  if (command.ids.length > 36) throw new Error('Too many units selected.');
  for (const id of command.ids) {
    const unit = state.units.find(candidate => candidate.id === id);
    if (!unit || !['warrior', 'archer', 'catapult'].includes(unit.kind)) throw new Error('Select only friendly army units.');
  }
  for (const unit of state.units) if (command.ids.includes(unit.id)) unit.destination = { ...command.point };
}
