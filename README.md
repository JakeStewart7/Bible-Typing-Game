# Bible-Typing-Game
A typing game for the Bible.

## Stronghold

Choose **Stronghold** from the main menu or sidebar to play a local cooperative
typing strategy game with three simulated teammates. The full-screen battlefield
follows the Paint design: borderless bright-green map, gray castle, colored shape-coded
units, upper-right population/resource HUD, central hexagonal **Tier Up** button,
and four colored player panels along the bottom. Switch Player 1's role dropdown
between Economy, Army, Unit Control, and Defenses to join that role.
Players on the same role share the selected task, typed text and completed
work; each finished task costs and rewards supplies only once. Simulated
teammates help type your chosen task without changing it or placing your buildings.
Roles can be left unoccupied. The prominent private typing area is centered above
the bottom panels. Focus returns to its input after game buttons, role/length
changes, map gestures and new entries, without interrupting an open dropdown.
Unit Control can also type for supplies, and typing stays available while a
building is ready for placement or your tier contribution is finished.
Only pause, hidden/inactive gameplay and a finished match disable the input.

Matches start with **50 supplies** and **Medium** text. Choose **Short** (tiny words), **Medium** (long words), **Long** (short phrases),
or **Extra Long** (full sentences) in the Length selector. A fully correct entry
adds 1, 2, 3 or 4 work respectively; partial or incorrect text never fills the
player bar. A basic task needs 8 work, with higher-tier construction/training
needing 16 or 24. Each role keeps independent completed work for every task,
building tier and upgrade type, even when that role becomes unoccupied.
Switching tasks, roles or lengths and completing tier challenges preserves this
work; only completing or placing that specific task resets its bar.
Filling the bar recruits a unit, earns supplies,
upgrades technology, or makes construction ready. Gatherers are **free** to create.
Costs appear in separate player-colored badges. Selections, buttons, the input's
**Type here** prompt and basic arrow/text cursors share each player's dark and
light palette. Your typed text appears both in the central input and in your
small player display, just like your teammates' typed text.

**Dev options** sets the starting computer state, default text length and starting
supplies (0-10,000). **Apply & new game** saves these defaults on this device and
starts a fresh match. Subsequent **New game** actions and page reloads use the
saved defaults; changing them does not save an ongoing match.

**Relay** starts placement immediately, with no typing requirement or work spent.
A translucent building shadow follows the map cursor; its outline is red at
illegal sites. Click to place, or use Alt+arrow keys and Alt+Enter. Escape or
**Cancel** dismisses placement; selecting the same prepared building resumes it
without losing work. Relays still cost 15 supplies. Other buildings need their
work bar filled first. Builders construct and repair automatically. Gatherers strike
resource nodes, collect a visible yellow chunk, then physically carry it to the
nearest completed relay or castle before harvesting again. Relays forward deposited
chunks to the castle through links no more than 155 map units apart; destroying a
relay interrupts deliveries until the route is restored.

Controls, typing and logs use consistent bold Arial-family typography and larger,
high-contrast text; repeated captions stay out of
the battlefield. Enemy troops are dark-red squares (melee), diamonds (archers),
and triangles (siege), with red outlines. Castle and enemy-base health appear in
the HUD. **Help** contains the map key and instructions. On narrow screens the
player panels scroll instead of shrinking their text.
The castle is a clean square and towers use T-shaped map and HUD icons.
All units move at 30% of their original speed and have twice their original health,
including wave and troop-upgrade health bonuses. The home castle has 10,000 HP,
ten times its original health. Moving units bob gently; attacks and harvesting
briefly flash a strike toward their target. Reduced-motion preferences disable
the bob and attack-size pulse. Full-width player progress bars are three times
thicker for visibility and show the same progress for everyone sharing a role.
Their outer borders are thick black around an inner player-colored rim. The event
history aligns with Player 1's left edge above the bottom panels, starts at the
top of a stable-height window and fills downward, with a transparent background,
player-colored action text and gray world events. Dark text outlines keep entries
readable over different battlefield colors. History is retained for the whole
match and resets with **New game**. The taller history window has no visible
scrollbar, fades smoothly at its edges, and can still be scrolled. The current
world event and its countdown sit slightly above it in a soft purple panel,
hidden between events.

Ready up to pause the battle for a shared tier challenge: everyone completes
three private phrases. Tier 1 unlocks warriors, barracks and towers, tier 2 adds
archers, and tier 3 adds catapults. Barracks automatically train units at their
selected construction tier and consume shared supplies. Separate tiles let you
build tier 1, 2 or 3 barracks and towers. Higher-tier construction and manual
training require 8, 16 or 24 completed-entry work respectively.
The simulated Army teammate earns supplies at Tier 0 instead of waiting idle
for locked training; after Tier 1 unlocks it builds a barracks and trains troops.
**Stop computers** pauses simulated teammates' typing, readiness, construction
choices and army orders, along with automatic production at their barracks.
The battlefield, existing units and human-owned barracks keep running; the human
can still type. **Resume computers** continues them without catching up missed
typing time. The toggle is also available during tier challenges, which require
the computers' contributions before they can finish.
Higher-tier barracks and towers have more health, and troop upgrades enlarge
their map icons as well as improving their combat stats.
Each troop type and tower tier has its own resource-funded upgrade button and
once-per-tier limit beginning at its unlock tier. Economy gets two upgrades at
tier 0 and one additional upgrade per subsequent tier. World events begin at
**1:00, 3:00, 5:00**, and subsequent odd minutes of active battle time, each
lasting **35 seconds**. They rotate through left-hand, vowel, number, symbol
and code drills, with normal scripture typing between events, without discarding
a phrase already in progress at either transition. Enemy waves add ranged and siege formations as their
base develops. Select troops with
click/Shift-click, drag a selection rectangle (Shift adds to the selection), or
**Select all troops**, then click the battlefield or use **Defend** / **Assault
base**. **Set rally on map** makes the next map click the production rally point.
No coordinate fields are needed. Destroy the enemy
stronghold before invading waves destroy yours.

The game pauses when you leave the mode, hide the tab, or select **Pause**.
The complete simulation and UI refresh on animation frames at a 60 Hz target;
SVG entities and teammate cards are retained rather than rebuilt each frame.
**New game** resets the match. Local matches are not saved across reloads.
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
