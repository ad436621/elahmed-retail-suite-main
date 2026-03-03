// ============================================================
// ELAHMED RETAIL OS — Held Invoices Panel
// Sub-component extracted from POS.tsx for maintainability
// ============================================================

import { X } from 'lucide-react';
import { CartItem } from '@/domain/types';

export interface HeldInvoice {
    id: string;
    cart: CartItem[];
    customer: string;
    notes: string;
    discount: number;
    heldAt: string;
}

interface HeldInvoicesPanelProps {
    invoices: HeldInvoice[];
    onResume: (id: string) => void;
    onDelete: (id: string) => void;
}

const HeldInvoicesPanel = ({ invoices, onResume, onDelete }: HeldInvoicesPanelProps) => {
    if (invoices.length === 0) return null;

    return (
        <div className="px-4 py-2 border-b border-border/20 bg-amber-500/5 animate-slide-down">
            <p className="text-[10px] font-bold text-amber-600 mb-1.5">
                الفواتير المعلقة ({invoices.length})
            </p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
                {invoices.map((h) => (
                    <div key={h.id} className="flex items-center justify-between rounded-lg bg-white/50 dark:bg-white/5 px-2 py-1.5">
                        <div>
                            <p className="text-[10px] font-bold text-card-foreground">
                                {h.cart.length} منتج • {h.customer || 'نقدي'}
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                                {new Date(h.heldAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => onResume(h.id)}
                                className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded font-medium hover:bg-primary/20"
                            >
                                استرجاع
                            </button>
                            <button
                                onClick={() => onDelete(h.id)}
                                className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded hover:bg-destructive/20"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HeldInvoicesPanel;
