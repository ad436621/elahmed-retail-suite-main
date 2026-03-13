// ============================================================
// Installment Contracts — Data Layer
// ============================================================

import { InstallmentContract, InstallmentPayment, InstallmentScheduleItem } from '@/domain/types';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const KEY = STORAGE_KEYS.INSTALLMENTS;

export function getContracts(): InstallmentContract[] {
    return getStorageItem<InstallmentContract[]>(KEY, []);
}

export function saveContracts(contracts: InstallmentContract[]): void {
    setStorageItem(KEY, contracts);
}

/** Generate monthly schedule starting from a specific date */
function generateSchedule(remaining: number, months: number, startDate: string): InstallmentScheduleItem[] {
    if (months <= 0 || remaining <= 0) return [];

    // Calculate base monthly payment (floor to avoid overcharging)
    const baseMonthly = Math.floor(remaining / months);
    // Calculate remainder that needs to be distributed
    const remainder = remaining - (baseMonthly * months);

    const items: InstallmentScheduleItem[] = [];
    const start = new Date(startDate);

    for (let i = 1; i <= months; i++) {
        // Increment month for each installment based on start date
        const due = new Date(start.getFullYear(), start.getMonth() + (i - 1), start.getDate());
        // First 'remainder' months get +1 to handle the rounding difference
        const monthAmount = baseMonthly + (i <= remainder ? 1 : 0);
        items.push({
            month: i,
            dueDate: due.toISOString().slice(0, 10),
            amount: monthAmount,
            paidAmount: 0,
            penalty: 0,
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

    // Determine start date (default to 1 month from today if not provided)
    let startDate = contract.firstInstallmentDate;
    if (!startDate) {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        startDate = nextMonth.toISOString().slice(0, 10);
    }

    // Generate schedule with accurate distribution
    const schedule = generateSchedule(remaining, contract.months, startDate);

    const newContract: InstallmentContract = {
        guarantorPhone: '',
        guarantorAddress: '',
        firstInstallmentDate: startDate,
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

/** Pay a specific amount towards a monthly schedule item */
export function payInstallment(contractId: string, month: number, paymentAmount: number): void {
    const all = getContracts();
    saveContracts(all.map(c => {
        if (c.id !== contractId) return c;
        const scheduleItem = c.schedule.find(s => s.month === month);
        if (!scheduleItem || scheduleItem.paid) return c; // already paid or not found

        const newPaidAmount = scheduleItem.paidAmount + paymentAmount;
        const totalRequired = scheduleItem.amount + scheduleItem.penalty;
        const isFullyPaid = newPaidAmount >= totalRequired;

        // Update schedule item
        const updatedSchedule = c.schedule.map(s =>
            s.month === month ? { ...s, paidAmount: newPaidAmount, paid: isFullyPaid } : s
        );

        // Auto-record payment entry
        const newPayment: InstallmentPayment = {
            id: crypto.randomUUID(),
            amount: paymentAmount,
            date: new Date().toISOString().slice(0, 10),
            note: `دفعة لقسط الشهر ${month}${isFullyPaid ? ' (سداد كامل)' : ' (جزء من القسط)'}`,
        };
        const paidTotal = c.paidTotal + paymentAmount;
        // Remaining should account for penalties too, we recalculate it accurately
        const totalExpected = c.installmentPrice + c.schedule.reduce((acc, s) => acc + (s.penalty || 0), 0);
        const remaining = Math.max(0, totalExpected - paidTotal);

        return {
            ...c,
            schedule: updatedSchedule,
            payments: [...c.payments, newPayment],
            paidTotal,
            remaining,
            status: remaining === 0 ? 'completed' : c.status,
            updatedAt: new Date().toISOString(),
        };
    }));
}

/** Add a penalty/late fee to a specific month */
export function addPenaltyToInstallment(contractId: string, month: number, penaltyAmount: number): void {
    const all = getContracts();
    saveContracts(all.map(c => {
        if (c.id !== contractId) return c;
        const updatedSchedule = c.schedule.map(s =>
            s.month === month ? { ...s, penalty: (s.penalty || 0) + penaltyAmount, paid: false } : s
        );
        const totalExpected = c.installmentPrice + updatedSchedule.reduce((acc, s) => acc + (s.penalty || 0), 0);
        const remaining = Math.max(0, totalExpected - c.paidTotal);
        
        return { ...c, schedule: updatedSchedule, remaining, status: 'active', updatedAt: new Date().toISOString() };
    }));
}

/** Settle a contract early with a discount on the remaining amount */
export function settleContractEarly(contractId: string, discount: number): void {
    const all = getContracts();
    saveContracts(all.map(c => {
        if (c.id !== contractId) return c;
        
        const finalPaymentAmount = Math.max(0, c.remaining - discount);
        
        // Auto-record final settlement payment if > 0
        const payments = [...c.payments];
        if (finalPaymentAmount > 0) {
            payments.push({
                id: crypto.randomUUID(),
                amount: finalPaymentAmount,
                date: new Date().toISOString().slice(0, 10),
                note: `سداد مبكر (خصم ${discount} ج.م)`,
            });
        }

        // Mark all remaining schedule items as paid
        const updatedSchedule = c.schedule.map(s => ({ ...s, paid: true }));

        return {
            ...c,
            schedule: updatedSchedule,
            payments,
            paidTotal: c.paidTotal + finalPaymentAmount,
            remaining: 0,
            status: 'completed',
            settledEarly: true,
            settlementDiscount: discount,
            updatedAt: new Date().toISOString(),
        };
    }));
}

