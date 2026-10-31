# Original audio: assignment and web integration

Source: `bulanci.exe`, resources t48/t43/t67. Extraction is static; the game was not run. The original MP3 stream starts at offset **20**, not 16.

## Music

The assignment is read directly from decoded `set_audio` instructions in the six original scripts. It is not derived from file names.

| Level / screen | MP3 resource | Extra sound bank |
|---|---:|---:|
| Vybíjená | 325 | none |
| Na dobrou noc | 332 | 1 |
| Noční směna | 327 | 2 |
| Malárie | 333 | none |
| V zajetí 8-bitu | 328 | 0 |
| Exitus | 326 | none |
| Menu, day | 329 | — |
| Menu, night | 330 | — |
| Pause | 331 | — |

Menu resources are used directly at `0x425301` and `0x42531a`, pause at `0x420148`. The day/night threshold is in `ui-re.md`. After a pause the level music continues from its position; a new game starts the track from the beginning.

## Effects and voices

The global bank is resource **4**, not bank 0: initialisation `0x402b65` loads `0x10004` and writes it to `CBulanci+0x4c0`; `0x422430` uses it for a zero bank argument.

| Event | Bank / sample | Evidence |
|---|---|---|
| Pistol | 4 / 21 | shot flag 0x10, `0x41f303` |
| Shotgun | 4 / 13 | flag 0x20, `0x41f2fc` |
| Reload finished | 4 / 16 | `0x4175b8` |
| Round end | 4 / 17 | `0x41d64c` |
| Pickup | 4 / 18 | `0x419d99` |
| Hit / death | 4 / 23 | `0x41f9a5` |
| Rocket hit | 4 / 22 | `0x41f9b3` |
| Teleport | 4 / 36 | `0x41db6c` |
| Explosion | 3 / 1 | `0x41cf4c..0x41cf65`, level bank `0x4b3730` initialised from resource 3 |

Specialised NPC shots use other banks and must not be confused with a player's shot.

Four original voice profiles:

- Return / appearance: `[1,4,7,10]`, table `0x4aef98`, function `0x416670`.
- Line after a hit: `[3,6,9,12]`, table `0x4aefa8`, function `0x416690`.
- Another line: `[2,5,8,11]`, table `0x4aef88`, function `0x4166b0`.

In the original code the line after a hit starts once the hit effect has finished; the web keeps this order through the end of the sound buffer. A profile can be passed through `player.voiceSet` / `voiceProfile`; otherwise the web uses player order.

Stereo placement: `0x422500` computes `clamp(xCenter,0,800)*3000/800-1500` in hundredths of dB. The web uses the same attenuation of the matching stereo channel.

## Web integration

`audio-bridge.js` wraps the existing `Game.update` and the `onEvent` callback; it follows return and reload state changes without touching the physics.

## Menu and fullscreen

The original menu is 800×600. Illustrations 316/317/318 are anchored to the bottom-right corner (`0x425870`: 800−width, 600−height). Details of the menu are in `ui-re.md`.

Fullscreen uses the native Fullscreen API at 4:3 with black borders. The whole menu and HUD stay in view. If the API is refused, the page fills the browser window. Alt+Enter switches the mode. Monitor resolution changes neither map coordinates nor physics.

## SMG correction after verifying the original types (28 Oct 2026)

The SMG is original type 4; animations 285–288 fire four shots at 71, 213, 355 and 497 ms. The first three use bank 3 / sample 3, the last bank 3 / sample 4. Bank 4 / sample 19 is the empty-pistol sound. The type 5 rocket launcher uses bank 3 / sample 7. Exitus undead use the same SMG; their death flag 0x80 skips the human death sound and voice.
