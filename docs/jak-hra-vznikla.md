# Jak tahle verze vznikla

Bulánci jsou česká freewarová hra od SleepTeam Labs z let 1999–2002. Zdrojový kód hry není
veřejný, takže tahle webová verze vznikla zpětnou analýzou hotového programu `bulanci.exe`
verze 1.80. Cílem je, aby se hra v prohlížeči chovala a vypadala co nejvíc jako originál.

## Postup

1. **Rozbor EXE bez spuštění.** Program se jen četl. Disassembly a dekódování dat ukázaly třídy
   hry, formáty souborů a konkrétní hodnoty, například rychlosti, zbraně a kolize.
2. **Vytažení dat.** Hra má na konci EXE komprimovaný archiv s 347 položkami: bitmapy,
   animace, zvuky, hudbu, písma, filmy, básně a skripty levelů. Formát je popsaný v
   [reverse-engineering.md](reverse-engineering.md).
3. **Dekódování skriptů levelů.** Mapy jsou programy pro malý virtuální stroj uvnitř hry. Z nich
   pocházejí rozložení map, překážky, tvorové a jejich chování.
4. **Přepis logiky.** Herní logika je znovu napsaná v JavaScriptu podle zjištěných funkcí EXE: pohyb,
   střely, miny, boti, power-upy, skóre a typy her. Adresy funkcí jsou v poznámkách.
5. **Přepis rozhraní.** Menu, dialogy, Statistika, Historie a pauza vznikly podle původních oken.
   Pro telefony je zvlášť upravené ovládání a jejich vlastní obrazovky.
6. **Hra po síti.** Originál používal DirectPlay. Tady je nahrazený jednoduchým WebSocket
   serverem, takže síťová hra není kopie původního řešení.
7. **Ověřování.** Automatické testy hlídají herní logiku, kontroly v prohlížeči hru spouštějí a
   data z importu se porovnávala s předchozí sadou assetů. Hra se srovnávala i s dobovými
   screenshoty.

Na rekonstrukci se podílely nástroje AI OpenAI Codex a Claude Code pod vedením autora repozitáře.

## Co hra potřebuje

Repozitář ani web neobsahují data původní hry. **Bez vlastního `bulanci.exe` verze 1.80 hra
nepůjde spustit.** Soubor si každý dodá sám. Prohlížeč si z něj data vyrobí a uloží u sebe,
EXE se nespouští ani neodesílá.

Hrát můžete třemi způsoby:

| Způsob | Co potřebujete | Síťová hra |
|---|---|---|
| Web projektu | prohlížeč | ne |
| U sebe | Node.js 20+ a `npm start` | ano, na vašem počítači |
| Na vlastním serveru | VPS, Node.js a HTTPS | ano, přes internet |

Postup je v [README](../README.md).

## Co není 1:1

Hra se originálu blíží, ale není to přesná kopie. Největší známý rozdíl je herní HUD: má jiné
panely, chybí v něm portrét a počítadlo a čas se píše jinak. Přehled je na konci
[deníku rekonstrukce](../dist/reconstruction.md), který odděluje ověřené nálezy od
provizorních hodnot.

## Kde hledat podrobnosti

- [reverse-engineering.md](reverse-engineering.md): formáty dat a rozcestník poznámek,
- [deník rekonstrukce](../dist/reconstruction.md): co se kdy zjistilo a přepsalo,
- [analysis/](analysis/): podrobné rozbory zbraní, kolizí, tvorů, skriptů a rozhraní.
