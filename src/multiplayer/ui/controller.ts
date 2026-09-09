import type { MultiplayerClient, RoomConnection, RoomSnapshot } from '../domain/types';
import { MockMultiplayerClient } from '../infrastructure/mock-multiplayer-client';
import { MultiplayerView } from './view';

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
  element('multiplayer-input').addEventListener('input', () => {
    const passage = snapshot?.passageText ?? '';
    void send({
      type: 'UPDATE_CURSOR',
      position: matchingPrefixLength(view.typingValue(), passage),
      sequence: ++cursorSequence
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
        view.clearTypingValue();
        view.clearGuessValue();
      }
      view.showRoom();
      view.render(nextSnapshot);
    });
    if (client instanceof MockMultiplayerClient) {
      botTimer = window.setInterval(() => {
        void run(() => client.advanceSimulatedPlayers());
      }, 350);
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

function matchingPrefixLength(input: string, passage: string): number {
  const limit = Math.min(input.length, passage.length);
  let index = 0;
  while (index < limit && input[index] === passage[index]) index++;
  return index;
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
