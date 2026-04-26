const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('portKiller', {
  getPorts() {
    return ipcRenderer.invoke('get-ports');
  },
  killProcess(pid) {
    return ipcRenderer.invoke('kill-process', pid);
  },
});
