import { scorePassageGuess } from './scoring.ts';
import {
  normalizePassageGuess,
} from './player-state.ts';
import { PlayerRoster } from './player-roster.ts';
import { TypingSessions } from './typing-sessions.ts';
import {
  DEFAULT_ROOM_SETTINGS,
  GUESS_DURATION_MS,
  ROUND_COUNTDOWN_MS,
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

export class RoomEngine {
  readonly code: string;
  private readonly provider: PassageProvider;
  private readonly listeners = new Map<RoomListener, string>();
  private readonly roster = new PlayerRoster();
  private readonly typingSessions = new TypingSessions();
  private phase: RoomPhase = 'lobby';
  private round = 0;
  private passage: MultiplayerPassage | null = null;
  private startingRound = false;
  private settings: RoomSettings;
  private guessingEndsAt: number | null = null;
  private countdownEndsAt: number | null = null;
  private encouragementId = 0;
  private encouragement: RoomSnapshot['encouragement'] = null;
  private readonly clock: () => number;
  private readonly countdownDurationMs: number;

  constructor(
    code: string,
    provider: PassageProvider,
    settings: RoomSettings = DEFAULT_ROOM_SETTINGS,
    clock: () => number = Date.now,
    countdownDurationMs = ROUND_COUNTDOWN_MS
  ) {
    this.code = code;
    this.provider = provider;
    this.settings = normalizeRoomSettings(settings);
    this.clock = clock;
    this.countdownDurationMs = countdownDurationMs;
  }

  addPlayer(
    id: string,
    name: string,
    kind: PlayerKind = 'human',
    botDifficulty: RoomSettings['botDifficulty'] | null = null
  ): void {
    if (this.phase !== 'lobby') throw new Error('Players can only join while the room is in the lobby.');
    this.roster.add(
      id,
      name,
      kind,
      kind === 'simulated' ? botDifficulty ?? this.settings.botDifficulty : null
    );
    this.typingSessions.add(id, this.passage?.text);
    this.publish();
  }

  removePlayer(id: string): void {
    this.roster.remove(id);
    this.typingSessions.remove(id);
    this.advanceIfComplete(this.clock());
    if (this.phase === 'reveal' && this.everyPlayer(player => player.ready)) {
      for (const player of this.roster.values()) player.ready = false;
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
    const player = this.roster.get(playerId);
    if (!player) throw new Error('This player is no longer in the room.');
    switch (command.type) {
      case 'START_ROUND':
        if (playerId !== this.roster.hostId) throw new Error('Only the host can start a round.');
        if (this.phase !== 'lobby') throw new Error('A round can only be started from the lobby.');
        await this.startRound('lobby');
        return;
      case 'UPDATE_TYPING':
        this.updateTyping(player, command.typedText, command.sequence);
        break;
      case 'RESTART_TYPING':
        this.restartTyping(player);
        break;
      case 'SEND_ENCOURAGEMENT':
        this.sendEncouragement(player, command.word);
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
      if (this.countdownEndsAt !== null) {
        if (now < this.countdownEndsAt) {
          this.publish();
          return;
        }
        this.countdownEndsAt = null;
      }
      for (const player of this.roster.values()) this.typingSessions.refresh(player, now);
      this.publish();
      return;
    }
    if (this.phase === 'guessing' && this.guessingEndsAt !== null && now >= this.guessingEndsAt) {
      for (const player of this.roster.values()) player.guessSubmitted = true;
      this.advanceIfComplete(now);
      this.publish();
    }
  }

  private async startRound(expectedPhase: 'lobby' | 'reveal'): Promise<void> {
    if (this.startingRound || this.phase !== expectedPhase) return;
    if (this.roster.size < 2) throw new Error('At least two players are required to start.');
    this.startingRound = true;
    try {
      const passage = await this.provider.nextPassage(this.settings);
      const readyToAdvance = expectedPhase === 'lobby' || this.everyPlayer(player => player.ready);
      if (this.phase !== expectedPhase || this.roster.size < 2 || !readyToAdvance) {
        throw new Error('The room changed while the passage was loading. Please try again.');
      }
      this.passage = passage;
      this.round++;
      this.phase = 'typing';
      this.countdownEndsAt = this.clock() + this.countdownDurationMs;
      this.encouragement = null;
      for (const player of this.roster.values()) {
        this.typingSessions.reset(player, passage.text);
      }
      this.publish();
    } finally {
      this.startingRound = false;
    }
  }

  private updateTyping(player: PlayerState, requestedText: string, sequence: number): void {
    if (this.phase !== 'typing' || !this.passage) return;
    if (this.countdownEndsAt !== null) {
      if (this.clock() < this.countdownEndsAt) return;
      this.countdownEndsAt = null;
    }
    this.typingSessions.update(
      player,
      this.passage.text,
      requestedText,
      sequence,
      this.clock()
    );
  }

  private restartTyping(player: PlayerState): void {
    if (
      this.phase !== 'typing'
      || !this.passage
      || this.countdownEndsAt !== null
      || player.typingComplete
    ) return;
    this.typingSessions.reset(player, this.passage.text);
  }

  private sendEncouragement(player: PlayerState, rawWord: string): void {
    if (
      this.phase !== 'typing'
      || this.countdownEndsAt !== null
      || this.everyPlayer(current => current.typingComplete)
    ) return;
    const word = rawWord.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!/^[\p{L}\p{N}'-]+$/u.test(word)) return;
    this.encouragement = {
      id: ++this.encouragementId,
      playerName: player.name,
      word
    };
  }

  private updateSettings(playerId: string, settings: RoomSettings): void {
    if (playerId !== this.roster.hostId) throw new Error('Only the host can update room settings.');
    if (this.phase !== 'lobby' && this.phase !== 'reveal') {
      throw new Error('Room settings can only change between rounds.');
    }
    this.settings = normalizeRoomSettings(settings);
  }

  private addBot(hostId: string): void {
    if (this.phase !== 'lobby') throw new Error('Simulated players can only be added in the lobby.');
    const bot = this.roster.addBot(hostId, this.settings.botDifficulty);
    this.typingSessions.add(bot.id);
  }

  private updateBotDifficulty(
    hostId: string,
    playerId: string,
    difficulty: RoomSettings['botDifficulty']
  ): void {
    if (this.phase !== 'lobby' && this.phase !== 'reveal') {
      throw new Error('Bot difficulty can only change between rounds.');
    }
    this.roster.updateBotDifficulty(hostId, playerId, difficulty);
  }

  private advanceIfComplete(now: number): void {
    if (!this.roster.size || !this.passage) return;
    if (this.phase === 'typing' && this.everyPlayer(player => player.typingComplete)) {
      if (this.settings.includeGuessing) {
        this.phase = 'guessing';
        this.guessingEndsAt = now + GUESS_DURATION_MS;
      } else {
        this.phase = 'reveal';
        this.guessingEndsAt = null;
      }
    } else if (this.phase === 'guessing' && this.everyPlayer(player => player.guessSubmitted)) {
      for (const player of this.roster.values()) {
        player.score = scorePassageGuess(player.guess, this.passage.reference);
      }
      this.phase = 'reveal';
      this.guessingEndsAt = null;
    }
  }

  private everyPlayer(predicate: (player: PlayerState) => boolean): boolean {
    return this.roster.every(predicate);
  }

  private snapshot(selfId: string): RoomSnapshot {
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.roster.hostId,
      selfId,
      round: this.round,
      passageText: this.phase === 'lobby' ? null : this.passage?.text ?? null,
      revealedReference: this.phase === 'reveal' ? this.passage?.reference ?? null : null,
      guessingEndsAt: this.guessingEndsAt,
      countdownEndsAt: this.countdownEndsAt,
      encouragement: this.encouragement,
      settings: { ...this.settings },
      players: this.roster.snapshot()
    };
  }

  private publish(): void {
    for (const [listener, selfId] of this.listeners) {
      listener(this.snapshot(selfId));
    }
  }
}
