# Level scripts (CDSScript VM): analysis and extraction

Main source: map script bytecode (resources 319–324, type t2026) and the extended opcode handler table at
`0x4af018` in `bulanci.exe`. The program was not run during analysis.

## Format and VM

Every `t2026` resource is a program for a small stack/expression VM. Header:
`uint32 kind (=2026), size, entry_count, globals_count`; then `size` bytes of code and `entry_count`
entry offsets. Blocks with a header carry a leading `locals` byte (number of local slots). Called
functions (`call`) with `locals=L` have the first `L` argument slots as local scratch; passed
parameters therefore start at index `L` (matching functions `0x59a`/`0x5d9` in `pipes-re.md`).

Confirmed opcode groups: constants and arithmetic (`const`, `random_inclusive`, `add/subtract/multiply/divide`,
`min/max/clamp`, bitwise), variable access (`global`, `arg`, `set_global`, `set_arg`), flow control (`goto`,
`call`, `if_*_goto`, `switch`, `return`) and native calls `0x2d–0x66`. Native arities come from the handlers;
two were checked by hand against the code (`0x49`=5, `0x53`=6).

## Scene native calls (confirmed from disassembly)

| Opcode | Name | Meaning |
|---|---|---|
| 0x2d | create_animation(x,y,flags,res[]) | animated object; flags bit 0 plays, bit 1 loops (0x4391e0) |
| 0x2e | create_bitmap(x,y,res) | static bitmap at (x,y) |
| 0x2f | create_obstacle(l,t,r,b) | collision rectangle (half-open) |
| 0x30 | set_object_rect(obj,l,t,r,b) | sets an object's local rectangle |
| 0x33 | insert_scene(obj) | inserts an object into the scene |
| 0x34 | select_layer(n) | selects the active scene layer (0 floor, 1 middle, 2 top/collision) |
| 0x35 | set_background(res) | window fill background (not the map base) |
| 0x36 | set_audio(res,res) | level music/ambient |
| 0x38 | associate_callback(obj,id) | binds a script callback to an object |
| 0x3a | place(obj,x,y) | places an object at base (x,y); local rectangles move along |
| 0x31 | set_zorder(obj,n) | drawing order (negative = earlier/behind) — *inferred from use* |
| 0x3e | get_object(id) | object by id |
| 0x41 | object_event(a,id) | sends an object event |
| 0x43 | spawn_shot(x,y,dir,owner,flags) | creates a projectile (see pipes-re.md) |
| 0x44/0x45 | timer_create(id,ms,flags)/timer_cancel | flags 1 paused, 2 start now, 4 repeat; the callback is always entry 6 with id in arg0 |
| 0x50 | play(obj,loop) | plays an animation (0x4390d0); loop=0 once, stops on the last frame |
| 0x3b/0x3c | hide/show(obj) | hides/shows an object — *pair, inferred* |
| 0x40 | trigger(obj) | runs a method of sub-object +0x98 — *inferred* |
| 0x53 | define_region(i,l,t,r,b,v) | registers a rectangular region (under network authority only) — *inferred* |
| 0x55 | try_move(obj,x,y,f)→ok | moves an object to (x,y), returns success — *inferred* |
| 0x63 | region_obstacle(obj,flag) | collision with a special flag — *inferred* |

Names marked *inferred* come from use and a short disassembly of the handler, not from recovered symbols.
`0x4384c0` is the shared "evaluate next expression"; arity was checked by the number of its calls in a handler.

## What each level carries

For all six maps the extraction covers names (EN/CZ), GUID, type id, background and sound, scene by layer,
collision rectangles in absolute coordinates, timers and region/net tables. The resource → exported PNG
mapping is `N = res − 65536`. The map base is the **first `create_bitmap(0,0)`**, not `set_background`.

| res | EN / CZ | type | base PNG | obstacles | note |
|---|---|---|---|---|---|
| 319 | Dj Slaughter / Vybíjená | 2 | 310 | 6 | 2 decorative animations |
| 320 | Bedtime story / Na dobrou noc | 1 | 83 | 13 | random A/B layout, scripted creatures |
| 321 | Steel works / Noční směna | 3 | 87 | 23 | pipes (see pipes-re.md) |
| 322 | Malaria / Malárie | 4 | 103 | 7 | wind: a 5–15 s timer plays 8 animations (see reconstruction.md) |
| 323 | 8-bit / V zajetí 8-bitu | 5 | 100 | 10 | 7 regions, scripted "boss" (object 9) |
| 324 | Exitus | 6 | 102 | 18 | fully static, decorations with collision |

### Na dobrou noc (320): random layout

Block 0xab picks `global3 = random(0,1)`; by the result five objects (trees/bushes/mushroom/log and their
creatures) go to one of two coordinate sets. Each placing subroutine also has its own probability gate
`if random(0,k)==0 return`, so not every object always appears. This is the real original mechanism.

### Exitus (324): "chance" that is always true

Subroutine 0x296 tests `if random(0,5)==6` before five decorations with collision. The value 6 is outside the
RNG range 0..5, so the branch is never taken and these five shapes are **always** placed. The only truly
random ones are two purely visual decorations in 0x239 (`random(0,5)==0`, i.e. a 1/6 chance of being skipped).
This is observed directly from the bytecode.

### 8-bit (323): scripted boss

Object 9 is a scripted creature with its own animation set (res 65790–65800). Counter `global13` counts hits;
above 7 the creature "dies" (block 0x8a0). The full behaviour is described in `reconstruction.md`.

## What remains

- The exact meaning of natives 0x53/0x55/0x62/0x40 and network synchronisation of regions.

Status of individual maps is in `dist/reconstruction.md`.
