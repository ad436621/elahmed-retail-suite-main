// ============================================================
// Partners Data Layer
// ============================================================

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

const PAR_KEY = 'gx_partners';
const TXN_KEY = 'gx_partner_transactions';

function genId(prefix: string) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Types ──────────────────────────────────────────────────

export interface Partner {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    sharePercentage: number;          // 0–100
    partnershipType: 'silent' | 'active';
    investmentAmount: number;
    totalWithdrawals: number;
    status: 'active' | 'inactive';
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface PartnerTransaction {
    id: string;
    partnerId: string;
    partnerName: string;
    type: 'deposit' | 'withdrawal' | 'profit_distribution';
    amount: number;
    description?: string;
    createdBy: string;
    createdAt: string;
}

// ─── CRUD ────────────────────────────────────────────────────

export function getPartners(): Partner[] {
    return getStorageItem<Partner[]>(PAR_KEY, []);
}

function savePartners(partners: Partner[]): void {
    setStorageItem(PAR_KEY, partners);
}

export function addPartner(data: Omit<Partner, 'id' | 'totalWithdrawals' | 'createdAt' | 'updatedAt'>): Partner {
    const p: Partner = {
        ...data,
        id: genId('par'),
        totalWithdrawals: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    savePartners([...getPartners(), p]);
    return p;
}

export function updatePartner(id: string, data: Partial<Partner>): void {
    savePartners(getPartners().map(p => p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p));
}

export function deletePartner(id: string): void {
    savePartners(getPartners().filter(p => p.id !== id));
}

// ─── Transactions ─────────────────────────────────────────────

export function getPartnerTransactions(partnerId?: string): PartnerTransaction[] {
    const all = getStorageItem<PartnerTransaction[]>(TXN_KEY, []);
    return partnerId ? all.filter(t => t.partnerId === partnerId) : all;
}

export function addPartnerTransaction(data: Omit<PartnerTransaction, 'id'>): PartnerTransaction {
    const txn: PartnerTransaction = { ...data, id: genId('ptxn') };
    const all = getStorageItem<PartnerTransaction[]>(TXN_KEY, []);
    setStorageItem(TXN_KEY, [...all, txn]);

    // Update totalWithdrawals for partner if withdrawal
    if (data.type === 'withdrawal') {
        const partners = getPartners();
        savePartners(partners.map(p => p.id === data.partnerId
            ? { ...p, totalWithdrawals: p.totalWithdrawals + data.amount, updatedAt: new Date().toISOString() }
            : p
        ));
    }
    return txn;
}

export function getTotalInvestment(): number {
    return getPartners().reduce((sum, p) => sum + p.investmentAmount, 0);
}

export function getTotalWithdrawals(): number {
    return getPartners().reduce((sum, p) => sum + p.totalWithdrawals, 0);
}
