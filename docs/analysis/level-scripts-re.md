# Skripty levelů (CDSScript VM): rozbor a extrakce

Hlavní zdroj: `bulanci_hra/out/raw/00319..00324_t2026.bin` (bytecode skriptů map) a
rozšířená tabulka opcode handlerů na `0x4af018` v `bulanci.exe`. Program nebyl při
analýze spouštěn. Dekodér je `analysis/decode_level_specials.py`, čitelný výstup
`analysis/level-script-decoded/*.txt`, strojová extrakce herních faktů
`analysis/extract_level_facts.py` → `analysis/level-facts.json`.

## Formát a VM

Každý resource `t2026` je program malého zásobníkového/expression VM. Hlavička:
`uint32 kind(=2026), size, entry_count, globals_count`; následuje `size` bajtů kódu
a `entry_count` vstupních offsetů. Bloky s hlavičkou nesou úvodní bajt `locals`
(počet lokálních slotů). Volané funkce (`call`) s `locals=L` mají prvních `L`
argumentových slotů jako lokální scratch; předané parametry proto začínají indexem
`L` (shodně s dřívějším zjištěním u funkcí `0x59a`/`0x5d9` v `pipes-re.md`).

Potvrzené opcode skupiny: konstanty a aritmetika (`const`, `random_inclusive`,
`add/subtract/multiply/divide`, `min/max/clamp`, bitové), přístup k proměnným
(`global`, `arg`, `set_global`, `set_arg`), řízení toku (`goto`, `call`, `if_*_goto`,
`switch`, `return`) a nativní volání `0x2d–0x66`. Arity nativů pochází z handlerů
(`analysis/level-vm-handlers.json`), dvě byly ověřeny ručně proti kódu
(`0x49`=5, `0x53`=6).

## Nativní volání scény (potvrzeno z disassembly)

| Opcode | Jméno | Význam |
|---|---|---|
| 0x2d | create_animation(x,y,flags,res[]) | animovaný objekt; flags bit0 hraje, bit1 smyčka (0x4391e0) |
| 0x2e | create_bitmap(x,y,res) | statická bitmapa na (x,y) |
| 0x2f | create_obstacle(l,t,r,b) | kolizní obdélník (half-open) |
| 0x30 | set_object_rect(obj,l,t,r,b) | nastaví objektu lokální obdélník |
| 0x33 | insert_scene(obj) | vloží objekt do scény |
| 0x34 | select_layer(n) | zvolí aktivní rovinu scény (0 podlaha, 1 střed, 2 vršek/kolize) |
| 0x35 | set_background(res) | výplňové pozadí okna (ne herní základ) |
| 0x36 | set_audio(res,res) | hudba/ambient levelu |
| 0x38 | associate_callback(obj,id) | naváže skriptový callback na objekt |
| 0x3a | place(obj,x,y) | umístí objekt na základní (x,y); lokální obdélníky se posunou |
| 0x31 | set_zorder(obj,n) | pořadí kreslení (záporné = dřív/vzadu) — *odvozeno z použití* |
| 0x3e | get_object(id) | objekt podle id |
| 0x41 | object_event(a,id) | vyšle událost objektu |
| 0x43 | spawn_shot(x,y,dir,owner,flags) | vytvoří projektil (viz pipes-re.md) |
| 0x44/0x45 | timer_create(id,ms,flags)/timer_cancel | flags 1 pozastaven, 2 start teď, 4 opakovat; callback vždy vstup 6 s id v arg0 |
| 0x50 | play(obj,loop) | přehraje animaci (0x4390d0), loop=0 jednou a zastaví na posledním snímku |
| 0x3b/0x3c | hide/show(obj) | skrytí/zobrazení objektu — *pár, odvozeno* |
| 0x40 | trigger(obj) | spustí metodu podobjektu +0x98 — *odvozeno* |
| 0x53 | define_region(i,l,t,r,b,v) | registruje obdélníkový region (jen pod síťovou autoritou) — *odvozeno* |
| 0x55 | try_move(obj,x,y,f)→ok | přesun objektu na (x,y), vrací úspěch — *odvozeno* |
| 0x63 | region_obstacle(obj,flag) | kolize se zvláštním příznakem — *odvozeno* |

Jména označená *odvozeno* vycházejí z použití a krátké disassembly handleru, ne z
nalezených symbolů. `0x4384c0` je společný „vyhodnoť další výraz"; podle počtu jeho
volání v handleru se ověřila arita.

## Co nese každý level (extrahováno)

`analysis/level-facts.json` obsahuje pro všech šest map: názvy (EN/CZ), GUID, typové
id, pozadí/zvuk, scénu po vrstvách, kolizní obdélníky v absolutních souřadnicích,
časovače a region/net tabulky. Mapování resource → vyexportovaný PNG je `N = res − 65536`.
Herní základ mapy je **první `create_bitmap(0,0)`**, nikoli `set_background`.

| res | EN / CZ | typ | základ PNG | překážky | pozn. |
|---|---|---|---|---|---|
| 319 | Dj Slaughter / Vybíjená | 2 | 310 | 6 | 2 dekor. animace |
| 320 | Bedtime story / Na dobrou noc | 1 | 83 | 13 | náhodné rozmístění A/B, skriptovaní tvorové |
| 321 | Steel works / Noční směna | 3 | 87 | 23 | roury (viz pipes-re.md) |
| 322 | Malaria / Malárie | 4 | 103 | 7 | vítr: časovač 5–15 s přehraje 8 animací (viz reconstruction.md) |
| 323 | 8-bit / V zajetí 8-bitu | 5 | 100 | 10 | 7 regionů, skriptovaný „boss" (objekt 9) |
| 324 | Exitus | 6 | 102 | 18 | plně statická, dekorace s kolizí |

### Na dobrou noc (320): náhodné rozmístění

Blok 0xab volí `global3 = random(0,1)`; podle výsledku se pět objektů (stromy/keře/
muchomůrka/kláda a jejich tvorové) umístí do jedné ze dvou sad souřadnic. Každá
umisťovací subrutina má navíc vlastní pravděpodobnostní bránu `if random(0,k)==0 return`,
takže ne každý objekt se objeví vždy. To je skutečná původní mechanika, ne odhad.

### Exitus (324): „náhoda" která je vždy pravdivá

Subrutina 0x296 testuje `if random(0,5)==6` před pěti dekoracemi s kolizí. Hodnota 6
je mimo rozsah RNG 0..5, takže se větev nikdy neskočí a těchto pět útvarů se umístí
**vždy**. Jediná skutečně náhodná jsou dvě čistě vizuální dekorace v 0x239
(`random(0,5)==0`, tj. 1/6 šance na vynechání). Jde o pozorování přímo z bytecode.

### 8-bit (323): skriptovaný boss

Objekt 9 je skriptovaný tvor s vlastní animační sadou (res 65790–65800). Čítač
`global13` počítá zásahy; při >7 tvor „umírá" (blok 0x8a0). Přesouvá se mezi třemi
pozicemi přes `try_move` na (704,387)/(452,77)/(40,195), střílí přes `spawn_shot`/
nativ 0x62 a interaguje s rozbitnými bloky (objekty 18/19/20). Plná AI zatím není
přenesená.

## Přeneseno do webu

- **Exitus** a **Na dobrou noc** přidány jako hratelné mapy: původní základ, statická
  kulisa ve správných vrstvách (pozadí vs. popředí) a kompletní kolizní obdélníky
  z extrakce. Renderer `web/dist/app.js` nově podporuje více vrstev pozadí/popředí
  (`fg` příznak, zpětně kompatibilní). Ověřeno `verify-browser.mjs` (bez chyb a bez
  chybějících assetů) přes všech pět map.

## Co zbývá

- **8-bit (323)**: hotovo – bitmapy v režimech 1/2 vyexportované (`export_8bit_assets.py`), skript přenesený do `web/dist/eightbit.js`, viz `reconstruction.md`.
- **Skriptovaní tvorové** (Na dobrou noc, 8-bit): animace s více snímky a AI callbacky
  (pohyb, střelba, teleport-boss) nejsou simulované; jejich kolizní tělesa ale ve webu
  jako překážky jsou.
- **Náhodné A/B rozmístění** Na dobrou noc je ve webu zatím pevné (jedna sada);
  data pro obě sady i pravděpodobnostní brány jsou v `level-facts.json`.
- Přesný význam nativů 0x53/0x55/0x62/0x40 a síťová synchronizace regionů.
