# Verified original weapon enum and dispatch

Static recovery from `bulanci_hra/bulanci.exe`; the binary was not executed.
Regenerate machine-readable tables with `python analysis/extract_weapon_types_exact.py`.

| Original type | Behavior | Direction sprites (left/right/up/down) | Ammo | Animation duration |
|---|---|---|---|---|
| 0 | Pistol | 270/271/272/269 | 5 | 210 ms |
| 1 | Shotgun | 274/275/276/273 | 4 | 781 ms |
| 2 | Mine placement | 278/279/280/277 | 4 | 355 ms |
| 3 | Mine detonator | 282/283/284/281 | 1 | 355 ms |
| 4 | SMG four-round burst | 286/287/288/285 | 4 bursts | 639 ms |
| 5 | Rocket | 290/291/292/289 | 2 | 355 ms |

Names are semantic identifications from code, not recovered debug symbols. The six rows are proven by constructor `0x41dbc0`, table `0x482820` (28-byte records), dispatch `0x420650` and ammo getter `0x412490`, table `0x481a60`. Earlier `weapons-re.md` labels incorrectly identified rows 4/5 as shotgun/SMG.

## Exact fire behavior

`0x4208c0` only invokes weapon dispatch when its animation timer is idle; `0x420650` dispatches types 0..5 to `0x41fce0`, `0x41fdf0`, `0x416780`, `0x41ed60`, `0x417a20`, `0x416780` respectively. Pistol and shotgun create projectiles immediately and decrement ammo immediately. Types 2 and 5 start the animation only; callback `0x4212b0` creates mine/rocket and consumes ammo on event 0. Their raw sprites contain event 0 at frame 2, offset 142 ms.

SMG `0x417a20` consumes one ammo immediately and starts a non-looping animation. Four raw t52 chunk-12 events occur at frames 1/3/5/7, offsets 71/213/355/497 ms. `0x42134d..0x421404` creates projectile kinds 3/4/5/6, one for each event. It does not consume one ammo for each bullet.

Type 3 is specifically the remote detonator: `0x41ed60` iterates game objects of class `0x816`, filters `mine+0x108 == weapon+0x54` (same owner), calls `0x41e070` to detonate every armed mine. Animation only starts if at least one succeeded. Slot 3 is consumed only when the success count equals the owned-mine count. A press while all mines remain unarmed does nothing.

`0x417500` decrements `body+0x11c+weaponType` only for human IDs 0..3 and when unlimited-ammo cheat `body+0x199` is clear. Non-pistol empty-ammo completion is handled at `0x4214d6..0x42153c`.

## Reload

The pistol automatically reloads when its fifth round is consumed. Body constructor `0x41e9f0..0x41ea18` configures timer 0 to tick every **150 ms if config+0xd8 == 1, otherwise 500 ms**, and the 16th tick reloads (`0x420b4b`), so a reload takes **2.4 s or 8 s**. This field is the player count (creation loop `0x41c199..0x41c1be`). `0x417500` starts the timer on reaching zero; `0x417570` stops it, refills all five rounds via `0x412490(0)` and plays sample 16. These times run from ammo depletion, independently of the pistol's 210 ms firing animation.

## Sound banks

`0x4179a0` forwards the original type to `0x417950`. Types 0/1 use default bank 4; types >1 use `[0x4b3730]` (bank 3, initialized in `0x420180`). Sample numbers are local to a bank.

| Event | Bank | Sample | Code |
|---|---|---|---|
| Pistol shot | 4 | 21 | `0x41fce0` |
| Empty pistol trigger | 4 | 19 | `0x41fce0` |
| Pistol reload complete | 4 | 16 | `0x417570` |
| Shotgun shot | 4 | 13 | `0x41fdf0` |
| SMG events 0/1/2 | 3 | 3 | `0x4213f0` |
| SMG event 3 | 3 | 4 | `0x4213f0` |
| Rocket launch | 3 | 7 | `0x4214ac` |
| Mine/rocket explosion | 3 | 1 | `0x41cf4c..0x41cf73` |

## Coordinates

The four muzzle vectors are indexed by direction (`body+0xd4`), not weapon type. They add to body sprite top-left (`body+0x20/+0x24`): pistol table `0x482928`, shotgun `0x482948`, rocket `0x4829b0`, SMG `0x4829d0`. See `weapon-visuals-exact.json` for vectors, anchors and complete direction sprite metadata.
