# Na dobrou noc, mines and the SMG — recovered behaviour

28 Oct 2026. Analysis of the supplied original EXE and script 320. This is not a guess based on the Android port.

## The rabbit and other animated details

The script draws exactly one of two original object layouts. The log and rabbit can be missing with
probability 1/8, the stones with the mouse 1/10, the bush with the animal 1/8 and the side bush 1/7.
Coordinates, layers and individual collision rectangles come from the original script, not from
the full bitmap size.

The rabbit has four idle variants **223, 224, 225, 227**. After each one the script picks a random
variant 0–3 (`320:0x689`). The original frames are 71 ms apart. A hit on the local rectangle
`[79,50,112,80]` relative to the log sets death bit 2, disables the hit callback and starts **226**
(`320:0xa15`). The death plays once and stays on last frame 19. The rabbit does not come back in the
same game and the script awards no point for a player's kill.

The bush animal alternates 239, 240, 241, 243 the same way and uses 242 on death. State 1 plays bank
1 / sample 0. The mushroom decoration uses 228–230 including original chunk 10 offsets, the returning
ring frame and layer 2. The gap between the top collision and the mushroom base is preserved: a
player inside can shoot through the window left and right; the roof and lower part stop shots.

## The mouse behind the stone

States and transitions come from script `320:0x6d5..0x93e`:

| Direction | Climbing out | Hiding | Firing | Death |
|---|---|---|---|---|
| Right | 231 / state 0 | 232 / state 1 | 233 / state 2 | 234 / state 3 |
| Left | 235 / state 4 | 236 / state 5 | 237 / state 6 | 238 / state 7 |

Climbing out to the right runs first. Once out, the mouse fires only if a player is in the matching
horizontal sensor; otherwise it hides. The shot is created on the transition into the firing state, not
after it ends. The muzzle has the original absolute offset `(65,10)` right and `(-10,10)` left relative
to the stone, owner ID 9, basic shot type.

After firing it always hides. Only when hiding finishes does it set readiness and a timer of a random
**3 to 15 whole seconds**. The timer picks side 0/1. A new player entering a side sensor has a **1/4
chance** of making it climb out, if ready. If the player left before the mouse was out, it hides again.
Sensors use the player's original collision rectangle, not their centre.

Vulnerability `[36,0,45,14]` relative to the stone has callback 10 only in states 2/6. While hiding,
climbing or after death the ID is 255 and a shot just hits the scenery. Death switches state 2→3 or
6→7, plays the animation and disables the AI for good (`320:0xa58`).

Original sounds of bank 1: rabbit death 1, bush animal death 2, mouse death 3, mouse firing 4.

## An important fix to animation ends

The duration in the header is not the moment a one-shot animation stops. `0x439b90` first loads the
next block through `0x4399b0`, after the last regular block wraps the counter to 0 and with stop-frame
0 / loop=false stops at once through `0x439840`.

| Animation | Header | Last regular frame / stop |
|---|---:|---:|
| Short blink 223 | 497 ms / 7 frames | 426 ms |
| Rabbit 225/227/226 | 1420 ms / 20 frames | 1349 ms |
| Mouse climbs/hides/dies | 426 ms / 6 frames | 355 ms |
| Mouse fires | 639 ms / 9 frames | 568 ms |
| SMG | 639 ms / 9 frames | 568 ms |
| Placing a mine | 355 ms / 5 frames | 284 ms |
| Mine 177 on the ground | 1136 ms / 16 frames | 1065 ms |
| Explosion 178 | 781 ms / 11 frames | 710 ms |

The mushroom decoration explicitly sets stop-frame 1 (`native42`), so it also plays the ring block at
the nominal duration. This difference is preserved in the new implementation.

## Mines

- A pickup adds **one** mine up to a maximum of 4 (`0x41ec89..0x41ec98`), not four.
- Placement and ammo deduction happen at event 0 at **142 ms**. Turning or changing weapon before that
  event cancels the placement. L/R/U/D offsets relative to the joined outline of body and weapon are
  `(-3,44),(27,33),(4,19),(23,49)` (`0x4827d4`).
- The ground shows original animation **177**, not pickup image 268. It plays once, stays on frame 15
  and neither restarts nor fades on activation.
- It activates **2000 ms after placement**. The trigger is the 31×18 mine rectangle widened by 10 px on
  each side, i.e. 51×38. It is compared with the player's collision; merely touching edges is not
  enough. **The owner is not immune**; a player standing on the mine at activation is checked too.
- Detonation creates original explosion **178**. Damage and further chaining happen **142 ms after the
  explosion starts**. The explosion disappears after 710 ms.
- Damage uses the original central 4×4 probe and eight rays of 15 steps. Unnamed obstacles with ID 255
  are ignored per original function `0x41b250`. Animal hitboxes and other named objects can react.
  Chaining between mines of different owners uses a separately widened explosion rectangle, with no ray
  shielding.
- The type 3 detonator fires only the owner's activated mines. With a mix of active and inactive mines
  it remains; it is used up once it has fired all the owner's mines. With nothing to fire it plays no
  animation. The regular pickup generator skips type 3.

Detailed addresses and evidence: [mines-re.md](mines-re.md).

## SMG

Starting a burst uses one magazine. Events of the original animation occur at **71, 213, 355, 497 ms**,
create original shot kinds 3, 4, 5, 6 and play bank 3 / sample 3 for the first 3 shots and sample 4 for
the last. The weapon stays equipped through the whole last burst. It normally ends at 568 ms, and only
then, with ammunition used up, is the next owned weapon selected.

Releasing the trigger does not interrupt a burst. **Turning cancels the remaining shots**, as do a weapon
change and death. Evidence: `0x4179e0 → 0x439eb0 → 0x439840` pauses the old timer; the following
`0x439b40` only restores frame 0 and does not continue the timer. `0x42f290` sends no resume.

Shots now move by the original **40 px every 50 ms**, with one random cross offset of -4..4 px per step.
They use the original bitmaps and sizes; the whole distance travelled is checked, including thin walls
and the original condition that merely touching edges is no hit.

## Verification and limits of the match

Simulation tests cover a player's real shot from the window, the rabbit's death and lasting state, both
sides of the mouse, vulnerability while firing, triggering one's own mine, timed explosions, chaining,
burst interruption and native shot steps. A browser check verifies really drawn original frames
226/234/177/178 and sounds.

These parts follow the available original code. A fully bit-exact game is still not proven: JS has its
own RNG and the order of simultaneous events may differ from the Windows engine.

Runtime modules: `bedtime.js`, `mines.js`, `engine.js`.
