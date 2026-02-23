import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Product } from '@/domain/types';
import { getCategories } from '@/data/mockData';
import { generateBarcode } from '@/domain/product';
import { validatePricing } from '@/domain/product';
import { saveProduct } from '@/repositories/productRepository';
import { createAuditEntry } from '@/domain/audit';
import { saveAuditEntries } from '@/repositories/auditRepository';
import { useToast } from '@/hooks/use-toast';
import { Package, Tag, Barcode, Building2, Boxes, DollarSign, TrendingUp, Sparkles, Plus, Pencil } from 'lucide-react';

const productSchema = z.object({
  name: z.string().min(1, 'اسم المنتج مطلوب'),
  model: z.string().min(1, 'رقم الموديل مطلوب'),
  barcode: z.string().optional(),
  category: z.string().min(1, 'الفئة مطلوبة'),
  supplier: z.string().optional(),
  costPrice: z.number().min(0, 'سعر التكلفة يجب أن يكون صفر أو أكثر'),
  sellingPrice: z.number().min(0, 'سعر البيع يجب أن يكون صفر أو أكثر'),
  quantity: z.number().min(0, 'الكمية يجب أن تكون صفر أو أكثر'),
}).refine((data) => data.sellingPrice >= data.costPrice, {
  message: 'سعر البيع لا يمكن أن يكون أقل من سعر التكلفة',
  path: ['sellingPrice'],
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  onSuccess: () => void;
}

export function ProductFormDialog({ open, onOpenChange, product, onSuccess }: ProductFormDialogProps) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      model: '',
      barcode: '',
      category: 'Phones',
      supplier: '',
      costPrice: 0,
      sellingPrice: 0,
      quantity: 0,
    },
  });

  // Reset form when dialog opens or product changes
  useEffect(() => {
    if (open) {
      if (product) {
        reset({
          name: product.name,
          model: product.model,
          barcode: product.barcode,
          category: product.category,
          supplier: product.supplier,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          quantity: product.quantity,
        });
      } else {
        reset({
          name: '',
          model: '',
          barcode: '',
          category: getCategories()[0] || 'Phones',
          supplier: '',
          costPrice: 0,
          sellingPrice: 0,
          quantity: 0,
        });
      }
    }
  }, [open, product, reset]);

  const onSubmit = (data: ProductFormData) => {
    try {
      validatePricing(data.costPrice, data.sellingPrice);

      const now = new Date().toISOString();
      const barcode = data.barcode || generateBarcode();

      const newProduct: Product = {
        id: product?.id || crypto.randomUUID(),
        name: data.name,
        model: data.model,
        barcode,
        category: data.category,
        supplier: data.supplier || '',
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice,
        quantity: data.quantity,
        minimumMarginPct: product?.minimumMarginPct ?? 10,
        createdAt: product?.createdAt || now,
        updatedAt: now,
        deletedAt: null,
      };

      saveProduct(newProduct);

      const audit = createAuditEntry(
        'user-1',
        product ? 'product_updated' : 'product_created',
        'product',
        newProduct.id,
        product ? (product as any) : null,
        newProduct as any
      );
      saveAuditEntries([audit]);

      toast({
        title: product ? 'تم تحديث المنتج' : 'تم إضافة المنتج',
        description: data.name,
      });

      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl glass-card border-border/30 shadow-elevated"
        dir="rtl"
      >
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-secondary/10">
              {product ? (
                <Pencil className="h-5 w-5 text-primary" />
              ) : (
                <Plus className="h-5 w-5 text-primary" />
              )}
            </div>
            {product ? 'تعديل المنتج' : 'إضافة منتج جديد'}
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {product ? 'قم بتعديل بيانات المنتج المطلوبة' : 'أدخل بيانات المنتج الجديد'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Basic Info Section */}
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              معلومات أساسية
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium flex items-center gap-1.5">
                  اسم المنتج <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="name"
                    {...register('name')}
                    className="h-11 bg-card/50 border-border/50 focus:border-primary/50 transition-all"
                    placeholder="أدخل اسم المنتج"
                  />
                </div>
                {errors.name && <p className="text-xs text-destructive animate-slide-down">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="model" className="text-sm font-medium flex items-center gap-1.5">
                  الموديل <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="model"
                  {...register('model')}
                  className="h-11 bg-card/50 border-border/50 focus:border-primary/50 transition-all"
                  placeholder="أدخل رقم الموديل"
                />
                {errors.model && <p className="text-xs text-destructive animate-slide-down">{errors.model.message}</p>}
              </div>
            </div>
          </div>

          {/* Category & Barcode Section */}
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Tag className="h-4 w-4" />
              التصنيف والباركود
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="barcode" className="text-sm font-medium flex items-center gap-1.5">
                  <Barcode className="h-3.5 w-3.5" />
                  الباركود
                </Label>
                <Input
                  id="barcode"
                  {...register('barcode')}
                  placeholder="سيتم إنشاؤه تلقائياً"
                  className="h-11 bg-card/50 border-border/50 focus:border-primary/50 transition-all font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium flex items-center gap-1.5">
                  الفئة <span className="text-destructive">*</span>
                </Label>
                <Select
                  defaultValue={watch('category')}
                  onValueChange={(v) => setValue('category', v)}
                >
                  <SelectTrigger className="h-11 bg-card/50 border-border/50 focus:border-primary/50">
                    <SelectValue placeholder="اختر الفئة" />
                  </SelectTrigger>
                  <SelectContent className="glass-card">
                    {getCategories().map(c => (
                      <SelectItem key={c} value={c} className="hover:bg-primary/10">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Stock & Supplier Section */}
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Boxes className="h-4 w-4" />
              المخزون والمورد
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier" className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  المورد
                </Label>
                <Input
                  id="supplier"
                  {...register('supplier')}
                  className="h-11 bg-card/50 border-border/50 focus:border-primary/50 transition-all"
                  placeholder="اسم المورد"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-sm font-medium flex items-center gap-1.5">
                  الكمية <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  {...register('quantity', { valueAsNumber: true })}
                  className="h-11 bg-card/50 border-border/50 focus:border-primary/50 transition-all"
                  placeholder="0"
                />
                {errors.quantity && <p className="text-xs text-destructive animate-slide-down">{errors.quantity.message}</p>}
              </div>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="rounded-xl border border-border/30 bg-gradient-to-l from-primary/5 to-transparent p-4 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              التسعير
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="costPrice" className="text-sm font-medium flex items-center gap-1.5">
                  سعر التكلفة <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="costPrice"
                    type="number"
                    step="0.01"
                    {...register('costPrice', { valueAsNumber: true })}
                    className="h-11 bg-card/50 border-border/50 focus:border-primary/50 transition-all ps-10"
                    placeholder="0.00"
                  />
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">EGP</span>
                </div>
                {errors.costPrice && <p className="text-xs text-destructive animate-slide-down">{errors.costPrice.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellingPrice" className="text-sm font-medium flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  سعر البيع <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="sellingPrice"
                    type="number"
                    step="0.01"
                    {...register('sellingPrice', { valueAsNumber: true })}
                    className="h-11 bg-card/50 border-border/50 focus:border-primary/50 transition-all ps-10"
                    placeholder="0.00"
                  />
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">EGP</span>
                </div>
                {errors.sellingPrice && <p className="text-xs text-destructive animate-slide-down">{errors.sellingPrice.message}</p>}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11 px-6 rounded-xl border-border/50 hover:bg-muted/50 transition-all"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 px-6 rounded-xl bg-gradient-to-l from-primary to-secondary hover:shadow-lg hover:shadow-primary/20 transition-all btn-ripple"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  جاري الحفظ...
                </span>
              ) : product ? (
                <span className="flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  تحديث
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة
                </span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
