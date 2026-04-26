<div align="center">

# Port Killer

**See what’s listening on TCP ports on Windows - filter fast, then end a process by PID when you need the port back.**

<br/>

[![GitHub release](https://img.shields.io/github/v/release/mahmoud-faiyumi/port-killer?logo=github&logoColor=white&label=release)](https://github.com/mahmoud-faiyumi/port-killer/releases/latest)
[![Windows](https://img.shields.io/badge/platform-Windows-0078D4?logo=windows&logoColor=white)](https://github.com/mahmoud-faiyumi/port-killer/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<br/>

<a href="https://github.com/mahmoud-faiyumi/port-killer/releases/latest/download/Port-Killer-Setup.exe">
  <img src="readme-assets/download-windows.svg" alt="Download Windows installer" width="280" height="56">
</a>

<br/>

**[Latest release](https://github.com/mahmoud-faiyumi/port-killer/releases/latest)** · **[All releases](https://github.com/mahmoud-faiyumi/port-killer/releases)**

<sub>Installer filename stays <code>Port-Killer-Setup.exe</code> on every release so the direct download always resolves to the newest build.</sub>

</div>

---

## Why use it

Local dev left **Angular**, **Vite**, **webpack**, or a random service on a port? Instead of spelunking through `netstat`, you get a **sortable list** of listeners with **address, port, PID, process name, and state**, quick **search**, and a **Kill** action when you know what you’re doing.

## Features

| | |
| :--- | :--- |
| **Scan** | Refresh TCP listeners (Windows uses `netstat`; logic still exists for macOS/Linux if you run from source there). |
| **Filter** | Search by port, address, PID, process name, or state. |
| **Dev mode** | Optional “dev / manual ports only” preset plus extra port list (saved in `localStorage`). |
| **System ports** | Optional show/hide for well-known range **1–1023**. |
| **Kill** | Sends **`taskkill`** for the chosen PID (elevated rights may still be required for some processes). |
| **Updates** | Packaged Windows builds check **GitHub Releases** via `electron-updater` on startup. |

## Requirements

- **Windows 10 or later** (x64) for the prebuilt installer.
- **[Node.js](https://nodejs.org/)** (LTS recommended) + **npm** only if you run or build from source.

## Install

1. Click the **Download for Windows** image above, *or* open the [latest release](https://github.com/mahmoud-faiyumi/port-killer/releases/latest) and download **`Port-Killer-Setup.exe`**.
2. Run the installer and start **Port Killer** from the Start menu or desktop shortcut.

If the direct link returns **404**, the release may not include that filename yet - use the **Assets** list on the release page.

## Run from source

```bash
git clone https://github.com/mahmoud-faiyumi/port-killer.git
cd port-killer
npm install
npm start
```

## Build from source (Windows)

**Portable / unpacked app** (good for quick testing):

```bash
npm run pack
```

Output: `dist\win-unpacked\` (includes **`Port Killer.exe`**).

**Installer + auto-update files** for publishing:

```bash
npm run build
```

Produces **`dist\Port-Killer-Setup.exe`**, **`dist\Port-Killer-Setup.exe.blockmap`**, and **`dist\latest.yml`**. Attach those to a GitHub release (or push a **`v*`** tag to run [`.github/workflows/release-windows.yml`](.github/workflows/release-windows.yml)).

## Releasing (maintainers)

Bump **`version`** in `package.json`, tag **`v`** + that version (example: **`v1.0.2`**), push the tag - CI can publish - or upload the three artifacts from `dist\` manually. Installed clients need **`latest.yml`** + installer + blockmap on the **same** release for updates to apply.

Regenerates ICO/WebP under `build\` when branding assets change.

## License

MIT.