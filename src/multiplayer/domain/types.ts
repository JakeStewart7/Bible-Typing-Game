export type RoomPhase = 'lobby' | 'typing' | 'guessing' | 'reveal' | 'summary';
export type PlayerKind = 'human' | 'simulated';
export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'very-hard' | 'extreme';
export type PassageLength = 'very-short' | 'short' | 'medium' | 'long' | 'very-long';

export type RoomSettings = {
  botDifficulty: BotDifficulty;
  passageLength: PassageLength;
  includeGuessing: boolean;
  rounds: number;
};

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
  botDifficulty: BotDifficulty | null;
  typedText: string;
  cursor: number;
  progress: number;
  cursorSequence: number;
  guess: PassageGuess;
  typingComplete: boolean;
  guessSubmitted: boolean;
  ready: boolean;
  score: number | null;
  totalScore: number;
  wpm: number;
  accuracy: number;
};

export type Encouragement = {
  id: number;
  playerName: string;
  word: string;
};

export type RoomSnapshot = {
  code: string;
  phase: RoomPhase;
  hostId: string;
  selfId: string;
  round: number;
  passageText: string | null;
  revealedReference: PassageReference | null;
  guessingEndsAt: number | null;
  countdownEndsAt: number | null;
  encouragement: Encouragement | null;
  settings: RoomSettings;
  players: readonly PlayerState[];
};

export type PlayerCommand =
  | { type: 'START_ROUND' }
  | { type: 'UPDATE_TYPING'; typedText: string; sequence: number }
  | { type: 'FORCE_FINISH_TYPING'; playerId: string }
  | { type: 'FORCE_FINISH_ALL_TYPING' }
  | { type: 'SEND_ENCOURAGEMENT'; word: string }
  | { type: 'UPDATE_GUESS'; guess: PassageGuess }
  | { type: 'SUBMIT_GUESS' }
  | { type: 'SET_READY'; ready: boolean }
  | { type: 'UPDATE_SETTINGS'; settings: RoomSettings }
  | { type: 'ADD_BOT' }
  | { type: 'UPDATE_BOT_DIFFICULTY'; playerId: string; difficulty: BotDifficulty };

export type RoomListener = (snapshot: RoomSnapshot) => void;

export interface RoomConnection {
  readonly playerId: string;
  readonly code: string;
  subscribe(listener: RoomListener): () => void;
  send(command: PlayerCommand): Promise<void>;
  disconnect(): void;
}

export interface MultiplayerClient {
  createRoom(playerName: string, settings: RoomSettings): Promise<RoomConnection>;
  joinRoom(code: string, playerName: string): Promise<RoomConnection>;
  advance?(): Promise<void>;
}

export interface PassageProvider {
  nextPassage(settings: RoomSettings): Promise<MultiplayerPassage>;
}

export const EMPTY_GUESS: PassageGuess = {
  book: '',
  chapter: null,
  startVerse: null,
  endVerse: null
};
