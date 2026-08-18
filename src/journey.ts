import { BOOKS } from './bible-data.ts';
import { createCampaignChunks } from './campaign.ts';
import type { CampaignChunk, CampaignProgress } from './campaign.ts';

export type Testament = 'Old Testament' | 'New Testament';

export type JourneyBookGroup = {
  testament: Testament;
  books: readonly string[];
};

const NEW_TESTAMENT_INDEX = BOOKS.indexOf('Matthew');
const STARTING_BOOKS = new Set(['Matthew', 'Genesis', 'Psalms']);
const UNLOCK_ORDER = [
  ...BOOKS.slice(NEW_TESTAMENT_INDEX),
  ...BOOKS.slice(0, NEW_TESTAMENT_INDEX)
].filter(book => !STARTING_BOOKS.has(book));

export function groupJourneyBooks(books: readonly string[] = BOOKS): JourneyBookGroup[] {
  return [
    { testament: 'Old Testament', books: books.filter(book => BOOKS.indexOf(book as typeof BOOKS[number]) < NEW_TESTAMENT_INDEX) },
    { testament: 'New Testament', books: books.filter(book => BOOKS.indexOf(book as typeof BOOKS[number]) >= NEW_TESTAMENT_INDEX) }
  ].filter(group => group.books.length > 0);
}

export function filterJourneyBooks(query: string, books: readonly string[] = BOOKS): string[] {
  const needle = normalize(query);
  if (!needle) return [...books];
  return books
    .map((book, index) => ({ book, index, score: fuzzyScore(normalize(book), needle) }))
    .filter(match => match.score !== null)
    .sort((left, right) => left.score! - right.score! || left.index - right.index)
    .map(match => match.book);
}

export function isJourneyBookUnlocked(book: string, progress: CampaignProgress): boolean {
  if (STARTING_BOOKS.has(book)) return true;
  const index = UNLOCK_ORDER.indexOf(book);
  if (index < 0) return false;
  const previousBook = index === 0 ? 'Matthew' : UNLOCK_ORDER[index - 1];
  return isBookComplete(previousBook, progress);
}

export function journeyCurrency(progress: CampaignProgress): number {
  return Object.keys(progress).filter(id => (progress[id] ?? 0) > 0 && isCampaignChunkId(id)).length;
}

export function findJourneyContinuation(
  progress: CampaignProgress,
  preferred: CampaignChunk | null = null
): CampaignChunk | null {
  if (preferred && isJourneyBookUnlocked(preferred.book, progress) && (progress[preferred.id] ?? 0) === 0) return preferred;
  if (preferred && isJourneyBookUnlocked(preferred.book, progress)) {
    const nextInBook = createCampaignChunks(preferred.book).find(candidate => (progress[candidate.id] ?? 0) === 0);
    if (nextInBook) return nextInBook;
  }
  for (const book of BOOKS) {
    if (!isJourneyBookUnlocked(book, progress)) continue;
    const chunk = createCampaignChunks(book).find(candidate => (progress[candidate.id] ?? 0) === 0);
    if (chunk) return chunk;
  }
  return null;
}

function isBookComplete(book: string, progress: CampaignProgress): boolean {
  const chunks = createCampaignChunks(book);
  return chunks.length > 0 && chunks.every(chunk => (progress[chunk.id] ?? 0) > 0);
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
}

function fuzzyScore(value: string, needle: string): number | null {
  const substringIndex = value.indexOf(needle);
  if (substringIndex >= 0) return substringIndex;
  let needleIndex = 0;
  let score = value.length;
  for (let valueIndex = 0; valueIndex < value.length && needleIndex < needle.length; valueIndex++) {
    if (value[valueIndex] === needle[needleIndex]) {
      score += valueIndex;
      needleIndex++;
    }
  }
  return needleIndex === needle.length ? score : null;
}

function isCampaignChunkId(id: string): boolean {
  return /^[^:]+:\d+:\d+-\d+$/.test(id);
}
