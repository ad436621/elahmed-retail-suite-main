// ============================================================
// PaymentStep — Inline payment panel inside the cart sidebar
// State: payment method selection + amount tendered + change
// Keyboard: Enter = confirm, Escape = back
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowRight, CreditCard, Banknote, Shuffle, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PaymentMethodChoice = 'cash' | 'card' | 'split';

interface PaymentStepProps {
    grandTotal: number;
    onConfirm: (method: PaymentMethodChoice, amountTendered: number) => void;
    onBack: () => void;
    isProcessing: boolean;
}

const METHODS: { id: PaymentMethodChoice; label: string; icon: React.ElementType; color: string; activeColor: string }[] = [
    { id: 'cash', label: 'نقدي', icon: Banknote, color: 'border-border/60 bg-card text-muted-foreground hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10', activeColor: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 shadow-sm' },
    { id: 'card', label: 'بطاقة', icon: CreditCard, color: 'border-border/60 bg-card text-muted-foreground hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10', activeColor: 'border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 shadow-sm' },
    { id: 'split', label: 'مختلط', icon: Shuffle, color: 'border-border/60 bg-card text-muted-foreground hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10', activeColor: 'border-violet-500 bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400 shadow-sm' },
];

export default function PaymentStep({ grandTotal, onConfirm, onBack, isProcessing }: PaymentStepProps) {
    const [method, setMethod] = useState<PaymentMethodChoice>('cash');
    const [amountStr, setAmountStr] = useState<string>('');
    const amountRef = useRef<HTMLInputElement>(null);

    // Auto-focus amount input on mount
    useEffect(() => {
        const t = setTimeout(() => amountRef.current?.focus(), 80);
        return () => clearTimeout(t);
    }, []);

    const amountTendered = parseFloat(amountStr) || 0;
    const change = amountTendered - grandTotal;
    const hasEnoughTendered = method === 'card' || method === 'split' || amountTendered >= grandTotal;
    const canConfirm = !isProcessing && (method === 'card' || method === 'split' || amountTendered > 0);

    const handleConfirm = useCallback(() => {
        if (!canConfirm) return;
        const tendered = method === 'cash' ? amountTendered : grandTotal;
        onConfirm(method, tendered);
    }, [canConfirm, method, amountTendered, grandTotal, onConfirm]);

    // Keyboard: Enter = confirm, Escape = back (global within this component)
    useEffect(() => {
        const fn = (e: KeyboardEvent) => {
            if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
            if (e.key === 'Escape') { e.preventDefault(); onBack(); }
        };
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [handleConfirm, onBack]);

    // Quick amount presets for payment (moved to top level)
    const quickAmounts = [
        { label: 'المبلغ الكامل', value: grandTotal, key: 'Enter' },
        { label: '50', value: 50 },
        { label: '100', value: 100 },
        { label: '200', value: 200 },
        { label: '500', value: 500 },
    ].filter((v, i, arr) => v.value > 0 && arr.findIndex(a => a.value === v.value) === i).slice(0, 4);

    return (
        <div className="flex flex-col h-full animate-fade-in" dir="rtl">

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border/50 bg-muted/30 px-4 py-3">
                <button
                    onClick={onBack}
                    aria-label="رجوع إلى السلة"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    <ArrowRight className="h-4 w-4" />
                </button>
                <h2 className="text-base font-black text-foreground">إتمام الدفع</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">

                {/* Total due */}
                <div className="rounded-2xl bg-gradient-to-l from-emerald-600 to-teal-600 p-5 text-white text-center shadow-lg">
                    <p className="text-xs font-bold opacity-75 mb-1">المبلغ المستحق</p>
                    <p className="text-4xl font-black tabular-nums leading-none">
                        {grandTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm font-bold opacity-75 mt-1">جنيه مصري</p>
                </div>

                {/* Payment method selection */}
                <div>
                    <p className="text-xs font-bold text-muted-foreground mb-2">طريقة الدفع</p>
                    <div className="grid grid-cols-3 gap-2">
                        {METHODS.map(({ id, label, icon: Icon, color, activeColor }) => (
                            <button
                                key={id}
                                onClick={() => setMethod(id)}
                                aria-pressed={method === id}
                                aria-label={`طريقة الدفع: ${label}`}
                                className={cn(
                                    'flex flex-col items-center justify-center gap-1.5 rounded-xl border py-3 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                                    method === id ? activeColor : color
                                )}
                            >
                                <Icon className="h-5 w-5" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Amount tendered — only for cash */}
                {method === 'cash' && (
                    <div>
                        <p className="text-xs font-bold text-muted-foreground mb-2">المبلغ المدفوع</p>
                        <div className="relative">
                            <input
                                ref={amountRef}
                                type="number"
                                inputMode="numeric"
                                min={0}
                                step={0.5}
                                value={amountStr}
                                onChange={e => setAmountStr(e.target.value)}
                                placeholder={grandTotal.toFixed(2)}
                                aria-label="المبلغ المدفوع من العميل"
                                className="w-full rounded-xl border-2 border-border bg-card px-4 py-3 text-xl font-black text-center tabular-nums focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">ج.م</span>
                        </div>

                        {/* Quick amount chips */}
                        {quickAmounts.length > 0 && (
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                                {quickAmounts.map(amt => (
                                    <button
                                        key={amt.value}
                                        onClick={() => setAmountStr(amt.value.toString())}
                                        aria-label={`دفع ${amt.label} جنيه`}
                                        className="rounded-lg border border-border/70 bg-muted/50 px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-primary hover:text-white hover:border-primary transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    >
                                        {amt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Card/split info */}
                {method !== 'cash' && (
                    <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-500/10 p-3 text-center">
                        <p className="text-sm font-bold text-blue-700 dark:text-blue-400">
                            {method === 'card' ? '💳 سيتم تحصيل المبلغ بالبطاقة' : '🔀 سيتم تقسيم المدفوعات'}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400/70 mt-0.5">
                            {method === 'card' ? 'لا حاجة لإدخال مبلغ يدوي' : 'سيتم إتمام المعاملة بالمبلغ الكامل'}
                        </p>
                    </div>
                )}

                {/* Change display */}
                {method === 'cash' && amountTendered > 0 && (
                    <div className={cn(
                        'rounded-xl border-2 p-4 text-center transition-all',
                        change >= 0
                            ? 'border-emerald-300 dark:border-emerald-600/50 bg-emerald-50 dark:bg-emerald-500/10'
                            : 'border-red-300 dark:border-red-600/50 bg-red-50 dark:bg-red-500/10'
                    )}>
                        {change >= 0 ? (
                            <>
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">الفكة / الباقي</p>
                                </div>
                                <p className="text-3xl font-black tabular-nums text-emerald-600">
                                    {change.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                                    <span className="text-sm font-bold text-emerald-500 mr-1">ج.م</span>
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                    <p className="text-xs font-bold text-red-600 dark:text-red-400">المبلغ غير كافٍ</p>
                                </div>
                                <p className="text-2xl font-black tabular-nums text-red-600">
                                    ناقص {Math.abs(change).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Confirm button */}
            <div className="border-t border-border/50 bg-card p-4 space-y-2">
                <button
                    onClick={handleConfirm}
                    disabled={!canConfirm || !hasEnoughTendered}
                    aria-label="تأكيد الدفع وإتمام البيع"
                    className={cn(
                        'w-full h-14 rounded-xl text-base font-black flex items-center justify-between px-5 transition-all',
                        canConfirm && hasEnoughTendered
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 active:scale-[0.98]'
                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                    )}
                >
                    <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5" />
                        {isProcessing ? 'جاري المعالجة...' : 'تأكيد الدفع'}
                    </span>
                    <div className="flex items-center gap-2">
                        {/* Show correct amount for card/split */}
                        {method !== 'cash' && (
                            <span className="text-white/80 font-bold">{grandTotal.toLocaleString('ar-EG')} ج.م</span>
                        )}
                        <kbd className="rounded-lg bg-white/20 px-2 py-0.5 text-xs font-mono font-bold">↵</kbd>
                    </div>
                </button>
                <button
                    onClick={onBack}
                    aria-label="رجوع إلى السلة"
                    className="w-full h-9 rounded-xl text-sm font-bold text-muted-foreground hover:bg-muted transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    ← رجوع للسلة
                    <kbd className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono border">Esc</kbd>
                </button>
            </div>
        </div>
    );
}
