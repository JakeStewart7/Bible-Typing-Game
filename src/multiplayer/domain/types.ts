export type RoomPhase = 'lobby' | 'typing' | 'guessing' | 'reveal';
export type PlayerKind = 'human' | 'simulated';

export type PassageReference = {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
};

export type MultiplayerPassage = {
  text: string;
  reference: PassageReference;
};

export type PassageGuess = {
  book: string;
  chapter: number | null;
  startVerse: number | null;
  endVerse: number | null;
};

export type PlayerState = {
  id: string;
  name: string;
  color: string;
  kind: PlayerKind;
  cursor: number;
  cursorSequence: number;
  guess: PassageGuess;
  typingComplete: boolean;
  guessSubmitted: boolean;
  ready: boolean;
  score: number | null;
};

export type RoomSnapshot = {
  code: string;
  phase: RoomPhase;
  hostId: string;
  selfId: string;
  round: number;
  passageText: string | null;
  revealedReference: PassageReference | null;
  players: readonly PlayerState[];
};

export type PlayerCommand =
  | { type: 'START_ROUND' }
  | { type: 'UPDATE_CURSOR'; position: number; sequence: number }
  | { type: 'UPDATE_GUESS'; guess: PassageGuess }
  | { type: 'SUBMIT_GUESS' }
  | { type: 'SET_READY'; ready: boolean };

export type RoomListener = (snapshot: RoomSnapshot) => void;

export interface RoomConnection {
  readonly playerId: string;
  readonly code: string;
  subscribe(listener: RoomListener): () => void;
  send(command: PlayerCommand): Promise<void>;
  disconnect(): void;
}

export interface MultiplayerClient {
  createRoom(playerName: string): Promise<RoomConnection>;
  joinRoom(code: string, playerName: string): Promise<RoomConnection>;
}

export interface PassageProvider {
  nextPassage(): Promise<MultiplayerPassage>;
}

export const EMPTY_GUESS: PassageGuess = {
  book: '',
  chapter: null,
  startVerse: null,
  endVerse: null
};
