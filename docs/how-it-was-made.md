# How this version was made

Bulánci is a Czech freeware game by SleepTeam Labs from 1999–2002. Its source code is not public,
so this web version was built by reverse engineering the finished program, `bulanci.exe` v1.80.
The goal is for the game to look and behave in the browser as closely to the original as possible.

## Process

1. **Analysing the EXE without running it.** The program was only read. Disassembly and data
   decoding revealed the game's classes, file formats and concrete values such as speeds, weapons
   and collisions.
2. **Extracting the data.** The EXE ends with a compressed archive of 347 entries: bitmaps,
   animations, sounds, music, fonts, films, poems and level scripts. The format is described in
   [reverse-engineering.md](reverse-engineering.md).
3. **Decoding the level scripts.** Maps are programs for a small virtual machine inside the game.
   They provide map layouts, obstacles, creatures and their behaviour.
4. **Rewriting the logic.** The game logic was written anew in JavaScript from the EXE's functions:
   movement, shots, mines, bots, power-ups, scoring and game types. The notes list the function
   addresses.
5. **Rewriting the interface.** The menu, dialogs, statistics, history and pause screens follow the
   original windows. Phones get adapted controls and screens of their own.
6. **Network play.** The original used DirectPlay. Here a simple WebSocket server replaces it, so
   network play is not a copy of the original design.
7. **Verification.** Automated tests cover the game logic, browser checks run the game, and data
   from the import was compared with the earlier asset set. The game was also compared with
   period screenshots.

The reconstruction was carried out with the AI tools OpenAI Codex and Claude Code, directed by the
repository's author.

## What the game needs

The repository and website contain no data from the original game. **The game cannot start without
your own `bulanci.exe` v1.80.** Everyone supplies the file themselves. The browser builds the data
from it and keeps it locally; the EXE is never run or uploaded.

There are three ways to play:

| Way | What you need | Network play |
|---|---|---|
| [Live demo](https://ondrejpodrouzek.github.io/bulanci-web/) | a browser | no |
| On your computer | Node.js 20+ and `npm start` | yes, on your own machine |
| On your own server | a VPS, Node.js and HTTPS | yes, over the internet |

The steps are in the [README](../README.md).

## What is not 1:1

The game comes close to the original but is not an exact copy. The largest known difference is the
in-game HUD: its panels differ, the portrait and counter are missing, and time is shown differently.
The end of the [reconstruction log](../dist/reconstruction.md) lists the differences; the log keeps
verified findings apart from provisional values.

## Where to find details

- [reverse-engineering.md](reverse-engineering.md): data formats and a guide to the notes,
- [reconstruction log](../dist/reconstruction.md): what was found and rewritten, and when,
- [analysis/](analysis/): detailed studies of weapons, collisions, creatures, scripts and the interface.
