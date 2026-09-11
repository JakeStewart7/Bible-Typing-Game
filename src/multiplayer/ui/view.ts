import type {
  PassageGuess,
  PlayerState,
  RoomPhase,
  RoomSettings,
  RoomSnapshot
} from '../domain/types';
import { DEFAULT_ROOM_SETTINGS } from '../domain/settings';
import { createGame, type Game } from '../../game/state';
import {
  renderTypingExperience,
  updateTypingInput,
  type TypingInputUpdate
} from '../../typing/session';
import { renderPeerCarets } from './peer-carets';
import { formatPassageLabel } from '../../memory/domain/passage';
import { PlayerListView } from './player-list';
import {
  readPassageLength,
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
  reveal: 'Reveal',
  summary: 'Summary'
};

export class MultiplayerView {
  private readonly screen = required('multiplayer-screen');
  private readonly entry = required('multiplayer-entry');
  private readonly room = required('multiplayer-room');
  private readonly status = required('multiplayer-status');
  private readonly players = required('multiplayer-players');
  private readonly playerList = new PlayerListView(this.players);
  private readonly passage = required('multiplayer-passage');
  private readonly hud = required('multiplayer-hud');
  private readonly typedBar = required('multiplayer-typed-bar');
  private readonly progressFill = required('multiplayer-progress-fill');
  private readonly input = requiredInput('multiplayer-input', HTMLInputElement);
  private game: Game = createGame('');
  private lastEncouragementId = 0;
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
    this.playerList.clear();
  }

  showRoom(): void {
    this.entry.classList.add('is-hidden');
    this.room.classList.remove('is-hidden');
  }

  render(snapshot: RoomSnapshot): void {
    const self = snapshot.players.find(player => player.id === snapshot.selfId);
    setText('multiplayer-room-code', snapshot.code);
    setText(
      'multiplayer-round',
      snapshot.round ? `${snapshot.round}/${snapshot.settings.rounds}` : 'Waiting'
    );
    setText('multiplayer-phase', PHASE_LABELS[snapshot.phase]);
    setText('multiplayer-player-count', String(snapshot.players.length));
    this.playerList.render(snapshot);
    this.showPhase(snapshot.phase);
    if (snapshot.phase === 'lobby') this.renderLobby(snapshot);
    if (snapshot.phase === 'typing' || snapshot.phase === 'guessing') this.renderTyping(snapshot);
    if (snapshot.phase === 'guessing') this.renderGuessing(snapshot, self);
    if (snapshot.phase === 'reveal') this.renderReveal(snapshot, self);
    if (snapshot.phase === 'summary') this.renderSummary(snapshot);
  }

  setStatus(message: string, isError = false): void {
    this.status.textContent = message;
    this.status.classList.toggle('is-error', isError);
  }

  typingValue(): string {
    return this.input.value;
  }

  creationSettings(): RoomSettings {
    return { ...DEFAULT_ROOM_SETTINGS };
  }

  lobbySettings(): RoomSettings {
    return this.readSettings('multiplayer-lobby');
  }

  nextRoundSettings(): RoomSettings {
    return this.readSettings('multiplayer-round');
  }

  clearTypingValue(): void {
    this.input.value = '';
  }

  startTyping(passage: string): void {
    this.game = createGame(passage);
    this.clearTypingValue();
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

  guessValue(): PassageGuess {
    const numberValue = (input: HTMLInputElement) => input.value ? Number(input.value) : null;
    return {
      book: this.guessInputs.book.value,
      chapter: numberValue(this.guessInputs.chapter),
      startVerse: numberValue(this.guessInputs.start),
      endVerse: numberValue(this.guessInputs.end)
    };
  }

  focusPhase(phase: RoomPhase): void {
    if (phase === 'typing') this.focusTyping();
    if (phase === 'guessing') this.guessInputs.book.focus();
    if (phase === 'reveal') requiredButton('multiplayer-ready').focus();
  }

  private renderLobby(snapshot: RoomSnapshot): void {
    const start = requiredButton('multiplayer-start');
    const isHost = snapshot.selfId === snapshot.hostId;
    start.disabled = !isHost || snapshot.players.length < 2;
    start.textContent = isHost ? 'Start round' : 'Waiting for host';
    requiredButton('multiplayer-add-bot').disabled = !isHost;
    this.renderSettings('multiplayer-lobby', snapshot, isHost);
  }

  private renderTyping(snapshot: RoomSnapshot): void {
    const passage = snapshot.passageText ?? '';
    const self = snapshot.players.find(player => player.id === snapshot.selfId);
    if (this.game.text !== passage) this.startTyping(passage);
    if (self?.typedText === '' && this.game.typed.length > 0) this.startTyping(passage);
    const stats = renderTypingExperience(this.game, {
      text: this.passage,
      typedBar: this.typedBar,
      progressFill: this.progressFill,
      hud: this.hud
    });
    setText('multiplayer-typing-progress', `${stats.progress}%`);
    renderPeerCarets(this.passage, snapshot.players, snapshot.selfId);
    const countdownRemaining = snapshot.countdownEndsAt === null
      ? 0
      : Math.max(0, snapshot.countdownEndsAt - Date.now());
    const countdown = required('multiplayer-countdown');
    countdown.classList.toggle('is-hidden', countdownRemaining === 0);
    countdown.textContent = countdownRemaining
      ? `Starting in ${Math.ceil(countdownRemaining / 1000)}`
      : '';
    const canEncourage = snapshot.countdownEndsAt === null
      && snapshot.players.some(player => !player.typingComplete);
    required('multiplayer-encouragement-form').classList.toggle('is-hidden', !canEncourage);
    if (snapshot.encouragement && snapshot.encouragement.id > this.lastEncouragementId) {
      this.lastEncouragementId = snapshot.encouragement.id;
      const encouragement = required('multiplayer-encouragement');
      encouragement.textContent = `${snapshot.encouragement.playerName}: ${snapshot.encouragement.word}`;
      encouragement.classList.remove('is-hidden');
      window.setTimeout(() => encouragement.classList.add('is-hidden'), 1_800);
    }
    this.input.disabled = snapshot.phase !== 'typing'
      || countdownRemaining > 0
      || (self?.typingComplete ?? false);
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
      ? formatPassageLabel(answer)
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
    this.renderSettings(
      'multiplayer-round',
      snapshot,
      snapshot.selfId === snapshot.hostId && !self?.ready
    );
    required('multiplayer-scores').classList.toggle('is-hidden', !snapshot.settings.includeGuessing);
  }

  private renderSummary(snapshot: RoomSnapshot): void {
    const summary = required('multiplayer-summary');
    summary.replaceChildren(...[...snapshot.players]
      .sort((left, right) => right.totalScore - left.totalScore)
      .map((player, index) => {
        const row = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = `${index + 1}. ${player.name}`;
        const score = document.createElement('span');
        score.textContent = snapshot.settings.includeGuessing
          ? `${player.totalScore} pts`
          : `${player.wpm} WPM · ${player.accuracy}%`;
        row.append(name, score);
        return row;
      }));
  }

  private readSettings(prefix: string): RoomSettings {
    return {
      botDifficulty: 'medium',
      passageLength: readPassageLength(`${prefix}-length`),
      includeGuessing: requiredInput(`${prefix}-guessing`, HTMLInputElement).checked,
      rounds: Number(requiredSelect(`${prefix}-rounds`).value)
    };
  }

  private renderSettings(prefix: string, snapshot: RoomSnapshot, enabled: boolean): void {
    const passageLength = requiredSelect(`${prefix}-length`);
    const guessing = requiredInput(`${prefix}-guessing`, HTMLInputElement);
    const rounds = requiredSelect(`${prefix}-rounds`);
    passageLength.value = snapshot.settings.passageLength;
    guessing.checked = snapshot.settings.includeGuessing;
    rounds.value = String(snapshot.settings.rounds);
    passageLength.disabled = !enabled;
    guessing.disabled = !enabled;
    rounds.disabled = !enabled;
  }

  private showPhase(active: RoomPhase): void {
    required('multiplayer-lobby-phase').classList.toggle('is-hidden', active !== 'lobby');
    required('multiplayer-typing-phase').classList.toggle(
      'is-hidden',
      active !== 'typing' && active !== 'guessing'
    );
    required('multiplayer-guessing-phase').classList.toggle('is-hidden', active !== 'guessing');
    required('multiplayer-reveal-phase').classList.toggle('is-hidden', active !== 'reveal');
    required('multiplayer-summary-phase').classList.toggle('is-hidden', active !== 'summary');
  }
}
