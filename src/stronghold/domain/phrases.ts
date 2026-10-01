import type { Participant, PhraseLength, StrongholdState } from './types.ts';
import { saveRoleTask } from './tasks.ts';

const SCRIPTURE: Record<PhraseLength, readonly string[]> = {
  short: ['God', 'love', 'hope', 'pray', 'joy', 'walk'],
  medium: ['faithfulness', 'steadfastness', 'righteousness', 'understanding'],
  long: ['Walk by faith.', 'Love one another.', 'Stand in hope.', 'Rejoice in truth.'],
  'extra-long': ['Be still and know that I am God.', 'Let all things be done with love.',
    'Trust in the Lord with all your heart.', 'Be strong and courageous in all you do.']
};
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
  target.work = source.work;
  target.length = source.length;
  target.phrase = source.phrase;
  target.typed = source.typed;
  if (newPhrase) { target.phraseId++; target.typingCredit = 0; }
}

export function synchronizeRoleTask(state: StrongholdState, player: Participant, newPhrase = false): void {
  if (state.phase !== 'playing') return;
  saveRoleTask(state, player);
  for (const other of state.players) {
    if (other !== player && other.role === player.role) copyRoleTask(player, other, newPhrase);
  }
}

export function assignPhrase(state: StrongholdState, player: Participant): void {
  player.phraseId++;
  player.typed = '';
  player.typingCredit = 0;
  const phrases = state.phase === 'tier-up' || state.event === 'peace'
    ? SCRIPTURE[player.length]
    : DRILLS[state.event];
  const phrase = phrases[(player.phraseId + state.players.indexOf(player)) % phrases.length] ?? '';
  player.phrase = state.phase === 'tier-up' || state.event === 'peace' || player.length === 'extra-long' ? phrase
    : player.length === 'short' ? phrase.split(' ')[0]?.slice(0, 4) ?? phrase
    : player.length === 'medium' ? phrase.replace(/ /g, '') : phrase;
  synchronizeRoleTask(state, player, true);
}
