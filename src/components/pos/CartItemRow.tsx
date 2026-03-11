// ============================================================
// CartItemRow — Enhanced with direct input and better UX
// Fixes vs original:
//   - Direct quantity input on single click (not just double-click)
//   - Better keyboard navigation: +/-/Delete when focused
//   - Added focus-visible ring
//   - Added aria-labels to all icon buttons (WCAG AA)
//   - Larger touch targets for quantity controls (44x44px minimum)
//   - Keyboard shortcuts: + / - to adjust, Delete to remove
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { Minus, Plus, Trash2, Percent, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartItem } from '@/domain/types';

interface CartItemRowProps {
    item: CartItem;
    onUpdateQty: (id: string, qty: number) => void;
    onRemove: (id: string) => void;
    onLineDiscount: (id: string, discount: number) => void;
}

export default function CartItemRow({ item, onUpdateQty, onRemove, onLineDiscount }: CartItemRowProps) {
    const [showDisc, setShowDisc] = useState(false);
    const [editingQty, setEditingQty] = useState(false);
    const [qtyInput, setQtyInput] = useState(String(item.qty));
    const qtyRef = useRef<HTMLInputElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);

    const maxDiscount = Math.max(0, (item.product.sellingPrice - item.product.costPrice) * item.qty);
    const lineDiscount = item.lineDiscount ?? 0;
    const lineTotal = item.product.sellingPrice * item.qty - lineDiscount;

    // Sync quantity when item changes
    useEffect(() => {
        setQtyInput(String(item.qty));
    }, [item.qty]);

    // Focus input when entering edit mode
    useEffect(() => {
        if (editingQty && qtyRef.current) {
            qtyRef.current.focus();
            qtyRef.current.select();
        }
    }, [editingQty]);

    // Handle keyboard shortcuts for quantity
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if this row is focused or contains focused element
            if (document.activeElement !== rowRef.current &&
                !rowRef.current?.contains(document.activeElement)) {
                return;
            }

            switch (e.key) {
                case '+':
                case '=':
                    e.preventDefault();
                    onUpdateQty(item.product.id, item.qty + 1);
                    break;
                case '-':
                case '_':
                    e.preventDefault();
                    if (item.qty > 1) {
                        onUpdateQty(item.product.id, item.qty - 1);
                    }
                    break;
                case 'Delete':
                case 'Backspace':
                    if (!editingQty) {
                        e.preventDefault();
                        onRemove(item.product.id);
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [item.product.id, item.qty, onUpdateQty, onRemove, editingQty]);

    const commitQty = () => {
        const n = parseInt(qtyInput, 10);
        if (!isNaN(n) && n > 0) {
            onUpdateQty(item.product.id, n);
        } else {
            setQtyInput(String(item.qty));
        }
        setEditingQty(false);
    };

    return (
        <div
            ref={rowRef}
            role="listitem"
            tabIndex={0}
            aria-label={`${item.product.name} - الكمية: ${item.qty} - السعر: ${lineTotal} ج.م`}
            className="group rounded-xl bg-card border border-border/50 p-3 mb-2 shadow-sm transition-all hover:border-primary/30 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{item.product.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-semibold text-emerald-600 tabular-nums">
                            {item.product.sellingPrice.toLocaleString('ar-EG')} ج.م
                        </span>
                        {lineDiscount > 0 && (
                            <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 rounded tabular-nums">
                                −{lineDiscount} خصم
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowDisc(s => !s)}
                        aria-label={`${showDisc ? 'إخفاء' : 'تطبيق'} خصم على ${item.product.name}`}
                        aria-pressed={showDisc}
                        className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                            showDisc || lineDiscount > 0
                                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600'
                                : 'text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                        )}
                    >
                        <Percent className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                        onClick={() => onRemove(item.product.id)}
                        aria-label={`حذف ${item.product.name} من السلة`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* Inline discount input */}
            {showDisc && (
                <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mb-1.5">
                        خصم الصنف (حتى {maxDiscount.toFixed(0)} ج.م)
                    </p>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={maxDiscount}
                            step={0.5}
                            value={lineDiscount || ''}
                            onChange={e => onLineDiscount(item.product.id, Math.min(Number(e.target.value), maxDiscount))}
                            placeholder="0"
                            aria-label={`خصم على ${item.product.name}`}
                            className="flex-1 rounded-lg border border-amber-300 bg-background px-2 py-1.5 text-xs text-center font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                        <span className="text-[10px] text-amber-600 font-bold">ج.م</span>
                        {lineDiscount > 0 && (
                            <button
                                onClick={() => onLineDiscount(item.product.id, 0)}
                                aria-label="إزالة الخصم"
                                className="text-red-400 hover:text-red-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400 rounded p-1"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Quantity controls - ENHANCED with direct input and larger touch targets */}
            <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1" role="group" aria-label={`كمية ${item.product.name}`}>
                    <button
                        onClick={() => onUpdateQty(item.product.id, item.qty - 1)}
                        aria-label={`تقليل كمية ${item.product.name} (معيار -)`}
                        disabled={item.qty <= 1}
                        className="flex h-11 w-11 items-center justify-center rounded-lg border bg-muted text-muted-foreground hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 hover:border-red-200 dark:hover:border-red-500/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    >
                        <Minus className="h-4 w-4" aria-hidden="true" />
                    </button>

                    {/* Quantity - click to edit - ENHANCED: single click now works */}
                    {editingQty ? (
                        <input
                            ref={qtyRef}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={999}
                            value={qtyInput}
                            onChange={e => setQtyInput(e.target.value)}
                            onBlur={commitQty}
                            onKeyDown={e => {
                                if (e.key === 'Enter') commitQty();
                                if (e.key === 'Escape') { setEditingQty(false); setQtyInput(String(item.qty)); }
                            }}
                            autoFocus
                            aria-label="تعديل الكمية"
                            className="w-14 h-11 text-center text-sm font-black border-2 border-primary rounded-lg focus:outline-none tabular-nums"
                        />
                    ) : (
                        <button
                            onClick={() => { setEditingQty(true); setQtyInput(String(item.qty)); }}
                            aria-label={`الكمية: ${item.qty} — انقر للتعديل — استخدم +/- للتغيير`}
                            title="انقر للتعديل - استخدم +/- للتغيير - احذف للحذف"
                            className="min-w-[44px] h-11 px-3 text-center text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded tabular-nums cursor-pointer hover:bg-muted flex items-center justify-center"
                        >
                            {item.qty}
                        </button>
                    )}

                    <button
                        onClick={() => onUpdateQty(item.product.id, item.qty + 1)}
                        aria-label={`زيادة كمية ${item.product.name} (معيار +)`}
                        className="flex h-11 w-11 items-center justify-center rounded-lg border bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                    >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>

                <span className={cn(
                    'text-sm font-black tabular-nums',
                    lineDiscount > 0 ? 'text-amber-600' : 'text-emerald-600'
                )}>
                    {lineTotal.toLocaleString('ar-EG')} ج.م
                </span>
            </div>
        </div>
    );
}
