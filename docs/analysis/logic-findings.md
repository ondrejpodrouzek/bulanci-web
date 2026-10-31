# Rozbor původní logiky a stav webového portu

Hlavní zdroj: `bulanci_hra/bulanci.exe`, PE32 x86, image base `0x400000`. Původní program nebyl při statické analýze spouštěn. Grafika pochází z jeho extrahovaných resources, nikoli z nově kreslených náhrad. Webový engine je rekonstruovaná implementace a není zatím přesným portem původního enginu.

## Potvrzeno z EXE a dat

### Čas a herní smyčka

- `0x42e770`: `start = timeGetTime()`, globální hodnota `0x4b3bdc`; současně nuluje `0x4b3bd8`.
- `0x42e790`: zapisuje `uint32(timeGetTime() - start)` do `0x4b3bd8`.
- Volání inicializace: `0x42a305`; aktualizace: `0x42bda6`.
- Funkce `0x42bda0` aktualizuje časovač před zprávami okna (`PeekMessageW`, `TranslateMessage`, `DispatchMessageW`) a před pokračováním na `0x42bc00`.
- Nejde o důkaz pevné frekvence fyziky. Web používá prozatímní krok 1/60 s.

### Bitmapy t28

Původní první export začínal pixely o dva bajty dříve. To způsobovalo špatné barvy map. Správný začátek je offset 30.

- Prvních šest uint32: typ, šířka, výška, režim, stride, průhledný klíč.
- Režim 5: BGR24, pixely od offsetu 30; ověřeno přesnou délkou `30 + stride * height`.
- Režim 3: počet barev na offsetu 25, BGRA paleta od offsetu 30, poté indexované pixely; ověřeno přesnou délkou `30 + count * 4 + stride * height`.
- Průhlednost je u indexovaného režimu porovnáním indexu, u BGR režimu barevným klíčem; `0xffffffff` znamená nepoužitý klíč.
- Reprodukovatelný export: `analysis/extract_original_maps.py`.

### Animace t52

- Dekódováno 130 resources 177–306, celkem 2565 snímků.
- Plné RLE: rutina `0x432740`. Kladné číslo n opakuje další pixel n+1krát; nula čte uint16 délku +1; záporné číslo kopíruje -n literálů.
- Delta RLE: `0x432780`, přeskakování a přepisování oblastí předchozího snímku.
- Základní paleta: 256 BGRA položek na `0x4aeb20`; její kopírování potvrzuje reference `0x413237`.
- Barvy hráčů: rutina `0x413220` upravuje pouze rampu 112–151. Index 127 je zvolená barva. Světlá část 112–126 interpoluje od bílé; tmavá 128–151 interpoluje k černé. Web používá takto vyexportované varianty postav i rukou u zbraní.
- Původní časové údaje jsou v manifestu: například osmisnímková chůze má 378 časových jednotek, směrový zásah 31 snímků a 2201 jednotek. Jejich použití jako milisekund odpovídá WinMM časování, ale návaznost celého původního plánovače ještě není kompletně ověřená.
- Chůze: 196 dolů, 198 doleva, 200 doprava, 202 nahoru. Směr stran byl dodatečně ověřen vizuálně; protilehlé číslování z prvního pracovního odhadu se nepoužívá.
- Zásah: 204 dolů, 206 doleva, 208 doprava, 210 nahoru.
- Chunk 10 nese dvojici souřadnic. Dispatch `0x432d98` ji předává observerům přes `0x436e80`. Zatím nelze tvrdit, zda jde o pohyb kořene nebo jinou událost. Web ji proto automaticky nepřičítá k vykreslení.
- Sekundární roviny a události chunků 11–15 nejsou plně interpretované; správně dekódované barevné snímky samy o sobě neznamenají obnovení celé logiky animace.
- Export: `analysis/decode_original_sprites.py`; další důkazy: `analysis/original_sprites/README.md`.

### Mapy a původní souřadnice

Resources 319, 321 a 322 poskytují Vybíjenou, Noční směnu a Malárii. Rozpoznané záznamy jsou exportované v `analysis/original-map-records.json` včetně offsetů do původních dat.

- Záznamy `33 2e 00`: bitmapová vrstva, x, y, resource ID.
- Záznamy `33 2f 00`: souřadnice levého horního a pravého dolního rohu obdélníku.
- Záznamy `33 38 2d 00`: animovaný objekt, x, y, resource ID.
- Vybíjená: 1 obrazová vrstva, 6 obdélníků.
- Noční směna: 5 vrstev, 18 obdélníků, 1 animovaný objekt.
- Malárie: 3 vrstvy, 7 obdélníků, 8 animovaných objektů.

Jde o extrakci konkrétních pozorovaných záznamů, nikoli úplný parser skriptového formátu. Obdélníky se používají jako kolize; jejich přesné vztahy k různým typům objektů a projektilů ještě vyžadují kontrolu. Vrstvení objektů vůči postavám také není kompletně převzaté z původního rendereru.

### Třídy a zbraně

RTTI zachovalo 155 názvů tříd. Důležité jsou `CBulanek`, `CShot`, `CWeapon`, `CLevelScript`, `CMina`, `CExplosion`, `CTeleportPoint` a `CColorSet`.

- CWeapon primární vtable `0x481eec`; konstrukce `0x418ef0`, další konstruktor `0x41dbc0`.
- CWeapon `0x41dae0` je mazací destruktor; nelze ji považovat za aktualizaci zbraně.
- CShot `0x417190` je obdobně mazací destruktor.
- Tabulka šesti sad prostředků zbraní na `0x482820`, krok 28 bajtů. Konstruktor `0x41dbc0` indexuje sedm uint32 na typ a načítá čtyři směrové prostředky.
- Pistolové sprity 269–272; brokovnice 285–288; samopal 289–292: vizuální přiřazení původních snímků, směr potvrzen vzhledem spritů.
- Původní ležící zbraně jsou animace 219 a 222. Web je používá pro samopal a brokovnici.
- Přesná sémantika zbývajících polí tabulky, offsety držení zbraní a původní zásobníkový mechanismus nejsou kompletně zrekonstruované.

### Původní zvuk

- t67 udává zdrojový PCM resource a délky jednotlivých klipů.
- t43 obsahuje kanály, bitovou hloubku a vzorkovací frekvenci, PCM začíná na offsetu 16.
- Délka PCM se čte z hlavičky. U resource 338 zůstávají za deklarovanou oblastí další bajty; nejsou připojené k poslednímu zvuku.
- Exportováno 62 původních klipů skriptem `analysis/extract_original_audio.py`.
- Web přehrává původní klipy, ale jejich přiřazení ke konkrétním zbraním je zatím pracovní.

## Další reference, nikoli automaticky původní chování

Android projekt: https://github.com/JustNaxi/Bulanci . Zdrojové soubory jsou uložené mimo web v `reference-android/`. Nebyl převzat jeho Java kód ani jeho grafické soubory.

- Android Player používá čtyři směrové obrázky a zásah vede přímo k respawnu.
- Jeho GunPistol používá 4 náboje; dobový návod na přiloženém USB uvádí 5.
- Jeho GunShotgun generuje 4 projektily; dobový návod uvádí 5 broků.
- Proto se jeho konstanty nepovažují za autoritativní pro Windows verzi.
- Dobový návod: `USB_dump/USB_dump/Bulanci/Recenze/Abeceda her - návod.htm`. Uvádí pistoli 5 nábojů, brokovnici 4 rány po 5 brocích, samopal 4 zásobníky po 4 nábojích. U tréninku popisuje stojící počítačové soupeře.

## Co nyní běží ve webu

Původní bitmapové menu a HUD, pět složených map (Vybíjená, Noční směna, Malárie, Na dobrou noc, Exitus), původní směrové animace chůze a zásahu, animované zbraně v rukou, původní grafika sbíratelných zbraní, munice, automatické nabíjení pistole, bodování, časový limit, trénink a dva lokální hráči. Sbírání zbraně se aktivuje přechodem přes její polohu; automaticky ji vybaví a doplní munici.

## Co je stále provizorní

- Rychlost postavy 125 px/s a prodlevy střelby/přebíjení (rychlost střel už je 800 px/s z EXE).
- Délka návratu po zásahu. (Kolizní maska postavy je nově obdélník `[2,25,53,62]` z `CBulanek` ctoru `0x41e963`, používá se pro zdi, kolizi hráč-hráč i zásahy — viz `weapons-re.md`.)
- Původní animací řízený pohyb a body držení zbraně.
- Samopal aktuálně střílí jednotlivé automatické rány s celkem 16 náboji; mechanismus čtyř zásobníků není přesný.
- Umístění, četnost a osmivteřinové obnovení sebraných zbraní jsou pracovní implementace; nepovažují se za extrahované původní spawnování.
- Tréninková AI a rotace protivníků.
- Raketomet, miny, power-upy, roury, teleporty, skriptovaní tvorové a síťová hra zatím nejsou implementované v herní logice webu.
- Mapy Na dobrou noc a Exitus mají přenesené pozadí, kulisu a kolize (viz `level-scripts-re.md`); skriptovaní tvorové a náhodné A/B rozmístění Na dobrou noc jsou extrahované v `level-facts.json`, ale ve webu zatím nejsou simulované. Mapa 8-bit čeká na export základních bitmap z EXE.
- Držení zbraní ve webu používá odhadnuté offsety, nikoli per-snímkové kotvy z `weapon-anchors-re.json`.

## Kontroly

Automatické testy ověřují překážky, zastavení střely zdí, zásah bez vícenásobného přičtení bodu, sbírání zbraně, vyprázdnění a přebití pistole a konec kola. Kontrola v prohlížeči ověřuje Start, všechny tři mapy, pohyb/střelbu, pauzu/návrat, lokální režim a dostupnost stránky se stavem. Tyto kontroly ověřují funkčnost nové implementace, nikoli shodu s Windows EXE.
