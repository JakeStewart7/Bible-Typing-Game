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
    const maximumCharacters = PASSAGE_LENGTH_OPTIONS[settings.passageLength].maximumCharacters;
    const firstCandidate = Math.floor(this.random() * CANDIDATE_CHAPTERS.length);
    for (let offset = 0; offset < CANDIDATE_CHAPTERS.length; offset++) {
      const [book, chapter] = CANDIDATE_CHAPTERS[
        (firstCandidate + offset) % CANDIDATE_CHAPTERS.length
      ]!;
      const response = await fetchChapter(book, chapter, 'kjv', false);
      const verses = response.verses ?? [];
      if (!verses.length) continue;
      const startIndex = Math.floor(this.random() * verses.length);
      const passage = findPassageWithinLimit(book, chapter, verses, startIndex, maximumCharacters);
      if (passage) return passage;
    }
    throw new Error(`No period-ending passage fits within ${maximumCharacters} characters.`);
  }
}

export function selectPassageWithinLimit(
  book: string,
  chapter: number,
  verses: readonly SourceVerse[],
  startIndex: number,
  maximumCharacters: number
): MultiplayerPassage {
  const passage = findPassageWithinLimit(book, chapter, verses, startIndex, maximumCharacters);
  if (passage) return passage;
  throw new Error(`No period-ending passage fits within ${maximumCharacters} characters.`);
}

function findPassageWithinLimit(
  book: string,
  chapter: number,
  verses: readonly SourceVerse[],
  startIndex: number,
  maximumCharacters: number
): MultiplayerPassage | null {
  for (let offset = 0; offset < verses.length; offset++) {
    const candidateIndex = (startIndex + offset) % verses.length;
    const passage = periodEndingPassage(book, chapter, verses, candidateIndex, maximumCharacters);
    if (passage) return passage;
  }
  return null;
}

function periodEndingPassage(
  book: string,
  chapter: number,
  verses: readonly SourceVerse[],
  startIndex: number,
  maximumCharacters: number
): MultiplayerPassage | null {
  const selected = verses.slice(startIndex);
  const startVerse = selected[0]?.verse;
  if (startVerse === undefined) return null;
  let candidateText = '';
  const verseAtCharacter: number[] = [];
  for (const verse of selected) {
    if (verse.verse === undefined) continue;
    const separator = candidateText ? ' ' : '';
    const verseText = sanitizeText(verse.text);
    const remaining = maximumCharacters - candidateText.length;
    if (remaining <= separator.length) break;
    const fragment = `${separator}${verseText}`.slice(0, remaining);
    candidateText += fragment;
    verseAtCharacter.push(...Array.from({ length: fragment.length }, () => verse.verse!));
    if (fragment.length < separator.length + verseText.length) break;
  }
  const periodIndex = candidateText.lastIndexOf('.');
  if (periodIndex < 0) return null;
  const endVerse = verseAtCharacter[periodIndex];
  if (endVerse === undefined) return null;
  return {
    text: candidateText.slice(0, periodIndex + 1),
    reference: { book, chapter, startVerse, endVerse }
  };
}
