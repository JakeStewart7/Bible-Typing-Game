import { fetchChapter } from '../../bible-api';
import { sanitizeText } from '../../game/state';
import type { MultiplayerPassage, PassageProvider } from '../domain/types';

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

  async nextPassage(): Promise<MultiplayerPassage> {
    const candidate = CANDIDATE_CHAPTERS[Math.floor(this.random() * CANDIDATE_CHAPTERS.length)]!;
    const [book, chapter] = candidate;
    const response = await fetchChapter(book, chapter, 'kjv', false);
    const verses = response.verses ?? [];
    if (verses.length < 3) throw new Error(`Not enough verses are available for ${book} ${chapter}.`);
    const startIndex = Math.floor(this.random() * Math.max(1, verses.length - 3));
    const firstThree = verses.slice(startIndex, startIndex + 3);
    const useFourth = firstThree.reduce((total, verse) => total + verse.text.length, 0) < 330;
    const selected = verses.slice(startIndex, startIndex + (useFourth ? 4 : 3));
    const startVerse = selected[0]?.verse;
    const endVerse = selected[selected.length - 1]?.verse;
    if (startVerse === undefined || endVerse === undefined) {
      throw new Error(`Could not select a passage from ${book} ${chapter}.`);
    }
    return {
      text: sanitizeText(selected.map(verse => verse.text).join(' ')),
      reference: { book, chapter, startVerse, endVerse }
    };
  }
}
