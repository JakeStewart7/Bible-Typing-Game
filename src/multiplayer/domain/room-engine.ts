import { scorePassageGuess } from './scoring.ts';
import { getValidatedTypingLength } from '../../game/input.ts';
import { handleInput } from '../../game/input.ts';
import { calculateStats } from '../../game/stats.ts';
import { createGame, type Game } from '../../game/state.ts';
import {
  createPlayerState,
  normalizePassageGuess,
  resetPlayerForRound
} from './player-state.ts';
import {
  DEFAULT_ROOM_SETTINGS,
  normalizeBotDifficulty,
  normalizeRoomSettings
} from './settings.ts';
import {
  type MultiplayerPassage,
  type PassageProvider,
  type PlayerCommand,
  type PlayerKind,
  type PlayerState,
  type RoomListener,
  type RoomPhase,
  type RoomSettings,
  type RoomSnapshot
} from './types.ts';

const PLAYER_COLORS = ['#159a78', '#4b9ed6', '#c58b18', '#9b6bd6', '#df6b62', '#398f9b'];
export const GUESS_DURATION_MS = 30_000;

export class RoomEngine {
  readonly code: string;
  private readonly provider: PassageProvider;
  private readonly listeners = new Map<RoomListener, string>();
  private readonly players = new Map<string, PlayerState>();
  private readonly typingGames = new Map<string, Game>();
  private phase: RoomPhase = 'lobby';
  private hostId = '';
  private round = 0;
  private passage: MultiplayerPassage | null = null;
  private startingRound = false;
  private settings: RoomSettings;
  private guessingEndsAt: number | null = null;
  private readonly clock: () => number;
  private nextBotNumber = 1;

  constructor(
    code: string,
    provider: PassageProvider,
    settings: RoomSettings = DEFAULT_ROOM_SETTINGS,
    clock: () => number = Date.now
  ) {
    this.code = code;
    this.provider = provider;
    this.settings = normalizeRoomSettings(settings);
    this.clock = clock;
  }

  addPlayer(
    id: string,
    name: string,
    kind: PlayerKind = 'human',
    botDifficulty: RoomSettings['botDifficulty'] | null = null
  ): void {
    if (this.phase !== 'lobby') throw new Error('Players can only join while the room is in the lobby.');
    if (this.players.has(id)) throw new Error(`Player ${id} is already in the room.`);
    const normalizedName = name.trim().slice(0, 24);
    if (!normalizedName) throw new Error('A player name is required.');
    if (!this.hostId) this.hostId = id;
    this.players.set(id, createPlayerState(
      id,
      normalizedName,
      PLAYER_COLORS[this.players.size % PLAYER_COLORS.length]!,
      kind,
      kind === 'simulated' ? botDifficulty ?? this.settings.botDifficulty : null
    ));
    this.typingGames.set(id, createGame(this.passage?.text ?? ''));
    this.publish();
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    this.typingGames.delete(id);
    if (this.hostId === id) this.hostId = this.players.keys().next().value ?? '';
    this.advanceIfComplete(this.clock());
    if (this.phase === 'reveal' && this.everyPlayer(player => player.ready)) {
      for (const player of this.players.values()) player.ready = false;
    }
    this.publish();
  }

  subscribe(selfId: string, listener: RoomListener): () => void {
    this.listeners.set(listener, selfId);
    listener(this.snapshot(selfId));
    return () => this.listeners.delete(listener);
  }

  async dispatch(playerId: string, command: PlayerCommand): Promise<void> {
    this.tick(this.clock());
    const player = this.players.get(playerId);
    if (!player) throw new Error('This player is no longer in the room.');
    switch (command.type) {
      case 'START_ROUND':
        if (playerId !== this.hostId) throw new Error('Only the host can start a round.');
        if (this.phase !== 'lobby') throw new Error('A round can only be started from the lobby.');
        await this.startRound('lobby');
        return;
      case 'UPDATE_TYPING':
        this.updateTyping(player, command.typedText, command.sequence);
        break;
      case 'RESTART_TYPING':
        this.restartTyping(player);
        break;
      case 'UPDATE_GUESS':
        if (this.phase === 'guessing' && !player.guessSubmitted) {
          player.guess = normalizePassageGuess(command.guess);
        }
        break;
      case 'SUBMIT_GUESS':
        if (this.phase === 'guessing') player.guessSubmitted = true;
        break;
      case 'SET_READY':
        if (this.phase === 'reveal') player.ready = command.ready;
        break;
      case 'UPDATE_SETTINGS':
        this.updateSettings(playerId, command.settings);
        break;
      case 'ADD_BOT':
        this.addBot(playerId);
        break;
      case 'UPDATE_BOT_DIFFICULTY':
        this.updateBotDifficulty(playerId, command.playerId, command.difficulty);
        break;
    }
    this.advanceIfComplete(this.clock());
    this.publish();
    if (this.phase === 'reveal' && this.everyPlayer(current => current.ready)) {
      await this.startRound('reveal');
    }
  }

  getSnapshot(selfId: string): RoomSnapshot {
    return this.snapshot(selfId);
  }

  tick(now = this.clock()): void {
    if (this.phase === 'typing') {
      for (const player of this.players.values()) this.refreshTypingStats(player, now);
      this.publish();
      return;
    }
    if (this.phase === 'guessing' && this.guessingEndsAt !== null && now >= this.guessingEndsAt) {
      for (const player of this.players.values()) player.guessSubmitted = true;
      this.advanceIfComplete(now);
      this.publish();
    }
  }

  private async startRound(expectedPhase: 'lobby' | 'reveal'): Promise<void> {
    if (this.startingRound || this.phase !== expectedPhase) return;
    if (this.players.size < 2) throw new Error('At least two players are required to start.');
    this.startingRound = true;
    try {
      const passage = await this.provider.nextPassage(this.settings);
      const readyToAdvance = expectedPhase === 'lobby' || this.everyPlayer(player => player.ready);
      if (this.phase !== expectedPhase || this.players.size < 2 || !readyToAdvance) {
        throw new Error('The room changed while the passage was loading. Please try again.');
      }
      this.passage = passage;
      this.round++;
      this.phase = 'typing';
      for (const player of this.players.values()) {
        resetPlayerForRound(player);
        this.typingGames.set(player.id, createGame(passage.text));
      }
      this.publish();
    } finally {
      this.startingRound = false;
    }
  }

  private updateTyping(player: PlayerState, requestedText: string, sequence: number): void {
    if (this.phase !== 'typing' || !this.passage) return;
    if (player.typingComplete) return;
    if (!Number.isInteger(sequence) || sequence <= player.cursorSequence) return;
    player.cursorSequence = sequence;
    const typedText = String(requestedText).slice(0, this.passage.text.length);
    const game = this.typingGames.get(player.id) ?? createGame(this.passage.text);
    this.typingGames.set(player.id, game);
    handleInput(game, typedText, this.clock());
    player.typedText = game.typed.join('');
    player.cursor = player.typedText.length;
    player.progress = Math.max(
      player.progress,
      getValidatedTypingLength(this.passage.text, player.typedText)
    );
    player.typingComplete = player.typedText === this.passage.text;
    if (player.typingComplete) game.completedAt = this.clock();
    const stats = calculateStats(game, this.clock());
    player.wpm = stats.wpm;
    player.accuracy = stats.accuracy;
  }

  private refreshTypingStats(player: PlayerState, now: number): void {
    const game = this.typingGames.get(player.id);
    if (!game || game.startTime === null) return;
    const stats = calculateStats(game, now);
    player.wpm = stats.wpm;
    player.accuracy = stats.accuracy;
  }

  private restartTyping(player: PlayerState): void {
    if (this.phase !== 'typing' || !this.passage || player.typingComplete) return;
    resetPlayerForRound(player);
    this.typingGames.set(player.id, createGame(this.passage.text));
  }

  private updateSettings(playerId: string, settings: RoomSettings): void {
    if (playerId !== this.hostId) throw new Error('Only the host can update room settings.');
    if (this.phase !== 'lobby' && this.phase !== 'reveal') {
      throw new Error('Room settings can only change between rounds.');
    }
    this.settings = normalizeRoomSettings(settings);
  }

  private addBot(hostId: string): void {
    if (hostId !== this.hostId) throw new Error('Only the host can add simulated players.');
    if (this.phase !== 'lobby') throw new Error('Simulated players can only be added in the lobby.');
    const id = `mock-bot-${this.nextBotNumber}`;
    this.addPlayer(
      id,
      `Player ${this.nextBotNumber++}`,
      'simulated',
      this.settings.botDifficulty
    );
  }

  private updateBotDifficulty(
    hostId: string,
    playerId: string,
    difficulty: RoomSettings['botDifficulty']
  ): void {
    if (hostId !== this.hostId) throw new Error('Only the host can update bot difficulty.');
    if (this.phase !== 'lobby' && this.phase !== 'reveal') {
      throw new Error('Bot difficulty can only change between rounds.');
    }
    const bot = this.players.get(playerId);
    if (!bot || bot.kind !== 'simulated') throw new Error('The selected player is not a bot.');
    bot.botDifficulty = normalizeBotDifficulty(difficulty);
  }

  private advanceIfComplete(now: number): void {
    if (!this.players.size || !this.passage) return;
    if (this.phase === 'typing' && this.everyPlayer(player => player.typingComplete)) {
      if (this.settings.includeGuessing) {
        this.phase = 'guessing';
        this.guessingEndsAt = now + GUESS_DURATION_MS;
      } else {
        this.phase = 'reveal';
        this.guessingEndsAt = null;
      }
    } else if (this.phase === 'guessing' && this.everyPlayer(player => player.guessSubmitted)) {
      for (const player of this.players.values()) {
        player.score = scorePassageGuess(player.guess, this.passage.reference);
      }
      this.phase = 'reveal';
      this.guessingEndsAt = null;
    }
  }

  private everyPlayer(predicate: (player: PlayerState) => boolean): boolean {
    return [...this.players.values()].every(predicate);
  }

  private snapshot(selfId: string): RoomSnapshot {
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      selfId,
      round: this.round,
      passageText: this.phase === 'lobby' ? null : this.passage?.text ?? null,
      revealedReference: this.phase === 'reveal' ? this.passage?.reference ?? null : null,
      guessingEndsAt: this.guessingEndsAt,
      settings: { ...this.settings },
      players: [...this.players.values()].map(player => ({
        ...player,
        guess: { ...player.guess }
      }))
    };
  }

  private publish(): void {
    for (const [listener, selfId] of this.listeners) {
      listener(this.snapshot(selfId));
    }
  }
}
