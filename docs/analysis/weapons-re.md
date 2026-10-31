# Zbraně a projektily: rozbor z EXE

Zdroj: `bulanci_hra/bulanci.exe` (PE32 x86, báze `0x400000`). Program nebyl spouštěn.
Disassembly přes `analysis/disasm_func.py` (capstone). Třídy `CWeapon`, `CShot`,
`CMina`, `CExplosion` z RTTI.

## Potvrzeno z kódu

### Pohyb projektilu — 800 px/s, jen 4 směry

`CShot` callback pohybu `0x419b40` má jump table `0x419c88` se **čtyřmi** větvemi
(0–3). Každý krok posune pozici o `0x28 = 40 px` po jedné ose:

```
0x419b77 (dir0): eax=0x28; [x]-=40 ; ...
0x419bbd (dir1): [x]+=40
0x419bfd (dir2): [y]-=40
0x419c28 (dir3): [y]+=40
```

Konstruktor `0x41edf0` zakládá časovač `timer_create(0, 0x32=50 ms, flags=6)` na
`0x41ef18`. Flags 6 = opakování + současný start. **Krok 40 px každých 50 ms = 800 px/s.**
Projektily se tedy pohybují striktně v jednom ze čtyř světových směrů; v enginu
nevzniká žádný úhlový rozptyl. (Diagonální větev pro `+0x1e==1` používá krok 5 px na
obě osy — zvláštní varianta, neověřeno pro které zbraně.)

### Projektil je salva broků (bitmaska)

Konstruktor nastaví `CShot+0xa7 = 0x1f` (5 bitů) a `+0xa8 = 0`. Update `0x41df60`
testuje jednotlivé bity `+0xa7` a pro každý aktivní brok provádí krok a kolizi
`0x41de60`; zásah vypne příslušný bit (shoduje se s `pipes-re.md`: „vypne příslušný
brok v masce"). Jeden `CShot` objekt tedy reprezentuje skupinu až několika broků
letících společně, ne jeden bod.

### Tabulka zbraní `0x482820`

`CWeapon` ctor `0x41dbc0`: `řádek = 0x482820 + 28*typ` (`lea eax,[edx*4+0x482820]`,
kde `edx = 7*typ`). Smyčka 0..3 načítá první čtyři položky jako **směrové sprity**
(potvrzeno proti `weapon-anchors-re.json`). Šest typů:

| typ | sprity (L,R,U,D → N) | role |
|---|---|---|
| 0 | 270,271,272,269 | pistole |
| 1 | 274,275,276,273 | nezařazeno (dlouhá hlaveň) |
| 2 | 278,279,280,277 | nezařazeno |
| 3 | 282,283,284,281 | nezařazeno (ruční/dálkové) |
| 4 | 286,287,288,285 | brokovnice |
| 5 | 290,291,292,289 | samopal |

Role 0/4/5 podle původní grafiky a speciálního zpracování typu 0; názvy enumu nejsou
z EXE. Zbývající položky řádku jsou další resource (ikona, zvuk) a příznak.

### Ústí hlavně — muzzle offsety

Fire rutiny posouvají počátek střely o offset `{int32 x, int32 y}` per typ (krok 8 B).
Tabulka `0x482928`: typ0 `(-19,46)`, typ1 `(77,25)`, typ2 `(17,-11)`, typ3 `(32,84)`,
typ4 `(-19,47)`, typ5 `(77,33)`. Existují i další paralelní muzzle tabulky
(`0x482948`, `0x4829b0`, `0x4829d0`) pro různé body/varianty výstřelu.

### Munice a přebíjení pistolové rodiny

`0x417500` (volané před výstřelem, jen typy < 4): dekrementuje čítač munice na
`[esi + 0x11c + slot]` o 1; při vyprázdnění a slotu 0 spustí reload timer `0x42f330`.
Typy 4/5 (brokovnice, samopal) touto cestou neprocházejí — mají vlastní logiku.

### Mina / exploze

Fire funkce `0x4212b0` větví podle pod-typu `+0x60`: pro typ 2 vytváří objekt velikosti
`0x118 B` konstruktorem `0x41cb70` (`CExplosion`/`CMina`), pro typy 4/5 vytváří střely
s pod-indexy (`add cl,3`, push 1/2 — vícesměrné fragmenty). Plné chování miny a raketa
zatím nejsou kompletně rozebrané.

## Přeneseno do webu (`engine.js` + `original-data.js`)

Celý systém zbraní je nově napojený na `web/dist/original-data.js` (codexův `WEAPON_DATA`
z `weapon-types-exact.json`). Ve hře je **všech 6 původních typů** se správnými sprity,
municí, kadencí a muzzle offsety:

- **Pistole** (typ 0): 1 střela, auto-reload (500 ms 2 hráči / 150 ms sólo).
- **Brokovnice** (typ 1, sprity 273–276): 5 broků, munice 4, delay 0.781 s. Dřív chybně
  používala sprity samopalu (286) — odtud „brokovnice = ikona kulometu".
- **Mina** (typ 2, pickup 268): položí se k noze, naostří se, odpálí při přiblížení nepřítele
  nebo roznětkou; plošná exploze.
- **Roznětka** (typ 3): odpálí vlastní položené miny.
- **Samopal** (typ 4, sprity 285–288): dávka 4 střel (71/213/355/497 ms) za 1 náboj.
- **Raketomet** (typ 5, sprity 289–292): střela s plošnou explozí při dopadu, munice 2.

Projektily letí **osově 800 px/s bez úhlového rozptylu**. Pickupy mají správné ikony
(179 brokovnice, 222 samopal, 219 raketomet, 268 mina). Muzzle offsety per směr z EXE tabulek.
`EXPLOSION_RADIUS`, naostření/trigger miny a životnost střely jsou zatím PROVIZORNÍ (označeno
v `engine.js`). Ověřeno `npm test` (10/10) a `verify-browser.mjs` (bez chyb) na 5 mapách.

## Kolize postavy (přeneseno)

`CBulanek` ctor `0x41e963..0x41e986` nastaví tělo-lokální obdélník `[2,25,BODY_W-2,BODY_H]`,
pro 55×62 tedy `[2,25,53,62]`; getter `0x417410` přičítá aktuální offset těla. To je
materiálně větší a jiného tvaru než dřívější kolečko r=9. Ve webu (`engine.js`) je nově
použit tento obdélník pro kolizi se zdmi, **kolizi hráč-hráč** (dřív úplně chyběla) i pro
zásahy střelou (bod ve obdélníku místo vzdálenosti od středu). Tím se opravilo „střela jde
kolem bulánka" i „proběhnu skrz jiného hráče". Regrese jištěna testem v `web/test`.

## Zatím NEpotvrzené (další průchod)

- Přesné počty broků a jejich rozestup per zbraň (bitmaska má 5+ bitů; `gap=7 px` ve
  webu je aproximace).
- Kadence střelby (`delay`) a přesné kapacity munice/přebíjení per typ.
- Diagonální varianta pohybu (`+0x1e==1`, krok 5 px).
- Plné chování rakety a miny (`CExplosion`/`CMina`), fragmenty exploze.
- Fire-dispatch v `CBulanek` (kdo a jak často volá které fire rutiny).
