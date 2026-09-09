import { BOT_DIFFICULTY_OPTIONS } from '../domain/settings.ts';
import type { PlayerState, RoomSnapshot } from '../domain/types.ts';
import { playerStatus, typedProgressPercent } from './view-support.ts';

type PlayerRow = {
  root: HTMLElement;
  dot: HTMLElement;
  name: HTMLElement;
  metrics: HTMLElement;
  status: HTMLElement;
  difficulty: HTMLSelectElement;
};

export class PlayerListView {
  private readonly rows = new Map<string, PlayerRow>();

  constructor(private readonly container: HTMLElement) {}

  render(snapshot: RoomSnapshot): void {
    const activeIds = new Set(snapshot.players.map(player => player.id));
    for (const [playerId, row] of this.rows) {
      if (activeIds.has(playerId)) continue;
      row.root.remove();
      this.rows.delete(playerId);
    }
    snapshot.players.forEach((player, index) => {
      const row = this.rows.get(player.id) ?? this.createRow(player.id);
      this.updateRow(row, player, snapshot);
      const elementAtIndex = this.container.children.item(index);
      if (elementAtIndex !== row.root) this.container.insertBefore(row.root, elementAtIndex);
    });
  }

  clear(): void {
    this.rows.clear();
    this.container.replaceChildren();
  }

  private createRow(playerId: string): PlayerRow {
    const root = document.createElement('div');
    root.className = 'player-row';
    root.setAttribute('role', 'listitem');
    const identity = document.createElement('div');
    const dot = document.createElement('i');
    dot.setAttribute('aria-hidden', 'true');
    const name = document.createElement('strong');
    identity.append(dot, name);
    const metrics = document.createElement('small');
    metrics.className = 'player-metrics';
    const status = document.createElement('small');
    const difficulty = this.createDifficultySelect(playerId);
    root.append(identity, metrics, status, difficulty);
    const row = { root, dot, name, metrics, status, difficulty };
    this.rows.set(playerId, row);
    return row;
  }

  private updateRow(row: PlayerRow, player: PlayerState, snapshot: RoomSnapshot): void {
    row.dot.style.background = player.color;
    row.name.textContent = `${player.name}${player.id === snapshot.selfId ? ' (you)' : ''}`;
    row.metrics.textContent = `${player.wpm} WPM • ${
      typedProgressPercent(player, snapshot.passageText)
    }% typed`;
    row.metrics.classList.toggle('is-hidden', snapshot.round === 0);
    row.status.textContent = playerStatus(player, snapshot);
    row.difficulty.setAttribute('aria-label', `${player.name} difficulty`);
    const canEditDifficulty = player.kind === 'simulated'
      && snapshot.selfId === snapshot.hostId
      && (snapshot.phase === 'lobby' || snapshot.phase === 'reveal');
    row.difficulty.classList.toggle('is-hidden', !canEditDifficulty);
    row.difficulty.disabled = !canEditDifficulty;
    if (document.activeElement !== row.difficulty) {
      row.difficulty.value = player.botDifficulty ?? snapshot.settings.botDifficulty;
    }
  }

  private createDifficultySelect(playerId: string): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'bot-difficulty-select is-hidden';
    select.dataset.playerId = playerId;
    select.setAttribute('aria-label', 'Bot difficulty');
    for (const [value, option] of Object.entries(BOT_DIFFICULTY_OPTIONS)) {
      const choice = document.createElement('option');
      choice.value = value;
      choice.textContent = `${option.label} · ${option.minimumWpm}-${option.maximumWpm} WPM`;
      select.appendChild(choice);
    }
    return select;
  }
}
