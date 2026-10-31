# Original weapons: corrected assignment of graphics, animations and muzzles

Source: the original `bulanci.exe` and its t52 resources. The program was not run for this analysis.

## The basic error of the previous web version

The assignment was guessed from the look of the weapon. That caused a swap: the long weapon 285–288 is the **SMG**, while the large grey weapon 289–292 is the **rocket launcher**. The shotgun is the wooden weapon 273–276. The web really was drawing a different weapon, so moving the old SMG would not have been enough.

CWeapon constructor `0x41dbc0` loads the type into `CWeapon+0x64` at `0x41dc2e` and the row from table `0x482820 + 28*type` at `0x41dc46`. The first four uint32 are resources for directions L/R/U/D.

| Original type | Weapon | In hand L/R/U/D | Pickup resource | Animation |
|---:|---|---|---:|---:|
| 0 | Pistol | 270,271,272,269 | none | 5 frames / 210 ms |
| 1 | Shotgun | 274,275,276,273 | 179 | 11 frames / 781 ms |
| 2 | Mine / placing a charge | 278,279,280,277 | 268 | 5 frames / 355 ms |
| 3 | Detonator | 282,283,284,281 | none | 5 frames / 355 ms |
| 4 | SMG | 286,287,288,285 | 222 | 9 frames / 639 ms |
| 5 | Rocket launcher | 290,291,292,289 | 219 | 5 frames / 355 ms |

Pickup resources come from table `0x4827f4`, indexed by `0x41d248` by the same type. The table contains exactly `[-1,0x100b3,0x1010c,-1,0x100de,0x100db]`.

The names are confirmed by behaviour, not just looks:

- Type 1 runs `0x41fdf0`, plays sample 13 and creates a CShot kind 1 with five pellets.
- Type 4 callback `0x42134d..0x421409` processes four animation events 0..3 and creates individual shots of kinds 3..6: a four-round SMG burst.
- Type 5 callback `0x421409..0x4214c8` creates a CShot kind 2, a rocket.
- Type 3 dispatch `0x420650` calls `0x41ed60`, which walks objects of class 0x816, filters the owner's mines and calls `0x41e070`: a detonator.

## Animation playback drives the moments of shots

Scheduler `0x4399b0` uses intervals `floor((f+1)*ticks/N)-floor(f*ticks/N)`.

The SMG has chunk 12 events on frames 1, 3, 5, 7: IDs 0, 1, 2, 3. With the base timing of 639 ms / 9 frames this is **71, 213, 355, 497 ms from animation start**.

The mine and rocket launcher have event 0 on frame 2, i.e. 142 ms into the 355 ms animation. The pistol and shotgun have no firing chunk 12; their initial fire function shoots directly and starts the animation.

Besides N regular frames, t52 files have an extra ring frame N at the end. The value N must not be taken for the number of all blocks in the file.

## Anchor points and the hand layer

Chunk 11 `{byte id, int16 x, int16 y}` provides join points. Points persist when the next frame has no new chunk 11. All 130 resources in this game have at most one point in chunk 11.

Decoder `0x432850` passes the event through `0x436eb0`; body callback `0x4178f0` and weapon callback `0x417a00` store x/y in their fields.

```text
weaponTL = bodyTL + bodyAnchor(currentBodyFrame) - weaponAnchor(currentWeaponFrame)
```

Renderer `0x417640`:

- Up: the whole weapon behind the body.
- Down: the whole weapon in front of the body.
- Left: weapon rows before the boundary `floor(height/2)-7` behind the body, the rest in front.
- Right: the same principle, boundary `floor(height/2)+5`.

## The muzzle is relative to the character's overall rectangle

Original fire functions add the offset to `CBulanek+0x20/+0x24`. After `0x41af70` that is the **top-left corner of the union of body and weapon**, not the character centre or the body start.

With body position B and weapon position W computed from anchor points:

```text
actorTL = (min(B.x,W.x), min(B.y,W.y))
muzzleTL = actorTL + muzzleTable[direction]
```

Offsets are indexed by direction 0=L, 1=R, 2=U, 3=D, not by weapon type:

| Weapon | Table | L | R | U | D |
|---|---|---|---|---|---|
| Pistol | 0x482928 | (-19,46) | (77,25) | (17,-11) | (32,84) |
| Shotgun | 0x482948 | (-19,47) | (77,33) | (18,-11) | (29,84) |
| SMG | 0x4829d0 | (-19,44) | (77,33) | (19,-13) | (28,88) |
| Rocket launcher | 0x4829b0 | (-25,40) | (77,27) | (16,-17) | (26,84) |

Evidence of use: pistol `0x41fd35..0x41fd60`, shotgun `0x41fe33..0x41fe5e`, SMG `0x42136b..0x421390`, rocket launcher `0x42142e..0x42144a`.

Capacity, reloading and special spread or explosion rules are in `weapon-types-exact.md`.
