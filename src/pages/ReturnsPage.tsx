import { useState } from 'react';
import { Search, X, RotateCcw, Check, AlertCircle } from 'lucide-react';
import { Sale } from '@/domain/types';
import { getActiveSales } from '@/repositories/saleRepository';
import { useToast } from '@/hooks/use-toast';
import { getMobiles, saveMobiles } from '@/data/mobilesData';
import { getDevices, saveDevices } from '@/data/devicesData';
import { getComputers, saveComputers } from '@/data/computersData';
import { getCars, saveCars } from '@/data/carsData';
import { restoreBatchQty } from '@/data/batchesData';
import { BatchSaleResult } from '@/domain/types';

interface ReturnedItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  returnQty: number;
  reason: string;
  batches?: BatchSaleResult['batches']; // Stored original batches to restore
}

const RETURNS_KEY = 'gx_returns_v2';

function saveReturn(data: object) {
  try {
    const existing = JSON.parse(localStorage.getItem(RETURNS_KEY) || '[]');
    const id = crypto.randomUUID();
    const count = existing.length + 1;
    localStorage.setItem(RETURNS_KEY, JSON.stringify([...existing, {
      ...data,
      id,
      returnNumber: `RET-${count.toString().padStart(4, '0')}`,
      createdAt: new Date().toISOString(),
    }]));
  } catch { /* ignore */ }
}

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

export default function ReturnsPage() {
  const { toast } = useToast();
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [foundSale, setFoundSale] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnedItem[]>([]);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [notFound, setNotFound] = useState(false);

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
      setFoundSale(sale);
      setReturnItems(sale.items.map(item => ({
        productId: item.productId,
        name: item.name,
        qty: item.qty,
        price: item.price,
        returnQty: 0,
        reason: '',
        batches: item.batches,
      })));
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
    for (const item of itemsToReturn) {
      if (item.returnQty > item.qty) {
        toast({ title: 'خطأ', description: `كمية ${item.name} المرتجعة أكبر من المباعة`, variant: 'destructive' });
        return;
      }
    }

    const totalRefund = itemsToReturn.reduce((s, i) => s + i.returnQty * i.price, 0);

    itemsToReturn.forEach(item => {
      // 1. Restore the item quantity in the correct inventory
      try {
        // Try mobiles
        const mobiles = getMobiles();
        const mobileIdx = mobiles.findIndex(m => m.id === item.productId);
        if (mobileIdx >= 0) {
          mobiles[mobileIdx] = { ...mobiles[mobileIdx], quantity: mobiles[mobileIdx].quantity + item.returnQty, updatedAt: new Date().toISOString() };
          saveMobiles(mobiles);
        } else {
          // Try devices
          const devices = getDevices();
          const deviceIdx = devices.findIndex(d => d.id === item.productId);
          if (deviceIdx >= 0) {
            devices[deviceIdx] = { ...devices[deviceIdx], quantity: devices[deviceIdx].quantity + item.returnQty, updatedAt: new Date().toISOString() };
            saveDevices(devices);
          } else {
            // Try computers
            const computers = getComputers();
            const computerIdx = computers.findIndex(c => c.id === item.productId);
            if (computerIdx >= 0) {
              computers[computerIdx] = { ...computers[computerIdx], quantity: computers[computerIdx].quantity + item.returnQty, updatedAt: new Date().toISOString() };
              saveComputers(computers);
            } else {
              // Try cars
              const cars = getCars();
              const carIdx = cars.findIndex(c => c.id === item.productId);
              if (carIdx >= 0) {
                cars[carIdx] = { ...cars[carIdx], quantity: (cars[carIdx] as any).quantity ? (cars[carIdx] as any).quantity + item.returnQty : item.returnQty, updatedAt: new Date().toISOString() } as any;
                saveCars(cars);
              }
            }
          }
        }
      } catch { /* ignore */ }

      // 2. Restore FIFO Batches
      if (item.batches && item.batches.length > 0) {
        let qtyToRestore = item.returnQty;

        // Restore newer batches first (often latest purchased is returned first logically in FIFO reverse)
        // or just restore exactly from where it was deducted based on original quantities
        const reversedBatches = [...item.batches].reverse();
        for (const batch of reversedBatches) {
          if (qtyToRestore <= 0) break;

          const restoreAmount = Math.min(qtyToRestore, batch.qtyFromBatch);
          restoreBatchQty(batch.batchId, restoreAmount);
          qtyToRestore -= restoreAmount;
        }
      }
    });

    saveReturn({
      originalInvoiceNumber: foundSale!.invoiceNumber,
      originalSaleId: foundSale!.id,
      date: returnDate,
      items: itemsToReturn.map(i => ({ productId: i.productId, name: i.name, qty: i.returnQty, price: i.price, reason: i.reason })),
      totalRefund,
    });

    toast({ title: '✅ تم تسجيل المرتجع', description: `إجمالي الاسترداد: ${totalRefund.toLocaleString()} ج.م` });
    setFoundSale(null);
    setReturnItems([]);
    setInvoiceSearch('');
  };

  return (
    <div className="space-y-5 animate-fade-in" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 border border-rose-200">
          <RotateCcw className="h-5 w-5 text-rose-600" />
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
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">لم يتم العثور على فاتورة بهذا الرقم</p>
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
                    <p className="text-xs text-muted-foreground">المباع: {item.qty} — سعر الوحدة: {item.price.toLocaleString()} ج.م</p>
                  </div>
                  {item.returnQty > 0 && (
                    <span className="rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-xs font-bold">
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
                      max={item.qty}
                      value={item.returnQty}
                      onChange={e => updateItem(i, 'returnQty', Math.max(0, Math.min(item.qty, +e.target.value)))}
                      className={IC}
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
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex justify-between items-center">
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
              <Check className="h-4 w-4" /> تأكيد الإرجاع
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
