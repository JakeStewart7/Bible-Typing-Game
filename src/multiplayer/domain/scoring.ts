import { BOOKS, getChapterCount } from '../../bible-data.ts';
import { getVerseCount } from '../../verse-counts.ts';
import type { PassageGuess, PassageReference } from './types.ts';

type BibleBook = typeof BOOKS[number];
type BookCategory =
  | 'law'
  | 'history'
  | 'wisdom'
  | 'prophecy'
  | 'gospels'
  | 'church-history'
  | 'epistles';

const NEW_TESTAMENT_START = BOOKS.indexOf('Matthew');

function canonicalBook(value: string): BibleBook | null {
  const normalized = value.trim().toLowerCase();
  return BOOKS.find(book => book.toLowerCase() === normalized) ?? null;
}

function testament(book: BibleBook): 'old' | 'new' {
  return BOOKS.indexOf(book) < NEW_TESTAMENT_START ? 'old' : 'new';
}

function category(book: BibleBook): BookCategory {
  const index = BOOKS.indexOf(book);
  if (index <= BOOKS.indexOf('Deuteronomy')) return 'law';
  if (index <= BOOKS.indexOf('Esther')) return 'history';
  if (index <= BOOKS.indexOf('Song of Solomon')) return 'wisdom';
  if (index <= BOOKS.indexOf('Malachi') || book === 'Revelation') return 'prophecy';
  if (index <= BOOKS.indexOf('John')) return 'gospels';
  if (book === 'Acts') return 'church-history';
  return 'epistles';
}

function proximityScore(actual: number, guessed: number | null, weight: number, maximum: number): number {
  if (guessed === null) return 0;
  const distanceRatio = Math.abs(actual - guessed) / Math.max(1, maximum);
  return weight * Math.max(0, 1 - distanceRatio);
}

export function scorePassageGuess(guess: PassageGuess, answer: PassageReference): number {
  const guessedBook = canonicalBook(guess.book);
  const answerBook = canonicalBook(answer.book);
  if (!answerBook) throw new Error(`Unknown answer book: ${answer.book}.`);
  const testamentScore = guessedBook && testament(guessedBook) === testament(answerBook) ? 20 : 0;
  const categoryScore = guessedBook && category(guessedBook) === category(answerBook) ? 20 : 0;
  const bookScore = guessedBook === answerBook ? 20 : 0;
  const chapterScore = proximityScore(
    answer.chapter,
    guess.chapter,
    20,
    getChapterCount(answerBook)
  );
  const verseCount = getVerseCount(answerBook, answer.chapter);
  const verseScore = proximityScore(answer.startVerse, guess.startVerse, 10, verseCount)
    + proximityScore(answer.endVerse, guess.endVerse, 10, verseCount);
  return Math.round(testamentScore + categoryScore + bookScore + chapterScore + verseScore);
}
