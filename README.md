# Port Killer

Yo — tiny Electron desktop app for when **something is squatting on a port** and you just want to see **who** and **nuke the PID** without digging through `netstat` for ten minutes. Lists TCP listeners, shows process info, you filter, you kill. That’s the whole vibe.

## Downloads

One-click links (they always track **latest** — filenames stay the same on each new release):

- **Windows (NSIS installer):** [Download `Port-Killer-Setup.exe`](https://github.com/mahmoud-faiyumi/port-killer/releases/latest/download/Port-Killer-Setup.exe)
- **Linux (AppImage):** [Download `Port-Killer.AppImage`](https://github.com/mahmoud-faiyumi/port-killer/releases/latest/download/Port-Killer.AppImage)  
  Then in a terminal: `chmod +x Port-Killer.AppImage` and run `./Port-Killer.AppImage` (or double-click if your file manager handles it).

If a link 404s, you’re probably on an older release that used different asset names — open the **[releases page](https://github.com/mahmoud-faiyumi/port-killer/releases/latest)** and grab the matching file under **Assets**, or ship a new release built from this repo so the names above exist.

No macOS link here unless you ship a DMG on releases — build one on a Mac with `npm run build` when you need it.

## What it does

- Refresh the TCP listener list: address, port, PID, process name, state  
- Search / filter by port, address, PID, or name  
- Toggle **system ports** (1–1023) and a **dev / manual ports** preset + optional extra port patterns  
- Kill a process from the UI (some stuff on Windows might still want admin — that’s the OS being the OS)

## Run from source

You’ll need [Node.js](https://nodejs.org/) (LTS is fine) and npm.

```bash
npm install
npm start
```

## Pack / build yourself

**Unpacked folder (no installer)** — good for testing or a portable folder:

```bash
npm run pack
```

On Windows you’ll get `dist\win-unpacked\Port Killer.exe` (plus the rest of the bundle). Other platforms drop their unpacked output under `dist/` too.

**Real installers / images:**

```bash
npm run build
```

That’s NSIS on Windows, AppImage on Linux, DMG on macOS — whatever’s in your `package.json` `build` block.

## Icons

Changed the logo? Regenerate assets:

```bash
npm run generate:icon
```

## Auto-updates

Ships with `electron-updater` pointed at GitHub (`mahmoud-faiyumi` / `port-killer`). Cut a release with the built artifacts and installed apps can pick up updates.

## License

MIT — do your thing.
