// ============================================================
// Top Header Bar
// Shows: page title | date + time | back button | dark mode
// ============================================================

import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, Moon, Sun, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

const ROUTE_TITLES: Record<string, string> = {
    '/': 'الرئيسية',
    '/pos': 'نقطة البيع',
    '/sales': 'المبيعات',
    '/returns': 'المرتجعات',
    '/mobiles': 'الموبيلات وإكسسوارات',
    '/computers': 'الكمبيوترات وإكسسوارات',
    '/devices': 'الأجهزة وإكسسوارات',
    '/cars': 'السيارات',
    '/warehouse': 'المستودع',
    '/barcodes': 'طباعة الباركود',
    '/maintenance': 'الصيانة',
    '/installments': 'التقسيط',
    '/expenses': 'المصروفات',
    '/damaged': 'الهالك',
    '/other-revenue': 'أرباح أخرى',
    '/settings': 'الإعدادات',
    '/users': 'إدارة المستخدمين',
    '/customers': 'إدارة العملاء',
    '/wallets': 'المحافظ والخزنة',
    '/employees': 'الموظفين والرواتب',
    '/help': 'المساعدة والدليل',
};

export default function TopHeader() {
    const location = useLocation();
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(timer);
    }, []);

    const pageTitle = ROUTE_TITLES[location.pathname] || 'الرئيسية';
    const isRoot = location.pathname === '/';
    const dateStr = now.toLocaleDateString('ar-EG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
    const timeStr = now.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });

    return (
        <header className="hidden md:flex items-center gap-3 px-5 py-2.5 bg-background border-b border-border/50 shrink-0 z-10">

            {/* Page title */}
            <h1 className="text-base font-extrabold text-foreground tracking-tight flex-1 truncate">
                {pageTitle}
            </h1>

            {/* Right side: Date/Time | Back | Dark Mode */}
            <div className="flex items-center gap-2 shrink-0">

                {/* Date & Time chip */}
                <div className="flex items-center gap-1.5 bg-muted/60 border border-border/40 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-bold text-foreground">{timeStr}</span>
                    <span className="text-border/60">|</span>
                    <span>{dateStr}</span>
                </div>

                {/* Back button — shown only when not on root */}
                {!isRoot && (
                    <button
                        onClick={() => navigate(-1)}
                        title="رجوع"
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground border border-border/40 bg-muted/60 hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                        <span>رجوع</span>
                    </button>
                )}

                {/* Dark mode toggle */}
                <button
                    onClick={toggleTheme}
                    title={theme === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                    {theme === 'light'
                        ? <Moon className="h-4 w-4" />
                        : <Sun className="h-4 w-4 text-amber-400" />
                    }
                </button>
            </div>
        </header>
    );
}
