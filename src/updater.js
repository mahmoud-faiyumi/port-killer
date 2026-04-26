const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

function startAutoUpdateChecks() {
  if (process.platform !== 'win32') {
    return;
  }
  if (!app.isPackaged) {
    return;
  }
  try {
    autoUpdater.on('error', (err) => {
      console.warn('[updater]', err?.message ?? err);
    });
    autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    console.warn('[updater] failed to start', e);
  }
}

module.exports = { startAutoUpdateChecks };
