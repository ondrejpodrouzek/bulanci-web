# Analysis of the original logic and state of the web port

Main source: `bulanci.exe`, PE32 x86, image base `0x400000`. The original program was never run during static analysis. Graphics come from its extracted resources, not from newly drawn substitutes. The web engine is a reconstructed implementation, not an exact port of the original engine.

Paths under `analysis/` and `web-*.png` snapshots refer to private working files that are not in this repository.

## Confirmed from the EXE and data

### Time and game loop

- `0x42e770`: `start = timeGetTime()`, global `0x4b3bdc`; also zeroes `0x4b3bd8`.
- `0x42e790`: writes `uint32(timeGetTime() - start)` to `0x4b3bd8`.
- Initialisation call: `0x42a305`; update: `0x42bda6`.
- Function `0x42bda0` updates the timer before window messages (`PeekMessageW`, `TranslateMessage`, `DispatchMessageW`) and before continuing to `0x42bc00`.
- This does not prove a fixed physics rate. The web uses a provisional step of 1/60 s.

### t28 bitmaps

The first export started pixels two bytes too early, which gave maps wrong colours. The correct start is offset 30.

- First six uint32: type, width, height, mode, stride, transparent key.
- Mode 5: BGR24, pixels from offset 30; verified by the exact length `30 + stride * height`.
- Mode 3: colour count at offset 25, BGRA palette from offset 30, then indexed pixels; verified by the exact length `30 + count * 4 + stride * height`.
- Transparency is an index comparison in indexed modes and a colour key in BGR mode; `0xffffffff` means no key.

### t52 animations

- 130 resources 177–306 decoded, 2565 frames in total.
- Full RLE: routine `0x432740`. A positive n repeats the next pixel n+1 times; zero reads a uint16 length +1; a negative number copies -n literals.
- Delta RLE: `0x432780`, skips and overwrites regions of the previous frame.
- Base palette: 256 BGRA entries at `0x4aeb20`; reference `0x413237` confirms the copy.
- Player colours: routine `0x413220` changes only ramp 112–151. Index 127 is the chosen colour. The light part 112–126 interpolates from white; the dark part 128–151 interpolates to black. The web uses variants exported this way for characters and for hands on weapons.
- Original timing is in the manifest: for example, the eight-frame walk has 378 time units, a directional hit 31 frames and 2201 units. Treating them as milliseconds fits WinMM timing, but the link to the whole original scheduler is not fully verified.
- Walk: 196 down, 198 left, 200 right, 202 up. Side direction was later verified visually; the opposite numbering from the first working guess is not used.
- Hit: 204 down, 206 left, 208 right, 210 up.
- Chunk 10 carries a coordinate pair. Dispatch `0x432d98` passes it to observers through `0x436e80`. (Later found to be root motion, see the Noční směna crane.)

### Maps and original coordinates

Resources 319, 321 and 322 provide Vybíjená, Noční směna and Malárie.

- Records `33 2e 00`: bitmap layer, x, y, resource ID.
- Records `33 2f 00`: top-left and bottom-right corners of a rectangle.
- Records `33 38 2d 00`: animated object, x, y, resource ID.
- Vybíjená: 1 image layer, 6 rectangles.
- Noční směna: 5 layers, 18 rectangles, 1 animated object.
- Malárie: 3 layers, 7 rectangles, 8 animated objects.

### Classes and weapons

RTTI preserved 155 class names. Important ones are `CBulanek`, `CShot`, `CWeapon`, `CLevelScript`, `CMina`, `CExplosion`, `CTeleportPoint` and `CColorSet`.

- CWeapon primary vtable `0x481eec`; construction `0x418ef0`, another constructor `0x41dbc0`.
- CWeapon `0x41dae0` is a deleting destructor and must not be taken for a weapon update.
- CShot `0x417190` is likewise a deleting destructor.
- A table of six weapon resource sets at `0x482820`, 28-byte step. Constructor `0x41dbc0` indexes seven uint32 per type and loads four directional resources.
- Pistol sprites 269–272; shotgun 285–288; SMG 289–292: visual assignment of original frames, direction confirmed by sprite appearance.
- Original weapons lying on the ground are animations 219 and 222.

### Original sound

- t67 gives the source PCM resource and the lengths of individual clips.
- t43 holds channels, bit depth and sample rate; PCM starts at offset 16.
- PCM length is read from the header. Resource 338 has further bytes after the declared area; they are not attached to the last sound.
- 62 original clips exported.

## Other references, not automatically original behaviour

Android project: https://github.com/JustNaxi/Bulanci . Neither its Java code nor its graphics were used.

- Android Player uses four directional images and a hit leads straight to a respawn.
- Its GunPistol uses 4 rounds; the period manual says 5.
- Its GunShotgun generates 4 projectiles; the period manual says 5 pellets.
- Its constants are therefore not considered authoritative for the Windows version.
- Period manual (Abeceda her): pistol 5 rounds, shotgun 4 shots of 5 pellets, SMG 4 magazines of 4 rounds. For training it describes standing computer opponents.

## What is still provisional (updated 29 Oct 2026)

Items finished from the earlier list (character speed and steps, collision rectangle, death length, SMG, weapon pickups, training, rocket launcher, mines, power-ups, pipes, teleports, creatures, Na dobrou noc layout, the 8-bit map) are described in the updates below. Remaining:

- Network game: first version finished (see below); pause, in-game chat and a player disconnecting mid-game are simplified.

## Checks

Automated tests verify obstacles, shots stopped by walls, hits without double scoring, picking up weapons, emptying and reloading the pistol, and end of round. Browser checks verify start, maps, movement and shooting, pause and resume, local mode and the status page. These checks verify that the new implementation works, not that it matches the Windows EXE.

## Update 28 Oct 2026: Na dobrou noc and weapons

The original states of the rabbit and mouse, placing and arming of mines and interruption of SMG bursts are now connected to the game. Older guesses in the previous sections are replaced by the [current analysis](bedtime-re.md) and the [mine analysis](mines-re.md).

## Update 28 Oct 2026: shotgun from the EXE

The earlier web approximation (five separate shots at a fixed 7 px spacing) is replaced by the original mechanism:

- Fire function `0x41fdf0` creates **one** shot: `CShot` through constructor `0x41edf0` with kind 1 and bitmap 23–26 (9×6 or 6×9 px).
- The constructor sets the pellet mask `shot+0xa7 = 0x1f` (`0x41ef0c`), i.e. five pellets. Only kinds ≥ 3 (SMG) get a random cross offset −4..4, not the shotgun.
- Timer `0x419b40` moves the shot rectangle 40 px along the flight direction and, for kind 1, also widens it by 5 px on both perpendicular sides.
- `0x417b30` computes the rectangle of pellet i: perpendicular origin `edge + trunc((rect size − bitmap size)·i/4)`, bitmap size; along the flight direction, the whole rectangle. All five pellets therefore start on top of each other and then spread evenly (outer pellet slope 5:40).
- Update `0x41df60` tests each live pellet separately from the old to the new rectangle (`0x41de60`). A pellet that hits is removed from the mask (`0x41e016`); the shot ends only with an empty mask. One shot can therefore hit several targets.
- For horizontal directions the sprite drawing depth also drops (`0x418fe0`, `shot+0x6c`: 15, 10, 5, …).

Tests: `test/shotgun.test.mjs`.

## Update 28 Oct 2026: training opponents from the EXE

Period sources (manual: "the computer does not move"; Gamez review: "does not chase you, but fires only if you get into one of its axes") are confirmed by the code:

- Game start `0x4205a0`: a bulánek per player; if there is only one player (`config+0xd8 == 1`), a loop creates computers with IDs `0x7d`–`0x7f` through `0x420530` → `0x41f500(id,-1,1,100,0)`: speed 100, starting weapon 0 (pistol).
- Constructor `0x41e4b0`: ID > 3 sets `+0x199 = 1` and creates four sensors `0x41b420` reaching to the battlefield edges (`0x41fb90`: 0/799/0/515).
- `0x417500`: for `+0x199` or ID ≥ 4 ammunition is not deducted, so the pistol never reloads.
- No movement: the wandering timer4 (`0x420bf6`, `0x4172d0`) runs only for IDs 0x20–0x27 (`0x416490`).
- Sensor entry (`0x421047`): the message is stored in `+0x188` even before the visibility test `0x4194b0`/`0x4192b0`; if visible, the bot turns (`0x4197b0`) and starts one-shot timer1 with period `rand(0..3)·500 ms` (`0x40ace0(0,3)`, `0x42110c`). The sensor stays occupied until left.
- Leaving any sensor (`0x421133`) cancels timer1 and zeroes `+0x188`.
- Timer1 (`0x4208c0`) fires only with an idle weapon.
- A timer with flag 2 without bit 4 is one-shot: handler `0x42eb30` frees the record after firing and repeats only with `flags & 4`.
- Sensor masks contain only slots 0–3 (`0x4194b0`: `mask & 0xf`), i.e. human players; computers and undead do not react to each other.
- Respawn `0x41f770`: ID > 3 gets a weapon by `rand·101>>15 < 10` → shotgun with probability 10/101, otherwise pistol (`0x41ea90`).

Undead fix: their timer1 is also one-shot (`0x4210bf`, flag 2). The web used to repeat the burst every 500 ms; now they fire 500 ms after entering an axis and again only after the 2 s sensor check (timer4 `0x420c30`). Undead also no longer see training opponents.

Remaining: exact message order on simultaneous entry into several sensors (the web takes the lowest direction) and the computer's spawn relative to the player (`0x41a140` picks a random free place on the whole battlefield, the web too).

Code: `training.js`, `exitus.js` (`sensorSees`, `sensorMasks`). Tests: `test/training.test.mjs`.

## Update 28 Oct 2026: power-ups from the EXE

Manual: eye = invisibility, clock = a few seconds of time, bullet = unlimited ammunition, shield = immortality. In the EXE:

- Only in a one-player game (`0x42031b`, `config+0xd8 == 1`): animations 293 (eye), 294 (shield), 221 (bullet), 220 (clock) load into slots `+0x324..+0x330`; `CSpells` is only a HUD panel.
- Timer0 cycle of the game object (`0x417c80`, state `+0x33c`): state 0 = 25,000 ms, then `0x41b500` selects `rand·256>>15>>6` (each kind 1/4) and places it through `0x41b390` → `0x41a140` (random free place); state 1 = 10,000 ms, then `0x419e40` hides everything and the cycle restarts.
- Pickup `0x41f0c0`: overlap of the collision rectangle of any living character with the item → `0x41a020`: removal, sound (global bank, first player 32/35/33/31 by kind, others 34), restart of the 25 s countdown.
- Effect `0x414550`: clock: human (ID < 3) +15 s, otherwise −15 s (minimum 1 s); eye/shield/bullet: 20,000 ms (`0x4145c4`), picking up again restarts the timer. Message `0xee` sets `+0x198` (eye), `+0x19a` (shield), `+0x199` (bullet); `0xef` clears them.
- Shield: death message `0x420d7a` is ignored with `+0x19a`.
- Bullet: `+0x199` is the same flag as for computers, `0x417500` does not deduct ammunition.
- Eye: drawing `0x417640` skips the character for others; in one-player mode the local player sees themselves faintly additive (`0x303030`). Sensor areas without flag 2 do not register an invisible character (`0x417dfd`), so bots and undead cannot see it; mines (flags 0x0a) can.

Web: `powerups.js`; tests `test/powerups.test.mjs`. Not verified: behaviour of the mouse sensors in Na dobrou noc towards an invisible player.

## Update 28 Oct 2026: teleporting training opponents

Manual: the computer "cunningly appears behind your back". In the EXE only computers teleport (in playable maps; the only scripted teleport, opcode `0x55` → `0x41e430`, is used by the 8-bit map 323):

- Function `0x41db00(x,y,flag)` → `0x41d090`: with x = −1 a random free place (`0x41a140`), two `CTeleportPoint` objects (`0x41c9a0`, animation 304 centred on the character rectangle) at the old and new place, sound 4/36, `+0x16a = 1`, timer2 restart.
- Timer2 (flags 7, repeating): `0x417260` sets the period `(rand(0..10)+5)·1000 ms` on respawn and after a teleport; handler `0x420bc6` teleports only with an idle weapon.
- End of the weapon animation (`0x4212b0`, event `0xffff`): a computer that has not yet teleported in the same callback does so with probability `rand(0..99) < 40`; undead call the movement decision `0x420a90` instead.
- `+0x16a` blocks turning `0x4197b0` and thus the sensor response; it is cleared by the end of the one-shot animation at the old place (`0x41fed0`, 497·6/7 = 426 ms) or by death (`0x41fad7`).

Web: `training.js` (`teleport`, `armTeleport`, `trainingWeaponEnded`), `app.js` draws animation 304. Tests in `test/training.test.mjs`. Approximation: the effect's drawing order (depth −11) is always above characters in the web.

## Update 28 Oct 2026: the "V zajetí 8-bitu" map (script 323)

**Bitmaps.** Backgrounds 93, 94, 95, 100, 101, 105 and shots 96–99 use t28 modes the old export did not know: mode 1 = 2 bits per pixel (highest pair first), mode 2 = 4 bits (high nibble first), palette of `count` BGRA from offset 30, index = key is transparent. An 8-bit alpha plane `w·h` may follow the indices (glass cube 95, post 94). Verified by exact file length.

**Scene** (323:0x14d–0x375): floor 100, scenery 95/101/93/94 with script z, four fixed obstacles. Objects:

| Object | Animation | Body / callback | Behaviour |
|---|---|---|---|
| 10 | 254 | 11 | 9 hits, stage = hits/3 (0x71b) |
| 16 (cage) | 255 | 17 | 2 hits, stage = hit (0x77a) |
| 12 | 256 | 13 | 4 hits, stage = hits/2 (0x7bc) |
| 14 | 257 | 15 | 4 hits, stage = hits/2 (0x81b) |
| 9 (creature) | 259,262,260,263,258,261 | 18 body, 19 vulnerable | see below |
| 20 (remains) | 264 | — | after the creature's death |

Stage change: `native_58(obj, old stage)` + `native_50` plays the animation from the stage's frame; the callback (entry 3, 0x4bc) calls `native_40` and stops it at the next chunk 12 event (254: frames 1, 2; others: 1) or on the last frame. After the last hit the callback removes the body and gives the object z −120 (it lies on the ground). Sounds `object_event(k)` = level bank 0, sample k: hit 3, destruction 4.

**Caged creature** (object 9): timer0 3000 ms (0x49a) → 0x935: with probability 1/3, only if the cage is broken (`g6 ≥ 2`), the creature plays no animation (`native_57`) and nobody stands in the cage (`g7 = 0`). State choice by regions: right strip (g9) → 1/4 attack right (state 4), otherwise peek 0; bottom strip (g8) → 1/4 attack down (5), otherwise 1; nobody → exposure 2/3; someone above the cage or both strips → 0/1. Entering a strip (0xbd6) triggers an immediate attack with probability 1/2 (state 4+side), before the cage is broken only a peek. State 0xb55 enables body 18. Events: 0 → vulnerable body 19 instead of 18, last (2 for attacks, 1 for exposure) → back to 18, 1 for attacks → shot `native_62` from (260,96) right or (221,136) down, owner 9, 8-bit shot 97/98/99/96, sound 0. End → body 18 removed. Hit on body 19 (0x87a): sound 1; the eighth hit kills the creature (sound 2, hidden, remains 264, then z −120 and no body once they finish).

**Teleport platforms** (regions 0–2, flags 6 = humans, including invisible; not computers): entry (0xc5f) → 0xa89 tries one of the two other platforms (order 5/11), `try_move` = opcode 0x55 → 0x41e430 → teleport 0x41db00 to the given top-left corner of the collision rectangle (40,195)/(452,77)/(704,387); an occupied place fails and the other is tried. Arriving on the target platform does not repeat the teleport thanks to the `+0x16a` lock. Regions: flag 8 = computers count too, 2 = invisible too (`0x417dd0`).

Web: `eightbit.js`; tests `test/eightbit.test.mjs`. The web does not draw window background 105 (the arcade frame), as with other maps. Network branches of the script (`native_4d`, 0x25–0x2a, 0x4b) do not run in a local game.

## Update 28 Oct 2026: end of a shot

`CShot` has no lifetime. Collision test `0x41de60` (four sub-steps of every 40 px move) ends the shot on a hit, or when the new rectangle crosses the battlefield: left/top edge < 0, right > 799 (`0x31f`), bottom > 515 (`0x203`). For the shotgun this runs per pellet, so pellets outside the field drop from the mask individually. The earlier web guess of 1.5 s is removed.

## Update 28 Oct 2026: active power-up panel (CSpells)

`CSpells` (vtable `0x483acc`, class `0x80d`, constructor `0x427d40`) is created per player in HUD constructor `0x4280f0` at (panel X + 6, 41) inside bar 117 (y = 495). Player panel X comes from table `0x4af924` = 12, 149, 556, 693. Drawing `0x4278c0` copies, for each active bit (0 eye, 1 shield, 2 bullet; messages `0xee`/`0xef`), a cut-out of bitmap 78 to the same relative position: eye x 25–36, shield 0–11, bullet 13–23, height 14.

## Update 28 Oct 2026: fire on press and shot depth

**Fire on press.** Player input (`0x416020`) walks six keys; `0x4121a0` compares DirectInput state with the previous frame and returns 0 unchanged, 1 press, 2 release. Command 4 (fire) is thus sent only on a press and `0x4208c0` fires only if the weapon is idle at that moment. A held key does not repeat. The web used to fire repeatedly while held, so turning while running (which cancels the weapon animation) immediately fired again in the opposite direction.

**Shot depth.** `CShot` is a scene object with depth 15 (`0x41ef02` → `0x418fe0`), horizontal shotgun −5 per step. The web now sorts it with characters and scenery (key = bottom edge + depth), so a shot in the mushroom house disappears under the cap and flies out through the window instead of being drawn over the roof. The house has only two scripted collisions (`320:0x21b` base, `0x239` strip below the roof); the room between them can be shot through from both sides ("the cottage can be shot through from both sides", period manual).

## Update 28 Oct 2026: FullHD/4K rendering

The logical frame stays the original 800×600 (battlefield 800×515 + HUD). The canvas buffer now follows the real on-screen size × devicePixelRatio (up to 6×), drawing with a transform to logical coordinates (`dist/display.js`). Text and HUD are sharp; original bitmaps scale only when drawn, smoothed or with sharp pixels (the "Obraz" button, saved in the browser). Assets do not change. Verified by `verify-display.mjs` (1920×1080, 3840×2160, 1280×720 @2×).

## Update 28 Oct 2026: game types (hits / time / lives)

Source: dialog `CGameTypeDlg` (`0x40d930`), rules object `CBulanci+0x284` (constructor `0x414a80`), text table `0x4af9bc` (indices 49–61, 93–96).

- Saved settings (14 bytes from `+0x87`, read from registry `Software\SleepTeam\Bulanci` in `0x40a440`): type (0 hits, 1 time, 2 lives), flag `+0x88`, limits `+0x89 + type·4`. Without saved settings `0x40a290`: type 1, **hits 30, time 180 s, lives 30**.
- Dialog field ranges (`0x407d50`): hits 5–999, time 10–9999 s, lives 5–999.
- **Training** (one player, `config+0xd8 == 1`, `0x4136df`): always time-based, 150 s.
- The clock starts only for the time type (`0x41c185` → `0x4129c0`).
- Points on the bar (`0x412680`): hits = number of hits; time = hits − deaths; lives = limit − deaths.
- A hit (`0x420dd6` → `0x4180e0`) counts if the victim is a bulánek (class `0x7ec`); the hits type ends when the leading human reaches the limit (message `0x80cc`).
- Death (`0x41f350` → `0x4128a0`): in the lives type, reaching the limit records the order of elimination; an eliminated player does not return after the death animation (`0x417abd`); the game ends when at most one human remains.
- Ranking (`0x4126e0`): by points, eliminated players by how late they dropped out. Results use the original texts "Zabil: %dx" and "Mrtev: %dx".
- Not verified: the centre of the bar for types without a clock (the web leaves it empty).

Web: `dist/rules.js`, menu "Typ hry" with a limit; tests `test/rules.test.mjs`.

## Update 28 Oct 2026: weapon spawns

Replaces the earlier working implementation (four weapons from the start, return after 8 s, pickup within 22 px of the centre).

- Setting flag `+0x88` ("all weapons", default 1, forced in training) gives `game+0x368 = 6`, otherwise 2 (`0x420117`).
- Timer1 of the game object (`0x41c1f6`) exists only with `+0x368 > 2`: repeating every **5000 ms**, in training every **10,000 ms**. Nothing lies on the field at the start of a round.
- Tick (`0x41f083`): `rand·101 < 80`, then choice `0x41e350`: `r = floor(rand·125)/25 + 1`, `r ≥ 3` → `r + 1` (no detonator). Result shotgun / mine / SMG / rocket launcher / nothing, each 1/5; if a shotgun already lies there, an SMG drops.
- Slots (`0x41e2c0`): one shotgun (`0x64`), others first free of `0x65`–`0x6b` (at most 7). Placement `0x41b390` → `0x41a140` (random free place).
- Pickup (`0x41f0c0`): overlap of the character's collision rectangle with the rectangle of animation 179/268/222/219 (52×24, 25×26, 52×22, 52×31); any character controlled by this computer collects (`0x416720`), including bots and undead. `0x41eba0`: the item disappears for good; mine +1 up to 4, others capacity from `0x481a60` [5,4,4,1,4,2] and weapon selection (`0x41ea90`, no effect for undead).
- **Correction:** flag `+0x88` is "Mód zbraní" (texts `0x1b0`–`0x1b8`): 1 = **all weapons**, 0 = **shotgun only**. The original has no pistol-only mode. In shotgun-only mode (`+0x368 = 2`) timer1 does not run; one shotgun is placed at game start (not in training) (`0x4202f6` → `0x41f1d0`), pickup sets the player's `+0x16b` (`0x41ec48`), and the shotgun returns to the map when its holder empties it (end of animation, `0x42151c`) or dies (`0x41fb3a`). Training forces all weapons.
- Human death (`0x41f900`, a character without sensors): back to the pistol, ammunition of types 1–5 = 0, **pistol rounds remain** even after respawn.

Web: `dist/pickups.js`; tests `test/pickups.test.mjs`. `verify-audio.mjs` now fires with presses (the original fires on a press, not on hold).

## Update 29 Oct 2026: scene animations and wind in Malárie

**Animation flags.** `create_animation` (opcode `0x2d`, handler `0x41d6e0`) reads, after x and y, one flags byte the earlier decoder did not show. `0x4391e0` stores it in `anim+0xc`: bit 0 plays, bit 1 loops. Vybíjená (DJ 216/217) and Noční směna smoke 244 have 3 (loop), all eight animations of Malárie and Noční směna object 245 have 0, so they stand on frame 0. Smoke 244 at (701,180) in layer 0 was previously not drawn at all; the DJ is in layer 0, so below characters.

**Play once.** Native `0x50` (`0x416dc0` → `0x4390d0`) with parameter 0 sets "playing" without a loop. Frame timer `0x439b90` shows the frame by its counter, advances it and on overflow to 0 without a loop stops; the last frame stays visible. Frame k lasts ⌊(k+1)·D/N⌋ − ⌊k·D/N⌋ ms (`0x4399b0`).

**Malárie (322).** Block `0x93` calls `timer_create(0, rand(0..10)·1000 + 5000, 6)`. The third argument is timer flags, not a callback: 2 = start now, 4 = repeat with the same period (scheduler `0x42eb30`). All script timers call entry 6 (block `0x284`), which plays objects 6–13, i.e. all eight animations at once: a gust of wind in the leaves and ferns every 5–15 s (the period is drawn once per level). Layer 2 drawing order follows the insertion order in the script (object 13 above bitmap 92).

Web: `dist/scene-anims.js`, data in `maps.json` (`flags`, `layer`, `frames`, `duration_ms`); tests `test/scene-anims.test.mjs`.

**Crane in Noční směna (321).** Object 6 = animation 245 (120 frames, 8591 ms), a crane with a crate. Script timers: `0x42f210` (flag 1 = paused with counter 1), native `0x45` resumes (counter −1, at 0 start = now), `0x46` pauses, `0x48` sets the period. Entry 10 calls round start (`0x41c140`), entry 3 is an animation event (`0x418260`: object id, chunk 12 value; stopping a running animation in `0x439840` sends 0xffff). Sequence:
- round start → `0x565`: period 30,000 + rand(0..6)·5000 ms, resume timer 0;
- timer fires → `0x6f6`: play the crane once, `object_event(0,255)` = sample 0 of the level bank with no position (`0x418000`), pause the timer;
- frame 60, event 0 (crate in the furnace, off screen right) → `native_40` stops the crane; its 0xffff re-enters `0x565` and resumes the timer, then right after `native_48(0,10000)`: the crane hangs there for 10 s;
- the next firing runs the crane on upward and pauses the timer; last frame → 0xffff → another 30–60 s wait.
The crane's movement comes from chunks 10 (object offset per displayed frame, observer `0x436e80`).

**No spawn protection.** Respawn `0x41f770` only makes the character visible (`0x42c990`, bit 1 in `+0x44`), places it (`0x41a140`), turns it (`0x4197b0`) and plays a sound; there is no invulnerability or firing timer. Firing `0x4208c0` requires only a visible character and an idle weapon animation. The web used to block firing for 0.5 s after spawn; no longer (test in `test/game.test.mjs`).

**Vybíjená lights (319).** The script ends with `native_34(2)` + `create_bitmap(0,0)` res 21. It is a t28 in mode 0 (1 bit per pixel, stride = width/8), a palette with a single black colour and an 8-bit alpha channel (length 30 + 4 + 51,500 + 412,000 B fits exactly). The layer lies above everything including characters: the dance floor is dark outside the spotlight cones. The web used to skip it.

**Barrel in Noční směna.** Checking all script `create_bitmap` calls against web data found one missing bitmap: 86 at (129,99), layer 1, `native_31(…, −110)`. It is a barrel sorted with characters by bottom edge + z (like Exitus scenery), so a character above it is covered. The four layer 2 bitmaps stay on top.

**Configuration flag `+0x86`.** Default 1 (`0x413542`). `0x412780` walks the table of game participants (`+0x168`, 13 B per record, count `+0xda`; the local record is written by `0x412720` from `+0x31/+0x35/+0x36/+0x37`) and clears the flag if any participant has byte `+4` below 11. At zero `0x420121` keeps game state 2 (shotgun only) even in all-weapons mode (`+0x19d`, a copy of saved `+0x88`) and `0x412d6a` sends no network message. It is thus a compatibility gate for network participants (inference: value +4 is presumably the program version); in a local game it is always 1 and the web behaves that way.

**Sensor order.** `0x41b5a0` (called for a moved character) walks the sensor and region array `+0x2d8` (count `+0x2e0`) from last created to first and passes each a message through `0x419e90` (character id, rectangle, invisibility `+0x198`). On simultaneous entry into several sensors the last created reacts first (the opponent with the higher id, the region with the higher index). In the web the order would only show in the sequence of RNG calls; the web does not emulate the MSVC `rand()` sequence, so the difference is not observable and the logic was not changed.

## Update 29 Oct 2026: network game over WebSockets

The original created a DirectPlay session (Start hry 1: Vytvořit / Připojit se, connection TCP/IP or IPX); the authority is the computer that created the game (native `0x4a` in scripts). Instead of DirectPlay the web uses a WebSocket on the server that delivers the page (`net-server.mjs`, path `/net`, no dependencies): the server only keeps the game list and relays messages. The host's browser computes the game with all players, the others send keys (on every change, with a press counter so a short tap between two ticks is not lost) and draw state snapshots the host sends every second tick (30 Hz), along with sound events.

Screens follow the original: Start hry 1 enables Připojit se and TCP/IP (not IPX); a network game comes from Vytvořit with fewer players on this computer than in total (up to 4), or from Připojit se. Connecting: the web skips CTcpIpConfig (`0x40c060`), because the server that serves the page is the only one, and opens CSessionList (`0x40c2d0`, with Připojit / Zrušit). Start hry 2 shows players of other computers in further columns, chat `0x4102d0` at (240,244) (list 250,270–510,410, line 250,418–510,450, font 175, 120 characters) and a waiting message (0xfc). Only the host can start, once everyone is connected; the same-name check applies across computers (`0x40f610`). Messages: rejection for too many players (0x160), a player leaving (0x6c).

By default the server listens only on 127.0.0.1; for LAN play start it with `BULANCI_HOST=0.0.0.0`. Web: `dist/net.js`, `dist/ui/net-dialogs.js`; tests `test/net-server.test.mjs`, `test/net.test.mjs`; two-browser check `verify-network.mjs`.

## Update 31 Oct 2026: animation alpha plane and asset audit

t52 chunks 14 and 15 (`0x432dd5`, `0x432def`) unpack, with the same routines as the image (`0x432740`, `0x432780`), an alpha plane w×h into bitmap `+0x20`. The export used to drop them, so shadows (black, index 0, alpha 95–96) and smoke with soft transitions (alpha 0–254) were opaque. Blending is per channel through table `0x4b84f8` in 565; the web uses normal canvas alpha compositing, without the 565 rounding.

## Update 31 Oct 2026: how a bulánek dies

The web used to play the torn-apart animations 204–210 for every death. In the EXE those are only for flag 0x80.

- `0x41f900` receives the shot direction, or the blast ray direction, in the low bits of the message and creates `CDeath`. Exitus undead always get flag 0x80 (`0x41f93d`).
- Flag 0x80 comes from a blast: the central probe, and the first 11 of the 15 steps of each ray (`0x41e25c`, `esi > 3`). A blast further away kills like a shot.
- With the flag, `0x41c610` takes the torn-apart animation from table `0x4aeff8` (204–210), for undead from `0x4af008`.
- Without it the character lies down and bleeds: table `0x4aefb8` at `direction + facing*4` gives 295–302. A facing with no entry moves to the nearest row, -4 for sideways shots and +4 for vertical ones, and the character turns to that row.
- The body lies only while the animation plays. `0x417a90` hides it when the one-shot animation stops on its ring frame and sends message 0xf6, so the character returns at that moment with no extra delay: 2720 ms or 2975 ms for 295–302, 2130 ms for 204–211.

Web: `deathChoice`, `deathSeconds` in `actor-frames.js`, `kill` in `engine.js`, `probe` in `mines.js`; tests `test/death.test.mjs`. Not ported: the body's exact drawing depth (`0x41c7c3`).

## Update 31 Oct 2026: the mouse pointer (CGunMouse)

The original screens have their own pointer, class `CGunMouse` (ctor `0x426060`, draw `0x424610`, restore `0x4249b0`). Crosshair bitmap 173 (75×75) is centred on the mouse, and red lines at 50% opacity run from it to the screen edges (`0x436310`, `0x436420`). A queue of 30 positions, one every 10 ms (`0x424370`, `0x4243b0`), drives a trail of dots 300 ms behind the mouse, at offset (2,3). The dots are animations 267, 266, 265 (table `0x4af900`); each end picks one at random (`0x423bd0`). Chunk 13 is the bitmap's opacity (`+0x18`), here 100.

Web: `ui/gun-mouse.js`, mouse only. Not verified: whether the pointer shows during a game; the web shows it on the menu and dialogs only.

## Update 31 Oct 2026: the HUD (CPanel)

`CPanel` (`0x4280f0`) builds one panel per human at X from `0x4af924`; bots have none. Positions are relative to bar 117 at y = 495.

- Name: font 175, style 5, rectangle (X+4,9)–(X+92,22). Frame: bitmap 128 at (X+5,40).
- Portrait: `CBulPicture` (`0x40b050`) at (X+6,41) draws bitmap 29, which has no palette of its own, through the player's palette.
- Ammo: `CShotCounter` at (X+6,84) on background 166. Rounds use column 5 of table `0x482820`, spread evenly (`0x426f0f`), up to capacity from `0x481a60`. The detonator has no mark and shows bar 165. An empty pistol shows reload bar 124 (`0x427ce2`).
- Weapon icon: column 4 of `0x482820` at (X+59,57). Shotgun mark 169 at (X+35,60) for the holder in shotgun-only mode.
- Score: `CNumCounter` at (X+59,41), three digits from strip 118 under frame 33, wrapping at 1000 (`0x427100`). Each digit rolls one row per 100 ms (`0x427020`), forwards when the size grew. A negative score tints the digits red (`0x4365f0`).
- Time: font 174, style 5, rectangle (358,45)–(444,95), in whole seconds.

Web: `dist/hud.js`; tests `test/hud.test.mjs`. Approximations: the reload bar uses the web's reload fraction, not the original counter at `+0x122`; the red tint is an additive fill; the time colour is one shade instead of the four-entry palette. Not ported: the "Pauza" overlay on a paused network player's portrait (`+0xdc`, `+0xec`). The hint text above the game now shows on phones only.

## Audit status, 31 Oct 2026

Assets are verified against the EXE. All resources the web did not use are now identified:

- Bitmaps 132, 143 and 146 are parts of the vertical scrollbar of `CListBox` (table `0x4ae5a0`, used by `0x408370`). The web list now scrolls with arrows, track and keyboard; thumb dragging, hover states and the bar's exact position are not ported.
- Bitmap 74 has no reference in the code, the data tables or any script: it is unused in the original too.

Logic audit by area:

- Death: done, see above. Pointer and HUD: done, see above.
- Sound calls: done. In-game sounds match the 24 call sites of `0x422430`. Interface sounds are in: `CButton` sample 0 on press (default of field `+0x94`, `0x4030e0`, `0x403ffa`), `CRadio` 14 (`0x402fb0`), `CIcon` 20 (`0x403ea0`).
- Hits and deaths: done. Found and fixed:
  - The `kill` event was never sent: a comment had swallowed the call, so no death sound or line played.
  - A lying body is solid. `CDeath` takes over the character's rectangle with `+0x69` set (`0x41c82b`), and `0x418300` tests every such object, so it stops shots and walkers and blocks spawn places.
  - `0x418300` does not skip the shooter, so a pipe can return a shot to its owner. Normal firing cannot hit the shooter: 128 weapon, direction and frame combinations gave none.
  - A suicide counts as a kill: message 0xd8 has no such check (`0x420dd6`, `0x417f14`).
  - Sample 22 plays when the shooter holds the shotgun (`0x417f80`, `0x416630`), not for rockets.
  - After the death sound comes the victim's line, then message 0xdb gives the shooter a taunt (`0x420e2b`, `0x420ee8`). Flag 0x80 skips sound and line and goes straight to the taunt (`0x41f9d2`).
- Player reports, 1 Nov 2026, all fixed:
  - Music gap per loop: each MP3 starts with about 1100–1470 samples of codec silence and an audio element adds its own gap. The web now loops a decoded buffer between the first and last sounding sample. The original's own loop point is not verified.
  - Walking: stopping shows frame 0 and puts the swaying axis back on the walking line (`0x417910`, `0x420975`).
  - Pickup sound: sample 18 is the tick of the last five seconds (`0x419d60`). Pickups use table `0x481d38`.
  - Undead have their own three voice lines (`0x416670`, `0x416690`, `0x4166b0`).
- Weapons: pistol reload fixed. Timer 0 ticks every 150 ms alone and 500 ms otherwise (`0x41e9f0`), and only the 16th tick reloads (`0x420b4b`), so it takes 2.4 s or 8 s, not 0.15 s or 0.5 s. Weapon switching matches `0x41eca0`. Fire conditions in `0x420650` are not audited yet.
- Not audited: fire conditions, bots, undead behaviour, creatures, game rules, network messages.

The game logic has not been compared function by function. Earlier updates cover what was ported, but a port is not proof that nothing else is missing, as the death bug showed.
