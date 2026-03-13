"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    invoke: (channel, ...args) => electron.ipcRenderer.invoke(channel, ...args),
    sendSync: (channel, ...args) => electron.ipcRenderer.sendSync(channel, ...args),
    on: (channel, listener) => {
      electron.ipcRenderer.on(channel, (event, ...args) => listener(...args));
    },
    removeListener: (channel, listener) => {
      electron.ipcRenderer.removeListener(channel, listener);
    }
  }
});
