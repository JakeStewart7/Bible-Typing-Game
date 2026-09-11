import type { BotDifficulty, PassageLength, RoomSettings } from './types';

export const GUESS_DURATION_MS = 30_000;
export const ROUND_COUNTDOWN_MS = 3_000;
export const ROUND_OPTIONS: Record<number, string> = {
  1: '1 round',
  2: '2 rounds',
  3: '3 rounds',
  4: '4 rounds',
  5: '5 rounds',
  6: '6 rounds',
  7: '7 rounds',
  8: '8 rounds',
  9: '9 rounds',
  10: '10 rounds'
};

export const BOT_DIFFICULTY_OPTIONS: Record<BotDifficulty, {
  label: string;
  accuracy: number;
  minimumWpm: number;
  maximumWpm: number;
  characterTimingVariation: number;
  wordTimingVariation: number;
}> = {
  easy: {
    label: 'Easy', accuracy: .85, minimumWpm: 20, maximumWpm: 30,
    characterTimingVariation: .65, wordTimingVariation: .9
  },
  medium: {
    label: 'Normal', accuracy: .9, minimumWpm: 40, maximumWpm: 50,
    characterTimingVariation: .5, wordTimingVariation: .75
  },
  hard: {
    label: 'Hard', accuracy: .95, minimumWpm: 70, maximumWpm: 80,
    characterTimingVariation: .25, wordTimingVariation: .42
  },
  'very-hard': {
    label: 'Very hard', accuracy: .96, minimumWpm: 90, maximumWpm: 110,
    characterTimingVariation: .22, wordTimingVariation: .36
  },
  extreme: {
    label: 'Extreme', accuracy: .98, minimumWpm: 110, maximumWpm: 130,
    characterTimingVariation: .18, wordTimingVariation: .3
  }
};

export const PASSAGE_LENGTH_OPTIONS: Record<PassageLength, {
  label: string;
  maximumCharacters: number;
}> = {
  'very-short': { label: 'Very short', maximumCharacters: 60 },
  short: { label: 'Short', maximumCharacters: 120 },
  medium: { label: 'Medium', maximumCharacters: 250 },
  long: { label: 'Long', maximumCharacters: 500 },
  'very-long': { label: 'Very long', maximumCharacters: 1000 }
};

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  botDifficulty: 'medium',
  passageLength: 'very-short',
  includeGuessing: true,
  rounds: 3
};

export function normalizeRoomSettings(settings: RoomSettings): RoomSettings {
  return {
    botDifficulty: settings.botDifficulty in BOT_DIFFICULTY_OPTIONS
      ? settings.botDifficulty
      : DEFAULT_ROOM_SETTINGS.botDifficulty,
    passageLength: settings.passageLength in PASSAGE_LENGTH_OPTIONS
      ? settings.passageLength
      : DEFAULT_ROOM_SETTINGS.passageLength,
    includeGuessing: settings.includeGuessing !== false,
    rounds: typeof settings.rounds === 'number' && settings.rounds in ROUND_OPTIONS
      ? settings.rounds
      : DEFAULT_ROOM_SETTINGS.rounds
  };
}

export function normalizeBotDifficulty(value: string): BotDifficulty {
  switch (value) {
    case 'easy':
    case 'medium':
    case 'hard':
    case 'very-hard':
    case 'extreme':
      return value;
    default:
      return DEFAULT_ROOM_SETTINGS.botDifficulty;
  }
}
