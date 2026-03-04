import React from 'react';
import { X, Package, Calendar, DollarSign, Tag, TrendingUp, Info } from 'lucide-react';
import { getAllBatchesForProduct } from '@/data/batchesData';
import { ProductBatch } from '@/domain/types';

interface ProductBatchesModalProps {
    productId: string;
    productName: string;
    onClose?: () => void;
    // Support the Dialog-style api used in DevicesInventory
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function ProductBatchesModal({ productId, productName, onClose, open, onOpenChange }: ProductBatchesModalProps) {
    // Support both open-prop pattern (used by DevicesInventory) and always-open pattern
    if (open === false) return null;

    const handleClose = () => {
        onClose?.();
        onOpenChange?.(false);
    };

    const batches = getAllBatchesForProduct(productId).filter(b => b.remainingQty > 0);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                    <div>
                        <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" />
                            سجل الدفعات النشطة
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1 font-medium">{productName}</p>
                    </div>
                    <button onClick={handleClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors self-start">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    {batches.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                            <Info className="h-12 w-12 mb-3 opacity-20" />
                            <p className="text-sm font-medium">لا توجد دفعات نشطة (المخزون صفر)</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {batches.map((batch, index) => (
                                <div key={batch.id} className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-4 hover:border-primary/30 transition-colors shadow-sm">
                                    <div className="absolute top-0 right-0 w-1.5 h-full bg-primary/80 rounded-r-xl" />

                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold mb-2">
                                                دفعة #{index + 1}
                                            </span>
                                            {batch.supplier && (
                                                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                                    المورد: {batch.supplier}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <div className="text-xs text-muted-foreground flex items-center justify-end gap-1 mb-1">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {new Date(batch.purchaseDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                الوقت: {new Date(batch.purchaseDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/30">
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Package className="h-3 w-3" /> الكمية المتبقية</p>
                                            <p className="font-bold text-sm">{batch.remainingQty} <span className="text-xs font-normal text-muted-foreground">من أصل {batch.quantity}</span></p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><DollarSign className="h-3 w-3" /> تكلفة الوحدة</p>
                                            <p className="font-bold text-sm text-amber-600">{batch.costPrice.toLocaleString()} ج.م</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Tag className="h-3 w-3" /> سعر البيع</p>
                                            <p className="font-bold text-sm text-primary">{batch.salePrice.toLocaleString()} ج.م</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> الربح المتوقع</p>
                                            <p className="font-extrabold text-sm text-emerald-600">{(batch.salePrice - batch.costPrice).toLocaleString()} ج.م</p>
                                        </div>
                                    </div>

                                    {batch.notes && batch.notes !== 'رصيد افتتاحي (إضافة جديدة)' && (
                                        <div className="mt-3 text-xs bg-muted/40 p-2 rounded-lg text-muted-foreground border border-border/50">
                                            <span className="font-semibold">ملاحظات:</span> {batch.notes}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
