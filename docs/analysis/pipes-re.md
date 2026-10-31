# Noční směna: pipe analysis from the original EXE

## Result

The links of all five pipes, entry directions, exit coordinates and the two-second delay are stored directly in the script of map resource 321. This is not geometry estimated from the image, nor rules taken from the Android port.

| ID | Entry rectangle (left,top,right,bottom) | Accepted shot direction | Exit | Exit direction |
|---|---|---|---|---|
| 10, top left | 136,17,168,27 | up (2) | 500,440, bottom right | up (2) |
| 11, top right | 579,20,610,30 | up (2) | 38,409, bottom left | right (1) |
| 12, bottom centre | 447,450,477,460 | down (3) | 461,440, same pipe | up (2) |
| 13, bottom right | 494,450,524,460 | down (3) | 150,29, top left | down (3) |
| 14, bottom left | 26,390,36,431 | left (0) | 592,32, top right | down (3) |

Entry rectangles are half-open geometric rectangles as elsewhere in the engine; the exact original collision goes through the projectile's bitmap rectangle, not a mathematical point. Exit x,y are the original origin of the rectangle of the newly created shot (`CShot + 0x20/+0x24`), not an estimated pipe centre.

## Evidence in the data

Bytecode starts at offset 16 of the resource file. Recognised records `33 38 2f 00` compose `add_to_scene(assign_object_id(rect(...), id))`:

- raw 0x23b: ID 10;
- raw 0x257: ID 11;
- raw 0x273: ID 12;
- raw 0x28f: ID 13;
- raw 0x2ab: ID 14.

A switch at bytecode 0x42a selects callbacks 0x450, 0x46c, 0x488, 0x4a4, 0x4c0 by the ID of the hit object. Each callback calls shared function 0x59a with the target index and required entry direction:

```text
10 -> on_pipe(3, owner, incoming_direction, 2, 10)
11 -> on_pipe(4, owner, incoming_direction, 2, 11)
12 -> on_pipe(2, owner, incoming_direction, 3, 12)
13 -> on_pipe(0, owner, incoming_direction, 3, 13)
14 -> on_pipe(1, owner, incoming_direction, 0, 14)
```

Script addresses are relative to bytecode base 16. Branch targets do not include the leading local variable count; real functions called by opcode 0x0e do. Function 0x59a has 0 local entries, function 0x5d9 has 1 and so its parameters start at index 1.

Pseudocode of the confirmed part of 0x59a:

```text
if incoming_direction != accepted_direction: return 0
signal(1, pipe_object_id)
if runtime_authority_guard() == 0: return 0
id = timer_create(-1, 2000, flags=2)
timer_user_data(id) = destination_index + (owner << 8)
return 0
```

Native 0x41 / function 0x418950 sends another original event to the engine through 0x418000; the exact meaning of signals 1/2 is not settled here. Native 0x4a / 0x416d30 returns the test of runtime flag `script[0x45c][0x36] == 0`; the condition matches authoritative processing in a network game. That reading of the flag's purpose is an inference, not a recovered variable name.

## Two seconds are not a guess

The extended opcode handler table is at 0x4af018. Constructor 0x4185c0 registers it for opcodes 0x2d–0x66 through 0x438310. Handler 0x44 = 0x416c00 reads three arguments and calls 0x42f210.

`0x42f210(-1,2000,2)`:

- with index -1 allocates a new timer ID;
- flag 2 writes the current value of timer `0x4b3bd8` as the start;
- period/delay 2000 is stored in field +4;
- flag 1 (paused) is not set;
- userdata +0x18 is then set by handler 0x51 = 0x4189b0.

Scheduler 0x42eb30 at 0x42eb54–0x42eb62 compares `start + period <= current_time`, then calls the callback. Flag 2 does not allow repeating (bit 4 does that), so this is a single firing after 2000 ms. The time comes from WinMM `timeGetTime` through 0x42e790.

## The pipe does not carry over the original shot vector

The exit switch decodes the low 8 bits of userdata as the target index. Five branches call function 0x5d9 at bytecode addresses 0x669, 0x685, 0x6a1, 0x6bd, 0x6d9 with parameters from the exit table above.

Pseudocode of function 0x5d9:

```text
local_owner = packed_userdata >> 8
spawn_shot(exit_x, exit_y, exit_direction, local_owner, flags=1)
signal(2, local_owner + 10)
// conditional network state transfer follows
return 0
```

Handler 0x43 = 0x41f610 builds a coordinate pair and calls 0x41f230. With flag 1 this creates a new CShot through 0x41edf0 with variant 0 (`(flags & 3) - 1`). The original speed, spread angle, age or projectile type do not enter it. The shot's owner survives thanks to the high bits of userdata. The web port should therefore create a new basic projectile, not move the same vector elsewhere.

Original CShot:

- constructor 0x41edf0 creates timer `timer_create(0,50,6)` at 0x41ef18–0x41ef1f;
- flags 6 include bit 4 for repeating and bit 2 for an immediate start;
- callback 0x419b40 makes a 40 px step in the given direction, by switch table 0x419c88;
- nominally 40 px / 50 ms = 800 px/s, with discrete steps and four collision sub-steps in 0x41de60.

## A hit from the wrong side

CShot 0x41de60 calls 0x41dd70 on finding an obstacle and then **unconditionally returns 1** at 0x41df54–0x41df59. Update 0x41df60 marks the projectile inactive or disables the pellet in the mask. A zero returned by the script handler therefore does not mean a shot passes through a pipe without collision.

Implementation consequence: a shot hitting the entry rectangle from the wrong direction is consumed and no exit shot appears. In the right direction the original shot is consumed too; a new one appears at the exit 2 s later.

## What still needs analysis

- The exact sound or event meaning of native 0x41 signal 1 and signal 2.
- Full pipe synchronisation in a network game; the verified local mechanism covers only the link and timing.
- The exact bitmap collision area of projectiles and any differences for rockets and pellets. The script gives all accepted hits flag 1 for the new exit projectile.
- The original engine uses discrete 40 px steps and collision sub-steps, not smooth motion, so 800 px/s is a nominal speed, not proof of identical time integration in another engine.
