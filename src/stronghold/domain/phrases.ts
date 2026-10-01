import type { Participant, StrongholdState } from './types.ts';

const SCRIPTURE = [
  ['The Lord is my shepherd.', 'Be still and know that I am God.', 'Walk by faith not by sight.', 'Let all things be done with love.'],
  ['Be strong and courageous.', 'Blessed are the merciful.', 'Rejoice in hope.', 'Continue in prayer.'],
  ['Everlasting righteousness.', 'Abundant lovingkindness.', 'Understanding strengthens.', 'Faithfulness endures.'],
  ['Incorruptible inheritance.', 'Unsearchable understanding.', 'Everlasting consolation.', 'Reconciliation.']
] as const;
const DRILLS = {
  'left-hand': ['We are steadfast.', 'We rest after great feats.', 'Steward a great reward.'],
  vowels: ['aeiou aeiou', 'eaio uoae ieau', 'aeiouAEIOU'],
  numbers: ['12 24 48 96', '144 233 377 610', '1024 2048 4096'],
  symbols: ['[] {} () <>', '!@# $%& *+-', '=> :: && ||'],
  code: ['const faith = true;', 'if (hope) { stand(); }', 'guard.keep("watch");']
} as const;

export function copyRoleTask(source: Participant, target: Participant, newPhrase: boolean): void {
  target.action = source.action;
  target.constructionTier = source.constructionTier;
  target.upgradeTarget = source.upgradeTarget;
  target.actionPhrases = source.actionPhrases;
  target.phrase = source.phrase;
  target.typed = source.typed;
  if (newPhrase) { target.phraseId++; target.typingCredit = 0; }
}

export function synchronizeRoleTask(state: StrongholdState, player: Participant, newPhrase = false): void {
  if (state.phase !== 'playing') return;
  for (const other of state.players) {
    if (other !== player && other.role === player.role) copyRoleTask(player, other, newPhrase);
  }
}

export function assignPhrase(state: StrongholdState, player: Participant): void {
  player.phraseId++;
  player.typed = '';
  player.typingCredit = 0;
  const tier = state.phase === 'tier-up' ? state.tier + 1 : state.tier;
  const phrases = state.phase === 'tier-up' || state.event === 'peace'
    ? SCRIPTURE[Math.min(3, tier)] ?? SCRIPTURE[0]
    : DRILLS[state.event];
  player.phrase = phrases[(player.phraseId + state.players.indexOf(player)) % phrases.length] ?? '';
  synchronizeRoleTask(state, player, true);
}
