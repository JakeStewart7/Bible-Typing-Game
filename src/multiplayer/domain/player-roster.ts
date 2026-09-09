import { createPlayerState } from './player-state.ts';
import { normalizeBotDifficulty } from './settings.ts';
import type {
  BotDifficulty,
  PlayerKind,
  PlayerState
} from './types.ts';

const PLAYER_COLORS = ['#159a78', '#4b9ed6', '#c58b18', '#9b6bd6', '#df6b62', '#398f9b'];

export class PlayerRoster {
  private readonly players = new Map<string, PlayerState>();
  private nextBotNumber = 1;
  hostId = '';

  get size(): number {
    return this.players.size;
  }

  add(
    id: string,
    name: string,
    kind: PlayerKind,
    botDifficulty: BotDifficulty | null
  ): PlayerState {
    if (this.players.has(id)) throw new Error(`Player ${id} is already in the room.`);
    const normalizedName = name.trim().slice(0, 24);
    if (!normalizedName) throw new Error('A player name is required.');
    if (!this.hostId) this.hostId = id;
    const player = createPlayerState(
      id,
      normalizedName,
      PLAYER_COLORS[this.players.size % PLAYER_COLORS.length]!,
      kind,
      botDifficulty
    );
    this.players.set(id, player);
    return player;
  }

  addBot(requesterId: string, difficulty: BotDifficulty): PlayerState {
    this.requireHost(requesterId, 'add simulated players');
    const botNumber = this.nextBotNumber++;
    return this.add(`mock-bot-${botNumber}`, `Player ${botNumber}`, 'simulated', difficulty);
  }

  remove(id: string): void {
    this.players.delete(id);
    if (this.hostId === id) this.hostId = this.players.keys().next().value ?? '';
  }

  get(id: string): PlayerState | undefined {
    return this.players.get(id);
  }

  values(): IterableIterator<PlayerState> {
    return this.players.values();
  }

  every(predicate: (player: PlayerState) => boolean): boolean {
    return [...this.players.values()].every(predicate);
  }

  updateBotDifficulty(requesterId: string, playerId: string, difficulty: BotDifficulty): void {
    this.requireHost(requesterId, 'update bot difficulty');
    const bot = this.players.get(playerId);
    if (!bot || bot.kind !== 'simulated') throw new Error('The selected player is not a bot.');
    bot.botDifficulty = normalizeBotDifficulty(difficulty);
  }

  snapshot(): PlayerState[] {
    return [...this.players.values()].map(player => ({
      ...player,
      guess: { ...player.guess }
    }));
  }

  private requireHost(playerId: string, action: string): void {
    if (playerId !== this.hostId) throw new Error(`Only the host can ${action}.`);
  }
}
