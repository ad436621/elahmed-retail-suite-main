// ============================================================
// Wallets Data Layer
// ============================================================

import { STORAGE_KEYS } from '@/config';
import type { Sale } from '@/domain/types';
import { hasElectronIpc } from '@/lib/electronDataBridge';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

const WALLETS_KEY = STORAGE_KEYS.WALLETS;
const TRANSACTIONS_KEY = STORAGE_KEYS.WALLET_TRANSACTIONS;

export type TransactionType = 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out';

export interface Wallet {
  id: string;
  name: string;
  balance: number;
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

interface WalletRow {
  id: string;
  name: string;
  type?: string | null;
  balance?: number | null;
  isDefault?: number | boolean | null;
  icon?: string | null;
  color?: string | null;
  createdAt?: string | null;
}

interface SafeTransactionRow {
  id: string;
  walletId: string;
  type: TransactionType;
  subType?: string | null;
  amount?: number | null;
  description?: string | null;
  relatedId?: string | null;
  createdAt?: string | null;
}

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

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function defaultIconForType(type: string): string {
  if (type === 'bank') return '🏦';
  if (type === 'card') return '💳';
  if (type === 'transfer') return '📲';
  return '💵';
}

function normalizeWallet(row: Partial<WalletRow>): Wallet {
  const type = String(row.type ?? 'cash');
  return {
    id: String(row.id ?? crypto.randomUUID()),
    name: String(row.name ?? ''),
    balance: toNumber(row.balance),
    icon: String(row.icon ?? defaultIconForType(type)),
    color: String(row.color ?? DEFAULT_WALLETS[0].color),
    isDefault: Boolean(row.isDefault),
    createdAt: String(row.createdAt ?? new Date().toISOString()),
  };
}

function normalizeTransaction(row: Partial<SafeTransactionRow>): WalletTransaction {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    walletId: String(row.walletId ?? ''),
    type: (row.type ?? 'deposit') as TransactionType,
    subType: row.subType ? String(row.subType) : undefined,
    amount: toNumber(row.amount),
    reason: String(row.description ?? ''),
    date: String(row.createdAt ?? new Date().toISOString()),
    reference: row.relatedId ? String(row.relatedId) : undefined,
  };
}

function loadLocalWallets(): Wallet[] {
  const wallets = getStorageItem<Wallet[]>(WALLETS_KEY, []);
  if (wallets.length > 0) return wallets.map(normalizeWallet);
  setStorageItem(WALLETS_KEY, DEFAULT_WALLETS);
  return DEFAULT_WALLETS.map(normalizeWallet);
}

function saveLocalWallets(wallets: Wallet[]): void {
  setStorageItem(WALLETS_KEY, wallets.map((wallet) => ({ ...wallet, balance: 0 })));
}

function loadLocalTransactions(): WalletTransaction[] {
  return getStorageItem<WalletTransaction[]>(TRANSACTIONS_KEY, []).map(normalizeTransaction);
}

function saveLocalTransactions(transactions: WalletTransaction[]): void {
  setStorageItem(TRANSACTIONS_KEY, transactions);
}

async function readElectronWalletRows(): Promise<WalletRow[]> {
  const rows = await window.electron.ipcRenderer.invoke('db:wallets:get');
  const list = Array.isArray(rows) ? (rows as WalletRow[]) : [];
  if (list.length > 0) return list;

  await window.electron.ipcRenderer.invoke('db:wallets:add', {
    id: DEFAULT_WALLETS[0].id,
    name: DEFAULT_WALLETS[0].name,
    type: 'cash',
    balance: 0,
    isDefault: true,
    icon: DEFAULT_WALLETS[0].icon,
    color: DEFAULT_WALLETS[0].color,
    createdAt: DEFAULT_WALLETS[0].createdAt,
  });

  const nextRows = await window.electron.ipcRenderer.invoke('db:wallets:get');
  return Array.isArray(nextRows) ? (nextRows as WalletRow[]) : [];
}

async function getWalletMetadata(): Promise<Wallet[]> {
  if (hasElectronIpc()) {
    return (await readElectronWalletRows()).map(normalizeWallet);
  }

  return loadLocalWallets();
}

export async function getWallets(): Promise<Wallet[]> {
  const [wallets, transactions] = await Promise.all([getWalletMetadata(), getTransactions()]);
  const balances = new Map<string, number>();

  for (const transaction of transactions) {
    const current = balances.get(transaction.walletId) ?? 0;
    const delta = transaction.type === 'deposit' || transaction.type === 'transfer_in'
      ? transaction.amount
      : -transaction.amount;
    balances.set(transaction.walletId, current + delta);
  }

  return wallets.map((wallet) => ({
    ...wallet,
    balance: balances.get(wallet.id) ?? 0,
  }));
}

export async function addWallet(data: Omit<Wallet, 'id' | 'createdAt'>): Promise<Wallet> {
  const openingBalance = Math.max(0, toNumber(data.balance));
  const walletSeed = normalizeWallet({
    id: crypto.randomUUID(),
    name: data.name,
    icon: data.icon,
    color: data.color,
    isDefault: data.isDefault,
    balance: 0,
    createdAt: new Date().toISOString(),
  });

  let wallet = walletSeed;

  if (hasElectronIpc()) {
    const saved = await window.electron.ipcRenderer.invoke('db:wallets:add', {
      id: walletSeed.id,
      name: walletSeed.name,
      type: 'cash',
      balance: 0,
      isDefault: walletSeed.isDefault,
      icon: walletSeed.icon,
      color: walletSeed.color,
      createdAt: walletSeed.createdAt,
    });
    wallet = normalizeWallet((saved as WalletRow | undefined) ?? walletSeed);
  } else {
    saveLocalWallets([...(await getWalletMetadata()), walletSeed]);
  }

  if (openingBalance > 0) {
    await deposit(wallet.id, openingBalance, 'رصيد افتتاحي', undefined, 'opening_balance');
  }

  return { ...wallet, balance: openingBalance };
}

export async function updateWallet(id: string, data: Partial<Wallet>): Promise<void> {
  if (hasElectronIpc()) {
    await window.electron.ipcRenderer.invoke('db:wallets:update', id, {
      name: data.name,
      isDefault: data.isDefault,
      icon: data.icon,
      color: data.color,
    });
    return;
  }

  const wallets = await getWalletMetadata();
  saveLocalWallets(wallets.map((wallet) => (
    wallet.id === id ? { ...wallet, ...data, balance: 0 } : wallet
  )));
}

export async function deleteWallet(id: string): Promise<void> {
  if (hasElectronIpc()) {
    const deleted = await window.electron.ipcRenderer.invoke('db:wallets:delete', id);
    if (!deleted) {
      throw new Error('تعذر حذف المحفظة');
    }
    return;
  }

  saveLocalWallets((await getWalletMetadata()).filter((wallet) => wallet.id !== id));
  saveLocalTransactions(loadLocalTransactions().filter((transaction) => transaction.walletId !== id));
}

export async function getTotalBalance(): Promise<number> {
  const wallets = await getWallets();
  return wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
}

export async function getTransactions(walletId?: string): Promise<WalletTransaction[]> {
  if (hasElectronIpc()) {
    try {
      const rows = await window.electron.ipcRenderer.invoke('db:safe_transactions:get', walletId);
      const transactions = Array.isArray(rows) ? (rows as SafeTransactionRow[]).map(normalizeTransaction) : [];
      return walletId ? transactions.filter((transaction) => transaction.walletId === walletId) : transactions;
    } catch (error) {
      console.error('Failed to get safe transactions', error);
      return [];
    }
  }

  const transactions = loadLocalTransactions();
  return walletId ? transactions.filter((transaction) => transaction.walletId === walletId) : transactions;
}

async function addTransaction(transaction: Omit<WalletTransaction, 'id' | 'date'>): Promise<WalletTransaction> {
  if (hasElectronIpc()) {
    const saved = await window.electron.ipcRenderer.invoke('db:safe_transactions:add', {
      walletId: transaction.walletId,
      type: transaction.type,
      subType: transaction.subType ?? null,
      amount: transaction.amount,
      description: transaction.reason,
      relatedId: transaction.reference,
      affectsCapital: true,
      affectsProfit: false,
    });
    return normalizeTransaction((saved as SafeTransactionRow | undefined) ?? {
      ...transaction,
      createdAt: new Date().toISOString(),
    });
  }

  const nextTransaction: WalletTransaction = {
    ...transaction,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
  };
  saveLocalTransactions([...loadLocalTransactions(), nextTransaction]);
  return nextTransaction;
}

async function getDefaultWallet(): Promise<Wallet | undefined> {
  const wallets = await getWallets();
  return wallets.find((wallet) => wallet.isDefault) ?? wallets[0];
}

function isSaleLedgerEntry(transaction: WalletTransaction, saleId: string): boolean {
  return transaction.reference === saleId && transaction.subType?.startsWith('sale_') === true;
}

export async function recordSalePayment(
  sale: Pick<Sale, 'id' | 'invoiceNumber' | 'paymentMethod' | 'total' | 'voidedAt'>,
): Promise<void> {
  if (sale.total <= 0 || sale.voidedAt) return;

  const wallet = await getDefaultWallet();
  if (!wallet) return;

  const existing = await getTransactions(wallet.id);
  if (existing.some((transaction) => isSaleLedgerEntry(transaction, sale.id))) {
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
  if (sale.total <= 0) return;

  const wallet = await getDefaultWallet();
  if (!wallet) return;

  const existing = await getTransactions(wallet.id);
  const hasSaleEntry = existing.some((transaction) => isSaleLedgerEntry(transaction, sale.id));
  const alreadyReversed = existing.some((transaction) => transaction.reference === sale.id && transaction.subType === 'sale_void');

  if (!hasSaleEntry || alreadyReversed) return;

  await addTransaction({
    walletId: wallet.id,
    type: 'withdrawal',
    subType: 'sale_void',
    amount: sale.total,
    reason: `Void sale ${sale.invoiceNumber}`,
    reference: sale.id,
  });
}

export async function deposit(
  walletId: string,
  amount: number,
  reason: string,
  reference?: string,
  subType = 'deposit',
): Promise<void> {
  await addTransaction({ walletId, type: 'deposit', subType, amount, reason, reference });
}

export async function withdraw(
  walletId: string,
  amount: number,
  reason: string,
  reference?: string,
  subType = 'withdrawal',
): Promise<void> {
  const wallets = await getWallets();
  const wallet = wallets.find((item) => item.id === walletId);
  if (!wallet) return;
  if (amount > wallet.balance) {
    throw new Error(`رصيد المحفظة غير كافٍ. الرصيد: ${wallet.balance}، المطلوب: ${amount}`);
  }

  await addTransaction({ walletId, type: 'withdrawal', subType, amount, reason, reference });
}

export async function transfer(fromId: string, toId: string, amount: number, reason: string): Promise<void> {
  const wallets = await getWallets();
  const fromWallet = wallets.find((wallet) => wallet.id === fromId);
  const toWallet = wallets.find((wallet) => wallet.id === toId);

  if (!fromWallet || !toWallet) return;
  if (amount > fromWallet.balance) {
    throw new Error('رصيد المحفظة المحول منها غير كافٍ');
  }

  await addTransaction({
    walletId: fromId,
    type: 'transfer_out',
    subType: 'transfer',
    amount,
    reason: `${reason} (تحويل إلى ${toWallet.name})`,
  });

  await addTransaction({
    walletId: toId,
    type: 'transfer_in',
    subType: 'transfer',
    amount,
    reason: `${reason} (تحويل من ${fromWallet.name})`,
  });
}
