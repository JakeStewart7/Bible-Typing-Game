import type { Participant, PhraseLength, StrongholdState } from './types.ts';
import { saveRoleTask } from './tasks.ts';

const WORDS: Record<PhraseLength, readonly string[]> = {
  short: ['tree', 'bird', 'hope', 'path', 'warm', 'kind'],
  medium: ['sunshine', 'kindness', 'mountain', 'together', 'we stand', 'a garden'],
  long: ['gentle river', 'quiet meadow', 'silver cloud', 'little robin', 'appreciation'],
  'extra-long': ['beautiful garden', 'morning sunlight', 'peaceful village', 'distant mountain', 'misunderstanding']
};

export function copyRoleTask(source: Participant, target: Participant): void {
  target.action = source.action;
  target.constructionTier = source.constructionTier;
  target.upgradeTarget = source.upgradeTarget;
  target.actionPhrases = source.actionPhrases;
  target.work = source.work;
}

export function synchronizeRoleTask(state: StrongholdState, player: Participant): void {
  if (state.phase !== 'playing') return;
  saveRoleTask(state, player);
  for (const other of state.players) {
    if (other !== player && other.role === player.role) copyRoleTask(player, other);
  }
}

export function assignPhrase(state: StrongholdState, player: Participant): void {
  player.phraseId++;
  player.typed = '';
  player.typingCredit = 0;
  const phrases = WORDS[player.length];
  const start = (player.phraseId + state.players.indexOf(player)) % phrases.length;
  const candidates = [...phrases.slice(start), ...phrases.slice(0, start)];
  const phrase = candidates.find(phrase => state.players.every(other => other === player || other.phrase !== phrase));
  if (!phrase) throw new Error('No unique Stronghold phrase is available.');
  player.phrase = phrase;
  synchronizeRoleTask(state, player);
}
