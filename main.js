const fs = require('node:fs');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');

const { getPorts } = require('./src/portScanner');
const { killProcessByPid } = require('./src/processKiller');
const { startAutoUpdateChecks, checkForUpdatesManual } = require('./src/updater');

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
  const mainWindow = new BrowserWindow({
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(getRendererPath());

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url) {
      shell.openExternal(details.url).catch(() => {});
    }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  startAutoUpdateChecks();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
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

ipcMain.handle('kill-process', async (_event, rawPid) => {
  const pid = typeof rawPid === 'string' ? Number.parseInt(rawPid, 10) : rawPid;
  if (Number.isNaN(pid)) {
    return { ok: false, error: 'Invalid PID' };
  }
  return killProcessByPid(pid);
});

ipcMain.handle('check-for-updates', () => checkForUpdatesManual());