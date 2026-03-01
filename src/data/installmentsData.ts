// ============================================================
// Installment Contracts — Data Layer
// ============================================================

import { InstallmentContract, InstallmentPayment, InstallmentScheduleItem } from '@/domain/types';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

const KEY = 'gx_installments_v2';

export function getContracts(): InstallmentContract[] {
    return getStorageItem<InstallmentContract[]>(KEY, []);
}

export function saveContracts(contracts: InstallmentContract[]): void {
    setStorageItem(KEY, contracts);
}

/** Generate monthly schedule starting from next month */
function generateSchedule(remaining: number, months: number): InstallmentScheduleItem[] {
    if (months <= 0 || remaining <= 0) return [];

    // Calculate base monthly payment (floor to avoid overcharging)
    const baseMonthly = Math.floor(remaining / months);
    // Calculate remainder that needs to be distributed
    const remainder = remaining - (baseMonthly * months);

    const items: InstallmentScheduleItem[] = [];
    const now = new Date();

    for (let i = 1; i <= months; i++) {
        const due = new Date(now.getFullYear(), now.getMonth() + i, 1);
        // First 'remainder' months get +1 to handle the rounding difference
        const monthAmount = baseMonthly + (i <= remainder ? 1 : 0);
        items.push({
            month: i,
            dueDate: due.toISOString().slice(0, 10),
            amount: monthAmount,
            paid: false,
        });
    }

    return items;
}

export function addContract(
    contract: Omit<InstallmentContract, 'id' | 'contractNumber' | 'monthlyInstallment' | 'schedule' | 'payments' | 'paidTotal' | 'remaining' | 'status' | 'createdAt' | 'updatedAt'>
): InstallmentContract {
    const all = getContracts();

    // Calculate remaining after down payment
    const remaining = contract.installmentPrice - contract.downPayment;

    // Calculate monthly installment (floor to avoid overcharging)
    const monthly = contract.months > 0 ? Math.floor(remaining / contract.months) : remaining;

    // Generate schedule with accurate distribution
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
