# Bulánci — webová rekonstrukce

Neoficiální rekonstrukce české hry Bulánci (SleepTeam Labs, 1999–2002) pro prohlížeč.

**Tohle repo ani server neobsahují grafiku, zvuky, hudbu, písma, filmy ani básně původní hry.**
Každý hráč si při prvním spuštění vybere vlastní `bulanci.exe`. Prohlížeč z něj data vytáhne
a uloží si je u sebe. EXE se nespouští a nikam se neodesílá. V Gitu je jen kód, číselná
metadata (rozložení map, parametry zbraní, popis animací) a dokumentace.

Autorská práva k původní hře patří SleepTeam Labs. Projekt s nimi není nijak spojený.

## Spuštění

Potřebujete Node.js 20+ a aktuální prohlížeč. Závislosti se neinstalují.

```sh
npm start        # http://127.0.0.1:4173
```

Otevřete adresu a vyberte `bulanci.exe` verze 1.80. Trvá to asi půl minuty a příště už to
není potřeba. Znovu se na něj hra zeptá jen po smazání dat prohlížeče.

## Hra po síti

Hostitel založí hru, ostatní se připojí ze seznamu her v menu Hra po síti. Každý hráč
potřebuje svůj naimportovaný `bulanci.exe`. Hru počítá **prohlížeč hostitele**. Ostatní posílají
klávesy a 30× za sekundu dostávají stav hry. Server (`net-server.mjs`, WebSocket na `/net`)
drží jen seznam her a přeposílá zprávy. Vejdou se až 4 prohlížeče v jedné hře.

- odejde-li hostitel nebo uspí záložku, hra skončí (ostatní to poznají do 8 s),
- hostitel má nulové zpoždění, ostatní mají ping k serveru a zpět; stav se neinterpoluje,
- po skončení kola se všichni vrátí do menu,
- server snese špatné klienty, limit spojení je ale společný, ne na jednu IP adresu.

## Nasazení na VPS

Na server patří jen tohle repo. **Nikdy tam nedávejte `bulanci.exe` ani `dist/assets` s daty hry.**
Import vyžaduje HTTPS (mimo `localhost`), který zařídí Caddy. Statický hosting stačí
pro hru na jednom počítači, hra po síti potřebuje běžící `server.mjs`.

```sh
sudo apt install nodejs caddy
sudo git clone <url-repa> /opt/bulanci-web
sudo useradd --system bulanci
sudo cp /opt/bulanci-web/deploy/bulanci.service /etc/systemd/system/
sudo systemctl enable --now bulanci
```

Do `/etc/caddy/Caddyfile` vložte `deploy/Caddyfile` se svou doménou a spusťte
`sudo systemctl reload caddy`. Doména musí mířit na server a porty 80 a 443 musí být otevřené.

Proměnné prostředí: `BULANCI_HOST` (výchozí `127.0.0.1`), `PORT` (výchozí `4173`). Server
nechte na `127.0.0.1` za proxy.

## Vývoj

`npm test` běží i bez dat hry. Kontroly `verify-browser.mjs` a `verify-network.mjs` potřebují
`npx playwright install chromium` a data v `dist/assets`, která lokálně vyrobí
`python tools/import_assets.py bulanci.exe` (`pip install -r tools/requirements.txt`).
Tenhle adresář je v `.gitignore`; nepublikujte ho.

## Dokumentace

- `docs/reverse-engineering.md`: jak se z EXE dostávají data a jak číst poznámky,
- `dist/reconstruction.md`: hlavní deník rekonstrukce, včetně otevřených rozdílů proti originálu,
- `docs/analysis/`: podrobné rozbory jednotlivých částí.

Hra není 1:1 kopie. Největší známý rozdíl je herní HUD.
