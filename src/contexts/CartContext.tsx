// ============================================================
// Cart Context — Global State for Shopping Cart
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { CartItem, Product, PaymentMethod } from '@/domain/types';
import { getCartTotals } from '@/services/saleService';

interface CartTotals {
    subtotal: number;
    discount: number;
    total: number;
    itemCount: number;
}

interface CartContextType {
    cart: CartItem[];
    addToCart: (product: Product, qty?: number) => void;
    removeFromCart: (productId: string) => void;
    updateCartItemQty: (productId: string, qty: number) => void;
    updateLineDiscount: (productId: string, discount: number) => void;
    clearCart: () => void;
    invoiceDiscount: number;
    applyInvoiceDiscount: (discount: number) => void;
    getTotals: () => CartTotals;
    heldInvoices: HeldInvoice[];
    holdInvoice: (customer?: string, notes?: string, discount?: number) => void;
    restoreInvoice: (invoiceId: string) => void;
    removeHeldInvoice: (invoiceId: string) => void;
}

export interface HeldInvoice {
    id: string;
    cart: CartItem[];
    customer?: string;
    notes?: string;
    discount: number;
    heldAt: string;
}

const CART_KEY = 'gx_current_cart';
const HELD_INVOICES_KEY = 'gx_held_invoices';

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [cart, setCart] = useState<CartItem[]>(() => {
        try {
            const saved = localStorage.getItem(CART_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>(() => {
        try {
            const saved = localStorage.getItem(HELD_INVOICES_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const [invoiceDiscount, setInvoiceDiscount] = useState(0);

    // Persist cart to localStorage
    useEffect(() => {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }, [cart]);

    // Persist held invoices
    useEffect(() => {
        localStorage.setItem(HELD_INVOICES_KEY, JSON.stringify(heldInvoices));
    }, [heldInvoices]);

    const addToCart = useCallback((product: Product, qty: number = 1) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, qty: item.qty + qty }
                        : item
                );
            }
            return [...prev, { product, qty, lineDiscount: 0 }];
        });
    }, []);

    const removeFromCart = useCallback((productId: string) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    }, []);

    const updateCartItemQty = useCallback((productId: string, qty: number) => {
        if (qty <= 0) {
            setCart(prev => prev.filter(item => item.product.id !== productId));
        } else {
            setCart(prev =>
                prev.map(item =>
                    item.product.id === productId ? { ...item, qty } : item
                )
            );
        }
    }, []);

    const updateLineDiscount = useCallback((productId: string, discount: number) => {
        setCart(prev =>
            prev.map(item =>
                item.product.id === productId
                    ? { ...item, lineDiscount: Math.max(0, discount) }
                    : item
            )
        );
    }, []);

    const clearCart = useCallback(() => {
        setCart([]);
        setInvoiceDiscount(0);
    }, []);

    const applyInvoiceDiscount = useCallback((discount: number) => {
        setInvoiceDiscount(Math.max(0, discount));
    }, []);

    const getTotals = useCallback((): CartTotals => {
        return getCartTotals(cart, invoiceDiscount) as CartTotals;
    }, [cart, invoiceDiscount]);

    const holdInvoice = useCallback((
        customer?: string,
        notes?: string,
        discount?: number
    ) => {
        const invoice: HeldInvoice = {
            id: Date.now().toString(),
            cart: [...cart],
            customer,
            notes,
            discount: discount ?? invoiceDiscount,
            heldAt: new Date().toISOString(),
        };
        setHeldInvoices(prev => [...prev, invoice]);
        clearCart();
    }, [cart, invoiceDiscount, clearCart]);

    const restoreInvoice = useCallback((invoiceId: string) => {
        const invoice = heldInvoices.find(h => h.id === invoiceId);
        if (invoice) {
            setCart(invoice.cart);
            setInvoiceDiscount(invoice.discount);
            setHeldInvoices(prev => prev.filter(h => h.id !== invoiceId));
        }
    }, [heldInvoices]);

    const removeHeldInvoice = useCallback((invoiceId: string) => {
        setHeldInvoices(prev => prev.filter(h => h.id !== invoiceId));
    }, []);

    return (
        <CartContext.Provider
            value={{
                cart,
                addToCart,
                removeFromCart,
                updateCartItemQty,
                updateLineDiscount,
                clearCart,
                invoiceDiscount,
                applyInvoiceDiscount,
                getTotals,
                heldInvoices,
                holdInvoice,
                restoreInvoice,
                removeHeldInvoice,
            }}
        >
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within CartProvider');
    }
    return context;
};
