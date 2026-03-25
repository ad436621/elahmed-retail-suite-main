// ============================================================
// Notification Bell — جرس التنبيهات
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, PackageX, Check, X } from 'lucide-react';
import { type StockAlert } from '@/hooks/useStockAlerts';

interface NotificationBellProps {
  alerts: StockAlert[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export function NotificationBell({ alerts, unreadCount, onMarkAsRead, onMarkAllAsRead }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative" dir="rtl">
      {/* Bell Button */}
      <button
        onClick={() => setOpen(s => !s)}
        className={`relative rounded-xl p-2 transition-all ${
          unreadCount > 0
            ? 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-500/15 animate-pulse'
            : 'text-muted-foreground hover:bg-muted'
        }`}
        title="التنبيهات"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-lg">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 max-h-96 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden z-[999] animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">التنبيهات</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5">
                  {unreadCount} جديد
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground text-[10px] font-semibold"
                  title="تعليم الكل كمقروء"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Alerts List */}
          <div className="overflow-y-auto max-h-72 divide-y divide-border/50">
            {alerts.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <Bell className="h-10 w-10 mx-auto mb-3 opacity-15" />
                <p className="text-sm font-medium">لا توجد تنبيهات</p>
              </div>
            ) : (
              alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${
                    alert.read ? 'bg-transparent' : 'bg-amber-50/50 dark:bg-amber-500/5'
                  } hover:bg-muted/50`}
                  onClick={() => onMarkAsRead(alert.id)}
                >
                  <div className={`shrink-0 h-8 w-8 rounded-xl flex items-center justify-center ${
                    alert.type === 'out_of_stock'
                      ? 'bg-red-100 dark:bg-red-500/15 text-red-500'
                      : 'bg-amber-100 dark:bg-amber-500/15 text-amber-500'
                  }`}>
                    {alert.type === 'out_of_stock' ? (
                      <PackageX className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      {alert.productName}
                    </p>
                    <p className={`text-[11px] font-semibold ${
                      alert.type === 'out_of_stock' ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {alert.type === 'out_of_stock'
                        ? '❌ نفذ من المخزون'
                        : `⚠️ الكمية ${alert.currentQty} (الحد ${alert.minStock})`
                      }
                    </p>
                  </div>
                  {!alert.read && (
                    <span className="shrink-0 mt-1 h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
