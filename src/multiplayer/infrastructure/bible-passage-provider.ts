import { fetchChapter } from '../../bible-api.ts';
import { sanitizeText } from '../../game/state.ts';
import { PASSAGE_LENGTH_OPTIONS } from '../domain/settings.ts';
import type { MultiplayerPassage, PassageProvider, RoomSettings } from '../domain/types.ts';

type SourceVerse = { text: string; verse?: number };

const CANDIDATE_CHAPTERS = [
  ['Genesis', 1], ['Psalms', 23], ['Psalms', 46], ['Proverbs', 3],
  ['Isaiah', 40], ['Matthew', 5], ['Luke', 15], ['John', 1],
  ['John', 3], ['Romans', 8], ['1 Corinthians', 13], ['Philippians', 4],
  ['Hebrews', 11], ['James', 1]
] as const;

export class BiblePassageProvider implements PassageProvider {
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  async nextPassage(settings: RoomSettings): Promise<MultiplayerPassage> {
    const candidate = CANDIDATE_CHAPTERS[Math.floor(this.random() * CANDIDATE_CHAPTERS.length)]!;
    const [book, chapter] = candidate;
    const response = await fetchChapter(book, chapter, 'kjv', false);
    const verses = response.verses ?? [];
    if (!verses.length) throw new Error(`No verses are available for ${book} ${chapter}.`);
    const maximumCharacters = PASSAGE_LENGTH_OPTIONS[settings.passageLength].maximumCharacters;
    const startIndex = Math.floor(this.random() * verses.length);
    return selectPassageWithinLimit(
      book,
      chapter,
      verses,
      startIndex,
      maximumCharacters
    );
  }
}

export function selectPassageWithinLimit(
  book: string,
  chapter: number,
  verses: readonly SourceVerse[],
  startIndex: number,
  maximumCharacters: number
): MultiplayerPassage {
  const selected = verses.slice(startIndex);
  const startVerse = selected[0]?.verse;
  const textParts: string[] = [];
  let characterCount = 0;
  let endVerse = startVerse;
  for (const verse of selected) {
    const separator = textParts.length ? ' ' : '';
    const verseText = sanitizeText(verse.text);
    const remaining = maximumCharacters - characterCount;
    if (remaining <= separator.length) break;
    const fragment = `${separator}${verseText}`.slice(0, remaining);
    if (fragment) {
      textParts.push(fragment);
      characterCount += fragment.length;
      endVerse = verse.verse;
    }
    if (fragment.length < separator.length + verseText.length) break;
  }
  if (startVerse === undefined || endVerse === undefined) {
    throw new Error(`Could not select a passage from ${book} ${chapter}.`);
  }
  return {
    text: textParts.join('').trimEnd(),
    reference: { book, chapter, startVerse, endVerse }
  };
}
