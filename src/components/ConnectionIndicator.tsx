import { Wifi, WifiOff } from 'lucide-react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { hasElectronIpc } from '@/lib/electronDataBridge';

export default function ConnectionIndicator() {
  const { isConnected, latency } = useConnectionStatus();

  // Only render in Electron
  if (!hasElectronIpc()) return null;

  if (!isConnected) {
    return (
      <div 
        className="flex items-center gap-1.5 text-xs font-semibold text-destructive px-2.5 py-1 rounded-full bg-destructive/10 animate-pulse border border-destructive/20 select-none cursor-default" 
        title="غير متصل بقاعدة البيانات"
      >
        <WifiOff className="h-3.5 w-3.5" />
        <span>غير متصل</span>
      </div>
    );
  }

  // Determine color based on latency
  const colorClass = latency < 50 ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                   : latency < 150 ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                   : 'text-rose-500 bg-rose-500/10 border-rose-500/20';

  return (
    <div 
      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border select-none cursor-default transition-colors ${colorClass}`} 
      title={`متصل (${latency}ms)`}
    >
      <Wifi className="h-3.5 w-3.5" />
      <span>متصل</span>
      {latency > 0 && <span className="text-[10px] opacity-70 border-r border-current pr-1.5 ml-0.5">{latency}ms</span>}
    </div>
  );
}
