# Original NPCs and level collision, scripts 320 and 324

Static recovery from `bulanci_hra/bulanci.exe` and decoded original level scripts. No EXE execution. Resource numbers below are original numeric IDs minus 65536. Coordinates are original 800×515 scene coordinates; rectangles are L,T,R,B, not x,y,width,height.

## Critical verified semantics

* VM native 0x63 at `0x416f00` sets object byte `+0x6a`. `CGame::collisionQuery` at `0x418300` skips objects with that flag only when the query's projectile boolean is true. Therefore these bodies block players but pass shots. The six Exitus river bodies use this flag.
* Object `+0x69` enables its collision rectangle. `create_obstacle` (`0x416fc0`) enables it; VM `set_object_rect` 0x30 (`0x4187a0`) also enables it. Merely displaying a bitmap does not create full-image collision. Do not replace original local collision rectangles with image bounds.
* `associate_callback(object,255)` disables the script's hit callback; it does not remove the rectangle. Rabbit/mouse death scripts do precisely this.
* Multi-resource `create_animation` objects are real creatures, not duplicate scenery: a static extractor which drops them while preserving their obstacles produces unkillable scenery.

## Na dobrou noc / 320

Two equally likely layouts (global3=randomInclusive(0,1)). Each animal group has its own independent omit gate. See JSON for positions and exact local geometry.

Rabbit: log bitmap73, rabbit animation resources **[223,224,225,227,226]** in that order, ID6. It appears at log+(49,-15); hit obstacle ID7 is log+[79,50,112,80]. Separate log obstacle strips must remain separate so this small exposed rectangle can receive a projectile. Animation-complete callback chooses idle states0..3 while alive. A hit sets global4 bit2, disables callback7 and selects animation **state4 = resource226**. Death emits `object_event(1,6)`.

Gray rocks and gun mouse: bitmap70 is a gray rock pile, not a tree stump. Mouse animation ID9 has [231..238]; two sides × four states. State0/4 is emerge/aim,1/5 retract,2/6 fire,3/7 dead. Sprite placement is adjusted to rock+(13,-25) on right-facing actions or +(13,-30) on left-facing actions. Initial placement before first action is +(17,-29).

Mouse awareness uses player-count regions: left `[0,y-3,x,y+27]` (index0), right `[x+66,y-3,rightLimit,y+27]` (index1). Entry increments the side counter and has 1/4 chance to request emergence; exit decrements it. Emergence requests are blocked until global11 permits them. At end of retract animation global11=1 and timer0 delay is a random integer **3..15 seconds**. Timer callback requests a random side. End of emerge animation fires only if at least one player is currently in its side region, otherwise retracts. End of firing retracts. Each fire action emits ONE original basic shot: right `(x+65,y+10,dir1,owner9,flags1)`, left `(x-10,y+10,dir0,owner9,flags1)`. It plays `object_event(4,9)`.

Mouse hit obstacle local `[36,0,45,14]`, stored global8, becomes callback ID10 **only during fire states2/6**. It is invulnerable when hidden/aiming/retracting (callback255). Hit sets global4 bit4, disables hit callback, increments current firing state to3/7, selects death animation, emits `object_event(3,9)`. This vulnerable interval must follow original animation completion, not an arbitrary frame timer.

Mushroom shelter: bitmap106 at(x,y), z=-39, local collision `[27,180,180,216]`; separate upper obstacle `[27,97,175,133]`. Bitmap107 floor decoration at(x+8,y+141). Bird animation ID8 at(x+50,y+50), resources[228,229,230], random state0..2 on completion. There is **no full-image projectile rectangle**, so shots can travel through the open space between original bodies.

Bush animal: scenery71, animation ID4 resources **[239,240,241,243,242]**, position+(82,1), z50. Hit obstacle ID5 local[106,20,122,36]. It idles in states0..3; idle state1 emits `object_event(0,4)`. Hit sets global4 bit1, callback5→255, animation state4(resource242), emits `object_event(2,4)`. Species name has not been independently established from code; use original graphics rather than assigning invented actor visuals.

## Exitus / 324

`native_64()` at script offset0x1e2 is **not a no-op**. Native handler `0x420630` calls `0x420550`, which creates four `CBulanek` actors with IDs32,33,34,35 via `0x420530`→`0x41f500`. They use genuine native actor movement/shooting logic, not a level-script animation. Spawn position is selected by original `CGame` spawn routine `0x41a140`; script does not specify four fixed positions.

`CBulanek` constructor `0x41e4b0` special-case32..35 forces parameter40 (speed percentage), original weapon type1 (shotgun), and alternate body animation resource table `0x4af2dc` = **[199,201,203,197]**. Color field+0x123 is forced7. Actor IDs>3 set byte+0x199=1 (exact semantic not yet fully established; do not label this as infinite ammunition without its use-site proof). Constructor initializes primary ammo from `0x412490(type0)` and extra shotgun ammo from `0x412490(type1)` for IDs>4. Movement collision at `0x4195f0` sends message0x102 when IDs32..39 are blocked; the native AI consumes this.

The floor102 and foreground tree/house resources must preserve separate floor/foreground layers. All five paired object groups in the original324 script are unconditional in practice: gate compares randomInclusive(0,5) to6, an impossible omission condition. Only decorative47/48 independently omit at1/6 probability. The river blocks actor movement but passes shots, as described above.

## Remaining bounded uncertainty

Exact Exitus native AI timer/message-handler decisions, damage immunity/ammo semantics, and creature animation durations are not asserted here. Use original sprite manifest timings and animation-completion events; avoid inventing timings or fixed Exitus patrol positions. Numeric identities, scene construction, mouse state machine and exposed hit regions above are directly recoverable from the supplied scripts and cited assembly.
