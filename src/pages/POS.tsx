// ============================================================
// نقطة البيع — POS Page V5 — Enterprise UX Redesign
// التصنيفات تُقرأ مباشرة من مفاتيح localStorage الخاصة بالمخازن
// ============================================================

import { useState, useRef, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import {
  Search, Moon, Sun, Clock, Barcode, Download,
  Send, ArrowLeft, Package, AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/domain/types';
import { searchProducts } from '@/services/productService';
import { getAllInventoryProducts } from '@/repositories/productRepository';
import { loadCats } from '@/data/categoriesData';
import { useCart } from '@/contexts/CartContext';

// Sub-components
import CategoryNavPanel, { TabId, SubMode, ConditionFilter, TABS } from '@/components/pos/CategoryNavPanel';
import POSProductGrid from '@/components/pos/POSProductGrid';
import CheckoutSidebar from '@/components/pos/CheckoutSidebar';
import TransferTab from '@/components/pos/TransferTab';
import HeldInvoicesPanel from '@/components/pos/HeldInvoicesPanel';
import CustomerSelector, { CASH_CUSTOMER, SelectedCustomer } from '@/components/pos/CustomerSelector';

// Quick discount presets (shown as buttons in the toolbar)
const QUICK_DISCOUNTS = [
  { label: '5%',  value: 5,  key: 'F7' },
  { label: '10%', value: 10, key: 'F8' },
  { label: '15%', value: 15, key: null },
];

// ── Main POS ─────────────────────────────────────────────────
export default function POS() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const {
    cart, addToCart, removeFromCart, updateCartItemQty, updateLineDiscount,
    clearCart, invoiceDiscount, applyInvoiceDiscount,
    holdInvoice, heldInvoices, restoreInvoice, removeHeldInvoice,
  } = useCart();

  // Delta-to-absolute adapter for CheckoutSidebar
  const updateQtyByDelta = useCallback((productId: string, delta: number) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;
    updateCartItemQty(productId, item.qty + delta);
  }, [cart, updateCartItemQty]);

  // Computed cart values
  const subtotal           = cart.reduce((s, i) => s + i.product.sellingPrice * i.qty, 0);
  const lineDiscountsTotal = cart.reduce((s, i) => s + (i.lineDiscount ?? 0), 0);
  const totalCost          = cart.reduce((s, i) => s + i.product.costPrice * i.qty, 0);
  const maxInvoiceDiscount = Math.max(0, subtotal - lineDiscountsTotal - totalCost);
  const grandTotal         = Math.max(0, subtotal - lineDiscountsTotal - invoiceDiscount);

  // ── Local state ─────────────────────────────────────────────
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm]           = useState('');
  const [selectedTab, setSelectedTab]         = useState<TabId>('mobiles');
  const [selectedChip, setSelectedChip]       = useState('الكل');
  const [subMode, setSubMode]                 = useState<SubMode>('main');
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>('all');
  const [showHeld, setShowHeld]               = useState(false);
  const [now, setNow]                         = useState(new Date());
  const [refreshKey, setRefreshKey]           = useState(0);
  const deferredSearchTerm                    = useDeferredValue(searchTerm);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer>(CASH_CUSTOMER);

  // Checkout trigger ref (injected by CheckoutSidebar)
  const checkoutTriggerRef = useRef<(() => void) | null>(null);

  // Stable refs for keyboard handler
  const filteredProductsRef = useRef<Product[]>([]);
  const grandTotalRef       = useRef<number>(0);
  const searchTermRef       = useRef(searchTerm);

  const handleCheckoutReady = useCallback((trigger: () => void) => {
    checkoutTriggerRef.current = trigger;
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Listen for storage changes from inventory pages
  useEffect(() => {
    const handleStorage = (e: StorageEvent | CustomEvent) => {
      const key = 'key' in e ? e.key : (e as CustomEvent).detail?.key;
      if (key && (key.startsWith('gx_') || key.startsWith('elahmed_') || key.includes('_cats'))) {
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

  // Reset chip/subMode/condition when tab changes
  useEffect(() => {
    setSelectedChip('الكل');
    setSubMode('main');
    setConditionFilter('all');
  }, [selectedTab]);

  // Reset chip/condition when subMode changes
  useEffect(() => {
    setSelectedChip('الكل');
    setConditionFilter('all');
  }, [subMode]);

  // ── Keyboard Shortcuts ──────────────────────────────────────
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const isFKey  = e.key.startsWith('F') && !isNaN(Number(e.key.slice(1)));
      const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key);

      // Escape blurs and clears search
      if (e.key === 'Escape') {
        e.preventDefault();
        (e.target as HTMLElement).blur?.();
        searchInputRef.current?.blur();
        if (searchTermRef.current) setSearchTerm('');
        return;
      }

      // Block non-F-key shortcuts inside inputs
      if (inInput && !isFKey && !isNavKey) {
        if (!['+', '-', 'Delete', 'Backspace'].includes(e.key)) return;
      }

      // Numpad 1-9: quick add product by position
      const numMatch = e.key.match(/^(\d|Numpad\d)$/);
      if (numMatch && !inInput) {
        const num = parseInt(e.key.replace('Numpad', ''), 10);
        if (num >= 1 && num <= 9) {
          e.preventDefault();
          const product = filteredProductsRef.current[num - 1];
          if (product && product.quantity > 0) {
            addToCart(product);
            toast({ title: `✅ تمت الإضافة`, description: product.name });
          }
        }
        return;
      }

      switch (e.key) {
        case 'F1':
          e.preventDefault();
          searchInputRef.current?.focus();
          break;
        case 'F2':
          e.preventDefault();
          setSelectedTab('mobiles');
          setSelectedChip('الكل');
          break;
        case 'F3':
          e.preventDefault();
          setSelectedTab('devices');
          setSelectedChip('الكل');
          break;
        case 'F4':
          e.preventDefault();
          setSelectedTab('cars');
          setSelectedChip('الكل');
          break;
        case 'F5':
          e.preventDefault();
          setSelectedTab('transfers');
          break;
        case 'F6':
          e.preventDefault();
          setShowHeld(true);
          break;
        case 'F7':
          e.preventDefault();
          if (grandTotalRef.current > 0) {
            applyInvoiceDiscount(Math.round(grandTotalRef.current * 0.05 * 2) / 2);
            toast({ title: '💰 تم تطبيق خصم 5%' });
          }
          break;
        case 'F8':
          e.preventDefault();
          if (grandTotalRef.current > 0) {
            applyInvoiceDiscount(Math.round(grandTotalRef.current * 0.10 * 2) / 2);
            toast({ title: '💰 تم تطبيق خصم 10%' });
          }
          break;
        case 'F9':
          e.preventDefault();
          checkoutTriggerRef.current?.();
          break;
        case 'F10':
          e.preventDefault();
          if (cart.length > 0) {
            holdInvoice();
            toast({ title: '⏸ تم تعليق الفاتورة', description: 'يمكنك استرجاعها من قائمة الفواتير المعلقة' });
          }
          break;
        case 'F11':
          e.preventDefault();
          toggleTheme();
          break;
        case 'F12':
          e.preventDefault();
          navigate('/help');
          break;
        case '+':
        case '=':
          if (cart.length > 0 && !inInput) {
            e.preventDefault();
            const first = cart[0];
            updateCartItemQty(first.product.id, first.qty + 1);
          }
          break;
        case '-':
        case '_':
          if (cart.length > 0 && !inInput) {
            e.preventDefault();
            const first = cart[0];
            updateCartItemQty(first.product.id, first.qty - 1);
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (cart.length > 0 && !inInput) {
            e.preventDefault();
            const first = cart[0];
            removeFromCart(first.product.id);
            toast({ title: '🗑️ تم حذف المنتج من السلة' });
          }
          break;
        default:
          if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchInputRef.current?.focus();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            checkoutTriggerRef.current?.();
          }
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [cart, holdInvoice, applyInvoiceDiscount, addToCart, updateCartItemQty, removeFromCart, toggleTheme, navigate, toast]);

  // ── Products ────────────────────────────────────────────────
  const allProducts = useMemo(() => getAllInventoryProducts(), [refreshKey]);

  // ── قراءة التصنيفات مباشرة من localStorage — نفس مفاتيح المخازن ──
  const mobileMainCats    = useMemo(() => loadCats('mobiles_main_cats',              ['موبايلات', 'تابلت', 'ساعات ذكية']), [refreshKey]);
  const mobileAccCats     = useMemo(() => loadCats('mobiles_acc_cats',               ['سماعات سلك', 'سماعات بلوتوث', 'شواحن', 'كابلات', 'باور بنك', 'سكرينات', 'جرابات']), [refreshKey]);
  const mobileSpareCats   = useMemo(() => loadCats('mobiles_spare_cats',             ['شاشات موبايل', 'بطاريات', 'إيرفون', 'ميكروفونات', 'مكبرات صوت', 'أخرى']), [refreshKey]);
  const computerMainCats  = useMemo(() => loadCats('computers_cats',                 ['لابتوبات', 'كمبيوتر مكتبي', 'شاشات', 'جيمينج', 'ملحقات عرض']), [refreshKey]);
  const computerAccCats   = useMemo(() => loadCats('computer_accessories_cats_v2',   ['ماوسات', 'كيبوردات', 'هيدسيت', 'ويب كام', 'راوترات', 'أدابتر', 'أخرى']), [refreshKey]);
  const computerSpareCats = useMemo(() => loadCats('computer_spare_parts_cats_v2',   ['رامات', 'هاردات', 'معالجات', 'كروت شاشة', 'مراوح', 'أخرى']), [refreshKey]);
  const deviceMainCats    = useMemo(() => loadCats('devices_cats',                   ['شاشات', 'ريسيفرات', 'راوترات']), [refreshKey]);
  const deviceAccCats     = useMemo(() => loadCats('gx_device_accessories_sa__cats', ['ريموت', 'كابلات HDMI', 'حوامل', 'فلاتر', 'أخرى']), [refreshKey]);
  const deviceSpareCats   = useMemo(() => loadCats('gx_device_spare_parts__cats',    ['بورد تليفزيون', 'الباور', 'شاشات', 'سبيكر', 'LED Strips', 'ريموت', 'أخرى']), [refreshKey]);
  const carMainCats       = useMemo(() => loadCats('cars_cats',                       ['سيدان', 'SUV', 'هاتشباك', 'نقل', 'ميكروباص']), [refreshKey]);
  const carSpareCats      = useMemo(() => loadCats('gx_car_spare_parts__cats',        ['محرك', 'فرامل', 'كهرباء', 'تعليق', 'تكييف', 'عادم', 'ترانسميشن', 'هيكل', 'زجاج', 'أخرى']), [refreshKey]);
  const carOilCats        = useMemo(() => loadCats('gx_car_oils__cats',               ['زيت محرك', 'زيت فتيس', 'زيت دركسيون', 'زيت فرامل', 'مياه راديتر', 'أخرى']), [refreshKey]);

  // Chips per tab — مباشرة من نفس مفاتيح المخازن
  const chips = useMemo<string[]>(() => {
    if (selectedTab === 'mobiles') {
      if (subMode === 'main')        return ['الكل', ...mobileMainCats];
      if (subMode === 'accessories') return ['الكل', ...mobileAccCats];
      /* spare_parts */              return ['الكل', ...mobileSpareCats];
    }
    if (selectedTab === 'computers') {
      if (subMode === 'main')        return ['الكل', ...computerMainCats];
      if (subMode === 'accessories') return ['الكل', ...computerAccCats];
      /* spare_parts */              return ['الكل', ...computerSpareCats];
    }
    if (selectedTab === 'devices') {
      if (subMode === 'main')        return ['الكل', ...deviceMainCats];
      if (subMode === 'accessories') return ['الكل', ...deviceAccCats];
      /* spare_parts */              return ['الكل', ...deviceSpareCats];
    }
    if (selectedTab === 'cars') {
      if (subMode === 'main')        return ['الكل', ...carMainCats];
      if (subMode === 'spare_parts') return ['الكل', ...carSpareCats];
      /* accessories = oils */       return ['الكل', ...carOilCats];
    }
    return [];
  }, [selectedTab, subMode, mobileMainCats, mobileAccCats, mobileSpareCats, computerMainCats, computerAccCats, computerSpareCats, deviceMainCats, deviceAccCats, deviceSpareCats, carMainCats, carSpareCats, carOilCats]);

  // ── Filtered products ────────────────────────────────────────
  const filteredProducts = useMemo<Product[]>(() => {
    if (selectedTab === 'transfers') return [];
    let prods = allProducts;

    if (selectedTab === 'mobiles') {
      if (subMode === 'main') {
        prods = prods.filter(p => p.source === 'mobile');
        if (conditionFilter !== 'all') prods = prods.filter(p => p.condition === conditionFilter);
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p =>
            p.category?.toLowerCase().includes(cl) ||
            p.name.toLowerCase().includes(cl)
          );
        }
      } else if (subMode === 'accessories') {
        prods = prods.filter(p => p.source === 'mobile_acc');
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p => p.category?.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl));
        }
      } else {
        prods = prods.filter(p => p.source === 'mobile_spare');
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p => p.category?.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl));
        }
      }
    } else if (selectedTab === 'computers') {
      if (subMode === 'main') {
        prods = prods.filter(p => p.source === 'computer');
        if (conditionFilter !== 'all') prods = prods.filter(p => p.condition === conditionFilter);
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p => p.category?.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl));
        }
      } else if (subMode === 'accessories') {
        prods = prods.filter(p => p.source === 'computer_acc');
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p => p.category?.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl));
        }
      } else {
        prods = prods.filter(p => p.source === 'computer_spare');
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p => p.category?.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl));
        }
      }
    } else if (selectedTab === 'devices') {
      if (subMode === 'main') {
        prods = prods.filter(p => p.source === 'device');
        if (conditionFilter !== 'all') prods = prods.filter(p => p.condition === conditionFilter);
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p => p.category?.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl));
        }
      } else if (subMode === 'accessories') {
        prods = prods.filter(p => p.source === 'device_acc');
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p => p.category?.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl));
        }
      } else {
        prods = prods.filter(p => p.source === 'device_spare');
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p => p.category?.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl));
        }
      }
    } else if (selectedTab === 'cars') {
      if (subMode === 'main') {
        prods = prods.filter(p => p.source === 'car');
        if (conditionFilter !== 'all') prods = prods.filter(p => p.condition === conditionFilter);
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p => p.category?.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl));
        }
      } else if (subMode === 'spare_parts') {
        prods = prods.filter(p => p.source === 'car_spare');
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p => p.category?.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl));
        }
      } else {
        // accessories = oils
        prods = prods.filter(p => p.source === 'car_oils');
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p => p.category?.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl));
        }
      }
    }

    if (deferredSearchTerm.trim()) prods = searchProducts(prods, deferredSearchTerm, undefined, 40);
    return prods;
  }, [allProducts, selectedTab, subMode, conditionFilter, selectedChip, deferredSearchTerm]);

  // Cart product IDs for highlighting
  const cartProductIds = useMemo(() => new Set(cart.map((i: { product: { id: string } }) => i.product.id)), [cart]);

  // Keep refs in sync
  useEffect(() => { filteredProductsRef.current = filteredProducts; }, [filteredProducts]);
  useEffect(() => { grandTotalRef.current = grandTotal; }, [grandTotal]);
  useEffect(() => { searchTermRef.current = searchTerm; }, [searchTerm]);

  // Count metrics
  const { availableCount, lowStockCount } = useMemo(() => (
    filteredProducts.reduce((summary: { availableCount: number; lowStockCount: number }, product: Product) => {
      if (product.quantity > 0) {
        summary.availableCount += 1;
        if (product.quantity <= 3) summary.lowStockCount += 1;
      }
      return summary;
    }, { availableCount: 0, lowStockCount: 0 })
  ), [filteredProducts]);

  const isTransferTab = selectedTab === 'transfers';

  return (
    <div className="flex h-screen w-full flex-col bg-muted/20 dark:bg-background" dir="rtl">

      {/* ══ Header ══ */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-4 shadow-sm z-10 gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600" aria-hidden="true">
            <Package className="h-4 w-4" />
          </div>
          <h1 className="text-lg font-black">نقطة البيع</h1>
        </div>

        {/* Center: clock + tab buttons */}
        <div className="hidden lg:flex flex-1 items-center justify-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <time dateTime={now.toISOString()}>
              {now.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' })}
              {' | '}
              {now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
            </time>
          </div>

          {/* Tab quick-nav buttons */}
          <div className="flex items-center gap-1">
            {TABS.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                aria-label={`${tab.label} — F${i + 2}`}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  selectedTab === tab.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-card border-border/60 text-muted-foreground hover:bg-muted/60'
                )}
              >
                <tab.icon className="h-3 w-3" aria-hidden="true" />
                {tab.label}
                <kbd className="text-[9px] font-mono opacity-60">F{i + 2}</kbd>
              </button>
            ))}
          </div>

          {/* Quick jump buttons */}
          {[
            { label: 'باركود', icon: Barcode, path: '/barcodes', color: 'text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 border-violet-200 dark:border-violet-500/20' },
            { label: 'شراء', icon: Download, path: '/mobiles', color: 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' },
            { label: 'تحويل', icon: Send, path: undefined, tab: 'transfers' as TabId, color: 'text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-500/10 border-teal-200 dark:border-teal-500/20' },
          ].map(b => (
            <button
              key={b.label}
              onClick={() => b.path ? navigate(b.path) : b.tab && setSelectedTab(b.tab)}
              aria-label={b.label}
              className={cn('flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', b.color)}
            >
              <b.icon className="h-3 w-3" aria-hidden="true" />
              {b.label}
            </button>
          ))}
        </div>

        {/* Right: theme toggle + back */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الفاتح'}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all"
          >
            {theme === 'light' ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Sun className="h-4 w-4 text-amber-500" aria-hidden="true" />}
          </button>
          <button
            onClick={() => navigate('/')}
            aria-label="الرجوع للصفحة الرئيسية"
            className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted/80 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            رجوع <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* ══ Body ══ */}
      <main className="flex flex-1 gap-3 overflow-hidden p-3">

        {/* ── Left Panel: Products ── */}
        <div
          className="flex flex-1 flex-col overflow-hidden bg-card rounded-2xl border border-border/50 shadow-sm p-3"
          role="region"
          aria-label="منطقة المنتجات"
          id={`tabpanel-${selectedTab}`}
          aria-labelledby={`tab-${selectedTab}`}
        >
          {/* Category nav */}
          <CategoryNavPanel
            selectedTab={selectedTab}
            onTabChange={setSelectedTab}
            subMode={subMode}
            onSubModeChange={setSubMode}
            conditionFilter={conditionFilter}
            onConditionChange={setConditionFilter}
            chips={chips}
            selectedChip={selectedChip}
            onChipChange={setSelectedChip}
            productCount={allProducts.length}
            filteredCount={filteredProducts.length}
          />

          {/* Customer selector */}
          {!isTransferTab && (
            <div className="mb-2">
              <CustomerSelector selected={selectedCustomer} onChange={setSelectedCustomer} />
            </div>
          )}

          {/* Search bar */}
          {!isTransferTab && (
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-500" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const barcodeMatch = allProducts.find(p =>
                        p.barcode?.toLowerCase() === searchTerm.toLowerCase()
                      );
                      if (barcodeMatch && barcodeMatch.quantity > 0) {
                        addToCart(barcodeMatch);
                        toast({ title: '✅ تمت الإضافة via باركود', description: barcodeMatch.name });
                        setSearchTerm('');
                        return;
                      }
                      const firstAvail = filteredProducts.find(p => p.quantity > 0);
                      if (firstAvail) {
                        addToCart(firstAvail);
                        toast({ title: `✅ تمت الإضافة`, description: firstAvail.name });
                      }
                    }
                  }}
                  className="w-full h-10 bg-muted/30 border border-border/60 rounded-xl pr-9 pl-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white dark:focus:bg-card transition-all"
                  placeholder="ابحث أو امسح باركود... (F1)"
                  aria-label="بحث عن منتج — F1 للتركيز — Enter للإضافة"
                  autoComplete="off"
                />
                <kbd className="absolute left-14 top-1/2 -translate-y-1/2 hidden md:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <span className="text-xs">F1</span>
                </kbd>
              </div>

              {/* Quick discount buttons */}
              <div className="hidden md:flex items-center gap-1">
                {QUICK_DISCOUNTS.map(disc => (
                  <button
                    key={disc.key || disc.label}
                    onClick={() => {
                      if (grandTotal > 0) {
                        applyInvoiceDiscount(Math.round(grandTotal * disc.value / 100 * 2) / 2);
                        toast({ title: `💰 تم تطبيق خصم ${disc.label}` });
                      }
                    }}
                    disabled={grandTotal <= 0}
                    aria-label={`تطبيق خصم ${disc.label}`}
                    className="rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {disc.label}
                    {disc.key && <kbd className="mr-1 text-[9px] font-mono opacity-60">{disc.key}</kbd>}
                  </button>
                ))}
              </div>

              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  aria-label="مسح البحث"
                  className="rounded-xl border border-border/60 bg-card px-3 text-xs font-bold text-muted-foreground hover:bg-muted transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  مسح
                </button>
              )}
            </div>
          )}

          {/* Product grid or transfer tab */}
          <div className="flex-1 overflow-y-auto pr-0.5">
            {isTransferTab ? (
              <TransferTab />
            ) : (
              <POSProductGrid
                products={filteredProducts}
                onAdd={addToCart}
                cartProductIds={cartProductIds}
                selectedTab={selectedTab}
                subMode={subMode}
              />
            )}
          </div>

          {/* Stats bar */}
          {!isTransferTab && (
            <div className="flex items-center gap-4 border-t border-border/40 pt-2 mt-2 text-xs font-bold text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                <span>متاح: <strong className="text-foreground">{availableCount}</strong></span>
              </span>
              {lowStockCount > 0 && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  <span>منخفض: <strong>{lowStockCount}</strong></span>
                </span>
              )}
              <span className="flex items-center gap-1 mr-auto">
                <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
                سلة: <strong className="text-foreground">{cart.length}</strong>
              </span>
              {grandTotal > 0 && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black tabular-nums">
                  الإجمالي: {grandTotal.toLocaleString('ar-EG')} ج.م
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Right Panel: Cart / Payment ── */}
        <CheckoutSidebar
          cart={cart}
          onUpdateQty={updateQtyByDelta}
          onRemove={removeFromCart}
          onLineDiscount={updateLineDiscount}
          onClearCart={clearCart}
          onHoldInvoice={holdInvoice}
          onShowHeld={() => setShowHeld(true)}
          invoiceDiscount={invoiceDiscount}
          maxInvoiceDiscount={maxInvoiceDiscount}
          onInvoiceDiscount={applyInvoiceDiscount}
          subtotal={subtotal}
          lineDiscountsTotal={lineDiscountsTotal}
          grandTotal={grandTotal}
          heldInvoices={heldInvoices}
          onCheckoutReady={handleCheckoutReady}
          selectedCustomer={selectedCustomer}
        />
      </main>

      {/* Held Invoices Modal */}
      {showHeld && (
        <HeldInvoicesPanel
          heldInvoices={heldInvoices}
          onRestore={(id) => { restoreInvoice(id); setShowHeld(false); }}
          onRemove={removeHeldInvoice}
          onClose={() => setShowHeld(false)}
        />
      )}
    </div>
  );
}
