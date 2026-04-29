const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

let errorLoggingAttached = false;

function attachAutoUpdaterErrorLogging() {
  if (errorLoggingAttached) {
    return;
  }
  errorLoggingAttached = true;
  autoUpdater.on('error', (err) => {
    console.warn('[updater]', err?.message ?? err);
  });
}

function startAutoUpdateChecks() {
  if (!app.isPackaged) {
    return;
  }
  attachAutoUpdaterErrorLogging();
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    console.warn('[updater] failed to start', e);
  }
}

async function checkForUpdatesManual() {
  if (!app.isPackaged) {
    return {
      ok: false,
      reason: 'not-applicable',
      message: 'Install the Windows app to check for updates (not available in dev mode).',
    };
  }
  attachAutoUpdaterErrorLogging();
  try {
    const result = await autoUpdater.checkForUpdates();
    if (result == null) {
      return {
        ok: false,
        reason: 'error',
        message: 'Update check did not run (updater inactive).',
      };
    }
    if (result.isUpdateAvailable === true && result.updateInfo && result.updateInfo.version) {
      return {
        ok: true,
        status: 'available',
        version: result.updateInfo.version,
      };
    }
    return { ok: true, status: 'up-to-date' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: 'error', message };
  }
}

module.exports = { startAutoUpdateChecks, checkForUpdatesManual };
