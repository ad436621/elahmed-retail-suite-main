// ============================================================
// Installment Contracts — Data Layer
// ============================================================

import { InstallmentContract, InstallmentPayment, InstallmentScheduleItem } from '@/domain/types';

const KEY = 'gx_installments_v2';

export function getContracts(): InstallmentContract[] {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function saveContracts(contracts: InstallmentContract[]): void {
    localStorage.setItem(KEY, JSON.stringify(contracts));
}

/** Generate monthly schedule starting from next month */
function generateSchedule(remaining: number, months: number): InstallmentScheduleItem[] {
    const monthly = months > 0 ? Math.ceil(remaining / months) : remaining;
    const items: InstallmentScheduleItem[] = [];
    const now = new Date();
    for (let i = 1; i <= months; i++) {
        const due = new Date(now.getFullYear(), now.getMonth() + i, 1);
        items.push({
            month: i,
            dueDate: due.toISOString().slice(0, 10),
            amount: i === months ? remaining - monthly * (months - 1) : monthly,
            paid: false,
        });
    }
    return items;
}

export function addContract(
    contract: Omit<InstallmentContract, 'id' | 'contractNumber' | 'monthlyInstallment' | 'schedule' | 'payments' | 'paidTotal' | 'remaining' | 'status' | 'createdAt' | 'updatedAt'>
): InstallmentContract {
    const all = getContracts();
    const remaining = contract.installmentPrice - contract.downPayment;
    const monthly = contract.months > 0 ? Math.ceil(remaining / contract.months) : remaining;
    const schedule = generateSchedule(remaining, contract.months);

    const newContract: InstallmentContract = {
        ...contract,
        id: crypto.randomUUID(),
        contractNumber: `INS-${(all.length + 1).toString().padStart(4, '0')}`,
        monthlyInstallment: monthly,
        schedule,
        payments: [],
        paidTotal: contract.downPayment,
        remaining,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveContracts([...all, newContract]);
    return newContract;
}

export function addPaymentToContract(contractId: string, payment: Omit<InstallmentPayment, 'id'>): void {
    const all = getContracts();
    saveContracts(all.map(c => {
        if (c.id !== contractId) return c;
        const newPayment: InstallmentPayment = { ...payment, id: crypto.randomUUID() };
        const paidTotal = c.paidTotal + payment.amount;
        const remaining = Math.max(0, c.installmentPrice - paidTotal);
        return {
            ...c,
            payments: [...c.payments, newPayment],
            paidTotal,
            remaining,
            status: remaining === 0 ? 'completed' : 'active',
            updatedAt: new Date().toISOString(),
        };
    }));
}

export function deleteContract(id: string): void {
    saveContracts(getContracts().filter(c => c.id !== id));
}

export function updateContract(id: string, updates: Partial<InstallmentContract>): void {
    saveContracts(getContracts().map(c =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    ));
}
