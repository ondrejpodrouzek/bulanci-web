# Exitus: the original undead and their behaviour

Updated 28 Oct 2026. Source: the supplied `bulanci.exe`, SHA-256
`2992cca12ec9ff452894045729ebf776a335e1dfcd9281260be6d8d9f6648e39`, level script 324 and original
t52/t28 resources. This is static analysis, not a recording of the EXE running.

## Corrected conclusions of the earlier analysis

`0x41f350` is not an AI tick. `0x41f770` restores a character after death; its random branch `0x41ea90`
switches weapon and returns at once for Exitus IDs. It is not a "10% chance to fire". The parameter set
to 1 in the constructor is not a weapon index either. The web no longer uses these wrong conclusions.

## Confirmed values and web integration

| Area | Finding | Evidence in the EXE |
|---|---|---|
| Characters | Four slots 32, 33, 34, 35; the first active at first | `0x420550`; others call hide `0x42d040`, set `+0x69=0` |
| Skin | Own torn body: left 199, right 201, up 203, down 197 | constructor `0x41e723`, table `0x4af2dc` |
| Palette | Selector 7, RGB (95,95,95); also for weapon and death | `0x41e821`, `0x413200`, table `0x4aef40`, recolour `0x413220` |
| Weapon | Type 4, SMG; NPC ammunition does not drop | override `0x41e639` sets the last CWeapon argument to 4; `0x417500` skips the deduction for `+0x199` and ID >= 4 |
| Speed | 40%; 118 ms per frame | `0x41e62d`, `0x41e91c`; chunk 10 of animations 197/199/201/203 |
| Walk | Eight steps including the final ring frame, individual original offsets | `0x4178d0`, `0x41af70` |
| Wandering | Direction change after 1 to 10 whole seconds; sensor check after 2 s | `0x4172d0` |
| Stopping | On a decision with a free weapon, 1/13 chance to release the direction, otherwise a random direction | `0x420a90` |
| Collision reaction | Message 0x102 triggers a movement decision | `0x4195f0`, `0x42115e` |
| View | Four rectangular sensors to the battlefield edge; no 320 px circle | `0x41fb90`, `0x421047`, `0x420c30` |
| Obstacles in view | Union of edges of overlapping obstacles, both cross edges checked | `0x4192b0`, `0x433200`; a partial obstacle may leave a gap |
| Trigger | Timer with period trunc(200 / 0.4) = 500 ms | `0x4210bf`, double constant 200 at `0x4829a8`; timer1 `0x420bb3` |
| Burst | Four shots: 71, 213, 355, 497 ms; animation header 639 ms, one-shot end 568 ms | chunk 12 of animations 285..288, callback `0x42134d` |
| Burst sounds | Bank 3: sample 3 three times, sample 4 on the last shot | `0x42134d..0x421409`; sample 4/19 is the empty pistol |
| Shots | Original bitmaps 80/81/82/79, sizes 9×4 / 4×9 | table `0x482998`; t28 mode 2 is a palette with two pixels per byte |
| Spread | Random cross offset -4 to +4 per 40 px of the main direction | CShot constructor `0x41ef76`, move `0x419b40` |
| Muzzle | Vector added to the top-left corner of the union of body and weapon | `0x41af70`, table `0x4829d0` |
| Death | Own animations 207/209/211/205 and ghost 218; original anchors, grey palette | `0x41f900`, `0x41c663`, `0x4af008`, `0x41c860` |
| NPC death sound | Flag 0x80 skips the normal death sound and human line | `0x41f93d`, `0x41f9ce` |
| Return | After returning, another undead may appear with probability 1/3, four at most | `0x420480`, `0x416940` |
| Appearance | After returning, brightness grows 10% per 100 ms | timer5 `0x420ce1` |
| River | Six obstacles block walking, let shots and view through | script 324 native 63, `0x416f00`, `0x4183d0` |
| Scene | Original coordinates and collisions; two decorations are absent in 1/6 of games | script 324; layer 1 objects have the original z offset and sort with characters |

## Verification and remaining differences

Automated tests verify the skin and palette, original slots, non-overlapping spawns, steps including the
ring frame, directional sensors, full and partial obstacles, a real hit on the player by a burst, original
sounds, the river, scoring and activation of another undead. A browser check verifies that the canvas
really draws the undead, its weapon, its death and the ghost, with no missing files.

A complete 1:1 match of the whole game is not verified. The web uses a JavaScript RNG and a fixed 1/60 s
simulation step; shots now advance by the original 40 px updates every 50 ms and check the whole distance
travelled. The exact order of simultaneous native events and all multiplayer sensor combinations would
need a comparison recording of the EXE.

In the web: `exitus.js`, `actor-frames.js`, `collision.js`, `original-data.js`, wired into `engine.js` / `app.js`.
