"use strict";
const electron = require("electron");
const listenerMap = /* @__PURE__ */ new Map();
function getChannelListeners(channel) {
  let listeners = listenerMap.get(channel);
  if (!listeners) {
    listeners = /* @__PURE__ */ new WeakMap();
    listenerMap.set(channel, listeners);
  }
  return listeners;
}
electron.contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    invoke: (channel, ...args) => electron.ipcRenderer.invoke(channel, ...args),
    sendSync: (channel, ...args) => electron.ipcRenderer.sendSync(channel, ...args),
    on: (channel, listener) => {
      const wrappedListener = (_event, ...args) => listener(...args);
      getChannelListeners(channel).set(listener, wrappedListener);
      electron.ipcRenderer.on(channel, wrappedListener);
    },
    removeListener: (channel, listener) => {
      const channelListeners = getChannelListeners(channel);
      const wrappedListener = channelListeners.get(listener);
      if (!wrappedListener) {
        return;
      }
      electron.ipcRenderer.removeListener(channel, wrappedListener);
      channelListeners.delete(listener);
    }
  }
});
