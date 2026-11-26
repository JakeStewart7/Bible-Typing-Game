import type { Participant } from '../domain/types.ts';

export function taskHelpers(players: readonly Pick<Participant, 'id' | 'name' | 'color' | 'role' | 'action' | 'constructionTier' | 'upgradeTarget'>[], ownerId: string, role: Participant['role'],
  task: Pick<Participant, 'action' | 'constructionTier' | 'upgradeTarget'>) {
  return players.filter(player => player.id !== ownerId && player.role === role && player.action === task.action
    && (!(task.action === 'tower' || task.action === 'barracks') || player.constructionTier === task.constructionTier)
    && (task.action !== 'upgrade' || player.upgradeTarget === task.upgradeTarget));
}
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
    description: `${progress.description}. ${result}`
  };
}

export function taskButtonPresentation(task: Pick<Participant, 'action' | 'constructionTier' | 'upgradeTarget'>, name: string, supplies: number, ready = false) {
  if (task.action === 'resources') return {
    label: `+${supplies} Supplies`,
    description: `Each full typing bar adds ${supplies} shared supplies. Used for troops, relays and upgrades.`
  };
  if (task.action === 'tower' || task.action === 'barracks' || task.action === 'wall') return {
    label: ready ? `Place ${name}` : `+1 ${name}`,
    description: `${task.action === 'tower' ? 'Automatically fires at enemies. Select a completed tower to upgrade it.'
      : task.action === 'wall' ? 'Blocks enemy movement and protects your base. Scroll to rotate during placement.'
      : `Trains ${task.constructionTier === 1 ? 'Warriors' : task.constructionTier === 2 ? 'Archers' : 'Catapults'}.`} ${ready
      ? 'Ready to place. Builders finish construction.'
      : 'Type, then place. Builders finish construction.'}`
  };
  if (task.action === 'worker' || task.action === 'builder') return {
    label: `+1 ${name}`,
    description: `${task.action === 'worker' ? 'Automatically collects supplies and delivers them to a castle or relay.'
      : 'Automatically constructs and repairs buildings.'} Type to recruit one.`
  };
  if (task.action === 'warrior' || task.action === 'archer' || task.action === 'catapult') return {
    label: `+1 ${name}`,
    description: `${task.action === 'warrior' ? 'Melee troop for close-range combat.'
      : task.action === 'archer' ? 'Ranged troop that attacks from a distance.'
      : 'Slow siege unit. Deals extra damage to buildings; weaker against troops.'} Buy one training order at T${task.action === 'warrior' ? 1 : task.action === 'archer' ? 2 : 3} Barracks.`
  };
  if (task.action === 'relay') return {
    label: 'Place Relay',
    description: 'Extends your supply delivery network. Connect it to the castle through nearby relays. Click the map to place it; no typing required.'
  };
  return { label: name, description: task.upgradeTarget === 'economy'
    ? 'Adds 2 base supplies to each gathered pack and 6 to each completed supply bar. Seasonal bonuses still apply.'
    : `Improves all ${task.upgradeTarget === 'warrior' ? 'Warriors' : task.upgradeTarget === 'archer' ? 'Archers' : 'Catapults'}, including future recruits, with more health and attack damage.` };
}
