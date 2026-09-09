import { scorePassageGuess } from './scoring.ts';
import {
  EMPTY_GUESS,
  type MultiplayerPassage,
  type PassageGuess,
  type PassageProvider,
  type PlayerCommand,
  type PlayerKind,
  type PlayerState,
  type RoomListener,
  type RoomPhase,
  type RoomSnapshot
} from './types.ts';

const PLAYER_COLORS = ['#159a78', '#4b9ed6', '#c58b18', '#9b6bd6', '#df6b62', '#398f9b'];

export class RoomEngine {
  readonly code: string;
  private readonly provider: PassageProvider;
  private readonly listeners = new Map<RoomListener, string>();
  private readonly players = new Map<string, PlayerState>();
  private phase: RoomPhase = 'lobby';
  private hostId = '';
  private round = 0;
  private passage: MultiplayerPassage | null = null;
  private startingRound = false;

  constructor(code: string, provider: PassageProvider) {
    this.code = code;
    this.provider = provider;
  }

  addPlayer(id: string, name: string, kind: PlayerKind = 'human'): void {
    if (this.phase !== 'lobby') throw new Error('Players can only join while the room is in the lobby.');
    if (this.players.has(id)) throw new Error(`Player ${id} is already in the room.`);
    const normalizedName = name.trim().slice(0, 24);
    if (!normalizedName) throw new Error('A player name is required.');
    if (!this.hostId) this.hostId = id;
    this.players.set(id, {
      id,
      name: normalizedName,
      color: PLAYER_COLORS[this.players.size % PLAYER_COLORS.length]!,
      kind,
      cursor: 0,
      cursorSequence: 0,
      guess: { ...EMPTY_GUESS },
      typingComplete: false,
      guessSubmitted: false,
      ready: false,
      score: null
    });
    this.publish();
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    if (this.hostId === id) this.hostId = this.players.keys().next().value ?? '';
    this.advanceIfComplete();
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
    const player = this.players.get(playerId);
    if (!player) throw new Error('This player is no longer in the room.');
    switch (command.type) {
      case 'START_ROUND':
        if (playerId !== this.hostId) throw new Error('Only the host can start a round.');
        if (this.phase !== 'lobby') throw new Error('A round can only be started from the lobby.');
        await this.startRound('lobby');
        return;
      case 'UPDATE_CURSOR':
        this.updateCursor(player, command.position, command.sequence);
        break;
      case 'COMPLETE_PASSAGE':
        if (this.phase === 'typing' && this.passage && player.cursor === this.passage.text.length) {
          player.typingComplete = true;
        }
        break;
      case 'UPDATE_GUESS':
        if (this.phase === 'guessing' && !player.guessSubmitted) player.guess = normalizeGuess(command.guess);
        break;
      case 'SUBMIT_GUESS':
        if (this.phase === 'guessing') player.guessSubmitted = true;
        break;
      case 'SET_READY':
        if (this.phase === 'reveal') player.ready = command.ready;
        break;
    }
    this.advanceIfComplete();
    this.publish();
    if (this.phase === 'reveal' && this.everyPlayer(current => current.ready)) {
      await this.startRound('reveal');
    }
  }

  getSnapshot(selfId: string): RoomSnapshot {
    return this.snapshot(selfId);
  }

  private async startRound(expectedPhase: 'lobby' | 'reveal'): Promise<void> {
    if (this.startingRound || this.phase !== expectedPhase) return;
    if (this.players.size < 2) throw new Error('At least two players are required to start.');
    this.startingRound = true;
    try {
      const passage = await this.provider.nextPassage();
      const readyToAdvance = expectedPhase === 'lobby' || this.everyPlayer(player => player.ready);
      if (this.phase !== expectedPhase || this.players.size < 2 || !readyToAdvance) {
        throw new Error('The room changed while the passage was loading. Please try again.');
      }
      this.passage = passage;
      this.round++;
      this.phase = 'typing';
      for (const player of this.players.values()) resetPlayer(player);
      this.publish();
    } finally {
      this.startingRound = false;
    }
  }

  private updateCursor(player: PlayerState, requestedPosition: number, sequence: number): void {
    if (this.phase !== 'typing' || !this.passage) return;
    if (!Number.isInteger(sequence) || sequence <= player.cursorSequence) return;
    player.cursorSequence = sequence;
    player.cursor = Math.min(Math.max(0, Math.floor(requestedPosition)), this.passage.text.length);
  }

  private advanceIfComplete(): void {
    if (!this.players.size || !this.passage) return;
    if (this.phase === 'typing' && this.everyPlayer(player => player.typingComplete)) {
      this.phase = 'guessing';
    } else if (this.phase === 'guessing' && this.everyPlayer(player => player.guessSubmitted)) {
      for (const player of this.players.values()) {
        player.score = scorePassageGuess(player.guess, this.passage.reference);
      }
      this.phase = 'reveal';
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

function resetPlayer(player: PlayerState): void {
  player.cursor = 0;
  player.cursorSequence = 0;
  player.guess = { ...EMPTY_GUESS };
  player.typingComplete = false;
  player.guessSubmitted = false;
  player.ready = false;
  player.score = null;
}

function normalizeGuess(guess: PassageGuess): PassageGuess {
  const positiveInteger = (value: number | null) =>
    value === null || !Number.isFinite(value) ? null : Math.max(1, Math.floor(value));
  return {
    book: guess.book.trim().slice(0, 40),
    chapter: positiveInteger(guess.chapter),
    startVerse: positiveInteger(guess.startVerse),
    endVerse: positiveInteger(guess.endVerse)
  };
}
