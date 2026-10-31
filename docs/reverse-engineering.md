# Reverse engineering

Rekonstrukce vychází ze statického rozboru `bulanci.exe` v1.80 (PE32 x86). EXE se nikdy
nespouštělo, hodnoty pocházejí z disassembly a dekódovaných dat. Adresy v poznámkách jsou
virtuální adresy tohoto EXE. Poznámky oddělují ověřené nálezy od provizorních hodnot.

## Kde co je

| Téma | Dokument |
|---|---|
| Deník celé rekonstrukce, otevřené rozdíly | `dist/reconstruction.md` |
| Zvuk | `dist/audio-re.md`, `docs/analysis/audio-re.md` |
| Mapy Na dobrou noc, Exitus, miny | `dist/bedtime-re.md`, `dist/exitus-re.md`, `dist/mines-re.md` |
| Skripty levelů (bytekód CDSScript) | `docs/analysis/level-scripts-re.md` |
| Zbraně, střely, roury | `docs/analysis/weapons-re.md`, `weapon-types-exact.md`, `pipes-re.md` |
| Kolize, tvorové, AI | `docs/analysis/collision-audit.md`, `creatures-notes.md`, `exitus-npc-re.md` |
| Rozhraní | `docs/analysis/ui-re.md` |

## Archiv dat v EXE

Za poslední sekcí PE je overlay: `GZIP`, u32 velikost, u32 0, pak bloky. Každý blok nese 32 KiB
archivu jako samostatný zlib stream, nebo je uložený bez komprese, pokud zlib nepomohl.

Archiv: u32 počet (347), u32 32, záznamy po 24 bajtech (u32 90, id, typ, offset, 0, velikost)
a data. Offset se počítá od konce tabulky. Každá položka začíná u32 typem, za ním následuje
`velikost` bajtů. Číslo zdroje je id − 65536. Kód: `tools/import_assets.py`.

| Typ | Obsah |
|---|---|
| 21 | JPEG za 4bajtovou hlavičkou |
| 28 | bitmapa, režim 5 BGR24, režimy 3/2/1/0 paleta 8/4/2/1 bpp, volitelný alfa plán w×h |
| 43, 67 | PCM zvuku a banka délek jednotlivých vzorků |
| 48 | MP3 od bajtu 20 |
| 52 | animace |
| 54 | bitmapové písmo |
| 58 | `BULANCI.TMP`, DLL |
| 76 | film, střídavě JPEG snímek a blok PCM |
| 2026, 2050 | bytekód skriptů levelů a stránek Historie |
| 2043 | básně, UTF-16 |

### Chunky animace t52

Rozdělovač je na `0x432d4f`, tabulka skoků `0x432e54`.

| Chunk | Význam |
|---|---|
| 0, 4 | indexy plně (`0x432740`), delta (`0x432780`) |
| 9 | změna palety (`0x432800`) |
| 10 | posun kořene animace |
| 11 | kotvy (`0x432850`) |
| 12 | událost animace |
| 13 | bajt objektu `+0x18` |
| 14, 15 | alfa plán w×h plně a delta, buffer `+0x20` |

Paleta je na VA `0x4aeb20`, rampa barev hráče se počítá v `0x413220`. Míchání alfy je po kanálech
v 565 přes tabulku `0x4b84f8`.

## Import v prohlížeči

Hráč vybere svůj `bulanci.exe` na `import.html`. `dist/import/exe-assets.js` z něj v prohlížeči
vyrobí assety, `dist/import/worker.js` je uloží do Cache Storage a `dist/sw.js` je podává na
běžných cestách `assets/…`. Server EXE ani data nikdy nedostane. `index.html` přesměruje na
import, když `assets/original/poems.json` chybí; ten soubor se zapisuje poslední.

Vlastní inflate v `exe-assets.js` je potřeba proto, že bloky nemají tabulku délek a
`DecompressionStream` neřekne, kde stream skončil. `tools/import_assets.py` je stejný import
pro vývoj.

## Ověření importu

Oba importy byly ověřeny proti předchozí sadě assetů z EXE v1.80. Obrázky se shodují v pixelech,
zvuk a hudba v bajtech, data JSON v obsahu. Výjimkou jsou domovské ikony, které si
prohlížeč zmenšuje sám. Archiv se shoduje s původní pracovní extrakcí v 346 z 347 položek. U zdroje
338 byla starší extrakce o 3 017 bajtů delší než velikost v tabulce archivu; začátek je stejný.
