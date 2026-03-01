import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, ArrowLeftRight, Printer, ShoppingCart, Sparkles, Package, Tag, Percent, Keyboard, Scan, Smartphone, Monitor, Tv, Car, Layers, X, Loader2, User, FileText, PauseCircle, Clock, ChevronDown, ChevronUp, StickyNote, Receipt, Headphones, Wrench, Send, HelpCircle, RotateCcw, Calculator } from 'lucide-react';
import { getCustomers, Customer } from '@/data/customersData';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { CartItem, PaymentMethod } from '@/domain/types';
import { validateStock } from '@/domain/stock';
import { StockError } from '@/domain/stock';
import { getCartTotals, processSale } from '@/services/saleService';
import { searchProducts, lookupBarcode } from '@/services/productService';
import { getActiveSalePrice, getAvailableBatchesCount } from '@/domain/batchLogic';
import { getAllInventoryProducts } from '@/repositories/productRepository';
import { saveSale } from '@/repositories/saleRepository';
import { saveMovements } from '@/repositories/stockRepository';
import { saveAuditEntries } from '@/repositories/auditRepository';
import { updateProductQuantity } from '@/repositories/productRepository';
import { printInvoice } from '@/services/invoicePrinter';
import { useAuth } from '@/contexts/AuthContext';

// ── Sub-components ──────────────────────────────────────────

const CartItemRow = ({ item, onUpdateQty, onRemove, onLineDiscount }: {
  item: CartItem;
  onUpdateQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onLineDiscount: (id: string, discount: number) => void;
}) => {
  const [showDiscount, setShowDiscount] = useState(false);
  const lineTotal = item.product.sellingPrice * item.qty - item.lineDiscount;
  return (
    <div className="group rounded-xl bg-gradient-to-l from-muted/40 to-transparent border border-border/30 p-3 transition-all duration-300 hover:from-muted/60">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-card-foreground truncate">{item.product.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{item.product.sellingPrice.toLocaleString('ar-EG')} EGP × {item.qty}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setShowDiscount(!showDiscount)} title="خصم" className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-all">
            <Percent className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onRemove(item.product.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {showDiscount && (
        <div className="mt-2 flex items-center gap-2">
          <Percent className="h-3 w-3 text-amber-500" />
          <input type="number" min={0} value={item.lineDiscount || ''} onChange={e => onLineDiscount(item.product.id, +e.target.value)}
            placeholder="0" className="w-20 rounded-lg border border-border/50 bg-background/50 px-2 py-1 text-xs text-end focus:outline-none focus:ring-1 focus:ring-primary/30" />
          <span className="text-[10px] text-muted-foreground">ج.م خصم</span>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button onClick={() => onUpdateQty(item.product.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/50 text-card-foreground hover:bg-primary hover:text-primary-foreground transition-all shadow-sm">
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-8 text-center text-sm font-bold text-card-foreground">{item.qty}</span>
          <button onClick={() => onUpdateQty(item.product.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/50 text-card-foreground hover:bg-primary hover:text-primary-foreground transition-all shadow-sm">
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <div className="text-end">
          <span className="text-sm font-bold text-primary">{lineTotal.toLocaleString('ar-EG')} EGP</span>
          {item.lineDiscount > 0 && <p className="text-[9px] text-amber-500">-{item.lineDiscount} خصم</p>}
        </div>
      </div>
    </div>
  );
};

// ── Main POS Component ──────────────────────────────────────

// Held invoices storage
const HELD_KEY = 'elos_held_invoices';
interface HeldInvoice { id: string; cart: CartItem[]; customer: string; notes: string; discount: number; heldAt: string; }

const POS = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cash');
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');
  const searchRef = useRef<HTMLInputElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── New POS Features State ──
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [amountPaid, setAmountPaid] = useState(0);
  const [showHeld, setShowHeld] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>(() => getStorageItem<HeldInvoice[]>(HELD_KEY, []));
  const customers = useMemo(() => getCustomers(), [refreshKey]);
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 5);
    const q = customerSearch.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || c.phone?.includes(q)).slice(0, 8);
  }, [customers, customerSearch]);
  const recentSales = useMemo(() => getStorageItem<any[]>('gx_sales', []).slice(-8).reverse(), [refreshKey]);

  // ── Transfers State ──
  const TRANSFER_KEY = 'elos_transfers';
  interface Transfer { id: string; customer: string; phone: string; type: string; amount: number; commission: number; date: string; }
  const [transferCustomer, setTransferCustomer] = useState('');
  const [transferPhone, setTransferPhone] = useState('');
  const [transferType, setTransferType] = useState('فودافون كاش');
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferCommission, setTransferCommission] = useState(0);
  const [shiftTransfers, setShiftTransfers] = useState<Transfer[]>(() => {
    const saved = getStorageItem<Transfer[]>(TRANSFER_KEY, []);
    // Only keep today's transfers
    const today = new Date().toDateString();
    return saved.filter(t => new Date(t.date).toDateString() === today);
  });
  const transferTypes = ['فودافون كاش', 'اتصالات كاش', 'اورنج كاش', 'ويي', 'انستاباي', 'تحويل بنكي'];

  const registerTransfer = () => {
    if (transferAmount <= 0) { toast({ title: 'أدخل مبلغ التحويل', variant: 'destructive' }); return; }
    const t: Transfer = { id: Date.now().toString(), customer: transferCustomer, phone: transferPhone, type: transferType, amount: transferAmount, commission: transferCommission, date: new Date().toISOString() };
    const updated = [...shiftTransfers, t];
    setShiftTransfers(updated); setStorageItem(TRANSFER_KEY, updated);
    setTransferCustomer(''); setTransferPhone(''); setTransferAmount(0); setTransferCommission(0);
    toast({ title: '✅ تم تسجيل التحويل', description: `${transferType} — ${transferAmount} ج.م` });
  };
  const totalTransferCommissions = useMemo(() => shiftTransfers.reduce((s, t) => s + t.commission, 0), [shiftTransfers]);

  // ── Brand filter for products ──
  const [selectedBrand, setSelectedBrand] = useState('الكل');
  const brands = ['الكل', 'Apple', 'Samsung', 'Xiaomi', 'Realme', 'Vivo', 'Huawei', 'Nokia', 'أخرى'];

  // Stats
  const todaySales = useMemo(() => {
    const today = new Date().toDateString();
    return getStorageItem<any[]>('gx_sales', []).filter((s: any) => new Date(s.date).toDateString() === today);
  }, [refreshKey]);
  const todayTotal = useMemo(() => todaySales.reduce((s: number, sale: any) => s + (sale.total || 0), 0), [todaySales]);

  // Hold invoice
  const holdInvoice = () => {
    if (cart.length === 0) return;
    const h: HeldInvoice = { id: Date.now().toString(), cart: [...cart], customer: selectedCustomer, notes: invoiceNotes, discount: invoiceDiscount, heldAt: new Date().toISOString() };
    const updated = [...heldInvoices, h];
    setHeldInvoices(updated); setStorageItem(HELD_KEY, updated);
    setCart([]); setInvoiceDiscount(0); setInvoiceNotes(''); setSelectedCustomer('');
    toast({ title: '✉️ تم تعليق الفاتورة', description: `عدد المعلقات: ${updated.length}` });
  };
  const resumeInvoice = (id: string) => {
    const h = heldInvoices.find(x => x.id === id);
    if (!h) return;
    setCart(h.cart); setInvoiceDiscount(h.discount); setInvoiceNotes(h.notes); setSelectedCustomer(h.customer);
    const updated = heldInvoices.filter(x => x.id !== id);
    setHeldInvoices(updated); setStorageItem(HELD_KEY, updated);
    setShowHeld(false);
    toast({ title: '✅ تم استرجاع الفاتورة' });
  };
  const deleteHeld = (id: string) => {
    const updated = heldInvoices.filter(x => x.id !== id);
    setHeldInvoices(updated); setStorageItem(HELD_KEY, updated);
  };
  const updateLineDiscount = useCallback((id: string, discount: number) => {
    setCart(prev => prev.map(c => c.product.id === id ? { ...c, lineDiscount: Math.max(0, discount) } : c));
  }, []);

  // Main categories configuration
  const mainCategories = [
    { id: 'all', label: 'الكل', icon: Layers },
    { id: 'mobiles', label: 'موبيلات', icon: Smartphone },
    { id: 'computers', label: 'كمبيوترات', icon: Monitor },
    { id: 'devices', label: 'أجهزة', icon: Tv },
    { id: 'cars', label: 'سيارات', icon: Car },
  ];

  // Subcategories based on main category
  const getSubCategories = (mainCat: string) => {
    const subs: Record<string, { id: string; label: string }[]> = {
      all: [
        { id: 'all', label: 'الكل' },
        { id: 'new', label: 'جديد' },
        { id: 'used', label: 'مستعمل' },
        { id: 'accessory', label: 'إكسسوار' },
      ],
      mobiles: [
        { id: 'all', label: 'الكل' },
        { id: 'mobile-new', label: 'موبايلات جديد' },
        { id: 'mobile-used', label: 'موبايلات مستعمل' },
        { id: 'tablet', label: 'تابلت' },
        { id: 'maccessory', label: 'إكسسوارات' },
      ],
      computers: [
        { id: 'all', label: 'الكل' },
        { id: 'laptop', label: 'لابتوب' },
        { id: 'desktop', label: 'كمبيوتر مكتبى' },
        { id: 'caccessory', label: 'إكسسوارات' },
      ],
      devices: [
        { id: 'all', label: 'الكل' },
        { id: 'screen', label: 'شاشات' },
        { id: 'gaming', label: 'أجهزة ألعاب' },
        { id: 'daccessory', label: 'إكسسوارات' },
      ],
      cars: [
        { id: 'all', label: 'الكل' },
        { id: 'car-new', label: 'جديد' },
        { id: 'car-used', label: 'مستعمل' },
      ],
    };
    return subs[mainCat] || subs.all;
  };

  // Flash scanner indicator on scan
  const flashScanner = useCallback(() => {
    setScannerActive(true);
    clearTimeout(scannerTimer.current);
    scannerTimer.current = setTimeout(() => setScannerActive(false), 1200);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allProducts = useMemo(() => getAllInventoryProducts(), [refreshKey]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent | CustomEvent) => {
      const key = 'key' in e ? e.key : e.detail?.key;
      if (key && key.startsWith('gx_')) {
        setRefreshKey(k => k + 1);
      }
    };
    window.addEventListener('storage', handleStorage as EventListener);
    window.addEventListener('local-storage', handleStorage as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage as EventListener);
      window.removeEventListener('local-storage', handleStorage as EventListener);
    };
  }, []);

  // Auto-focus search on mount
  useEffect(() => { searchRef.current?.focus(); }, []);

  // ── Hardware barcode scanner (USB/Laser) ─────────────────
  useBarcodeScanner({
    onScan: useCallback((code: string) => {
      flashScanner();
      const match = lookupBarcode(allProducts, code);
      if (match) {
        addToCart(match);
        toast({ title: `📦 ${match.name}`, description: `باركود: ${code}` });
      } else {
        toast({ title: '⚠️ باركود غير موجود', description: code, variant: 'destructive' });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allProducts, flashScanner]),
    minLength: 3,
    maxGap: 60,
  });


  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { searchRef.current?.focus(); e.preventDefault(); }
      if (e.key === 'F9') { handleCheckout(); e.preventDefault(); }
      if (e.key === 'Escape') { setSearchTerm(''); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, invoiceDiscount, selectedPayment]);

  const addToCart = useCallback((product: typeof allProducts[0]) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      const currentQty = existing ? existing.qty : 0;

      try {
        validateStock(product, currentQty + 1);
      } catch (err) {
        if (err instanceof StockError) {
          toast({ title: 'Stock limit reached', description: err.message, variant: 'destructive' });
        }
        return prev;
      }

      if (existing) {
        return prev.map(c => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { product, qty: 1, lineDiscount: 0 }];
    });
    setSearchTerm('');
    searchRef.current?.focus();
  }, [toast]);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.product.id !== id) return c;
      const newQty = c.qty + delta;
      if (newQty <= 0) return c;
      try {
        validateStock(c.product, newQty);
      } catch {
        toast({ title: 'Stock limit', variant: 'destructive' });
        return c;
      }
      return { ...c, qty: newQty };
    }));
  }, [toast]);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(c => c.product.id !== id));
  }, []);

  // Real-time totals via service layer
  const totals = useMemo(() => getCartTotals(cart, invoiceDiscount), [cart, invoiceDiscount]);

  // Filter products by category selection
  const categoryFilteredProducts = useMemo(() => {
    if (selectedMainCategory === 'all' && selectedSubCategory === 'all') {
      return allProducts;
    }

    return allProducts.filter(p => {
      const category = p.category?.toLowerCase() || '';
      const isUsed = false; // Product type doesn't have isUsed field

      // Main category filter
      if (selectedMainCategory !== 'all') {
        switch (selectedMainCategory) {
          case 'mobiles':
            if (!category.includes('موبيل') && !category.includes('موبايل') && !category.includes('تبل') && !category.includes('سماع') && !category.includes('شاحن') && !category.includes('كفر') && !category.includes(' aux') && category !== 'mobile accessory' && category !== 'mobile') {
              // Check for car products - exclude
              if (category.includes('سيارة') || category.includes('car')) return false;
              // Check for computer products - exclude
              if (category.includes('لابتوب') || category.includes('كمبيوتر') || category.includes('ماوس') || category.includes('كيبورد') || category.includes('شاشة') || category.includes('computer') || category.includes('laptop') || category.includes('desktop') || category.includes('mouse') || category.includes('keyboard') || category.includes('monitor')) return false;
              // Check for devices
              if (category.includes('شاشة') || category.includes('جهاز') || category.includes('ألعاب') || category.includes('device') || category.includes('gaming')) return false;
              return true; // Allow if no specific match (might be mobile related)
            }
            break;
          case 'computers':
            if (!category.includes('لابتوب') && !category.includes('كمبيوتر') && !category.includes('ماوس') && !category.includes('كيبورد') && !category.includes('computer') && !category.includes('laptop') && !category.includes('desktop') && !category.includes('mouse') && !category.includes('keyboard')) {
              // Check for car products - exclude
              if (category.includes('سيارة') || category.includes('car')) return false;
              // Check for mobile products - exclude
              if (category.includes('موبيل') || category.includes('موبايل') || category.includes('تبل') || category.includes('سماع') || category.includes('شاحن') || category.includes('mobile') || category.includes('phone')) return false;
              // Check for devices
              if (category.includes('شاشة') || category.includes('جهاز') || category.includes('ألعاب') || category.includes('device') || category.includes('gaming')) return false;
              return true;
            }
            break;
          case 'devices':
            if (!category.includes('شاشة') && !category.includes('جهاز') && !category.includes('ألعاب') && !category.includes('device') && !category.includes('gaming') && !category.includes('شاش') && !category.includes('تلفزيون') && !category.includes('tv')) {
              // Check for car products - exclude
              if (category.includes('سيارة') || category.includes('car')) return false;
              // Check for mobile products - exclude
              if (category.includes('موبيل') || category.includes('موبايل') || category.includes('تبل') || category.includes('mobile') || category.includes('phone')) return false;
              // Check for computer products - exclude
              if (category.includes('لابتوب') || category.includes('كمبيوتر') || category.includes('computer') || category.includes('laptop') || category.includes('desktop')) return false;
              return true;
            }
            break;
          case 'cars':
            if (!category.includes('سيارة') && !category.includes('car')) {
              // Exclude non-car products
              if (category.includes('موبيل') || category.includes('موبايل') || category.includes('لابتوب') || category.includes('كمبيوتر') || category.includes('شاشة') || category.includes('device') || category.includes('mobile') || category.includes('computer') || category.includes('laptop')) return false;
              return true;
            }
            break;
        }
      }

      // Subcategory filter
      if (selectedSubCategory !== 'all') {
        switch (selectedSubCategory) {
          case 'new':
            if (isUsed) return false;
            break;
          case 'used':
            if (!isUsed) return false;
            break;
          case 'accessory':
            if (!category.includes('إكسسوار') && !category.includes('accessory') && !category.includes('سماع') && !category.includes('شاحن') && !category.includes('كفر') && !category.includes('ماوس') && !category.includes('كيبورد') && !category.includes('mouse') && !category.includes('keyboard')) return false;
            break;
          case 'mobile-new':
            if (isUsed) return false;
            if (!category.includes('موبيل') && !category.includes('موبايل') && category !== 'mobile') return false;
            break;
          case 'mobile-used':
            if (!isUsed) return false;
            if (!category.includes('موبيل') && !category.includes('موبايل') && category !== 'mobile') return false;
            break;
          case 'tablet':
            if (!category.includes('تبل') && !category.includes('tablet')) return false;
            break;
          case 'maccessory':
            if (!category.includes('إكسسوار') && !category.includes('accessory') && !category.includes('سماع') && !category.includes('شاحن') && !category.includes('كفر') && category !== 'mobile accessory') return false;
            break;
          case 'laptop':
            if (!category.includes('لابتوب') && !category.includes('laptop')) return false;
            break;
          case 'desktop':
            if (!category.includes('مكتبى') && !category.includes('desktop') && !category.includes('كمبيوتر')) return false;
            break;
          case 'caccessory':
            if (!category.includes('إكسسوار') && !category.includes('accessory') && !category.includes('ماوس') && !category.includes('كيبورد') && !category.includes('mouse') && !category.includes('keyboard') && category !== 'computer accessory') return false;
            break;
          case 'screen':
            if (!category.includes('شاشة') && !category.includes('screen') && !category.includes('monitor') && !category.includes('تلفزيون') && !category.includes('tv')) return false;
            break;
          case 'gaming':
            if (!category.includes('لعب') && !category.includes('gaming') && !category.includes('جهاز')) return false;
            break;
          case 'daccessory':
            if (!category.includes('إكسسوار') && !category.includes('accessory') && !category.includes('تحكم') && !category.includes('controller')) return false;
            break;
          case 'car-new':
            if (isUsed) return false;
            if (!category.includes('سيارة') && !category.includes('car')) return false;
            break;
          case 'car-used':
            if (!isUsed) return false;
            if (!category.includes('سيارة') && !category.includes('car')) return false;
            break;
        }
      }

      return true;
    });
  }, [allProducts, selectedMainCategory, selectedSubCategory]);

  // Search results via service layer
  const filteredProducts = useMemo(
    () => searchTerm.length > 0 ? searchProducts(allProducts, searchTerm, undefined, 8) : [],
    [allProducts, searchTerm]
  );

  // Auto-add on exact barcode match
  useEffect(() => {
    if (searchTerm.length >= 8) {
      const match = lookupBarcode(allProducts, searchTerm);
      if (match) addToCart(match);
    }
  }, [searchTerm, addToCart, allProducts]);

  const handleCheckout = useCallback(() => {
    // Prevent double-click
    if (isProcessing || cart.length === 0) return;

    setIsProcessing(true);

    // Minimum discount limit warning (cost + profit * 0.5) => Max discount = profit / 2
    const maxDiscount = totals.grossProfit / 2;
    if (invoiceDiscount > maxDiscount && invoiceDiscount > 0) {
      if (!window.confirm(`⚠️ تحذير: الخصم المدخل (${invoiceDiscount} EGP) يتجاوز الحد الآمن (نصف الربح: ${maxDiscount} EGP). هل تريد الاستمرار وإتمام عملية الدفع بأي حال؟`)) {
        return;
      }
    }

    try {
      const userId = user?.id || 'user-1';
      const userName = user?.fullName || 'Ahmed';
      const result = processSale(cart, invoiceDiscount, selectedPayment, userId, userName);

      // Persist through repositories
      saveSale(result.sale);
      saveMovements(result.stockMovements);
      saveAuditEntries(result.auditEntries);

      // Update product quantities
      result.stockMovements.forEach(m => updateProductQuantity(m.productId, m.newQuantity));

      // Auto-print receipt
      try {
        printInvoice(result.sale);
      } catch {
        // Silent fail on print
      }

      toast({
        title: 'تمت العملية بنجاح!',
        description: `فاتورة: ${result.sale.invoiceNumber} — الإجمالي: ${result.sale.total.toFixed(2)} EGP | الربح: ${result.sale.grossProfit.toFixed(2)} EGP`,
      });

      setCart([]);
      setInvoiceDiscount(0);
      setIsProcessing(false); // Reset loading state
      setRefreshKey(k => k + 1);
      searchRef.current?.focus();
    } catch (err: unknown) {
      setIsProcessing(false); // Reset on error
      if (err instanceof Error) {
        toast({ title: 'فشلت العملية', description: err.message, variant: 'destructive' });
      } else {
        toast({ title: 'فشلت العملية', description: 'حدث خطأ غير معروف', variant: 'destructive' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, invoiceDiscount, selectedPayment, toast, user, totals.grossProfit]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!searchTerm.trim()) return;

      const match = lookupBarcode(allProducts, searchTerm);
      if (match) {
        addToCart(match);
      } else {
        toast({ title: t('pos.notFound'), variant: 'destructive' });
        setSearchTerm('');
      }
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-auto md:h-[calc(100vh-2rem)] gap-5 pb-20 md:pb-0">
      {/* Left: Product search & grid */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {t('pos.title')}
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t('pos.scanBarcode')}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
            <Keyboard className="h-4 w-4" />
            <span>F2 بحث • F9 دفع</span>
            <div className="w-px h-4 bg-border mx-1" />
            <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-300 ${scannerActive ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground/50'}`}>
              <Scan className={`h-3.5 w-3.5 ${scannerActive ? 'animate-pulse' : ''}`} />
              <span>{scannerActive ? 'تم المسح ✓' : 'جهاز الليز'}</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <div className="absolute start-4 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Search className="h-4 w-4 text-primary" />
          </div>
          <input
            ref={searchRef}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('pos.scanBarcode')}
            className="w-full rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm ps-16 pe-20 py-4 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 shadow-soft transition-all duration-300"
          />
          <span className="absolute end-4 top-1/2 -translate-y-1/2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-[10px] font-mono font-medium text-muted-foreground border border-border/30">F2</span>
        </div>

        {/* Search Results */}
        {filteredProducts.length > 0 && (
          <div className="mb-5 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-3 shadow-elevated animate-slide-down">
            {filteredProducts.map((p, i) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-start hover:bg-gradient-to-l hover:from-primary/5 hover:to-transparent transition-all duration-200"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.barcode}</p>
                  </div>
                </div>
                <div className="text-end">
                  <p className="text-base font-bold text-primary">{(getActiveSalePrice(p.id) ?? p.sellingPrice).toLocaleString('ar-EG')} EGP</p>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {getAvailableBatchesCount(p.id)} {t('pos.batches') || 'دفعات'}
                    </span>
                    <p className="text-xs text-muted-foreground">{p.quantity} متوفر</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Category Tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {/* Main Categories */}
          <div className="flex gap-1.5">
            {mainCategories.map(cat => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedMainCategory(cat.id); setSelectedSubCategory('all'); }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                    selectedMainCategory === cat.id
                      ? 'bg-primary text-primary-foreground shadow-lg'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subcategory Tabs */}
        {selectedMainCategory !== 'all' && (
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
            {getSubCategories(selectedMainCategory).map(sub => (
              <button
                key={sub.id}
                onClick={() => setSelectedSubCategory(sub.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap',
                  selectedSubCategory === sub.id
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                )}
              >
                {sub.label}
              </button>
            ))}
            <button
              onClick={() => setSelectedSubCategory('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                selectedSubCategory === 'all'
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
              )}
            >
              الكل
            </button>
          </div>
        )}

        {/* Product count */}
        <div className="mb-3 text-xs text-muted-foreground">
          {categoryFilteredProducts.length} منتج
        </div>

        {/* Product grid */}
        <div className="grid flex-1 grid-cols-2 gap-4 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4 content-start pr-1 pb-4">
          {categoryFilteredProducts.map((p, i) => {
            const isLow = p.quantity <= 5;
            const isOut = p.quantity === 0;
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={isOut}
                className={cn(
                  'group relative flex flex-col rounded-2xl border bg-card/80 backdrop-blur-sm p-4 text-start transition-all duration-300',
                  isOut
                    ? 'border-border/30 opacity-50 cursor-not-allowed'
                    : 'border-border/50 hover:border-primary/40 hover:shadow-elevated hover:-translate-y-1 active:scale-[0.98] card-hover'
                )}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {/* Category badge */}
                <span className="mb-3 inline-flex items-center gap-1 self-start rounded-lg bg-gradient-to-l from-primary/15 to-secondary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                  <Tag className="h-3 w-3" />
                  {p.category}
                </span>

                {/* Product name */}
                <p className="text-sm font-bold text-card-foreground leading-snug line-clamp-2 min-h-[2.5rem]">
                  {p.name}
                </p>

                {/* Model */}
                {p.model && (
                  <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                    {p.model}
                  </p>
                )}

                {/* Divider */}
                <div className="my-3 h-px w-full bg-gradient-to-l from-transparent via-border/60 to-transparent" />

                {/* Price + Stock */}
                <div className="flex w-full flex-col gap-1.5">
                  <div className="flex w-full items-end justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">سعر الكاش</p>
                      <p className="text-lg font-extrabold text-primary leading-none">
                        {(getActiveSalePrice(p.id) ?? p.sellingPrice).toLocaleString('ar-EG')}
                        <span className="text-[10px] font-medium text-muted-foreground ms-1">EGP</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn(
                        'rounded-lg px-2.5 py-1 text-[10px] font-bold',
                        isOut ? 'bg-destructive/10 text-destructive' :
                          isLow ? 'bg-warning/10 text-warning' :
                            'bg-chart-3/10 text-chart-3'
                      )}>
                        {isOut ? 'نفذ' : `${p.quantity} قطعة`}
                      </span>
                      {!isOut && getAvailableBatchesCount(p.id) > 1 && (
                        <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full border border-blue-200">
                          {getAvailableBatchesCount(p.id)} دفعات
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex w-full items-end justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">سعر التقسيط</p>
                      <p className="text-sm font-bold text-muted-foreground leading-none">
                        {((p as { installmentPrice?: number }).installmentPrice || p.sellingPrice * 1.3).toLocaleString('ar-EG')}
                        <span className="text-[10px] font-medium text-muted-foreground ms-1">EGP</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Hover overlay */}
                {!isOut && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="flex w-full md:w-[400px] flex-col rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-elevated overflow-hidden mt-4 md:mt-0">
        {/* Cart Header */}
        <div className="border-b border-border/30 px-4 py-3 bg-gradient-to-l from-primary/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <ShoppingCart className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-card-foreground">{t('pos.cart')} <span className="text-xs font-normal text-muted-foreground">({cart.length})</span></h2>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {cart.length > 0 && (
                <button onClick={() => { if (window.confirm('مسح السلة؟')) setCart([]); }}
                  className="text-[10px] text-destructive hover:bg-destructive/10 rounded-lg px-2 py-1 transition-all">
                  مسح
                </button>
              )}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 mt-2">
            <button onClick={holdInvoice} disabled={cart.length === 0} title="تعليق الفاتورة"
              className="flex items-center gap-1 rounded-lg bg-amber-500/10 text-amber-600 px-2.5 py-1.5 text-[10px] font-medium hover:bg-amber-500/20 transition-all disabled:opacity-40">
              <PauseCircle className="h-3 w-3" /> تعليق
              {heldInvoices.length > 0 && <span className="bg-amber-500 text-white text-[8px] rounded-full px-1">{heldInvoices.length}</span>}
            </button>
            <button onClick={() => setShowHeld(!showHeld)} title="الفواتير المعلقة"
              className={cn('flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-all', showHeld ? 'bg-primary/20 text-primary' : 'bg-muted/50 text-muted-foreground hover:bg-muted')}>
              <FileText className="h-3 w-3" /> معلقة
            </button>
            <button onClick={() => setShowRecent(!showRecent)} title="آخر الفواتير"
              className={cn('flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-all', showRecent ? 'bg-primary/20 text-primary' : 'bg-muted/50 text-muted-foreground hover:bg-muted')}>
              <Clock className="h-3 w-3" /> سجل
            </button>
          </div>
        </div>

        {/* Customer Picker */}
        <div className="px-4 py-2 border-b border-border/20">
          <div className="relative">
            <button onClick={() => setShowCustomerPicker(!showCustomerPicker)}
              className="w-full flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs hover:bg-muted/50 transition-all">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-primary" />
                <span className="text-card-foreground font-medium">{selectedCustomer || 'عميل نقدي (اختياري)'}</span>
              </div>
              {showCustomerPicker ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
            </button>
            {showCustomerPicker && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-xl p-2 animate-slide-down">
                <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="بحث عن عميل..." autoFocus
                  className="w-full rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs mb-1 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  <button onClick={() => { setSelectedCustomer(''); setShowCustomerPicker(false); setCustomerSearch(''); }}
                    className="w-full text-start rounded-lg px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors text-muted-foreground">عميل نقدي</button>
                  {filteredCustomers.map(c => (
                    <button key={c.id} onClick={() => { setSelectedCustomer(c.name); setShowCustomerPicker(false); setCustomerSearch(''); }}
                      className="w-full text-start rounded-lg px-2 py-1.5 text-xs hover:bg-primary/5 transition-colors flex items-center justify-between">
                      <span className="font-medium text-card-foreground">{c.name}</span>
                      {c.phone && <span className="text-[10px] text-muted-foreground font-mono">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Held Invoices Panel */}
        {showHeld && heldInvoices.length > 0 && (
          <div className="px-4 py-2 border-b border-border/20 bg-amber-500/5 animate-slide-down">
            <p className="text-[10px] font-bold text-amber-600 mb-1.5">الفواتير المعلقة ({heldInvoices.length})</p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {heldInvoices.map(h => (
                <div key={h.id} className="flex items-center justify-between rounded-lg bg-white/50 dark:bg-white/5 px-2 py-1.5">
                  <div>
                    <p className="text-[10px] font-bold text-card-foreground">{h.cart.length} منتج • {h.customer || 'نقدي'}</p>
                    <p className="text-[9px] text-muted-foreground">{new Date(h.heldAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => resumeInvoice(h.id)} className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded font-medium hover:bg-primary/20">استرجاع</button>
                    <button onClick={() => deleteHeld(h.id)} className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded hover:bg-destructive/20"><X className="h-2.5 w-2.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Sales Panel */}
        {showRecent && recentSales.length > 0 && (
          <div className="px-4 py-2 border-b border-border/20 bg-blue-500/5 animate-slide-down">
            <p className="text-[10px] font-bold text-blue-600 mb-1.5">آخر الفواتير</p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {recentSales.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-white/50 dark:bg-white/5 px-2 py-1">
                  <div>
                    <p className="text-[10px] font-bold text-card-foreground">#{s.invoiceNumber} <span className="text-muted-foreground font-normal">• {s.paymentMethod}</span></p>
                    <p className="text-[9px] text-muted-foreground">{new Date(s.date).toLocaleDateString('ar-EG')}</p>
                  </div>
                  <span className="text-[10px] font-bold text-primary">{s.total?.toLocaleString('ar-EG')} EGP</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/30 mb-3">
                <ShoppingCart className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">{t('pos.noItems')}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">اضغط على المنتجات لإضافتها</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item, i) => (
                <div key={item.product.id} className="animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                  <CartItemRow item={item} onUpdateQty={updateQty} onRemove={removeFromCart} onLineDiscount={updateLineDiscount} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals & Payment */}
        <div className="border-t border-border/30 bg-gradient-to-t from-muted/20 to-transparent px-4 py-4 space-y-3">
          {/* Notes */}
          <div className="flex items-center gap-2">
            <StickyNote className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} placeholder="ملاحظات الفاتورة (اختياري)"
              className="flex-1 rounded-lg border border-border/40 bg-background/50 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/20" />
          </div>

          {/* Subtotal & Discount */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('pos.subtotal')}</span>
              <span className="font-medium text-card-foreground">{totals.subtotal.toLocaleString('ar-EG')} EGP</span>
            </div>
            {cart.reduce((sum, c) => sum + c.lineDiscount, 0) > 0 && (
              <div className="flex justify-between text-amber-500">
                <span>خصم الأصناف</span>
                <span className="font-medium">-{cart.reduce((sum, c) => sum + c.lineDiscount, 0).toLocaleString('ar-EG')} EGP</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Percent className="h-3 w-3" />
                <span>خصم الفاتورة</span>
              </div>
              <input type="number" value={invoiceDiscount || ''} onChange={(e) => setInvoiceDiscount(Number(e.target.value))}
                className="w-20 rounded-lg border border-border/50 bg-background/50 px-2 py-1 text-end text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20" min={0} placeholder="0" />
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-end border-t border-border/30 pt-2">
            <div>
              <p className="text-[10px] text-muted-foreground">{t('pos.total')}</p>
              <p className="text-xl font-extrabold text-card-foreground">{totals.total.toLocaleString('ar-EG')} EGP</p>
            </div>
            <div className="text-end">
              <p className="text-[10px] text-muted-foreground">{t('pos.profit')}</p>
              <p className="text-sm font-bold text-chart-3">{totals.grossProfit.toLocaleString('ar-EG')} EGP</p>
              <p className="text-[9px] text-muted-foreground">هامش {totals.marginPct}%</p>
            </div>
          </div>

          {/* Change Calculation */}
          {selectedPayment === 'cash' && cart.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
              <div className="flex-1">
                <p className="text-[10px] text-emerald-600 font-medium mb-0.5">المبلغ المدفوع</p>
                <input type="number" value={amountPaid || ''} onChange={e => setAmountPaid(+e.target.value)} placeholder={totals.total.toString()}
                  className="w-full bg-transparent text-sm font-bold text-emerald-700 focus:outline-none placeholder:text-emerald-400/40" min={0} />
              </div>
              {amountPaid > 0 && (
                <div className="text-end border-r border-emerald-500/20 pr-3">
                  <p className="text-[10px] text-emerald-600">الباقي</p>
                  <p className={cn('text-base font-extrabold', amountPaid >= totals.total ? 'text-emerald-600' : 'text-destructive')}>
                    {(amountPaid - totals.total).toLocaleString('ar-EG')} EGP
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Payment method */}
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { key: 'cash' as const, icon: Banknote, label: t('pos.cash'), color: 'from-emerald-500/20 to-teal-500/20', iconColor: 'text-emerald-500' },
              { key: 'card' as const, icon: CreditCard, label: t('pos.card'), color: 'from-blue-500/20 to-indigo-500/20', iconColor: 'text-blue-500' },
              { key: 'split' as const, icon: ArrowLeftRight, label: t('pos.split'), color: 'from-violet-500/20 to-purple-500/20', iconColor: 'text-violet-500' },
            ]).map(pm => (
              <button key={pm.key} onClick={() => setSelectedPayment(pm.key)}
                className={cn('flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-[10px] font-medium transition-all',
                  selectedPayment === pm.key ? `bg-gradient-to-br ${pm.color} border-2 border-primary/30 shadow-lg` : 'bg-muted/30 border-2 border-transparent text-muted-foreground hover:bg-muted/50')}>
                <pm.icon className={cn('h-4 w-4', selectedPayment === pm.key ? pm.iconColor : '')} />
                {pm.label}
              </button>
            ))}
          </div>

          {/* Checkout Button */}
          <button onClick={handleCheckout} disabled={cart.length === 0 || isProcessing}
            className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-l from-primary to-secondary py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl disabled:opacity-50 disabled:shadow-none transition-all">
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isProcessing ? (<><Loader2 className="h-4 w-4 animate-spin" /> جاري المعالجة...</>) :
                (<><Printer className="h-4 w-4" /> {t('pos.checkout')} — {totals.total.toLocaleString('ar-EG')} EGP <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-mono">F9</span></>)}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default POS;
