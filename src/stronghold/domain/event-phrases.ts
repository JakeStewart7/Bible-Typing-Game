import { TEXT_LENGTH_RANGES } from './rules.ts';
import { PHRASE_LENGTHS, type PhraseLength, type WorldEvent } from './types.ts';

const DRILLS: Record<Exclude<WorldEvent, 'peace'>, readonly string[]> = {
  'left-hand': ['we', 'are', 'safe', 'great', 'water', 'trees', 'grass', 'sweet', 'we dare', 'we rest'],
  vowels: ['ae', 'io', 'ou', 'ea', 'ai', 'ue', 'oa', 'ei', 'au', 'ui'],
  numbers: ['12', '34', '56', '78', '90', '123', '456', '789', '1024', '2048'],
  symbols: ['()', '[]', '{}', '<>', '+=', '!=', '&&', '||', '=>', '::'],
  code: ['x++', 'a=b', 'x=1', 'fn()', 'ok()', 'a+b', 'x!=0', 'i<10', 'n--', 'x+=2']
};

export const EVENT_WORD_POOLS = Object.fromEntries(Object.entries(DRILLS).map(([event, seeds]) => [
  event, Object.fromEntries(PHRASE_LENGTHS.map(length => {
    const [min, max] = TEXT_LENGTH_RANGES[length];
    const entries = new Set<string>();
    for (let start = 0; start < seeds.length; start++) {
      let phrase = '';
      for (let offset = 0; phrase.length <= max; offset++) {
        const seed = seeds[(start + offset) % seeds.length];
        if (!seed) throw new Error('Missing world-event drill.');
        phrase += `${phrase ? ' ' : ''}${seed}`;
        if (phrase.length >= min && phrase.length <= max) entries.add(phrase);
      }
    }
    return [length, Object.freeze([...entries])];
  }))
])) as Record<Exclude<WorldEvent, 'peace'>, Record<PhraseLength, readonly string[]>>;
