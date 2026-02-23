import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, ArrowLeftRight, Printer, ShoppingCart, Sparkles, Package, Tag, Percent, Keyboard, Scan } from 'lucide-react';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { CartItem, PaymentMethod } from '@/domain/types';
import { validateStock } from '@/domain/stock';
import { StockError } from '@/domain/stock';
import { getCartTotals, processSale } from '@/services/saleService';
import { searchProducts, lookupBarcode } from '@/services/productService';
import { getAllProducts } from '@/repositories/productRepository';
import { saveSale } from '@/repositories/saleRepository';
import { saveMovements } from '@/repositories/stockRepository';
import { saveAuditEntries } from '@/repositories/auditRepository';
import { updateProductQuantity } from '@/repositories/productRepository';
import { printInvoice } from '@/services/invoicePrinter';
import { useAuth } from '@/contexts/AuthContext';

// ── Sub-components ──────────────────────────────────────────

const CartItemRow = ({ item, onUpdateQty, onRemove }: {
  item: CartItem;
  onUpdateQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}) => (
  <div className="group rounded-xl bg-gradient-to-l from-muted/40 to-transparent border border-border/30 p-3 transition-all duration-300 hover:from-muted/60">
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-card-foreground truncate">{item.product.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{item.product.sellingPrice.toLocaleString('ar-EG')} EGP</p>
      </div>
      <button
        onClick={() => onRemove(item.product.id)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
    <div className="mt-3 flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onUpdateQty(item.product.id, -1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-card-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-10 text-center text-base font-bold text-card-foreground">{item.qty}</span>
        <button
          onClick={() => onUpdateQty(item.product.id, 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-card-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="text-end">
        <span className="text-base font-bold text-primary">{(item.product.sellingPrice * item.qty).toLocaleString('ar-EG')} EGP</span>
      </div>
    </div>
  </div>
);

// ── Main POS Component ──────────────────────────────────────

const POS = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cash');
  const searchRef = useRef<HTMLInputElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerTimer = useRef<ReturnType<typeof setTimeout>>();

  // Flash scanner indicator on scan
  const flashScanner = useCallback(() => {
    setScannerActive(true);
    clearTimeout(scannerTimer.current);
    scannerTimer.current = setTimeout(() => setScannerActive(false), 1200);
  }, []);

  const allProducts = useMemo(() => getAllProducts(), [refreshKey]);

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
    if (cart.length === 0) return;

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
        title: 'Sale completed!',
        description: `${result.sale.invoiceNumber} — ${result.sale.total.toFixed(2)} EGP | الربح: ${result.sale.grossProfit.toFixed(2)} EGP`,
      });

      setCart([]);
      setInvoiceDiscount(0);
      setRefreshKey(k => k + 1);
      searchRef.current?.focus();
    } catch (err: any) {
      toast({ title: 'Sale failed', description: err.message, variant: 'destructive' });
    }
  }, [cart, invoiceDiscount, selectedPayment, toast, user]);

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
                  <p className="text-base font-bold text-primary">{p.sellingPrice.toLocaleString('ar-EG')} EGP</p>
                  <p className="text-xs text-muted-foreground">{p.quantity} متوفر</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Product grid */}
        <div className="grid flex-1 grid-cols-2 gap-4 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4 content-start pr-1 pb-4">
          {allProducts.map((p, i) => {
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
                <div className="flex w-full items-end justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">سعر البيع</p>
                    <p className="text-lg font-extrabold text-primary leading-none">
                      {p.sellingPrice.toLocaleString('ar-EG')}
                      <span className="text-[10px] font-medium text-muted-foreground ms-1">EGP</span>
                    </p>
                  </div>
                  <span className={cn(
                    'rounded-lg px-2.5 py-1 text-[10px] font-bold',
                    isOut ? 'bg-destructive/10 text-destructive' :
                      isLow ? 'bg-warning/10 text-warning' :
                        'bg-chart-3/10 text-chart-3'
                  )}>
                    {isOut ? 'نفذ' : `${p.quantity} قطعة`}
                  </span>
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
        <div className="border-b border-border/30 px-5 py-4 bg-gradient-to-l from-primary/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <ShoppingCart className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-card-foreground">{t('pos.cart')}</h2>
                <p className="text-xs text-muted-foreground">{cart.length} {cart.length === 1 ? 'منتج' : 'منتجات'}</p>
              </div>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded-lg px-3 py-1.5 transition-all duration-200"
              >
                {t('pos.clearCart')}
              </button>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30 mb-4">
                <ShoppingCart className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">{t('pos.noItems')}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">اضغط على المنتجات لإضافتها</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item, i) => (
                <div key={item.product.id} className="animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                  <CartItemRow item={item} onUpdateQty={updateQty} onRemove={removeFromCart} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals & Payment */}
        <div className="border-t border-border/30 bg-gradient-to-t from-muted/20 to-transparent px-5 py-5 space-y-4">
          {/* Subtotal & Discount */}
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('pos.subtotal')}</span>
              <span className="font-medium text-card-foreground">{totals.subtotal.toLocaleString('ar-EG')} EGP</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Percent className="h-4 w-4" />
                <span>{t('pos.discount')}</span>
              </div>
              <input
                type="number"
                value={invoiceDiscount || ''}
                onChange={(e) => setInvoiceDiscount(Number(e.target.value))}
                className="w-24 rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-end text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                min={0}
                placeholder="0"
              />
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-end border-t border-border/30 pt-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t('pos.total')}</p>
              <p className="text-2xl font-extrabold text-card-foreground">{totals.total.toLocaleString('ar-EG')} EGP</p>
            </div>
            <div className="text-end">
              <p className="text-xs text-muted-foreground">{t('pos.profit')}</p>
              <p className="text-base font-bold text-chart-3">{totals.grossProfit.toLocaleString('ar-EG')} EGP</p>
              <p className="text-[10px] text-muted-foreground">هامش {totals.marginPct}%</p>
            </div>
          </div>

          {/* Payment method */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'cash' as const, icon: Banknote, label: t('pos.cash'), color: 'from-emerald-500/20 to-teal-500/20', iconColor: 'text-emerald-500' },
              { key: 'card' as const, icon: CreditCard, label: t('pos.card'), color: 'from-blue-500/20 to-indigo-500/20', iconColor: 'text-blue-500' },
              { key: 'split' as const, icon: ArrowLeftRight, label: t('pos.split'), color: 'from-violet-500/20 to-purple-500/20', iconColor: 'text-violet-500' },
            ]).map(pm => (
              <button
                key={pm.key}
                onClick={() => setSelectedPayment(pm.key)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 text-xs font-medium transition-all duration-300',
                  selectedPayment === pm.key
                    ? `bg-gradient-to-br ${pm.color} border-2 border-primary/30 shadow-lg`
                    : 'bg-muted/30 border-2 border-transparent text-muted-foreground hover:bg-muted/50'
                )}
              >
                <pm.icon className={cn('h-5 w-5', selectedPayment === pm.key ? pm.iconColor : '')} />
                {pm.label}
              </button>
            ))}
          </div>

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-l from-primary to-secondary py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 disabled:shadow-none transition-all duration-300"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <Printer className="h-5 w-5" />
              {t('pos.checkout')} — {totals.total.toLocaleString('ar-EG')} EGP
              <span className="rounded-lg bg-white/20 px-2 py-0.5 text-[10px] font-mono">F9</span>
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default POS;
