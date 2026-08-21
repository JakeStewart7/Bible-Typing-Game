import { sanitizeText } from '../game/state.ts';

export type ChapterVerse = {
  verse: number;
  text: string;
};

type ChapterVerseInput = {
  verse?: number;
  text: string;
};

export type VerseRange = {
  startVerse: number;
  endVerse: number;
};

export type ChapterReaderVerse = ChapterVerse & {
  isActive: boolean;
};

export type ChapterReader = {
  verses: ChapterReaderVerse[];
  activeRange: VerseRange;
  activeText: string;
};

export type ChapterReference = VerseRange & {
  book: string;
  chapter: number;
  translation: string;
};

export type ChapterInfo = {
  book: string;
  chapter: number;
  verseCount: number;
};

export function normalizeChapterVerses(verses: readonly ChapterVerseInput[]): ChapterVerse[] {
  return verses.map((verse, index) => ({
    verse: verse.verse ?? index + 1,
    text: verse.text
  }));
}

export function createChapterReader(
  chapterVerses: readonly ChapterVerse[],
  activeRange: VerseRange
): ChapterReader {
  const verses = chapterVerses
    .map(verse => ({ verse: verse.verse, text: sanitizeText(verse.text) }))
    .filter(verse => verse.text)
    .sort((left, right) => left.verse - right.verse)
    .map(verse => ({
      ...verse,
      isActive: verse.verse >= activeRange.startVerse && verse.verse <= activeRange.endVerse
    }));
  const activeVerses = verses.filter(verse => verse.isActive);
  const expectedVerseCount = activeRange.endVerse - activeRange.startVerse + 1;
  if (activeVerses.length !== expectedVerseCount
    || !activeVerses.every((verse, index) => verse.verse === activeRange.startVerse + index)) {
    throw new Error('The selected range is incomplete.');
  }
  const activeText = sanitizeText(activeVerses.map(verse => verse.text).join(' '));

  if (!activeText) throw new Error('The selected range has no typeable verses.');

  return { verses, activeRange: { ...activeRange }, activeText };
}

export function nextChapterReaderRange(
  reference: ChapterReference,
  currentChapterVerseCount: number,
  nextChapter: ChapterInfo | null
): ChapterReference | null {
  const verseCount = reference.endVerse - reference.startVerse + 1;
  const completesChapter = reference.startVerse === 1 && reference.endVerse === currentChapterVerseCount;
  const followsCurrentChapter = reference.endVerse === currentChapterVerseCount;

  if (completesChapter || followsCurrentChapter) {
    if (!nextChapter) return null;
    return {
      book: nextChapter.book,
      chapter: nextChapter.chapter,
      startVerse: 1,
      endVerse: completesChapter ? nextChapter.verseCount : Math.min(verseCount, nextChapter.verseCount),
      translation: reference.translation
    };
  }

  const startVerse = reference.endVerse + 1;
  return {
    ...reference,
    startVerse,
    endVerse: Math.min(currentChapterVerseCount, startVerse + verseCount - 1)
  };
}
