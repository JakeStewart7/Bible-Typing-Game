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
    label: construction && progress.percent === 100 ? `Place ${target}` : `${progress.label} / ${output}`,
    description: `${progress.description}. Complete correct phrases to fill this bar. ${result}`
  };
}
