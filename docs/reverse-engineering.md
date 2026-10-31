# Reverse engineering

The reconstruction comes from static analysis of `bulanci.exe` v1.80 (PE32 x86). The EXE was never
run; values come from disassembly and decoded data. Addresses in the notes are virtual addresses in
this EXE. The notes keep verified findings apart from provisional values.

## Where things are

| Topic | Document |
|---|---|
| Log of the whole reconstruction, open differences | `dist/reconstruction.md` |
| Sound | `dist/audio-re.md` |
| Maps Na dobrou noc and Exitus, mines | `dist/bedtime-re.md`, `dist/exitus-re.md`, `dist/mines-re.md` |
| Level scripts (CDSScript bytecode) | `docs/analysis/level-scripts-re.md` |
| Weapons, shots, pipes | `docs/analysis/weapons-re.md`, `weapon-types-exact.md`, `pipes-re.md` |
| Collisions | `docs/analysis/collision-audit.md` |
| Interface | `docs/analysis/ui-re.md` |

## The data archive in the EXE

After the last PE section comes an overlay: `GZIP`, u32 size, u32 0, then blocks. Each block holds
32 KiB of the archive as a separate zlib stream, or uncompressed if zlib did not help.

Archive: u32 count (347), u32 32, 24-byte records (u32 90, id, type, offset, 0, size) and the data.
Offsets count from the end of the table. Every entry starts with its u32 type, followed by `size`
bytes. The resource number is id − 65536. Code: `dist/import/exe-assets.js`.

| Type | Content |
|---|---|
| 21 | JPEG after a 4-byte header |
| 28 | bitmap: mode 5 BGR24; modes 3/2/1/0 palette at 8/4/2/1 bpp; optional alpha plane w×h |
| 43, 67 | sound PCM and a bank of individual sample lengths |
| 48 | MP3 from byte 20 |
| 52 | animation |
| 54 | bitmap font |
| 58 | `BULANCI.TMP`, a DLL |
| 76 | film, alternating JPEG frames and PCM blocks |
| 2026, 2050 | bytecode of level scripts and Historie pages |
| 2043 | poems, UTF-16 |

### t52 animation chunks

The dispatcher is at `0x432d4f`, jump table `0x432e54`.

| Chunk | Meaning |
|---|---|
| 0, 4 | indices, full (`0x432740`) and delta (`0x432780`) |
| 9 | palette change (`0x432800`) |
| 10 | animation root motion |
| 11 | anchors (`0x432850`) |
| 12 | animation event |
| 13 | object byte `+0x18` |
| 14, 15 | alpha plane w×h, full and delta, buffer `+0x20` |

The palette is at VA `0x4aeb20`; the player colour ramp is computed in `0x413220`. Alpha is blended
per channel in 565 through the table at `0x4b84f8`.

## Import in the browser

The player selects their `bulanci.exe` on `import.html`. `dist/import/exe-assets.js` builds the
assets in the browser, `dist/import/worker.js` stores them in Cache Storage, and `dist/sw.js` serves
them on the usual `assets/…` paths. The server never receives the EXE or the data. `index.html`
redirects to the import when `assets/original/poems.json` is missing; that file is written last.

`exe-assets.js` has its own inflate because the blocks have no length table and
`DecompressionStream` does not report where a stream ended. `tools/import_assets.py` is the same
import for development.

## Import verification

Both imports were verified against the earlier asset set from EXE v1.80. Images match in pixels,
sound and music in bytes, JSON data in content. The exception is the home-screen icons, which the
browser scales itself. The archive matches the original working extraction in 346 of 347 entries.
For resource 338 the older extraction was 3,017 bytes longer than the size in the archive table;
the start is identical.
