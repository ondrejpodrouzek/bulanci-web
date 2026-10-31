# Weapons and projectiles: analysis from the EXE

Source: `bulanci.exe` (PE32 x86, base `0x400000`). The program was not run. Classes `CWeapon`, `CShot`,
`CMina`, `CExplosion` come from RTTI.

This is an early analysis. Type names and resources are corrected in `weapon-visuals-exact.md` and
`weapon-types-exact.md`; the shotgun, SMG and mines are finished in `dist/reconstruction.md`,
`dist/bedtime-re.md` and `dist/mines-re.md`.

## Confirmed from the code

### Projectile movement: 800 px/s, 4 directions only

`CShot` movement callback `0x419b40` has jump table `0x419c88` with **four** branches (0–3). Each step moves
the position by `0x28 = 40 px` along one axis:

```
0x419b77 (dir0): eax=0x28; [x]-=40 ; ...
0x419bbd (dir1): [x]+=40
0x419bfd (dir2): [y]-=40
0x419c28 (dir3): [y]+=40
```

Constructor `0x41edf0` creates timer `timer_create(0, 0x32=50 ms, flags=6)` at `0x41ef18`. Flags 6 = repeat +
immediate start. **A 40 px step every 50 ms = 800 px/s.** Projectiles therefore move strictly in one of four
world directions; the engine has no angular spread.

### A projectile is a salvo of pellets (bitmask)

The constructor sets `CShot+0xa7 = 0x1f` (5 bits) and `+0xa8 = 0`. Update `0x41df60` tests individual bits of
`+0xa7` and makes a step and collision `0x41de60` for each active pellet; a hit clears the bit. One `CShot`
object thus represents a group of pellets flying together, not one point.

### Weapon table `0x482820`

`CWeapon` ctor `0x41dbc0`: `row = 0x482820 + 28*type` (`lea eax,[edx*4+0x482820]`, with `edx = 7*type`). A loop
0..3 loads the first four entries as **directional sprites**. Six types; roles are in `weapon-visuals-exact.md`.

### Muzzle offsets

Fire routines shift the shot origin by an `{int32 x, int32 y}` offset. See the tables in
`weapon-visuals-exact.md`, which are indexed by direction.

### Ammunition and reloading of the pistol family

`0x417500` (called before firing, types < 4 only): decrements the ammo counter at `[esi + 0x11c + slot]` by 1;
when empty on slot 0 it starts reload timer `0x42f330`.

### Mine / explosion

Fire function `0x4212b0` branches by sub-type `+0x60`: for type 2 it creates an object of `0x118` bytes with
constructor `0x41cb70`. See `dist/mines-re.md`.

## Character collision

`CBulanek` ctor `0x41e963..0x41e986` sets the body-local rectangle `[2,25,BODY_W-2,BODY_H]`, for 55×62 therefore
`[2,25,53,62]`; getter `0x417410` adds the current body offset. In the web (`engine.js`) this rectangle is used
for wall collision, **player-to-player collision** and shot hits.
