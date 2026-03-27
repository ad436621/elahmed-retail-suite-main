export function hasElectronIpc(): boolean {
  return typeof window !== 'undefined' && !!window.electron?.ipcRenderer;
}

export function emitDataChange(key: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('local-storage', { detail: { key } }));
}

export function callElectronSync<T = unknown>(channel: string, ...args: unknown[]): T | null {
  if (!hasElectronIpc()) return null;

  try {
    return window.electron!.ipcRenderer.sendSync(channel, ...args) as T;
  } catch {
    return null;
  }
}

export function readElectronSync<T>(channel: string, fallback: T, ...args: unknown[]): T {
  const result = callElectronSync<T>(channel, ...args);
  return result ?? fallback;
}
