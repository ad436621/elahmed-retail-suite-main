import { useEffect, useRef, useState } from 'react';
import { Bell, Check, AlertTriangle, CircleDot, X } from 'lucide-react';
import { type AiNotification } from '@/data/aiNotificationsData';

interface NotificationBellProps {
    notifications: AiNotification[];
    unreadCount: number;
    lastRunAt?: string;
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
}

function priorityClasses(priority: AiNotification['priority']): string {
    if (priority === 'high') return 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400';
    if (priority === 'medium') return 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400';
    return 'bg-sky-100 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400';
}

export function NotificationBell({ notifications, unreadCount, lastRunAt, onMarkAsRead, onMarkAllAsRead }: NotificationBellProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    return (
        <div ref={ref} className="relative" dir="rtl">
            <button
                onClick={() => setOpen((value) => !value)}
                className={`relative rounded-xl p-2 transition-all ${unreadCount > 0 ? 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-500/15' : 'text-muted-foreground hover:bg-muted'}`}
                title="الإشعارات الذكية"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-lg">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute left-0 top-full mt-2 w-[28rem] max-h-[32rem] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden z-[999] animate-scale-in">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                        <div>
                            <div className="flex items-center gap-2">
                                <Bell className="h-4 w-4 text-primary" />
                                <span className="text-sm font-bold">الإشعارات الذكية</span>
                                {unreadCount > 0 && <span className="rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5">{unreadCount} جديد</span>}
                            </div>
                            {lastRunAt && <p className="text-[10px] text-muted-foreground mt-1">آخر تحليل: {new Date(lastRunAt).toLocaleString('ar-EG')}</p>}
                        </div>
                        <div className="flex gap-1">
                            {unreadCount > 0 && (
                                <button onClick={onMarkAllAsRead} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground" title="تعليم الكل كمقروء">
                                    <Check className="h-3.5 w-3.5" />
                                </button>
                            )}
                            <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-y-auto max-h-[26rem] divide-y divide-border/50">
                        {notifications.length === 0 ? (
                            <div className="py-10 text-center text-muted-foreground">
                                <Bell className="h-10 w-10 mx-auto mb-3 opacity-15" />
                                <p className="text-sm font-medium">لا توجد إشعارات حالياً</p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <button
                                    key={notification.id}
                                    type="button"
                                    onClick={() => onMarkAsRead(notification.id)}
                                    className={`w-full text-right flex items-start gap-3 px-4 py-3 transition-colors ${notification.read ? 'bg-transparent' : 'bg-amber-50/50 dark:bg-amber-500/5'} hover:bg-muted/50`}
                                >
                                    <div className={`shrink-0 h-9 w-9 rounded-xl flex items-center justify-center ${priorityClasses(notification.priority)}`}>
                                        {notification.priority === 'high' ? <AlertTriangle className="h-4 w-4" /> : <CircleDot className="h-4 w-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-bold text-foreground">{notification.title}</p>
                                            <span className="text-[10px] font-bold text-muted-foreground">{notification.priority === 'high' ? 'عالية' : notification.priority === 'medium' ? 'متوسطة' : 'منخفضة'}</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-1 leading-5">{notification.details}</p>
                                        <p className="text-[11px] text-primary font-semibold mt-1">توصية AI: {notification.recommendation}</p>
                                    </div>
                                    {!notification.read && <span className="shrink-0 mt-2 h-2 w-2 rounded-full bg-primary" />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
