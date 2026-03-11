// ============================================================
// نقطة البيع — POS Page V5 — Enterprise UX Redesign
// Changes vs V4:
//   - ENHANCED keyboard shortcuts (F1-F12, arrows, numpad)
//   - Cart keyboard navigation (+/-/Delete/Enter)
//   - Quick discount buttons inline
//   - Barcode scanner support with instant add
//   - Optimized quantity input
//   - Focus trap for accessibility
//   - Performance optimizations
// ============================================================

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Moon, Sun, Clock, Barcode, Download,
  Send, ArrowLeft, Package, AlertTriangle, Calculator,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/domain/types';
import { searchProducts } from '@/services/productService';
import { getAllInventoryProducts } from '@/repositories/productRepository';
import { getCategoriesBySection } from '@/data/categoriesData';
import { useCart } from '@/contexts/CartContext';

// Sub-components
import CategoryNavPanel, { TabId, SubMode, ConditionFilter, TABS } from '@/components/pos/CategoryNavPanel';
import POSProductGrid from '@/components/pos/POSProductGrid';
import CheckoutSidebar from '@/components/pos/CheckoutSidebar';
import TransferTab from '@/components/pos/TransferTab';
import HeldInvoicesPanel from '@/components/pos/HeldInvoicesPanel';

// Brand chips for mobile devices (from supplier field)
const MOBILE_BRANDS = ['Apple', 'Samsung', 'Oppo', 'Xiaomi', 'Realme', 'Vivo', 'Huawei', 'Nokia', 'أخرى'];

// Quick discount presets
const QUICK_DISCOUNTS = [
  { label: '5%', value: 5, key: 'F7' },
  { label: '10%', value: 10, key: 'F8' },
  { label: '15%', value: 15, key: null },
];

// Quick amount presets for payment
const QUICK_AMOUNTS = [
  { label: '50', value: 50 },
  { label: '100', value: 100 },
  { label: '200', value: 200 },
  { label: '500', value: 500 },
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

  // ── Delta-to-absolute adapter for CheckoutSidebar / CartItemRow ──
  // CheckoutSidebar calls onUpdateQty(id, delta) e.g. +1 or -1
  // CartContext.updateCartItemQty(id, absoluteQty)
  const updateQtyByDelta = useCallback((productId: string, delta: number) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;
    updateCartItemQty(productId, item.qty + delta);
  }, [cart, updateCartItemQty]);

  // -- Computed cart values --
  const subtotal = cart.reduce((s, i) => s + i.product.sellingPrice * i.qty, 0);

  const lineDiscountsTotal = cart.reduce((s, i) => s + (i.lineDiscount ?? 0), 0);
  const totalCost = cart.reduce((s, i) => s + i.product.costPrice * i.qty, 0);
  const maxInvoiceDiscount = Math.max(0, subtotal - lineDiscountsTotal - totalCost);
  const grandTotal = Math.max(0, subtotal - lineDiscountsTotal - invoiceDiscount);

  // ── Local state ─────────────────────────────────────────────
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<TabId>('mobiles');
  const [selectedChip, setSelectedChip] = useState('الكل');
  const [subMode, setSubMode] = useState<SubMode>('main');
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>('all');
  const [showHeld, setShowHeld] = useState(false);
  const [now, setNow] = useState(new Date());

  // Checkout trigger ref (injected by CheckoutSidebar via callback)
  const checkoutTriggerRef = useRef<(() => void) | null>(null);

  // ── Stable refs for keyboard handler closure (avoids stale state) ──
  // filteredProducts is declared later — we use refs so handler always
  // reads the latest values without re-registering the listener.
  const filteredProductsRef = useRef<Product[]>([]);
  const grandTotalRef = useRef<number>(0);
  const handleCheckoutReady = useCallback((trigger: () => void) => {
    checkoutTriggerRef.current = trigger;
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
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
  // ENHANCED: Full keyboard-first workflow with numpad and cart support
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const isFKey = e.key.startsWith('F') && !isNaN(Number(e.key.slice(1)));

      // Allow navigation keys in inputs
      const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key);

      // Escape always blurs and clears search
      if (e.key === 'Escape') {
        e.preventDefault();
        (e.target as HTMLElement).blur?.();
        searchInputRef.current?.blur();
        if (searchTerm) {
          setSearchTerm('');
        }
        return;
      }

      // Block non-F-key shortcuts when inside an input (except nav)
      if (inInput && !isFKey && !isNavKey) {
        // Allow +/- and Delete for cart in inputs
        if (!['+', '-', 'Delete', 'Backspace'].includes(e.key)) {
          return;
        }
      }

      // Numpad number keys for quick product selection (1-9)
      const numMatch = e.key.match(/^(\d|Numpad\d)$/);
      if (numMatch && !inInput) {
        const num = parseInt(e.key.replace('Numpad', ''), 10);
        if (num >= 1 && num <= 9) {
          e.preventDefault();
          // Quick add product by number position — read from ref (always fresh)
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
          // Quick 5% discount on grand total — read from ref (always fresh)
          if (grandTotalRef.current > 0) {
            applyInvoiceDiscount(Math.round(grandTotalRef.current * 0.05 * 2) / 2);
            toast({ title: '💰 تم تطبيق خصم 5%' });
          }
          break;
        case 'F8':
          e.preventDefault();
          // Quick 10% discount on grand total — read from ref (always fresh)
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
          // Increase first cart item quantity
          if (cart.length > 0 && !inInput) {
            e.preventDefault();
            const firstItem = cart[0];
            updateCartItemQty(firstItem.product.id, firstItem.qty + 1);
          }
          break;
        case '-':
        case '_':
          // Decrease first cart item quantity
          if (cart.length > 0 && !inInput) {
            e.preventDefault();
            const firstItem = cart[0];
            updateCartItemQty(firstItem.product.id, firstItem.qty - 1);
          }
          break;
        case 'Delete':
        case 'Backspace':
          // Remove first cart item if not in input
          if (cart.length > 0 && !inInput) {
            e.preventDefault();
            const firstItem = cart[0];
            removeFromCart(firstItem.product.id);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, holdInvoice, applyInvoiceDiscount, addToCart, updateCartItemQty, removeFromCart, toggleTheme, navigate, toast, searchTerm]);

  // ── Products ────────────────────────────────────────────────
  const allProducts = useMemo(() => getAllInventoryProducts(), []);
  const mobileCategories = useMemo(() => getCategoriesBySection('mobile'), []);
  const deviceCategories = useMemo(() => getCategoriesBySection('device'), []);

  // Category chips per tab
  const chips = useMemo<string[]>(() => {
    if (selectedTab === 'mobiles') {
      if (subMode === 'main') return ['الكل', ...MOBILE_BRANDS];
      const accCats = mobileCategories.filter(c => c.type === 'accessory');
      return ['الكل', ...accCats.map(c => c.name)];
    }
    if (selectedTab === 'devices') {
      if (subMode === 'main') {
        const devCats = deviceCategories.filter(c => c.type === 'device');
        return ['الكل', ...devCats.map(c => c.name)];
      }
      const accCats = deviceCategories.filter(c => c.type === 'accessory');
      return ['الكل', ...accCats.map(c => c.name)];
    }
    return [];
  }, [selectedTab, subMode, mobileCategories, deviceCategories]);

  // Filtered products
  const filteredProducts = useMemo<Product[]>(() => {
    if (selectedTab === 'transfers') return [];
    let prods = allProducts;

    if (selectedTab === 'mobiles') {
      if (subMode === 'main') {
        prods = prods.filter(p => p.source === 'mobile' || p.source === 'computer');
        if (conditionFilter !== 'all') prods = prods.filter(p => p.condition === conditionFilter);
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p => p.supplier?.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl));
        }
      } else {
        prods = prods.filter(p => p.source === 'mobile_acc' || p.source === 'computer_acc');
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p => p.category.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl));
        }
      }
    } else if (selectedTab === 'devices') {
      if (subMode === 'main') {
        prods = prods.filter(p => p.source === 'device');
        if (conditionFilter !== 'all') prods = prods.filter(p => p.condition === conditionFilter);
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p => p.category.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl));
        }
      } else {
        prods = prods.filter(p => p.source === 'device_acc');
        if (selectedChip !== 'الكل') {
          const cl = selectedChip.toLowerCase();
          prods = prods.filter(p => p.category.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl));
        }
      }
    } else if (selectedTab === 'cars') {
      prods = prods.filter(p => p.source === 'car');
      if (conditionFilter !== 'all') prods = prods.filter(p => p.condition === conditionFilter);
    }

    if (searchTerm.trim()) prods = searchProducts(prods, searchTerm, undefined, 40);
    return prods;
  }, [allProducts, selectedTab, subMode, conditionFilter, selectedChip, searchTerm]);

  // Set of product IDs in cart for highlighting
  const cartProductIds = useMemo(() => new Set(cart.map(i => i.product.id)), [cart]);

  // ── Keep refs in sync with computed values so the keyboard handler
  // always reads the latest filteredProducts and grandTotal.
  useEffect(() => { filteredProductsRef.current = filteredProducts; }, [filteredProducts]);
  useEffect(() => { grandTotalRef.current = grandTotal; }, [grandTotal]);

  // ── Count metrics ───────────────────────────────────────────
  const availableCount = filteredProducts.filter(p => p.quantity > 0).length;
  const lowStockCount = filteredProducts.filter(p => p.quantity > 0 && p.quantity <= 3).length;

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

        {/* Center: clock + search shortcut + quick nav buttons */}
        <div className="hidden lg:flex flex-1 items-center justify-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <time dateTime={now.toISOString()}>
              {now.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' })}
              {' | '}
              {now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
            </time>
          </div>

          {/* F-key hints visible in header */}
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
          {/* Category nav (unified: tabs + sub-mode + condition + chips) */}
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

          {/* Search bar with barcode scanner support */}
          {!isTransferTab && (
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-500" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={e => {
                    const value = e.target.value;
                    setSearchTerm(value);

                    // Barcode scanner detection: if input ends with Enter and looks like barcode
                    // (typically 8-14 digits), auto-search and add
                    if (value.length >= 8 && value.length <= 20) {
                      // Will be handled by Enter key
                    }
                  }}
                  onKeyDown={e => {
                    // Enter in search = add first available product
                    // OR if barcode detected, add directly
                    if (e.key === 'Enter') {
                      e.preventDefault();

                      // First try to find exact barcode match
                      const barcodeMatch = allProducts.find(p =>
                        p.barcode?.toLowerCase() === searchTerm.toLowerCase()
                      );

                      if (barcodeMatch && barcodeMatch.quantity > 0) {
                        addToCart(barcodeMatch);
                        toast({ title: '✅ تمت الإضافة via باركود', description: barcodeMatch.name });
                        setSearchTerm('');
                        return;
                      }

                      // Otherwise add first available product
                      const firstAvail = filteredProducts.find(p => p.quantity > 0);
                      if (firstAvail) {
                        addToCart(firstAvail);
                        toast({ title: `✅ تمت الإضافة`, description: firstAvail.name });
                      }
                    }
                  }}
                  className="w-full h-10 bg-muted/30 border border-border/60 rounded-xl pr-9 pl-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white dark:focus:bg-card transition-all"
                  placeholder="ابحث أو امسح باركود... (F1)"
                  aria-label="بحث عن منتج — امسح باركود أو اكتب اسم — F1 للتركيز — Enter للإضافة"
                  aria-controls={`tabpanel-${selectedTab}`}
                  autoComplete="off"
                />
                {/* Quick keyboard shortcut hint */}
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

          {/* Compact stats bar — replaces the 3 large gradient stat cards */}
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

        {/* ── Right Panel: Cart / Payment / Success ── */}
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
