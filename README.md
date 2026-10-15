# Bible-Typing-Game
A typing game for the Bible.

## Stronghold

Choose **Stronghold** from the main menu or sidebar to play a local cooperative
typing strategy game with three simulated teammates. The full-screen battlefield
follows the Paint design: borderless bright-green map, gray castle, colored shape-coded
units, upper-right population/resource HUD, central hexagonal **Tier Up** button,
and four colored player panels along the bottom. Switch Player 1's role dropdown
between Economy, Army, Unit Control, and Defenses to join that role.
Players on the same role contribute completed entries to a shared task work bar;
each finished task costs and rewards supplies only once. Each player keeps an
independent phrase, text box, display, length setting and typing progress.
Teammates completing entries, changing length or placing buildings never replace
or clear your text. Simulated teammates contribute their own completed entries
without typing into your box or placing your buildings.
Roles can be left unoccupied. The prominent private typing area is centered above
the bottom panels. Focus returns to its input after game buttons, role/length
changes, map gestures and new entries, without interrupting an open dropdown.
Unit Control can also type for supplies, and typing stays available while a
building is ready for placement or your tier contribution is finished.
Only pause, hidden/inactive gameplay and a finished match disable the input.
Unit Control can select and move gatherers and builders as well as troops.
After reaching a manual destination, gatherers and builders wait two seconds,
then automatically resume the nearest resource, construction or repair job.
Builders rock and show small pulsing sparks while building or repairing.
Each new construction job takes the nearest available living builder, not the
first builder in the unit list. Busy builders keep their current job; manually
moving builders and those in their two-second idle wait are unavailable.
Completed or destroyed jobs release their builders for reassignment.

Matches start with **50 supplies** and **Medium** text. Choose **Short** (1-5
characters, 1x), **Medium** (6-11, 1.1x), **Long** (12-24, 1.25x), or
**Extra Long** (25-40, 1.5x) in the
length scroller. Entries are normal words or word groups, including during world
events and tier challenges. The four separately exported, frozen constants in
`src/stronghold/domain/word-pools.ts` provide hundreds of curated entries per
length class, including single words and natural phrases. Players cycle through
their class's pool while avoiding phrases currently displayed by teammates.
A fully correct entry earns its character count,
including spaces, times its length bonus; partial or incorrect text earns nothing.
**Supplies, Gatherer, Barracks, Builder, Wall and Tower** use typing without
spending supplies. Each typing tile has a thick, player-colored mini progress bar,
not a money or Free badge. Selecting it shows that task's progress in the main
player-colored experience bar. Bars have the same size: more expensive tasks
fill more slowly, with barracks and tower requirements proportional to their
former supplies costs and construction tier. The UI shows percentages, not those
internal character costs. Each role keeps independent progress for every typing task
and building tier, even when that role becomes unoccupied.
Switching tasks, roles or lengths and completing tier challenges preserves this
work. A full construction bar shows **Ready**, without a stacked completion counter
or cycling red layers. Excess from the entry that fills it carries into the next
bar after placement; further entries while it is ready do not bank extra
completions. Supplies, Gatherers and Builders execute automatically when their
bars fill and retain entry overflow. Blocked tasks retain their earned progress.
**Warriors, Archers, Catapults and upgrades** are immediate supplies purchases,
requiring no typing and leaving the selected typing task and private input untouched.
Relays also use supplies without typing, paid when their map location is placed.
Only paid actions show supplies-cost badges. Selections, buttons, the input's
**Type here** prompt and basic arrow/text cursors share each player's dark and
light palette. Your typed text appears both in the central input and in your
small player display, just like your teammates' typed text.
The Stronghold typing cursor snaps directly to the current character without
animated travel or a movement speed limit.

**Dev options** sets the starting computer state, default text length, starting
supplies (0-10,000), and starting map zoom (1.0-2.0). **Apply & new game** saves these defaults on this device and
starts a fresh match. Subsequent **New game** actions and page reloads use the
saved defaults; changing them does not save an ongoing match.
**Next Wave** in Dev options immediately spawns the next wave and resets the
countdown without advancing battle time or restarting. It is unavailable while
paused, during a tier challenge, or after the match ends.

The first wave arrives after **60 seconds**. The first two waves have **one
invader each**, giving the two starting warriors time to defend without new
troops. Later waves grow by one invader at a time, up to 18; their intervals
start at 78 seconds and gradually shorten to no less than 45 seconds.
Friendly and enemy towers have **50% more health and damage**. Tier 1/2/3 towers
have 240/330/420 health; damage scaling includes tower upgrades and enemy waves.
Tower attack range and firing interval are unchanged.
Switching to another browser tab automatically pauses Stronghold, including
the battlefield and computer typing. Returning resumes without catching up
the time spent away; switching screens or using Pause also stops the simulation.

Each new Stronghold match randomly picks one of four seasonal maps. Only resource
node positions change: every layout keeps six standard nodes, two rich nodes,
and 7,200 total supplies, with the same bases, troops and rules. Spring uses light
green grass and pastel flowers, summer deep green grass and faint light rays,
fall light brown ground and autumn-colored triangles, and winter blue-white
ground and softly fading snow circles. Leaves randomly use red, orange, yellow
or brown. The small decorative particle pool starts beneath the top UI and stays
inside the battlefield, never intercepts clicks, and is hidden for reduced-motion preferences.
Days and nights each last three minutes of battle time, with fifteen-second
dusk/dawn fades. Night blends a moonlit blue overlay into the entire Stronghold
view, including its UI and tier challenge, preserving vibrant colors rather than
uniformly dimming the screen. Pausing, tabbing away and tier challenges
freeze the environment clock; new games start in daylight.
Under **Dev options / Current match**, **Skip to Night** and **Skip to Day** jump
the environment clock without advancing waves, world events or battle time.
The **Season** selector immediately updates terrain, weather, music and resource
positions without restarting. It preserves node identities, remaining supplies,
gatherer assignments and existing deliveries. These controls require a running
match outside a tier challenge; they do not change saved new-match defaults.

Stronghold's **Music** button and volume slider control its local seasonal
soundtrack. Only the current recording loads; day/night transitions choose the
matching track, and pausing, opening Credits, hiding the tab or leaving Stronghold
stops playback. Muting or pausing preserves the current position. Autoplay or
loading failures display a retry message rather than failing silently.

| Season | Day | Night |
| --- | --- | --- |
| Spring | Flying Kerfuffle | Ethernight Club |
| Summer | Realizer | Sincerely |
| Fall | Newer Wave | Ether Vox |
| Winter | Voxel Revolution | Envision |

The eight original MP3s in `assets/music/stronghold/` total 57,194,887 bytes
(57.19 MB). They are bundled for local playback, not streamed from a third-party
site. **Credits** opens a dedicated in-game page with every title and official
source link. All eight tracks are by **Kevin MacLeod (incompetech.com)**,
licensed under [Creative Commons: By Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
Recordings are unmodified and loop during playback; source details are also in
`assets/music/stronghold/CREDITS.txt`.

The slim, stretched private typing strip leaves more height for the battlefield.
Its input stays 420px wide (or fits the available space on smaller screens),
centered beneath the displayed text, with the unlabeled length scroller directly
to its left. The top controls have a softly shaded blue-gray backdrop; feedback
appears at their bottom left. The typing module has a full-width white background,
while the player deck stays neutral gray across the full width. The header and
footer have subtle square-grid textures and crisp edge highlights to match the
shape-based battlefield. These backgrounds do not intercept map or control clicks.
The deck fits the viewport height, with scrolling inside action panels
and the squad list on narrow screens rather than clipping the bottom.
The map starts at **120% zoom**, focused toward the home base. Use **+/-**,
**Fit map**, and **Alt-drag or middle-drag** to navigate without issuing orders.
Fit shows the entire map; zoom and pan do not change world coordinates or speed.
Shift-drag retains additive army selection.

The length selector is a faded reel: **Left/Down** selects shorter entries,
**Right/Up** longer entries, from anywhere outside dropdowns and dev fields.
Clicking an option also works; endpoints do not wrap or discard current typing.
Text length selections do not add entries to the event log.
Shift+arrows still selects typed text. **Alt+1...9** selects the corresponding
visible task in your current role. Army now has nine tasks and no Supplies tile;
Unit Control has no Supplies tile either.
Each button displays its shortcut, and locked tasks remain locked. Unit Control
also uses Alt+1 for selection, Alt+2 for Defend, Alt+3 for Assault and Alt+4
for rally placement. Keyboard actions restore typing focus.

**Relay** starts placement immediately, with no typing requirement or work spent.
Only Relay is highlighted while it is selected, not the underlying typing task.
A plus badge on your player-colored cursor indicates building placement or rally
targeting; it clears when targeting is cancelled, gameplay pauses, or the match ends.
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
the bob and attack-size pulse. Square warriors and square enemies instead rock
back and forth on alternating lower corners; triangle motion is unchanged.
Full-width player progress bars are three times
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
build tier 1, 2 or 3 barracks and towers. Higher-tier construction fills more
slowly; manual troop purchases require only supplies, not typing.
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
and code-themed events, keeping normal-word typing in every event without discarding
a phrase already in progress at either transition. Enemy waves add ranged and siege formations as their
base develops. Select troops with
click/Shift-click, drag a selection rectangle (Shift adds to the selection), or
**Select all troops**, then **right-click** the battlefield or use **Defend** / **Assault
base**. **Set rally on map** makes the next map click the production rally point.
No coordinate fields are needed. Destroy the enemy
stronghold before invading waves destroy yours.
Left-clicking empty ground clears the selection without moving units.
Left-click still places a building or rally point; right-click cancels targeting.
The browser context menu is suppressed inside Stronghold, including while paused.

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
