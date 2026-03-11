// ============================================================
// Top Header Bar — ELOS-style
// Live HH:MM:SS clock | date | back | dark mode toggle
// ============================================================

import { useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

const ROUTE_TITLES: Record<string, string> = {
    '/': 'الرئيسية',
    '/pos': 'نقطة البيع',
    '/sales': 'المبيعات',
    '/returns': 'المرتجعات',
    '/mobiles': 'الموبيلات وإكسسوارات',
    '/mobiles/accessories': 'إكسسوارات الموبيلات',
    '/mobiles/spare-parts': 'قطع غيار الموبيلات',
    '/computers': 'الكمبيوترات وإكسسوارات',
    '/computers/accessories': 'إكسسوارات الكمبيوترات',
    '/computers/spare-parts': 'قطع غيار الكمبيوترات',
    '/devices': 'الأجهزة وإكسسوارات',
    '/devices/accessories': 'إكسسوارات الأجهزة',
    '/devices/spare-parts': 'قطع غيار الأجهزة',
    '/cars': 'السيارات',
    '/cars/spare-parts': 'قطع غيار السيارات',
    '/cars/oils': 'زيوت السيارات',
    '/warehouse': 'المستودع',
    '/used-inventory': 'المخزون المستعمل',
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
    '/suppliers': 'الموردون',
    '/blacklist': 'القائمة السوداء',
    '/reminders': 'التذكيرات',
    '/shift-closing': 'إقفال الوردية',
    '/purchase-invoices': 'فواتير الشراء',
    '/reports': 'التقارير والإحصاءات',
    '/partners': 'الشركاء',
    '/stocktake': 'جرد المخزون',
    '/diagnostics': 'تشخيص النظام',
};

function useLiveClock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1_000);
        return () => clearInterval(t);
    }, []);
    return now;
}

export default function TopHeader() {
    const location = useLocation();
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const now = useLiveClock();

    const pageTitle = ROUTE_TITLES[location.pathname] || 'الرئيسية';
    const isRoot = location.pathname === '/';

    const timeStr = now.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });
    const dateStr = now.toLocaleDateString('ar-EG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });

    return (
        <header className="hidden md:flex items-center gap-3 px-5 py-2 bg-background border-b border-border/50 shrink-0 z-10">

            {/* Page title */}
            <h1 className="text-base font-extrabold text-foreground tracking-tight flex-1 truncate">
                {pageTitle}
            </h1>

            {/* Right side */}
            <div className="flex items-center gap-2 shrink-0">

                {/* ELOS-style live clock card */}
                <div
                    className="flex flex-col items-center px-3 py-1 rounded-xl border transition-all hover:-translate-y-0.5 cursor-default"
                    style={{
                        background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.08) 100%)',
                        borderColor: 'rgba(59,130,246,0.25)',
                    }}
                >
                    <span
                        className="font-black text-sm tracking-widest leading-none"
                        style={{ fontFamily: "'Courier New', monospace", color: 'hsl(var(--primary))' }}
                    >
                        {timeStr}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium leading-tight mt-0.5">
                        {dateStr}
                    </span>
                </div>

                {/* Back button */}
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

                {/* Theme toggle */}
                <button
                    onClick={toggleTheme}
                    title={theme === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-all hover:scale-110"
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
