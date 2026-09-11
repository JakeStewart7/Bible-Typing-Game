import { DEFAULT_ROOM_SETTINGS, PASSAGE_LENGTH_OPTIONS, ROUND_OPTIONS } from '../domain/settings';

export function multiplayerWorkspaceMarkup(): string {
  return `
    <section id="multiplayer-screen" class="app-page multiplayer-screen is-hidden">
      <header class="page-header multiplayer-header">
        <div>
          <div class="eyebrow">Multiplayer practice</div>
          <h2>Type together</h2>
          <p>Share a passage, follow everyone's progress, and test your recall as a group.</p>
        </div>
        <span class="text-badge text-badge--accent">Local preview</span>
      </header>

      <div id="multiplayer-entry" class="multiplayer-entry">
        <section class="surface multiplayer-entry-card">
          <h3>Create a lobby</h3>
          <p>Open a room, invite players, and choose the next passage together.</p>
          <form id="multiplayer-create-form" class="stack">
            <label for="multiplayer-name">Display name</label>
            <input id="multiplayer-name" maxlength="24" value="Host" autocomplete="nickname" required>
            <button class="primary-btn" type="submit">Create lobby</button>
          </form>
        </section>
        <section class="surface multiplayer-entry-card">
          <h3>Join a lobby</h3>
          <p>Enter a five-character code to join a room in this browser session.</p>
          <form id="multiplayer-join-form" class="stack">
            <label for="multiplayer-join-name">Display name</label>
            <input id="multiplayer-join-name" maxlength="24" value="Guest" autocomplete="nickname" required>
            <label for="multiplayer-code">Lobby code</label>
            <input id="multiplayer-code" maxlength="5" autocomplete="off" placeholder="ABCDE" required>
            <button class="secondary-btn" type="submit">Join lobby</button>
          </form>
        </section>
      </div>

      <section id="multiplayer-room" class="multiplayer-room is-hidden">
        <header class="surface room-toolbar">
          <div><small>LOBBY CODE</small><strong id="multiplayer-room-code">-----</strong></div>
          <div><small>ROUND</small><strong id="multiplayer-round">Waiting</strong></div>
          <div><small>PHASE</small><strong id="multiplayer-phase" aria-live="polite" aria-atomic="true">Lobby</strong></div>
          <button id="multiplayer-leave" class="secondary-btn" type="button">Leave</button>
        </header>
        <div id="multiplayer-status" class="multiplayer-status" role="status" aria-live="polite"></div>
        <div class="multiplayer-layout">
          <aside class="surface player-panel">
            <div class="player-panel-heading"><h3>Players</h3><span id="multiplayer-player-count">0</span></div>
            <div id="multiplayer-players" class="player-list" role="list"></div>
          </aside>
          <main class="surface round-panel">
            <section id="multiplayer-lobby-phase" class="round-phase">
              <span class="phase-icon" aria-hidden="true">⌛</span>
              <h3>Waiting in the lobby</h3>
              <p>Add simulated players, then begin when everyone is present.</p>
              <div class="lobby-bot-controls">
                <button id="multiplayer-add-bot" class="secondary-btn" type="button">Add simulated player</button>
              </div>
              ${roomOptions('multiplayer-lobby', 'Lobby options')}
              <div class="cluster">
                <button id="multiplayer-start" class="primary-btn" type="button">Start round</button>
              </div>
            </section>
            <section id="multiplayer-typing-phase" class="round-phase is-hidden">
              <div class="round-heading"><div><small>TYPE THE PASSAGE</small><h3>Everyone advances together</h3></div><span id="multiplayer-typing-progress">0%</span></div>
              <div id="multiplayer-hud" class="hud"></div>
              <div class="progress-track"><div id="multiplayer-progress-fill"></div></div>
              <div id="multiplayer-passage" class="text-display multiplayer-passage" tabindex="0" aria-label="Passage to type"></div>
              <div id="multiplayer-countdown" class="multiplayer-countdown is-hidden" role="status" aria-live="assertive"></div>
              <div id="multiplayer-encouragement" class="multiplayer-encouragement is-hidden" role="status" aria-live="polite"></div>
              <form id="multiplayer-encouragement-form" class="encouragement-form">
                <label class="sr-only" for="multiplayer-encouragement-input">Send encouragement</label>
                <input id="multiplayer-encouragement-input" maxlength="24" autocomplete="off" placeholder="Encourage someone…">
                <button class="secondary-btn" type="submit">Send encouragement</button>
              </form>
              <section id="multiplayer-guessing-phase" class="guess-popover is-hidden" aria-labelledby="multiplayer-guess-heading">
                <div class="guess-heading">
                  <div><small>NAME THE PASSAGE</small><h3 id="multiplayer-guess-heading">What did you just type?</h3></div>
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
              </div>
              <p class="phase-help">Your progress stops at the first incorrect character. The guessing phase begins when everyone finishes.</p>
            </section>
            <section id="multiplayer-reveal-phase" class="round-phase is-hidden">
              <span class="phase-icon" aria-hidden="true">✦</span>
              <small>PASSAGE REVEALED</small>
              <h3 id="multiplayer-answer" role="status" aria-live="polite" aria-atomic="true"></h3>
              <div id="multiplayer-scores" class="score-list"></div>
              ${roomOptions('multiplayer-round', 'Next round')}
              <button id="multiplayer-ready" class="primary-btn" type="button">Ready for another round</button>
            </section>
            <section id="multiplayer-summary-phase" class="round-phase is-hidden">
              <span class="phase-icon" aria-hidden="true">🏆</span>
              <small>MATCH COMPLETE</small>
              <h3>Final standings</h3>
              <p>Every round is in. See how the room finished.</p>
              <div id="multiplayer-summary" class="score-list"></div>
            </section>
          </main>
        </div>
      </section>
    </section>`;
}

function roomOptions(prefix: string, legend: string): string {
  return `<fieldset class="room-settings">
    <legend>${legend}</legend>
    <label for="${prefix}-length">Passage length
      <select id="${prefix}-length">${passageLengthOptions()}</select>
    </label>
    <label class="guessing-toggle">
      <input id="${prefix}-guessing" class="sr-only" type="checkbox" checked>
      <span aria-hidden="true"></span>
      <strong>Passage guessing</strong>
    </label>
    <label for="${prefix}-rounds">Rounds
      <select id="${prefix}-rounds">${roundOptions()}</select>
    </label>
  </fieldset>`;
}

function passageLengthOptions(): string {
  return Object.entries(PASSAGE_LENGTH_OPTIONS)
    .map(([value, option]) => `<option value="${value}"${value === DEFAULT_ROOM_SETTINGS.passageLength ? ' selected' : ''}>${option.label} · up to ${option.maximumCharacters} characters</option>`)
    .join('');
}

function roundOptions(): string {
  return Object.entries(ROUND_OPTIONS)
    .map(([value, label]) =>
      `<option value="${value}"${Number(value) === DEFAULT_ROOM_SETTINGS.rounds ? ' selected' : ''}>${label}</option>`
    )
    .join('');
}
