# Na dobrou noc, miny a samopal — obnovené chování

28. 10. 2026. Rozbor dodaného původního EXE a skriptu320. Nejde o odhad podle Androidu.

## Králík a ostatní animované detaily

Skript losuje právě jednu ze dvou původních sestav objektů. Kláda a králík mohou chybět
s pravděpodobností1/8, kameny s myší1/10, keř se zvířetem1/8 a vedlejší keř1/7. Souřadnice,
vrstvy a jednotlivé kolizní obdélníky pocházejí z původního skriptu, ne z celé velikosti bitmapy.

Králík má čtyři klidové varianty **223,224,225,227**. Po dokončení každé skript vybere
náhodnou variantu0–3 (`320:0x689`). Web už neopakuje jen krátké mrknutí223. Původní snímky
mají71ms rozestupy. Zásah lokálního obdélníku `[79,50,112,80]` vůči kládě nastaví death bit2,
vypne callback zásahu a spustí **226** (`320:0xa15`). Smrt se přehraje jednou a zůstane
na posledním snímku19. Králík v téže hře neožije a skript neuděluje bod za hráčský kill.

Keřové zvíře stejným způsobem střídá239,240,241,243 a při smrti používá242. Stav1 přehrává
zvuk banky1/sample0. Dekorace muchomůrky používá228–230 včetně původních posunů chunk10,
vratného ring snímku a vrstvy2. Mezera mezi horní kolizí a základnou muchomůrky je zachovaná:
hráč uvnitř může střílet okénkem vlevo i vpravo, střecha a spodní část střely zastaví.

## Myš za kamenem

Přeneseny jsou stavy a přechody ze skriptu `320:0x6d5..0x93e`, nikoli střelba na nejbližšího
hráče v kruhu300px:

| Směr | Vylézání | Schování | Střelba | Smrt |
|---|---|---|---|---|
| Vpravo | 231 / stav0 | 232 / stav1 | 233 / stav2 | 234 / stav3 |
| Vlevo | 235 / stav4 | 236 / stav5 | 237 / stav6 | 238 / stav7 |

Na začátku běží pravé vylézání. Po vylezení myš vystřelí pouze tehdy, je-li hráč v příslušném
vodorovném senzoru. Jinak se schová. Střela vznikne při přechodu do střeleckého stavu,
ne až po jeho skončení. Ústí má původní absolutní offset `(65,10)` vpravo a `(-10,10)` vlevo
vůči kameni, ID vlastníka9, základní typ střely; žádné posouvání střely skrz kulisu.

Po střelbě se vždy schová. Teprve po dokončení schování nastaví připravenost a časovač
náhodných **3 až15 celých sekund**. Časovač vybere stranu0/1. Nový vstup hráče do bočního
senzoru má **1/4 šanci** na vylézání, pokud je připravená. Odešel-li hráč dříve, než myš
vylezla, myš se zase schová. Senzory používají původní kolizní obdélník hráče, ne jeho střed.

Zranitelnost `[36,0,45,14]` vůči kameni má callback10 jen ve stavech2/6. Při schování,
vylézání nebo po smrti je ID255 a střela pouze narazí do kulisy. Smrt přepne stav2→3 či6→7,
přehraje příslušnou animaci a trvale vypne AI (`320:0xa58`).

Původní zvuky banky1: králík smrt1, keřové zvíře smrt2, myš smrt3, myš střelba4.

## Důležitá oprava konce animací

Číslo duration v hlavičce není u jednorázové animace totožné s okamžikem zastavení.
`0x439b90` nejprve načte další blok přes`0x4399b0`, po posledním běžném bloku zabalí
čítač na0 a při stop-frame0/loop=false okamžitě zastaví přes`0x439840`.

| Animace | Hlavička | Poslední běžný snímek / zastavení |
|---|---:|---:|
| Krátké mrknutí223 | 497ms /7snímků | 426ms |
| Králík225/227/226 | 1420ms /20snímků | 1349ms |
| Myš vylézá/schovává/umírá | 426ms /6snímků | 355ms |
| Myš střílí | 639ms /9snímků | 568ms |
| Samopal | 639ms /9snímků | 568ms |
| Pokládání miny | 355ms /5snímků | 284ms |
| Mina177 na zemi | 1136ms /16snímků | 1065ms |
| Výbuch178 | 781ms /11snímků | 710ms |

Muchomůrková dekorace má výslovně nastavený stop-frame1 (`native42`), takže dohraje i ring
blok v čase nominální duration. Tento rozdíl je v nové implementaci zachovaný.

## Miny

- Sebrání přidá **jednu** minu do maxima4 (`0x41ec89..0x41ec98`), nikoli čtyři kusy.
- Položení a odečtení munice proběhne při eventu0 ve **142ms**. Otočení nebo výměna zbraně
  před touto událostí pokládání zruší. Offsety L/R/U/D vůči sjednocenému půdorysu těla a
  zbraně jsou `(-3,44),(27,33),(4,19),(23,49)` (`0x4827d4`).
- Na zemi se vykresluje původní animace **177**, ne obrázek pickup268. Hraje jednou,
  zůstane na snímku15 a při aktivaci se nerestartuje ani zprůhledňuje.
- Aktivuje se **2000ms po položení**. Spouštěč je obdélník miny31×18 rozšířený10px
  na každou stranu, tedy51×38. Porovnává se s kolizí hráče; samotný dotek hran nestačí.
  **Vlastník není imunní**, kontroluje se i hráč stojící na mině v okamžiku aktivace.
- Odpálení vytvoří původní výbuch **178**. Zásah a další řetězení nastávají až **142ms
  po začátku výbuchu**. Výbuch zmizí po710ms, bez náhradního oranžového kruhu.
- Zásah používá původní středový4×4 probe a osm paprsků po15krocích, ne kruh46px.
  Nepojmenované překážky s ID255 se podle původní funkce`0x41b250` ignorují. Zvířecí
  hitboxy a další pojmenované objekty mohou reagovat. Řetězení min různých vlastníků
  používá zvlášť rozšířený obdélník výbuchu, bez stínění paprsků.
- Roznětka typu3 odpaluje jen vlastní aktivované miny. Při směsi aktivních a neaktivních
  zůstane zachovaná; spotřebuje se, až úspěšně odpálí všechny vlastní miny. Když není co
  odpálit, nehraje animaci. Původní běžný generátor pickupů typ3 přeskočí; není vymyšlený
  automatický grant rozbušky k mině. Typ3 zůstává dostupný pro explicitní give/debug.

Podrobné adresy a důkazy: [mines-re.md](mines-re.md).

## Samopal

Při spuštění dávky ubude jeden zásobník. Události původní animace nastávají ve
**71,213,355,497ms**, vytvářejí původní druhy střel3,4,5,6 a hrají banku3/sample3 pro první
3střely a sample4 pro poslední. Zbraň zůstane vybavená přes celou poslední dávku. Normálně
se ukončí v568ms a až potom se při vyčerpané munici vybere další vlastněná zbraň.

Puštění spouště dávku nepřeruší. **Otočení přeruší zbývající střely** stejně jako výměna
zbraně a smrt. Důkaz: `0x4179e0 →0x439eb0 →0x439840` pozastaví starý časovač; následný
`0x439b40` jen obnoví snímek0, nepokračuje časovačem. `0x42f290` neposílá resume.

Střely se nyní posouvají po původních **40px každých50ms**, s jedním náhodně určeným
příčným posunem -4..4px na krok. Používají původní bitmapy a jejich rozměry; kontroluje se
celá uražená dráha, včetně tenkých stěn a původní podmínky bez zásahu při pouhém dotyku hran.

## Ověření a hranice shody

43testů simulace, včetně skutečného výstřelu hráče z okénka, smrti a trvalého stavu králíka,
obou stran myši, zranitelnosti při střelbě, spuštění vlastní miny, časovaných výbuchů,
řetězení, přerušení dávky a nativních kroků střel. Kontrola v prohlížeči ověřuje skutečně
vykreslené původní snímky226/234/177/178 a zvuky, plus regresní kontroly všech pěti map a Exitu.

Tyto části jsou přenesené podle dostupného původního kódu. Úplná bitově shodná hra stále
není prokázaná: JS má vlastní RNG a pořadí souběžných událostí se může lišit od Windows
enginu. Brokovnicový zásah, přebíjení pistole, respawn pickupů a všechny síťové režimy
ještě potřebují samostatné srovnání s během EXE. Tato úprava je neoznačuje za dokončené1:1.

Reprodukce: `analysis/recover_bedtime.py`, `analysis/recover_mines_exact.py`,
`analysis/build_original_gameplay_data.py`. Strojová data: `analysis/bedtime-exact.json`,
`analysis/mines-exact.json`; běhové moduly: `bedtime.js`, `mines.js`, `engine.js`.
