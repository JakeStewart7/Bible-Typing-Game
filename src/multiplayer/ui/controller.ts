import type { MultiplayerClient, RoomConnection, RoomSnapshot } from '../domain/types';
import { MockMultiplayerClient } from '../infrastructure/mock-multiplayer-client';
import { MultiplayerView } from './view';
import { playComplete, playKey } from '../../audio/effects';

const MOCK_REFRESH_INTERVAL_MS = 75;
const MOCK_CHARACTERS_PER_UPDATE = 1;

export function createMultiplayerController(client: MultiplayerClient): { show(): void } {
  const view = new MultiplayerView();
  let connection: RoomConnection | null = null;
  let unsubscribe: (() => void) | null = null;
  let snapshot: RoomSnapshot | null = null;
  let botTimer: number | null = null;
  let cursorSequence = 0;

  bindForm('multiplayer-create-form', () => run(async () => {
    await connect(await client.createRoom(inputValue('multiplayer-name')));
  }));
  bindForm('multiplayer-join-form', () => run(async () => {
    await connect(await client.joinRoom(inputValue('multiplayer-code'), inputValue('multiplayer-join-name')));
  }));
  button('multiplayer-leave').addEventListener('click', leave);
  button('multiplayer-add-bot').addEventListener('click', () => run(async () => {
    mockClient().addSimulatedPlayer();
  }));
  button('multiplayer-start').addEventListener('click', () => send({ type: 'START_ROUND' }));
  button('multiplayer-ready').addEventListener('click', () => send({ type: 'SET_READY', ready: true }));
  button('multiplayer-restart').addEventListener('click', () => {
    if (!snapshot || snapshot.phase !== 'typing') return;
    view.restartTyping(snapshot);
    void send({
      type: 'UPDATE_CURSOR',
      position: 0,
      sequence: ++cursorSequence
    });
  });
  button('multiplayer-focus').addEventListener('click', event => {
    const control = event.currentTarget;
    if (!(control instanceof HTMLButtonElement)) return;
    const focused = view.element.classList.toggle('focus-mode');
    control.setAttribute('aria-pressed', String(focused));
    control.textContent = focused ? 'Exit focus mode' : 'Focus mode';
  });
  element('multiplayer-passage').addEventListener('click', () => {
    const input = element('multiplayer-input');
    if (input instanceof HTMLInputElement && !input.disabled) input.focus();
  });
  element('multiplayer-input').addEventListener('input', () => {
    if (!snapshot || snapshot.phase !== 'typing' || !connection) return;
    const inputUpdate = view.updateTyping(snapshot);
    if (inputUpdate.advanced) playKey(inputUpdate.lastCharacterCorrect ?? false);
    void run(async () => {
      await connection!.send({
        type: 'UPDATE_CURSOR',
        position: view.typingCursor(),
        sequence: ++cursorSequence
      });
      if (inputUpdate.completed) {
        await connection!.send({ type: 'COMPLETE_PASSAGE' });
        playComplete();
      }
    });
  });
  element('multiplayer-guess-form').addEventListener('input', () => {
    void send({ type: 'UPDATE_GUESS', guess: view.guessValue() });
  });
  element('multiplayer-guess-form').addEventListener('submit', event => {
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
      snapshot = nextSnapshot;
      if (roundChanged) {
        cursorSequence = 0;
        if (nextSnapshot.passageText) view.startTyping(nextSnapshot.passageText);
        view.clearGuessValue();
      }
      view.showRoom();
      view.render(nextSnapshot);
      if (roundChanged && nextSnapshot.phase === 'typing') view.focusTyping();
    });
    if (client instanceof MockMultiplayerClient) {
      botTimer = window.setInterval(() => {
        if (snapshot) view.refreshTyping(snapshot);
        void run(() => client.advanceSimulatedPlayers(MOCK_CHARACTERS_PER_UPDATE));
      }, MOCK_REFRESH_INTERVAL_MS);
    }
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

  function mockClient(): MockMultiplayerClient {
    if (!(client instanceof MockMultiplayerClient)) {
      throw new Error('Simulated players are only available with the mock transport.');
    }
    return client;
  }

  return {
    show(): void {
      if (!connection) view.showEntry();
    }
  };
}

function bindForm(id: string, submit: () => Promise<void>): void {
  element(id).addEventListener('submit', event => {
    event.preventDefault();
    void submit();
  });
}

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Expected #${id}.`);
  return found;
}

function button(id: string): HTMLButtonElement {
  const found = element(id);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Expected #${id} to be a button.`);
  return found;
}

function inputValue(id: string): string {
  const found = element(id);
  if (!(found instanceof HTMLInputElement)) throw new Error(`Expected #${id} to be an input.`);
  return found.value;
}
