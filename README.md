# Bible-Typing-Game
A typing game for the Bible.

Development conventions are documented in [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md).

## Multiplayer foundation

The **Together** workspace runs a complete multiplayer loop against a local mock
authority. Create a room, add simulated players, and exercise synchronized
typing, shared passage guesses, scoring, and ready-up without deploying a
backend.

Multiplayer code is isolated under `src/multiplayer/`:

- `domain/` owns room states, commands, phase transitions, and scoring.
- `infrastructure/` supplies passages and the in-memory mock transport.
- `ui/` renders snapshots and sends player intentions.

All game modes share the input processing and typing presentation primitives in
`src/typing/session.ts`, including correctness tracking, live statistics,
character states, progress, and caret behavior.

The UI depends on the `MultiplayerClient` and `RoomConnection` contracts in
`domain/types.ts`. A future WebSocket or WebRTC implementation should implement
those contracts and leave the room UI and gameplay rules unchanged. In a
production deployment, execute `RoomEngine` on the authoritative host or server
and validate serialized commands before dispatching them.
