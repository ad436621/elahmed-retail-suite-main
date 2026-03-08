// ============================================================
// TransactionSuccess — Full-panel success overlay
// Displays for 2.5 seconds then auto-clears, or dismiss on click
// ============================================================

import { useEffect } from 'react';
import { CheckCircle2, Receipt } from 'lucide-react';

interface TransactionSuccessProps {
    invoiceNumber: string;
    grandTotal: number;
    paymentMethod: string;
    change: number;
    onDismiss: () => void;
}

const METHOD_LABELS: Record<string, string> = {
    cash: 'نقدي',
    card: 'بطاقة',
    split: 'مختلط',
};

export default function TransactionSuccess({
    invoiceNumber,
    grandTotal,
    paymentMethod,
    change,
    onDismiss,
}: TransactionSuccessProps) {
    // Auto-dismiss after 2.5 seconds
    useEffect(() => {
        const t = setTimeout(onDismiss, 2500);
        return () => clearTimeout(t);
    }, [onDismiss]);

    // Allow Enter or Space to dismiss early
    useEffect(() => {
        const fn = (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
                e.preventDefault();
                onDismiss();
            }
        };
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [onDismiss]);

    return (
        <button
            className="flex flex-col h-full w-full items-center justify-center gap-6 animate-fade-in cursor-pointer bg-card focus:outline-none"
            onClick={onDismiss}
            aria-label="تمت العملية بنجاح - اضغط للمتابعة"
        >
            {/* Big success icon */}
            <div className="relative">
                <div className="h-24 w-24 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center animate-scale-in shadow-xl shadow-emerald-500/20">
                    <CheckCircle2 className="h-14 w-14 text-emerald-600 dark:text-emerald-400" />
                </div>
                {/* Ripple */}
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            </div>

            {/* Labels */}
            <div className="text-center space-y-1">
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">تمت العملية!</p>
                <p className="text-sm font-bold text-muted-foreground">{invoiceNumber}</p>
            </div>

            {/* Transaction detail chips */}
            <div className="flex flex-col items-center gap-2 w-full px-6">
                <div className="flex items-center justify-between w-full rounded-xl bg-muted/50 border border-border/50 px-4 py-3">
                    <span className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                        <Receipt className="h-4 w-4" /> المبلغ
                    </span>
                    <span className="text-lg font-black text-foreground tabular-nums">
                        {grandTotal.toLocaleString('ar-EG')} ج.م
                    </span>
                </div>

                <div className="flex items-center justify-between w-full rounded-xl bg-muted/50 border border-border/50 px-4 py-2">
                    <span className="text-xs font-bold text-muted-foreground">طريقة الدفع</span>
                    <span className="text-sm font-bold text-foreground">{METHOD_LABELS[paymentMethod] ?? paymentMethod}</span>
                </div>

                {change > 0 && (
                    <div className="flex items-center justify-between w-full rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-4 py-2">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">الفكة</span>
                        <span className="text-sm font-black tabular-nums text-emerald-600">
                            {change.toLocaleString('ar-EG')} ج.م
                        </span>
                    </div>
                )}
            </div>

            <p className="text-xs text-muted-foreground/60 font-medium">اضغط للمتابعة</p>
        </button>
    );
}
