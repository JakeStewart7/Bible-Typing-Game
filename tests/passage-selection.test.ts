import { BOOKS, getChapterCount } from '../src/bible-data.ts';
import { getSampleVerseNumbers } from '../src/bible-api.ts';
import { chooseRandomVerseRange, chooseVerseRange, filterEndVerses, isValidPassageSelection, normalizeVerseNumbers } from '../src/passage-selector.ts';
import { getVerseCount, VERSE_COUNTS } from '../src/verse-counts.ts';
import { createChapterReader, nextChapterReaderRange } from '../src/typing/chapter-reader.ts';
import { equal, test } from './harness.ts';

test('canonical Bible metadata covers all books', () => {
  equal(BOOKS.length, 66);
  equal(getChapterCount('Genesis'), 50);
  equal(getChapterCount('Psalms'), 150);
  equal(getChapterCount('Revelation'), 22);
});

test('API verse metadata is normalized and deduplicated', () => {
  equal(normalizeVerseNumbers([{ verse: 3 }, { verse: 1 }, { verse: 3 }, {}]), [1, 3, 4]);
});

test('selector chooses a safe five-verse default range', () => {
  equal(chooseVerseRange([1, 2, 3, 4, 5, 6, 7]), { start: 1, end: 5 });
  equal(chooseVerseRange([16, 17]), { start: 16, end: 17 });
});

test('selector preserves eligible user selections', () => {
  equal(chooseVerseRange([1, 2, 3, 4], 2, 4), { start: 2, end: 4 });
  equal(filterEndVerses([1, 2, 3, 4], 3), [3, 4]);
});

test('changing the starting verse rebuilds eligible end verses', () => {
  equal(filterEndVerses([1, 2, 3, 4, 5], 4), [4, 5]);
  equal(chooseVerseRange(filterEndVerses([1, 2, 3, 4, 5], 4), 4, 2), { start: 4, end: 5 });
});

test('switching from a long chapter resets stale verse choices', () => {
  equal(chooseVerseRange([1, 2, 3], 16, 17), { start: 1, end: 3 });
});

test('random defense ranges contain seven verses within chapter boundaries', () => {
  equal(chooseRandomVerseRange(36, 7, () => 0), { start: 1, end: 7 });
  equal(chooseRandomVerseRange(36, 7, () => .999), { start: 30, end: 36 });
  equal(chooseRandomVerseRange(4, 7, () => .5), { start: 1, end: 4 });
});

test('chapter reader keeps active verses typeable and surrounding context subdued', () => {
  const reader = createChapterReader([
    { verse: 1, text: ' Before ' },
    { verse: 2, text: 'Active one.' },
    { verse: 3, text: 'Active two.' },
    { verse: 4, text: 'After' }
  ], { startVerse: 2, endVerse: 3 });
  equal(reader.activeText, 'Active one. Active two.');
  equal(reader.verses.map(verse => [verse.verse, verse.isActive]), [
    [1, false], [2, true], [3, true], [4, false]
  ]);
});

test('chapter reader continuation keeps range length and crosses chapter ends', () => {
  const reference = { book: 'John', chapter: 3, startVerse: 5, endVerse: 7, translation: 'kjv' };
  equal(nextChapterReaderRange(reference, 10, { book: 'John', chapter: 4, verseCount: 5 }), {
    ...reference, startVerse: 8, endVerse: 10
  });
  equal(nextChapterReaderRange({ ...reference, startVerse: 7, endVerse: 9 }, 10, {
    book: 'John', chapter: 4, verseCount: 5
  }), {
    ...reference, startVerse: 10, endVerse: 10
  });
  equal(nextChapterReaderRange({ ...reference, startVerse: 8, endVerse: 10 }, 10, {
    book: 'John', chapter: 4, verseCount: 2
  }), {
    book: 'John', chapter: 4, startVerse: 1, endVerse: 2, translation: 'kjv'
  });
});

test('chapter reader continuation advances a whole chapter as a whole chapter', () => {
  const reference = { book: 'John', chapter: 3, startVerse: 1, endVerse: 36, translation: 'kjv' };
  equal(nextChapterReaderRange(reference, 36, { book: 'John', chapter: 4, verseCount: 54 }), {
    book: 'John', chapter: 4, startVerse: 1, endVerse: 54, translation: 'kjv'
  });
});

test('selector rejects reversed and unavailable ranges', () => {
  const base = { book: 'John', chapter: 3, translation: 'web' };
  equal(isValidPassageSelection({ ...base, startVerse: 16, endVerse: 17 }, [16, 17]), true);
  equal(isValidPassageSelection({ ...base, startVerse: 17, endVerse: 16 }, [16, 17]), false);
  equal(isValidPassageSelection({ ...base, startVerse: 1, endVerse: 17 }, [16, 17]), false);
});

test('licensed sample selectors preserve canonical verse numbers', () => {
  equal(getSampleVerseNumbers('John', 3, 'esv'), [16, 17]);
  equal(getSampleVerseNumbers('John', 3, 'niv'), [16, 17]);
});

test('static verse metadata covers every canonical chapter', () => {
  equal(Object.keys(VERSE_COUNTS).length, 66);
  equal(Object.values(VERSE_COUNTS).reduce((total, chapters) => total + chapters.length, 0), 1189);
  equal(Object.values(VERSE_COUNTS).flat().reduce((total, count) => total + count, 0), 31102);
  equal(getVerseCount('John', 3), 36);
  equal(getVerseCount('Psalms', 119), 176);
});
