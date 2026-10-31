# Original weapon attachment and animation movement

## Weapon placement is metadata, not an arbitrary draw offset

The web prototype guessed where a weapon overlay belongs. Original t52 animations contain a structured attachment event in **chunk 11**.

- `0x432850` parses up to32 records of five bytes: `{uint8 id, int16 x, int16 y}`.
- `0x436eb0` sends these records to image observers using vtable slot `+0x0c`.
- CBulanek observer lives at body `+0xa0`; callback `0x4178f0` stores the first record's x/y at body `+0x104/+0x108`.
- CWeapon observer lives at weapon `+4`; callback `0x417a00` stores the first record's x/y at weapon `+0x5c/+0x60`.
- The callback uses the first record and does not search its id. All resources177–306 observed here have at most one record per chunk11.
- These coordinates persist until another event arrives. A frame without chunk11 inherits the previous point.

The relative placement is exactly:

```
weaponTopLeft = bodyTopLeft + bodyFrameAnchor - weaponFrameAnchor
```

This follows from layout routine `0x41af70`, which unions a weapon rectangle at `(0,0)` with a body rectangle at `(weaponAnchor-bodyAnchor)`, then stores the resulting body and weapon offsets. The shared union world-space origin does not change the relative equation above.

Machine-readable export: `analysis/weapon-anchors-re.json`. Reproduce with `python analysis/recover_weapon_anchors.py`. This file includes inherited points for every decoded frame of130 original resources, source offsets of the events, original direction tables and clipping rules.

Example: walking down196, frame0 has anchor `(39,48)`. Samopal down289 has anchor `(24,1)`, hence its top-left is bodyTopLeft+`(15,47)`. Samopal left290 has `(49,15)`, right291 `(8,26)`, up292 `(7,38)`. These large differences explain why centering each weapon sprite on the actor gives the wrong grip.

## Layering also differs by direction

Renderer `0x417640` draws weapon pieces on opposite sides of the body:

| Original direction | Resource body | Behind body | In front of body |
|---|---:|---|---|
| 0 left |198| weapon rows0..cut | weapon rowscut..height |
| 1 right |200| weapon rows0..cut | weapon rowscut..height |
| 2 up |202| whole weapon | none |
| 3 down |196| none | whole weapon |

For left, `cut=floor(weaponHeight/2)-7` (`0x41777c`). For right, `cut=floor(weaponHeight/2)+5` (`0x417786`). The two source rectangles are placed at one common weapon origin, so the front piece starts at weaponY+cut. These rules are not a cosmetic invention: the renderer explicitly splits the source rectangle.

Constructor `0x41e719` uses original resource table `0x4af2ec`: `[198,200,202,196]`. Alternate table `0x4af2dc` is `[199,201,203,197]`. Thus the app's normal game body resources belong to the correct family; front idle/intro animations180–195 are not the four normal direction table entries.

Weapon table `0x482820` is indexed by type*28 bytes by constructor `0x41dbc0`. Row0 holds `[270,271,272,269]`, row4 `[286,287,288,285]`, row5 `[290,291,292,289]`. Their semantic names pistol/shotgun/samopal are based on the original artwork plus default pistol-type0 special handling at `0x417500`; no symbol names for those enums were recovered.

## Movement is stored in animation events

The previous caution about chunk10 has now been resolved for CBulanek.

- Chunk10 dispatch `0x432d98` parses signed16-bit dx/dy and calls `0x436e80`.
- CBulanek observer vtable slot+4 points to `0x4178d0`.
- That callback writes dx/dy to body+`0x15c/0x160`.
- `0x41af70` adds these deltas while recomputing the body/weapon union and calls collision correction (`0x4195f0`). It then zeroes the delta fields at `0x41b0b8/0x41b0be`.

Therefore walking is animation-driven movement, not a constant speed integrated per browser frame.

### The extra ring frame matters

Walking files have header count8 but **nine frame blocks**. Block0 initializes the full image with zero motion. Blocks1..8 are the movement cycle; the extra block8 restores frame0 pixels and contains a nonzero final movement event. Discarding it creates missing movement and sideways drift.

At100% speed, one cycle lasts378ms:

| Direction | Resource | Total cycle movement |
|---|---:|---|
| left |198|(-59,0)|
| right |200|(59,0)|
| up |202|(0,-52)|
| down |196|(0,52)|

`0x4399b0` computes frame delays as integer `floor((f+1)*duration/frameCount)-floor(f*duration/frameCount)`, giving `[47,47,47,48,47,47,47,48]`ms for378/8. Start routine `0x439b40` resets the stream via `0x432840`, then immediately reads block0 and schedules the first47ms. At47ms block1 moves; at378ms ring block8 moves and restores initial pixels. Stream wrap `0x432e35` returns to block1 using the stored first keyframe length.

Speed is configurable. Constructor clamps it to40..200. At100%, native timing above is retained. For other values `0x41e91c` computes `trunc(47.25/(speedPercent/100))` and sets a fixed per-frame delay via `0x439720`. Constants are actual doubles at `0x482908=47.25` and `0x482910=100.0`.

Machine-readable cycles and exact events, including ring blocks: `analysis/player-movement-re.json`. Reproduce with `python analysis/recover_player_movement.py`.

## Original collision rectangle

CBulanek constructor `0x41e963..0x41e986` sets the body-local rectangle to `[2,25,bodyWidth-2,bodyHeight]`. For55×62 images this is `[2,25,53,62]`. Getter `0x417410` adds the current body offset to all sides. This is materially larger and shaped differently than the prototype's radius9 circle.

The map/actor collision resolver is `0x4195f0`, which handles directional correction using the current rectangle and queries game geometry through `0x418300`. The exact treatment of all obstacle types remains outside this bounded attachment research; the attachment and root-motion data above are confirmed independently.
