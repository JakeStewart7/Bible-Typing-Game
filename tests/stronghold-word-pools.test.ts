import { WORD_POOLS, SHORT_WORDS, MEDIUM_WORDS, LONG_WORDS, EXTRA_LONG_WORDS } from '../src/stronghold/domain/word-pools.ts';
import { PHRASE_LENGTHS } from '../src/stronghold/domain/types.ts';
import { TEXT_LENGTH_RANGES } from '../src/stronghold/domain/rules.ts';
import { createStronghold } from '../src/stronghold/domain/state.ts';
import { assignPhrase } from '../src/stronghold/domain/phrases.ts';
import { equal, test } from './harness.ts';

test('Stronghold each length class has its own frozen pool of at least two hundred unique normal entries', () => {
  equal(WORD_POOLS.short === SHORT_WORDS, true);
  equal(WORD_POOLS.medium === MEDIUM_WORDS, true);
  equal(WORD_POOLS.long === LONG_WORDS, true);
  equal(WORD_POOLS['extra-long'] === EXTRA_LONG_WORDS, true);
  equal(Object.isFrozen(WORD_POOLS), true);
  const allEntries = new Set<string>();
  for (const length of PHRASE_LENGTHS) {
    const words = WORD_POOLS[length];
    equal(words.length >= 200, true);
    equal(Object.isFrozen(words), true);
    equal(new Set(words.map(word => word.toLowerCase())).size, words.length);
    const [minimum, maximum] = TEXT_LENGTH_RANGES[length];
    for (const word of words) {
      if (word.length < minimum || word.length > maximum) throw new Error(`${length}: "${word}" has ${word.length} characters.`);
      equal(/^[a-z]+(?: [a-z]+)*$/.test(word), true);
      equal(allEntries.has(word.toLowerCase()), false);
      allEntries.add(word.toLowerCase());
    }
  }
});

test('Stronghold every expanded entry can be reached before a solo player cycles through the pool', () => {
  for (const length of PHRASE_LENGTHS) {
    const state = createStronghold();
    const player = state.players[0]!;
    state.players = [player];
    player.length = length;
    player.phraseId = 0;
    const seen = new Set<string>();
    for (let i = 0; i < WORD_POOLS[length].length; i++) {
      assignPhrase(state, player);
      seen.add(player.phrase);
    }
    equal(seen.size, WORD_POOLS[length].length);
    equal([...seen].every(word => WORD_POOLS[length].includes(word)), true);
    assignPhrase(state, player);
    equal(seen.has(player.phrase), true);
  }
});

test('Stronghold expanded pools keep four players on the same role unique without changing their private input', () => {
  for (const length of PHRASE_LENGTHS) {
    const state = createStronghold();
    for (const player of state.players) {
      player.role = 'economy';
      player.length = length;
      assignPhrase(state, player);
    }
    for (let round = 0; round < WORD_POOLS[length].length; round++) {
      for (const player of state.players) {
        const others = state.players.filter(other => other !== player);
        const before = others.map(other => [other.phrase, other.phraseId, other.typed]);
        assignPhrase(state, player);
        player.typed = player.phrase.slice(0, Math.min(1, player.phrase.length - 1));
        equal(others.map(other => [other.phrase, other.phraseId, other.typed]), before);
        equal(new Set(state.players.map(other => other.phrase)).size, 4);
      }
    }
  }
});
