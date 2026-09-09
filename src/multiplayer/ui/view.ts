import type { PlayerState, RoomPhase, RoomSnapshot } from '../domain/types';
import { createGame, type Game } from '../../game/state';
import { getTypingProgressLength } from '../../game/stats';
import {
  renderTypingExperience,
  updateTypingInput,
  type TypingInputUpdate
} from '../../typing/session';
import { renderPeerCarets } from './peer-carets';

const PHASE_LABELS: Record<RoomPhase, string> = {
  lobby: 'Lobby',
  typing: 'Typing',
  guessing: 'Guessing',
  reveal: 'Reveal'
};

export class MultiplayerView {
  private readonly screen = required('multiplayer-screen');
  private readonly entry = required('multiplayer-entry');
  private readonly room = required('multiplayer-room');
  private readonly status = required('multiplayer-status');
  private readonly players = required('multiplayer-players');
  private readonly passage = required('multiplayer-passage');
  private readonly hud = required('multiplayer-hud');
  private readonly typedBar = required('multiplayer-typed-bar');
  private readonly progressFill = required('multiplayer-progress-fill');
  private readonly input = requiredInput('multiplayer-input', HTMLInputElement);
  private game: Game = createGame('');
  private readonly guessInputs = {
    book: requiredInput('multiplayer-guess-book', HTMLInputElement),
    chapter: requiredInput('multiplayer-guess-chapter', HTMLInputElement),
    start: requiredInput('multiplayer-guess-start', HTMLInputElement),
    end: requiredInput('multiplayer-guess-end', HTMLInputElement)
  };

  get element(): HTMLElement {
    return this.screen;
  }

  showEntry(): void {
    this.entry.classList.remove('is-hidden');
    this.room.classList.add('is-hidden');
    this.setStatus('');
  }

  showRoom(): void {
    this.entry.classList.add('is-hidden');
    this.room.classList.remove('is-hidden');
  }

  render(snapshot: RoomSnapshot): void {
    const self = snapshot.players.find(player => player.id === snapshot.selfId);
    setText('multiplayer-room-code', snapshot.code);
    setText('multiplayer-round', snapshot.round ? String(snapshot.round) : 'Waiting');
    setText('multiplayer-phase', PHASE_LABELS[snapshot.phase]);
    setText('multiplayer-player-count', String(snapshot.players.length));
    this.renderPlayers(snapshot);
    this.showPhase(snapshot.phase);
    if (snapshot.phase === 'lobby') this.renderLobby(snapshot);
    if (snapshot.phase === 'typing') this.renderTyping(snapshot);
    if (snapshot.phase === 'guessing') this.renderGuessing(self);
    if (snapshot.phase === 'reveal') this.renderReveal(snapshot, self);
  }

  setStatus(message: string, isError = false): void {
    this.status.textContent = message;
    this.status.classList.toggle('is-error', isError);
  }

  typingValue(): string {
    return this.input.value;
  }

  clearTypingValue(): void {
    this.input.value = '';
  }

  startTyping(passage: string): void {
    this.game = createGame(passage);
    this.clearTypingValue();
  }

  restartTyping(snapshot: RoomSnapshot): void {
    this.startTyping(snapshot.passageText ?? '');
    this.renderTyping(snapshot);
    this.focusTyping();
  }

  updateTyping(snapshot: RoomSnapshot): TypingInputUpdate {
    const update = updateTypingInput(this.game, this.input.value);
    this.renderTyping(snapshot);
    return update;
  }

  typingCursor(): number {
    return getTypingProgressLength(this.game);
  }

  focusTyping(): void {
    if (!this.input.disabled) this.input.focus();
  }

  refreshTyping(snapshot: RoomSnapshot): void {
    if (snapshot.phase === 'typing') this.renderTyping(snapshot);
  }

  clearGuessValue(): void {
    for (const input of Object.values(this.guessInputs)) {
      input.value = '';
      input.disabled = false;
    }
  }

  guessValue() {
    const numberValue = (input: HTMLInputElement) => input.value ? Number(input.value) : null;
    return {
      book: this.guessInputs.book.value,
      chapter: numberValue(this.guessInputs.chapter),
      startVerse: numberValue(this.guessInputs.start),
      endVerse: numberValue(this.guessInputs.end)
    };
  }

  private renderPlayers(snapshot: RoomSnapshot): void {
    this.players.replaceChildren(...snapshot.players.map(player => {
      const row = document.createElement('div');
      row.className = 'player-row';
      const identity = document.createElement('div');
      const dot = document.createElement('i');
      dot.style.background = player.color;
      const name = document.createElement('strong');
      name.textContent = `${player.name}${player.id === snapshot.selfId ? ' (you)' : ''}`;
      const detail = document.createElement('small');
      detail.textContent = playerStatus(player, snapshot);
      identity.append(dot, name);
      row.append(identity, detail);
      return row;
    }));
  }

  private renderLobby(snapshot: RoomSnapshot): void {
    const start = requiredButton('multiplayer-start');
    const isHost = snapshot.selfId === snapshot.hostId;
    start.disabled = !isHost || snapshot.players.length < 2;
    start.textContent = isHost ? 'Start round' : 'Waiting for host';
  }

  private renderTyping(snapshot: RoomSnapshot): void {
    const passage = snapshot.passageText ?? '';
    const self = snapshot.players.find(player => player.id === snapshot.selfId);
    if (this.game.text !== passage) this.startTyping(passage);
    const stats = renderTypingExperience(this.game, {
      text: this.passage,
      typedBar: this.typedBar,
      progressFill: this.progressFill,
      hud: this.hud
    });
    setText('multiplayer-typing-progress', `${stats.progress}%`);
    renderPeerCarets(this.passage, snapshot.players, snapshot.selfId);
    this.input.disabled = self?.typingComplete ?? false;
    requiredButton('multiplayer-restart').disabled = this.input.disabled;
  }

  private renderGuessing(self: PlayerState | undefined): void {
    const submitted = self?.guessSubmitted ?? false;
    for (const input of Object.values(this.guessInputs)) input.disabled = submitted;
    requiredButton('multiplayer-submit-guess').disabled = submitted;
  }

  private renderReveal(snapshot: RoomSnapshot, self: PlayerState | undefined): void {
    const answer = snapshot.revealedReference;
    setText('multiplayer-answer', answer
      ? `${answer.book} ${answer.chapter}:${answer.startVerse}-${answer.endVerse}`
      : '');
    const scores = required('multiplayer-scores');
    scores.replaceChildren(...snapshot.players.map(player => {
      const row = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = player.name;
      const score = document.createElement('span');
      score.textContent = `${player.score ?? 0}%`;
      row.append(name, score);
      return row;
    }));
    const ready = requiredButton('multiplayer-ready');
    ready.textContent = self?.ready ? 'Ready — waiting for others' : 'Ready for another round';
    ready.disabled = self?.ready ?? false;
  }

  private showPhase(active: RoomPhase): void {
    for (const phase of ['lobby', 'typing', 'guessing', 'reveal'] as const) {
      required(`multiplayer-${phase}-phase`).classList.toggle('is-hidden', phase !== active);
    }
  }
}

function playerStatus(player: PlayerState, snapshot: RoomSnapshot): string {
  if (snapshot.phase === 'lobby') return player.id === snapshot.hostId ? 'Host' : player.kind === 'simulated' ? 'Simulated' : 'Joined';
  if (snapshot.phase === 'typing') return player.typingComplete ? 'Finished typing' : `${Math.round(player.cursor / Math.max(1, snapshot.passageText?.length ?? 1) * 100)}% typed`;
  if (snapshot.phase === 'guessing') {
    if (player.guessSubmitted) return 'Answer locked';
    const guess = player.guess;
    return [guess.book, guess.chapter, guess.startVerse && guess.endVerse ? `${guess.startVerse}-${guess.endVerse}` : ''].filter(Boolean).join(' ') || 'Thinking...';
  }
  return player.ready ? 'Ready' : `${player.score ?? 0}%`;
}

function required(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Expected #${id}.`);
  return element;
}

function requiredInput<T extends HTMLElement>(id: string, type: { new(): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`Expected #${id}.`);
  return element;
}

function requiredButton(id: string): HTMLButtonElement {
  return requiredInput(id, HTMLButtonElement);
}

function setText(id: string, value: string): void {
  required(id).textContent = value;
}
