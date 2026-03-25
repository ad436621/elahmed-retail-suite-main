import type {
  InstallmentContract,
  InstallmentCustomField,
  InstallmentPayment,
  InstallmentScheduleItem,
} from '@/domain/types';

export interface InstallmentDraftInput {
  contractType?: 'product' | 'transfer' | 'car';
  customerName: string;
  customerIdCard: string;
  guarantorName: string;
  guarantorIdCard: string;
  guarantorPhone?: string;
  guarantorAddress?: string;
  customerPhone: string;
  customerAddress: string;
  productName: string;
  productId?: string;
  transferType?: string;
  cashPrice: number;
  installmentPrice: number;
  downPayment: number;
  months: number;
  firstInstallmentDate?: string;
  notes?: string;
  customFields?: InstallmentCustomField[];
  schedule?: InstallmentScheduleItem[];
}

function toCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value * 100) / 100);
}

function addMonths(date: string, offset: number): string {
  const source = new Date(date);
  const next = new Date(source.getFullYear(), source.getMonth() + offset, source.getDate());
  return next.toISOString().slice(0, 10);
}

export function getDefaultFirstInstallmentDate(): string {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  return nextMonth.toISOString().slice(0, 10);
}

export function getFinancedAmount(installmentPrice: number, downPayment: number): number {
  return toCurrency(Math.max(0, installmentPrice - downPayment));
}

export function generateInstallmentSchedule(total: number, months: number, firstInstallmentDate: string): InstallmentScheduleItem[] {
  const financed = toCurrency(total);
  if (months <= 0 || financed <= 0) return [];

  const totalPiasters = Math.round(financed * 100);
  const base = Math.floor(totalPiasters / months);
  let remainder = totalPiasters - base * months;
  let runningRemaining = financed;

  return Array.from({ length: months }, (_, index) => {
    const rowTotal = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    const amount = toCurrency(rowTotal / 100);
    runningRemaining = toCurrency(runningRemaining - amount);

    return {
      id: crypto.randomUUID(),
      month: index + 1,
      dueDate: addMonths(firstInstallmentDate, index),
      amount,
      paidAmount: 0,
      penalty: 0,
      paid: false,
      remainingAfter: runningRemaining,
      note: '',
    };
  });
}

export function normalizeSchedule(schedule: InstallmentScheduleItem[], financedAmount: number): InstallmentScheduleItem[] {
  let runningRemaining = toCurrency(financedAmount);

  return schedule.map((item, index) => {
    const amount = toCurrency(item.amount);
    const penalty = toCurrency(item.penalty || 0);
    const paidAmount = toCurrency(item.paidAmount || 0);
    const totalDue = toCurrency(amount + penalty);
    runningRemaining = toCurrency(runningRemaining - amount);

    return {
      ...item,
      id: item.id || crypto.randomUUID(),
      month: index + 1,
      amount,
      penalty,
      paidAmount,
      paid: paidAmount >= totalDue && totalDue > 0,
      remainingAfter: Math.max(0, runningRemaining),
      note: item.note || '',
    };
  });
}

export function getScheduleTotal(schedule: InstallmentScheduleItem[]): number {
  return toCurrency(schedule.reduce((sum, item) => sum + item.amount + (item.penalty || 0), 0));
}

export function getPaymentsTotal(payments: InstallmentPayment[]): number {
  return toCurrency(payments.reduce((sum, payment) => sum + payment.amount, 0));
}

export function applyPaymentToSchedule(schedule: InstallmentScheduleItem[], amount: number) {
  let remainingPayment = toCurrency(amount);
  const allocations: NonNullable<InstallmentPayment['allocations']> = [];

  const updated = schedule.map((item) => {
    const totalDue = toCurrency(item.amount + (item.penalty || 0));
    const outstanding = toCurrency(totalDue - (item.paidAmount || 0));
    if (remainingPayment <= 0 || outstanding <= 0) {
      return { ...item, paid: (item.paidAmount || 0) >= totalDue && totalDue > 0 };
    }

    const applied = toCurrency(Math.min(outstanding, remainingPayment));
    remainingPayment = toCurrency(remainingPayment - applied);
    const paidAmount = toCurrency((item.paidAmount || 0) + applied);
    allocations.push({ scheduleItemId: item.id || '', amount: applied });

    return {
      ...item,
      paidAmount,
      paid: paidAmount >= totalDue && totalDue > 0,
    };
  });

  return {
    schedule: updated,
    allocations,
    appliedAmount: toCurrency(amount - remainingPayment),
    unappliedAmount: remainingPayment,
  };
}

export function normalizeContract(contract: InstallmentContract): InstallmentContract {
  const financedAmount = getFinancedAmount(contract.installmentPrice, contract.downPayment);
  const schedule = normalizeSchedule(contract.schedule || [], financedAmount);
  const totalDue = getScheduleTotal(schedule);
  const payments = contract.payments || [];
  const paidTotal = toCurrency(contract.downPayment + getPaymentsTotal(payments));
  const remaining = toCurrency(Math.max(0, totalDue - getPaymentsTotal(payments)));
  const monthlyInstallment = schedule.length > 0 ? toCurrency(totalDue / schedule.length) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const hasOverdue = remaining > 0 && schedule.some((item) => !item.paid && item.dueDate < today);

  return {
    ...contract,
    contractType: contract.contractType || 'product',
    guarantorPhone: contract.guarantorPhone || '',
    guarantorAddress: contract.guarantorAddress || '',
    firstInstallmentDate: contract.firstInstallmentDate || schedule[0]?.dueDate || getDefaultFirstInstallmentDate(),
    schedule,
    payments,
    paidTotal,
    remaining,
    monthlyInstallment,
    customFields: contract.customFields || [],
    status: remaining === 0 ? 'completed' : hasOverdue ? 'overdue' : 'active',
  };
}

export function buildContractFromDraft(
  input: InstallmentDraftInput,
  meta: Pick<InstallmentContract, 'id' | 'contractNumber' | 'createdAt' | 'updatedAt'>,
  existingPayments: InstallmentPayment[] = [],
): InstallmentContract {
  const firstInstallmentDate = input.firstInstallmentDate || getDefaultFirstInstallmentDate();
  const financedAmount = getFinancedAmount(input.installmentPrice, input.downPayment);
  const draftSchedule = input.schedule?.length
    ? input.schedule
    : generateInstallmentSchedule(financedAmount, input.months, firstInstallmentDate);

  const schedule = normalizeSchedule(draftSchedule, financedAmount);
  const totalDue = getScheduleTotal(schedule);
  const paidTotal = toCurrency(input.downPayment + getPaymentsTotal(existingPayments));
  const remaining = toCurrency(Math.max(0, totalDue - getPaymentsTotal(existingPayments)));

  return normalizeContract({
    ...meta,
    contractType: input.contractType || 'product',
    customerName: input.customerName,
    customerIdCard: input.customerIdCard,
    guarantorName: input.guarantorName,
    guarantorIdCard: input.guarantorIdCard,
    guarantorPhone: input.guarantorPhone || '',
    guarantorAddress: input.guarantorAddress || '',
    customerPhone: input.customerPhone,
    customerAddress: input.customerAddress,
    productName: input.productName,
    productId: input.productId,
    transferType: input.transferType,
    cashPrice: toCurrency(input.cashPrice),
    installmentPrice: toCurrency(input.installmentPrice),
    downPayment: toCurrency(input.downPayment),
    months: Math.max(1, input.months),
    monthlyInstallment: schedule.length > 0 ? toCurrency(totalDue / schedule.length) : 0,
    firstInstallmentDate,
    schedule,
    payments: existingPayments,
    paidTotal,
    remaining,
    notes: input.notes || '',
    customFields: input.customFields || [],
    status: remaining === 0 ? 'completed' : 'active',
    settledEarly: false,
    settlementDiscount: 0,
  });
}
