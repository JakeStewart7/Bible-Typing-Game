import type { Participant, PhraseLength, StrongholdState } from './types.ts';
import { saveRoleTask } from './tasks.ts';

const WORDS: Record<PhraseLength, readonly string[]> = {
  short: ['tree', 'bird', 'hope', 'path', 'warm', 'kind'],
  medium: ['sunshine', 'kindness', 'mountain', 'together', 'we stand', 'a garden'],
  long: ['gentle river', 'quiet meadow', 'silver cloud', 'little robin', 'appreciation'],
  'extra-long': ['beautiful garden', 'morning sunlight', 'peaceful village', 'distant mountain', 'misunderstanding']
};

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
  const phrases = WORDS[player.length];
  player.phrase = phrases[(player.phraseId + state.players.indexOf(player)) % phrases.length] ?? '';
  synchronizeRoleTask(state, player, true);
}
