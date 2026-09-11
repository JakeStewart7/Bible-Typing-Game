import {
  EMPTY_GUESS,
  type BotDifficulty,
  type PassageGuess,
  type PlayerKind,
  type PlayerState
} from './types.ts';

export function createPlayerState(
  id: string,
  name: string,
  color: string,
  kind: PlayerKind,
  botDifficulty: BotDifficulty | null
): PlayerState {
  return {
    id, name, color, kind, botDifficulty,
    typedText: '',
    cursor: 0,
    progress: 0,
    cursorSequence: 0,
    guess: { ...EMPTY_GUESS },
    typingComplete: false,
    guessSubmitted: false,
    ready: false,
    score: null,
    totalScore: 0,
    wpm: 0,
    accuracy: 100
  };
}

export function resetPlayerForRound(player: PlayerState): void {
  player.typedText = '';
  player.cursor = 0;
  player.progress = 0;
  player.cursorSequence = 0;
  player.guess = { ...EMPTY_GUESS };
  player.typingComplete = false;
  player.guessSubmitted = false;
  player.ready = false;
  player.score = null;
  player.wpm = 0;
  player.accuracy = 100;
}

export function normalizePassageGuess(guess: PassageGuess): PassageGuess {
  const positiveInteger = (value: number | null) =>
    value === null || !Number.isFinite(value) ? null : Math.max(1, Math.floor(value));
  return {
    book: guess.book.trim().slice(0, 40),
    chapter: positiveInteger(guess.chapter),
    startVerse: positiveInteger(guess.startVerse),
    endVerse: positiveInteger(guess.endVerse)
  };
}
