// ============================================================
// OrderSummaryPanel — Subtotal / Discounts / Grand Total display
// + Invoice discount input
// ============================================================

import { Percent, Receipt, TrendingDown } from 'lucide-react';

interface OrderSummaryPanelProps {
    subtotal: number;
    lineDiscountsTotal: number;
    invoiceDiscount: number;
    maxInvoiceDiscount: number;
    grandTotal: number;
    cartLength: number;
    onDiscountChange: (v: number) => void;
}

export default function OrderSummaryPanel({
    subtotal,
    lineDiscountsTotal,
    invoiceDiscount,
    maxInvoiceDiscount,
    grandTotal,
    cartLength,
    onDiscountChange,
}: OrderSummaryPanelProps) {
    return (
        <div className="border-t border-border/50 bg-white dark:bg-card p-4 space-y-3">

            {/* Subtotal */}
            <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-muted-foreground">المجموع الفرعي</span>
                <span className="font-bold tabular-nums">{subtotal.toLocaleString('ar-EG')} ج.م</span>
            </div>

            {/* Line discounts */}
            {lineDiscountsTotal > 0 && (
                <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-amber-500 flex items-center gap-1">
                        <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                        خصم الأصناف
                    </span>
                    <span className="font-bold text-amber-500 tabular-nums">
                        − {lineDiscountsTotal.toLocaleString('ar-EG')} ج.م
                    </span>
                </div>
            )}

            {/* Invoice discount */}
            <div className="rounded-xl border border-dashed border-orange-200 dark:border-orange-800/30 bg-orange-50/50 dark:bg-orange-900/10 p-3">
                <div className="flex items-center justify-between mb-2">
                    <label
                        htmlFor="invoice-discount-input"
                        className="flex items-center gap-1.5 text-xs font-bold text-orange-700 dark:text-orange-400 cursor-pointer"
                    >
                        <Percent className="h-3.5 w-3.5" aria-hidden="true" />
                        خصم الفاتورة الكلي
                    </label>
                    {invoiceDiscount > 0 && (
                        <button
                            onClick={() => onDiscountChange(0)}
                            aria-label="مسح خصم الفاتورة"
                            className="text-[10px] text-red-400 hover:text-red-600 font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400 rounded"
                        >
                            مسح
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <input
                        id="invoice-discount-input"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={maxInvoiceDiscount}
                        step={0.5}
                        value={invoiceDiscount || ''}
                        disabled={cartLength === 0}
                        onChange={e =>
                            onDiscountChange(Math.min(Math.max(0, Number(e.target.value)), maxInvoiceDiscount))
                        }
                        placeholder={`حتى ${maxInvoiceDiscount.toFixed(0)} ج.م`}
                        aria-label={`خصم الفاتورة الكلي — الحد الأقصى ${maxInvoiceDiscount.toFixed(0)} جنيه`}
                        className="flex-1 rounded-lg border border-orange-200 bg-white dark:bg-card px-3 py-1.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50 transition-all tabular-nums"
                    />
                    <span className="text-xs text-orange-600 font-bold shrink-0">ج.م</span>
                </div>
            </div>

            {/* Grand total */}
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 border border-emerald-100 dark:border-emerald-500/20">
                <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300">
                    <Receipt className="h-5 w-5" aria-hidden="true" />
                    الإجمالي
                </div>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {grandTotal.toLocaleString('ar-EG')} ج.م
                </span>
            </div>
        </div>
    );
}
