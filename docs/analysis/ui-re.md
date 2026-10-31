# Původní menu a dialogy — rozbor (krok 3a, 28. 10. 2026)

Zdroj: dodané `bulanci_hra/bulanci.exe` (statický rozbor), nástroj `analysis/dump_dialogs.py`
(výstup `analysis/ui-dialogs.txt`), tabulka textů `[0x4afbbc] = 0x4af9b8` (výpis
`analysis/ui-texts.txt`), písma `analysis/export_fonts.py`. Vizuální reference: dobové
snímky v `analysis/ui-reference/` (Gamez.cz, 320×240).

## Písma (t54)

| Resource | Proužek | Řádek / buňka | Použití |
|---|---|---|---|
| 174 | 1713×16, 2 bity, paleta bílá/#ccc/#adadad | 19 / 16 | nadpisy, popisky, tlačítka |
| 175 | 1069×13, 1 bit | 15 / 13 | malé texty, editační pole, statistika |
| 176 | 879×11, 1 bit | 9 / 11 | „Verze: 1.80“ |

Za pixely je 8 B (výška řádku, výška buňky) a 256 záznamů po 5 B podle kódu Windows-1250:
`uint16 x, uint8 šířka, uint8 první řádek, uint8 řádek za posledním`. Index palety 0 je
průhledný. Export: `web/dist/assets/original/fonts/<id>.png/.json`. Mezera mezi znaky
(zatím 1 px) se ověří v kreslicí rutině `CStaticText`.

## Obrazovky a kde vznikají

Rozměry oken a souřadnice prvků jsou v pixelech scény 800×600; souřadnice prvků jsou
relativní k oknu. Přiřazení argumentů k prvkům je z výpisu instrukcí a u některých prvků
se ještě upřesní (viz `ui-dialogs.txt`).

| Obrazovka | Funkce / třída | Obsah |
|---|---|---|
| Hlavní menu | `CMenu` | Start, Historie, Konec (web: `original-menu.js`, hotovo) |
| Start hry 1 | `0x40c650`, `CStartGame1` (okno 0xfa,0x3c–0x2f8,0x230) | „Hru:“ Vytvořit/Připojit se; „Počet hráčů celkem:“ 1 hráč (trénink)/2/3/4 hráči; „Na tomto počítači:“ 1/2/3 hráči; „Způsob připojení:“ TCP/IP / IPX; tlačítko „Dále“ |
| Start hry 2 | `0x4104f0`, `CStartGame2` (okno 0xe6,0x32–0x2f8,0x230) | pro každého místního hráče `CColorSet` (paleta), náhled bulánka (`CGameView`/`CDSAnim`), jméno (`CEdit`, písmo 175), „Ovládání“; „Typ hry“ + „Typ hry:“ text; „Nastavení“; „Levely:“ (`CLevelList`); „Start“; „Hra je vytvořena, stiskněte Start...“; „Zrušit“ |
| Typ hry | `0x40d930`, `CGameTypeDlg` (okno 0x140×0xda) | „Typ hry:“ na zásahy/na čas/na životy; „Mód zbraní:“ pouze brokovnice/všechny zbraně; tři číselná pole (5–999, 10–9999, 5–999); Ok / Zrušit |
| Ovládání | `0x40f7d0` (okno 0x118×0xb4) | „Vlevo: … Změna zbraně:“ a názvy kláves; Ok |
| Nastavení | `0x40e290`, `CSetupDlg` (okno 0x122×0x8c) | „Vyvážení: %d%% hudby a %d%% efektů“, `CVolume`; Ok / Zrušit |
| Pauza | `0x411df0` | „Hra je pozastavena“; Pozastav, Pokračuj, Nastavení, Konec hry |
| Načítání | `0x40dfb0`, `CLoadingLevel` (okno 0xfa×0x4b) | „Načítá se level...“, `CProgressBar` |
| Statistika | `0x410e20` → `CLevelScore` | celoobrazovkové okno 0x320×0x258; bitmapy 34–36, 164, 149; animace 303; texty „Zabil: %dx“, „Mrtev: %dx“; tabulka Pořadí/Level/Jméno/Zabil/Mrtev/Rozdíl |
| Konec | `0x411b50`, `CExitDlg` | animace 305, 306; „Konec hry“ |
| Zpráva | `0x40be80`, `CMsgDialog` | text + tlačítko — hotovo (krok 3d-8) |
| Síť | `0x40c060` (IP adresa), `0x40c2d0` (seznam her), `0x4102d0` (chat) | pro WebSocket multiplayer jen jako vzor vzhledu |
| Nápověda, Historie | `CHelpDlg` ctor `0x421e40`, `CHistoryDlg` `0x4231d0` | Historie hotová podle originálu (viz „Historie“ níže); nápověda je nedosažitelná, viz krok 3d-8 |
| Hlavní menu — scéna | `0x4265e0` (konstruktor `CMenu`) | pozadí 315, noční bitmapa 313, `CPoemScroller` („chvilka poezie“), „Verze: 1.80“ (písmo 176), 4× `CRuch` — hotovo, viz níže |

## Výchozí nastavení (0x40a290)

Typ hry 1 (na čas), mód zbraní 1 (všechny), zásahy 30, čas 180 s, životy 30; počty hráčů
`+0x32 = +0x33 = 2`; výchozí klávesy šesti hráčů z tabulky `0x4ae604`/`0x4ae60c`/`0x4ae614`
(texty „šipka vlevo…“, „mezerník“, „Num 1/0/4/5/6/8“).

## Kreslení prvků (krok 3b)

Okna (`CWindow`) samy nic nekreslí: dialogy leží přímo na obrázku menu, bez rámečku a pozadí
(souhlasí se snímkem „Start hry“). Prvky se kreslí metodou 14 své vtable.

**Průhlednost podle stavu** (`0x402f40`, bity `+0x44`): neaktivní (4) `0x303030`, aktivní /
fokus (2) `0x909090`, jinak `0x858585`. Hodnota je krytí po kanálech (`0x436310` → `0x445f10`:
`0xffffff` = plné krytí, 0 = nic, jinak míchání přes tabulku). U bitmap se zapisuje do
`[bitmapa+0x18]` a po kreslení vrací na `0xff`.

| Prvek | Kreslení | Podrobnosti |
|---|---|---|
| `CButton` | `0x4056b0` | bitmapy 31 normální / 30 fokus (`+0x44 & 8`) / 32 stisknuté (`+0x8f`), 82×25, s krytím stavu; text písmem 174, styl 5 (na střed), při stisku posun +1,+1 |
| `CRadio` | `0x403ac0` | bitmapy 121 / 119 fokus / 122 vybraný / 120 vybraný + fokus / 123 neaktivní položka (15×15); položky pod sebou s krokem výška + 2; text 11 px za bitmapou, písmo 175 |
| `CEdit`, `CNumEdit` | `0x406100` | rámeček `0x404e80` (obrys `#b7b7b7`, vnitřní `#575757`, další `#b7b7b7`, černá výplň, vše s krytím stavu); text odsazený 5 px |
| `CListBox` | `0x406d00` | rámeček `0x404180`, výplň stavem (bílou nahrazuje `#a0a0a0`), položky virtuální metodou |
| `CColorSet` | `0x40aed0` | bitmapa palety o 1 px dovnitř, vybraná buňka obtažená `#eeeeee` |
| `CProgressBar` | `0x40b1f0` | rámeček `0x436530` + výplň `0x4365f0` |

**Text** (`0x4375e0`): posun za znakem = šířka glyfu + `styl[1]` (tlačítka 1 px); výška
řádku = výška řádku písma + `styl[2]`; znak LF (10) = nový řádek, TAB (9) = 4 mezery,
kód 1 / 2 na začátku řádku zarovná řádek na střed / vpravo. Příznaky stylu: bity 0–1
vodorovně (0 vlevo, 1 střed, 2 vpravo), bity 2–3 svisle (0, 4 střed, 8 dole), 0x10 =
obdélník podle textu. `CStaticText` kreslí (`0x4054d0`, metoda 14) s krytím `0x909090`,
neaktivní `0x303030`, plným jen s příznakem `+0x94` (Statistika). Paleta textu (`0x403040` → `+0x84`)
přebarví písmo.

Bitmapy UI: `analysis/export_ui_assets.py` → `web/dist/assets/original/ui/` (všech 159 t28,
režimy 0, 1, 2, 3, 5).

## Webový toolkit (krok 3c, hotovo)

`web/dist/ui/`: `font.js` (písma a textová rutina; nulová šířka glyfu = `[písmo+0x560]/4`,
výška řádku `+0x564`), `widgets.js` (StaticText, Button, Radio, NumEdit, Window; krytí stavu,
rámeček `0x404e80`, bitmapy tlačítek a přepínačů), `layer.js` (canvas přes rámec hry v
nativním rozlišení, myš / dotyk / klávesnice, skryté pole pro číselnou klávesnici telefonu),
`game-type-dialog.js` (první původní dialog). Menu otevírá „Typ hry“ tlačítkem a ukazuje
souhrnnou větu startovní obrazovky. Kontrola `web/verify-dialogs.mjs`.

Neověřeno: počáteční fokus a pořadí Tab v originálu (web: první prvek, pořadí vytvoření);
zda je dialog na obrazovce vycentrovaný (příznak 1 konstruktoru `CWindow`, web: střed).

## Hráči: barvy, jména, klávesy (krok 3d-1, hotovo)

- Barvy hráčů: tabulka `0x4aef24` (`0x413200`), osm políček bitmapy 19: zelená (8,141,0),
  lososová (207,87,87), hnědá (156,113,87), červená (215,51,8), žlutá (179,169,0), fialová
  (187,100,187), modrá (123,123,192), šedá (95,95,95). Rampa palety `0x413220`.
  Export `analysis/export_player_colors.py` → `sprites/<id>-c<0..7>-sheet.png`.
- Barva postavy (`0x41e7ee`): člověk z profilu (`0x412930`), počítač náhodně `rand·8>>15`,
  nemrtvý 7.
- Sady kláves (scan kódy DirectInput, pořadí vlevo/vpravo/nahoru/dolů/střelba/zbraň,
  tabulka `0x4ae5ec`): 0 šipky + mezerník + C; 1 S F E D + A + Q; 2 J L I K + M + N;
  3 Num 4 6 8 5 + Num 0 + Num 1.
- Profily (`0x4ae604` barva, `0x4ae60c` sada, `0x4ae614` jméno) podle počtu hráčů na
  počítači: 1 → Bulík (zelená, 0); 2 → Bulík (zelená, 1), Uzlík (hnědá, 3); 3 → Bulík
  (zelená, 1), Uzlík (hnědá, 2), Mazlík (žlutá, 3).
- Web: `dist/players.js`, engine `humans`, až 3 hráči na jedné klávesnici.

## Start hry 2: rozvržení (0x4104f0)

Okno (230,50)–(760,560). Sloupec hráče i: x0 = 34 + 130·i. `CColorSet` (bitmapa 19,
81×29, 4×2 barvy, buňka 21×16, výběr obtažen `#eeeeee`) na (x0−3, 10) jen u místního
hráče; rámeček náhledu bitmapa 27 s krytím 0x80 na (x0, 53); animace 180–183 (náhodný
směr, barva hráče) na (x0+10, 68); jméno `CEdit` (písmo 175) (x0−12, 138)–(x0+88, ·);
„Ovládání“ (příkaz 210 + i) na (x0−3, 170) jen u místního. Dále „Typ hry“ (0xda) na
(31, 208) se souhrnem, „Nastavení“ (0xec) na (400, 210), „Levely:“ (20, 244),
`CLevelList` (30, 270)–(230, 440), „Start“ (0x8002) (40, 466), „Zrušit“ (0x8003)
(140, 466), skryté „Hra je vytvořena, stiskněte Start...“ (40, 495).

## Další krok (3d-2)

Obrazovky Start hry 1 a 2 (dialogy + `CColorSet`, `CEdit` jména, seznam levelů, okno
Ovládání) místo webového formuláře.

## Nastavení (krok 3d-3, hotovo)

`CSetupDlg` (`0x40e290`): okno 290×140 na středu; text „Vyvážení: %d%% hudby a %d%% efektů“
(písmo 174, mezera 1) na (25, 20); `CVolume` (`0x40e1b0`, odvozený od `CScrollBar` `0x408370`)
(25, 42)–(270, ·), výška = výška šipky (15); rozsah −50…50 (`0x4051d0`), krok 1, stránka 20;
„Ok“ (55, 90), „Zrušit“ (155, 90).

- Text (`0x40e4e0`): hudba `50 − v` %, efekty `50 + v` %.
- Zvuk (`0x4223e0` → `0x43a5e0`): dvě skupiny útlumu v setinách dB; skupina 1 (efekty)
  `min(v,0)·50`, skupina 2 (hudba) `−max(v,0)·50`, tedy krajní poloha −25 dB. Mění se hned při
  pohybu (`0x40e5b0`, kód 7); Ok hodnotu ukládá (`+0x2fe`), jinak se vrací uložená (`0x402379`).
  Výchozí 0 (`0x40a362`).
- Při stisku posuvníku hraje ve smyčce efekt 4/30 ve skupině efektů (`0x40fb00`), po uvolnění
  se zastaví (`0x40e230`).
- `CScrollBar` kreslí (`0x403530`) levou šipku, pravou šipku a jezdec, každý ve třech stavech
  (0 běžný, 1 pod myší `0x403980`, 2 stisknutý `0x406810`); dráha jsou dvě vodorovné čáry barvou
  krytí stavu na `(výška šipky − 9)/2` a o 6 px níž; jezdec na `x0 + šířka šipky +
  (v − min)·dráha/rozsah`, o 1 px výš než čáry. Části: 1 šipka −1 (opakování po 300 ms,
  `0x4067c0`), 2/4 dráha ∓20, 3 tažení (`0x404fe0`), 5 šipka +1. Bitmapy obecného
  vodorovného posuvníku 140/136/144, 131/129/133, 141/137/145 (tabulka `0x4ae5c4`), `CVolume`
  vlastní 114/113/115 (nota), 131/129/133, 126/125/127 (reproduktor) (`0x4aea34`).
- Neověřeno: interval opakování po prvních 300 ms (web: 300 ms) a ovládání klávesnicí (web:
  šipky ±1, PageUp/PageDown ±20).
- Web: `ui/setup-dialog.js`, `ScrollBar` ve `ui/widgets.js`, `settings.balance` v
  `game-audio.js` (násobí webové hlasitosti hudby / efektů a hlášek). Kontrola v
  `verify-dialogs.mjs`.

## Pauza (krok 3d-4, hotovo)

Dialog `0x411df0`: okno 306×90 na středu, vzniká jednou s pohledem hry (`0x420423`, `+0x334`).
Text „Hra je pozastavena“ (písmo 174, mezera 2, styl 5) v obdélníku (0,12)–(306,35); tlačítka
na y = výška − 40 = 50: „Pozastav“ (0xea) a „Pokračuj“ (0xeb) obě na x = 15, „Nastavení“ (0xec)
na 112, „Konec hry“ (0x8003) na 209. V síťové hře je okno o 200 px vyšší kvůli chatu (`0x4102d0`).

- Esc ve hře (`0x41687a`, klávesa nepatří hráči) → `0x4124a0(1)`: příznak pauzy místního hráče
  (`+0x174 + 13·hráč`), síťová zpráva, zpráva 0xe9 dialogu.
- 0xe9 (`0x40b2f0`): ukáže to z dvojice Pozastav / Pokračuj, které odpovídá stavu, a přesune
  na něj fokus. První pozastavený hráč pošle 0xed → `0x41c290`: zastaví časovače, animace a
  zvuky hry, pozastaví hudbu a spustí dialog modálně; po návratu vše obnoví.
- Pokračuj nebo Esc v dialogu (`0x40ac20`) → `0x4124a0(0)`; když už nikdo nestojí, 0x80ca
  dialog zavře. Nastavení → `0x40ac50` (CSetupDlg; pozastaví, pokud ještě nebylo).
- Konec hry → 0x80cd → `0x41d5f0`: zastaví časovače hry, zahraje konec kola (efekt 17) a po jeho
  doznění pohled hry skončí s kódem 0x80cd. Potvrzení se neptá.
- Web: `ui/pause-dialog.js`; Esc, dotykové tlačítko pauzy a ztráta fokusu okna otevřou pauzu
  (hudba pauzy 331 přes `bulanci:pause`), Konec hry volá `game.finish()`. Webové tlačítko
  „Menu“ zůstává jako zkratka do menu. Kontrola ve `verify-dialogs.mjs` a `verify-mobile.mjs`.

## Statistika (krok 3d-5, hotovo)

`CScore` (`0x411010`, okno 800×600) spouští modálně `0x401c66` po skončení pohledu hry; Esc
nebo Enter ji zavře (`0x40abe0` → 0x8003). Pohled hry předtím dohraje zvuk konce kola 17
(`0x41d5f0`, 0,72 s). Obrazovka hraje vzorek 4/29 ve skupině hudby (`0x411add`).

- Pozadí bitmapa 164; titulek animace 303 na (120, 50), přehraje se jednou a stojí na
  posledním snímku (`0x4391e0`: bit 1 hraj, bit 2 smyčka).
- Hráči (počet `+0xd8`, jen lidé) řazení CRT `qsort` (`0x4483b0`) podle konečného skóre
  `0x4126e0` sestupně (`0x40abd0`). Do 8 prvků je to shortsort `0x448320` (první maximum
  na konec, nestabilní) — web ho napodobuje přesně.
- Pozice i: x = 136 / 279 / 423 / 567 (`0x4ae788`); místo p začíná 0 a roste, když má další
  hráč nižší skóre (shoda = stejné místo). Sloup bitmapa `0x4ae708[i][p]` (150; 151/152;
  153–155; 156–159) na (x, 229); bulánek animace `0x4ae748[p]` + náhodný směr 0–3 (180, 184,
  188, 192 — čím horší místo, tím obvázanější), barva hráče, na (x+33, y) s y = 240 / 270 /
  300 / 330 (`0x4ae798`); jméno (x, y−28)–(x+118, y−10); „Zabil: %dx“ y 471–486,
  „Mrtev: %dx“ y 485–500. Vše písmo 175, styl 5, mezera 1, plné krytí.
- Koho zabil: pro sloty 0–3 s počtem > 0 (záznam `+0xea + 4·oběť`) znak 0x1F v barvě oběti
  (šedá `0x5f5f5f` jako `0x2f2f2f`) na x−15 a počet na x+5, od y = 452 nahoru po 14 px.
- Sám (trénink): výsledek jde do tabulky levelu (`0x414280` → `0x409b10`): přidat, seřadit
  podle zabil − mrtev (`0x408fd0`), nechat 6. Prázdný level dostane výchozí tabulku
  (`0x409620`): Žezlík 30, Kapslík 25, Čmelík 20, Uhlík 15, Terčík 10, Cvalík 5 zabití, vždy
  10 smrtí. Když výsledek vypadne, bulánek je nejsmutnější (animace 192). Tabulka: bitmapa 149
  s krytím 0x80 na (330, 190), záhlaví Pořadí / Jméno / Zabil / Mrtev / Rozdíl (texty 0x64,
  0x66–0x69) ve sloupcích `0x4aeab0` + 330, y 191–214, řádky po 26 px; pořadí roste, když se
  změní rozdíl; plně svítí první řádek shodný s výsledkem (`0x409080`), ostatní tlumeně.
- Web: `ui/score-screen.js`, tabulky v `localStorage` (`bulanci.records`, originál je ukládá
  do souboru `0x409cd0`), klik / ťuknutí zavírá také (telefon nemá Enter). Barevné varianty
  184–195 doplnil `export_player_colors.py`. Kontrola ve `verify-dialogs.mjs`
  (`web-score-screen.png`, `web-score-training.png`) a `test/score.test.mjs`.
- Vrstva dialogů se nově vepisuje do rámu hry (dřív zůstávala 800 px i ve větším okně) a
  prázdná plocha trvalé obrazovky propouští klik na stránku.

## Načítání a Konec (krok 3d-6, hotovo)

- `CLoadingLevel` (`0x40dfb0`): okno 250×75 na středu, „Načítá se level...“ (písmo 174,
  mezera 2) na (20, 20), `CProgressBar` (20, 50)–(230, 55). Kreslení `0x40b1f0`: černý obrys
  1 px (`0x436530`), uvnitř výplň `#a0a0a0` zleva podle hodnota / maximum (`0x4365f0`). Pohled
  hry (`0x41d3e1`) posouvá pruh podle přečtených bajtů souboru levelu po 16 kB; web podle
  načtených obrázků vrstev levelu (`app.js` `loadLevel`).
- `CExitDlg` (`0x411b50`): menu Konec (`0x425970`, příkaz 0xcb) ukáže ilustraci 317, zahraje
  vzorek 25 a na obrázek menu položí okno (221, 24)–(762, 569) (necentrované): animace 305
  („www.bulanci.cz“) na (194, 22) a 306 („www.sleepteam.com“) na (313, 282), obě ve smyčce
  (`0x419940` příznak 3); text 0x138 (rozloučení SleepTeam Labs, písmo 175, mezera 2) na
  (40, 72); „Konec hry“ (0x8004) na (49, 492) ukončí program — web místo toho ukončí kolo a
  vrátí se na Start. Nahrazuje webový panel „Ukončit hru? Ano / Ne“.
- Web: `ui/loading-dialog.js`, `ui/exit-screen.js`, `ProgressBar` ve `ui/widgets.js`; kontrola
  ve `verify-menu-fullscreen.mjs` (`web-exit-screen.png`).

## Hlavní menu — scéna (krok 3d-7, hotovo)

`0x4265e0` je konstruktor `CMenu` (volá ho obsluha 0xcc v `0x4024a0`), ne samostatná obrazovka.
Okno 800×600, pozadí 315 (`assets/menu.jpg`), tlačítka 0xc9/0xca/0xcb na (35, 37/121/205), popisky
na (100, 55/139/223). Navíc:

- **Den / noc** (`0x425400`, jen při vytvoření menu): `GetLocalTime`, hodina = zabalený čas >> 25;
  noc, když `(hodina − 6) > 15` bez znaménka, tj. 22:00–5:59. Noc (`0x4252f0`): hudba 330 a bitmapa
  313 (jasnější „měsíc“ SleepTeam, 190×166) na (610, 0); den: hudba 329, 313 skrytá. Web dřív
  hádal hranici 20:00 — opraveno, `isMenuNight` v `game-audio.js`.
- **Hudba menu** (`0x4252a0`, časovač menu 120 ms `0x424080`): začíná na hlasitosti 70 a každý tik
  přidá 1 až na 100 (3,6 s); pak časovač stojí a zapnou se škrábance. Zpráva 0xf0 (hra začíná)
  stahuje po 1 zpět na 70 a hudbu pozastaví, 0xf1 (návrat do menu) znovu zesiluje. Web zatím
  hlasitost nabíhá stejně (hotovo, viz níže), škrábance startují po stejných 3,6 s.
  Převod hlasitosti (`0x43a0d0` → `0x43a060`): DirectSound dostane
  `(útlum + 10000) · hlasitost / 100 − 10000` setin dB, kde útlum je hodnota balance z tabulky
  `0x4b8370` (plněná za běhu); 70 je tedy −30 dB a náběh je lineární v dB. Web: `menuMusicGain`
  a `MENU_MUSIC` v `game-audio.js`, tiky se počítají jen při skutečně hrající stopě (zámek
  autoplay). Zjednodušení: při startu hry web stopu menu pozastaví hned (originál ji 3,6 s stahuje
  pod načítáním); po návratu do menu pokračuje od 70 jako 0xf1. Kontrola `verify-audio.mjs`,
  `test/menu-music.test.mjs`.
- **CPoemScroller** (`0x4262c0`): obdélník (10, 384)–(215, 550), písmo 175, barva `#b0b0b0`,
  mezera 1, řádkování výška buňky + 1. Texty jsou všechny zdroje typu 2043 (0x7fb, 13 básní,
  `analysis/export_poems.py` → `poems.json`): `uint32 typ, uint32 počet znaků, UTF-16`. Řádek
  začínající kódem 1 se centruje, kódem 2 zarovná vpravo (autor, mezery na konci odsazují od
  kraje), tabulátor = 4 mezery (`0x4375e0`). `0x425df0`: náhodná báseň `rand()*13>>15`, text
  vysázený do bitmapy šířky nejdelšího řádku, ta je v okně vodorovně vystředěná (`0x4240f0`);
  start pod oknem (pozice = výška okna 166). Časovač 120 ms od času vytvoření + 3000 ms; tik
  (`0x426030`) posune o 1 px nahoru, a když text celý vyjede (pozice = −výška), vybere další.
  Horních a dolních 40 řádků okna kreslí přes masky krytí 6, 12 … 240 (nahoře) a 250 … 16 (dole).
- **„Verze: 1.80“**: `CStaticText` písmo 176, mezera 1 na (230, 575).
- **CRuch** ×4 (`0x423c20`): svislá čára 1 px přes celou výšku, barva `#3f3f3f` (`0x423e60`), náhodné
  x 0–799. Skrytá čeká `rand(0..4000)` ms, pak se na 100 ms ukáže, skryje se a přeskočí na nové
  náhodné x (`0x423de0`). Časovače běží jen při aktivním menu (`0x423f70`).
- Web: `ui/menu-scene.js` (plátno pod tlačítky, noční `menu-night.jpg`), kontrola
  `verify-menu-scene.mjs` (`web-menu-scene.png`) a `test/menu-scene.test.mjs`. Rolování se při
  skrytém menu zastaví a po návratu pokračuje (originál menu během hry neruší; zda jeho časovač
  běží dál, není ověřeno).

## Zpráva a nápověda (krok 3d-8)

- **CMsgDialog** (`0x40be80`, modálně přes `0x40f2c0`): text písmem 174 s mezerou 2 na (30, 10),
  okno o 60 px širší i vyšší než text, na středu obrazovky; jedno tlačítko vodorovně na středu
  na y = výška textu + 20. Druh 0 = „Ok“ (0x8002), druh 1 = „Zrušit“ (0x8003), tabulky
  `0x4ae6f0` (texty 29/30) a `0x4ae6f8`. Volající: chybové hlášky výjimek (`0x401a9d`,
  `0x41d5cb`), síťové „Čekám na zbytek hráčů...“ (`0x4137b0`) a jediné pro místní hru:
  **Start ve Start hry 2** (`CStartGame2` vtable `0x480d4c`, slot 13 = `0x40f610`, příkaz 0x8002):
  každého hráče na tomto počítači (od `+0x36`, počet `+0x37`) porovná se všemi hráči (`+0xd8`,
  odzadu, přesně a s rozlišením velikosti písmen `0x42d3f0`); při první shodě ukáže
  'Jméno "%s" je již použito.' (text 0xdc) a hra nezačne.
  Web: `ui/msg-dialog.js`, `start-game.js`; kontrola `verify-msg-dialog.mjs`
  (`web-msg-dialog.png`) a `test/msg-dialog.test.mjs`.
- **Nápověda** (`CHelpDlg`, ctor `0x421e40`, obsluha příkazů `0x421dd0` přepíná stránky
  0xe5–0xe8 přes `0x421c10`): vzniká jen tovární funkcí `0x422280`, kterou statický
  inicializátor `0x47bea0` registruje pod číslem třídy 0x818 (`0x42e910`). Objekty podle čísla
  vytváří jen deserializace (`0x42ef00`, volaná z čtení proudu `0x42fbe5`, `0x42fd96` a ze
  zdrojů `0x434791`), a žádný zdroj ani jiný kód číslo 0x818 nepoužívá — v této verzi hry je
  nápověda nedosažitelná, web ji proto nemá.

## Historie (CHistoryDlg, 29. 10. 2026)

Okno (231,36)–(762,569) na obrázku 317. Konstruktor `0x4231d0` posbírá resources třídy 0x802 (307–309, `t2050`) jako stránky. Stránka je program stránkového VM: stejná gramatika výrazů jako skripty levelů, rozšířené opcody 0x2d–0x34 z tabulky `0x4af7ac` (registrace `0x42273a`): 0x2d popisek (x, y, text, mezery mezi písmeny, písmo; `0x406a50`), 0x2e textový blok, 0x2f bitmapa, 0x30 paleta textu, 0x31 dvojice, 0x32 bajt stylu, 0x33 vložit, 0x34 fotka s filmem (`0x4236a0`). Přepnutí stránky `0x422f70` spustí vstup 0 s argumentem 1. Ikony `CIcon` 0xe5–0xe8 na (39|56|72|91, 480): první / předchozí / další / poslední (`0x423130`), na krajích neaktivní (bit 4, krytí 0x80). Kreslení `CIcon` `0x403e40`: obrázek 0, při najetí 1, při stisku 2 (bitmapy 56/55/57, 59/58/60, 62/61/63, 65/64/66).

Fotky 116, 69, 54, 77 přehrají po kliknutí film `t76` (12291, 12289, 12295, 12293): hlavička (typ 76, velikost, 166×153/154, ?, délka ms, počet snímků, bajty zvuku, kanály, bity, frekvence), pak střídavě snímek JPEG a blok PCM. Druhé kliknutí film zastaví (`0x422630`), konec (událost 1, `0x422860`) vrátí fotku. Sudé resources náhledu (12288…) v EXE nejsou, náhledem je fotka (`0x4237b0`). Start a konec filmu pošlou menu zprávy 0xf0/0xf1 → `0x424010`: hudba menu se zastaví a pak znovu spustí.

Web: `ui/history-dialog.js`; data `analysis/decode_history_pages.py` → `assets/original/history/pages.json`, filmy `analysis/export_history_films.py` (atlas snímků + WAV). Dřívější panel s texty vytaženými z bajtů (rozsypané řetězce, duplicity) je odstraněný.

## Tlačítka hlavního menu (CMenu, 29. 10. 2026)

`0x4265e0` vytvoří tři tlačítka třídy `0x424bc0` na (35,37), (35,121), (35,205) s příkazy 0xc9–0xcb a ke každému dvě bitmapy popisku na (100,55/139/223): normální a aktivní (147/148, 67/68, 75/76, tabulka `0x4af90c`). Tlačítko je animace se dvěma klipy 212 a 213 (8 snímků, 568 ms), na začátku klip 212 snímek 0. Najetí (`0x423f20`) u nevybraného tlačítka přehraje 212 jednou se vzorkem 0 globální banky a kulička zůstane rozsvícená; odjetí (`0x423ef0`) přehraje 213. Obojí se spustí jen tehdy, když animace stojí. Výběr (`0x424d30`) přehraje 212, pokud kulička ještě nesvítí, a zprávou 0xc8 nechá dříve vybrané tlačítko přehrát 213 (`0x424dc0`). Popisky se přepínají jen výběrem: obsluha příkazu vrátí předchozí (`0x423a00`), skryje normální a ukáže aktivní popisek. Konstruktor vybere výchozí tlačítko (`0x426c95`). Klávesy (`0x424fa0`): S/H/K vyberou Start/Historii/Konec, X ukončí program (web vynechává). Web dříve kuličku točil ve smyčce a popisek měnil i při najetí.

