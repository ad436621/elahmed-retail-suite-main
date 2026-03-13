export interface IElectronAPI {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    sendSync: (channel: string, ...args: any[]) => any;
    on: (channel: string, listener: (...args: any[]) => void) => void;
    removeListener: (channel: string, listener: (...args: any[]) => void) => void;
  };
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}
