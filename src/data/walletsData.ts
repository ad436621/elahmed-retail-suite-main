// ============================================================
// Wallets Data Layer — Multi-wallet / treasury system (Relational DB Version)
// ============================================================

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const WALLETS_KEY = STORAGE_KEYS.WALLETS;

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
    // Ideally we should also delete all safe_transactions for this wallet from SQL, 
    // but the backend IPC handler doesn't have a delete route yet.
}

export async function getTotalBalance(): Promise<number> {
    const wallets = await getWallets();
    return wallets.reduce((sum, w) => sum + w.balance, 0);
}

// ─── Transactions ────────────────────────────────────────────

export async function getTransactions(walletId?: string): Promise<WalletTransaction[]> {
    try {
        const rows = await window.electron.ipcRenderer.invoke('db:safe_transactions:get');
        const mappedTxns: WalletTransaction[] = rows.map((r: any) => ({
            id: r.id,
            walletId: r.walletId,
            type: r.type as TransactionType,
            subType: r.subType,
            amount: r.amount,
            reason: r.description || '',
            date: r.createdAt,
            reference: r.relatedId,
            relatedWalletId: null, // Depending on subType implementation
            relatedWalletName: null,
        }));
        
        return walletId ? mappedTxns.filter(t => t.walletId === walletId) : mappedTxns;
    } catch (e) {
        console.error('Failed to get safe_transactions', e);
        return [];
    }
}

async function addTransaction(txn: Omit<WalletTransaction, 'id' | 'date'>): Promise<void> {
    await window.electron.ipcRenderer.invoke('db:safe_transactions:add', {
        walletId: txn.walletId,
        type: txn.type,
        subType: txn.subType || 'expense', // default ELOS subtype
        amount: txn.amount,
        description: txn.reason,
        relatedId: txn.reference,
        affectsCapital: true, // simplified
        affectsProfit: false
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
