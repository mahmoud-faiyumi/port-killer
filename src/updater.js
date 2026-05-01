const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

let errorLoggingAttached = false;
let updaterEventsAttached = false;
let lastUpdateState = { status: 'idle' };
const updateStateSubscribers = new Set();

const MAX_DOWNLOAD_RETRIES = 5;
let downloadRetryTimer = null;
let downloadRetryCount = 0;

function clearDownloadRetryTimer() {
  if (downloadRetryTimer != null) {
    clearTimeout(downloadRetryTimer);
    downloadRetryTimer = null;
  }
}

function resetDownloadRetries() {
  clearDownloadRetryTimer();
  downloadRetryCount = 0;
}

function isLikelyNetworkError(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('net::') ||
    m.includes('network') ||
    m.includes('enotfound') ||
    m.includes('econnrefused') ||
    m.includes('econnreset') ||
    m.includes('etimedout') ||
    m.includes('offline') ||
    m.includes('getaddrinfo') ||
    m.includes('socket') ||
    m.includes('429')
  );
}

function emitUpdateState(nextState) {
  lastUpdateState = { ...nextState };
  for (const subscriber of updateStateSubscribers) {
    try {
      subscriber(lastUpdateState);
    } catch {}
  }
}

function attachAutoUpdaterEvents() {
  if (updaterEventsAttached) {
    return;
  }
  updaterEventsAttached = true;

  autoUpdater.on('checking-for-update', () => {
    emitUpdateState({ status: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    emitUpdateState({
      status: 'available',
      version: info?.version != null ? String(info.version) : undefined,
    });
  });
  autoUpdater.on('download-progress', (progressObj) => {
    resetDownloadRetries();
    emitUpdateState({
      status: 'downloading',
      percent: Number.isFinite(progressObj?.percent) ? Number(progressObj.percent) : 0,
      transferred: Number.isFinite(progressObj?.transferred) ? Number(progressObj.transferred) : 0,
      total: Number.isFinite(progressObj?.total) ? Number(progressObj.total) : 0,
      bytesPerSecond: Number.isFinite(progressObj?.bytesPerSecond) ? Number(progressObj.bytesPerSecond) : 0,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    resetDownloadRetries();
    emitUpdateState({
      status: 'downloaded',
      version: info?.version != null ? String(info.version) : undefined,
    });
  });
  autoUpdater.on('update-not-available', () => {
    resetDownloadRetries();
    emitUpdateState({ status: 'up-to-date' });
  });
  autoUpdater.on('error', (err) => {
    const message = err instanceof Error ? err.message : String(err);
    if (isLikelyNetworkError(message) && downloadRetryCount < MAX_DOWNLOAD_RETRIES) {
      downloadRetryCount += 1;
      const delayMs = Math.min(60000, 2000 * 2 ** (downloadRetryCount - 1));
      emitUpdateState({
        status: 'retrying',
        attempt: downloadRetryCount,
        maxAttempts: MAX_DOWNLOAD_RETRIES,
        nextRetryMs: delayMs,
        message: `Unable to reach update server (offline or unstable network). Retrying in ${Math.round(delayMs / 1000)}s (${downloadRetryCount}/${MAX_DOWNLOAD_RETRIES})…`,
      });
      clearDownloadRetryTimer();
      downloadRetryTimer = setTimeout(() => {
        downloadRetryTimer = null;
        try {
          autoUpdater.checkForUpdates().catch(() => {});
        } catch {
          /* ignore */
        }
      }, delayMs);
      return;
    }
    resetDownloadRetries();
    emitUpdateState({
      status: 'error',
      message,
    });
  });
}

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
  attachAutoUpdaterEvents();
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    console.warn('[updater] failed to start', e);
  }
}

async function checkForUpdatesManual() {
  if (!app.isPackaged) {
    emitUpdateState({
      status: 'error',
      message: 'Install the Windows app to check for updates (not available in dev mode).',
    });
    return {
      ok: false,
      reason: 'not-applicable',
      message: 'Install the Windows app to check for updates (not available in dev mode).',
    };
  }
  attachAutoUpdaterErrorLogging();
  attachAutoUpdaterEvents();
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

function subscribeToUpdateState(onState) {
  if (typeof onState !== 'function') {
    return () => {};
  }
  updateStateSubscribers.add(onState);
  onState(lastUpdateState);
  return () => {
    updateStateSubscribers.delete(onState);
  };
}

function getLastUpdateState() {
  return { ...lastUpdateState };
}

function installDownloadedUpdate() {
  autoUpdater.quitAndInstall(false, true);
}

module.exports = {
  startAutoUpdateChecks,
  checkForUpdatesManual,
  subscribeToUpdateState,
  getLastUpdateState,
  installDownloadedUpdate,
};
