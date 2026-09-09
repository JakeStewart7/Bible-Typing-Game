import type { BotDifficulty, PassageLength, RoomSettings } from './types';

export const GUESS_DURATION_MS = 30_000;

export const BOT_DIFFICULTY_OPTIONS: Record<BotDifficulty, {
  label: string;
  accuracy: number;
  minimumWpm: number;
  maximumWpm: number;
}> = {
  easy: { label: 'Easy', accuracy: .85, minimumWpm: 20, maximumWpm: 30 },
  medium: { label: 'Normal', accuracy: .9, minimumWpm: 40, maximumWpm: 50 },
  hard: { label: 'Hard', accuracy: .95, minimumWpm: 70, maximumWpm: 80 },
  'very-hard': { label: 'Very hard', accuracy: .96, minimumWpm: 90, maximumWpm: 110 },
  extreme: { label: 'Extreme', accuracy: .98, minimumWpm: 110, maximumWpm: 130 }
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
  passageLength: 'medium',
  includeGuessing: true
};

export function normalizeRoomSettings(settings: RoomSettings): RoomSettings {
  return {
    botDifficulty: settings.botDifficulty in BOT_DIFFICULTY_OPTIONS
      ? settings.botDifficulty
      : DEFAULT_ROOM_SETTINGS.botDifficulty,
    passageLength: settings.passageLength in PASSAGE_LENGTH_OPTIONS
      ? settings.passageLength
      : DEFAULT_ROOM_SETTINGS.passageLength,
    includeGuessing: settings.includeGuessing !== false
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
