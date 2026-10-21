import type { Participant, PhraseLength, StrongholdState } from './types.ts';
import { TEXT_LENGTH_RANGES } from './rules.ts';
import { saveRoleTask } from './tasks.ts';
import { WORD_POOLS } from './word-pools.ts';
import { EVENT_WORD_POOLS } from './event-phrases.ts';

const bags = new WeakMap<Participant, Map<readonly string[], string[]>>();
function challengePools(suffixes: readonly string[]): Record<PhraseLength, readonly string[]> {
  const pool = (length: PhraseLength) => Object.freeze([...new Set(WORD_POOLS[length].map((phrase, index) => {
    const suffix = suffixes[index % suffixes.length];
    if (!suffix) throw new Error('Missing tier challenge characters.');
    return phrase.slice(0, TEXT_LENGTH_RANGES[length][1] - suffix.length).trimEnd() + suffix;
  }))]);
  return { short: pool('short'), medium: pool('medium'), long: pool('long'), 'extra-long': pool('extra-long') };
}
export const TIER_WORD_POOLS = [
  WORD_POOLS, challengePools(['7', '42', '9', '21', '5', '83']),
  challengePools(['7!', '4?', '2+', '9.', '3:', '6%', '5=', '8-'])
] as const;

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

export function assignPhrase(state: StrongholdState, player: Participant, random = Math.random): void {
  player.phraseId++;
  player.typed = '';
  player.typingCredit = 0;
  player.tierPhraseCredit = 0;
  const challenge = TIER_WORD_POOLS[state.tier];
  if (state.phase === 'tier-up' && !challenge) throw new Error('No further tier challenge is available.');
  const phrases = state.phase === 'tier-up' && challenge ? challenge[player.length]
    : state.event === 'peace' ? WORD_POOLS[player.length] : EVENT_WORD_POOLS[state.event][player.length];
  let playerBags = bags.get(player);
  if (!playerBags) { playerBags = new Map(); bags.set(player, playerBags); }
  let bag = playerBags.get(phrases);
  if (!bag?.length) {
    bag = [...phrases];
    for (let index = bag.length - 1; index > 0; index--) {
      const choice = Math.floor(random() * (index + 1));
      const selected = bag[choice], current = bag[index];
      if (selected === undefined || current === undefined) throw new Error('Invalid phrase shuffle.');
      bag[index] = selected; bag[choice] = current;
    }
    playerBags.set(phrases, bag);
  }
  const available = (phrase: string) => phrase !== player.phrase && state.players.every(other => other === player || other.phrase !== phrase);
  const index = bag.findIndex(available);
  // A teammate can be holding the last entry in our bag; keep it for a later turn.
  const alternatives = index < 0 ? phrases.filter(available) : [];
  const phrase = index >= 0 ? bag.splice(index, 1)[0] : alternatives[Math.floor(random() * alternatives.length)];
  if (!phrase) throw new Error('No unique Stronghold phrase is available.');
  player.phrase = phrase;
  synchronizeRoleTask(state, player);
}
