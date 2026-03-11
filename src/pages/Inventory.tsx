import { useState, useMemo, useCallback } from 'react';
import { Search, Plus, Filter, FileSpreadsheet, Pencil, Trash2, Package, Sparkles, Tag, Building2, DollarSign, TrendingUp, Boxes, AlertTriangle, CheckCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLegacyCategories } from '@/data/categoriesData';
import { cn } from '@/lib/utils';
import { getAllProducts, softDeleteProduct } from '@/repositories/productRepository';
import { searchProducts, getMargin } from '@/services/productService';
import { ProductFormDialog } from '@/components/ProductFormDialog';
import { ExcelImportDialog } from '@/components/ExcelImportDialog';
import { BarcodeSVG } from '@/components/BarcodeSVG';
import { Product } from '@/domain/types';
import { useToast } from '@/hooks/use-toast';

const Inventory = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allProducts = useMemo(() => getAllProducts(), [refreshKey]);
  const filtered = useMemo(
    () => searchProducts(allProducts, search, categoryFilter),
    [allProducts, search, categoryFilter]
  );

  const getStockStatus = (p: typeof allProducts[0]) => {
    if (p.quantity === 0) return { label: t('common.outOfStock'), cls: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle };
    if (p.quantity <= 5) return { label: t('common.lowStock'), cls: 'bg-warning/10 text-warning border-warning/20', icon: AlertTriangle };
    return { label: t('common.inStock'), cls: 'bg-chart-3/10 text-chart-3 border-chart-3/20', icon: CheckCircle };
  };

  const handleProductSuccess = useCallback(() => {
    setRefreshKey(k => k + 1);
    setEditProduct(undefined);
  }, []);

  const handleEdit = useCallback((product: Product) => {
    setEditProduct(product);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback((product: Product) => {
    softDeleteProduct(product.id);
    setRefreshKey(k => k + 1);
    toast({ title: 'تم حذف المنتج', description: product.name });
  }, [toast]);

  const handleFormClose = useCallback((open: boolean) => {
    setFormOpen(open);
    if (!open) setEditProduct(undefined);
  }, []);

  // Stats
  const totalProducts = allProducts.length;
  const lowStockCount = allProducts.filter(p => p.quantity <= 5 && p.quantity > 0).length;
  const outOfStockCount = allProducts.filter(p => p.quantity === 0).length;
  const totalValue = allProducts.reduce((sum, p) => sum + p.costPrice * p.quantity, 0);

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {t('inventory.title')}
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة وتنظيم المنتجات والمخزون</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-card-foreground hover:bg-muted/50 hover:border-primary/30 transition-all duration-300 shadow-soft"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            </div>
            استيراد Excel
          </button>
          <button
            onClick={() => { setEditProduct(undefined); setFormOpen(true); }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-l from-primary to-secondary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 btn-ripple"
          >
            <Plus className="h-4 w-4" />
            {t('inventory.addProduct')}
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Boxes className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{totalProducts}</p>
              <p className="text-xs text-muted-foreground">إجمالي المنتجات</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10">
              <CheckCircle className="h-5 w-5 text-chart-3" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">{totalProducts - lowStockCount - outOfStockCount}</p>
              <p className="text-xs text-muted-foreground">متوفر</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-warning">{lowStockCount}</p>
              <p className="text-xs text-muted-foreground">مخزون منخفض</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{outOfStockCount}</p>
              <p className="text-xs text-muted-foreground">نفذ من المخزون</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <div className="absolute start-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Search className="h-4 w-4 text-primary" />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('inventory.search')}
            className="w-full rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm ps-14 pe-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 shadow-soft transition-all duration-300"
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-4 shadow-soft">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-transparent py-3 text-sm text-card-foreground focus:outline-none cursor-pointer"
          >
            <option value="All">جميع الفئات</option>
            {getLegacyCategories().map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-elevated">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 bg-gradient-to-l from-muted/30 to-transparent">
                <th className="px-5 py-4 text-start font-semibold text-muted-foreground">{t('inventory.name')}</th>
                <th className="px-5 py-4 text-start font-semibold text-muted-foreground">الموديل</th>
                <th className="px-5 py-4 text-start font-semibold text-muted-foreground">الباركود</th>
                <th className="px-5 py-4 text-start font-semibold text-muted-foreground">{t('inventory.category')}</th>
                <th className="px-5 py-4 text-start font-semibold text-muted-foreground">المورد</th>
                <th className="px-5 py-4 text-end font-semibold text-muted-foreground">{t('inventory.cost')}</th>
                <th className="px-5 py-4 text-end font-semibold text-muted-foreground">{t('inventory.selling')}</th>
                <th className="px-5 py-4 text-center font-semibold text-muted-foreground">{t('inventory.stock')}</th>
                <th className="px-5 py-4 text-center font-semibold text-muted-foreground">{t('inventory.status')}</th>
                <th className="px-5 py-4 text-center font-semibold text-muted-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const status = getStockStatus(p);
                const margin = getMargin(p);
                const StatusIcon = status.icon;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border/20 last:border-0 hover:bg-gradient-to-l hover:from-primary/5 hover:to-transparent transition-all duration-200 animate-slide-up"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <p className="font-semibold text-card-foreground">{p.name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground font-medium">{p.model || '—'}</td>
                    <td className="px-5 py-4">
                      {p.barcode ? (
                        <div className="bg-muted/30 rounded-lg p-1.5">
                          <BarcodeSVG value={p.barcode} width={100} height={28} />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        <Tag className="h-3 w-3" />
                        {p.category}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {p.supplier ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          {p.supplier}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-end">
                      <span className="text-muted-foreground font-medium">{p.costPrice.toLocaleString('ar-EG')} ج.م</span>
                    </td>
                    <td className="px-5 py-4 text-end">
                      <div>
                        <span className="font-bold text-card-foreground">{p.sellingPrice.toLocaleString('ar-EG')} ج.م</span>
                        <span className="ms-2 inline-flex items-center gap-0.5 rounded-full bg-chart-3/10 px-2 py-0.5 text-[10px] font-bold text-chart-3">
                          <TrendingUp className="h-3 w-3" />
                          {margin}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={cn(
                        'inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-bold',
                        p.quantity === 0 ? 'bg-destructive/10 text-destructive' :
                          p.quantity <= 5 ? 'bg-warning/10 text-warning' :
                            'bg-card-foreground/5 text-card-foreground'
                      )}>
                        {p.quantity}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold', status.cls)}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEdit(p)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all duration-200"
                          title="تعديل"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                          title="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30 mb-4">
              <Package className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">لا توجد منتجات</p>
            <p className="text-xs text-muted-foreground/60 mt-1">جرب تغيير معايير البحث</p>
          </div>
        )}
      </div>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={handleFormClose}
        product={editProduct}
        onSuccess={handleProductSuccess}
      />
      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={handleProductSuccess}
      />
    </div>
  );
};

export default Inventory;
