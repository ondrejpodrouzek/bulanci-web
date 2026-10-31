# Noční směna: rozbor potrubí z původního EXE

## Výsledek

Propojení všech pěti rour, vstupní směry, výstupní souřadnice a dvousekundové zpoždění jsou obsažené přímo ve skriptu mapy resource321. Nejde o geometrii odhadnutou z obrázku ani pravidla převzatá z Android portu.

Reprodukovatelná extrakce: `python analysis/decode_pipes_script.py`. Strojový výstup: `analysis/pipes-re.json`. Skript čte původní `bulanci_hra/out/raw/00321_t2026.bin`; souřadnice a propojení neobsahuje jako ručně vložené konstanty.

| ID | Vstupní obdélník (left,top,right,bottom) | Přijatý směr střely | Výstup | Výstupní směr |
|---|---|---|---|---|
| 10, vlevo nahoře | 136,17,168,27 | nahoru (2) | 500,440, vpravo dole | nahoru (2) |
| 11, vpravo nahoře | 579,20,610,30 | nahoru (2) | 38,409, vlevo dole | doprava (1) |
| 12, dole uprostřed | 447,450,477,460 | dolů (3) | 461,440, stejná roura | nahoru (2) |
| 13, vpravo dole | 494,450,524,460 | dolů (3) | 150,29, vlevo nahoře | dolů (3) |
| 14, vlevo dole | 26,390,36,431 | doleva (0) | 592,32, vpravo nahoře | dolů (3) |

Vstupní obdélníky jsou half-open geometrické obdélníky jako jinde v enginu; přesná původní kolize probíhá přes bitmapový obdélník projektilu, nikoli matematický bod. Výstupní x,y jsou původní počátek obdélníku nově vytvářené střely (`CShot + 0x20/+0x24`), nikoli dodatečně odhadnutý střed roury.

## Důkaz v datech

Bytecode začíná na offsetu16 souboru resource. Rozpoznané záznamy `33 38 2f 00` skládají `add_to_scene(assign_object_id(rect(...), id))`:

- raw0x23b: ID10;
- raw0x257: ID11;
- raw0x273: ID12;
- raw0x28f: ID13;
- raw0x2ab: ID14.

Switch v bytecode0x42a vybírá podle ID zasaženého objektu callbacky0x450,0x46c,0x488,0x4a4,0x4c0. Každý callback volá společnou funkci0x59a s cílovým indexem a požadovaným vstupním směrem:

```text
10 -> on_pipe(3, owner, incoming_direction, 2, 10)
11 -> on_pipe(4, owner, incoming_direction, 2, 11)
12 -> on_pipe(2, owner, incoming_direction, 3, 12)
13 -> on_pipe(0, owner, incoming_direction, 3, 13)
14 -> on_pipe(1, owner, incoming_direction, 0, 14)
```

Skriptové adresy jsou relativní k bytecode základně16. Branch cíle neobsahují úvodní počet lokálních proměnných; skutečné funkce volané opcode0x0e ho obsahují. Funkce0x59a má0 lokálních položek, funkce0x5d9 má1 položku a proto její parametry začínají indexem1.

Pseudokód potvrzené části0x59a:

```text
if incoming_direction != accepted_direction: return 0
signal(1, pipe_object_id)
if runtime_authority_guard() == 0: return 0
id = timer_create(-1, 2000, flags=2)
timer_user_data(id) = destination_index + (owner << 8)
return 0
```

Native0x41 / funkce0x418950 vysílá další původní událost do enginu přes0x418000; přesný význam signálu1/2 není v tomto rozboru uzavřený. Native0x4a /0x416d30 vrací test runtime flagu `script[0x45c][0x36] == 0`; podmínka odpovídá autoritativnímu zpracování v síťové hře. Výklad účelu flagu je inference, nikoli nalezený název proměnné.

## Dvě sekundy nejsou odhad

Rozšířená tabulka opcode handlerů je na0x4af018. Konstruktor0x4185c0 ji registruje pro opcodes0x2d–0x66 přes0x438310. Handler0x44=0x416c00 čte tři argumenty a volá0x42f210.

`0x42f210(-1,2000,2)`:

- při indexu-1 vyhradí nové časovací ID;
- flags2 způsobí zapsání současné hodnoty časovače `0x4b3bd8` jako začátku;
- period/delay2000 uloží do pole+4;
- flag1 (pozastavený stav) není nastavený;
- userdata+0x18 se následně nastaví handlerem0x51=0x4189b0.

Scheduler0x42eb30 na0x42eb54–0x42eb62 porovnává `start + period <= current_time`. Poté zavolá callback. Flags2 nepovolují opakování (to používá bit4), takže jde o jednorázový výstřel po2000ms. Čas pochází z WinMM `timeGetTime` přes0x42e790.

## Roura nevytáhne původní vektor střely

Výstupní switch dekóduje spodních8 bitů userdata jako cílový index. Pět větví volá funkci0x5d9 na bytecode adresách0x669,0x685,0x6a1,0x6bd,0x6d9 s parametry z výstupní tabulky výše.

Pseudokód funkce0x5d9:

```text
local_owner = packed_userdata >> 8
spawn_shot(exit_x, exit_y, exit_direction, local_owner, flags=1)
signal(2, local_owner + 10)
// dále následují podmíněné operace síťového přenosu stavu
return 0
```

Handler0x43=0x41f610 vytváří souřadnicovou dvojici a volá0x41f230. Ta při flags1 vytváří nový objekt CShot konstrukcí0x41edf0 s variantou0 (`(flags & 3) - 1`). Nevstupuje do ní původní rychlost, úhel rozptylu, stáří ani typ původního projektilu. Majitel střely se zachová díky horním bitům userdata. Webový port má tedy vytvářet nový základní projektil, nikoli okamžitě přenášet stejný vektor na jiné místo.

Původní CShot:

- konstruktor0x41edf0 vytváří časovač `timer_create(0,50,6)` na0x41ef18–0x41ef1f;
- flags6 zahrnují bit4 pro opakování a bit2 pro současný začátek;
- callback0x419b40 provádí v příslušném směru krok40px, podle switch tabulky0x419c88;
- nominálně tedy40px/50ms =800px/s, s diskrétním krokováním a čtyřmi podkroky kolizí v0x41de60.

## Zásah z nesprávné strany

CShot0x41de60 při nalezení překážky volá0x41dd70 a pak **bezpodmínečně vrátí1** na0x41df54–0x41df59. Aktualizace0x41df60 označí projektil za neaktivní, případně vypne příslušný brok v masce. Vrácená nula skriptového handleru proto neznamená, že střela projde rourou bez kolize.

Implementační důsledek: střela zasažená vstupním obdélníkem z nesprávného směru se spotřebuje a žádná výstupní se nevytvoří. Při správném směru se původní střela také spotřebuje; až za2s vznikne nová na určeném výstupu.

## Co stále vyžaduje další rozbor

- Přesný zvukový / událostní význam native0x41 signal1 a signal2.
- Plná synchronizace rour při síťové hře; zde ověřený lokální mechanismus pokrývá samotné spojení a časování.
- Přesná bitmapová kolizní plocha projektilů a případné rozdíly při raketách/pelletech. Zachycený skript všem přijatým zásahům zadává flags1 pro nový výstupní projektil.
- Původní engine používá diskrétní kroky40px a kolizní podkroky, nikoli plynulý pohyb, takže800px/s je nominální rychlost, ne důkaz shodné časové integrace v jiném enginu.
