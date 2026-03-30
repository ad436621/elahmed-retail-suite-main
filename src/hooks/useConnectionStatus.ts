import { useState, useEffect } from 'react';
import { hasElectronIpc } from '@/lib/electronDataBridge';

export function useConnectionStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    if (!hasElectronIpc()) return;

    const checkConnection = async () => {
      const start = performance.now();
      try {
        // Send a ping to the main process
        await window.electron?.ipcRenderer.invoke('ping');
        const end = performance.now();
        setLatency(Math.round(end - start));
        setIsConnected(true);
      } catch (err) {
        setIsConnected(false);
      }
    };

    checkConnection();
    // Check connection every 10 seconds
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  return { isConnected, latency };
}
