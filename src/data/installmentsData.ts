// ============================================================
// Installment Contracts - Data Layer
// ============================================================

import type { InstallmentContract, InstallmentPayment } from '@/domain/types';
import {
  applyPaymentToSchedule,
  buildContractFromDraft,
  getDefaultFirstInstallmentDate,
  getPaymentsTotal,
  normalizeContract,
  type InstallmentDraftInput,
} from '@/domain/installments';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const KEY = STORAGE_KEYS.INSTALLMENTS;
const SEQUENCE_KEY = `${KEY}_sequence`;

function hasElectronInstallmentsDb(): boolean {
  return typeof window !== 'undefined' && !!window.electron?.ipcRenderer;
}

function readContracts(): InstallmentContract[] {
  if (hasElectronInstallmentsDb()) {
    try {
      const contracts = window.electron.ipcRenderer.sendSync('db:installments:get');
      if (Array.isArray(contracts)) {
        return contracts as InstallmentContract[];
      }
    } catch {
      // Fall back to legacy storage below.
    }
  }

  return getStorageItem<InstallmentContract[]>(KEY, []);
}

export function getContracts(): InstallmentContract[] {
  return readContracts().map(normalizeContract);
}

export function saveContracts(contracts: InstallmentContract[]): void {
  const normalized = contracts.map(normalizeContract);

  if (hasElectronInstallmentsDb()) {
    try {
      window.electron.ipcRenderer.sendSync('db:installments:replaceAll', normalized);
      return;
    } catch {
      // Fall back to legacy storage below.
    }
  }

  setStorageItem(KEY, normalized);
}

function getNextContractSequence(contracts: InstallmentContract[]): number {
  const storedSequence = getStorageItem<number>(SEQUENCE_KEY, 0);
  const scannedSequence = contracts.reduce((max, contract) => {
    const match = /^INS-(\d+)$/.exec(contract.contractNumber || '');
    const sequence = match ? Number(match[1]) : 0;
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  const nextSequence = Math.max(storedSequence, scannedSequence) + 1;
  setStorageItem(SEQUENCE_KEY, nextSequence);
  return nextSequence;
}

export function addContract(input: InstallmentDraftInput): InstallmentContract {
  const all = getContracts();
  const nextSequence = getNextContractSequence(all);
  const contract = buildContractFromDraft(input, {
    id: crypto.randomUUID(),
    contractNumber: `INS-${nextSequence.toString().padStart(4, '0')}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  saveContracts([...all, contract]);
  return contract;
}

export function updateContract(id: string, updates: Partial<InstallmentContract>): InstallmentContract | null {
  const all = getContracts();
  const current = all.find((item) => item.id === id);
  if (!current) return null;

  const next = buildContractFromDraft(
    {
      contractType: updates.contractType ?? current.contractType,
      customerName: updates.customerName ?? current.customerName,
      customerIdCard: updates.customerIdCard ?? current.customerIdCard,
      guarantorName: updates.guarantorName ?? current.guarantorName,
      guarantorIdCard: updates.guarantorIdCard ?? current.guarantorIdCard,
      guarantorPhone: updates.guarantorPhone ?? current.guarantorPhone,
      guarantorAddress: updates.guarantorAddress ?? current.guarantorAddress,
      customerPhone: updates.customerPhone ?? current.customerPhone,
      customerAddress: updates.customerAddress ?? current.customerAddress,
      productName: updates.productName ?? current.productName,
      productId: updates.productId ?? current.productId,
      transferType: updates.transferType ?? current.transferType,
      cashPrice: updates.cashPrice ?? current.cashPrice,
      installmentPrice: updates.installmentPrice ?? current.installmentPrice,
      downPayment: updates.downPayment ?? current.downPayment,
      months: updates.months ?? current.months,
      firstInstallmentDate: updates.firstInstallmentDate ?? current.firstInstallmentDate ?? getDefaultFirstInstallmentDate(),
      notes: updates.notes ?? current.notes,
      customFields: updates.customFields ?? current.customFields,
      schedule: updates.schedule ?? current.schedule,
    },
    {
      id: current.id,
      contractNumber: current.contractNumber,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    },
    updates.payments ?? current.payments,
  );

  saveContracts(all.map((item) => (item.id === id ? next : item)));
  return next;
}

export function addPaymentToContract(contractId: string, payment: Omit<InstallmentPayment, 'id' | 'allocations'>): InstallmentContract | null {
  const all = getContracts();
  const current = all.find((item) => item.id === contractId);
  if (!current) return null;

  const allocation = applyPaymentToSchedule(current.schedule, payment.amount);
  const nextPayment: InstallmentPayment = {
    id: crypto.randomUUID(),
    amount: payment.amount,
    date: payment.date,
    note: payment.note,
    allocations: allocation.allocations,
  };

  const updated = normalizeContract({
    ...current,
    schedule: allocation.schedule,
    payments: [...current.payments, nextPayment],
    paidTotal: current.downPayment + getPaymentsTotal([...current.payments, nextPayment]),
    updatedAt: new Date().toISOString(),
  });

  saveContracts(all.map((item) => (item.id === contractId ? updated : item)));
  return updated;
}

export function deleteContract(id: string): void {
  saveContracts(getContracts().filter((contract) => contract.id !== id));
}

export function payInstallment(contractId: string, month: number, paymentAmount: number): InstallmentContract | null {
  return addPaymentToContract(contractId, {
    amount: paymentAmount,
    date: new Date().toISOString().slice(0, 10),
    note: `دفعة للقسط رقم ${month}`,
  });
}

export function addPenaltyToInstallment(contractId: string, month: number, penaltyAmount: number): InstallmentContract | null {
  const all = getContracts();
  const current = all.find((item) => item.id === contractId);
  if (!current) return null;

  const schedule = current.schedule.map((item) =>
    item.month === month
      ? { ...item, penalty: Math.max(0, (item.penalty || 0) + penaltyAmount), paid: false }
      : item,
  );

  return updateContract(contractId, { schedule });
}

export function settleContractEarly(contractId: string, discount: number): InstallmentContract | null {
  const all = getContracts();
  const current = all.find((item) => item.id === contractId);
  if (!current) return null;

  const finalAmount = Math.max(0, current.remaining - Math.max(0, discount));
  const updated = finalAmount > 0
    ? addPaymentToContract(contractId, {
        amount: finalAmount,
        date: new Date().toISOString().slice(0, 10),
        note: `سداد مبكر بخصم ${discount}`,
      })
    : current;

  if (!updated) return null;

  const settled = normalizeContract({
    ...updated,
    settledEarly: true,
    settlementDiscount: discount,
    status: 'completed',
    updatedAt: new Date().toISOString(),
  });

  saveContracts(all.map((item) => (item.id === contractId ? settled : item)));
  return settled;
}
