// ============================================================
// Wallets Data Layer — Multi-wallet / treasury system
// ============================================================

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const WALLETS_KEY = STORAGE_KEYS.WALLETS;
const TXN_KEY = STORAGE_KEYS.WALLET_TRANSACTIONS;

// ─── Types ──────────────────────────────────────────────────

export type TransactionType = 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out';

export interface Wallet {
    id: string;
    name: string;
    balance: number;
    icon: string;        // emoji: "💵" | "🏦" | "📱"
    color: string;       // tailwind bg class
    isDefault: boolean;
    createdAt: string;
}

export interface WalletTransaction {
    id: string;
    walletId: string;
    type: TransactionType;
    amount: number;
    reason: string;
    relatedWalletId?: string;   // for transfers
    relatedWalletName?: string;
    date: string;
    reference?: string;         // invoice# etc.
}

// ─── Helpers ────────────────────────────────────────────────



// ─── Default wallets (seeded on first run) ──────────────────

const DEFAULT_WALLETS: Wallet[] = [
    {
        id: 'wallet_cash',
        name: 'الصندوق',
        balance: 0,
        icon: '💵',
        color: 'bg-emerald-100 text-emerald-700',
        isDefault: true,
        createdAt: new Date().toISOString(),
    },
];

// ─── Wallets CRUD ────────────────────────────────────────────

export function getWallets(): Wallet[] {
    const stored = getStorageItem<Wallet[]>(WALLETS_KEY, []);
    if (stored.length === 0) {
        setStorageItem(WALLETS_KEY, DEFAULT_WALLETS);
        return DEFAULT_WALLETS;
    }
    return stored;
}

export function saveWallets(wallets: Wallet[]): void {
    setStorageItem(WALLETS_KEY, wallets);
}

export function addWallet(data: Omit<Wallet, 'id' | 'createdAt'>): Wallet {
    const wallet: Wallet = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    saveWallets([...getWallets(), wallet]);
    return wallet;
}

export function updateWallet(id: string, data: Partial<Wallet>): void {
    saveWallets(getWallets().map(w => w.id === id ? { ...w, ...data } : w));
}

export function deleteWallet(id: string): void {
    saveWallets(getWallets().filter(w => w.id !== id));
}

export function getTotalBalance(): number {
    return getWallets().reduce((sum, w) => sum + w.balance, 0);
}

// ─── Transactions ────────────────────────────────────────────

export function getTransactions(walletId?: string): WalletTransaction[] {
    const all = getStorageItem<WalletTransaction[]>(TXN_KEY, []);
    return walletId ? all.filter(t => t.walletId === walletId) : all;
}

function saveTransactions(txns: WalletTransaction[]): void {
    setStorageItem(TXN_KEY, txns);
}

function addTransaction(txn: Omit<WalletTransaction, 'id'>): WalletTransaction {
    const t: WalletTransaction = { ...txn, id: crypto.randomUUID() };
    saveTransactions([...getTransactions(), t]);
    return t;
}

// ─── Operations ─────────────────────────────────────────────

/** Deposit money into a wallet */
export function deposit(walletId: string, amount: number, reason: string, reference?: string): void {
    const wallets = getWallets();
    const w = wallets.find(w => w.id === walletId);
    if (!w) return;
    w.balance += amount;
    saveWallets(wallets);
    addTransaction({ walletId, type: 'deposit', amount, reason, date: new Date().toISOString(), reference });
}

/** Withdraw money from a wallet */
export function withdraw(walletId: string, amount: number, reason: string, reference?: string): void {
    const wallets = getWallets();
    const w = wallets.find(w => w.id === walletId);
    if (!w) return;
    if (amount > w.balance) {
        throw new Error(`رصيد المحفظة غير كافٍ. الرصيد: ${w.balance}، المطلوب: ${amount}`);
    }
    w.balance -= amount;
    saveWallets(wallets);
    addTransaction({ walletId, type: 'withdrawal', amount, reason, date: new Date().toISOString(), reference });
}

/** Transfer between wallets */
export function transfer(fromId: string, toId: string, amount: number, reason: string): void {
    const wallets = getWallets();
    const from = wallets.find(w => w.id === fromId);
    const to = wallets.find(w => w.id === toId);
    if (!from || !to) return;
    from.balance -= amount;
    to.balance += amount;
    saveWallets(wallets);
    const now = new Date().toISOString();
    addTransaction({ walletId: fromId, type: 'transfer_out', amount, reason, relatedWalletId: toId, relatedWalletName: to.name, date: now });
    addTransaction({ walletId: toId, type: 'transfer_in', amount, reason, relatedWalletId: fromId, relatedWalletName: from.name, date: now });
}
