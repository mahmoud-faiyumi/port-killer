# Port Killer

Yo - tiny Electron desktop app for when **something is squatting on a port** and you just want to see **who** and **nuke the PID** without digging through `netstat` for ten minutes. Lists TCP listeners, shows process info, you filter, you kill. That’s the whole vibe.

## Downloads (Windows)

Installer (always the same filename on each new release):

- **[Download `Port-Killer-Setup.exe`](https://github.com/mahmoud-faiyumi/port-killer/releases/latest/download/Port-Killer-Setup.exe)** (NSIS)

If that 404s, open **[Releases](https://github.com/mahmoud-faiyumi/port-killer/releases/latest)** and grab the installer under **Assets**.

## What it does

- Refresh the TCP listener list: address, port, PID, process name, state  
- Search / filter by port, address, PID, or name  
- Toggle **system ports** (1–1023) and a **dev / manual ports** preset + optional extra port patterns  
- Kill a process from the UI (some stuff on Windows might still want admin - that’s the OS being the OS)

## Run from source

You’ll need [Node.js](https://nodejs.org/) (LTS is fine) and npm.

```bash
npm install
npm start
```

## Pack / build yourself

**Unpacked folder (no installer)** - good for testing or a portable folder:

```bash
npm run pack
```

You’ll get `dist\win-unpacked\Port Killer.exe` (plus the rest of the bundle).

**Windows installer + update metadata:**

```bash
npm run build
```

Produces `dist\Port-Killer-Setup.exe`, `dist\Port-Killer-Setup.exe.blockmap`, and `dist\latest.yml` for GitHub releases / auto-update.

## Icons

Changed the logo? Regenerate assets:

```bash
npm run generate:icon
```

## Auto-updates (Windows)

Installed builds call `electron-updater` against GitHub `mahmoud-faiyumi` / `port-killer`. Ship a new release with **`latest.yml`**, **`Port-Killer-Setup.exe`**, and **`Port-Killer-Setup.exe.blockmap`** attached so clients can see and apply updates.

## License

MIT - do your thing.
