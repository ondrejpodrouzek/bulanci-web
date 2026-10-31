# Audit kolizí ve webu (debug overlay)

Nástroj: `http://127.0.0.1:4173/?debug` kreslí červené obdélníky překážek z `maps.json`,
azurový hitbox hráče a žlutý bod jeho logické pozice. Zapnuto přes URL parametr `?debug`
(bez něj se nekreslí nic).

## Hitbox hráče — opraveno

Dřívější kolečko `r=9` (průměr 18 px) bylo ~třetina viditelného bulánka → střely „šly
kolem" a hráči se neseknuli. Nově obdélník z `CBulanek` ctoru `0x41e963`:
`[2,25,BODY_W-2,BODY_H]` = pro 55×62 `[2,25,53,62]`. Ve světě kolem logické `(x,y)`:
`{x:x-25.5, y:y-25, w:51, h:37}` (tělo drženo na `(x-27.5, y-50)`). Overlay potvrzuje,
že obdélník přesně kopíruje postavu. Použit pro zdi, kolizi hráč-hráč i zásahy.

## Překážky per mapa — věrné skriptu

| Mapa | Boxy | Sedí na scenérii | Poznámka |
|---|---|---|---|
| Vybíjená | 6 | ano | horní „stěna" reproduktorů, levý/pravý okraj |
| Noční směna | 23 | ano | stroje, jámy, hrnec; diagonální jeřáb je nadhled bez kolize |
| Malárie | 7 | ano | větev + kameny; **kmeny stromů jsou namalované v pozadí, bez kolize i v originále** |
| Na dobrou noc | 14 | ano | keře, kameny, kláda, noha muchomůrky (za kloboukem se projde) |
| Exitus | 18 | ano | ruiny, skály; **kříže jsou v pozadí `102.png`, bez kolize** |

Boxy jsou extrahované přímo z bytecode skriptů (`extract_level_facts.py`), ne odhadem.
U Malárie se extrakce shoduje s původní (codexovou) sadou 7 obdélníků. „Chybějící" kolize
velkých namalovaných objektů (kříže, kmeny) odpovídá originálu — skript jim `create_obstacle`
nedává, jsou součástí pozadí.

## Doplněno po hře (object_rect = footprint objektu)

Objekty s `set_object_rect` (native 0x30) mají vlastní pevný footprint, který se teď
přidává jako kolizní box navíc ke `create_obstacle`:

- **Keř** v Na dobrou noc (res 72, objekt `0x5c9`) měl jen `object_rect` a žádný
  `create_obstacle` → dřív se jím dalo projít. Nově kolize `[70,150,151,187]`.
- **Muchomůrka-domeček** (res 106, objekt `0x1e7`) má `create_obstacle` na spodku klobouku
  a `object_rect` na **stonku** `[444,293,597,329]` → nově pevný základ domečku.

Bedtime tím má 16 překážek (bylo 14). Mapy bez `set_object_rect` (Exitus ad.) beze změny.

## Vybíjená: DJ bulánek doplněn

Skript 319 vkládá dvě animace, které původní export vynechal: res 216 `(448,81)` gramofony
a res 217 `(463,63)` animovaný **DJ bulánek** (54 snímků). Přidány do `disco.animations`.

## Co z toho plyne

Kolizní data jsou 1:1 se skriptem a hitbox je nově správný tvar. Pokud konkrétní objekt
působí „neprůchodně/průchodně" špatně, je to buď (a) vlastnost originálu (pozadí bez kolize),
nebo (b) kandidát na kontrolu konkrétního záznamu v `level-facts.json` — overlay `?debug`
ukáže který box.
