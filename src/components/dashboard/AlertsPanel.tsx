// ============================================================
// AlertsPanel — Low stock warnings + overdue installments
// Extracted from Dashboard.tsx for maintainability
// ============================================================

import { Link } from 'react-router-dom';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { SectionLabel } from './DashboardWidgets';

interface LowStockItem {
    name: string;
    qty: number;
    cat: string;
}

interface AlertsPanelProps {
    lowStockItems: LowStockItem[];
    overdueContracts: number;
    totalRemainingDebt: number;
}

export function AlertsPanel({ lowStockItems, overdueContracts, totalRemainingDebt }: AlertsPanelProps) {
    const fmt = (n: number) =>
        n >= 1_000_000
            ? (n / 1_000_000).toLocaleString('ar-EG', { maximumFractionDigits: 1 }) + ' م'
            : n >= 1_000
                ? (n / 1_000).toLocaleString('ar-EG', { maximumFractionDigits: 1 }) + ' ك'
                : n.toLocaleString('ar-EG');

    if (lowStockItems.length === 0 && overdueContracts === 0) return null;

    return (
        <div className="space-y-4">
            {/* Low Stock Alert */}
            {lowStockItems.length > 0 && (
                <div>
                    <SectionLabel
                        title="تنبيه: مخزون منخفض"
                        sub={`${lowStockItems.length} منتج بحاجة لإعادة شراء`}
                    />
                    <div
                        role="alert"
                        aria-label="تنبيه مخزون منخفض"
                        className="rounded-2xl border border-amber-500/30 bg-amber-500/5 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                    >
                        {lowStockItems.map((item, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 px-4 py-2.5 border-b border-amber-500/20 last:border-0 hover:bg-amber-500/10 transition-colors"
                            >
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-hidden="true" />
                                <span className="flex-1 text-sm font-medium text-foreground truncate">{item.name}</span>
                                <span className="text-xs font-bold text-amber-500 shrink-0 tabular-nums">{item.qty} وحدة</span>
                                <span className="text-[10px] text-muted-foreground shrink-0">{item.cat}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Overdue installments alert */}
            {overdueContracts > 0 && (
                <Link
                    to="/installments"
                    className="flex items-center gap-3 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/5 p-4 hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors"
                    aria-label={`${overdueContracts} عقود تقسيط متأخرة — اضغط للعرض`}
                >
                    <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
                        <CreditCard className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-red-700 dark:text-red-400">
                            {overdueContracts} عقد تقسيط متأخر
                        </p>
                        <p className="text-xs text-red-600/70 dark:text-red-400/70">
                            متبقي: {fmt(totalRemainingDebt)} ج.م
                        </p>
                    </div>
                </Link>
            )}
        </div>
    );
}
