// ============================================================
// Shared Inventory Product Card Component
// Displays a product card with image, price, stock badge, and actions
// ============================================================

import { Pencil, Trash2, ImageOff } from 'lucide-react';

interface InventoryProductCardProps {
    /** The product item (typed loosely to support various inventory types). */
    item: {
        _type?: string;
        name: string;
        image?: string;
        quantity: number;
        salePrice: number;
        condition?: string;
        categoryName?: string;
        // Device fields
        storage?: string;
        ram?: string;
        color?: string;
        processor?: string;
        // Accessory fields
        model?: string;
    };
    /** Called when user clicks the edit button. */
    onEdit: () => void;
    /** Called when user clicks the delete button. */
    onDelete: () => void;
}

/**
 * A reusable product card for inventory grid views.
 * Shows image preview, condition/category badges, price, stock status, and action buttons.
 */
export function InventoryProductCard({ item, onEdit, onDelete }: InventoryProductCardProps) {
    const isDevice = item._type === 'device';
    const extras = isDevice
        ? [item.storage, item.ram, item.processor, item.color].filter(Boolean).join(' · ')
        : [item.model, item.color].filter(Boolean).join(' · ');
    const conditionBadge = item.condition === 'used' ? 'مستعمل' : 'جديد';

    return (
        <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 relative">
            {/* Top-left badges */}
            <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5">
                <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${item.condition === 'used'
                        ? 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400'
                        : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        }`}
                >
                    {conditionBadge}
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm bg-primary/10 text-primary truncate max-w-[80px]">
                    {item.categoryName || 'بدون تصنيف'}
                </span>
            </div>

            {/* Image */}
            <div className="relative h-44 w-full bg-muted/30 overflow-hidden">
                {item.image ? (
                    <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                        <ImageOff className="h-10 w-10 text-muted-foreground/20" />
                        <span className="text-xs text-muted-foreground/40">لا توجد صورة</span>
                    </div>
                )}
                {/* Stock badge */}
                <span
                    className={`absolute top-2 right-2 rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm ${item.quantity === 0
                        ? 'bg-red-500 text-white'
                        : 'bg-primary text-primary-foreground'
                        }`}
                >
                    {item.quantity === 0 ? 'نفد المخزون' : `${item.quantity} وحدة`}
                </span>
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 p-4 gap-2.5">
                <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2">{item.name}</h3>
                {extras && <p className="text-xs text-muted-foreground line-clamp-1">{extras}</p>}

                {/* Footer */}
                <div className="mt-auto pt-3 border-t border-border/40 flex items-center justify-between">
                    <span className="text-base font-extrabold text-primary tabular-nums">
                        {item.salePrice.toLocaleString('ar-EG')}{' '}
                        <span className="text-xs font-medium text-muted-foreground">ج.م</span>
                    </span>
                    <div className="flex gap-1.5">
                        <button
                            onClick={onEdit}
                            title="تعديل"
                            className="rounded-xl p-2 bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={onDelete}
                            title="حذف"
                            className="rounded-xl p-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-destructive transition-colors"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
