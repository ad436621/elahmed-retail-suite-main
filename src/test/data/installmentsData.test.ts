import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addContract,
  addPaymentToContract,
  deleteContract,
  getContracts,
  saveContracts,
  updateContract,
} from '@/data/installmentsData';
import { buildContractFromDraft, type InstallmentDraftInput } from '@/domain/installments';
import type { InstallmentScheduleItem } from '@/domain/types';

function makeDraft(overrides: Partial<InstallmentDraftInput> = {}): InstallmentDraftInput {
  return {
    contractType: 'product',
    customerName: 'Ahmed',
    customerIdCard: '29801011234567',
    guarantorName: 'Mahmoud',
    guarantorIdCard: '29001011234567',
    guarantorPhone: '01000000001',
    guarantorAddress: 'Cairo',
    customerPhone: '01000000000',
    customerAddress: 'Giza',
    productName: 'Galaxy S24',
    cashPrice: 1000,
    installmentPrice: 1200,
    downPayment: 200,
    months: 2,
    firstInstallmentDate: '2026-01-01',
    notes: '',
    customFields: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  delete (window as typeof window & { electron?: unknown }).electron;
});

describe('installmentsData', () => {
  it('keeps contract numbers monotonic even after deletions', () => {
    const first = addContract(makeDraft({ productName: 'Phone 1' }));
    const second = addContract(makeDraft({ productName: 'Phone 2' }));

    deleteContract(second.id);

    const third = addContract(makeDraft({ productName: 'Phone 3' }));

    expect(first.contractNumber).toBe('INS-0001');
    expect(second.contractNumber).toBe('INS-0002');
    expect(third.contractNumber).toBe('INS-0003');
  });

  it('replays existing payments onto an updated schedule', () => {
    const contract = addContract(
      makeDraft({
        downPayment: 0,
        installmentPrice: 300,
        cashPrice: 300,
        months: 3,
      }),
    );

    const paid = addPaymentToContract(contract.id, {
      amount: 100,
      date: '2026-01-10',
      note: 'دفعة أولى',
    });

    expect(paid?.schedule[0].paidAmount).toBe(100);

    const rebuiltSchedule: InstallmentScheduleItem[] = [
      {
        id: 'row-1',
        month: 1,
        dueDate: '2026-01-01',
        amount: 150,
        paidAmount: 0,
        penalty: 0,
        paid: false,
        remainingAfter: 150,
        note: '',
      },
      {
        id: 'row-2',
        month: 2,
        dueDate: '2026-02-01',
        amount: 150,
        paidAmount: 0,
        penalty: 0,
        paid: false,
        remainingAfter: 0,
        note: '',
      },
    ];

    const updated = updateContract(contract.id, {
      months: 2,
      schedule: rebuiltSchedule,
    });

    expect(updated).not.toBeNull();
    expect(updated?.schedule[0].paidAmount).toBe(100);
    expect(updated?.schedule[0].paid).toBe(false);
    expect(updated?.schedule[1].paidAmount).toBe(0);
    expect(updated?.payments[0].allocations).toEqual([{ scheduleItemId: 'row-1', amount: 100 }]);
    expect(updated?.remaining).toBe(200);
  });

  it('reads contracts from Electron relational storage when ipc is available', () => {
    const contract = buildContractFromDraft(makeDraft(), {
      id: 'electron-contract',
      contractNumber: 'INS-0001',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const sendSync = vi.fn((channel: string) => (channel === 'db:installments:get' ? [contract] : null));

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const contracts = getContracts();

    expect(sendSync).toHaveBeenCalledWith('db:installments:get');
    expect(contracts).toHaveLength(1);
    expect(contracts[0].id).toBe('electron-contract');
  });

  it('saves normalized contracts through Electron relational storage when ipc is available', () => {
    const contract = buildContractFromDraft(makeDraft(), {
      id: 'electron-save',
      contractNumber: 'INS-0002',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const sendSync = vi.fn(() => []);

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    saveContracts([contract]);

    expect(sendSync).toHaveBeenCalledTimes(1);
    expect(sendSync).toHaveBeenCalledWith('db:installments:replaceAll', expect.any(Array));
    const payload = sendSync.mock.calls[0][1];
    expect(Array.isArray(payload)).toBe(true);
    expect(payload[0].contractNumber).toBe('INS-0002');
    expect(payload[0].remaining).toBe(1000);
  });
});
