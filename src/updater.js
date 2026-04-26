const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

/**
 * Background checks and desktop notifications (Windows/macOS) when a new version
 * is available. NSIS + electron-builder `publish` + hosted `latest.yml` required.
 * No-op in development (`npm start`).
 */
function startAutoUpdateChecks() {
  if (!app.isPackaged) {
    return;
  }
  try {
    autoUpdater.on('error', (err) => {
      // Log only; do not break the app for offline users or config mistakes
      // eslint-disable-next-line no-console
      console.warn('[updater]', err?.message ?? err);
    });
    autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[updater] failed to start', e);
  }
}

module.exports = { startAutoUpdateChecks };
