// ============================================================
// Wallets Data Layer — Multi-wallet / treasury system (Relational DB Version)
// ============================================================

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';
import type { Sale } from '@/domain/types';

const WALLETS_KEY = STORAGE_KEYS.WALLETS;
const TRANSACTIONS_KEY = STORAGE_KEYS.WALLET_TRANSACTIONS;

// ─── Types ──────────────────────────────────────────────────

export type TransactionType = 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out';

export interface Wallet {
    id: string;
    name: string;
    balance: number;     // Now computed dynamically from DB
    icon: string;        
    color: string;       
    isDefault: boolean;
    createdAt: string;
}

export interface WalletTransaction {
    id: string;
    walletId: string;
    type: TransactionType;
    subType?: string;
    amount: number;
    reason: string;
    relatedWalletId?: string;
    relatedWalletName?: string;
    date: string;
    reference?: string;
}

function hasElectronIpc(): boolean {
    return typeof window !== 'undefined' && !!window.electron?.ipcRenderer;
}

function loadLocalTransactions(): WalletTransaction[] {
    return getStorageItem<WalletTransaction[]>(TRANSACTIONS_KEY, []);
}

function saveLocalTransactions(transactions: WalletTransaction[]): void {
    setStorageItem(TRANSACTIONS_KEY, transactions);
}

function buildLocalTransaction(txn: Omit<WalletTransaction, 'id' | 'date'>): WalletTransaction {
    return {
        ...txn,
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
    };
}

function mapElectronRow(row: Record<string, unknown>): WalletTransaction {
    return {
        id: String(row.id ?? crypto.randomUUID()),
        walletId: String(row.walletId ?? ''),
        type: row.type as TransactionType,
        subType: row.subType ? String(row.subType) : undefined,
        amount: Number(row.amount ?? 0),
        reason: String(row.description ?? ''),
        date: String(row.createdAt ?? new Date().toISOString()),
        reference: row.relatedId ? String(row.relatedId) : undefined,
        relatedWalletId: row.relatedWalletId ? String(row.relatedWalletId) : undefined,
        relatedWalletName: row.relatedWalletName ? String(row.relatedWalletName) : undefined,
    };
}

// ─── Default wallets ────────────────────────────────────────

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

// Keep wallet METADATA in local storage for now, but balances are computed from DB.
export async function getWallets(): Promise<Wallet[]> {
    const stored = getStorageItem<Wallet[]>(WALLETS_KEY, []);
    let wallets = stored.length === 0 ? DEFAULT_WALLETS : stored;
    
    if (stored.length === 0) {
        setStorageItem(WALLETS_KEY, wallets);
    }

    // Fetch all transactions from the relational DB
    const txns = await getTransactions();
    
    // Compute true balance from the ledger
    return wallets.map(w => {
        let balance = 0;
        const wTxns = txns.filter(t => t.walletId === w.id);
        wTxns.forEach(t => {
            if (t.type === 'deposit' || t.type === 'transfer_in') balance += t.amount;
            if (t.type === 'withdrawal' || t.type === 'transfer_out') balance -= t.amount;
        });
        return { ...w, balance };
    });
}

function saveWalletsMetadata(wallets: Wallet[]): void {
    const metaOnly = wallets.map(w => ({ ...w, balance: 0 })); // Don't persist balance locally
    setStorageItem(WALLETS_KEY, metaOnly);
}

export async function addWallet(data: Omit<Wallet, 'id' | 'createdAt'>): Promise<Wallet> {
    const wallet: Wallet = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    const current = await getWallets();
    saveWalletsMetadata([...current, wallet]);
    
    // If they specified an opening balance
    if (wallet.balance > 0) {
        await deposit(wallet.id, wallet.balance, 'رصيد افتتاحي', undefined, 'opening_balance');
    }
    
    return wallet;
}

export async function updateWallet(id: string, data: Partial<Wallet>): Promise<void> {
    const current = await getWallets();
    saveWalletsMetadata(current.map(w => w.id === id ? { ...w, ...data } : w));
}

export async function deleteWallet(id: string): Promise<void> {
    const current = await getWallets();
    saveWalletsMetadata(current.filter(w => w.id !== id));
    if (!hasElectronIpc()) {
        saveLocalTransactions(loadLocalTransactions().filter(txn => txn.walletId !== id));
    }
}

export async function getTotalBalance(): Promise<number> {
    const wallets = await getWallets();
    return wallets.reduce((sum, w) => sum + w.balance, 0);
}

// ─── Transactions ────────────────────────────────────────────

export async function getTransactions(walletId?: string): Promise<WalletTransaction[]> {
    try {
        const mappedTxns = hasElectronIpc()
            ? (await window.electron.ipcRenderer.invoke('db:safe_transactions:get') as Record<string, unknown>[])
                .map(mapElectronRow)
            : loadLocalTransactions();

        return walletId ? mappedTxns.filter(t => t.walletId === walletId) : mappedTxns;
    } catch (e) {
        console.error('Failed to get safe_transactions', e);
        return [];
    }
}

async function addTransaction(txn: Omit<WalletTransaction, 'id' | 'date'>): Promise<WalletTransaction> {
    if (hasElectronIpc()) {
        await window.electron.ipcRenderer.invoke('db:safe_transactions:add', {
            walletId: txn.walletId,
            type: txn.type,
            subType: txn.subType || 'expense',
            amount: txn.amount,
            description: txn.reason,
            relatedId: txn.reference,
            affectsCapital: true,
            affectsProfit: false,
        });

        return {
            ...txn,
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
        };
    }

    const nextTxn = buildLocalTransaction(txn);
    saveLocalTransactions([...loadLocalTransactions(), nextTxn]);
    return nextTxn;
}

async function getDefaultWallet(): Promise<Wallet | undefined> {
    const wallets = await getWallets();
    return wallets.find(wallet => wallet.isDefault) ?? wallets[0];
}

function isSaleLedgerEntry(txn: WalletTransaction, saleId: string): boolean {
    return txn.reference === saleId && txn.subType?.startsWith('sale_') === true;
}

export async function recordSalePayment(sale: Pick<Sale, 'id' | 'invoiceNumber' | 'paymentMethod' | 'total' | 'voidedAt'>): Promise<void> {
    if (sale.total <= 0 || sale.voidedAt) {
        return;
    }

    const wallet = await getDefaultWallet();
    if (!wallet) {
        return;
    }

    const existing = await getTransactions();
    if (existing.some(txn => isSaleLedgerEntry(txn, sale.id))) {
        return;
    }

    await addTransaction({
        walletId: wallet.id,
        type: 'deposit',
        subType: `sale_${sale.paymentMethod}`,
        amount: sale.total,
        reason: `Sale ${sale.invoiceNumber}`,
        reference: sale.id,
    });
}

export async function reverseSalePayment(sale: Pick<Sale, 'id' | 'invoiceNumber' | 'total'>): Promise<void> {
    if (sale.total <= 0) {
        return;
    }

    const wallet = await getDefaultWallet();
    if (!wallet) {
        return;
    }

    const existing = await getTransactions();
    const hasSaleEntry = existing.some(txn => isSaleLedgerEntry(txn, sale.id));
    const alreadyReversed = existing.some(txn => txn.reference === sale.id && txn.subType === 'sale_void');

    if (!hasSaleEntry || alreadyReversed) {
        return;
    }

    await addTransaction({
        walletId: wallet.id,
        type: 'withdrawal',
        subType: 'sale_void',
        amount: sale.total,
        reason: `Void sale ${sale.invoiceNumber}`,
        reference: sale.id,
    });
}

// ─── Operations ─────────────────────────────────────────────

export async function deposit(walletId: string, amount: number, reason: string, reference?: string, subType: string = 'deposit'): Promise<void> {
    await addTransaction({ walletId, type: 'deposit', subType, amount, reason, reference });
}

export async function withdraw(walletId: string, amount: number, reason: string, reference?: string, subType: string = 'withdrawal'): Promise<void> {
    const wallets = await getWallets();
    const w = wallets.find(w => w.id === walletId);
    if (!w) return;
    if (amount > w.balance) {
        throw new Error(`رصيد المحفظة غير كافٍ. الرصيد: ${w.balance}، المطلوب: ${amount}`);
    }
    await addTransaction({ walletId, type: 'withdrawal', subType, amount, reason, reference });
}

export async function transfer(fromId: string, toId: string, amount: number, reason: string): Promise<void> {
    const wallets = await getWallets();
    const from = wallets.find(w => w.id === fromId);
    const to = wallets.find(w => w.id === toId);
    if (!from || !to) return;
    if (amount > from.balance) throw new Error('رصيد المحفظة المحول منها غير كافٍ');
    
    // Add two entries into the ledger
    await addTransaction({ walletId: fromId, type: 'transfer_out', subType: 'transfer', amount, reason: `${reason} (تحويل إلى ${to.name})` });
    await addTransaction({ walletId: toId, type: 'transfer_in', subType: 'transfer', amount, reason: `${reason} (تحويل من ${from.name})` });
}
