import {
  BOT_DIFFICULTY_OPTIONS,
  DEFAULT_ROOM_SETTINGS,
  PASSAGE_LENGTH_OPTIONS
} from '../domain/settings';

export function multiplayerWorkspaceMarkup(): string {
  return `
    <section id="multiplayer-screen" class="app-page multiplayer-screen is-hidden">
      <header class="page-header multiplayer-header">
        <div>
          <div class="eyebrow">Local multiplayer laboratory</div>
          <h2>Gather around a passage</h2>
          <p>Develop the complete room flow with simulated players before choosing a network provider.</p>
        </div>
        <span class="text-badge text-badge--accent">Mock transport</span>
      </header>

      <div id="multiplayer-entry" class="multiplayer-entry">
        <section class="surface multiplayer-entry-card">
          <h3>Create a lobby</h3>
          <p>Start a local room, then add simulated players to exercise every phase.</p>
          <form id="multiplayer-create-form" class="stack">
            <label for="multiplayer-name">Display name</label>
            <input id="multiplayer-name" maxlength="24" value="Host" autocomplete="nickname" required>
            <div class="lobby-option-grid">
              <label for="multiplayer-create-difficulty">Default bot difficulty
                <select id="multiplayer-create-difficulty">${difficultyOptions()}</select>
              </label>
              <label for="multiplayer-create-length">Passage length
                <select id="multiplayer-create-length">${passageLengthOptions()}</select>
              </label>
            </div>
            <label class="checkbox-option"><input id="multiplayer-create-guessing" type="checkbox" checked> Include passage guessing</label>
            <button class="primary-btn" type="submit">Create mock lobby</button>
          </form>
        </section>
        <section class="surface multiplayer-entry-card">
          <h3>Join a lobby</h3>
          <p>The adapter contract is ready for lobby-code providers. Mock rooms live in this page session.</p>
          <form id="multiplayer-join-form" class="stack">
            <label for="multiplayer-join-name">Display name</label>
            <input id="multiplayer-join-name" maxlength="24" value="Guest" autocomplete="nickname" required>
            <label for="multiplayer-code">Lobby code</label>
            <input id="multiplayer-code" maxlength="5" autocomplete="off" placeholder="ABCDE" required>
            <button class="secondary-btn" type="submit">Join mock lobby</button>
          </form>
        </section>
      </div>

      <section id="multiplayer-room" class="multiplayer-room is-hidden">
        <header class="surface room-toolbar">
          <div><small>LOBBY CODE</small><strong id="multiplayer-room-code">-----</strong></div>
          <div><small>ROUND</small><strong id="multiplayer-round">Waiting</strong></div>
          <div><small>PHASE</small><strong id="multiplayer-phase">Lobby</strong></div>
          <button id="multiplayer-leave" class="secondary-btn" type="button">Leave</button>
        </header>
        <div id="multiplayer-status" class="multiplayer-status" role="status" aria-live="polite"></div>
        <div class="multiplayer-layout">
          <aside class="surface player-panel">
            <div class="player-panel-heading"><h3>Players</h3><span id="multiplayer-player-count">0</span></div>
            <div id="multiplayer-players" class="player-list"></div>
          </aside>
          <main class="surface round-panel">
            <section id="multiplayer-lobby-phase" class="round-phase">
              <span class="phase-icon" aria-hidden="true">⌛</span>
              <h3>Waiting in the lobby</h3>
              <p>Add simulated players, then begin when everyone is present.</p>
              <div class="lobby-bot-controls">
                <button id="multiplayer-add-bot" class="secondary-btn" type="button">Add simulated player</button>
              </div>
              <div class="cluster">
                <button id="multiplayer-start" class="primary-btn" type="button">Start round</button>
              </div>
            </section>
            <section id="multiplayer-typing-phase" class="round-phase is-hidden">
              <div class="round-heading"><div><small>TYPE THE PASSAGE</small><h3>Everyone advances together</h3></div><span id="multiplayer-typing-progress">0%</span></div>
              <div id="multiplayer-hud" class="hud"></div>
              <div class="progress-track"><div id="multiplayer-progress-fill"></div></div>
              <div id="multiplayer-passage" class="text-display multiplayer-passage" tabindex="0" aria-label="Passage to type"></div>
              <section id="multiplayer-guessing-phase" class="guess-popover is-hidden">
                <div class="guess-heading">
                  <div><small>NAME THE PASSAGE</small><h3>What did you just type?</h3></div>
                  <div class="guess-timer" role="timer" aria-label="Time remaining">
                    <svg viewBox="0 0 42 42" aria-hidden="true">
                      <circle class="timer-track" cx="21" cy="21" r="17"></circle>
                      <circle id="multiplayer-timer-ring" class="timer-ring" cx="21" cy="21" r="17" pathLength="100"></circle>
                    </svg>
                    <strong id="multiplayer-timer-seconds">30</strong>
                  </div>
                </div>
                <form id="multiplayer-guess-form" class="guess-grid">
                  <label>Book<input id="multiplayer-guess-book" maxlength="40"></label>
                  <label>Chapter<input id="multiplayer-guess-chapter" type="number" min="1"></label>
                  <label>First verse<input id="multiplayer-guess-start" type="number" min="1"></label>
                  <label>Last verse<input id="multiplayer-guess-end" type="number" min="1"></label>
                  <button id="multiplayer-submit-guess" class="primary-btn" type="submit">Lock in answer</button>
                </form>
                <p class="phase-help">Your latest draft is submitted automatically when time runs out.</p>
              </section>
              <label class="sr-only" for="multiplayer-input">Type the passage</label>
              <div class="typed-area">
                <div id="multiplayer-typed-bar" class="typed-bar" aria-hidden="true"></div>
                <input id="multiplayer-input" class="typing-input" autocomplete="off" autocapitalize="off" spellcheck="false">
              </div>
              <div class="typing-footer">
                <button id="multiplayer-focus" class="text-btn" type="button" aria-pressed="false">Focus mode</button>
                <button id="multiplayer-restart" class="text-btn" type="button">↻ Restart</button>
              </div>
              <p class="phase-help">Your progress stops at the first incorrect character. The guessing phase begins when everyone finishes.</p>
            </section>
            <section id="multiplayer-reveal-phase" class="round-phase is-hidden">
              <span class="phase-icon" aria-hidden="true">✦</span>
              <small>PASSAGE REVEALED</small>
              <h3 id="multiplayer-answer"></h3>
              <div id="multiplayer-scores" class="score-list"></div>
              <fieldset class="next-round-settings">
                <legend>Next round</legend>
                <label for="multiplayer-round-length">Passage length
                  <select id="multiplayer-round-length">${passageLengthOptions()}</select>
                </label>
                <label class="checkbox-option"><input id="multiplayer-round-guessing" type="checkbox"> Include passage guessing</label>
              </fieldset>
              <button id="multiplayer-ready" class="primary-btn" type="button">Ready for another round</button>
            </section>
          </main>
        </div>
      </section>
    </section>`;
}

function difficultyOptions(): string {
  return Object.entries(BOT_DIFFICULTY_OPTIONS)
    .map(([value, option]) => `<option value="${value}"${value === DEFAULT_ROOM_SETTINGS.botDifficulty ? ' selected' : ''}>${option.label} · ${option.minimumWpm}-${option.maximumWpm} WPM · ${option.accuracy * 100}%</option>`)
    .join('');
}

function passageLengthOptions(): string {
  return Object.entries(PASSAGE_LENGTH_OPTIONS)
    .map(([value, option]) => `<option value="${value}"${value === DEFAULT_ROOM_SETTINGS.passageLength ? ' selected' : ''}>${option.label} · up to ${option.maximumCharacters} characters</option>`)
    .join('');
}
