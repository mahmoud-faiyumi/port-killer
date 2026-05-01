const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('portKiller', {
  getPorts() {
    return ipcRenderer.invoke('get-ports');
  },
  killProcess(payload) {
    return ipcRenderer.invoke('kill-process', payload);
  },
  checkForUpdates() {
    return ipcRenderer.invoke('check-for-updates');
  },
  getUpdateState() {
    return ipcRenderer.invoke('get-update-state');
  },
  installDownloadedUpdate() {
    return ipcRenderer.invoke('install-downloaded-update');
  },
  getSettings() {
    return ipcRenderer.invoke('get-settings');
  },
  setSettings(patch) {
    return ipcRenderer.invoke('set-settings', patch);
  },
  freeProtectedPorts() {
    return ipcRenderer.invoke('free-protected-ports');
  },
  getKillHistory() {
    return ipcRenderer.invoke('get-kill-history');
  },
  onTrayRefresh(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }
    const listener = () => callback();
    ipcRenderer.on('tray-refresh', listener);
    return () => ipcRenderer.removeListener('tray-refresh', listener);
  },
  onHistoryUpdated(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }
    const listener = () => callback();
    ipcRenderer.on('history-updated', listener);
    return () => ipcRenderer.removeListener('history-updated', listener);
  },
  onUpdaterEvent(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('updater-event', listener);
    return () => ipcRenderer.removeListener('updater-event', listener);
  },
  writeClipboard(text) {
    return ipcRenderer.invoke('clipboard-write-text', text);
  },
  getReleaseNotes(version) {
    return ipcRenderer.invoke('get-release-notes', version);
  },
});
