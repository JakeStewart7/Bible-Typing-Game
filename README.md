# Bible-Typing-Game
A typing game for the Bible.

## Stronghold

Choose **Stronghold** from the main menu or sidebar to play a local cooperative
typing strategy game with three simulated teammates. Switch between Economy,
Army production, Army control, and Defenses. Type exact phrases to earn shared
supplies and recruit units, or complete construction phrases and place buildings
on the battlefield. Builders construct and repair automatically. Connect resource
nodes to the castle with relays no more than 155 map units apart; destroying a
relay interrupts deliveries from disconnected nodes.

Ready up to pause the battle for a shared tier challenge: everyone completes
three private phrases. Tier 1 unlocks warriors, barracks and towers, tier 2 adds
archers, and tier 3 adds catapults. Barracks automatically train units at their
construction tier and consume shared supplies. World events cycle through
scripture, left-hand, vowel, number, symbol and code drills without discarding a
phrase already in progress. Enemy waves add ranged and siege formations as their
base develops. Select troops with
click/Shift-click or **Select all troops**, then click the battlefield, enter map
coordinates, or use **Defend castle** / **Assault enemy base**. Destroy the enemy
stronghold before invading waves destroy yours.

The game pauses when you leave the mode, hide the tab, or select **Pause**.
**New stronghold** resets the match. Local matches are not saved across reloads.
No additional dependencies or downloads are needed.

`src/stronghold/domain/` implements the authoritative simulation with explicit
commands and detached per-player snapshots. Only the recipient's target phrase
is included; other players expose their typed text and progress.
`StrongholdConnection` is the UI's transport port, implemented by
`LocalStrongholdConnection` for offline play. A future network adapter can send
commands to a host running `StrongholdEngine` and deliver its per-player
snapshots. It must validate incoming message schemas and enforce connection-bound
player identities, monotonic command sequencing, and an authoritative host clock.
The current mode is explicitly simulated, not cross-device multiplayer.

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

Mock rooms support host-managed bots with independent Easy, Normal, or Hard
typing profiles. Passage lengths are absolute character ceilings (60, 120, 250,
500, or 1,000 characters), so a passage may end partway through its final verse.
The reference still includes that verse. Guessing lasts 30 seconds and submits
each player's latest draft when the deadline expires.

The UI depends on the `MultiplayerClient` and `RoomConnection` contracts in
`domain/types.ts`. A future WebSocket or WebRTC implementation should implement
those contracts and leave the room UI and gameplay rules unchanged. In a
production deployment, execute `RoomEngine` on the authoritative host or server
and validate serialized commands before dispatching them.
