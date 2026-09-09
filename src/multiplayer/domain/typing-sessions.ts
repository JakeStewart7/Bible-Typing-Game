import { createGame, type Game } from '../../game/state.ts';
import { calculateStats } from '../../game/stats.ts';
import { applyTypingInput } from '../../game/typing-update.ts';
import { resetPlayerForRound } from './player-state.ts';
import type { PlayerState } from './types.ts';

export class TypingSessions {
  private readonly games = new Map<string, Game>();

  add(playerId: string, passageText = ''): void {
    this.games.set(playerId, createGame(passageText));
  }

  remove(playerId: string): void {
    this.games.delete(playerId);
  }

  reset(player: PlayerState, passageText: string): void {
    resetPlayerForRound(player);
    this.games.set(player.id, createGame(passageText));
  }

  update(
    player: PlayerState,
    passageText: string,
    requestedText: string,
    sequence: number,
    now: number
  ): void {
    if (player.typingComplete || !Number.isInteger(sequence) || sequence <= player.cursorSequence) {
      return;
    }
    player.cursorSequence = sequence;
    const game = this.games.get(player.id) ?? createGame(passageText);
    this.games.set(player.id, game);
    const update = applyTypingInput(game, String(requestedText).slice(0, passageText.length), now);
    player.typedText = update.typedText;
    player.cursor = update.typedText.length;
    player.progress = Math.max(player.progress, update.validatedLength);
    player.typingComplete = update.completed;
    player.wpm = update.stats.wpm;
    player.accuracy = update.stats.accuracy;
  }

  refresh(player: PlayerState, now: number): void {
    const game = this.games.get(player.id);
    if (!game || game.startTime === null) return;
    const stats = calculateStats(game, now);
    player.wpm = stats.wpm;
    player.accuracy = stats.accuracy;
  }
}
