import { BOOKS } from './bible-data.ts';
import { VERSE_COUNTS } from './verse-counts.ts';

export type CampaignChunk = {
  id: string;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
};

export type CampaignProgress = Record<string, number>;

export const STAR_THRESHOLDS = [25, 40, 60, 80, 100] as const;
const TARGET_VERSES_PER_CHUNK = 3;

export function createCampaignChunks(book: string): CampaignChunk[] {
  const chapters = VERSE_COUNTS[book] ?? [];
  return chapters.flatMap((verseCount, chapterIndex) => {
    const chunks: CampaignChunk[] = [];
    for (let start = 1; start <= verseCount; start += TARGET_VERSES_PER_CHUNK) {
      const end = Math.min(verseCount, start + TARGET_VERSES_PER_CHUNK - 1);
      chunks.push({
        id: `${book}:${chapterIndex + 1}:${start}-${end}`,
        book,
        chapter: chapterIndex + 1,
        startVerse: start,
        endVerse: end
      });
    }
    return chunks;
  });
}

export function starsForWpm(wpm: number, accuracy: number): number {
  const speedStars = STAR_THRESHOLDS.filter(threshold => wpm >= threshold).length;
  if (accuracy < 90) return Math.min(speedStars, 2);
  if (accuracy < 95) return Math.min(speedStars, 3);
  return speedStars;
}

export function getBookProgress(book: string, progress: CampaignProgress) {
  const chunks = createCampaignChunks(book);
  const completed = chunks.filter(chunk => (progress[chunk.id] ?? 0) > 0).length;
  const stars = chunks.reduce((total, chunk) => total + (progress[chunk.id] ?? 0), 0);
  return { total: chunks.length, completed, stars, percent: chunks.length ? Math.round(completed / chunks.length * 100) : 0 };
}

export function getCampaignProgress(progress: CampaignProgress) {
  const summaries = BOOKS.map(book => getBookProgress(book, progress));
  const completedChapters = BOOKS.reduce((total, book) => {
    const chapters = new Set(
      createCampaignChunks(book)
        .filter(chunk => (progress[chunk.id] ?? 0) > 0)
        .map(chunk => chunk.chapter)
    );
    return total + [...chapters].filter(chapter =>
      createCampaignChunks(book)
        .filter(chunk => chunk.chapter === chapter)
        .every(chunk => (progress[chunk.id] ?? 0) > 0)
    ).length;
  }, 0);
  return {
    total: summaries.reduce((total, summary) => total + summary.total, 0),
    completed: summaries.reduce((total, summary) => total + summary.completed, 0),
    stars: summaries.reduce((total, summary) => total + summary.stars, 0),
    completedBooks: summaries.filter(summary => summary.percent === 100).length,
    completedChapters
  };
}

export function nextChunk(current: CampaignChunk): CampaignChunk | null {
  const chunks = createCampaignChunks(current.book);
  const index = chunks.findIndex(chunk => chunk.id === current.id);
  return chunks[index + 1] ?? null;
}

export function isChapterComplete(chunk: CampaignChunk, progress: CampaignProgress): boolean {
  return createCampaignChunks(chunk.book)
    .filter(candidate => candidate.chapter === chunk.chapter)
    .every(candidate => (progress[candidate.id] ?? 0) > 0);
}
