# Collision audit in the web (debug overlay)

Tool: `?debug` in the URL draws red obstacle rectangles from `maps.json`, the player's cyan hitbox and a yellow
point at their logical position. Without the parameter nothing is drawn.

## Player hitbox: fixed

The earlier circle `r=9` (18 px across) was about a third of the visible bulánek, so shots "went past" and
players did not collide. It is now the rectangle from `CBulanek` ctor `0x41e963`: `[2,25,BODY_W-2,BODY_H]`, for
55×62 `[2,25,53,62]`. In the world around logical `(x,y)`: `{x:x-25.5, y:y-25, w:51, h:37}` (body held at
`(x-27.5, y-50)`). The overlay confirms that the rectangle follows the character exactly. It is used for walls,
player-to-player collision and hits.

## Obstacles per map, faithful to the script

| Map | Boxes | Fits the scenery | Note |
|---|---|---|---|
| Vybíjená | 6 | yes | top "wall" of speakers, left/right edge |
| Noční směna | 23 | yes | machines, pits, pot; the diagonal crane is overhead with no collision |
| Malárie | 7 | yes | branch and stones; **tree trunks are painted in the background, with no collision in the original too** |
| Na dobrou noc | 14 | yes | bushes, stones, log, mushroom stem (you can walk behind the cap) |
| Exitus | 18 | yes | ruins, rocks; **the crosses are in background `102.png`, with no collision** |

Boxes are extracted directly from script bytecode, not estimated. The "missing" collision of large painted objects
(crosses, trunks) matches the original: the script gives them no `create_obstacle`, they are part of the background.

## Added after playing (object_rect = object footprint)

Objects with `set_object_rect` (native 0x30) have their own fixed footprint, now added as a collision box next to
`create_obstacle`:

- The **bush** in Na dobrou noc (res 72, object `0x5c9`) had only `object_rect` and no `create_obstacle`, so one could
  walk through it. New collision `[70,150,151,187]`.
- The **mushroom house** (res 106, object `0x1e7`) has `create_obstacle` on the underside of the cap and `object_rect`
  on the **stem** `[444,293,597,329]`, now a solid base of the house.

Na dobrou noc thereby has 16 obstacles (was 14). Maps without `set_object_rect` (Exitus and others) are unchanged.

## Vybíjená: DJ bulánek added

Script 319 inserts two animations the original export missed: res 216 `(448,81)` turntables and res 217 `(463,63)`
the animated **DJ bulánek** (54 frames). They were added to `disco.animations`.

## Conclusion

Collision data is 1:1 with the script and the hitbox now has the right shape. If a specific object seems wrongly
passable or impassable, it is either (a) a property of the original (background with no collision), or (b) a candidate
for checking its specific record; the `?debug` overlay shows which box.
