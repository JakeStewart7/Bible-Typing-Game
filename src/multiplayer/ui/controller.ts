import type { MultiplayerClient, RoomConnection, RoomSnapshot } from '../domain/types';
import { MOCK_REFRESH_INTERVAL_MS } from '../infrastructure/mock-multiplayer-client';
import { MultiplayerView } from './view';
import { playComplete, playKey } from '../../audio/effects';
import { normalizeBotDifficulty } from '../domain/settings';
import { required, requiredButton, requiredInput } from './view-support';

export function createMultiplayerController(client: MultiplayerClient): { show(): void } {
  const view = new MultiplayerView();
  let connection: RoomConnection | null = null;
  let unsubscribe: (() => void) | null = null;
  let snapshot: RoomSnapshot | null = null;
  let botTimer: number | null = null;
  let cursorSequence = 0;

  bindForm('multiplayer-host-form', () => run(async () => {
    await connect(await client.createRoom(inputValue('multiplayer-name'), view.creationSettings()));
  }));
  bindForm('multiplayer-join-form', () => run(async () => {
    await connect(await client.joinRoom(inputValue('multiplayer-code'), inputValue('multiplayer-name')));
  }));
  requiredButton('multiplayer-show-join').addEventListener('click', () => toggleJoinForm(true));
  requiredButton('multiplayer-cancel-join').addEventListener('click', () => toggleJoinForm(false));
  requiredButton('multiplayer-leave').addEventListener('click', leave);
  requiredButton('multiplayer-add-bot').addEventListener('click', () => run(async () => {
    await send({ type: 'ADD_BOT' });
  }));
  requiredButton('multiplayer-start').addEventListener('click', () => send({ type: 'START_ROUND' }));
  requiredButton('multiplayer-finish-everyone').addEventListener('click', () => {
    void send({ type: 'FORCE_FINISH_ALL_TYPING' });
  });
  requiredButton('multiplayer-ready').addEventListener('click', () => send({ type: 'SET_READY', ready: true }));
  const settingsControls = [
    ['multiplayer-lobby-length', () => view.lobbySettings()],
    ['multiplayer-lobby-guessing', () => view.lobbySettings()],
    ['multiplayer-lobby-rounds', () => view.lobbySettings()],
    ['multiplayer-round-length', () => view.nextRoundSettings()],
    ['multiplayer-round-guessing', () => view.nextRoundSettings()]
  ] as const;
  for (const [id, readSettings] of settingsControls) {
    required(id).addEventListener('change', () => {
      if (!snapshot) return;
      const nextSettings = readSettings();
      void send({
        type: 'UPDATE_SETTINGS',
        settings: {
          ...snapshot.settings,
          passageLength: nextSettings.passageLength,
          includeGuessing: nextSettings.includeGuessing,
          rounds: id.endsWith('-rounds') ? nextSettings.rounds : snapshot.settings.rounds
        }
      });
    });
  }
  required('multiplayer-players').addEventListener('change', event => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !target.dataset.playerId) return;
    const difficulty = target.value;
    void send({
      type: 'UPDATE_BOT_DIFFICULTY',
      playerId: target.dataset.playerId,
      difficulty: normalizeBotDifficulty(difficulty)
    });
  });
  required('multiplayer-players').addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.playerId) return;
    void send({ type: 'FORCE_FINISH_TYPING', playerId: target.dataset.playerId });
  });
  required('multiplayer-encouragement-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = requiredInput('multiplayer-encouragement-input', HTMLInputElement);
    const word = input.value.trim();
    if (!word) return;
    input.value = '';
    void send({ type: 'SEND_ENCOURAGEMENT', word });
  });
  requiredButton('multiplayer-focus').addEventListener('click', event => {
    const control = event.currentTarget;
    if (!(control instanceof HTMLButtonElement)) return;
    const focused = view.element.classList.toggle('focus-mode');
    control.setAttribute('aria-pressed', String(focused));
    control.textContent = focused ? 'Exit focus mode' : 'Focus mode';
  });
  required('multiplayer-passage').addEventListener('click', () => {
    const input = requiredInput('multiplayer-input', HTMLInputElement);
    if (!input.disabled) input.focus();
  });
  required('multiplayer-input').addEventListener('input', () => {
    if (!snapshot || snapshot.phase !== 'typing' || !connection || snapshot.countdownEndsAt !== null) return;
    const inputUpdate = view.updateTyping(snapshot);
    if (inputUpdate.advanced) playKey(inputUpdate.lastCharacterCorrect ?? false);
    void run(async () => {
      await connection!.send({
        type: 'UPDATE_TYPING',
        typedText: view.typingValue(),
        sequence: ++cursorSequence
      });
      if (inputUpdate.completed) playComplete();
    });
  });
  required('multiplayer-guess-form').addEventListener('input', () => {
    void send({ type: 'UPDATE_GUESS', guess: view.guessValue() });
  });
  required('multiplayer-guess-form').addEventListener('submit', event => {
    event.preventDefault();
    void run(async () => {
      if (!connection) return;
      await connection.send({ type: 'UPDATE_GUESS', guess: view.guessValue() });
      await connection.send({ type: 'SUBMIT_GUESS' });
    });
  });

  async function connect(nextConnection: RoomConnection): Promise<void> {
    leave();
    connection = nextConnection;
    unsubscribe = connection.subscribe(nextSnapshot => {
      const roundChanged = snapshot?.round !== nextSnapshot.round;
      const previousPhase = snapshot?.phase;
      const countdownCompleted = snapshot?.countdownEndsAt !== null
        && nextSnapshot.countdownEndsAt === null;
      snapshot = nextSnapshot;
      if (roundChanged) {
        cursorSequence = 0;
        if (nextSnapshot.passageText) view.startTyping(nextSnapshot.passageText);
        view.clearGuessValue();
      }
      view.showRoom();
      view.render(nextSnapshot);
      if (previousPhase && previousPhase !== nextSnapshot.phase) {
        view.focusPhase(nextSnapshot.phase);
      } else if (countdownCompleted && nextSnapshot.phase === 'typing') {
        view.focusTyping();
      } else if (roundChanged && nextSnapshot.phase === 'typing') {
        view.focusTyping();
      }
    });
    botTimer = window.setInterval(() => {
      if (snapshot) view.refreshTyping(snapshot);
      if (client.advance) void run(client.advance.bind(client));
    }, MOCK_REFRESH_INTERVAL_MS);
  }

  function leave(): void {
    unsubscribe?.();
    connection?.disconnect();
    if (botTimer !== null) window.clearInterval(botTimer);
    unsubscribe = null;
    connection = null;
    snapshot = null;
    botTimer = null;
    view.showEntry();
  }

  async function send(command: Parameters<RoomConnection['send']>[0]): Promise<void> {
    if (!connection) return;
    await run(() => connection!.send(command));
  }

  async function run(operation: () => void | Promise<void>): Promise<void> {
    try {
      view.setStatus('');
      await operation();
    } catch (error) {
      view.setStatus(error instanceof Error ? error.message : 'The multiplayer action failed.', true);
    }
  }

  return {
    show(): void {
      if (!connection) view.showEntry();
    }
  };
}

function bindForm(id: string, submit: () => Promise<void>): void {
  required(id).addEventListener('submit', event => {
    event.preventDefault();
    void submit();
  });
}

function inputValue(id: string): string {
  return requiredInput(id, HTMLInputElement).value;
}

function toggleJoinForm(isVisible: boolean): void {
  required('multiplayer-join-form').classList.toggle('is-hidden', !isVisible);
  const trigger = requiredButton('multiplayer-show-join');
  trigger.setAttribute('aria-expanded', String(isVisible));
  if (isVisible) requiredInput('multiplayer-code', HTMLInputElement).focus();
}
