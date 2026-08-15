export type PassageSelection = {
  book: string;
  chapter: number;
  translation: string;
  startVerse: number;
  endVerse: number;
};

export type VerseRange = { start: number; end: number };

export function normalizeVerseNumbers(verses: ReadonlyArray<{ verse?: number }>): number[] {
  return verses
    .map((verse, index) => Number(verse.verse) || index + 1)
    .filter((verse, index, all) => Number.isInteger(verse) && verse > 0 && all.indexOf(verse) === index)
    .sort((a, b) => a - b);
}

export function chooseVerseRange(verses: readonly number[], preferredStart?: number, preferredEnd?: number): VerseRange {
  if (verses.length === 0) return { start: 0, end: 0 };
  const start = preferredStart !== undefined && verses.includes(preferredStart) ? preferredStart : (verses[0] ?? 0);
  const allowedEnds = verses.filter(verse => verse >= start);
  const end = preferredEnd !== undefined && allowedEnds.includes(preferredEnd)
    ? preferredEnd
    : (allowedEnds[Math.min(4, allowedEnds.length - 1)] ?? start);
  return { start, end };
}

export function isValidPassageSelection(selection: PassageSelection, verses: readonly number[]): boolean {
  return Boolean(
    selection.book &&
    selection.chapter > 0 &&
    selection.translation &&
    verses.includes(selection.startVerse) &&
    verses.includes(selection.endVerse) &&
    selection.endVerse >= selection.startVerse
  );
}

export function filterEndVerses(verses: readonly number[], start: number): number[] {
  return verses.filter(verse => verse >= start);
}

export function chooseRandomVerseRange(verseCount: number, length: number, random = Math.random): VerseRange {
  if (verseCount <= 0 || length <= 0) return { start: 0, end: 0 };
  const rangeLength = Math.min(verseCount, length);
  const lastStart = verseCount - rangeLength + 1;
  const start = Math.floor(random() * lastStart) + 1;
  return { start, end: start + rangeLength - 1 };
}
