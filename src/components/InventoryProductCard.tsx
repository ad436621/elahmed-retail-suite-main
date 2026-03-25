import React from 'react';
import { AlertTriangle, ImageOff, Info, Pencil, Trash2 } from 'lucide-react';
import { calculateMarginPercent, calculateProfitAmount, getMarginTone, normalizeCostPrice } from '@/domain/pricing';
import { getProductConditionBadgeClass, getProductConditionLabel } from '@/domain/productConditions';

interface InventoryProductCardProps {
  item: {
    _type?: string;
    name: string;
    image?: string;
    quantity: number;
    salePrice: number;
    newCostPrice?: number;
    oldCostPrice?: number;
    profitMargin?: number;
    minStock?: number;
    condition?: string;
    categoryName?: string;
    brand?: string;
    storage?: string;
    ram?: string;
    color?: string;
    processor?: string;
    model?: string;
  };
  onEdit: () => void;
  onDelete: () => void;
  onDetails?: () => void;
}

export const InventoryProductCard = React.memo(function InventoryProductCard({
  item,
  onEdit,
  onDelete,
  onDetails,
}: InventoryProductCardProps) {
  const isAccessoryOrSpare = item._type === 'accessory' || item._type === 'spare-part';
  const extras = isAccessoryOrSpare
    ? [item.model, item.color].filter(Boolean).join(' • ')
    : [item.storage, item.ram, item.processor, item.color].filter(Boolean).join(' • ');

  const costPrice = normalizeCostPrice(item.newCostPrice, item.oldCostPrice);
  const profitAmount = typeof item.profitMargin === 'number' ? item.profitMargin : calculateProfitAmount(costPrice, item.salePrice);
  const marginPercent = calculateMarginPercent(costPrice, item.salePrice);
  const marginTone = getMarginTone(marginPercent);
  const conditionLabel = getProductConditionLabel(item.condition);
  const conditionBadgeClass = getProductConditionBadgeClass(item.condition);
  const isLowStock = typeof item.minStock === 'number' && item.quantity <= item.minStock;

  const stopAction = (handler: (() => void) | undefined) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    handler?.();
  };

  const cardActionProps = onDetails
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: onDetails,
        onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onDetails();
          }
        },
      }
    : {};

  return (
    <div
      {...cardActionProps}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-200 ${onDetails ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30' : ''}`}
    >
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${conditionBadgeClass}`}>{conditionLabel}</span>
        <span className="max-w-[80px] truncate rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary shadow-sm">
          {item.categoryName || 'بدون تصنيف'}
        </span>
        {item.brand && (
          <span className="max-w-[80px] truncate rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600 shadow-sm dark:bg-blue-500/15 dark:text-blue-400">
            {item.brand}
          </span>
        )}
      </div>

      <div className="relative h-44 w-full overflow-hidden bg-muted/30">
        {item.image ? (
          <img src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <ImageOff className="h-10 w-10 text-muted-foreground/20" />
            <span className="text-xs text-muted-foreground/40">لا توجد صورة</span>
          </div>
        )}

        <div className="absolute top-2 right-2 flex flex-col items-end gap-1.5">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm ${item.quantity === 0 ? 'bg-red-500 text-white' : isLowStock ? 'bg-amber-500 text-white' : 'bg-primary text-primary-foreground'}`}
          >
            {item.quantity === 0 ? 'نفد المخزون' : `${item.quantity} وحدة`}
          </span>
          {isLowStock && item.quantity > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              <AlertTriangle className="h-3 w-3" />
              منخفض
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground">{item.name}</h3>
        {extras && <p className="line-clamp-1 text-xs text-muted-foreground">{extras}</p>}

        <div className="mt-auto flex items-center justify-between border-t border-border/40 pt-3">
          <div>
            <span className="text-base font-extrabold tabular-nums text-primary">
              {item.salePrice.toLocaleString('ar-EG')} <span className="text-xs font-medium text-muted-foreground">ج.م</span>
            </span>
            <div className="mt-0.5">
              <span className={`inline-flex rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-bold shadow-sm ${marginTone}`}>
                {profitAmount.toLocaleString('ar-EG')} ج.م • {marginPercent.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="flex gap-1.5">
            {onDetails && (
              <button
                onClick={stopAction(onDetails)}
                title="تفاصيل"
                className="rounded-xl bg-cyan-50 p-2 text-cyan-600 transition-colors hover:bg-cyan-100 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={stopAction(onEdit)} title="تعديل" className="rounded-xl bg-primary/10 p-2 text-primary transition-colors hover:bg-primary/20">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={stopAction(onDelete)} title="حذف" className="rounded-xl bg-red-50 p-2 text-destructive transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
