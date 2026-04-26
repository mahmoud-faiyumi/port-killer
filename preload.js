const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('portKiller', {
  getPorts() {
    return ipcRenderer.invoke('get-ports');
  },
  /**
   * @param {number} pid
   */
  killProcess(pid) {
    return ipcRenderer.invoke('kill-process', pid);
  },
});
