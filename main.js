const fs = require('node:fs');
const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  Tray,
  Menu,
  Notification,
  nativeImage,
  clipboard,
} = require('electron');
const path = require('node:path');
const { description: appDescription } = require('./package.json');

const { getPorts } = require('./src/portScanner');
const { killProcessByPid } = require('./src/processKiller');
const { getRiskLevel } = require('./src/processRisk');
const { createSettingsStore, sanitizeSettings } = require('./src/userSettings');
const {
  startAutoUpdateChecks,
  checkForUpdatesManual,
  subscribeToUpdateState,
  getLastUpdateState,
  installDownloadedUpdate,
} = require('./src/updater');
const { fetchReleaseNotesForVersion } = require('./src/releaseNotes');

let mainWindow = null;
let tray = null;
let isQuitting = false;
let settingsStore = null;

const KILL_HISTORY_LIMIT = 50;
const killHistory = [];

function getPreloadPath() {
  return path.join(__dirname, 'preload.js');
}

function getRendererPath() {
  return path.join(__dirname, 'renderer', 'index.html');
}

function getWindowIconPath() {
  const ico = path.join(__dirname, 'build', 'port-killer.ico');
  const webp = path.join(__dirname, 'build', 'port-killer.webp');
  if (process.platform === 'win32' && fs.existsSync(ico)) {
    return ico;
  }
  if (fs.existsSync(webp)) {
    return webp;
  }
  if (fs.existsSync(ico)) {
    return ico;
  }
  return undefined;
}

function createWindow() {
  const icon = getWindowIconPath();
  const win = new BrowserWindow({
    ...(icon ? { icon } : {}),
    width: 960,
    height: 640,
    minWidth: 640,
    minHeight: 480,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.loadFile(getRendererPath());

  win.webContents.setWindowOpenHandler((details) => {
    if (details.url) {
      shell.openExternal(details.url).catch(() => {});
    }
    return { action: 'deny' };
  });

  win.on('close', (event) => {
    const settings = settingsStore.read();
    if (!isQuitting && settings.minimizeToTray) {
      event.preventDefault();
      win.hide();
    }
  });

  return win;
}

function pushKillHistory(entry) {
  killHistory.unshift(entry);
  if (killHistory.length > KILL_HISTORY_LIMIT) {
    killHistory.length = KILL_HISTORY_LIMIT;
  }
}

function getMainWindowOrNull() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }
  return mainWindow;
}

async function confirmCriticalKill(target) {
  const win = getMainWindowOrNull() ?? undefined;
  const response = await dialog.showMessageBox(win, {
    type: 'warning',
    title: 'Critical process warning',
    message: `Process "${target.processName}" (PID ${String(target.pid)}) may impact system stability.`,
    detail: `Port: ${target.port ?? 'unknown'}\nIf you continue, Port Killer will force-terminate this process${
      target.tree ? ' and its child processes' : ''
    }.`,
    buttons: ['Cancel', 'Kill anyway'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  return response.response === 1;
}

async function killWithPolicy(target) {
  const risk = getRiskLevel(target.pid, target.processName);
  if (risk === 'blocked') {
    const message = `Process "${target.processName}" (PID ${String(target.pid)}) is protected and cannot be killed.`;
    pushKillHistory({
      timestamp: new Date().toISOString(),
      pid: target.pid,
      processName: target.processName,
      port: target.port ?? null,
      tree: target.tree === true,
      outcome: `blocked: ${message}`,
    });
    return { ok: false, error: message };
  }
  if (risk === 'critical') {
    const confirmed = await confirmCriticalKill(target);
    if (!confirmed) {
      pushKillHistory({
        timestamp: new Date().toISOString(),
        pid: target.pid,
        processName: target.processName,
        port: target.port ?? null,
        tree: target.tree === true,
        outcome: 'cancelled',
      });
      return { ok: false, error: 'Cancelled by user' };
    }
  }

  const result = await killProcessByPid(target.pid, { tree: target.tree === true });
  pushKillHistory({
    timestamp: new Date().toISOString(),
    pid: target.pid,
    processName: target.processName,
    port: target.port ?? null,
    tree: target.tree === true,
    outcome: result.ok ? 'killed' : `error: ${result.error ?? 'Unknown error'}`,
  });
  return result;
}

function parseKillPayload(rawPayload) {
  if (typeof rawPayload === 'number') {
    return {
      pid: rawPayload,
      tree: settingsStore.read().killProcessTree === true,
      processName: 'unknown',
      port: null,
    };
  }
  if (rawPayload && typeof rawPayload === 'object') {
    const pid =
      typeof rawPayload.pid === 'string' ? Number.parseInt(rawPayload.pid, 10) : Number(rawPayload.pid);
    return {
      pid,
      tree: rawPayload.tree === true,
      processName: String(rawPayload.processName ?? 'unknown'),
      port: Number.isInteger(rawPayload.port) ? rawPayload.port : null,
    };
  }
  return { pid: NaN, tree: false, processName: 'unknown', port: null };
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show',
        click: () => {
          const win = getMainWindowOrNull();
          if (!win) {
            return;
          }
          if (!win.isVisible()) {
            win.show();
          }
          win.focus();
        },
      },
      {
        label: 'Refresh',
        click: () => {
          const win = getMainWindowOrNull();
          if (win) {
            win.webContents.send('tray-refresh');
          }
        },
      },
      {
        label: 'Free favorite ports',
        click: async () => {
          const result = await runFreeProtectedPorts('tray');
          const body = result.ok
            ? result.killed === 0
              ? 'No listeners were using favorite ports.'
              : `Stopped ${String(result.killed)} process(es) on favorite ports.`
            : String(result.error || 'Failed to free favorite ports.');
          new Notification({
            title: 'Port Killer',
            body,
          }).show();
          const win = getMainWindowOrNull();
          if (win) {
            win.webContents.send('history-updated');
          }
        },
      },
      {
        label: 'Check updates',
        click: async () => {
          const result = await checkForUpdatesManual();
          const body =
            result && result.ok
              ? result.status === 'available'
                ? `Update v${String(result.version)} is available.`
                : "You're on the latest version."
              : String(result?.message || result?.error || 'Could not check for updates.');
          new Notification({
            title: 'Port Killer',
            body,
          }).show();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function ensureTray() {
  const settings = settingsStore.read();
  if (!settings.minimizeToTray) {
    if (tray) {
      tray.destroy();
      tray = null;
    }
    return;
  }
  if (tray) {
    return;
  }
  const iconPath = getWindowIconPath();
  const trayImage = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = iconPath ? new Tray(trayImage) : new Tray(process.execPath);
  tray.setToolTip('Port Killer');
  tray.on('click', () => {
    const win = getMainWindowOrNull();
    if (!win) {
      return;
    }
    if (!win.isVisible()) {
      win.show();
    }
    win.focus();
  });
  updateTrayMenu();
}

async function runFreeProtectedPorts(source) {
  try {
    const rows = await getPorts();
    const settings = settingsStore.read();
    const protectedSet = new Set(settings.protectedPorts);
    const targetsByPid = new Map();
    for (const row of rows) {
      if (!protectedSet.has(row.port)) {
        continue;
      }
      if (!targetsByPid.has(row.pid)) {
        targetsByPid.set(row.pid, {
          pid: row.pid,
          processName: String(row.processName || 'unknown'),
          port: row.port,
          tree: settings.killProcessTree === true,
        });
      }
    }
    const targets = Array.from(targetsByPid.values());
    if (targets.length === 0) {
      return { ok: true, killed: 0, scanned: rows.length, source };
    }

    let killed = 0;
    const errors = [];
    for (const target of targets) {
      const result = await killWithPolicy(target);
      if (result.ok) {
        killed += 1;
      } else {
        errors.push(`PID ${String(target.pid)}: ${String(result.error || 'Unknown error')}`);
      }
    }
    return {
      ok: errors.length === 0,
      killed,
      scanned: rows.length,
      attempted: targets.length,
      error: errors.length > 0 ? errors.join('\n') : undefined,
      source,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      killed: 0,
      source,
    };
  }
}

async function showAboutDialog() {
  const win = getMainWindowOrNull() ?? undefined;
  await dialog.showMessageBox(win, {
    type: 'info',
    title: 'About Port Killer',
    message: 'Port Killer',
    detail: `Version: ${app.getVersion()}\n${appDescription}`,
    buttons: ['OK'],
    defaultId: 0,
    noLink: true,
  });
}

async function showAboutDeveloperDialog() {
  const win = getMainWindowOrNull() ?? undefined;
  await dialog.showMessageBox(win, {
    type: 'info',
    title: 'About Developer',
    message: 'Developer',
    detail: 'Mahmoud Faiyumi\nGitHub: github.com/mahmoud-faiyumi',
    buttons: ['OK'],
    defaultId: 0,
    noLink: true,
  });
}

function createApplicationMenuTemplate() {
  return [
    {
      label: 'File',
      submenu: [
        {
          label: 'About Port Killer',
          click: () => {
            showAboutDialog().catch(() => {});
          },
        },
        {
          label: 'About Developer',
          click: () => {
            showAboutDeveloperDialog().catch(() => {});
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(createApplicationMenuTemplate()));
  settingsStore = createSettingsStore(app);
  subscribeToUpdateState((state) => {
    const win = getMainWindowOrNull();
    if (win) {
      win.webContents.send('updater-event', state);
    }
  });
  startAutoUpdateChecks();
  mainWindow = createWindow();
  ensureTray();
});

app.on('window-all-closed', () => {
  if (!tray) {
    isQuitting = true;
    app.quit();
  }
});

ipcMain.handle('get-ports', async () => {
  try {
    const ports = await getPorts();
    return { ok: true, data: ports };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
});

ipcMain.handle('kill-process', async (_event, rawPayload) => {
  const payload = parseKillPayload(rawPayload);
  const pid = payload.pid;
  if (Number.isNaN(pid)) {
    return { ok: false, error: 'Invalid PID' };
  }
  return killWithPolicy(payload);
});

ipcMain.handle('check-for-updates', () => checkForUpdatesManual());
ipcMain.handle('get-update-state', () => getLastUpdateState());
ipcMain.handle('install-downloaded-update', () => {
  isQuitting = true;
  try {
    installDownloadedUpdate();
    return { ok: true };
  } catch (error) {
    isQuitting = false;
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
ipcMain.handle('clipboard-write-text', (_event, text) => {
  try {
    clipboard.writeText(String(text ?? ''));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
ipcMain.handle('get-release-notes', async (_event, version) => fetchReleaseNotesForVersion(version));
ipcMain.handle('get-settings', () => settingsStore.read());
ipcMain.handle('set-settings', (_event, patch) => {
  const next = settingsStore.write(sanitizeSettings(patch));
  ensureTray();
  updateTrayMenu();
  return next;
});
ipcMain.handle('get-kill-history', () => ({ ok: true, data: [...killHistory] }));
ipcMain.handle('free-protected-ports', async () => runFreeProtectedPorts('renderer'));