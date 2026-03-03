// ============================================================
// نقطة البيع — POS Page V3 — with Wallet-linked Transfers
// ============================================================

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Plus, Minus, Trash2, CreditCard,
  ShoppingCart, Lock, RotateCcw, Calculator, ArrowLeft, Moon, Sun,
  Clock, Barcode, Download, Smartphone, Headphones, Car, Send,
  PauseCircle, FileText, HelpCircle, Receipt, Percent, X,
  CheckCircle, Wallet, ChevronRight, TrendingDown
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { CartItem, Product } from '@/domain/types';
import { processSale } from '@/services/saleService';
import { searchProducts } from '@/services/productService';
import { getAllInventoryProducts } from '@/repositories/productRepository';
import { saveSale } from '@/repositories/saleRepository';
import { saveMovements } from '@/repositories/stockRepository';
import { saveAuditEntries } from '@/repositories/auditRepository';
import { updateProductQuantity } from '@/repositories/productRepository';
import { printInvoice } from '@/services/invoicePrinter';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import {
  getWallets, deposit,
  type Wallet as WalletType, getTransactions,
} from '@/data/walletsData';

// ── Constants ─────────────────────────────────────────────────
const TABS = [
  { id: 'mobiles', label: 'الأجهزة', icon: Smartphone },
  { id: 'accessories', label: 'الإكسسوارات', icon: Headphones },
  { id: 'cars', label: 'عربيات', icon: Car },
  { id: 'transfers', label: 'تحويلات', icon: Send },
] as const;

type TabId = typeof TABS[number]['id'];

// Brand chips — only relevant for mobiles
const MOBILE_BRANDS = ['الكل', 'Apple', 'Samsung', 'Oppo', 'Xiaomi', 'Realme', 'Vivo', 'Huawei', 'Nokia', 'أخرى'];

// Accessory categories
const ACC_CATS = ['الكل', 'سماعات', 'شواحن', 'كفرات', 'كابلات', 'لاسلكي', 'أخرى'];

// Car categories
const CAR_CATS = ['الكل', 'إكسسوار', 'قطع غيار', 'صوتيات', 'شاشات', 'أخرى'];

// Transfer types with emoji icons
const TRANSFER_TYPES = [
  { label: 'فودافون كاش', icon: '📱' },
  { label: 'اتصالات كاش', icon: '🟠' },
  { label: 'اورنج كاش', icon: '🟠' },
  { label: 'ويي', icon: '🔵' },
  { label: 'انستاباي', icon: '💜' },
  { label: 'تحويل بنكي', icon: '🏦' },
];

const TRANSFER_KEY = 'elos_pos_transfers';

// ── Cart Item Row ─────────────────────────────────────────────
const CartItemRow = ({
  item, onUpdateQty, onRemove, onLineDiscount,
}: {
  item: CartItem;
  onUpdateQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onLineDiscount: (id: string, discount: number) => void;
}) => {
  const [showDisc, setShowDisc] = useState(false);
  const maxDiscount = Math.max(0, (item.product.sellingPrice - item.product.costPrice) * item.qty);
  const lineDiscount = item.lineDiscount ?? 0;
  const lineTotal = item.product.sellingPrice * item.qty - lineDiscount;

  return (
    <div className="group rounded-xl bg-white dark:bg-card border border-border/50 p-3 mb-2 shadow-sm transition-all hover:border-primary/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{item.product.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-semibold text-emerald-600">{item.product.sellingPrice.toLocaleString('ar-EG')} ج.م</span>
            {lineDiscount > 0 && <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-1.5 rounded">-{lineDiscount} خصم</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowDisc(s => !s)} title="خصم على الصنف"
            className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-all', showDisc || lineDiscount > 0 ? 'bg-amber-100 text-amber-600' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50 opacity-0 group-hover:opacity-100')}>
            <Percent className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onRemove(item.product.id)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showDisc && (
        <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100">
          <p className="text-[10px] text-amber-700 font-bold mb-1.5">خصم الصنف (حتى {maxDiscount.toFixed(0)} ج.م بحد أقصى)</p>
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={maxDiscount} step={0.5} value={lineDiscount || ''} onChange={e => onLineDiscount(item.product.id, Math.min(Number(e.target.value), maxDiscount))}
              placeholder="0" className="flex-1 rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs text-center font-bold focus:outline-none focus:ring-1 focus:ring-amber-400" />
            <span className="text-[10px] text-amber-600 font-bold">ج.م</span>
            {lineDiscount > 0 && <button onClick={() => onLineDiscount(item.product.id, 0)} className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => onUpdateQty(item.product.id, -1)} className="flex h-7 w-7 items-center justify-center rounded border bg-gray-50 dark:bg-muted text-gray-600 hover:bg-gray-100 shadow-sm"><Minus className="h-3 w-3" /></button>
          <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
          <button onClick={() => onUpdateQty(item.product.id, 1)} className="flex h-7 w-7 items-center justify-center rounded border bg-blue-50 text-blue-600 hover:bg-blue-100 shadow-sm"><Plus className="h-3 w-3" /></button>
        </div>
        <span className={cn('text-sm font-black', lineDiscount > 0 ? 'text-amber-600' : 'text-emerald-600')}>
          {lineTotal.toLocaleString('ar-EG')} ج.م
        </span>
      </div>
    </div>
  );
};

// ── Transfer Tab — linked to Wallet system ───────────────────
interface PosTransfer {
  id: string;
  customer: string;
  phone: string;
  type: string;
  amount: number;
  commission: number;
  walletId: string;
  walletName: string;
  date: string;
}

const TransferTab = () => {
  const { toast } = useToast();
  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [todayTransfers, setTodayTransfers] = useState<PosTransfer[]>([]);
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState(TRANSFER_TYPES[0].label);
  const [amount, setAmount] = useState('');
  const [commission, setCommission] = useState('');
  const [walletId, setWalletId] = useState('');

  // Load wallets + today's transfers
  useEffect(() => {
    const ws = getWallets();
    setWallets(ws);
    if (ws.length > 0) setWalletId(ws[0].id);

    const all = getStorageItem<PosTransfer[]>(TRANSFER_KEY, []);
    const today = new Date().toDateString();
    setTodayTransfers(all.filter(t => new Date(t.date).toDateString() === today));
  }, []);

  const totalCommission = todayTransfers.reduce((s, t) => s + t.commission, 0);
  const totalAmount = todayTransfers.reduce((s, t) => s + t.amount, 0);
  const selectedWallet = wallets.find(w => w.id === walletId);

  const handleRegister = () => {
    const amt = Number(amount);
    const com = Number(commission);
    if (amt <= 0) { toast({ title: '⚠️ أدخل مبلغ التحويل', variant: 'destructive' }); return; }
    if (!walletId) { toast({ title: '⚠️ اختر المحفظة', variant: 'destructive' }); return; }

    // Deposit commission to the wallet
    if (com > 0) {
      deposit(walletId, com, `عمولة تحويل ${type} — ${customer || 'عميل'}`);
    }

    // Save transfer record
    const newTransfer: PosTransfer = {
      id: Date.now().toString(),
      customer, phone, type, amount: amt, commission: com,
      walletId,
      walletName: selectedWallet?.name ?? '',
      date: new Date().toISOString(),
    };
    const allSaved = getStorageItem<PosTransfer[]>(TRANSFER_KEY, []);
    setStorageItem(TRANSFER_KEY, [...allSaved, newTransfer]);
    setTodayTransfers(prev => [...prev, newTransfer]);

    // Reset form
    setCustomer(''); setPhone(''); setAmount(''); setCommission('');

    // Reload wallets to show updated balance
    setWallets(getWallets());

    toast({
      title: '✅ تم تسجيل التحويل',
      description: `${type} — ${amt.toLocaleString('ar-EG')} ج.م${com > 0 ? ` + ${com} ج.م عمولة في ${selectedWallet?.name}` : ''}`,
    });
  };

  // Action mode tabs
  type ActionMode = 'withdraw' | 'deposit' | 'deferred';
  const [actionMode, setActionMode] = useState<ActionMode>('withdraw');

  const ACTION_TABS: { id: ActionMode; label: string; activeClass: string }[] = [
    { id: 'withdraw', label: 'سحب', activeClass: 'bg-emerald-500 text-white' },
    { id: 'deposit', label: 'إيداع', activeClass: 'bg-blue-500 text-white' },
    { id: 'deferred', label: 'تحويل أجل (عميل مسجل)', activeClass: 'bg-gray-700 text-white' },
  ];

  return (
    <div className="space-y-4 max-w-xl mx-auto pt-1">

      {/* Action Tabs */}
      <div className="flex rounded-2xl overflow-hidden border border-border/60 bg-white dark:bg-card shadow-sm">
        {ACTION_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActionMode(tab.id)}
            className={cn('flex-1 py-3 text-sm font-bold transition-all',
              actionMode === tab.id ? tab.activeClass : 'text-muted-foreground hover:bg-muted/50'
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Deferred mode: redirect banner to installments */}
      {actionMode === 'deferred' && (
        <Link to="/installments?type=transfer"
          className="flex items-center justify-between rounded-2xl border-2 border-gray-500 bg-gray-50 dark:bg-gray-900/30 px-5 py-4 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-gray-600" />
            <div>
              <p className="text-sm font-bold">إنشاء عقد أجل للعميل</p>
              <p className="text-xs opacity-70">سيتم نقلك لصفحة التقسيط لتسجيل تحويل بالأجل</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 opacity-60" />
        </Link>
      )}

      {/* Info banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-sm font-bold text-amber-700 dark:text-amber-400">
        💡 سجّل هنا على محفظتك وهتلاقي الفلوس كلها من الدرج
      </div>

      {/* Customer info */}
      <div className="rounded-2xl border border-border/60 bg-white dark:bg-card overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-muted/20 border-b border-border/50">
          <span className="text-sm font-bold text-muted-foreground">👤 بيانات العميل (اختياري)</span>
        </div>
        <div className="p-4 space-y-3">
          <input value={customer} onChange={e => setCustomer(e.target.value)}
            placeholder="اكتب اسم العميل أو رقم الواتساب..."
            className="w-full h-11 rounded-xl border border-border/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          <input value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="رقم الهاتف..."
            className="w-full h-11 rounded-xl border border-border/60 bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        </div>
      </div>

      {/* Transfer type dropdown */}
      <div className="rounded-2xl border border-border/60 bg-white dark:bg-card p-4">
        <label className="flex items-center gap-2 text-sm font-bold text-muted-foreground mb-2">🔄 نوع التحويل</label>
        <select value={type} onChange={e => setType(e.target.value)}
          className="w-full h-11 rounded-xl border border-border/60 bg-background px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          {TRANSFER_TYPES.map(t => <option key={t.label} value={t.label}>{t.icon} {t.label}</option>)}
        </select>
      </div>

      {/* Wallet selector */}
      {wallets.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {wallets.map(w => (
            <button key={w.id} onClick={() => setWalletId(w.id)}
              className={cn(
                'flex-shrink-0 rounded-2xl px-4 py-3 text-sm font-bold transition-all border-2',
                walletId === w.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-md'
                  : 'border-border bg-white dark:bg-card text-gray-600 dark:text-gray-300 hover:border-blue-300'
              )}
            >
              <div className="text-lg leading-none mb-1">{w.icon}</div>
              <div className="text-xs font-bold whitespace-nowrap">{w.name}</div>
              <div className="text-[11px] text-emerald-600 font-black mt-0.5">{w.balance.toLocaleString('ar-EG')} ج.م</div>
            </button>
          ))}
          <Link to="/wallets"
            className="flex-shrink-0 rounded-2xl border-2 border-dashed border-border px-4 py-3 text-xs font-bold text-gray-400 hover:text-blue-500 hover:border-blue-300 flex flex-col items-center justify-center gap-1 transition-colors"
          >
            <Wallet className="h-5 w-5" />
            إدارة
          </Link>
        </div>
      )}

      {/* Amounts */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-foreground mb-1.5 text-end">مبلغ التحويل:</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" min={0}
            className="w-full h-14 rounded-xl border border-border/60 bg-background px-3 text-center text-2xl font-black focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        </div>
        <div>
          <label className="block text-sm font-bold text-amber-600 mb-1.5 text-end">⭐ العمولة (الربح):</label>
          <input type="number" value={commission} onChange={e => setCommission(e.target.value)} placeholder="0" min={0}
            className="w-full h-14 rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/10 px-3 text-center text-2xl font-black text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
      </div>

      {/* Wallet confirm hint */}
      {selectedWallet && Number(commission) > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-sm font-bold text-emerald-700">{commission} ج.م ستُضاف إلى {selectedWallet.icon} {selectedWallet.name}</p>
        </div>
      )}

      {/* Register button */}
      <button onClick={handleRegister}
        className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 py-4 text-base font-bold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-md">
        <CheckCircle className="h-5 w-5" /> تسجيل التحويل
      </button>

      {/* Shift summary */}
      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-white dark:bg-card px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <Send className="h-4 w-4" /> تحويلات الشفت
          <span className="flex h-5 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-black">{todayTransfers.length}</span>
        </div>
        <span className="text-sm font-black text-emerald-600">{totalCommission.toLocaleString('ar-EG')} ج.م عمولات</span>
      </div>

      {/* Transfer history */}
      {todayTransfers.length > 0 && (
        <div className="space-y-2 max-h-52 overflow-y-auto">
          {[...todayTransfers].reverse().map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-muted/30 border border-border/30 px-4 py-3">
              <div>
                <p className="text-sm font-bold">{t.type} — {t.customer || 'عميل'}</p>
                <p className="text-xs text-muted-foreground">{new Date(t.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} · {t.walletName}</p>
              </div>
              <div className="text-end">
                <p className="text-sm font-bold">{t.amount.toLocaleString('ar-EG')} ج.م</p>
                {t.commission > 0 && <p className="text-xs text-emerald-600 font-bold">+{t.commission} ج.م</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link to wallets */}
      <Link to="/wallets" className="flex items-center justify-between rounded-2xl border border-blue-200 dark:border-blue-800/20 bg-blue-50 dark:bg-blue-900/10 px-5 py-4 text-blue-700 dark:text-blue-400 hover:bg-blue-100 transition-colors">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5" />
          <div>
            <p className="text-sm font-bold">إدارة المحافظ والصندوق</p>
            <p className="text-xs opacity-70">عرض الأرصدة وتفاصيل المعاملات</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 opacity-60" />
      </Link>
    </div>
  );
};


// ── Main POS ─────────────────────────────────────────────────
export default function POS() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const { user } = useAuth();

  const {
    cart, addToCart, removeFromCart, updateCartItemQty, updateLineDiscount,
    clearCart, invoiceDiscount, applyInvoiceDiscount, getTotals,
    holdInvoice, heldInvoices, restoreInvoice, removeHeldInvoice,
  } = useCart();

  // Discount math
  const subtotal = cart.reduce((s, i) => s + i.product.sellingPrice * i.qty, 0);
  const lineDiscountsTotal = cart.reduce((s, i) => s + (i.lineDiscount ?? 0), 0);
  const totalCost = cart.reduce((s, i) => s + i.product.costPrice * i.qty, 0);
  const maxInvoiceDiscount = Math.max(0, subtotal - lineDiscountsTotal - totalCost);
  const grandTotal = Math.max(0, subtotal - lineDiscountsTotal - invoiceDiscount);

  // Local
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabId>('mobiles');
  const [selectedChip, setSelectedChip] = useState('الكل');
  const [showHeld, setShowHeld] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Reset chip when tab changes
  useEffect(() => { setSelectedChip('الكل'); }, [selectedTab]);

  // ── Keyboard Shortcuts (ELOS-style F1–F9) ──────────────────
  const checkoutBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      // Skip if typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Only allow Escape even in input
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
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
          setSelectedTab('accessories');
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
        case 'F9':
          e.preventDefault();
          checkoutBtnRef.current?.click();
          break;
        case 'Escape':
          e.preventDefault();
          searchInputRef.current?.blur();
          break;
        // Ctrl+K legacy
        default:
          if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchInputRef.current?.focus();
          }
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const allProducts = useMemo(() => getAllInventoryProducts(), []);

  // Category chips per tab
  const chips = useMemo(() => {
    if (selectedTab === 'mobiles') return MOBILE_BRANDS;
    if (selectedTab === 'accessories') return ACC_CATS;
    if (selectedTab === 'cars') return CAR_CATS;
    return [];
  }, [selectedTab]);

  const filteredProducts = useMemo(() => {
    if (selectedTab === 'transfers') return [];

    let prods = allProducts;

    if (selectedTab === 'mobiles') {
      prods = prods.filter(p =>
        p.category.includes('موبيل') || p.category.includes('موبايل') ||
        p.category.includes('لابتوب') || p.category.includes('تابلت')
      );
      if (selectedChip !== 'الكل') {
        const cl = selectedChip.toLowerCase();
        prods = prods.filter(p => p.name.toLowerCase().includes(cl));
      }
    } else if (selectedTab === 'accessories') {
      prods = prods.filter(p =>
        p.category.includes('إكسسوار') || p.category.includes('سماع') ||
        p.category.includes('شاحن') || p.category.includes('كفر') ||
        p.category.includes('كابل')
      );
      if (selectedChip !== 'الكل') {
        const cl = selectedChip.toLowerCase();
        prods = prods.filter(p =>
          p.category.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl)
        );
      }
    } else if (selectedTab === 'cars') {
      prods = prods.filter(p =>
        p.category.includes('سيارة') || p.category.includes('car') || p.category.includes('عربي')
      );
      if (selectedChip !== 'الكل') {
        const cl = selectedChip.toLowerCase();
        prods = prods.filter(p =>
          p.category.toLowerCase().includes(cl) || p.name.toLowerCase().includes(cl)
        );
      }
    }

    if (searchTerm.trim()) prods = searchProducts(prods, searchTerm, undefined, 40);
    return prods;
  }, [allProducts, selectedTab, selectedChip, searchTerm]);

  const handleCheckout = useCallback(async () => {
    if (isProcessing || cart.length === 0) return;
    setIsProcessing(true);
    try {
      const result = processSale(cart, invoiceDiscount, 'cash', user?.id ?? 'user-1', user?.fullName ?? 'Admin');
      saveSale(result.sale);
      saveMovements(result.stockMovements);
      saveAuditEntries(result.auditEntries);
      result.stockMovements.forEach(m => updateProductQuantity(m.productId, m.newQuantity));
      try { printInvoice(result.sale); } catch { /* silent */ }
      toast({ title: '✅ تمت العملية!', description: `فاتورة: ${result.sale.invoiceNumber} — ${result.sale.total.toFixed(2)} ج.م` });
      clearCart();
    } catch (e: any) {
      toast({ title: 'حدث خطأ', description: e?.message, variant: 'destructive' });
    } finally { setIsProcessing(false); }
  }, [cart, isProcessing, invoiceDiscount, user, toast, clearCart]);

  const isTransferTab = selectedTab === 'transfers';

  return (
    <div className="flex h-screen w-full flex-col bg-[#F3F4F6] dark:bg-background" dir="rtl">

      {/* ══ Header ══ */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white dark:bg-card px-4 shadow-sm z-10 gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-black">نقطة البيع</h1>
        </div>

        <div className="hidden lg:flex flex-1 items-center justify-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 border border-blue-100">
            <Clock className="h-4 w-4" />
            {now.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })} | {now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button onClick={() => searchInputRef.current?.focus()} className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-muted/50 px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-200 transition-all">
            <Search className="h-3.5 w-3.5 text-blue-600" /> بحث <kbd className="rounded bg-white dark:bg-card px-1.5 py-0.5 text-[10px] font-mono shadow-sm border">Ctrl+K</kbd>
          </button>
          {[
            { label: 'طباعة باركود', color: 'bg-violet-600 hover:bg-violet-700', icon: Barcode, path: '/barcodes' },
            { label: 'استلام من عميل', color: 'bg-emerald-600 hover:bg-emerald-700', icon: Lock, path: '/maintenance' },
            { label: 'مرتجع', color: 'bg-orange-500 hover:bg-orange-600', icon: RotateCcw, path: '/returns' },
            { label: 'شراء جهاز', color: 'bg-blue-600 hover:bg-blue-700', icon: Download, path: '/mobiles' },
          ].map(b => (
            <button key={b.label} onClick={() => navigate(b.path)} className={`flex items-center gap-1.5 rounded-lg ${b.color} px-3 py-1.5 text-xs font-bold text-white shadow-sm active:scale-95`}>
              {b.label} <b.icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={toggleTheme} className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-muted/50 hover:bg-gray-200 text-gray-600 dark:text-gray-300">
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-500" />}
          </button>
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-muted/50 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200">
            رجوع <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ══ Body ══ */}
      <main className="flex flex-1 gap-4 overflow-hidden p-4">

        {/* Products Panel */}
        <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-card rounded-2xl border border-border/50 shadow-sm p-4">

          {/* Category Tabs */}
          <div className="flex gap-2 mb-4">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setSelectedTab(tab.id)}
                className={cn('flex-1 flex items-center justify-between px-3 py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.98]',
                  selectedTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-muted/30 text-gray-600 hover:bg-gray-50 border border-border/60'
                )}>
                <div className="flex items-center gap-2">
                  <tab.icon className={cn('h-4 w-4', selectedTab === tab.id ? 'opacity-90' : 'text-gray-400')} />
                  {tab.label}
                </div>
                <span className={cn('flex h-6 min-w-6 items-center justify-center rounded-lg px-2 text-[11px] font-black',
                  selectedTab === tab.id ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600 dark:bg-background dark:text-blue-400')}>
                  {selectedTab === tab.id && !isTransferTab ? filteredProducts.length : ''}
                </span>
              </button>
            ))}
          </div>

          {isTransferTab ? (
            <div className="flex-1 overflow-y-auto px-1"><TransferTab /></div>
          ) : (
            <>
              {/* Stats */}
              <div className="flex gap-4 mb-4">
                <div className="flex-[1.5] rounded-2xl bg-gradient-to-l from-violet-600 to-indigo-700 p-5 text-white shadow-lg flex items-center justify-center">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 opacity-80 mb-1 text-sm font-bold"><Calculator className="h-4 w-4" /> إجمالي السلة</div>
                    <span className="text-4xl font-black">{grandTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="flex-1 rounded-2xl bg-gradient-to-l from-emerald-500 to-teal-500 p-5 text-white shadow-lg flex items-center justify-center">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 opacity-80 mb-1 text-sm font-bold"><ShoppingCart className="h-4 w-4" /> في السلة</div>
                    <span className="text-4xl font-black text-amber-300">{cart.length}</span>
                  </div>
                </div>
                <div className="flex-1 rounded-2xl border-2 border-blue-100 dark:border-blue-900/40 bg-blue-50/30 p-5 flex flex-col items-center justify-center">
                  <p className="text-xs font-bold text-blue-400 mb-1">متاح للبيع</p>
                  <span className="text-3xl font-black text-blue-700 dark:text-blue-400">{filteredProducts.length}</span>
                </div>
              </div>

              {/* Search */}
              <div className="flex gap-2 mb-3 bg-gray-50 dark:bg-muted/30 p-2 rounded-xl border border-border/50">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input ref={searchInputRef} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full h-10 bg-white dark:bg-background border border-border/60 rounded-lg pr-9 pl-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="ابحث بالاسم أو الموديل أو الباركود..." />
                </div>
              </div>

              {/* Chip filter (smart per tab) */}
              {chips.length > 0 && (
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                  {chips.map(chip => (
                    <button key={chip} onClick={() => setSelectedChip(chip)}
                      className={cn('rounded-lg px-5 py-2 text-xs font-bold whitespace-nowrap transition-all shrink-0',
                        selectedChip === chip ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-background border border-border/60 text-gray-500 hover:bg-gray-50')}>
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              {/* Products Grid */}
              <div className="flex-1 overflow-y-auto pr-1">
                {filteredProducts.length === 0 ? (
                  <div className="h-full flex flex-col justify-center items-center text-gray-400 py-16">
                    {selectedTab === 'accessories'
                      ? <Headphones className="h-16 w-16 mb-4 opacity-20" />
                      : selectedTab === 'cars'
                        ? <Car className="h-16 w-16 mb-4 opacity-20" />
                        : <ShoppingCart className="h-16 w-16 mb-4 opacity-20" />
                    }
                    <p className="font-bold text-lg">
                      {selectedTab === 'accessories' ? 'لا توجد إكسسوارات متاحة'
                        : selectedTab === 'cars' ? 'لا توجد عربيات متاحة'
                          : 'لا توجد منتجات'}
                    </p>
                    <p className="text-sm opacity-70 mt-1">جرب تغيير الفئة أو كلمة البحث</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
                    {filteredProducts.map((p: Product) => (
                      <div key={p.id} onClick={() => addToCart(p)}
                        className="group flex flex-col rounded-2xl border border-border/60 bg-white dark:bg-card p-4 shadow-sm hover:shadow-md hover:border-blue-400/50 transition-all cursor-pointer select-none">
                        <span className="self-end rounded border border-gray-200 bg-gray-50 dark:border-border dark:bg-muted/40 text-gray-500 dark:text-gray-400 px-2 py-0.5 text-[10px] font-bold mb-2">{p.category}</span>
                        <h3 className="font-bold text-foreground line-clamp-2 min-h-[40px] leading-tight text-sm">{p.name}</h3>
                        {p.model && <p className="mt-1 text-[11px] text-muted-foreground">{p.model}</p>}
                        <div className="mt-5 flex-1 flex flex-col justify-end">
                          <span className="text-[10px] text-gray-400 font-medium mb-0.5">سعر البيع</span>
                          <span className="text-lg font-black text-emerald-600">{p.sellingPrice.toLocaleString('ar-EG')}<span className="text-xs font-medium text-gray-400 mr-1">ج.م</span></span>
                        </div>
                        <div className={cn('mt-2 rounded-lg px-2 py-1 text-[10px] font-bold text-center',
                          p.quantity === 0 ? 'bg-red-50 text-red-500' : p.quantity <= 5 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')}>
                          {p.quantity === 0 ? 'نفذ من المخزون' : `المخزون: ${p.quantity}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Cart Panel ── */}
        <div className="flex w-[380px] shrink-0 flex-col overflow-hidden bg-white dark:bg-card rounded-2xl border border-border/50 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-border/50 bg-gray-50/50 dark:bg-muted/20 p-4">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10"><ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
            <h2 className="text-lg font-black">سلة المشتريات</h2>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{cart.length}</span>
          </div>

          <div className="grid grid-cols-4 gap-2 border-b border-border/50 p-3">
            {[
              { icon: PauseCircle, label: 'تعليق', action: () => { holdInvoice(); toast({ title: 'تم تعليق الفاتورة' }); }, badge: cart.length > 0 && heldInvoices.length > 0 },
              { icon: FileText, label: 'معلقة', action: () => setShowHeld(true), badge: heldInvoices.length > 0 },
              { icon: RotateCcw, label: 'مرتجع', action: () => navigate('/returns') },
              { icon: HelpCircle, label: 'مساعدة', action: () => navigate('/help') },
            ].map(({ icon: Icon, label, action, badge }) => (
              <button key={label} onClick={action} className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-gray-50 dark:bg-muted/30 py-2.5 text-xs font-bold text-gray-500 hover:bg-white hover:border-blue-200 transition-all relative">
                {badge && <span className="absolute -top-1 -right-1 bg-amber-500 h-3 w-3 rounded-full border-2 border-white" />}
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-background/30 p-3">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center opacity-40">
                <ShoppingCart className="h-10 w-10 text-gray-400 mb-3" />
                <p className="text-lg font-black text-gray-600">السلة فارغة</p>
                <p className="text-xs font-bold text-gray-400 mt-1">اضغط على منتج لإضافته</p>
              </div>
            ) : cart.map(item => (
              <CartItemRow key={item.product.id} item={item} onUpdateQty={updateCartItemQty} onRemove={removeFromCart} onLineDiscount={(id, d) => updateLineDiscount(id, d)} />
            ))}
          </div>

          <div className="border-t border-border/50 bg-white dark:bg-card p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-gray-500">المجموع الفرعي</span>
              <span className="font-bold">{subtotal.toLocaleString('ar-EG')} ج.م</span>
            </div>
            {lineDiscountsTotal > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-amber-500 flex items-center gap-1"><TrendingDown className="h-3.5 w-3.5" /> خصم الأصناف</span>
                <span className="font-bold text-amber-500">- {lineDiscountsTotal.toLocaleString('ar-EG')} ج.م</span>
              </div>
            )}

            {/* Invoice Discount */}
            <div className="rounded-xl border border-dashed border-orange-200 dark:border-orange-800/30 bg-orange-50/50 dark:bg-orange-900/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-orange-700 dark:text-orange-400">
                  <Percent className="h-3.5 w-3.5" /> خصم الفاتورة الكلي
                </div>
                {invoiceDiscount > 0 && <button onClick={() => applyInvoiceDiscount(0)} className="text-[10px] text-red-400 hover:text-red-600 font-bold">مسح</button>}
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={maxInvoiceDiscount} step={0.5} value={invoiceDiscount || ''} disabled={cart.length === 0}
                  onChange={e => applyInvoiceDiscount(Math.min(Math.max(0, Number(e.target.value)), maxInvoiceDiscount))}
                  placeholder={`حتى ${maxInvoiceDiscount.toFixed(0)} ج.م`}
                  className="flex-1 rounded-lg border border-orange-200 bg-white dark:bg-card px-3 py-1.5 text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-orange-400 disabled:opacity-50" />
                <span className="text-xs text-orange-600 font-bold shrink-0">ج.م</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 border border-emerald-100 dark:border-emerald-500/20">
              <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300"><Receipt className="h-5 w-5" /> الإجمالي</div>
              <span className="text-xl font-black text-emerald-600">{grandTotal.toLocaleString('ar-EG')} ج.م</span>
            </div>

            <div className="flex gap-2">
              <button onClick={handleCheckout} disabled={cart.length === 0 || isProcessing}
                className="flex-[2] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 py-3.5 text-sm font-bold text-white flex justify-center items-center gap-2 transition-all shadow-md active:scale-[0.98]">
                {isProcessing ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <CreditCard className="h-4 w-4" />}
                إتمام البيع{cart.length > 0 ? ` — ${grandTotal.toLocaleString('ar-EG')} ج.م` : ''}
              </button>
              <button onClick={clearCart} disabled={cart.length === 0}
                className="rounded-xl bg-red-50 dark:bg-red-500/10 px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-100 border border-red-100 flex flex-col items-center justify-center transition-all disabled:opacity-50">
                <Trash2 className="h-4 w-4 mb-0.5" /> مسح
              </button>
            </div>

            <button onClick={() => navigate('/sales')} className="flex w-full items-center justify-between rounded-xl bg-teal-600 px-4 py-3 text-white hover:bg-teal-700 transition-colors active:scale-[0.98]">
              <div className="text-start">
                <p className="text-sm font-bold">فواتير نقطة البيع</p>
                <p className="text-[10px] opacity-90">عرض آخر الفواتير</p>
              </div>
              <Receipt className="h-5 w-5 opacity-90" />
            </button>
          </div>
        </div>
      </main>

      {/* Held Invoices Modal */}
      {showHeld && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowHeld(false)}>
          <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black">الفواتير المعلقة ({heldInvoices.length})</h3>
              <button onClick={() => setShowHeld(false)} className="rounded-lg p-1.5 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            {heldInvoices.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد فواتير معلقة</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {heldInvoices.map(h => (
                  <div key={h.id} className="flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 p-3">
                    <div>
                      <p className="text-sm font-bold">{h.cart.length} منتج — {h.customer ?? 'نقدي'}</p>
                      <p className="text-xs text-muted-foreground">{new Date(h.heldAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { restoreInvoice(h.id); setShowHeld(false); }} className="rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-xs font-bold hover:bg-primary/20">استرجاع</button>
                      <button onClick={() => removeHeldInvoice(h.id)} className="rounded-lg bg-red-50 text-red-500 px-2 py-1.5 text-xs font-bold hover:bg-red-100"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
