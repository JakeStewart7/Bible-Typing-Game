import type { AppStateRepository } from '../../persistence/app-state.ts';
import {
  addPassage,
  advancePlaylist,
  createPlaylist,
  deletePlaylist,
  removePassage,
  renamePlaylist,
  reorderPassage,
  reorderPlaylist
} from '../domain/playlists.ts';
import type { MemorizationPlaylist, PlaylistState } from '../domain/playlists.ts';
import { createPassageId, formatPassageLabel, type PassageReference } from '../domain/passage.ts';

type PlaylistElements = {
  form: HTMLFormElement;
  nameInput: HTMLInputElement;
  list: HTMLElement;
  status: HTMLElement;
};

type PlaylistDependencies = {
  repository: AppStateRepository;
  getActivePassage: () => PassageReference | null;
  loadPassage: (passage: PassageReference) => Promise<boolean>;
  activateRecallMode: () => void;
  createId?: () => string;
};

export type PlaylistCompletion = { completedCycle: boolean };

export function createPlaylistController(
  elements: PlaylistElements,
  dependencies: PlaylistDependencies
) {
  let activePlaylistId: string | null = null;
  const createId = dependencies.createId ?? (() => crypto.randomUUID());

  elements.form.addEventListener('submit', event => {
    event.preventDefault();
    mutate(state => createPlaylist(state, createId(), elements.nameInput.value));
    elements.nameInput.value = '';
  });

  function mutate(update: (state: PlaylistState) => PlaylistState): void {
    try {
      dependencies.repository.writePlaylistState(update(dependencies.repository.readPlaylistState()));
      elements.status.textContent = '';
      render();
    } catch (error) {
      elements.status.textContent = error instanceof Error ? error.message : 'The playlist could not be updated.';
    }
  }

  function render(): void {
    const state = dependencies.repository.readPlaylistState();
    if (!state.playlists.length) {
      const empty = document.createElement('p');
      empty.className = 'memory-passage-empty';
      empty.textContent = 'Create a playlist, then add the loaded passage.';
      elements.list.replaceChildren(empty);
      return;
    }
    elements.list.replaceChildren(...state.playlists.map((playlist, index) =>
      renderPlaylist(playlist, index, state.playlists.length)));
  }

  function renderPlaylist(playlist: MemorizationPlaylist, index: number, total: number): HTMLElement {
    const card = document.createElement('article');
    card.className = 'playlist-card';
    if (playlist.id === activePlaylistId) card.dataset.active = 'true';

    const name = document.createElement('input');
    name.value = playlist.name;
    name.setAttribute('aria-label', `Rename ${playlist.name}`);
    const heading = document.createElement('div');
    heading.className = 'playlist-heading';
    heading.append(name, action('Rename', () => mutate(state =>
      renamePlaylist(state, playlist.id, name.value))));

    const orderActions = document.createElement('div');
    orderActions.className = 'playlist-actions';
    orderActions.append(
      action('↑', () => mutate(state => reorderPlaylist(state, index, index - 1)), 'Move playlist up', index === 0),
      action('↓', () => mutate(state => reorderPlaylist(state, index, index + 1)), 'Move playlist down', index === total - 1),
      action('Delete', () => {
        if (activePlaylistId === playlist.id) activePlaylistId = null;
        mutate(state => deletePlaylist(state, playlist.id));
      }, `Delete ${playlist.name}`)
    );

    const passages = document.createElement('ol');
    passages.className = 'playlist-passages';
    playlist.passages.forEach((passage, passageIndex) => {
      passages.append(renderPassage(playlist, passage, passageIndex));
    });
    if (!playlist.passages.length) {
      const empty = document.createElement('li');
      empty.className = 'memory-passage-empty';
      empty.textContent = 'No passages yet';
      passages.append(empty);
    }

    const current = dependencies.getActivePassage();
    const addDisabled = !current || playlist.passages.some(passage =>
      current && createPassageId(passage) === createPassageId(current));
    const footer = document.createElement('div');
    footer.className = 'playlist-footer';
    footer.append(
      action('Add loaded passage', () => {
        const passage = dependencies.getActivePassage();
        if (passage) mutate(state => addPassage(state, playlist.id, passage));
      }, `Add loaded passage to ${playlist.name}`, addDisabled),
      action(playlist.currentIndex ? 'Resume playlist' : 'Practice playlist', () => {
        void startPlaylist(playlist.id);
      }, `Practice ${playlist.name}`, !playlist.passages.length)
    );

    const progress = document.createElement('small');
    progress.textContent = playlist.passages.length
      ? `Next: ${playlist.currentIndex + 1} of ${playlist.passages.length}`
      : 'Add a passage to begin';
    card.append(heading, orderActions, passages, progress, footer);
    return card;
  }

  function renderPassage(
    playlist: MemorizationPlaylist,
    passage: PassageReference,
    index: number
  ): HTMLLIElement {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = formatPassageLabel(passage);
    const actions = document.createElement('div');
    actions.append(
      action('↑', () => mutate(state => reorderPassage(state, playlist.id, index, index - 1)), 'Move passage up', index === 0),
      action('↓', () => mutate(state => reorderPassage(state, playlist.id, index, index + 1)), 'Move passage down', index === playlist.passages.length - 1),
      action('Remove', () => mutate(state => removePassage(state, playlist.id, index)), `Remove ${label.textContent}`)
    );
    item.append(label, actions);
    return item;
  }

  async function startPlaylist(playlistId: string): Promise<void> {
    const playlist = findPlaylist(playlistId);
    const passage = playlist?.passages[playlist.currentIndex];
    if (!passage) return;
    activePlaylistId = playlistId;
    dependencies.activateRecallMode();
    await dependencies.loadPassage(passage);
    render();
  }

  function completeActivePassage(passage: PassageReference): PlaylistCompletion | null {
    if (!activePlaylistId) return null;
    const playlist = findPlaylist(activePlaylistId);
    const expected = playlist?.passages[playlist.currentIndex];
    if (!expected || createPassageId(expected) !== createPassageId(passage)) {
      activePlaylistId = null;
      render();
      return null;
    }
    const advanced = advancePlaylist(dependencies.repository.readPlaylistState(), activePlaylistId);
    dependencies.repository.writePlaylistState(advanced.state);
    render();
    return { completedCycle: advanced.completedCycle };
  }

  function continueActivePlaylist(): void {
    if (activePlaylistId) void startPlaylist(activePlaylistId);
  }

  function handlePassageChanged(): void {
    if (activePlaylistId) {
      const playlist = findPlaylist(activePlaylistId);
      const expected = playlist?.passages[playlist.currentIndex];
      const actual = dependencies.getActivePassage();
      if (!expected || !actual || createPassageId(expected) !== createPassageId(actual)) {
        activePlaylistId = null;
      }
    }
    render();
  }

  function findPlaylist(playlistId: string): MemorizationPlaylist | undefined {
    return dependencies.repository.readPlaylistState().playlists.find(item => item.id === playlistId);
  }

  render();
  return { render, completeActivePassage, continueActivePlaylist, handlePassageChanged };
}

function action(
  text: string,
  onClick: () => void,
  label = text,
  disabled = false
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.setAttribute('aria-label', label);
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}
