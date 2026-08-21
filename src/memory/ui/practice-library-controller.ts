import type { GameMode } from '../../game/modes.ts';
import type { AppStateRepository } from '../../persistence/app-state.ts';
import { renderEmptyState } from '../../ui/components.ts';
import {
  isFavoritePassage,
  toMemoryPassage,
  toggleFavoritePassage
} from '../domain/practice-library.ts';
import type { MemoryLibrarySnapshot, MemoryPassage } from '../domain/practice-library.ts';
import { createPassageId, formatPassageLabel, type PassageReference } from '../domain/passage.ts';

type PracticeLibraryElements = {
  library: HTMLElement;
  practiceFavorites: HTMLElement;
  memoryFavorites: HTMLElement;
  recent: HTMLElement;
  favoriteButton: HTMLButtonElement;
};

export function createPracticeLibraryController(
  elements: PracticeLibraryElements,
  repository: AppStateRepository,
  selectPassage: (passage: PassageReference) => void
) {
  let mode: GameMode = 'practice';
  let activePassage: PassageReference | null = null;

  elements.favoriteButton.addEventListener('click', () => {
    if (!activePassage || mode === 'defense') return;
    const snapshot = readSnapshot(mode);
    const updated = toggleFavoritePassage(
      snapshot,
      toMemoryPassage(activePassage, Date.now())
    );
    writeFavorites(mode, updated.favorites);
    render();
  });

  function setContext(nextMode: GameMode, passage: PassageReference | null): void {
    mode = nextMode;
    activePassage = passage ? { ...passage } : null;
    render();
  }

  function recordStarted(passage: PassageReference): void {
    repository.recordRecentPassage(passage);
    render();
  }

  function render(): void {
    const available = mode !== 'defense';
    elements.library.classList.toggle('is-hidden', !available);
    elements.favoriteButton.classList.toggle('is-hidden', !available || !activePassage);

    renderPassageList(elements.practiceFavorites, toPassages(repository.readPracticeFavorites()));
    renderPassageList(elements.memoryFavorites, toPassages(repository.readMemoryFavorites()));
    renderPassageList(elements.recent, toPassages(repository.readRecentPassages()));

    const snapshot = readSnapshot(mode);
    const id = activePassage ? createPassageId(activePassage) : '';
    const favorite = available && Boolean(id) && isFavoritePassage(snapshot, id);
    elements.favoriteButton.setAttribute('aria-pressed', String(favorite));
    elements.favoriteButton.textContent = favorite ? '★ Favorited' : '☆ Favorite';
  }

  function renderPassageList(container: HTMLElement, passages: MemoryPassage[]): void {
    if (!passages.length) {
      renderEmptyState(container, 'No passages yet');
      return;
    }
    container.replaceChildren(...passages.map(passage => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = formatPassageLabel(passage);
      button.addEventListener('click', () => selectPassage(passage));
      return button;
    }));
  }

  function readSnapshot(favoriteMode: GameMode): MemoryLibrarySnapshot {
    const favorites = favoriteMode === 'memory'
      ? repository.readMemoryFavorites()
      : repository.readPracticeFavorites();
    return {
      favorites: toPassages(favorites),
      recent: toPassages(repository.readRecentPassages())
    };
  }

  function writeFavorites(favoriteMode: GameMode, favorites: MemoryPassage[]): void {
    if (favoriteMode === 'memory') repository.writeMemoryFavorites(favorites);
    else repository.writePracticeFavorites(favorites);
  }

  function toPassages(passages: PassageReference[]): MemoryPassage[] {
    return passages.map((passage, index) => toMemoryPassage(passage, Date.now() - index));
  }

  return { setContext, recordStarted, render };
}
