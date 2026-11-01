# Bulánci — web reconstruction

An unofficial browser reconstruction of the Czech game Bulánci (SleepTeam Labs, 1999–2002).

**[Play the live demo](https://ondrejpodrouzek.github.io/bulanci-web/)** · you need your own `bulanci.exe` v1.80 · [how it was made](docs/how-it-was-made.md)

**This repository and the website contain no graphics, sounds, music, fonts, films or poems from
the original game.** On first launch every player selects their own `bulanci.exe`. The browser
extracts the data and keeps it locally. The EXE is never run or uploaded. Git holds only code,
numeric metadata (map layouts, weapon parameters, animation descriptions) and documentation.

The original game is copyright SleepTeam Labs. This project is not affiliated with them.

The live demo on GitHub Pages is for play on one computer. Network play needs a running server,
so it does not work there; run the game yourself or on your own VPS.

## Run it yourself

You need Node.js 20+ and a current browser. Nothing has to be installed.

```sh
npm start        # http://127.0.0.1:4173
```

Open the address and select `bulanci.exe` v1.80, or the `.zip` it comes in, or agree to download it. It takes about half a minute and is needed only
once, unless you clear your browser data. The game's interface is in Czech, like the original.

## Network play

The host creates a game and the others join from the list under Hra po síti. Every player needs
their own imported `bulanci.exe`. The **host's browser** runs the game. The others send their
keys and receive the game state 30 times a second. The server (`net-server.mjs`, a WebSocket on
`/net`) only keeps the list of games and relays messages. One game takes up to 4 browsers.

- If the host leaves or their tab sleeps, the game ends (the others notice within 8 s).
- The host has no delay, the others have their round trip to the server; the state is not
  interpolated.
- After a round everyone returns to the menu.
- The server withstands misbehaving clients, but its connection limit is global, not per IP.

## Deploying to a VPS

Only this repository goes on the server. **Never put `bulanci.exe` or `dist/assets` with game data
there.** On Debian or Ubuntu, point your domain at the server, open ports 80 and 443, then run:

```sh
curl -fsSL https://raw.githubusercontent.com/ondrejpodrouzek/bulanci-web/main/deploy/install.sh -o install.sh
sudo bash install.sh hra.example.cz
```

The script installs Node.js 20+ and Caddy, which handles HTTPS and WebSockets, runs the game as a
service and is safe to run again to update. The import requires HTTPS except on `localhost`.

With a server, `import.html` also offers to fetch the freeware archive from bulanci.cz after the
player agrees. That site does not allow browsers to download from it directly, so the server relays
the file without storing it, and only that address. The browser checks its SHA-256.
`BULANCI_DOWNLOAD=0` turns this off.

Environment variables: `BULANCI_HOST` (default `127.0.0.1`), `PORT` (default `4173`),
`BULANCI_DOWNLOAD`. Keep the server on `127.0.0.1` behind the proxy.

## Development

`npm test` runs without game data. `verify-browser.mjs` and `verify-network.mjs` need
`npx playwright install chromium` and data in `dist/assets`, which
`python tools/import_assets.py bulanci.exe` builds locally (`pip install -r tools/requirements.txt`).
That directory is in `.gitignore`; do not publish it.

## Documentation

- `docs/how-it-was-made.md`: how the game was made, what it needs and how to run it,
- `docs/reverse-engineering.md`: how the data is extracted from the EXE, and a guide to the notes,
- `dist/reconstruction.md`: the main reconstruction log, including open differences from the original,
- `docs/analysis/`: detailed studies of individual parts.

The game is not a 1:1 copy. A function-by-function audit of the game logic is still open.
