// ============================================================
// CheckoutSidebar — Right-panel cart with state machine
// States: 'cart' → 'payment' → 'success' → back to 'cart'
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import { ShoppingCart, PauseCircle, FileText, RotateCcw, HelpCircle, Trash2, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { CartItem } from '@/domain/types';
import { processSale } from '@/services/saleService';
import { saveSale } from '@/repositories/saleRepository';
import { saveMovements } from '@/repositories/stockRepository';
import { saveAuditEntries } from '@/repositories/auditRepository';
import { getAllInventoryProducts, updateProductQuantity } from '@/repositories/productRepository';
import { printInvoice } from '@/services/invoicePrinter';
import { recordSalePayment } from '@/data/walletsData';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import CartItemRow from './CartItemRow';
import OrderSummaryPanel from './OrderSummaryPanel';
import PaymentStep, { PaymentMethodChoice } from './PaymentStep';
import TransactionSuccess from './TransactionSuccess';
import { HeldInvoice } from '@/contexts/CartContext';
import type { SelectedCustomer } from './CustomerSelector';

type SidebarMode = 'cart' | 'payment' | 'success';

interface SuccessData {
    invoiceNumber: string;
    grandTotal: number;
    paymentMethod: string;
    change: number;
}

interface CheckoutSidebarProps {
    cart: CartItem[];
    onUpdateQty: (productId: string, delta: number) => void;
    onRemove: (productId: string) => void;
    onLineDiscount: (productId: string, discount: number) => void;
    onClearCart: () => void;
    onHoldInvoice: () => void;
    onShowHeld: () => void;
    invoiceDiscount: number;
    maxInvoiceDiscount: number;
    onInvoiceDiscount: (v: number) => void;
    subtotal: number;
    lineDiscountsTotal: number;
    grandTotal: number;
    heldInvoices: HeldInvoice[];
    // Pass checkout ref up for F9 keyboard shortcut
    onCheckoutReady: (trigger: () => void) => void;
    selectedCustomer: SelectedCustomer;
}

export default function CheckoutSidebar({
    cart,
    onUpdateQty,
    onRemove,
    onLineDiscount,
    onClearCart,
    onHoldInvoice,
    onShowHeld,
    invoiceDiscount,
    maxInvoiceDiscount,
    onInvoiceDiscount,
    subtotal,
    lineDiscountsTotal,
    grandTotal,
    heldInvoices,
    onCheckoutReady,
    selectedCustomer,
}: CheckoutSidebarProps) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();

    const [mode, setMode] = useState<SidebarMode>('cart');
    const [isProcessing, setIsProcessing] = useState(false);
    const [successData, setSuccessData] = useState<SuccessData | null>(null);

    // Expose the "initiate checkout" trigger to parent for F9 shortcut
    const initiateCheckout = useCallback(() => {
        if (cart.length === 0 || isProcessing || mode !== 'cart') return;
        setMode('payment');
    }, [cart.length, isProcessing, mode]);

    useEffect(() => {
        onCheckoutReady(initiateCheckout);
    }, [initiateCheckout, onCheckoutReady]);

    const handlePaymentConfirm = useCallback(async (method: PaymentMethodChoice, amountTendered: number) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const liveProducts = new Map(getAllInventoryProducts().map((product) => [product.id, product]));
            const liveCart = cart.map((item) => {
                const liveProduct = liveProducts.get(item.product.id);
                if (!liveProduct) {
                    throw new Error(`المنتج "${item.product.name}" لم يعد موجودًا في المخزون`);
                }

                return {
                    ...item,
                    product: {
                        ...item.product,
                        quantity: liveProduct.quantity,
                        warehouseId: liveProduct.warehouseId ?? item.product.warehouseId,
                        updatedAt: liveProduct.updatedAt,
                        deletedAt: liveProduct.deletedAt,
                    },
                };
            });

            const result = processSale(
                liveCart,
                invoiceDiscount,
                method,
                user?.id ?? 'user-1',
                user?.fullName ?? 'Admin',
                selectedCustomer.id === '__cash__' ? undefined : selectedCustomer.id,
                selectedCustomer.name
            );
            saveSale(result.sale);
            saveMovements(result.stockMovements);
            saveAuditEntries(result.auditEntries);
            result.stockMovements.forEach(m => updateProductQuantity(m.productId, m.newQuantity));

            let postSaleWarning: string | null = null;

            try {
                await recordSalePayment(result.sale);
            } catch {
                postSaleWarning = 'تم البيع لكن فشل تسجيل الحركة في الخزنة.';
            }

            try {
                printInvoice(result.sale);
            } catch {
                postSaleWarning = postSaleWarning
                    ? `${postSaleWarning} وفشلت الطباعة أيضًا.`
                    : 'تم البيع لكن تعذرت طباعة الفاتورة.';
            }

            const change = method === 'cash' ? Math.max(0, amountTendered - grandTotal) : 0;
            setSuccessData({
                invoiceNumber: result.sale.invoiceNumber,
                grandTotal: result.sale.total,
                paymentMethod: method,
                change,
            });
            setMode('success');

            if (postSaleWarning) {
                toast({ title: 'تم البيع مع ملاحظة', description: postSaleWarning });
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'حدث خطأ غير متوقع';
            toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
            setMode('cart');
        } finally {
            setIsProcessing(false);
        }
    }, [cart, invoiceDiscount, user, grandTotal, toast, isProcessing]);

    const handleSuccessDismiss = useCallback(() => {
        onClearCart();
        setMode('cart');
        setSuccessData(null);
    }, [onClearCart]);

    // ── Success state ──
    if (mode === 'success' && successData) {
        return (
            <div className="flex w-[380px] shrink-0 flex-col overflow-hidden bg-card rounded-2xl border border-border/50 shadow-sm" dir="rtl">
                <TransactionSuccess
                    invoiceNumber={successData.invoiceNumber}
                    grandTotal={successData.grandTotal}
                    paymentMethod={successData.paymentMethod}
                    change={successData.change}
                    onDismiss={handleSuccessDismiss}
                />
            </div>
        );
    }

    // ── Payment state ──
    if (mode === 'payment') {
        return (
            <div className="flex w-[380px] shrink-0 flex-col overflow-hidden bg-card rounded-2xl border border-border/50 shadow-sm" dir="rtl">
                <PaymentStep
                    grandTotal={grandTotal}
                    onConfirm={handlePaymentConfirm}
                    onBack={() => setMode('cart')}
                    isProcessing={isProcessing}
                />
            </div>
        );
    }

    // ── Cart state (default) ──
    return (
        <div
            className="flex w-[380px] shrink-0 flex-col overflow-hidden bg-card rounded-2xl border border-border/50 shadow-sm"
            dir="rtl"
            aria-label="سلة المشتريات"
        >
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-border/50 bg-muted/20 px-4 py-3">
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10" aria-hidden="true">
                    <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-base font-black">سلة المشتريات</h2>
                <span
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
                    aria-label={`${cart.length} منتج في السلة`}
                >
                    {cart.length}
                </span>
                {/* Quick keyboard hint */}
                <span className="mr-auto text-[10px] text-muted-foreground hidden lg:inline-flex">
                    <kbd className="mx-1 rounded bg-muted px-1 font-mono">F9</kbd> دفع
                    <kbd className="mx-1 rounded bg-muted px-1 font-mono">F10</kbd> تعليق
                </span>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-4 gap-1.5 border-b border-border/50 p-2.5">
                {[
                    {
                        icon: PauseCircle,
                        label: 'تعليق',
                        shortcut: 'F10',
                        action: () => { onHoldInvoice(); toast({ title: 'تم تعليق الفاتورة' }); },
                        badge: false,
                        disabled: cart.length === 0,
                        ariaLabel: 'تعليق الفاتورة الحالية (F10)',
                    },
                    {
                        icon: FileText,
                        label: 'معلقة',
                        shortcut: null,
                        action: onShowHeld,
                        badge: heldInvoices.length > 0,
                        disabled: false,
                        ariaLabel: `الفواتير المعلقة — ${heldInvoices.length} فاتورة`,
                    },
                    {
                        icon: RotateCcw,
                        label: 'مرتجع',
                        shortcut: null,
                        action: () => navigate('/returns'),
                        badge: false,
                        disabled: false,
                        ariaLabel: 'الذهاب إلى صفحة المرتجعات',
                    },
                    {
                        icon: HelpCircle,
                        label: 'مساعدة',
                        shortcut: null,
                        action: () => navigate('/help'),
                        badge: false,
                        disabled: false,
                        ariaLabel: 'فتح صفحة المساعدة',
                    },
                ].map(({ icon: Icon, label, shortcut, action, badge, disabled, ariaLabel }) => (
                    <button
                        key={label}
                        onClick={action}
                        disabled={disabled}
                        aria-label={ariaLabel}
                        className={cn(
                            'relative flex flex-col items-center justify-center gap-1 rounded-xl border border-border/60 bg-muted/40 py-2 text-xs font-bold text-muted-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-card hover:border-blue-200 hover:text-foreground'
                        )}
                    >
                        {badge && (
                            <span
                                className="absolute -top-1 -right-1 bg-amber-500 h-3 w-3 rounded-full border-2 border-white dark:border-card"
                                aria-hidden="true"
                            />
                        )}
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span>{label}</span>
                        {shortcut && (
                            <kbd className="text-[8px] font-mono bg-muted/80 border rounded px-1 leading-tight">{shortcut}</kbd>
                        )}
                    </button>
                ))}
            </div>

            {/* Cart items */}
            <div
                className="flex-1 overflow-y-auto bg-muted/20 p-3"
                role="list"
                aria-label="منتجات في السلة"
                aria-live="polite"
                aria-atomic="false"
            >
                {cart.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center opacity-40 py-10">
                        <ShoppingCart className="h-10 w-10 text-muted-foreground mb-3" aria-hidden="true" />
                        <p className="text-base font-black text-muted-foreground">السلة فارغة</p>
                        <p className="text-xs font-bold text-muted-foreground/60 mt-1">اضغط على منتج لإضافته</p>
                    </div>
                ) : (
                    cart.map(item => (
                        <CartItemRow
                            key={item.product.id}
                            item={item}
                            onUpdateQty={onUpdateQty}
                            onRemove={onRemove}
                            onLineDiscount={onLineDiscount}
                        />
                    ))
                )}
            </div>

            {/* Order summary (discounts + totals) */}
            <OrderSummaryPanel
                subtotal={subtotal}
                lineDiscountsTotal={lineDiscountsTotal}
                invoiceDiscount={invoiceDiscount}
                maxInvoiceDiscount={maxInvoiceDiscount}
                grandTotal={grandTotal}
                cartLength={cart.length}
                onDiscountChange={onInvoiceDiscount}
            />

            {/* Checkout action buttons */}
            <div className="border-t border-border/50 bg-card p-3 space-y-2">
                <div className="flex gap-2">
                    {/* Primary: Checkout — 56px, full-flex, emerald */}
                    <button
                        onClick={() => setMode('payment')}
                        disabled={cart.length === 0 || isProcessing}
                        aria-label={`إتمام البيع — ${grandTotal.toLocaleString('ar-EG')} جنيه`}
                        className={cn(
                            'flex-1 h-14 rounded-xl text-sm font-black flex items-center justify-between px-4 transition-all',
                            cart.length > 0 && !isProcessing
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 active:scale-[0.98]'
                                : 'bg-muted text-muted-foreground cursor-not-allowed'
                        )}
                    >
                        <span className="flex items-center gap-2">
                            {isProcessing ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                            ) : (
                                <Receipt className="h-4 w-4" aria-hidden="true" />
                            )}
                            {cart.length > 0
                                ? `إتمام البيع — ${grandTotal.toLocaleString('ar-EG')} ج.م`
                                : 'إتمام البيع'}
                        </span>
                        <kbd className="rounded-lg bg-white/20 px-2 py-0.5 text-xs font-mono font-bold">F9</kbd>
                    </button>

                    {/* Secondary: Clear cart */}
                    <button
                        onClick={onClearCart}
                        disabled={cart.length === 0}
                        aria-label="مسح جميع عناصر السلة"
                        className="rounded-xl bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-100 border border-red-100 dark:border-red-500/20 flex flex-col items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                        <Trash2 className="h-4 w-4 mb-0.5" aria-hidden="true" />
                        مسح
                    </button>
                </div>

                {/* Sales history link */}
                <button
                    onClick={() => navigate('/sales')}
                    aria-label="عرض سجل فواتير نقطة البيع"
                    className="flex w-full items-center justify-between rounded-xl bg-muted/50 border border-border/50 px-4 py-2.5 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    <div className="text-start">
                        <p className="text-xs font-bold text-foreground">فواتير نقطة البيع</p>
                        <p className="text-[10px] text-muted-foreground">عرض آخر الفواتير</p>
                    </div>
                    <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}
