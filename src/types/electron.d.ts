export interface IElectronAPI {
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    sendSync: (channel: string, ...args: unknown[]) => unknown;
    on: (channel: string, listener: (...args: unknown[]) => void) => void;
    removeListener: (channel: string, listener: (...args: unknown[]) => void) => void;
  };
}

declare global {
  interface Window {
    electron?: IElectronAPI;
  }
}
