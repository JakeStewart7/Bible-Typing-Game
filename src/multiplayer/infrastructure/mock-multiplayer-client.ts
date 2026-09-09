import { RoomEngine } from '../domain/room-engine';
import type {
  MultiplayerClient,
  PassageGuess,
  PassageProvider,
  PlayerCommand,
  RoomConnection,
  RoomListener
} from '../domain/types';

const rooms = new Map<string, RoomEngine>();
let nextPlayerNumber = 1;

export class MockMultiplayerClient implements MultiplayerClient {
  private readonly provider: PassageProvider;
  private activeRoom: RoomEngine | null = null;

  constructor(provider: PassageProvider) {
    this.provider = provider;
  }

  async createRoom(playerName: string): Promise<RoomConnection> {
    const code = createRoomCode();
    const room = new RoomEngine(code, this.provider);
    rooms.set(code, room);
    return this.connect(room, playerName);
  }

  async joinRoom(code: string, playerName: string): Promise<RoomConnection> {
    const normalizedCode = code.trim().toUpperCase();
    const room = rooms.get(normalizedCode);
    if (!room) throw new Error('That mock lobby does not exist in this browser session.');
    return this.connect(room, playerName);
  }

  addSimulatedPlayer(name = `Player ${nextPlayerNumber}`): void {
    if (!this.activeRoom) throw new Error('Create or join a room before adding simulated players.');
    this.activeRoom.addPlayer(createPlayerId(), name, 'simulated');
  }

  async advanceSimulatedPlayers(step = 18): Promise<void> {
    const room = this.activeRoom;
    if (!room) return;
    const snapshot = room.getSnapshot('');
    for (const player of snapshot.players.filter(candidate => candidate.kind === 'simulated')) {
      if (snapshot.phase === 'typing' && snapshot.passageText) {
        const position = Math.min(snapshot.passageText.length, player.cursor + step);
        await room.dispatch(player.id, {
          type: 'UPDATE_CURSOR',
          position,
          sequence: player.cursorSequence + 1
        });
        if (position === snapshot.passageText.length) {
          await room.dispatch(player.id, { type: 'COMPLETE_PASSAGE' });
        }
      } else if (snapshot.phase === 'guessing' && !player.guessSubmitted) {
        await room.dispatch(player.id, { type: 'UPDATE_GUESS', guess: simulatedGuess(player.id) });
        await room.dispatch(player.id, { type: 'SUBMIT_GUESS' });
      } else if (snapshot.phase === 'reveal' && !player.ready) {
        await room.dispatch(player.id, { type: 'SET_READY', ready: true });
      }
    }
  }

  private connect(room: RoomEngine, playerName: string): RoomConnection {
    const playerId = createPlayerId();
    room.addPlayer(playerId, playerName);
    this.activeRoom = room;
    let disconnected = false;
    return {
      playerId,
      code: room.code,
      subscribe(listener: RoomListener): () => void {
        if (disconnected) throw new Error('Cannot subscribe after disconnecting.');
        return room.subscribe(playerId, listener);
      },
      send(command: PlayerCommand): Promise<void> {
        if (disconnected) return Promise.reject(new Error('Cannot send after disconnecting.'));
        return room.dispatch(playerId, command);
      },
      disconnect(): void {
        if (disconnected) return;
        disconnected = true;
        room.removePlayer(playerId);
      }
    };
  }
}

function createRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 5 }, () =>
      alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

function createPlayerId(): string {
  return `mock-player-${nextPlayerNumber++}`;
}

function simulatedGuess(playerId: string): PassageGuess {
  const parts = playerId.split('-');
  const offset = Number(parts[parts.length - 1]) % 3;
  return {
    book: offset === 0 ? 'John' : 'Psalms',
    chapter: offset === 0 ? 3 : 23,
    startVerse: 1 + offset,
    endVerse: 4 + offset
  };
}
