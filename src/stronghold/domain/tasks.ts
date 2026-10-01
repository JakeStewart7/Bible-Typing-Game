import type { Participant, RoleTasks, StrongholdState, TaskSelection } from './types.ts';

export function taskKey(task: TaskSelection): string {
  if (task.action === 'barracks' || task.action === 'tower') return `${task.action}:${task.constructionTier}`;
  if (task.action === 'upgrade') return `upgrade:${task.upgradeTarget}`;
  return task.action === 'relay' ? 'resources' : task.action;
}

export function createRoleTasks(selection: TaskSelection): RoleTasks {
  return { selection, length: 'medium', progress: {} };
}

export function saveRoleTask(state: StrongholdState, player: Participant): void {
  const role = state.roleTasks[player.role];
  role.selection = { action: player.action, constructionTier: player.constructionTier, upgradeTarget: player.upgradeTarget };
  role.length = player.length;
  role.progress[taskKey(player)] = { work: player.work, actionPhrases: player.actionPhrases };
}

export function restoreRoleTask(state: StrongholdState, player: Participant, selection = state.roleTasks[player.role].selection): void {
  const role = state.roleTasks[player.role];
  const progress = role.progress[taskKey(selection)];
  player.action = selection.action;
  player.constructionTier = selection.constructionTier;
  player.upgradeTarget = selection.upgradeTarget;
  player.work = progress?.work ?? 0;
  player.actionPhrases = progress?.actionPhrases ?? 0;
  player.length = role.length;
}
