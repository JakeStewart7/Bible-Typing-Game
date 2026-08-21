import { createPassageId } from './practice-library.ts';
import type { PassageReference } from './passage.ts';

export const PLAYLIST_STATE_VERSION = 1;

export type MemorizationPlaylist = {
  id: string;
  name: string;
  passages: PassageReference[];
  currentIndex: number;
};

export type PlaylistState = {
  version: typeof PLAYLIST_STATE_VERSION;
  playlists: MemorizationPlaylist[];
};

export type PlaylistAdvance = {
  state: PlaylistState;
  completedCycle: boolean;
};

export function emptyPlaylistState(): PlaylistState {
  return { version: PLAYLIST_STATE_VERSION, playlists: [] };
}

export function createPlaylist(state: PlaylistState, id: string, name: string): PlaylistState {
  const normalizedName = requireName(name);
  if (!id.trim() || state.playlists.some(playlist => playlist.id === id)) {
    throw new Error('A playlist requires a unique identifier.');
  }
  return {
    ...state,
    playlists: [...state.playlists, { id, name: normalizedName, passages: [], currentIndex: 0 }]
  };
}

export function renamePlaylist(state: PlaylistState, playlistId: string, name: string): PlaylistState {
  return updatePlaylist(state, playlistId, playlist => ({ ...playlist, name: requireName(name) }));
}

export function deletePlaylist(state: PlaylistState, playlistId: string): PlaylistState {
  requirePlaylist(state, playlistId);
  return { ...state, playlists: state.playlists.filter(playlist => playlist.id !== playlistId) };
}

export function reorderPlaylist(state: PlaylistState, fromIndex: number, toIndex: number): PlaylistState {
  return { ...state, playlists: moveItem(state.playlists, fromIndex, toIndex) };
}

export function addPassage(
  state: PlaylistState,
  playlistId: string,
  passage: PassageReference
): PlaylistState {
  return updatePlaylist(state, playlistId, playlist => {
    const passageId = createPassageId(passage);
    if (playlist.passages.some(item => createPassageId(item) === passageId)) return playlist;
    return { ...playlist, passages: [...playlist.passages, { ...passage }] };
  });
}

export function removePassage(
  state: PlaylistState,
  playlistId: string,
  passageIndex: number
): PlaylistState {
  return updatePlaylist(state, playlistId, playlist => {
    requireIndex(playlist.passages, passageIndex);
    const passages = playlist.passages.filter((_, index) => index !== passageIndex);
    const shiftedIndex = passageIndex < playlist.currentIndex
      ? playlist.currentIndex - 1
      : playlist.currentIndex;
    return {
      ...playlist,
      passages,
      currentIndex: passages.length ? Math.min(shiftedIndex, passages.length - 1) : 0
    };
  });
}

export function reorderPassage(
  state: PlaylistState,
  playlistId: string,
  fromIndex: number,
  toIndex: number
): PlaylistState {
  return updatePlaylist(state, playlistId, playlist => {
    const activePassage = playlist.passages[playlist.currentIndex];
    const passages = moveItem(playlist.passages, fromIndex, toIndex);
    const activeId = activePassage ? createPassageId(activePassage) : null;
    const currentIndex = activeId
      ? passages.findIndex(passage => createPassageId(passage) === activeId)
      : 0;
    return { ...playlist, passages, currentIndex: Math.max(0, currentIndex) };
  });
}

export function advancePlaylist(state: PlaylistState, playlistId: string): PlaylistAdvance {
  const playlist = requirePlaylist(state, playlistId);
  if (!playlist.passages.length) return { state, completedCycle: false };
  const completedCycle = playlist.currentIndex === playlist.passages.length - 1;
  return {
    state: updatePlaylist(state, playlistId, current => ({
      ...current,
      currentIndex: completedCycle ? 0 : current.currentIndex + 1
    })),
    completedCycle
  };
}

function updatePlaylist(
  state: PlaylistState,
  playlistId: string,
  update: (playlist: MemorizationPlaylist) => MemorizationPlaylist
): PlaylistState {
  requirePlaylist(state, playlistId);
  return {
    ...state,
    playlists: state.playlists.map(playlist => playlist.id === playlistId ? update(playlist) : playlist)
  };
}

function requirePlaylist(state: PlaylistState, playlistId: string): MemorizationPlaylist {
  const playlist = state.playlists.find(item => item.id === playlistId);
  if (!playlist) throw new Error(`Playlist "${playlistId}" does not exist.`);
  return playlist;
}

function requireName(name: string): string {
  const normalized = name.trim();
  if (!normalized) throw new Error('Playlist name cannot be empty.');
  return normalized;
}

function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  requireIndex(items, fromIndex);
  requireIndex(items, toIndex);
  const reordered = [...items];
  const [item] = reordered.splice(fromIndex, 1);
  if (item === undefined) throw new Error('The item to reorder does not exist.');
  reordered.splice(toIndex, 0, item);
  return reordered;
}

function requireIndex(items: readonly unknown[], index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    throw new RangeError(`Index ${index} is outside the collection.`);
  }
}
