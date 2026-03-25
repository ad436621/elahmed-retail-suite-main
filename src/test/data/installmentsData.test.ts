import { beforeEach, describe, expect, it } from 'vitest';
import {
  addContract,
  addPaymentToContract,
  deleteContract,
  updateContract,
} from '@/data/installmentsData';
import type { InstallmentDraftInput } from '@/domain/installments';
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
});
