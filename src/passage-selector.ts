export type PassageSelection = {
  book: string;
  chapter: number;
  translation: string;
  startVerse: number;
  endVerse: number;
};

export function normalizeVerseNumbers(verses: Array<{ verse?: number }>) {
  return verses
    .map((verse, index) => Number(verse.verse) || index + 1)
    .filter((verse, index, all) => Number.isInteger(verse) && verse > 0 && all.indexOf(verse) === index)
    .sort((a, b) => a - b);
}

export function chooseVerseRange(verses: number[], preferredStart?: number, preferredEnd?: number) {
  if (verses.length === 0) return { start: 0, end: 0 };
  const start = preferredStart && verses.includes(preferredStart) ? preferredStart : verses[0];
  const allowedEnds = verses.filter(verse => verse >= start);
  const end = preferredEnd && allowedEnds.includes(preferredEnd)
    ? preferredEnd
    : allowedEnds[Math.min(4, allowedEnds.length - 1)];
  return { start, end };
}

export function isValidPassageSelection(selection: PassageSelection, verses: number[]) {
  return Boolean(
    selection.book &&
    selection.chapter > 0 &&
    selection.translation &&
    verses.includes(selection.startVerse) &&
    verses.includes(selection.endVerse) &&
    selection.endVerse >= selection.startVerse
  );
}

export function filterEndVerses(verses: number[], start: number) {
  return verses.filter(verse => verse >= start);
}
