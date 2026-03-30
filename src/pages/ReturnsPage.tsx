import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, X, RotateCcw, Check, AlertCircle } from 'lucide-react';
import { Sale } from '@/domain/types';
import { restoreBatchQty } from '@/data/batchesData';
import { getReturnedQuantitiesBySaleId, addReturnRecord } from '@/data/returnsData';
import { processReturn } from '@/domain/returns';
import { saveAuditEntries } from '@/repositories/auditRepository';
import { getAllInventoryProducts, updateProductQuantity } from '@/repositories/productRepository';
import { getActiveSales, saveSale } from '@/repositories/saleRepository';
import { saveMovements } from '@/repositories/stockRepository';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { BatchSaleResult } from '@/domain/types';
import { deleteInvoice } from '@/services/saleService';

interface ReturnedItem {
  productId: string;
  name: string;
  soldQty: number;
  availableQty: number;
  price: number;
  returnQty: number;
  reason: string;
  batches?: BatchSaleResult['batches']; // Stored original batches to restore
}

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

export default function ReturnsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const location = useLocation();
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [foundSale, setFoundSale] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnedItem[]>([]);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [notFound, setNotFound] = useState(false);

  // Read initial invoice from route state/query and trigger search
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const initialInvoice = location.state?.invoiceNumber || params.get('invoice');
    if (initialInvoice) {
      setInvoiceSearch(initialInvoice);
      // Wait for state to update, then search
      setTimeout(() => {
        handleSearchFor(initialInvoice);
      }, 0);
    }
  }, [location.state, location.search]);

  const handleSearchFor = (inv: string) => {
    setNotFound(false);
    setFoundSale(null);
    setReturnItems([]);
    const sales = getActiveSales();
    const sale = sales.find(s =>
      s.invoiceNumber.toLowerCase() === inv.trim().toLowerCase() ||
      s.id === inv.trim()
    );
    if (sale) {
      const returnedQuantities = getReturnedQuantitiesBySaleId(sale.id);
      const mappedItems = sale.items.map(item => {
        const alreadyReturned = returnedQuantities[item.productId] ?? 0;
        return {
          productId: item.productId,
          name: item.name,
          soldQty: item.qty,
          availableQty: Math.max(0, item.qty - alreadyReturned),
          price: item.price,
          returnQty: 0,
          reason: '',
          batches: item.batches,
        };
      });

      setFoundSale(sale);
      setReturnItems(mappedItems);

      if (mappedItems.every((item) => item.availableQty === 0)) {
        toast({
          title: 'الفاتورة مسترجعة بالكامل',
          description: 'تم استرجاع كل الكميات في هذه الفاتورة من قبل',
        });
      }
    } else {
      setNotFound(true);
    }
  };

  const handleSearch = () => handleSearchFor(invoiceSearch);


  const handleSearch = () => {
    setNotFound(false);
    setFoundSale(null);
    setReturnItems([]);
    const sales = getActiveSales();
    const sale = sales.find(s =>
      s.invoiceNumber.toLowerCase() === invoiceSearch.trim().toLowerCase() ||
      s.id === invoiceSearch.trim()
    );
    if (sale) {
      const returnedQuantities = getReturnedQuantitiesBySaleId(sale.id);
      const mappedItems = sale.items.map(item => {
        const alreadyReturned = returnedQuantities[item.productId] ?? 0;
        return {
          productId: item.productId,
          name: item.name,
          soldQty: item.qty,
          availableQty: Math.max(0, item.qty - alreadyReturned),
          price: item.price,
          returnQty: 0,
          reason: '',
          batches: item.batches,
        };
      });

      setFoundSale(sale);
      setReturnItems(mappedItems);

      if (mappedItems.every((item) => item.availableQty === 0)) {
        toast({
          title: 'الفاتورة مسترجعة بالكامل',
          description: 'تم استرجاع كل الكميات في هذه الفاتورة من قبل',
        });
      }
    } else {
      setNotFound(true);
    }
  };

  const updateItem = (idx: number, key: 'returnQty' | 'reason', value: string | number) => {
    setReturnItems(items => items.map((item, i) => i === idx ? { ...item, [key]: value } : item));
  };

  const handleReturn = () => {
    const itemsToReturn = returnItems.filter(i => i.returnQty > 0);
    if (itemsToReturn.length === 0) {
      toast({ title: 'خطأ', description: 'حدد كمية مرتجعة لمنتج واحد على الأقل', variant: 'destructive' });
      return;
    }

    if (!foundSale) {
      toast({ title: 'خطأ', description: 'لم يتم العثور على الفاتورة', variant: 'destructive' });
      return;
    }

    const returnedQuantities = getReturnedQuantitiesBySaleId(foundSale.id);
    const inventoryProducts = getAllInventoryProducts();
    const inventoryById = Object.fromEntries(inventoryProducts.map((product) => [product.id, product]));
    const currentProductQuantities = Object.fromEntries(inventoryProducts.map((product) => [product.id, product.quantity]));

    for (const item of itemsToReturn) {
      const soldQty = foundSale.items.find((saleItem) => saleItem.productId === item.productId)?.qty ?? 0;
      const remainingQty = Math.max(0, soldQty - (returnedQuantities[item.productId] ?? 0));
      if (item.returnQty > remainingQty) {
        toast({ title: 'خطأ', description: `كمية ${item.name} المتاحة للإرجاع هي ${remainingQty} فقط`, variant: 'destructive' });
        return;
      }
      if (!inventoryById[item.productId]) {
        toast({ title: 'خطأ', description: `المنتج "${item.name}" لم يعد موجودًا في المخزون`, variant: 'destructive' });
        return;
      }
    }

    const reason = itemsToReturn
      .map((item) => item.reason.trim() ? `${item.name}: ${item.reason.trim()}` : item.name)
      .join(' | ') || 'مرتجع مبيعات';

    const { returnRecord, stockMovements, auditEntries } = processReturn(
      foundSale,
      itemsToReturn.map((item) => ({ productId: item.productId, qty: item.returnQty })),
      reason,
      user?.id || 'system',
      currentProductQuantities
    );

    itemsToReturn.forEach(item => {
      if (item.batches && item.batches.length > 0) {
        let qtyToRestore = item.returnQty;

        const reversedBatches = [...item.batches].reverse();
        for (const batch of reversedBatches) {
          if (qtyToRestore <= 0) break;

          const restoreAmount = Math.min(qtyToRestore, batch.qtyFromBatch);
          restoreBatchQty(batch.batchId, restoreAmount);
          qtyToRestore -= restoreAmount;
        }
      }
    });

    saveMovements(stockMovements);
    saveAuditEntries(auditEntries);
    stockMovements.forEach((movement) => updateProductQuantity(movement.productId, movement.newQuantity));

    addReturnRecord({
      originalInvoiceNumber: foundSale.invoiceNumber,
      originalSaleId: foundSale.id,
      date: returnDate,
      items: itemsToReturn.map(i => ({ productId: i.productId, name: i.name, qty: i.returnQty, price: i.price, reason: i.reason })),
      totalRefund: returnRecord.totalRefund,
      reason,
      processedBy: user?.id || 'system',
    });

    toast({ title: '✅ تم تسجيل المرتجع', description: `إجمالي الاسترداد: ${returnRecord.totalRefund.toLocaleString()} ج.م` });
    setFoundSale(null);
    setReturnItems([]);
    setInvoiceSearch('');
  };

  const handleFullReturn = () => {
    if (!foundSale) return;

    if (!confirm('هل أنت متأكد من رغبتك في إرجاع الفاتورة كاملة؟ سيتم إرجاع جميع القطع للمخزون وحذف الفاتورة.')) {
      return;
    }

    // Set all items to full available quantity
    const fullyReturnedItems = returnItems.map(item => ({
      ...item,
      returnQty: item.availableQty,
      reason: 'إرجاع كامل للفاتورة'
    })).filter(item => item.returnQty > 0);

    // If nothing to return (already returned previously)
    if (fullyReturnedItems.length === 0) {
      toast({ title: 'تنبيه', description: 'جميع عناصر هذه الفاتورة تم استرجاعها مسبقاً' });
      return;
    }

    try {
      const inventoryProducts = getAllInventoryProducts();
      const currentProductQuantities = Object.fromEntries(inventoryProducts.map((product) => [product.id, product.quantity]));

      const { returnRecord, stockMovements, auditEntries: returnAuditEntries } = processReturn(
        foundSale,
        fullyReturnedItems.map((item) => ({ productId: item.productId, qty: item.returnQty })),
        'إرجاع كامل للفاتورة',
        user?.id || 'system',
        currentProductQuantities
      );

      // Restore batches
      fullyReturnedItems.forEach(item => {
        if (item.batches && item.batches.length > 0) {
          let qtyToRestore = item.returnQty;
          const reversedBatches = [...item.batches].reverse();
          for (const batch of reversedBatches) {
            if (qtyToRestore <= 0) break;
            const restoreAmount = Math.min(qtyToRestore, batch.qtyFromBatch);
            restoreBatchQty(batch.batchId, restoreAmount);
            qtyToRestore -= restoreAmount;
          }
        }
      });

      // Mark Invoice as Deleted
      const { deletedSale, auditEntry: deleteAudit } = deleteInvoice(foundSale, 'إرجاع كامل للفاتورة', user?.id || 'system');
      
      saveSale(deletedSale);
      saveMovements(stockMovements);
      saveAuditEntries([...returnAuditEntries, deleteAudit]);
      stockMovements.forEach((movement) => updateProductQuantity(movement.productId, movement.newQuantity));

      addReturnRecord({
        id: returnRecord.id,
        originalInvoiceNumber: foundSale.invoiceNumber,
        originalSaleId: foundSale.id,
        date: returnDate,
        items: fullyReturnedItems.map(i => ({ productId: i.productId, name: i.name, qty: i.returnQty, price: i.price, reason: i.reason })),
        totalRefund: returnRecord.totalRefund,
        reason: 'إرجاع كامل للفاتورة',
        processedBy: user?.id || 'system',
      });

      toast({ title: '✅ تم الإرجاع بالكامل', description: 'تم إرجاع المخزون وحذف الفاتورة بنجاح.' });
      setFoundSale(null);
      setReturnItems([]);
      setInvoiceSearch('');
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-5 animate-fade-in" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/20">
          <RotateCcw className="h-5 w-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">المرتجعات</h1>
          <p className="text-xs text-muted-foreground">ابحث برقم الفاتورة</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={invoiceSearch}
            onChange={e => setInvoiceSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="أدخل رقم الفاتورة..."
            className={`${IC} pr-9`}
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-xl flex items-center justify-center min-w-[80px] min-h-[44px] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md active:scale-95"
        >
          بحث
        </button>
      </div>

      {/* Not found */}
      {notFound && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 p-4">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">لم يتم العثور على فاتورة بهذا الرقم</p>
        </div>
      )}

      {/* Found Sale */}
      {foundSale && (
        <div className="space-y-4">
          {/* Invoice summary */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <p className="font-bold text-foreground text-lg">{foundSale.invoiceNumber}</p>
                <p className="text-sm text-muted-foreground">{new Date(foundSale.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div className="text-left">
                <p className="text-xs text-muted-foreground">إجمالي الفاتورة</p>
                <p className="text-lg font-bold text-primary">{foundSale.total.toLocaleString()} ج.م</p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">تاريخ الإرجاع</label>
            <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className={IC} />
          </div>

          <p className="text-sm font-semibold text-foreground">اختر المنتجات المرتجعة:</p>

          {/* Items */}
          <div className="space-y-3">
            {returnItems.map((item, i) => (
              <div key={item.productId} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">المباع: {item.soldQty} — المتاح للإرجاع: {item.availableQty} — سعر الوحدة: {item.price.toLocaleString()} ج.م</p>
                  </div>
                  {item.returnQty > 0 && (
                    <span className="rounded-full bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 px-2 py-0.5 text-xs font-bold">
                      استرداد: {(item.returnQty * item.price).toLocaleString()} ج.م
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">كمية الإرجاع</label>
                    <input
                      type="number"
                      min={0}
                      max={item.availableQty}
                      value={item.returnQty}
                      onChange={e => updateItem(i, 'returnQty', Math.max(0, Math.min(item.availableQty, +e.target.value)))}
                      className={IC}
                      disabled={item.availableQty === 0}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">سبب الإرجاع</label>
                    <input
                      value={item.reason}
                      onChange={e => updateItem(i, 'reason', e.target.value)}
                      placeholder="مثال: عيب مصنعي"
                      className={IC}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          {returnItems.some(i => i.returnQty > 0) && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {returnItems.filter(i => i.returnQty > 0).length} منتج مرتجع
                </p>
                <p className="text-xs text-muted-foreground">سيتم إرجاع المنتجات للمخزن تلقائياً</p>
              </div>
              <p className="text-xl font-extrabold text-rose-700">
                {returnItems.reduce((s, i) => s + i.returnQty * i.price, 0).toLocaleString()} ج.م
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReturn}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white hover:bg-rose-500 transition-all shadow-md"
            >
              <Check className="h-4 w-4" /> تأكيد الإرجاع الجزئي
            </button>
            <button
              onClick={handleFullReturn}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white hover:bg-rose-500 transition-all shadow-md"
            >
              <RotateCcw className="h-4 w-4" /> إرجاع كامل للفاتورة
            </button>
            <button
              onClick={() => { setFoundSale(null); setReturnItems([]); setInvoiceSearch(''); }}
              className="rounded-xl flex items-center justify-center border border-border py-3 px-5 text-sm font-medium min-h-[48px] hover:bg-muted transition-colors active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
