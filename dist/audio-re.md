# Původní audio: přiřazení a napojení webu

Zdroj: `bulanci_hra/bulanci.exe`, resources t48/t43/t67. Extrakce je statická, hra se nespouštěla. Původní MP3 stream začíná na offsetu **20**, nikoli 16; starší export obsahoval navíc DWORD se vzorkovací frekvencí. Opravené soubory jsou v `web/dist/assets/original/music/`.

## Hudba

Přiřazení čte `analysis/recover_audio_catalog.py` přímo z dekódovaných instrukcí `set_audio` v šesti původních skriptech. Neodvozuje se z názvu souboru.

| Level / obrazovka | MP3 resource | Další zvuková banka |
|---|---:|---:|
| Vybíjená | 325 | žádná |
| Na dobrou noc | 332 | 1 |
| Noční směna | 327 | 2 |
| Malárie | 333 | žádná |
| V zajetí 8-bitu | 328 | 0 |
| Exitus | 326 | žádná |
| Menu den | 329 | — |
| Menu noc | 330 | — |
| Pauza | 331 | — |

Menu resources jsou přímo použité na `0x425301` a `0x42531a`, pauza na `0x420148`. Automatická volba den/noc v prohlížeči používá hodiny počítače (noc 20–6); původní práh přepnutí nebyl potvrzen. Po pauze pokračuje hudba levelu z původní pozice, nová hra začíná skladbu od začátku.

## Efekty a hlasy

Globální banka je resource **4**, nikoli banka 0: inicializace `0x402b65` načítá `0x10004` a zapisuje ji do `CBulanci+0x4c0`; `0x422430` ji používá pro nulový argument banky.

| Událost | Banka / sample | Důkaz |
|---|---|---|
| Pistole | 4 / 21 | příznak výstřelu 0x10, `0x41f303` |
| Brokovnice | 4 / 13 | příznak 0x20, `0x41f2fc` |
| Samopal | 4 / 19 | příznak 0x40, `0x41f2f5` |
| Dokončené nabití | 4 / 16 | `0x4175b8` |
| Konec kola | 4 / 17 | `0x41d64c` |
| Sebrání | 4 / 18 | `0x419d99` |
| Zásah / smrt | 4 / 23 | `0x41f9a5` |
| Zásah raketou | 4 / 22 | `0x41f9b3` |
| Teleport | 4 / 36 | `0x41db6c` |
| Exploze | 3 / 1 | `0x41cf4c..0x41cf65`, level banka `0x4b3730` inicializovaná resource3 |

Pozor: dřívější přiřazení samopalu k sample7 by přehrávalo hlas! Specializované střely NPC používají jiné banky a nesmějí se zaměňovat s výstřelem hráče.

Čtyři původní hlasové profily:

- Návrat / objevení: `[1,4,7,10]`, tabulka `0x4aef98`, funkce `0x416670`.
- Hláška po zásahu: `[3,6,9,12]`, tabulka `0x4aefa8`, funkce `0x416690`.
- Další hláška: `[2,5,8,11]`, tabulka `0x4aef88`, funkce `0x4166b0`.

V původním kódu se hláška po zásahu spouští po dokončení efektu zásahu; web dodržuje toto pořadí pomocí konce zvukového bufferu. Profil je možné předat přes `player.voiceSet` / `voiceProfile`; při absenci používá web pořadí hráče. Vyvolávání všech volitelných hlášek a NPC efektů závisí na událostech, které engine emituje. Audio API je podporuje; chybějící logika tvorů se tím sama nenahrazuje.

Prostorové rozložení: `0x422500` počítá `clamp(xCenter,0,800)*3000/800-1500` v setinách dB. Web používá stejný útlum příslušného stereo kanálu.

## Souběžná práce

`app.js` ani `engine.js` se kvůli této změně neupravují. Modul `audio-bridge.js` obaluje existující `Game.update` a callback `onEvent`; změny stavů návratu/nabíjení sleduje bez zásahu do fyziky. Starý handler provizorních zvuků v app.js zůstává ztlumený tím, že audio přebírá tlačítko `#sound`.

Samostatné soubory a veřejné API jsou popsané v `AUDIO-INTEGRATION.md`. Při publikaci se používá oddělený checkout z poslední publikované verze, aby se do nasazení nedostaly cizí rozpracované změny.

## Ověření

`web/verify-audio.mjs`: skutečný Chromium/Chrome/Edge dekódoval všech 9 skladeb a 62 PCM klipů; hudba všech 5 aktuálně dostupných map, hudba pauzy, návrat, vypnutí zvuku a uložení hlasitosti prošly bez chyb a HTTP404.

`web/verify-menu-fullscreen.mjs`: navigace menu, historie, hlasitost v menu, Start, návrat z fullscreen a poměr4:3 ověřené při1920×1080,1920×1200,1280×1024,1366×768 a390×844.

## Menu a fullscreen

Původní menu má rozměr800×600. Konstruktor `0x4267xx` vytváří kruhová tlačítka212/213 na(35,37),(35,121),(35,205); popisky jsou na(100,55),(100,139),(100,223), resources147/148,67/68,75/76. Pozadí315, ilustrace316/317/318 kotvené v pravém dolním rohu (`0x425870`:800−šířka,600−výška). Tyto hodnoty používá nový samostatný modulmenu.

Historie čerpá textové literály přímo z původních resources307–309. Výběry nastavení hry používají funkční webové ovládací prvky pro režimy dostupné v aktuálním enginu; nejsou úplnou implementací všech původních dialogů a typografie. Vzhled navigace a grafika jsou původní, nelze zatím tvrdit úplnou shodu každého dialogu1:1.

Fullscreen používá nativníFullscreenAPI s poměrem4:3 a černými okraji. Celé menu i HUD zůstávají v obraze. Alternativou při odmítnutíAPI je vyplnění okna prohlížeče. Alt+Enter přepíná režim; podporované je i běžné tlačítko a vlastní návrat ve fullscreen. Rozlišení monitoru nemění souřadnice map ani fyziku.


## Oprava samopalu po ověření původních typů (28. 10. 2026)

Samopal je původní typ4; animace 285–288 spouští čtyři střely v 71, 213, 355 a 497 ms. První tři používají banku3/sample3, poslední banku3/sample4. Banka4/sample19 je zvuk prázdné pistole. Raketomet typu5 používá banku3/sample7. Případné starší přiřazení sample19 k samopalu v tomto dokumentu je překonané tímto nálezem. Nemrtví Exitu používají stejný samopal; jejich flag smrti0x80 vynechává lidský zvuk smrti a hlas.
