// ============================================================
// Product Details Modal
// ============================================================

import { createPortal } from 'react-dom';
import { X, Smartphone, Package, Tag, DollarSign, Info, Hash, Palette, Clock, MapPin, User, Box, Shield } from 'lucide-react';
import { calculateMarginPercent, calculateProfitAmount, normalizeCostPrice } from '@/domain/pricing';
import { getProductConditionBadgeClass, getProductConditionLabel } from '@/domain/productConditions';

export interface ProductDetailsData {
  id: string;
  name: string;
  barcode?: string;
  category?: string;
  condition?: string;
  brand?: string;
  supplier?: string;
  source?: string;
  model?: string;
  color?: string;
  storage?: string;
  ram?: string;
  processor?: string;
  quantity?: number;
  costPrice?: number;
  oldCostPrice?: number;
  salePrice?: number;
  profitMargin?: number;
  minStock?: number;
  serialNumber?: string;
  imei2?: string;
  description?: string;
  notes?: string;
  image?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface ProductDetailsModalProps {
  product: ProductDetailsData;
  onClose: () => void;
}

function DetailRow({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value?: string | number | null; highlight?: boolean }) {
  if (value === undefined || value === null || value === '') return null;

  return (
    <div className="flex items-start gap-3 border-b border-border/30 py-2.5 last:border-0">
      <span className="mt-0.5 shrink-0 text-muted-foreground/60">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
        <p className={`break-words text-sm ${highlight ? 'font-black tabular-nums text-primary' : 'font-semibold text-foreground'}`}>
          {typeof value === 'number' ? value.toLocaleString('ar-EG') : value}
        </p>
      </div>
    </div>
  );
}

export function ProductDetailsModal({ product, onClose }: ProductDetailsModalProps) {
  const costPrice = normalizeCostPrice(product.costPrice, product.oldCostPrice);
  const profitMargin = typeof product.profitMargin === 'number'
    ? product.profitMargin
    : calculateProfitAmount(costPrice, product.salePrice || 0);
  const marginPercent = calculateMarginPercent(costPrice, product.salePrice || 0);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-2xl animate-scale-in" onClick={(event) => event.stopPropagation()}>
        <div className="flex-none rounded-t-2xl border-b border-border bg-muted/30 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Info className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-black text-foreground">تفاصيل المنتج</h2>
                <p className="text-[11px] text-muted-foreground">{product.name}</p>
              </div>
            </div>

            <button onClick={onClose} className="rounded-xl p-2 transition-colors hover:bg-muted">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-5" dir="rtl">
          {product.image && (
            <div className="mb-4 flex justify-center">
              <img src={product.image} alt={product.name} className="h-40 w-40 rounded-2xl border border-border object-cover shadow-sm" />
            </div>
          )}

          {product.condition && (
            <div className="mb-3 flex justify-center">
              <span className={`rounded-full px-4 py-1.5 text-xs font-bold ${getProductConditionBadgeClass(product.condition)}`}>
                {getProductConditionLabel(product.condition)}
              </span>
            </div>
          )}

          <div className="rounded-xl border border-border bg-muted/20 px-4">
            <DetailRow icon={<Smartphone className="h-4 w-4" />} label="اسم المنتج" value={product.name} />
            <DetailRow icon={<Tag className="h-4 w-4" />} label="التصنيف" value={product.category} />
            <DetailRow icon={<Shield className="h-4 w-4" />} label="الشركة" value={product.brand} />
            <DetailRow icon={<User className="h-4 w-4" />} label="المورد" value={product.supplier} />
            <DetailRow icon={<MapPin className="h-4 w-4" />} label="المصدر" value={product.source} />
            <DetailRow icon={<Package className="h-4 w-4" />} label="الموديل" value={product.model} />
            <DetailRow icon={<Palette className="h-4 w-4" />} label="اللون" value={product.color} />
            <DetailRow icon={<Hash className="h-4 w-4" />} label="الباركود" value={product.barcode} />
            <DetailRow icon={<Hash className="h-4 w-4" />} label="IMEI 1" value={product.serialNumber} />
            <DetailRow icon={<Hash className="h-4 w-4" />} label="IMEI 2" value={product.imei2} />
          </div>

          {(product.storage || product.ram || product.processor) && (
            <div className="mt-3 rounded-xl border border-border bg-blue-50/50 px-4 dark:bg-blue-500/5">
              <DetailRow icon={<Box className="h-4 w-4" />} label="التخزين" value={product.storage} />
              <DetailRow icon={<Box className="h-4 w-4" />} label="الرام" value={product.ram} />
              <DetailRow icon={<Box className="h-4 w-4" />} label="المعالج" value={product.processor} />
            </div>
          )}

          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <DetailRow icon={<DollarSign className="h-4 w-4" />} label="الكمية" value={product.quantity} />
            <DetailRow icon={<DollarSign className="h-4 w-4" />} label="سعر الشراء" value={costPrice} />
            <DetailRow icon={<DollarSign className="h-4 w-4" />} label="سعر البيع" value={product.salePrice} highlight />
            <DetailRow icon={<DollarSign className="h-4 w-4" />} label="هامش الربح" value={`${profitMargin.toLocaleString('ar-EG')} ج.م`} highlight />
            <DetailRow icon={<DollarSign className="h-4 w-4" />} label="نسبة هامش الربح" value={`${marginPercent.toFixed(1)}%`} />
            {product.minStock !== undefined && product.minStock > 0 && (
              <DetailRow icon={<DollarSign className="h-4 w-4" />} label="حد التنبيه" value={product.minStock} />
            )}
          </div>

          {product.description && (
            <div className="mt-3 rounded-xl border border-border bg-muted/20 p-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase text-muted-foreground">الوصف</p>
              <p className="whitespace-pre-wrap text-sm text-foreground">{product.description}</p>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between px-1 text-[10px] text-muted-foreground/70">
            {product.createdAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                أضيف: {new Date(product.createdAt).toLocaleDateString('ar-EG')}
              </span>
            )}
            {product.updatedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                آخر تعديل: {new Date(product.updatedAt).toLocaleDateString('ar-EG')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
