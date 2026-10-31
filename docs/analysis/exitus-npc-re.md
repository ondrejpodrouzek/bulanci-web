# Exitus: původní nemrtví a jejich chování

Aktualizace 28. 10. 2026. Zdroj: dodané `bulanci_hra/bulanci.exe`, SHA-256
`2992cca12ec9ff452894045729ebf776a335e1dfcd9281260be6d8d9f6648e39`,
levelový skript 324 a původní t52/t28 zdroje. Jde o statický rozbor, nikoli záznam běhu EXE.

## Opravené závěry předchozího rozboru

`0x41f350` není AI tik. `0x41f770` obnovuje postavu po smrti; jeho náhodná větev
`0x41ea90` přepíná zbraň a pro Exitus ID rovnou vrací. Není to „10 % šance vystřelit“.
Parametr nastavený na 1 v konstruktoru také není index zbraně. Tyto chybné závěry už web nepoužívá.

## Potvrzené hodnoty a zapojení do webu

| Oblast | Nález | Důkaz v EXE |
|---|---|---|
| Postavy | Čtyři sloty 32, 33, 34, 35; zpočátku aktivní první | `0x420550`; ostatní volají hide `0x42d040`, nastavují `+0x69=0` |
| Skin | Vlastní potrhané tělo: vlevo 199, vpravo 201, nahoru 203, dolů 197 | konstruktor `0x41e723`, tabulka `0x4af2dc` |
| Paleta | Výběr 7, RGB (95,95,95); platí i pro zbraň a smrt | `0x41e821`, `0x413200`, tabulka `0x4aef40`, přebarvení `0x413220` |
| Zbraň | Typ 4, samopal; NPC neubývá munice | override `0x41e639` nastavuje poslední argument CWeapon na 4; `0x417500` vynechá odečet pro `+0x199` a ID >=4 |
| Rychlost | 40 %; 118 ms na snímek místo odhadu 125 px/s | `0x41e62d`, `0x41e91c`; chunk10 animací 197/199/201/203 |
| Chůze | Osm kroků včetně závěrečného ring snímku, jednotlivé původní posuny | `0x4178d0`, `0x41af70`; `analysis/player-movement-re.json` |
| Bloumání | Změna směru po 1 až 10 celých sekundách; kontrola senzorů po 2 s | `0x4172d0` |
| Zastavení | Při rozhodnutí s volnou zbraní šance 1/13 pustit směr, jinak náhodný směr | `0x420a90` |
| Reakce na kolizi | Zpráva 0x102 vyvolá rozhodnutí o pohybu | `0x4195f0`, `0x42115e` |
| Výhled | Čtyři obdélníkové senzory až k okraji bojiště; bez kruhu 320 px | `0x41fb90`, `0x421047`, `0x420c30` |
| Překážky ve výhledu | Sjednocení hran překrývajících překážek, kontrola obou příčných hran | `0x4192b0`, `0x433200`; částečná překážka dovolí ponechat průzor |
| Spoušť | Timer s periodou trunc(200 / 0.4) = 500 ms | `0x4210bf`, konstanta double 200 na `0x4829a8`; timer1 `0x420bb3` |
| Dávka | Čtyři střely: 71, 213, 355, 497 ms; hlavička animace 639 ms, jednorázové ukončení 568 ms | chunk12 animací 285..288, callback `0x42134d` |
| Zvuky dávky | Banka3: sample3 třikrát, sample4 při poslední střele | `0x42134d..0x421409`; sample4/19 je prázdná pistole, nikoli samopal |
| Střely | Původní bitmapy 80/81/82/79 a rozměry 9×4 / 4×9 | tabulka `0x482998`; t28 mode2 je paleta se dvěma pixely na bajt |
| Rozptyl | Náhodný příčný posun -4 až +4 na 40 px hlavního směru | konstruktor CShot `0x41ef76`, posun `0x419b40` |
| Ústí hlavně | Vektor přičtený k levému hornímu rohu sjednocení těla a zbraně | `0x41af70`, tabulka `0x4829d0` |
| Smrt | Vlastní animace 207/209/211/205 a duch 218; původní kotvy, šedá paleta | `0x41f900`, `0x41c663`, `0x4af008`, `0x41c860` |
| Zvuk smrti NPC | Flag 0x80 přeskočí běžný zvuk smrti a lidskou hlášku | `0x41f93d`, `0x41f9ce` |
| Návrat | Po návratu může s pravděpodobností 1/3 přibýt další nemrtvý, nejvýše čtyři | `0x420480`, `0x416940` |
| Zjevení | Po návratu jas roste o 10 % po 100 ms | timer5 `0x420ce1` |
| Řeka | Šest překážek blokuje chůzi, propouští střely i výhled | skript324 native63, `0x416f00`, `0x4183d0` |
| Scéna | Původní souřadnice a kolize; dvě dekorace se nezobrazí v 1/6 her | skript324; objekty vrstvy1 mají původní z posun a řadí se s postavami |

## Ověření a zbývající rozdíly

Automatické testy ověřují skin/paletu, původní sloty, neprolínající spawny, kroky včetně
ring snímku, směrové senzory, plnou i částečnou překážku, skutečný zásah hráče dávkou,
původní zvuky, řeku, bodování a aktivaci dalšího nemrtvého. Prohlížeč navíc kontroluje,
že canvas opravdu vykreslí nemrtvého, jeho zbraň, vlastní smrt a ducha bez chybějících souborů.

Kompletní shoda 1:1 celé hry ještě není ověřena. Web používá JavaScriptový RNG a pevný
simulační krok 1/60 s; střely nyní postupují původními40px aktualizacemi každých50ms a kontrolují celou uraženou dráhu. Přesné pořadí současných nativních událostí a veškeré
vícehráčové kombinace senzorů potřebují srovnávací záznam EXE. Na dobrou noc, miny a samopal byly následně doplněné podle dalšího rozboru (viz bedtime-re.md). Brokovnicový zásah, přebíjení pistole a respawn sbíratelných zbraní dál vyžadují další srovnání. Běžné dialogy menu a síťová hra též
nejsou kompletní port původního programu.

Podklady: `analysis/exitus-exact.json`, `analysis/shot-bitmap-data.json`,
`analysis/death-sprites.json`, `analysis/export_exitus_assets.py` a
`analysis/build_original_gameplay_data.py`. Ve webu: `exitus.js`, `actor-frames.js`,
`collision.js`, `original-data.js` a zapojení do `engine.js` / `app.js`.
