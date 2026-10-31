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
- Dobový návod: Abeceda her, návod. Uvádí pistoli 5 nábojů, brokovnici 4 rány po 5 brocích, samopal 4 zásobníky po 4 nábojích. U tréninku popisuje stojící počítačové soupeře.

## Co nyní běží ve webu

Původní bitmapové menu a HUD, tři složené mapy, původní směrové animace chůze a zásahu, animované zbraně v rukou, původní grafika sbíratelných zbraní, munice, automatické nabíjení pistole, bodování, časový limit, trénink a dva lokální hráči. Sbírání zbraně se aktivuje přechodem přes její polohu; automaticky ji vybaví a doplní munici.

## Co je stále provizorní (aktualizováno 29. 10. 2026)

Hotové položky z dřívějšího seznamu (rychlost a kroky postavy, kolizní obdélník, délka smrti, samopal, sbíratelné zbraně, trénink, raketomet, miny, power-upy, roury, teleporty, tvorové, rozmístění Na dobrou noc, mapa 8-bit) jsou popsané v aktualizacích níže. Zbývá:

- Vzhled: menu na dotykových zařízeních, síťové dialogy (jen jako vzhledová reference).
- Síťová hra: první verze hotová (viz níže); pauza, chat během hry a odpojení hráče v průběhu hry zatím zjednodušené.

## Kontroly

Automatické testy ověřují překážky, zastavení střely zdí, zásah bez vícenásobného přičtení bodu, sbírání zbraně, vyprázdnění a přebití pistole a konec kola. Kontrola v prohlížeči ověřuje Start, všechny tři mapy, pohyb/střelbu, pauzu/návrat, lokální režim a dostupnost stránky se stavem. Tyto kontroly ověřují funkčnost nové implementace, nikoli shodu s Windows EXE.


## Aktualizace 28. 10. 2026: Na dobrou noc a zbraně

Původní stavy králíka, myši, pokládání a aktivace min i přerušování dávky samopalu jsou nyní propojené s hrou. Starší odhady v předchozích oddílech nahrazují [aktuální rozbor](bedtime-re.md) a [rozbor min](mines-re.md). Kontroly zahrnují43testů simulace a skutečné vykreslení i zvuky v prohlížeči.

## Aktualizace 28. 10. 2026: brokovnice podle EXE

Dřívější webová aproximace (pět samostatných střel v pevném rozestupu 7 px) je nahrazena původním mechanismem:

- Fire funkce `0x41fdf0` vytváří **jedinou** střelu: `CShot` konstruktorem `0x41edf0` s druhem 1 a bitmapou 23–26 (9×6, resp. 6×9 px).
- Konstruktor nastaví masku broků `shot+0xa7 = 0x1f` (`0x41ef0c`), tedy pět broků. Náhodný příčný posun −4..4 dostávají jen druhy ≥ 3 (samopal), brokovnice ne.
- Časovač `0x419b40` posune obdélník střely o 40 px ve směru letu a u druhu 1 ho zároveň rozšíří o 5 px na obě kolmé strany.
- `0x417b30` počítá obdélník broku i: kolmý počátek `okraj + trunc((rozměr obdélníku − rozměr bitmapy)·i/4)`, rozměr bitmapy; podél směru letu celý obdélník. Na začátku tak všech pět broků leží na sobě a pak se rovnoměrně rozevírají (sklon krajních broků 5:40).
- Update `0x41df60` testuje každý živý brok zvlášť od starého k novému obdélníku (`0x41de60`). Zasažený brok se z masky odstraní (`0x41e016`); střela zaniká až s prázdnou maskou. Jeden výstřel tak může zasáhnout víc cílů.
- U vodorovných směrů se navíc snižuje hloubka vykreslení spritu (`0x418fe0`, `shot+0x6c`: 15, 10, 5, …). Na hratelnost to vliv nemá; web ji nepoužívá.

Testy: `test/shotgun.test.mjs`. Snímek: `analysis/web-shotgun-original-spread.png`.

## Aktualizace 28. 10. 2026: tréninkoví soupeři podle EXE

Dobové zdroje (návod: „Počítač se sice nehýbe“; recenze Gamez: „nijak nepronásleduje, ale vystřelí po vás jen pokud se dostanete do nějaké jeho osy“) potvrzuje kód:

- Start hry `0x4205a0`: bulánek pro každého hráče; pokud je hráč jen jeden (`config+0xd8 == 1`), smyčka vytvoří počítače s ID `0x7d`–`0x7f` přes `0x420530` → `0x41f500(id,-1,1,100,0)`: rychlost 100, počáteční zbraň 0 (pistole).
- Konstruktor `0x41e4b0`: ID > 3 nastaví `+0x199 = 1` a vytvoří čtyři senzory `0x41b420` sahající k okrajům bojiště (`0x41fb90`: 0/799/0/515).
- `0x417500`: pro `+0x199` nebo ID ≥ 4 se munice neodečítá, pistole se tedy ani nepřebíjí.
- Bez pohybu: bloumací timer4 (`0x420bf6`, `0x4172d0`) běží jen pro ID 0x20–0x27 (`0x416490`).
- Vstup do senzoru (`0x421047`): zpráva se uloží do `+0x188` ještě před testem viditelnosti `0x4194b0`/`0x4192b0`; při viditelnosti se bot otočí (`0x4197b0`) a spustí jednorázový timer1 s periodou `rand(0..3)·500 ms` (`0x40ace0(0,3)`, `0x42110c`). Senzor zůstává obsazený do opuštění.
- Opuštění kteréhokoli senzoru (`0x421133`) timer1 zruší a `+0x188` vynuluje.
- Timer1 (`0x4208c0`) vystřelí jen při nečinné zbrani.
- Timer s příznakem 2 bez bitu 4 je jednorázový: obsluha `0x42eb30` po spuštění uvolní záznam, opakuje jen při `flags & 4`.
- Masky senzorů obsahují jen sloty 0–3 (`0x4194b0`: `mask & 0xf`), tedy lidské hráče; počítače ani nemrtví po sobě navzájem nereagují.
- Respawn `0x41f770`: ID > 3 dostane zbraň `rand·101>>15 < 10` → brokovnice s pravděpodobností 10/101, jinak pistole (`0x41ea90`).

Oprava nemrtvých: jejich timer1 je také jednorázový (`0x4210bf`, příznak 2). Dříve web opakoval dávku každých 500 ms; nyní vystřelí 500 ms po vstupu do osy a znovu až po 2s kontrole senzorů (timer4 `0x420c30`). Nemrtví také už nevidí tréninkové soupeře.

Zbývá: přesné pořadí zpráv při současném vstupu do více senzorů (web bere nejnižší směr) a spawn počítače vůči hráči (`0x41a140` volí náhodné volné místo na celém bojišti, web stejně).

Kód: `training.js`, `exitus.js` (`sensorSees`, `sensorMasks`). Testy: `test/training.test.mjs`.

## Aktualizace 28. 10. 2026: power-upy podle EXE

Návod: oko = neviditelnost, hodiny = pár vteřin času, náboj = neomezené náboje, štít = nesmrtelnost. V EXE:

- Jen ve hře jednoho hráče (`0x42031b`, `config+0xd8 == 1`): načtou se animace 293 (oko), 294 (štít), 221 (náboj), 220 (hodiny) do slotů `+0x324..+0x330`; `CSpells` je jen panel HUD.
- Cyklus timeru0 herního objektu (`0x417c80`, stav `+0x33c`): stav 0 = 25 000 ms, poté `0x41b500` vybere `rand·256>>15>>6` (každý druh 1/4) a umístí ho `0x41b390` → `0x41a140` (náhodné volné místo); stav 1 = 10 000 ms, pak `0x419e40` vše skryje a cyklus začne znovu.
- Sebrání `0x41f0c0`: překryv kolizního obdélníku kterékoli živé postavy s předmětem → `0x41a020`: odebrání, zvuk (globální banka, první hráč 32/35/33/31 podle druhu, ostatní 34), restart 25s odpočtu.
- Efekt `0x414550`: hodiny – člověk (ID < 3) +15 s, jinak −15 s (minimálně 1 s); oko/štít/náboj – 20 000 ms (`0x4145c4`), opakované sebrání restartuje časovač. Zpráva `0xee` nastaví `+0x198` (oko), `+0x19a` (štít), `+0x199` (náboj); `0xef` je ruší.
- Štít: zpráva smrti `0x420d7a` je ignorována při `+0x19a`.
- Náboj: `+0x199` je tentýž příznak jako u počítačů, `0x417500` munici neodečte.
- Oko: vykreslení `0x417640` postavu ostatním vynechá; lokální hráč v jednom hráči se vidí slabě aditivně (`0x303030`). Senzorové oblasti bez příznaku 2 neviditelnou postavu nezaznamenají (`0x417dfd`) – boti ani nemrtví ji nevidí; miny (příznaky 0x0a) ano.

Web: `powerups.js`; testy `test/powerups.test.mjs`; snímek `analysis/web-powerups.png`. Neověřeno: vzhled panelu `CSpells` v HUD (web ukazuje jen hlášku) a chování senzorů myši v Na dobrou noc vůči neviditelnému.

## Aktualizace 28. 10. 2026: teleport tréninkových soupeřů

Návod: počítač „se Vám mazaně objeví za zády“. V EXE se teleportují jen počítače (v hratelných mapách; jediný skriptový teleport, opcode `0x55` → `0x41e430`, používá mapa 8-bit 323):

- Funkce `0x41db00(x,y,příznak)` → `0x41d090`: při x = −1 náhodné volné místo (`0x41a140`), dva objekty `CTeleportPoint` (`0x41c9a0`, animace 304 vycentrovaná na obdélník postavy) na starém a novém místě, zvuk 4/36, `+0x16a = 1`, restart timeru2.
- Timer2 (příznaky 7, opakovaný): `0x417260` při respawnu a po teleportu nastaví periodu `(rand(0..10)+5)·1000 ms`; obsluha `0x420bc6` teleportuje jen při nečinné zbrani.
- Konec animace zbraně (`0x4212b0`, událost `0xffff`): počítač, který se v tomtéž callbacku ještě neteleportoval, se teleportuje s pravděpodobností `rand(0..99) < 40`; nemrtví místo toho volají rozhodnutí o pohybu `0x420a90`.
- `+0x16a` blokuje otočení `0x4197b0`, a tím i odezvu senzoru; nuluje ho konec jednorázové animace na starém místě (`0x41fed0`, 497·6/7 = 426 ms) nebo smrt (`0x41fad7`).

Web: `training.js` (`teleport`, `armTeleport`, `trainingWeaponEnded`), `app.js` vykresluje animaci 304. Testy v `test/training.test.mjs`, snímek `analysis/web-teleport.png`. Přiblížení: pořadí vykreslení efektu (hloubka −11) je ve webu vždy nad postavami.

## Aktualizace 28. 10. 2026: mapa „V zajetí 8-bitu“ (skript 323)

**Bitmapy.** Podklady 93, 94, 95, 100, 101, 105 a střely 96–99 používají režimy t28, které starý export neznal: režim 1 = 2 bity na pixel (nejvyšší dvojice první), režim 2 = 4 bity (vyšší nibble první), paleta `count` BGRA od offsetu 30, index = klíč je průhledný. Za indexy může následovat 8bitová alfa rovina `w·h` (skleněná krychle 95, sloupek 94). Ověřeno přesnou délkou souborů. Export: `analysis/export_8bit_assets.py`.

**Scéna** (323:0x14d–0x375): podlaha 100, kulisy 95/101/93/94 se skriptovým z, čtyři pevné překážky. Objekty:

| Objekt | Animace | Tělo / callback | Chování |
|---|---|---|---|
| 10 | 254 | 11 | 9 zásahů, stupeň = zásahy/3 (0x71b) |
| 16 (klec) | 255 | 17 | 2 zásahy, stupeň = zásah (0x77a) |
| 12 | 256 | 13 | 4 zásahy, stupeň = zásahy/2 (0x7bc) |
| 14 | 257 | 15 | 4 zásahy, stupeň = zásahy/2 (0x81b) |
| 9 (tvor) | 259,262,260,263,258,261 | 18 tělo, 19 zranitelné | viz níže |
| 20 (pozůstatky) | 264 | — | po smrti tvora |

Změna stupně: `native_58(obj, starý stupeň)` + `native_50` přehraje animaci od snímku stupně; callback (entry 3, 0x4bc) volá `native_40` a zastaví ji na další události chunk 12 (254: snímky 1, 2; ostatní: 1) nebo na posledním snímku. Po posledním zásahu callback odstraní tělo a dá objektu z −120 (leží na zemi). Zvuky `object_event(k)` = banka levelu 0, vzorek k: zásah 3, zničení 4.

**Tvor v kleci** (objekt 9): timer0 3000 ms (0x49a) → 0x935: s pravděpodobností 1/3, jen když je klec rozbitá (`g6 ≥ 2`), tvor nehraje animaci (`native_57`) a v kleci nikdo nestojí (`g7 = 0`). Volba stavu podle regionů: pravý pruh (g9) → 1/4 útok doprava (stav 4), jinak vykouknutí 0; dolní pruh (g8) → 1/4 útok dolů (5), jinak 1; nikdo → vystavení 2/3; někdo nad klecí nebo oba pruhy → 0/1. Vstup do pruhu (0xbd6) s pravděpodobností 1/2 vyvolá okamžitě útok (stav 4+strana), před rozbitím klece jen vykouknutí. Stav 0xb55 zapne tělo 18. Události: 0 → zranitelné tělo 19 místo 18, poslední (2 u útoků, 1 u vystavení) → zpět 18, 1 u útoků → výstřel `native_62` z (260,96) doprava nebo (221,136) dolů, vlastník 9, 8bitová střela 97/98/99/96, zvuk 0. Konec → tělo 18 pryč. Zásah těla 19 (0x87a): zvuk 1; osmý zásah zabije tvora (zvuk 2, skrytí, pozůstatky 264, po jejich dohrání z −120 a žádné tělo).

**Teleportační plošinky** (regiony 0–2, příznaky 6 = lidé, i neviditelní; ne počítače): vstup (0xc5f) → 0xa89 zkusí jednu ze dvou ostatních plošinek (pořadí 5/11), `try_move` = opcode 0x55 → 0x41e430 → teleport 0x41db00 na zadaný levý horní roh kolizního obdélníku (40,195)/(452,77)/(704,387); obsazené místo selže a zkusí se druhé. Příchod na cílovou plošinku teleport neopakuje díky zámku `+0x16a`. Regiony: příznak 8 = počítají se i počítače, 2 = i neviditelní (`0x417dd0`).

Web: `eightbit.js`; testy `test/eightbit.test.mjs`; snímek `analysis/web-8bit-creature.png`. Pozadí okna 105 (rám automatu) web nevykresluje, stejně jako u ostatních map. Síťové větve skriptu (`native_4d`, 0x25–0x2a, 0x4b) se v lokální hře neprovádějí.

## Aktualizace 28. 10. 2026: zánik střely

`CShot` nemá dobu života. Kolizní test `0x41de60` (čtyři mezikroky každého 40px posunu) končí střelu při zásahu, nebo když nový obdélník překročí bojiště: levý/horní okraj < 0, pravý > 799 (`0x31f`), dolní > 515 (`0x203`). U brokovnice jde tento test pro každý brok zvlášť, takže broky mimo pole vypadávají z masky jednotlivě. Dřívější webový odhad 1,5 s je odstraněn.

## Aktualizace 28. 10. 2026: panel aktivních power-upů (CSpells)

`CSpells` (vtable `0x483acc`, třída `0x80d`, konstruktor `0x427d40`) vzniká pro každého hráče v konstruktoru HUD `0x4280f0` na pozici (X panelu + 6, 41) uvnitř lišty 117 (y = 495). X panelů hráčů je tabulka `0x4af924` = 12, 149, 556, 693 (web dříve používal odhad 12/155/525/686). Kreslení `0x4278c0` pro každý aktivní bit (0 oko, 1 štít, 2 náboj; zprávy `0xee`/`0xef`) zkopíruje z bitmapy 78 výřez na tutéž relativní pozici: oko x 25–36, štít 0–11, náboj 13–23, výška 14. Snímek `analysis/web-hud-spells.png`.

## Aktualizace 28. 10. 2026: střelba na stisk a hloubka střel

**Střelba na stisk.** Vstup hráče (`0x416020`) projde šest kláves; `0x4121a0` porovná stav DirectInputu s předchozím snímkem a vrátí 0 beze změny, 1 stisk, 2 puštění. Příkaz 4 (střelba) se tak posílá jen při stisku a `0x4208c0` vystřelí, jen když je zbraň v tu chvíli nečinná. Držená klávesa neopakuje. Web dřív střílel při držení dokola, takže otočení během běhu (které ruší animaci zbraně) hned vystřelilo znovu opačným směrem.

**Hloubka střel.** `CShot` je objekt scény s hloubkou 15 (`0x41ef02` → `0x418fe0`), vodorovná brokovnice −5 za krok. Web ji nově řadí s postavami a kulisami (klíč = spodní hrana + hloubka), takže střela v domečku-muchomůrce zmizí pod kloboukem a vyletí okénkem ven, místo aby se kreslila přes střechu. Kolize domečku jsou jen dvě skriptové (`320:0x21b` základna, `0x239` pás pod střechou), místnost mezi nimi je zleva i zprava průstřelná („Chaloupka je průstřelná z obou stran“, dobový návod).

## Aktualizace 28. 10. 2026: vykreslování ve FullHD/4K

Logický snímek zůstává původních 800×600 (bojiště 800×515 + HUD). Buffer canvasu nově sleduje skutečnou velikost na obrazovce × devicePixelRatio (do 6×), kreslí se s transformací na logické souřadnice (`dist/display.js`). Text a HUD jsou ostré, původní bitmapy se zvětšují až při kreslení: vyhlazeně, nebo s ostrými pixely (tlačítko „Obraz“, uloženo v prohlížeči). Assets se nemění. Ověření `verify-display.mjs` (1920×1080, 3840×2160, 1280×720 @2×).

## Aktualizace 28. 10. 2026: typy hry (na zásahy / na čas / na životy)

Zdroj: dialog `CGameTypeDlg` (`0x40d930`), objekt pravidel `CBulanci+0x284` (konstruktor `0x414a80`), tabulka textů `0x4af9bc` (indexy 49–61, 93–96).

- Uložené nastavení (14 B od `+0x87`, čtené z registru `Software\SleepTeam\Bulanci` v `0x40a440`): typ (0 zásahy, 1 čas, 2 životy), příznak `+0x88`, limity `+0x89 + typ·4`. Bez uloženého nastavení `0x40a290`: typ 1, **zásahy 30, čas 180 s, životy 30**.
- Rozsahy polí v dialogu (`0x407d50`): zásahy 5–999, čas 10–9999 s, životy 5–999.
- **Trénink** (jeden hráč, `config+0xd8 == 1`, `0x4136df`): vždy „na čas“, 150 s.
- Hodiny se spouštějí jen u typu „na čas“ (`0x41c185` → `0x4129c0`).
- Body na liště (`0x412680`): zásahy = počet zásahů; čas = zásahy − smrti; životy = limit − smrti.
- Zásah (`0x420dd6` → `0x4180e0`) se počítá, je-li oběť bulánek (třída `0x7ec`); „na zásahy“ končí, když vedoucí člověk dosáhne limitu (zpráva `0x80cc`).
- Smrt (`0x41f350` → `0x4128a0`): „na životy“ při dosažení limitu zapíše pořadí vyřazení; vyřazený se po animaci smrti už neobnoví (`0x417abd`); hra končí, když zbývá nejvýš jeden člověk.
- Pořadí (`0x4126e0`): podle bodů, vyřazení podle toho, jak pozdě vypadli. Výsledky používají původní texty „Zabil: %dx“ a „Mrtev: %dx“.
- Neověřeno: význam příznaku `+0x88` (výchozí 1, v tréninku vynucen 1, mění stav hry `+0x368` na 6) a zobrazení středu lišty u typů bez hodin (web ho nechává prázdný).

Web: `dist/rules.js`, menu „Typ hry“ s limitem; testy `test/rules.test.mjs`.

## Aktualizace 28. 10. 2026: spawn zbraní

Nahrazuje dřívější pracovní implementaci (čtyři zbraně od startu, návrat po 8 s, sebrání do 22 px od středu).

- Příznak nastavení `+0x88` („všechny zbraně“, výchozí 1, v tréninku vynucen) dává `hra+0x368 = 6`, jinak 2 (`0x420117`).
- Timer1 herního objektu (`0x41c1f6`) se vytvoří jen při `+0x368 > 2`: opakovaně po **5000 ms**, v tréninku po **10 000 ms**. Na začátku kola nic neleží.
- Tik (`0x41f083`): `rand·101 < 80`, pak volba `0x41e350`: `r = floor(rand·125)/25 + 1`, `r ≥ 3` → `r + 1` (bez detonátoru). Výsledek brokovnice / mina / samopal / raketomet / nic, každý 1/5; leží-li už brokovnice, padne samopal.
- Sloty (`0x41e2c0`): brokovnice jediná (`0x64`), ostatní první volný z `0x65`–`0x6b` (nejvýš 7). Umístění `0x41b390` → `0x41a140` (náhodné volné místo).
- Sebrání (`0x41f0c0`): překryv kolizního obdélníku postavy s obdélníkem animace 179/268/222/219 (52×24, 25×26, 52×22, 52×31); sbírá každá postava řízená tímto počítačem (`0x416720`), tedy i boti a nemrtví. `0x41eba0`: předmět zmizí natrvalo; mina +1 do 4, ostatní kapacita z `0x481a60` [5,4,4,1,4,2] a výběr zbraně (`0x41ea90`, u nemrtvých bez účinku).
- **Oprava:** příznak `+0x88` je „Mód zbraní“ (texty `0x1b0`–`0x1b8`): 1 = **všechny zbraně**, 0 = **pouze brokovnice**. Režim „jen pistole“ originál nemá. V režimu „pouze brokovnice“ (`+0x368 = 2`) neběží timer1; na začátku hry (ne v tréninku) se položí jediná brokovnice (`0x4202f6` → `0x41f1d0`), sebrání nastaví hráči `+0x16b` (`0x41ec48`) a brokovnice se vrátí na mapu, když ji držitel vystřílí (konec animace, `0x42151c`) nebo zemře (`0x41fb3a`). Trénink vynucuje všechny zbraně.
- Smrt člověka (`0x41f900`, postava bez senzorů): návrat k pistoli, munice typů 1–5 = 0, **náboje pistole zůstávají** i po respawnu.

Web: `dist/pickups.js`; testy `test/pickups.test.mjs`. Kontrola `verify-audio.mjs` nyní střílí stisky (střelba se v originálu spouští stiskem, ne držením).

## Aktualizace 29. 10. 2026: animace scény a vítr v Malárii

**Příznaky animace.** `create_animation` (opcode `0x2d`, handler `0x41d6e0`) čte po x, y ještě bajt příznaků, který dřívější dekodér nevypisoval. `0x4391e0` ho uloží do `anim+0xc`: bit 0 hraje, bit 1 smyčka. Vybíjená (DJ 216/217) a kouř Noční směny 244 mají 3 (smyčka), všech osm animací Malárie i objekt 245 Noční směny mají 0, tedy stojí na snímku 0. Kouř 244 na (701,180) ve vrstvě 0 web dříve vůbec nekreslil; DJ je ve vrstvě 0, tedy pod postavami.

**Přehrání jednou.** Nativ `0x50` (`0x416dc0` → `0x4390d0`) s parametrem 0 nastaví „hraje“ bez smyčky. Časovač snímků `0x439b90` ukáže snímek podle čítače, posune ho a při přetečení na 0 bez smyčky zastaví; zůstane vidět poslední snímek. Snímek k trvá ⌊(k+1)·D/N⌋ − ⌊k·D/N⌋ ms (`0x4399b0`).

**Malárie (322).** Blok `0x93` volá `timer_create(0, rand(0..10)·1000 + 5000, 6)`. Třetí argument jsou příznaky časovače, ne callback: 2 = start teď, 4 = opakovat se stejnou periodou (plánovač `0x42eb30`). Všechny časovače skriptu volají vstup 6 (blok `0x284`), který přehraje objekty 6–13, tedy všech osm animací naráz: poryv větru v listí a kapradí každých 5–15 s (perioda se losuje jednou za level). Pořadí vykreslení vrstvy 2 odpovídá pořadí vložení ve skriptu (objekt 13 nad bitmapou 92).

Web: `dist/scene-anims.js`, data `analysis/patch_scene_animations.py` → `maps.json` (`flags`, `layer`, `frames`, `duration_ms`); testy `test/scene-anims.test.mjs`.

**Jeřáb v Noční směně (321).** Objekt 6 = animace 245 (120 snímků, 8591 ms), jeřáb s bednou. Časovače skriptu: `0x42f210` (příznak 1 = pozastaven s počítadlem 1), nativ `0x45` obnoví (počítadlo −1, při 0 start = teď), `0x46` pozastaví, `0x48` nastaví periodu. Vstup 10 volá start kola (`0x41c140`), vstup 3 je událost animace (`0x418260`: id objektu, hodnota chunku 12; zastavení běžící animace v `0x439840` posílá 0xffff). Průběh:
- start kola → `0x565`: perioda 30 000 + rand(0..6)·5000 ms, obnovit časovač 0;
- výstřel časovače → `0x6f6`: přehrát jeřáb jednou, `object_event(0,255)` = vzorek 0 banky levelu bez pozice (`0x418000`), pozastavit časovač;
- snímek 60, událost 0 (bedna v peci, mimo obraz vpravo) → `native_40` jeřáb zastaví; jeho 0xffff znovu vstoupí do `0x565` a časovač obnoví, hned potom `native_48(0,10000)`: jeřáb tam visí 10 s;
- další výstřel jeřáb rozjede dál nahoru a pozastaví časovač; poslední snímek → 0xffff → další čekání 30–60 s.
Pohyb jeřábu je z chunků 10 (posun objektu za každý zobrazený snímek, observer `0x436e80`).

**Žádná ochrana po spawnu.** Respawn `0x41f770` postavu jen zviditelní (`0x42c990`, bit 1 v `+0x44`), postaví na místo (`0x41a140`), natočí (`0x4197b0`) a přehraje zvuk; žádný časovač nesmrtelnosti ani zákazu střelby. Střelba `0x4208c0` vyžaduje jen viditelnou postavu a nečinnou animaci zbraně. Web dříve po spawnu blokoval střelbu na 0,5 s; nyní ne (test v `test/game.test.mjs`).

**Světla Vybíjené (319).** Skript končí `native_34(2)` + `create_bitmap(0,0)` res 21. Je to t28 v režimu 0 (1 bit na pixel, stride = šířka/8), paleta s jedinou černou barvou a 8bitový alfa kanál (délka 30 + 4 + 51 500 + 412 000 B sedí přesně). Vrstva leží nad vším včetně postav: parket je tmavý mimo kužely reflektorů. Web ji dříve vynechával; export `analysis/export_disco_light.py`.

**Barel v Noční směně.** Kontrola všech `create_bitmap` skriptů proti datům webu našla jedinou chybějící bitmapu: 86 na (129,99), vrstva 1, `native_31(…, −110)`. Jde o barel, který se řadí s postavami podle spodní hrany + z (jako kulisy Exitu), takže postava nad ním je zakrytá. Čtyři bitmapy vrstvy 2 zůstávají nahoře. Export `analysis/export_factory_mid.py`.

**Příznak konfigurace `+0x86`.** Výchozí 1 (`0x413542`). `0x412780` projde tabulku účastníků hry (`+0x168`, 13 B na záznam, počet `+0xda`; lokální záznam zapisuje `0x412720` z `+0x31/+0x35/+0x36/+0x37`) a příznak vynuluje, pokud má kterýkoli účastník bajt `+4` menší než 11. Při nule `0x420121` ponechá stav hry 2 (jen brokovnice) i při módu „všechny zbraně“ (`+0x19d`, kopie uloženého `+0x88`) a `0x412d6a` neodešle síťovou zprávu. Jde tedy o bránu kompatibility účastníků síťové hry (inference: hodnota +4 je zřejmě verze programu); v lokální hře je vždy 1 a web se tak chová.

**Pořadí senzorů.** `0x41b5a0` (volá se pro pohnutou postavu) prochází pole senzorů a regionů `+0x2d8` (počet `+0x2e0`) od posledního vytvořeného k prvnímu a každému předá zprávu přes `0x419e90` (id postavy, obdélník, neviditelnost `+0x198`). Při současném vstupu do více senzorů tedy reaguje nejdřív naposled vytvořený (soupeř s vyšším id, region s vyšším indexem). Ve webu by se pořadí projevilo jen sledem volání RNG; web neemuluje posloupnost `rand()` z MSVC, takže rozdíl není pozorovatelný a logika se neměnila.

## Aktualizace 29. 10. 2026: síťová hra přes WebSockety

Originál zakládal relaci DirectPlay (Start hry 1: Hru Vytvořit / Připojit se, „Způsob připojení“ TCP/IP nebo IPX); autoritou je počítač, který hru vytvořil (nativ `0x4a` ve skriptech). Web místo DirectPlay používá WebSocket na serveru, který stránku podává (`net-server.mjs`, cesta `/net`, bez závislostí): server jen vede seznam her a přeposílá zprávy. Prohlížeč hosta počítá hru se všemi hráči, ostatní posílají klávesy (při každé změně, s počítadlem stisků, aby se krátké ťuknutí mezi dvěma tiky neztratilo) a kreslí snímky stavu, které host posílá každý druhý tik (30 Hz), spolu se zvukovými událostmi.

Obrazovky podle originálu: Start hry 1 povolí „Připojit se“ a TCP/IP (IPX ne); síťová hra vznikne volbou Vytvořit s méně hráči na tomto počítači než celkem (až 4), nebo Připojit se. Připojení: CTcpIpConfig (`0x40c060`, text 0x7c; prázdná adresa = tento server), CSessionList (`0x40c2d0`, „Inicializuje se hledání...“, „Hledám hry...“, Připojit / Zrušit). Start hry 2 ukáže hráče ostatních počítačů v dalších sloupcích, chat `0x4102d0` na (240,244) (seznam 250,270–510,410, řádek 250,418–510,450, písmo 175, 120 znaků) a „Čekám na zbytek hráčů...“ (0xfc). Start má jen host, až jsou všichni připojeni; platí kontrola stejných jmen napříč počítači (`0x40f610`). Hlášky: odmítnutí pro příliš mnoho hráčů (0x160), „Někdo z hráčů opustil hru.“ (0x6c).

Server je ve výchozím stavu jen na 127.0.0.1; pro hru po LAN se spouští s `BULANCI_HOST=0.0.0.0`. Web: `dist/net.js`, `dist/ui/net-dialogs.js`; testy `test/net-server.test.mjs`, `test/net.test.mjs`; kontrola dvou prohlížečů `verify-network.mjs`.


## Aktualizace 31. 10. 2026: alfa plán animací a audit assetů

Chunky t52 14 a 15 (`0x432dd5`, `0x432def`) rozbalují stejnými rutinami jako obraz (`0x432740`, `0x432780`) alfa plán w×h do bitmapy `+0x20`. Export je dřív zahazoval, takže stíny (černá, index 0, alfa 95–96) a kouř s plynulými přechody (alfa 0–254) byly neprůhledné. Míchání je po kanálech přes tabulku `0x4b84f8` v 565; web používá běžné alfa skládání canvasu, bez zaokrouhlení 565.

`analysis/audit_asset_alpha.py` porovná všechny sprity a bitmapy t28 s přesným dekódem z EXE; `analysis/fix_sprite_alpha.py` přepíše jen rozdílná PNG a nesahá na manifest.

Otevřené rozdíly: HUD není port originálu. Konstruktor `0x4280f0` vytváří panely jen podle `config+0xd8` (lidští hráči) na X z `0x4af924`; web kreslí panel i soupeřům a vlastní texty. Chybí portrét, počítadlo a ikona zbraně (bitmapy 22, 29, 128, 169, 172, fonty 174 a 175). Čas originál píše jako sekundy v obdélníku (358, 45, 444, 95), web jako m:ss. Text nápovědy nad hrou je doplněk webu.
