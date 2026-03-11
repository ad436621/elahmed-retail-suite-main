// ============================================================
// HeldInvoicesPanel — Full modal overlay for held invoices
// Rewritten to be a proper modal overlay with correct props
// ============================================================

import { X, Clock, ShoppingCart, RotateCcw, Trash2 } from 'lucide-react';
import type { HeldInvoice } from '@/contexts/CartContext';

interface HeldInvoicesPanelProps {
    heldInvoices: HeldInvoice[];
    onRestore: (id: string) => void;
    onRemove: (id: string) => void;
    onClose: () => void;
}

export default function HeldInvoicesPanel({ heldInvoices, onRestore, onRemove, onClose }: HeldInvoicesPanelProps) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            role="dialog"
            aria-modal="true"
            aria-label="الفواتير المعلقة"
        >
            <div
                className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
                dir="rtl"
            >
                {/* Header */}
                <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="font-black text-foreground">الفواتير المعلقة</h2>
                            <p className="text-xs text-muted-foreground">{heldInvoices.length} فاتورة معلقة</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="إغلاق الفواتير المعلقة"
                        className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-amber-100 dark:hover:bg-amber-500/20 text-muted-foreground hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>

                {/* List */}
                <div className="max-h-80 overflow-y-auto p-3 space-y-2" role="list">
                    {heldInvoices.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            <ShoppingCart className="h-10 w-10 opacity-20 mx-auto mb-3" aria-hidden="true" />
                            <p className="text-sm font-medium">لا يوجد فواتير معلقة</p>
                        </div>
                    ) : heldInvoices.map((invoice) => {
                        const total = invoice.cart.reduce(
                            (sum, item) => sum + item.product.sellingPrice * item.qty, 0
                        ) - invoice.discount;
                        return (
                            <div
                                key={invoice.id}
                                role="listitem"
                                className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-3 hover:bg-muted/50 transition-colors"
                            >
                                <div>
                                    <p className="text-sm font-bold text-foreground">
                                        {invoice.cart.length} منتج
                                        {invoice.customer && <span className="text-muted-foreground font-medium"> · {invoice.customer}</span>}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(invoice.heldAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                        {' — '}
                                        <span className="font-bold text-emerald-600 tabular-nums">{total.toLocaleString('ar-EG')} ج.م</span>
                                    </p>
                                    {invoice.notes && (
                                        <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate max-w-[200px]">{invoice.notes}</p>
                                    )}
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => onRestore(invoice.id)}
                                        aria-label={`استرجاع فاتورة ${invoice.cart.length} منتج`}
                                        className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    >
                                        <RotateCcw className="h-3 w-3" aria-hidden="true" />
                                        استرجاع
                                    </button>
                                    <button
                                        onClick={() => onRemove(invoice.id)}
                                        aria-label="حذف الفاتورة المعلقة"
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="border-t border-border/50 p-3">
                    <button
                        onClick={onClose}
                        className="w-full rounded-xl bg-muted py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted/80 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
}
