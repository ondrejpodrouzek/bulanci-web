# Původní zbraně: opravené přiřazení grafiky, animací a ústí

Zdroj: původní `bulanci_hra/bulanci.exe` a jeho resources t52. Program se při tomto rozboru nespouštěl.

Reprodukovatelný export: `python analysis/recover_weapon_visuals_exact.py`. Kompletní data: `analysis/weapon-visuals-exact.json`.

## Zásadní chyba předchozí webové verze

Přiřazení bylo odhadnuté podle vzhledu zbraně. To vedlo k záměně: dlouhá zbraň285–288 je **samopal**, zatímco velká šedá zbraň289–292 je **raketomet**. Brokovnice je dřevěná zbraň273–276. Nestačí tedy změnit pozici stávajícího samopalu — web skutečně vykresloval jinou zbraň.

Konstruktor CWeapon `0x41dbc0` načte typ do `CWeapon+0x64` na`0x41dc2e` a řádek z tabulky`0x482820 + 28*typ` na`0x41dc46`. První čtyři uint32 jsou prostředky směrů L/R/U/D.

| Původní typ | Zbraň | V ruce L/R/U/D | Sběratelný prostředek | Animace |
|---:|---|---|---:|---:|
|0|Pistole|270,271,272,269|není|5 snímků /210ms|
|1|Brokovnice|274,275,276,273|179|11 snímků /781ms|
|2|Mina / položení nálože|278,279,280,277|268|5 snímků /355ms|
|3|Roznětka|282,283,284,281|není|5 snímků /355ms|
|4|Samopal|286,287,288,285|222|9 snímků /639ms|
|5|Raketomet|290,291,292,289|219|5 snímků /355ms|

Sběratelné prostředky jsou z tabulky`0x4827f4`, kterou indexuje`0x41d248` podle stejného typu. Tabulka přesně obsahuje`[-1,0x100b3,0x1010c,-1,0x100de,0x100db]`. Web dosud používal222 jako brokovnici a219 jako samopal; obojí bylo chybně.

Názvy jsou potvrzené chováním, nikoli pouhým vzhledem:

- Typ1 spouští`0x41fdf0`, přehrává sample13 a vytváří CShot kind1 s pěti broky.
- Typ4 callback`0x42134d..0x421409` zpracovává čtyři události animace0..3, vytváří jednotlivé střely kind3..6: čtyřranná dávka samopalu.
- Typ5 callback`0x421409..0x4214c8` vytváří CShot kind2, raketu.
- Typ3 dispatch`0x420650` volá`0x41ed60`; ta prochází objekty class0x816, filtruje vlastní miny a volá`0x41e070`, tedy rozbušku/roznětku.

## Hraní animace řídí okamžiky výstřelů

Časový plánovač`0x4399b0` používá intervaly`floor((f+1)*ticks/N)-floor(f*ticks/N)`.

Samopal má v chunk12 události na snímcích1,3,5,7: ID0,1,2,3. Při základním časování639ms /9snímků jde o **71,213,355,497ms od spuštění animace**. Jeho střelba proto nemá být implementovaná jako libovolně rychlý souvislý proud16 nábojů ani jako animace, která se pokaždé resetuje po0.11s.

Mina i raketomet mají událost0 na snímku2, tedy142ms od začátku355ms animace. Pistole a brokovnice nemají chunk12 výstřelu; jejich počáteční firefunkce provede střelbu přímo a zároveň rozběhne animaci.

Soubory t52 mají kromě N obyčejných snímků i dodatečný ring snímek N na konci. Export ponechává tento snímek i všechny jeho události. Nesmí se automaticky zaměnit údaj N za počet všech bloků v souboru.

## Body uchycení a vrstva rukou

Chunk11 `{byte id,int16 x,int16 y}` poskytuje body spojení. Body přetrvávají, když další snímek nemá nový chunk11. Všech130 prostředků v této hře má nejvýše jeden bod v chunk11.

Dekodér`0x432850` předá událost přes`0x436eb0`, callback těla`0x4178f0` a callback zbraně`0x417a00` uloží x/y do příslušných polí.

```text
weaponTL = bodyTL + bodyAnchor(currentBodyFrame) - weaponAnchor(currentWeaponFrame)
```

Renderer`0x417640`:

- Nahoru: celá zbraň za tělem.
- Dolů: celá zbraň před tělem.
- Doleva: řádky zbraně před hranicí`floor(height/2)-7` za tělem; zbytek před tělem.
- Doprava: stejný princip, hranice`floor(height/2)+5`.

## Ústí hlavně je vztažené k celkovému obdélníku postavy

Původní fire funkce přičítají offset k`CBulanek+0x20/+0x24`. To je po`0x41af70` **levý horní roh sjednocení těla a zbraně**, nikoli střed postavy ani samotný začátek těla.

Je-li webová souřadnice těla B a souřadnice zbraně W spočtená podle bodů uchycení:

```text
actorTL = (min(B.x,W.x), min(B.y,W.y))
muzzleTL = actorTL + muzzleTable[direction]
```

Offsety nejsou indexované typem zbraně, ale směrem 0=L,1=R,2=U,3=D:

| Zbraň | Tabulka | L | R | U | D |
|---|---|---|---|---|---|
|Pistole|0x482928|(-19,46)|(77,25)|(17,-11)|(32,84)|
|Brokovnice|0x482948|(-19,47)|(77,33)|(18,-11)|(29,84)|
|Samopal|0x4829d0|(-19,44)|(77,33)|(19,-13)|(28,88)|
|Raketomet|0x4829b0|(-25,40)|(77,27)|(16,-17)|(26,84)|

Důkaz použití: pistole`0x41fd35..0x41fd60`, brokovnice`0x41fe33..0x41fe5e`, samopal`0x42136b..0x421390`, raketomet`0x42142e..0x42144a`.

Samotná pravidla kapacity, přebíjení a speciálního šíření/exploze jsou v navazujícím rozboru`weapon-types-exact.md/json`; tento výstup je zaměřený na skutečné prostředky a jejich vizuální události.
