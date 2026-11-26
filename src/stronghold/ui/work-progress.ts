import type { Participant } from '../domain/types.ts';

export function workProgress(work: number, required: number) {
  const percent = Math.min(100, Math.max(0, work / required * 100));
  return {
    percent,
    label: percent === 100 ? 'Ready' : `${Math.round(percent)}%`,
    description: `${Math.round(percent)}% complete`
  };
}

export function taskProgress(player: Pick<Participant, 'action' | 'constructionTier' | 'work'>, required: number, supplies: number) {
  const progress = workProgress(player.work, required);
  const supplyTask = player.action === 'resources' || player.action === 'relay';
  const construction = player.action === 'tower' || player.action === 'barracks' || player.action === 'wall';
  const targets: Record<Participant['action'], string> = {
    resources: 'supplies', relay: 'supplies', worker: 'gatherer', builder: 'builder',
    tower: `T${player.constructionTier} tower`, barracks: `T${player.constructionTier} barracks`,
    wall: 'wall', warrior: 'warrior', archer: 'archer', catapult: 'catapult', upgrade: 'upgrade'
  };
  const target = targets[player.action];
  const output = supplyTask ? `+${supplies} team supplies` : construction ? target : `+1 ${target}`;
  const result = supplyTask ? `Each full bar adds ${supplies} shared supplies to the team.`
    : construction ? `A full bar prepares one ${target} for the team. Click the map to place it; a builder finishes construction.`
    : `Each full bar recruits one ${target} for the team.`;
  return {
    ...progress,
    label: `${Math.round(progress.percent)}%`,
    output,
    description: `${progress.description}. Complete correct phrases to fill this bar. ${result}`
  };
}

export function taskButtonPresentation(task: Pick<Participant, 'action'>, name: string, supplies: number, ready = false) {
  if (task.action === 'resources') return {
    label: `+${supplies} Supplies`,
    description: `Each full typing bar adds ${supplies} shared supplies to the team.`
  };
  if (task.action === 'tower' || task.action === 'barracks' || task.action === 'wall') return {
    label: ready ? `Place ${name}` : `+1 ${name}`,
    description: ready ? 'Ready to place. Select this task, then click the map; a builder finishes construction.'
      : 'Fill the typing bar, then click the map to place one building. A builder finishes construction.'
  };
  if (task.action === 'worker' || task.action === 'builder') return {
    label: `+1 ${name}`,
    description: 'Each full typing bar recruits one unit for the team, without spending supplies.'
  };
  if (task.action === 'warrior' || task.action === 'archer' || task.action === 'catapult') return {
    label: `+1 ${name}`,
    description: 'Purchase one training order at a matching completed barracks. No typing required.'
  };
  if (task.action === 'relay') return {
    label: 'Place Relay',
    description: 'Select this button, then click the map to place a relay. No typing required.'
  };
  return { label: name, description: 'Purchase a team-wide upgrade. No typing required.' };
}
