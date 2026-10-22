# Bible-Typing-Game
A typing game for the Bible.

## Stronghold

Choose **Stronghold** from the main menu or sidebar to play a local cooperative
typing strategy game with three simulated teammates. The full-screen battlefield
follows the Paint design: borderless bright-green map, gray castle, colored shape-coded
units, upper-right population/resource HUD, central hexagonal **Tier Up** button,
and four colored player panels along the bottom. Switch Player 1's role with the
supply bag (Economy), outline sword (Army), cursor (Unit Control), and castle (Defenses) buttons.
Players on the same role choose their tasks independently. Players working on the
same task contribute completed entries to its shared work bar;
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
Pause, hidden/inactive gameplay, a finished match, or a tier-locked task disable the input.
Mistyped letters in both the prompt and input have vibrant player-colored
highlighting and an underline, without a strike-through obscuring the letters;
correct letters remain unmarked in the input.
Unit Control can select and move gatherers and builders as well as troops.
Its four outlined command tiles show selection, defense, assault and building-rally
icons, with numbered shortcuts and a highlighted rally-targeting state.
Economy starts with **Gatherer** selected. Recruitment tiles show living units
on the field separately from troop queues; the HUD includes all five friendly
unit types. Builder and Gatherer progress clearly indicates a reached population
limit. Recruitment resumes when a slot opens; new recruits and trained troops
spawn at clear, unoccupied positions rather than inside walls or other units.
After reaching a manual destination, gatherers and builders wait two seconds,
then automatically resume the nearest resource, construction or repair job.
Builders stop within work range and stand still, showing silver-white pulsing
sparks while building or repairing.
Each new construction job takes the nearest available living builder, not the
first builder in the unit list. Busy builders keep their current job; manually
moving builders and those in their two-second idle wait are unavailable.
Completed or destroyed jobs release their builders for reassignment.

Matches start with **50 supplies** and **Medium** text. Choose **Short** (1-5
characters, 1x), **Medium** (6-11, 1.1x), **Long** (12-24, 1.25x), or
**Extra Long** (25-40, 1.5x) in the
length scroller, using **Page Up** for longer text and **Page Down** for shorter
text (or click an option). Normal play and tier challenges use words or word groups.
World events have separate left-hand, vowel, number, symbol and code drill pools
in `src/stronghold/domain/event-phrases.ts`, respecting the selected length.
The four separately exported, frozen constants in
`src/stronghold/domain/word-pools.ts` provide hundreds of curated entries per
length class, including single words and natural phrases. Each player draws from
a shuffled bag of all entries in their current pool, reshuffling on exhaustion
and avoiding immediate repeats and phrases currently displayed by teammates.
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
**Warriors, Archers and Catapults** queue at completed Tier 1, 2 and 3 barracks,
respectively. Supplies are paid when queued, with no typing required; the selected
typing task and private input stay untouched. Each barracks trains one unit every
12 seconds, spawning it beside that barracks before it moves to the rally point.
Multiple matching barracks balance new orders by queue length. Queued units count
toward population limits. Buttons show queue counts; barracks show their current
unit and training progress. Empty barracks do not produce or spend supplies.
Destroyed barracks lose their remaining orders. Upgrades remain immediate purchases.
Relays also use supplies without typing, paid when their map location is placed.
Only paid actions show supplies-cost badges. Selections, buttons, the input's
**Type here** prompt and basic arrow/text cursors share each player's dark and
light palette. Your typed text appears both in the central input and in your
small player display, just like your teammates' typed text.
Every role panel uses the same shared styling and muted, readable player-colored
text for its heading, role selector, task labels, costs, progress labels and typed
text. Tier contribution cards use that same palette. Bright accents and
white/gray panel backgrounds remain unchanged.
The Stronghold typing cursor snaps directly to the current character without
animated travel or a movement speed limit.

Joining **Army** after Tier 1 unlocks selects its saved Barracks work rather than
an invisible Supplies task. At Tier 0, Army types for supplies until construction
unlocks. Locked building tiles cannot be selected, cycled to, or typed for by
humans or simulated teammates.
Simulated teammates keep their own task selection; matching tasks share work
without switching anyone else's task or replacing their input.
Ready work is preserved through tier challenges, and placement unlocks only at
the building's required tier.

**Dev options** sets the starting computer state, default text length, default player
color (red, blue, yellow or green), starting
supplies (0-10,000), starting tier (0-3), and starting counts for Gatherers, Builders,
Warriors, Towers, Archers and Catapults, from zero up to their normal population
limits. Starting towers use the selected starting tier (at least T1); starting
troops may be supplied before their normal recruitment unlock. You can also choose
the starting season (or Random each game) and day/night. Valid field changes save automatically in this
browser, even without pressing Apply. **Apply & new game** starts a fresh match.
Subsequent **New game**, **Build again** and page reloads use the saved defaults;
changing them does not save an ongoing match.
Choosing a teammate's color swaps that teammate to red so everyone stays distinct.
**Next Wave** in Dev options immediately spawns the next wave and resets the
countdown without advancing battle time or restarting. It is unavailable while
paused, during a tier challenge, or after the match ends.

The first wave arrives after **60 seconds**. The first two waves have **one
invader each**, giving the two starting warriors time to defend without new
troops. Later waves grow by one invader at a time, up to 18; their intervals
start at 78 seconds and gradually shorten to no less than 45 seconds.
Friendly and enemy towers now have **twice their previous health**. Tier 1/2/3 towers
have 480/660/840 health. T1 damage is halved, including upgrade and enemy-wave
bonuses; T2/T3 damage is unchanged.
Tower attack range and firing interval are unchanged.
Switching to another browser tab automatically pauses Stronghold, including
the battlefield and computer typing. Returning resumes without catching up
the time spent away; switching screens or using Pause also stops the simulation.

By default, each new Stronghold match uses system-generated randomness to pick one of four
seasonal maps, with an independent **25% chance per season**. Consecutive repeats
are possible. Selecting a fixed starting season or using the live season preview
saves that preference for future matches; choose **Random each game** to restore
random selection. Only resource
node positions change: every layout keeps six standard nodes, two rich nodes,
and 7,200 total supplies, with the same bases, troops and rules. Spring uses light
green grass and pastel flowers fading in and out along one shared, randomly chosen
breeze direction, with a faster drift. Summer uses deep green grass and light motes
blowing right, smoothly easing up and down and pulsing as they catch the light.
Fall uses light brown ground and slowly falling autumn-colored triangles that sway
back and forth; winter has blue-white ground and snow circles that fade before
reaching the bottom. Leaves randomly use red, orange, yellow
or brown. A fixed pool of 48 decorative particles stays in screen space, independent
of map pan and zoom. Spring shows just 18 flowers and summer 32 motes, with
randomized, well-spaced starting positions rather than regular diagonal patterns.
Animation phases are staggered; flowers and motes are spread across both axes
rather than falling from the top. Weather is clipped to the battlefield and
layered underneath UI, never intercepts clicks, and
is hidden for reduced-motion preferences.
Days and nights each last three minutes of battle time, with fifteen-second
dusk/dawn fades. Night blends a moonlit blue overlay into the entire Stronghold
view, including its UI and tier challenge, preserving vibrant colors rather than
uniformly dimming the screen. Pausing, tabbing away and tier challenges
freeze the environment clock; new games start in daylight.
Seasons also change gameplay: summer makes every friendly and enemy unit 15%
faster; winter makes all units 15% slower and resource income worth 20% less.
Spring increases resource income by 20%. Resource value applies once when
supplies are credited, both from typing and from delivered cargo, including
economy upgrades. Cargo and existing supplies are not rewritten on a season change.
Fall adds 15% to completed typing work, including world-event drills and shared
Tier Up contributions; partial input still earns nothing. Seasonal modifiers
take effect immediately, and fractional supplies and work retain two decimals.
Under **Dev options / Current match**, **Skip to Night** and **Skip to Day** jump
the environment clock without advancing waves, world events or battle time.
The **Season** selector immediately updates terrain, weather, music and resource
positions without restarting. It preserves node identities, remaining supplies,
gatherer assignments and existing deliveries. These controls require a running
match outside a tier challenge. Season and day/night previews also update the
saved starting season/time; Next Wave remains a one-shot action.

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
site. **Credits** opens a dedicated in-game page with plain-text track titles
and attribution, without clickable links. All eight tracks are by **Kevin MacLeod (incompetech.com)**,
licensed under [Creative Commons: By Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
Recordings are unmodified and loop during playback. Music waits three seconds
before its first playback, then fades in over half a second. Pausing, muting
and changing season or day/night fade out; resuming and the next track fade in.
Each fade in or out lasts half a second. The volume slider preserves its target
across fades. Official source details are in
`assets/music/stronghold/CREDITS.txt`.

The thin typing window leaves room for the battlefield, with input before the
phrase on wider screens and above it on small screens and in Tier Up. Flat gray panels,
square controls and player-colored highlights keep the bottom dock simple.
The top controls use a shaded forest-green backdrop; the player deck sits on a
dark command board. Subdued map texture and a soft battlefield vignette add depth
without obscuring text or intercepting clicks. The faded length reel sits to the
left of typing, with its **PgUp / PgDn** indicator on the reel's left and a thin
dark player-colored divider between the keys.
The length reel stays clipped while keeping its neighboring choices clickable.
Stronghold typing uses the same Arial-family font as the controls and a thin
neutral caret. Mistakes retain a vivid highlight, outline and underline matching
the selected player color, without a strike-through.
The larger Tier Up badge aligns with the top controls and hangs below the bar.
Economy places Gatherer and Supplies together, Relay beneath, and its upgrade last.
Unit Control's role button reuses the actual player cursor.
Hover descriptions appear immediately in dark styled tooltips, including disabled
controls and map entities. The custom player cursor remains visible while typing,
over controls and dialogs, with the native custom cursor as a fallback.
The deck fits the viewport height, with scrolling inside action panels
and the squad list on narrow screens rather than clipping the bottom.
The map starts at **200% zoom**, focused toward the home base. Use the mouse wheel
to zoom, and **Alt-drag or middle-drag** to pan without issuing orders.
Hovering near a map edge does not scroll.
Hold the **arrow keys** to pan; diagonal combinations work and opposite keys cancel.
Right-click issues movement orders or cancels placement; it never pans.
Successful movement orders briefly mark their destination with a player-colored
click pulse; reduced-motion mode uses only a fade.
Minimum zoom shows the entire map; zoom and pan do not change world coordinates or speed.
Shift-drag retains additive army selection.

The length selector is a faded reel: **Page Down** selects shorter entries,
**Page Up** longer entries, from anywhere outside dropdowns and dev fields.
Clicking an option also works; endpoints do not wrap or discard current typing.
Text length selections do not add entries to the event log.
Shift+arrows still selects typed text. **Alt+1...9** selects the corresponding
visible task in your current role. Army now has nine tasks and no Supplies tile;
Unit Control has no Supplies tile either.
Economy orders its options **Gatherer, Relay, Supplies**, then Upgrade.
The compact forest-green and brass command bar reserves more room for the map.
All four player panels stay within the bottom dock; narrow
screens use a two-by-two layout, with scrolling inside action lists when needed.
**Tab** cycles forward through the current role's unlocked typing and placement tasks;
**Shift+Tab** cycles backward, wrapping at either end and returning focus to typing.
Locked tasks, troop purchases and upgrades are excluded, so cycling never spends supplies.
Unit Control explicitly reminds players that typing produces shared supplies.
Tab retains normal focus navigation in menus, dropdowns, Dev options and tier challenges.
Button shortcuts appear instantly on hover rather than taking up tile space.
Tier-locked actions use gray styling and a lock icon. Unit Control
also uses Alt+1 for selection, Alt+2 for Defend, Alt+3 for Assault and Alt+4
for rally placement. Keyboard actions restore typing focus.

**Relay** starts placement immediately, with no typing requirement or work spent.
Only Relay is highlighted while it is selected, not the underlying typing task.
A plus badge on your player-colored cursor indicates building placement or rally
targeting; it clears when targeting is cancelled, gameplay pauses, or the match ends.
A translucent building shadow follows the map cursor; its outline is red at
illegal sites. Click to place, or use Alt+arrow keys and Alt+Enter. Escape or
**Cancel** dismisses placement; selecting the same prepared building resumes it
without losing work. Relays cost 30 supplies. Other buildings need their
work bar filled first. Builders construct and repair automatically. Gatherers strike
resource nodes, collect a blue chunk (standard) or purple chunk (rich), then carry
it to the nearest completed relay or castle before harvesting again. Relays forward deposited
chunks to the castle through links no more than 155 map units apart; destroying a
relay interrupts deliveries until the route is restored. Cargo keeps its origin
color while carried, regardless of mining upgrades, and sit ahead of the gatherer
in its movement direction, retaining that facing while stopped. Active relay deliveries use
neutral-colored glowing chunks and muted links; disconnected cargo does not glow.
Faint radius rings mark friendly relays, including unfinished ones, and the castle.
Hover a relay or the castle, or preview a new relay, to highlight the full ranges
of nearby completed and unfinished relays within 155 map units, including the
castle itself. A green preview reaches the castle network; amber dashed links
are disconnected or planned. Radius rings use world units
and remain accurate while zooming. Unfinished relays can preview potential
connections but do not deliver resources until construction finishes.
Towers retain the simple T1 silhouette, growing subtly larger and darker at T2/T3.
Attack impacts retain their explosion without the extra crossing slash lines.

Units prefer routes around all living buildings, including unfinished structures.
Buildings may be placed over units; those units can move out, and units may pass
through buildings when no route around exists rather than becoming trapped.
Walls are 25% thicker, with matching collision bounds and placement previews.
The **scroll wheel** rotates a wall placement preview or selected wall in
22.5-degree steps through sixteen orientations, instead of zooming. No rotation
button, Alt+R or Shift-click shortcut is used. **Done**, Escape or clicking empty
ground finishes editing. Rotation and placement can overlap units but cannot leave
the construction area. Placement outlines and actual buildings use the same
tier/upgrade-scaled footprint. Blocking buildings are highlighted in
red, and the preview explicitly reports insufficient supplies or other failures.
Units route around wall ends whenever a route is available.

Controls, typing and logs use consistent bold Arial-family typography and larger,
high-contrast text; repeated captions stay out of
the battlefield. Enemy troops are dark-red squares (melee), diamonds (archers),
and large wheeled siege carts (catapults), with red outlines. Catapults move at
half their previous speed, stop to attack and need 0.8 seconds to aim before
firing. Moving resets the shot cooldown and requires a fresh aiming delay.
The emphasized resource icon and count
lead the HUD without a visible Supplies caption, followed by population counts;
castle health, wave countdown and season/day labels are
omitted. Weather, day/night lighting and Dev previews still work.
**Help** contains the map key and instructions. On narrow screens the
player panels scroll instead of shrinking their text.
The castle is a clean square; towers progress from a simple T shape to fortified,
armed silhouettes, while the compact HUD keeps its T-shaped tower icon.
Friendly and opposing units of the same formation share base health, damage,
range and speed; enemy waves no longer add hidden health or damage bonuses.
Movement remains slow, and troop upgrades still improve your units.
Both bases have **4,000 HP**; enemy tier upgrades do not increase that maximum
or heal damage. Archers on both sides bob even while standing or firing, with
a 25% faster bobbing cycle.
Builders remain stationary while building or repairing. Building and gathering
use silver-white sparks and a soft shimmer; warriors use silver with a dark steel outline, and combat uses an ember-colored jagged
strike and expanding slash burst. Enemy attacks show only the explosion, without
overlaid beam or slash lines. Reduced-motion preferences disable bobbing,
pulsing and rotating effects. Square warriors and square enemies rock back and
forth on alternating lower corners while walking.
Player progress bars are 20 pixels tall with 2-pixel colored borders and stay
inside their padded 3-pixel panel frames, including Player 1 at full progress.
Task bars, barracks training bars and the shared tier bar are also thicker.
Players choosing the same task in a role show its shared progress; other task
selections remain independent. The event
history aligns with Player 1's left edge above the bottom panels, starts at the
top of a stable-height window and fills downward, with a mostly transparent background,
player-colored action text and gray world events. Dark text outlines keep entries
readable over different battlefield colors. History is retained for the whole
match, begins with **Game started**, and resets with **New game**. The history panel
is 25% narrower with half its previous inner left padding; entries wrap as needed.
The history window has no visible scrollbar, fades smoothly at its edges, and
can still be scrolled. The current
world event and its countdown sit slightly above it in a soft purple panel,
hidden between events.

Matches start at **Tier 0**, with T1 starting units and buildings.
The first challenge advances to Tier 1, unlocking T1 barracks, warrior training
and tower construction; prepared construction work is preserved.
The **Tier Up** hexagon is top-aligned inside the command bar with solid fill and
beveled edges, not a gradient. It shows a resource-symbol price and stays gray and
disabled until the team can afford **300 / 600 / 1,500 supplies** for T1/T2/T3.
The cost is charged once when the shared challenge starts, not per player or phrase.
It pauses the battle for one shared challenge:
500 correct characters shared by the squad, credited only when a whole phrase
is completed correctly. Partial and incorrect input add no progress, and length
bonuses do not apply. The first challenge uses letters, the next adds numbers, and the last
adds symbols and punctuation. Anyone can contribute any number; segments in the
shared progress bar use each player's light color. The challenge displays
shared progress rather than character counts. Player cards show each player's
current typed text without individual percentage labels.
**Pause challenge** freezes typing without dismissing the dialog; **Resume
challenge** continues with all work intact. Stopped computers do not prevent
readiness or solo completion. Tier 2 adds archers, and Tier 3 adds catapults.

Paid options use higher prices, while typing-only recruits and construction
remain free of supply costs. Unaffordable buttons and prices turn gray without
strikethroughs; centered cream-colored cost badges use the same round resource
symbol as the HUD, with the symbol and number vertically aligned.
Upgrade levels are centered. Instant styled tooltips report the available amount
and shortage. The state updates as supplies arrive.

| Purchase | Supplies |
| --- | ---: |
| Relay | 30 |
| Tier 1 / Tier 2 / Tier 3 challenge | 300 / 600 / 1,500 |
| Warrior / Archer / Catapult | 25 / 45 / 80 |
| Economy upgrade | 120 |
| Warrior / Archer / Catapult upgrade | 60 / 100 / 160 |
| T1 / T2 / T3 tower upgrade | 75 / 125 / 180 |
Separate tiles let you
build tier 1, 2 or 3 barracks and towers. Higher-tier construction fills more
slowly; queued troop purchases require only supplies, not typing.
The simulated Army teammate builds matching barracks and queues a mixed army.
**Stop computers** pauses simulated teammates' typing, construction
choices and army orders, along with training their queued requests.
The battlefield, existing units and human training requests keep running; the human
can still type. **Resume computers** continues them without catching up missed
typing time. The toggle is also available during tier challenges.
Higher-tier barracks and towers have more health, and troop upgrades enlarge
their map icons as well as improving their combat stats.
Each troop type and tower tier has its own resource-funded upgrade button and
once-per-tier limit beginning at its unlock tier. Economy gets two upgrades at
tier 0 and one additional upgrade per subsequent tier. World events begin at
**1:00, 3:00, 5:00**, and subsequent odd minutes of active battle time, each
lasting **35 seconds**. They rotate through left-hand, vowel, number, symbol
and code-themed drills without discarding
a phrase already in progress at either transition. Enemy waves add ranged and siege formations as their
base develops. Select troops with
click/Shift-click, drag a selection rectangle (Shift adds to the selection), or
**Select all troops**, then **right-click** the battlefield or use **Defend** / **Assault
base**. Click or Shift-click friendly buildings to select them, then right-click
to set their individual rally points. Barracks send newly trained units to their
own rally; a castle rally also directs newly recruited gatherers and builders
before they resume automatic work. Unit Control's **Rally all buildings** applies
one rally point to all friendly buildings and becomes the default for future
barracks. Mixed unit/building selections both move units and update building
rallies on right-click. **Ctrl+Tab / Ctrl+Shift+Tab** cycle roles forwards/backwards
when the browser delivers those keys to the game; role buttons remain available
in browsers that reserve these shortcuts for tab switching.
Manual movement takes priority over enemy pursuit and automatic rally orders
until arrival, allowing troops to retreat from combat; normal fighting then resumes.
Warriors prioritize nearby enemy towers over the enemy castle once movement
orders finish, while still defending themselves against nearby enemy troops.
No coordinate fields are needed. Destroy the enemy
stronghold before invading waves destroy yours.
Left-clicking empty ground clears the selection without moving units.
Unlocked recruitment tiles show compact population counts in their top-right
corner, replacing the tier lock. Costs sit in centered supply badges, and the
text-length reel stays clipped while hovering; its visible neighboring choices
remain clickable. Summer motes drift twice as fast as before, with double the
vertical sway and brighter light pulses.
Left-click still places a building or rally point; right-click cancels targeting.
The browser context menu is suppressed inside Stronghold, including while paused.

The game pauses when you leave the mode, hide the tab, or select **Pause**.
The complete simulation and UI refresh on animation frames at a 60 Hz target;
SVG entities and teammate cards are retained rather than rebuilt each frame.
The command bar's battle timer pauses with gameplay and during tier challenges,
and freezes on victory or defeat. **New game** and **Build again** reset the match,
timer, typing, role/task progress, selections, placement and wall rotation, history,
camera, weather animations, and open panels using the saved new-match defaults.
Local matches are not saved across reloads.
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
