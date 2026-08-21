import type { PassageReference } from './passage.ts';

export type { PassageReference } from './passage.ts';

export type MemoryPassage = PassageReference & {
  id: string;
  practicedAt: number;
};

export type MemoryLibrarySnapshot = {
  favorites: MemoryPassage[];
  recent: MemoryPassage[];
};

export interface MemoryLibraryRepository {
  read(): MemoryLibrarySnapshot;
  write(snapshot: MemoryLibrarySnapshot): void;
}

const MAX_RECENT = 6;
export function createPassageId(reference: PassageReference): string {
  return [
    reference.translation,
    reference.book,
    reference.chapter,
    reference.startVerse,
    reference.endVerse
  ].join(':');
}

export function toMemoryPassage(reference: PassageReference, practicedAt: number): MemoryPassage {
  return { ...reference, id: createPassageId(reference), practicedAt };
}

export function recordRecentPassage(
  snapshot: MemoryLibrarySnapshot,
  passage: MemoryPassage
): MemoryLibrarySnapshot {
  return {
    favorites: [...snapshot.favorites],
    recent: [passage, ...snapshot.recent.filter(item => item.id !== passage.id)].slice(0, MAX_RECENT)
  };
}

export function toggleFavoritePassage(
  snapshot: MemoryLibrarySnapshot,
  passage: MemoryPassage
): MemoryLibrarySnapshot {
  const isFavorite = snapshot.favorites.some(item => item.id === passage.id);
  return {
    favorites: isFavorite
      ? snapshot.favorites.filter(item => item.id !== passage.id)
      : [passage, ...snapshot.favorites.filter(item => item.id !== passage.id)],
    recent: [...snapshot.recent]
  };
}

export function isFavoritePassage(snapshot: MemoryLibrarySnapshot, id: string): boolean {
  return snapshot.favorites.some(item => item.id === id);
}
