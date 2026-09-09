import { RoomEngine } from '../domain/room-engine.ts';
import { BOT_DIFFICULTY_OPTIONS, DEFAULT_ROOM_SETTINGS } from '../domain/settings.ts';
import type {
  BotDifficulty,
  MultiplayerClient,
  PassageGuess,
  PassageProvider,
  PlayerCommand,
  RoomConnection,
  RoomListener,
  RoomPhase,
  RoomSettings
} from '../domain/types.ts';

const rooms = new Map<string, RoomEngine>();
let nextPlayerNumber = 1;
export const MOCK_REFRESH_INTERVAL_MS = 100;

type BotSchedule = {
  round: number;
  phase: RoomPhase;
  difficulty: BotDifficulty;
  wpm: number;
  nextActionAt: number;
};

export class MockMultiplayerClient implements MultiplayerClient {
  private readonly provider: PassageProvider;
  private readonly random: () => number;
  private readonly clock: () => number;
  private readonly botSchedules = new Map<string, BotSchedule>();
  private activeRoom: RoomEngine | null = null;

  constructor(
    provider: PassageProvider,
    random: () => number = Math.random,
    clock: () => number = Date.now
  ) {
    this.provider = provider;
    this.random = random;
    this.clock = clock;
  }

  async createRoom(
    playerName: string,
    settings: RoomSettings = DEFAULT_ROOM_SETTINGS
  ): Promise<RoomConnection> {
    const code = createRoomCode();
    const room = new RoomEngine(code, this.provider, settings, this.clock);
    rooms.set(code, room);
    return this.connect(room, playerName);
  }

  async joinRoom(code: string, playerName: string): Promise<RoomConnection> {
    const normalizedCode = code.trim().toUpperCase();
    const room = rooms.get(normalizedCode);
    if (!room) throw new Error('That mock lobby does not exist in this browser session.');
    return this.connect(room, playerName);
  }

  async advance(now = this.clock()): Promise<void> {
    const room = this.activeRoom;
    if (!room) return;
    room.tick(now);
    const snapshot = room.getSnapshot('');
    for (const player of snapshot.players.filter(candidate => candidate.kind === 'simulated')) {
      if (snapshot.phase === 'typing' && snapshot.passageText) {
        const schedule = this.getBotSchedule(
          player.id,
          snapshot.round,
          snapshot.phase,
          player.botDifficulty ?? snapshot.settings.botDifficulty,
          now
        );
        let typedText = player.typedText;
        let sequence = player.cursorSequence;
        while (now >= schedule.nextActionAt && typedText !== snapshot.passageText) {
          typedText = nextBotTyping(
            snapshot.passageText,
            typedText,
            player.botDifficulty ?? snapshot.settings.botDifficulty,
            this.random
          );
          await room.dispatch(player.id, {
            type: 'UPDATE_TYPING',
            typedText,
            sequence: ++sequence
          });
          schedule.nextActionAt += nextTypingDelayMs(
            schedule.wpm,
            typedText,
            schedule.difficulty,
            this.random
          );
        }
      } else if (snapshot.phase === 'guessing' && !player.guessSubmitted) {
        const schedule = this.getBotSchedule(
          player.id,
          snapshot.round,
          snapshot.phase,
          player.botDifficulty ?? snapshot.settings.botDifficulty,
          now
        );
        if (now < schedule.nextActionAt) continue;
        await room.dispatch(player.id, { type: 'UPDATE_GUESS', guess: simulatedGuess(player.id) });
        await room.dispatch(player.id, { type: 'SUBMIT_GUESS' });
      } else if (snapshot.phase === 'reveal' && !player.ready) {
        await room.dispatch(player.id, { type: 'SET_READY', ready: true });
      }
    }
  }

  private getBotSchedule(
    playerId: string,
    round: number,
    phase: RoomPhase,
    difficulty: BotDifficulty,
    now: number
  ): BotSchedule {
    const current = this.botSchedules.get(playerId);
    if (current?.round === round && current.phase === phase) return current;
    const option = BOT_DIFFICULTY_OPTIONS[difficulty];
    const targetWpm = option.minimumWpm
      + this.random() * (option.maximumWpm - option.minimumWpm);
    const expectedActionsPerCorrectCharacter = (2 - option.accuracy) / option.accuracy;
    const schedule = {
      round,
      phase,
      difficulty,
      wpm: targetWpm * expectedActionsPerCorrectCharacter,
      nextActionAt: phase === 'guessing' ? now + 2_000 + this.random() * 4_000 : now
    };
    this.botSchedules.set(playerId, schedule);
    return schedule;
  }

  private connect(room: RoomEngine, playerName: string): RoomConnection {
    const playerId = createPlayerId();
    room.addPlayer(playerId, playerName);
    this.activeRoom = room;
    let disconnected = false;
    return {
      playerId,
      code: room.code,
      subscribe(listener: RoomListener): () => void {
        if (disconnected) throw new Error('Cannot subscribe after disconnecting.');
        return room.subscribe(playerId, listener);
      },
      send(command: PlayerCommand): Promise<void> {
        if (disconnected) return Promise.reject(new Error('Cannot send after disconnecting.'));
        return room.dispatch(playerId, command);
      },
      disconnect(): void {
        if (disconnected) return;
        disconnected = true;
        room.removePlayer(playerId);
      }
    };
  }
}

export function nextBotTyping(
  passage: string,
  typedText: string,
  difficulty: BotDifficulty,
  random: () => number
): string {
  const mismatchIndex = firstMismatchIndex(passage, typedText);
  if (mismatchIndex !== -1) return typedText.slice(0, -1);
  const expected = passage[typedText.length];
  if (expected === undefined) return typedText;
  if (random() < BOT_DIFFICULTY_OPTIONS[difficulty].accuracy) return typedText + expected;
  return typedText + wrongCharacter(expected, random);
}

export function nextTypingDelayMs(
  wpm: number,
  typedText: string,
  difficulty: BotDifficulty,
  random: () => number
): number {
  const characterDelay = 60_000 / (wpm * 5);
  const wordPauseSpread = difficulty === 'easy' ? .5 : difficulty === 'medium' ? .3 : .15;
  const characterSpread = difficulty === 'easy' ? .2 : difficulty === 'medium' ? .12 : .06;
  const spread = typedText.endsWith(' ') ? wordPauseSpread : characterSpread;
  const intervalFactor = 1 - spread + random() * spread * 2;
  return characterDelay * intervalFactor;
}

function firstMismatchIndex(expected: string, typed: string): number {
  return [...typed].findIndex((character, index) => character !== expected[index]);
}

function wrongCharacter(expected: string, random: () => number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let replacement = alphabet[Math.floor(random() * alphabet.length)] ?? 'x';
  if (replacement.toLowerCase() === expected.toLowerCase()) {
    replacement = replacement === 'z' ? 'y' : String.fromCharCode(replacement.charCodeAt(0) + 1);
  }
  return replacement;
}

function createRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 5 }, () =>
      alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

function createPlayerId(): string {
  return `mock-player-${nextPlayerNumber++}`;
}

function simulatedGuess(playerId: string): PassageGuess {
  const parts = playerId.split('-');
  const offset = Number(parts[parts.length - 1]) % 3;
  return {
    book: offset === 0 ? 'John' : 'Psalms',
    chapter: offset === 0 ? 3 : 23,
    startVerse: 1 + offset,
    endVerse: 4 + offset
  };
}
