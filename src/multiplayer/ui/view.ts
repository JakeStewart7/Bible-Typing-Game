import type { PlayerState, RoomPhase, RoomSettings, RoomSnapshot } from '../domain/types';
import { BOT_DIFFICULTY_OPTIONS } from '../domain/settings';
import { createGame, type Game } from '../../game/state';
import {
  renderTypingExperience,
  updateTypingInput,
  type TypingInputUpdate
} from '../../typing/session';
import { renderPeerCarets } from './peer-carets';
import {
  playerStatus,
  readPassageLength,
  readRoomSettings,
  renderGuessTimer,
  required,
  requiredButton,
  requiredInput,
  requiredSelect,
  setText
} from './view-support';

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
    if (snapshot.phase === 'typing' || snapshot.phase === 'guessing') this.renderTyping(snapshot);
    if (snapshot.phase === 'guessing') this.renderGuessing(snapshot, self);
    if (snapshot.phase === 'reveal') this.renderReveal(snapshot, self);
  }

  setStatus(message: string, isError = false): void {
    this.status.textContent = message;
    this.status.classList.toggle('is-error', isError);
  }

  typingValue(): string {
    return this.input.value;
  }

  creationSettings(): RoomSettings {
    return readRoomSettings(
      'multiplayer-create-difficulty',
      'multiplayer-create-length',
      'multiplayer-create-guessing'
    );
  }

  nextRoundSettings(): RoomSettings {
    return {
      botDifficulty: 'medium',
      passageLength: readPassageLength('multiplayer-round-length'),
      includeGuessing: requiredInput('multiplayer-round-guessing', HTMLInputElement).checked
    };
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

  focusTyping(): void {
    if (!this.input.disabled) this.input.focus();
  }

  refreshTyping(snapshot: RoomSnapshot): void {
    if (snapshot.phase === 'typing' || snapshot.phase === 'guessing') {
      this.renderTyping(snapshot);
      if (snapshot.phase === 'guessing') renderGuessTimer(snapshot);
    }
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
      row.append(identity);
      if (snapshot.round > 0) {
        const metrics = document.createElement('small');
        metrics.className = 'player-metrics';
        const progressPercent = Math.round(
          player.progress / Math.max(1, snapshot.passageText?.length ?? 1) * 100
        );
        metrics.textContent = `${player.wpm} WPM • ${progressPercent}% typed`;
        row.append(metrics);
      }
      row.append(detail);
      if (player.kind === 'simulated' && snapshot.selfId === snapshot.hostId
        && (snapshot.phase === 'lobby' || snapshot.phase === 'reveal')) {
        const select = document.createElement('select');
        select.className = 'bot-difficulty-select';
        select.dataset.playerId = player.id;
        select.setAttribute('aria-label', `${player.name} difficulty`);
        for (const [value, option] of Object.entries(BOT_DIFFICULTY_OPTIONS)) {
          const choice = document.createElement('option');
          choice.value = value;
          choice.textContent = `${option.label} · ${option.minimumWpm}-${option.maximumWpm} WPM`;
          choice.selected = value === player.botDifficulty;
          select.appendChild(choice);
        }
        row.appendChild(select);
      }
      return row;
    }));
  }

  private renderLobby(snapshot: RoomSnapshot): void {
    const start = requiredButton('multiplayer-start');
    const isHost = snapshot.selfId === snapshot.hostId;
    start.disabled = !isHost || snapshot.players.length < 2;
    start.textContent = isHost ? 'Start round' : 'Waiting for host';
    requiredButton('multiplayer-add-bot').disabled = !isHost;
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
    this.input.disabled = snapshot.phase !== 'typing' || (self?.typingComplete ?? false);
    requiredButton('multiplayer-restart').disabled = this.input.disabled;
  }

  private renderGuessing(snapshot: RoomSnapshot, self: PlayerState | undefined): void {
    const submitted = self?.guessSubmitted ?? false;
    for (const input of Object.values(this.guessInputs)) input.disabled = submitted;
    requiredButton('multiplayer-submit-guess').disabled = submitted;
    renderGuessTimer(snapshot);
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
    const host = snapshot.selfId === snapshot.hostId;
    const passageLength = requiredSelect('multiplayer-round-length');
    const guessing = requiredInput('multiplayer-round-guessing', HTMLInputElement);
    passageLength.value = snapshot.settings.passageLength;
    guessing.checked = snapshot.settings.includeGuessing;
    passageLength.disabled = !host || Boolean(self?.ready);
    guessing.disabled = !host || Boolean(self?.ready);
    required('multiplayer-scores').classList.toggle('is-hidden', !snapshot.settings.includeGuessing);
  }

  private showPhase(active: RoomPhase): void {
    required('multiplayer-lobby-phase').classList.toggle('is-hidden', active !== 'lobby');
    required('multiplayer-typing-phase').classList.toggle(
      'is-hidden',
      active !== 'typing' && active !== 'guessing'
    );
    required('multiplayer-guessing-phase').classList.toggle('is-hidden', active !== 'guessing');
    required('multiplayer-reveal-phase').classList.toggle('is-hidden', active !== 'reveal');
  }
}
