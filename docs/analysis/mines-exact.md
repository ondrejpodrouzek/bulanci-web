# Original mines: verified EXE behavior

Source: `bulanci_hra/bulanci.exe`, full `analysis/output/bulanci/disassembly.asm`, and original t52 resources. Reproduce constants and asset timings with `python analysis/recover_mines_exact.py`. Machine-readable result: `analysis/mines-exact.json`.

## Placement and animation

The ground mine is **resource177**, 31×18, 16 ordinary frames, duration1136ms (71ms/frame). Pickup268 and the held mine sprites277–280 are different assets. Constructor `0x41cb70` loads177 at `0x41cc5d` and sets z=-14 at `0x41cca1`.

`0x41cc20..0x41cc4b` indexes the signed pair table `0x4827d4` using the owner's direction. Add the pair to owner+0x20/+0x24, the combined body-and-weapon world rectangle top-left:

| Direction | x | y |
|---|---:|---:|
| Left | -3 | 44 |
| Right | 27 | 33 |
| Up | 4 | 19 |
| Down | 23 | 49 |

Held mine animation resources L/R/U/D are278/279/280/277. They last355ms, with chunk12 event0 on frame2, **142ms** after animation start. Callback `0x4212b0` checks weapon type2 and event0, constructs the mine at `0x421310`, adds it to the scene, then consumes mine ammunition at `0x42132f`. Thus placement is delayed until this event, using the actor's position/direction at that time.

## Arming and walking over a mine

The activation function `0x416790` starts timer `(id=0, delay=2000ms, flags=2)` at `0x4167bd` (the `0x42f210` call). The delay starts when the ground mine activates, not at the beginning of the held weapon animation.

Timer callback `0x41c0d0` sets mine+0x114 to1 at `0x41c0d6`. It changes **no animation resource or frame**. Both armed and unarmed states use177, whose stream contains no chunk12 gameplay events. Do not add an activation flash or restart its animation based on this callback.

The ground animation plays once, stopping on frame15 at **1065ms**. The constructor calls `0x4391e0(0,1,0)`; activation `0x438fe0` starts `0x439940(false)`, so manager loop byte+0x34=0. In `0x439b90`, the counter advanced by `0x4399b0` wraps after reading the last ordinary block, causing `0x439840` to stop immediately. The header duration1136ms therefore is not its stop time. It is already holding its last frame when the2000ms arm timer completes.

The callback creates a region using the ground mine's world rectangle expanded **10px on every side**, yielding51×38. It passes flags0x0a and the mine pointer to `0x41b420`. Triggering is strict rectangle overlap with the actor collision rectangle returned by virtual slot+0x70. It is not a radius around the player center, and edge-only contact does not overlap (`0x419f4a → 0x404730`).

`0x41b494` immediately calls `0x419fd0`, checking actors already standing in the region. The path `0x419f70 → 0x419e90 → 0x417dd0` contains **no owner exclusion**. The owner can trigger their own mine, including immediately when the2000ms arming finishes. Region tracking emits enter0xf2 and exit0xf3 (`0x4167e0`); the mine's handler `0x41efb0` calls detonation on enter and ignores exit. Flags0x0a also allow special actor slots125–127 through the region system.

## Detonator and detonation

Detonator weapon type3 dispatches to `0x41ed60`. It walks the scene, checks class0x816 (`0x41ed89`), and filters mine+0x108 against the weapon's owner (`0x41ed98`). It attempts every owned mine through `0x41e070`. Unarmed mines returnfalse; armed mines returntrue. The detonator animation starts only if at least one succeeds (`0x41edc4`). Ammunition is consumed only when successful detonations equal the total number of owned mines (`0x41edd2`). An empty scene does not consume it; a mix of armed/unarmed mines preserves it after detonating the armed subset.

`0x41e070` rejects armed=0 at `0x41e096`. On success it immediately clears that byte (`0x41e0b2`), calls removal helpers (`0x42d040`, then `0x4165b0`, which schedules event0xf9), and constructs an explosion through `0x41ce30`. Clearing the flag prevents duplicate detonation before scheduled cleanup. Destructor `0x41c010` unregisters the trigger through `0x41b4a0`.

## Explosion timing and geometry

Explosion constructor `0x41ce30` loads **resource178**, 101×84, 11frames/781ms. It centers its rectangle on the source mine rectangle; for a31×18 mine, explosion top-left is **mine top-left+(-35,-33)**. Z=0. It starts positioned sample1 from bank `[0x4b3730]` during construction (`0x41cf4c..0x41cf73`).

Actual damage is **not immediate**. Resource178 chunk12 event0 is at frame2, **142ms** after explosion start. Animation callback `0x41efe0` invokes `0x41e140` only for event0 (`0x41f004`). The constructor also uses single-play `0x4391e0(0,1,0)`. Reading the last ordinary block (frame10 at **710ms**) wraps the manager frame counter; `0x439b90` then stops through `0x439840`, emitting event0xffff. That schedules removal at710ms, with final deletion subject to dispatch. **The header duration781ms is not the explosion removal time.**

`0x41e140` expands the **explosion** rectangle by60 on each side and queries collision objects through `0x4183d0`. Relative to mine top-left, the broadphase rectangle is `[-95,-93,126,111]`. Query candidates require object+0x69 and must have object+0x6a=0; collision probing skips objects with id0xff. This broadphase box is not itself the damage area.

The damage probes are4×4 rectangles. First test one centered on the explosion; its top-left relative to a mine at positive world coordinates is `(13,7)`. Then trace eight rays, at most15steps each, with these vectors from table `0x4828c8`:

| Index | dx | dy | Damage direction |
|---|---:|---:|---:|
| 0 | -6 | 0 | 0 |
| 1 | 6 | 0 | 1 |
| 2 | 0 | -6 | 2 |
| 3 | 0 | 6 | 3 |
| 4 | -4 | -4 | 0 |
| 5 | 4 | 4 | 1 |
| 6 | 4 | -4 | 2 |
| 7 | -4 | 4 | 3 |

The loop processes indices7 through0 (`0x41e20c`), advancing before each probe. `0x41b250` handles intersection/damage and returns whether this ray stops. This is **not circular distance damage**. The center and first11steps pass direction|0x80; the final4steps omit0x80 because the counter is decremented before the `remaining > 3` comparison (`0x41e259..0x41e25f`). The exact downstream meaning of this bit is left explicit rather than guessed.

On an eligible actor intersection, `0x41b34b` calls `0x417e80(targetId, explosionOwnerId, directionFlags, point, true)`. It refreshes the candidate after damage and may repeat up to4times. A ray may stop on an intersecting non-player object; preserve the original collision-query/response behavior rather than applying damage to every actor in a radius.

After the rays, `0x41e296` calls `0x41a2f0`, which finds all class0x816 mines whose own rectangle strictly overlaps that same broadphase box. It filters neither owner nor ray occlusion. `0x41e2aa` attempts detonation on each, so only armed mines chain. Each child explosion's damage and next chain event are delayed another142ms. The full damage/chain block is skipped if the initial actor broadphase query returns zero candidates (`0x41e19d`); this explicit original guard is retained in the JSON.

## Practical differences from common approximations

- Ground asset177, not pickup268; arming leaves the animation unchanged.
- Spawn at the142ms weapon event; arm2000ms after mine activation.
- Trigger51×38 against collision rectangles; the owner can trigger it.
- Detonator affects all owned armed mines and preserves itself if any owned unarmed mine remains.
- Explosion damage/chain occurs142ms after detonation. Sprite size and damage probes have separate roles.
- Damage uses eight obstructable rays; chain reaction uses the larger rectangle without ray occlusion.

## Follow-up: changing direction during an SMG burst

Changing direction cancels the remaining rounds of the old burst. It neither carries on at the new angle nor starts another burst automatically.

`0x4197fb` sets actor+0x168=1 around the weapon direction update `0x4179e0`. That calls `0x439eb0(newDirection,true)`, whose first call is `0x439840` at `0x439eb3`. This pauses timer0 using `0x42f300` (sets timer.flags bit0 and increments pause depth), then sends animation event0xffff synchronously through `0x436ef0`.

After replacing the stream, `0x439eb0` calls `0x439b40`. It resets the stream and manager frame counter to0, sets the timer time base through `0x42f290`, and reads frame0. **`0x42f290` does not clear the pause flag or decrement pause depth.** There is no `0x42f330` resume in this path; that is called by `0x439940` when firing starts another animation. Thus frame0 is displayed, but the remaining event-bearing frames of the old burst cannot run.

Actor+0x168 does not guard the weapon's event callback `0x4212b0`. Its relevant read at `0x41bf49` prevents the transient weapon layout change from calling `0x41af70` until body/weapon direction updates finish. A subsequent separate firing action can start a new burst in the new direction.


## Doplnění: pickup, běžné stěny a konec paprsku

Pickup typu2 přidává jeden kus do maxima4 (`0x41ec89..0x41ec98`). Typ3 se v běžném
náhodném generátoru přeskakuje (`0x41e397..0x41e3a1`). Automatický grant rozbušky při
sebrání ani položení miny nebyl v těchto cestách nalezen; explicitní give typu3 vede
přes `0x41eba0 →0x41ec1a`. Běžná implementace proto zůstává u tlakových min.

Nepojmenované překážky vytvořené native2f mají ID255 z `0x416590`; konstruktor
`0x416fc0` ani vložení `0x41a390(obj,FF)` jej nemění. Právě tento ID se v `0x41b250`
přeskakuje. Explicitně pojmenované objekty jsou jiný případ.

Při zásahu hráče probe přes `0x41b330..0x41b377` obnovuje ukazatel ze scene slotu,
nejvýše čtyřikrát. Běžný CBulanek v tom slotu zůstává i po smrti, a probe pak vrací
true: paprsek se zastaví. Pro tento výbuch proto první zasažená postava zakrývá další
postavu za sebou. Nový výbuch už z broadphase dostává její CDeath s ID255 a ten ignoruje.
