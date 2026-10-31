# Original menu and dialogs — analysis (step 3a, 28 Oct 2026)

Source: the supplied `bulanci.exe` (static analysis), text table `[0x4afbbc] = 0x4af9b8`. Visual
reference: period screenshots (Gamez.cz, 320×240).

## Fonts (t54)

| Resource | Strip | Line / cell | Use |
|---|---|---|---|
| 174 | 1713×16, 2 bits, palette white/#ccc/#adadad | 19 / 16 | headings, labels, buttons |
| 175 | 1069×13, 1 bit | 15 / 13 | small text, edit fields, statistics |
| 176 | 879×11, 1 bit | 9 / 11 | "Verze: 1.80" |

After the pixels come 8 bytes (line height, cell height) and 256 records of 5 bytes by Windows-1250
code: `uint16 x, uint8 width, uint8 first row, uint8 row after the last`. Palette index 0 is
transparent.

## Screens and where they are created

Window sizes and element coordinates are pixels of the 800×600 scene; element coordinates are
relative to the window.

| Screen | Function / class | Content |
|---|---|---|
| Main menu | `CMenu` | Start, Historie, Konec (web: `original-menu.js`, done) |
| Start hry 1 | `0x40c650`, `CStartGame1` (window 0xfa,0x3c–0x2f8,0x230) | "Hru:" Vytvořit/Připojit se; total players: 1 (training)/2/3/4; on this computer: 1/2/3; connection: TCP/IP / IPX; "Dále" button |
| Start hry 2 | `0x4104f0`, `CStartGame2` (window 0xe6,0x32–0x2f8,0x230) | for each local player `CColorSet` (palette), bulánek preview (`CGameView`/`CDSAnim`), name (`CEdit`, font 175), "Ovládání"; "Typ hry" and its text; "Nastavení"; "Levely:" (`CLevelList`); "Start"; "Hra je vytvořena, stiskněte Start..."; "Zrušit" |
| Typ hry | `0x40d930`, `CGameTypeDlg` (window 0x140×0xda) | game type hits/time/lives; weapon mode shotgun only/all weapons; three numeric fields (5–999, 10–9999, 5–999); Ok / Zrušit |
| Ovládání | `0x40f7d0` (window 0x118×0xb4) | direction, fire and weapon-change labels and key names; Ok |
| Nastavení | `0x40e290`, `CSetupDlg` (window 0x122×0x8c) | "Vyvážení: %d%% hudby a %d%% efektů", `CVolume`; Ok / Zrušit |
| Pause | `0x411df0` | "Hra je pozastavena"; Pozastav, Pokračuj, Nastavení, Konec hry |
| Loading | `0x40dfb0`, `CLoadingLevel` (window 0xfa×0x4b) | "Načítá se level...", `CProgressBar` |
| Statistics | `0x410e20` → `CLevelScore` | full-screen window 0x320×0x258; bitmaps 34–36, 164, 149; animation 303; texts "Zabil: %dx", "Mrtev: %dx"; table Pořadí/Level/Jméno/Zabil/Mrtev/Rozdíl |
| Konec | `0x411b50`, `CExitDlg` | animations 305, 306; "Konec hry" |
| Message | `0x40be80`, `CMsgDialog` | text and button, done (step 3d-8) |
| Network | `0x40c060` (IP address), `0x40c2d0` (game list), `0x4102d0` (chat) | a look reference for the WebSocket multiplayer only |
| Help, Historie | `CHelpDlg` ctor `0x421e40`, `CHistoryDlg` `0x4231d0` | Historie done from the original (see below); help is unreachable, see step 3d-8 |
| Main menu scene | `0x4265e0` (`CMenu` constructor) | background 315, night bitmap 313, `CPoemScroller`, "Verze: 1.80" (font 176), 4× `CRuch`, done, see below |

## Default settings (0x40a290)

Game type 1 (time), weapon mode 1 (all), hits 30, time 180 s, lives 30; player counts
`+0x32 = +0x33 = 2`; default keys of six players from tables `0x4ae604`/`0x4ae60c`/`0x4ae614`.

## Drawing elements (step 3b)

Windows (`CWindow`) draw nothing themselves: dialogs lie directly on the menu picture, with no frame
or background (matching the "Start hry" screenshot). Elements draw through method 14 of their vtable.

**Opacity by state** (`0x402f40`, bits of `+0x44`): inactive (4) `0x303030`, active / focus (2)
`0x909090`, otherwise `0x858585`. The value is per-channel opacity (`0x436310` → `0x445f10`:
`0xffffff` = fully opaque, 0 = nothing, otherwise a table blend). For bitmaps it is written to
`[bitmap+0x18]` and returned to `0xff` after drawing.

| Element | Drawing | Details |
|---|---|---|
| `CButton` | `0x4056b0` | bitmaps 31 normal / 30 focus (`+0x44 & 8`) / 32 pressed (`+0x8f`), 82×25, with state opacity; text in font 174, style 5 (centred), offset +1,+1 when pressed |
| `CRadio` | `0x403ac0` | bitmaps 121 / 119 focus / 122 selected / 120 selected + focus / 123 inactive item (15×15); items stacked with step height + 2; text 11 px after the bitmap, font 175 |
| `CEdit`, `CNumEdit` | `0x406100` | frame `0x404e80` (outline `#b7b7b7`, inner `#575757`, next `#b7b7b7`, black fill, all with state opacity); text inset 5 px |
| `CListBox` | `0x406d00` | frame `0x404180`, fill by state (white replaced by `#a0a0a0`), items by virtual method |
| `CColorSet` | `0x40aed0` | palette bitmap 1 px inward, selected cell outlined `#eeeeee` |
| `CProgressBar` | `0x40b1f0` | frame `0x436530` + fill `0x4365f0` |

**Text** (`0x4375e0`): advance after a character = glyph width + `style[1]` (buttons 1 px); line
height = font line height + `style[2]`; LF (10) = new line, TAB (9) = 4 spaces, code 1 / 2 at line
start centres / right-aligns the line. Style flags: bits 0–1 horizontal (0 left, 1 centre, 2 right),
bits 2–3 vertical (0, 4 centre, 8 bottom), 0x10 = rectangle by text. `CStaticText` draws (`0x4054d0`,
method 14) with opacity `0x909090`, inactive `0x303030`, fully opaque only with flag `+0x94`
(Statistics). The text palette (`0x403040` → `+0x84`) recolours the font.

## Web toolkit (step 3c, done)

`dist/ui/`: `font.js` (fonts and the text routine; zero glyph width = `[font+0x560]/4`, line height
`+0x564`), `widgets.js` (StaticText, Button, Radio, NumEdit, Window; state opacity, frame `0x404e80`,
button and radio bitmaps), `layer.js` (a canvas over the game frame at native resolution, mouse /
touch / keyboard, a hidden field for the phone's numeric keyboard), `game-type-dialog.js` (the first
original dialog).

Not verified: initial focus and Tab order in the original (web: first element, creation order);
whether the dialog is centred on screen (flag 1 of the `CWindow` constructor, web: centred).

## Players: colours, names, keys (step 3d-1, done)

- Player colours: table `0x4aef24` (`0x413200`), the eight swatches of bitmap 19: green (8,141,0),
  salmon (207,87,87), brown (156,113,87), red (215,51,8), yellow (179,169,0), purple (187,100,187),
  blue (123,123,192), grey (95,95,95). Palette ramp `0x413220`.
- Character colour (`0x41e7ee`): human from the profile (`0x412930`), computer random `rand·8>>15`,
  undead 7.
- Key sets (DirectInput scan codes, order left/right/up/down/fire/weapon, table `0x4ae5ec`):
  0 arrows + space + C; 1 S F E D + A + Q; 2 J L I K + M + N; 3 Num 4 6 8 5 + Num 0 + Num 1.
- Profiles (`0x4ae604` colour, `0x4ae60c` set, `0x4ae614` name) by players on the computer:
  1 → Bulík (green, 0); 2 → Bulík (green, 1), Uzlík (brown, 3); 3 → Bulík (green, 1), Uzlík (brown, 2),
  Mazlík (yellow, 3).
- Web: `dist/players.js`, engine `humans`, up to 3 players on one keyboard.

## Start hry 2: layout (0x4104f0)

Window (230,50)–(760,560). Player column i: x0 = 34 + 130·i. `CColorSet` (bitmap 19, 81×29, 4×2
colours, cell 21×16, selection outlined `#eeeeee`) at (x0−3, 10) for local players only; preview
frame bitmap 27 with opacity 0x80 at (x0, 53); animations 180–183 (random direction, player colour)
at (x0+10, 68); name `CEdit` (font 175) (x0−12, 138)–(x0+88, ·); "Ovládání" (command 210 + i) at
(x0−3, 170) for local players only. Then "Typ hry" (0xda) at (31, 208) with a summary, "Nastavení"
(0xec) at (400, 210), "Levely:" (20, 244), `CLevelList` (30, 270)–(230, 440), "Start" (0x8002)
(40, 466), "Zrušit" (0x8003) (140, 466), hidden "Hra je vytvořena, stiskněte Start..." (40, 495).

## Settings (step 3d-3, done)

`CSetupDlg` (`0x40e290`): window 290×140, centred; text "Vyvážení: %d%% hudby a %d%% efektů" (font 174,
spacing 1) at (25, 20); `CVolume` (`0x40e1b0`, derived from `CScrollBar` `0x408370`) (25, 42)–(270, ·),
height = arrow height (15); range −50…50 (`0x4051d0`), step 1, page 20; "Ok" (55, 90), "Zrušit" (155, 90).

- Text (`0x40e4e0`): music `50 − v` %, effects `50 + v` %.
- Sound (`0x4223e0` → `0x43a5e0`): two attenuation groups in hundredths of dB; group 1 (effects)
  `min(v,0)·50`, group 2 (music) `−max(v,0)·50`, so the extreme position is −25 dB. It changes at once
  while moving (`0x40e5b0`, code 7); Ok saves the value (`+0x2fe`), otherwise the saved one returns
  (`0x402379`). Default 0 (`0x40a362`).
- While the slider is pressed, effect 4/30 loops in the effects group (`0x40fb00`), and it stops on
  release (`0x40e230`).
- `CScrollBar` draws (`0x403530`) the left arrow, right arrow and thumb, each in three states (0 normal,
  1 hover `0x403980`, 2 pressed `0x406810`); the track is two horizontal lines in the state opacity
  colour at `(arrow height − 9)/2` and 6 px lower; thumb at `x0 + arrow width + (v − min)·track/range`,
  1 px above the lines. Parts: 1 arrow −1 (repeat after 300 ms, `0x4067c0`), 2/4 track ∓20, 3 drag
  (`0x404fe0`), 5 arrow +1. Bitmaps of the generic horizontal bar 140/136/144, 131/129/133,
  141/137/145 (table `0x4ae5c4`), `CVolume`'s own 114/113/115 (note), 131/129/133, 126/125/127
  (speaker) (`0x4aea34`).
- Not verified: repeat interval after the first 300 ms (web: 300 ms) and keyboard control (web: arrows
  ±1, PageUp/PageDown ±20).
- Web: `ui/setup-dialog.js`, `ScrollBar` in `ui/widgets.js`, `settings.balance` in `game-audio.js`.

## Pause (step 3d-4, done)

Dialog `0x411df0`: window 306×90, centred, created once with the game view (`0x420423`, `+0x334`). Text
"Hra je pozastavena" (font 174, spacing 2, style 5) in rectangle (0,12)–(306,35); buttons at y = height
− 40 = 50: "Pozastav" (0xea) and "Pokračuj" (0xeb) both at x = 15, "Nastavení" (0xec) at 112, "Konec
hry" (0x8003) at 209. In a network game the window is 200 px taller for the chat (`0x4102d0`).

- Esc in game (`0x41687a`, the key belongs to no player) → `0x4124a0(1)`: the local player's pause flag
  (`+0x174 + 13·player`), a network message, message 0xe9 to the dialog.
- 0xe9 (`0x40b2f0`): shows whichever of Pozastav / Pokračuj matches the state and moves focus to it. The
  first paused player sends 0xed → `0x41c290`: stops game timers, animations and sounds, pauses the music
  and runs the dialog modally; everything resumes on return.
- Pokračuj or Esc in the dialog (`0x40ac20`) → `0x4124a0(0)`; when nobody is paused any more, 0x80ca
  closes the dialog. Nastavení → `0x40ac50` (CSetupDlg; pauses if not yet paused).
- Konec hry → 0x80cd → `0x41d5f0`: stops game timers, plays the round end (effect 17) and after it fades
  the game view ends with code 0x80cd. There is no confirmation.
- Web: `ui/pause-dialog.js`; Esc, the touch pause button and loss of window focus open the pause (pause
  music 331 through `bulanci:pause`), Konec hry calls `game.finish()`. The web "Menu" button stays as a
  shortcut to the menu.

## Statistics (step 3d-5, done)

`CScore` (`0x411010`, window 800×600) is run modally by `0x401c66` after the game view ends; Esc or
Enter closes it (`0x40abe0` → 0x8003). The game view first plays the round-end sound 17 (`0x41d5f0`,
0.72 s). The screen plays sample 4/29 in the music group (`0x411add`).

- Background bitmap 164; title animation 303 at (120, 50), played once and held on the last frame
  (`0x4391e0`: bit 1 play, bit 2 loop).
- Players (count `+0xd8`, humans only) sorted with CRT `qsort` (`0x4483b0`) by final score `0x4126e0`
  descending (`0x40abd0`). Up to 8 elements this is shortsort `0x448320` (first maximum to the end,
  unstable); the web imitates it exactly.
- Position i: x = 136 / 279 / 423 / 567 (`0x4ae788`); place p starts at 0 and grows when the next
  player has a lower score (a tie = the same place). Column bitmap `0x4ae708[i][p]` (150; 151/152;
  153–155; 156–159) at (x, 229); bulánek animation `0x4ae748[p]` + random direction 0–3 (180, 184, 188,
  192: the worse the place, the more bandaged), player colour, at (x+33, y) with y = 240 / 270 / 300 /
  330 (`0x4ae798`); name (x, y−28)–(x+118, y−10); "Zabil: %dx" y 471–486, "Mrtev: %dx" y 485–500. All
  font 175, style 5, spacing 1, fully opaque.
- Who was killed: for slots 0–3 with a count > 0 (record `+0xea + 4·victim`) character 0x1F in the
  victim's colour (grey `0x5f5f5f` as `0x2f2f2f`) at x−15 and the count at x+5, from y = 452 upward by
  14 px.
- Alone (training): the result goes to the level table (`0x414280` → `0x409b10`): add, sort by kills −
  deaths (`0x408fd0`), keep 6. An empty level gets the default table (`0x409620`): Žezlík 30, Kapslík
  25, Čmelík 20, Uhlík 15, Terčík 10, Cvalík 5 kills, always 10 deaths. If the result drops out, the
  bulánek is at its saddest (animation 192). Table: bitmap 149 with opacity 0x80 at (330, 190), header
  Pořadí / Jméno / Zabil / Mrtev / Rozdíl (texts 0x64, 0x66–0x69) in columns `0x4aeab0` + 330, y
  191–214, rows of 26 px; rank grows when the difference changes; the first row matching the result is
  fully lit (`0x409080`), the others dimmed.
- Web: `ui/score-screen.js`, tables in `localStorage` (`bulanci.records`; the original saves them to a
  file, `0x409cd0`), click / tap also closes it (phones have no Enter).

## Loading and Konec (step 3d-6, done)

- `CLoadingLevel` (`0x40dfb0`): window 250×75, centred, "Načítá se level..." (font 174, spacing 2) at
  (20, 20), `CProgressBar` (20, 50)–(230, 55). Drawing `0x40b1f0`: 1 px black outline (`0x436530`), fill
  `#a0a0a0` from the left by value / maximum (`0x4365f0`). The game view (`0x41d3e1`) moves the bar by
  level-file bytes read, per 16 kB; the web by loaded layer images (`app.js` `loadLevel`).
- `CExitDlg` (`0x411b50`): menu Konec (`0x425970`, command 0xcb) shows illustration 317, plays sample 25
  and lays window (221, 24)–(762, 569) on the menu picture (not centred): animation 305
  ("www.bulanci.cz") at (194, 22) and 306 ("www.sleepteam.com") at (313, 282), both looping (`0x419940`
  flag 3); text 0x138 (SleepTeam Labs farewell, font 175, spacing 2) at (40, 72); "Konec hry" (0x8004)
  at (49, 492) quits the program; the web ends the round and returns to Start instead.
- Web: `ui/loading-dialog.js`, `ui/exit-screen.js`, `ProgressBar` in `ui/widgets.js`.

## Main menu scene (step 3d-7, done)

`0x4265e0` is the `CMenu` constructor (called by handler 0xcc in `0x4024a0`), not a separate screen.
Window 800×600, background 315 (`assets/menu.jpg`), buttons 0xc9/0xca/0xcb at (35, 37/121/205), labels
at (100, 55/139/223). In addition:

- **Day / night** (`0x425400`, only when the menu is created): `GetLocalTime`, hour = packed time >> 25;
  night when unsigned `(hour − 6) > 15`, i.e. 22:00–5:59. Night (`0x4252f0`): music 330 and bitmap 313
  (a brighter SleepTeam "moon", 190×166) at (610, 0); day: music 329, 313 hidden.
- **Menu music** (`0x4252a0`, menu timer 120 ms `0x424080`): starts at volume 70 and each tick adds 1
  up to 100 (3.6 s); then the timer stops and the scratches switch on. Message 0xf0 (game starting)
  lowers it by 1 back to 70 and pauses the music, 0xf1 (return to menu) raises it again. Volume
  conversion (`0x43a0d0` → `0x43a060`): DirectSound receives `(attenuation + 10000) · volume / 100 −
  10000` hundredths of dB, where attenuation is the balance value from table `0x4b8370` (filled at run
  time); 70 is thus −30 dB and the rise is linear in dB. Web: `menuMusicGain` and `MENU_MUSIC` in
  `game-audio.js`, ticks count only with a really playing track (autoplay lock). Simplification: on game
  start the web pauses the menu track at once (the original lowers it for 3.6 s under loading); on
  return to the menu it continues from 70, like 0xf1.
- **CPoemScroller** (`0x4262c0`): rectangle (10, 384)–(215, 550), font 175, colour `#b0b0b0`, spacing 1,
  line spacing cell height + 1. The texts are all resources of type 2043 (0x7fb, 13 poems): `uint32
  type, uint32 character count, UTF-16`. A line starting with code 1 is centred, with code 2 right-aligned
  (author; trailing spaces inset it from the edge), tab = 4 spaces (`0x4375e0`). `0x425df0`: random poem
  `rand()*13>>15`, text set into a bitmap as wide as the longest line, centred horizontally in the window
  (`0x4240f0`); starts below the window (position = window height 166). Timer 120 ms from creation time
  + 3000 ms; a tick (`0x426030`) moves 1 px up, and when the text has left entirely (position = −height)
  it picks the next one. The top and bottom 40 rows of the window draw through opacity masks 6, 12 … 240
  (top) and 250 … 16 (bottom).
- **"Verze: 1.80"**: `CStaticText` font 176, spacing 1 at (230, 575).
- **CRuch** ×4 (`0x423c20`): a 1 px vertical line over the full height, colour `#3f3f3f` (`0x423e60`),
  random x 0–799. Hidden it waits `rand(0..4000)` ms, then shows for 100 ms, hides and jumps to a new
  random x (`0x423de0`). Timers run only with an active menu (`0x423f70`).
- Web: `ui/menu-scene.js` (a canvas under the buttons, night `menu-night.jpg`). Scrolling stops while the
  menu is hidden and continues on return (the original does not destroy the menu during a game; whether
  its timer keeps running is not verified).

## Message and help (step 3d-8)

- **CMsgDialog** (`0x40be80`, modal through `0x40f2c0`): text in font 174 with spacing 2 at (30, 10),
  window 60 px wider and taller than the text, centred on screen; one button centred horizontally at y =
  text height + 20. Kind 0 = "Ok" (0x8002), kind 1 = "Zrušit" (0x8003), tables `0x4ae6f0` (texts 29/30) and
  `0x4ae6f8`. Callers: exception error messages (`0x401a9d`, `0x41d5cb`), the network waiting message
  (`0x4137b0`) and the only local-game one: **Start in Start hry 2** (`CStartGame2` vtable `0x480d4c`, slot
  13 = `0x40f610`, command 0x8002): each player on this computer (from `+0x36`, count `+0x37`) is compared
  with all players (`+0xd8`, backwards, exact and case-sensitive `0x42d3f0`); the first match shows
  'Jméno "%s" je již použito.' (text 0xdc) and the game does not start.
  Web: `ui/msg-dialog.js`, `start-game.js`.
- **Help** (`CHelpDlg`, ctor `0x421e40`, command handler `0x421dd0` switches pages 0xe5–0xe8 through
  `0x421c10`): created only by factory `0x422280`, which static initialiser `0x47bea0` registers under
  class number 0x818 (`0x42e910`). Only deserialisation creates objects by number (`0x42ef00`, called from
  stream reading `0x42fbe5`, `0x42fd96` and from resources `0x434791`), and no resource or other code uses
  number 0x818. In this version of the game help is unreachable, so the web does not have it.

## Historie (CHistoryDlg, 29 Oct 2026)

Window (231,36)–(762,569) on picture 317. Constructor `0x4231d0` collects resources of class 0x802 (307–309,
`t2050`) as pages. A page is a program of the page VM: the same expression grammar as level scripts, extended
opcodes 0x2d–0x34 from table `0x4af7ac` (registration `0x42273a`): 0x2d label (x, y, text, letter spacing,
font; `0x406a50`), 0x2e text block, 0x2f bitmap, 0x30 text palette, 0x31 pair, 0x32 style byte, 0x33 insert,
0x34 photo with a film (`0x4236a0`). Page switch `0x422f70` runs entry 0 with argument 1. `CIcon` icons
0xe5–0xe8 at (39|56|72|91, 480): first / previous / next / last (`0x423130`), inactive at the ends (bit 4,
opacity 0x80). `CIcon` drawing `0x403e40`: image 0, 1 on hover, 2 when pressed (bitmaps 56/55/57, 59/58/60,
62/61/63, 65/64/66).

Photos 116, 69, 54, 77 play a `t76` film on click (12291, 12289, 12295, 12293): header (type 76, size,
166×153/154, ?, length ms, frame count, audio bytes, channels, bits, rate), then alternating JPEG frames and
PCM blocks. A second click stops the film (`0x422630`), the end (event 1, `0x422860`) restores the photo. The
even preview resources (12288…) are not in the EXE as previews; the preview is the photo (`0x4237b0`). Film
start and end send the menu messages 0xf0/0xf1 → `0x424010`: menu music stops and then restarts.

Web: `ui/history-dialog.js`, data `assets/original/history/pages.json`, films (frame atlas + WAV).

## Main menu buttons (CMenu, 29 Oct 2026)

`0x4265e0` creates three buttons of class `0x424bc0` at (35,37), (35,121), (35,205) with commands 0xc9–0xcb,
and for each two label bitmaps at (100,55/139/223): normal and active (147/148, 67/68, 75/76, table
`0x4af90c`). A button is an animation with two clips 212 and 213 (8 frames, 568 ms), starting on clip 212 frame
0. Hover (`0x423f20`) on an unselected button plays 212 once with sample 0 of the global bank and the orb stays
lit; leaving (`0x423ef0`) plays 213. Both start only when the animation is still. Selection (`0x424d30`) plays
212 if the orb is not lit yet and message 0xc8 makes the previously selected button play 213 (`0x424dc0`).
Labels switch only on selection: the command handler restores the previous one (`0x423a00`), hides the normal
label and shows the active one. The constructor selects the default button (`0x426c95`). Keys (`0x424fa0`):
S/H/K select Start/Historie/Konec, X quits the program (the web omits it).
