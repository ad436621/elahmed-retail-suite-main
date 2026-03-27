// ============================================================
// Employees & Salary Data Layer
// ============================================================

import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';

const EMP_KEY = STORAGE_KEYS.EMPLOYEES;
const SAL_KEY = STORAGE_KEYS.SALARY_RECORDS;
const ADV_KEY = STORAGE_KEYS.ADVANCES;

export interface Employee {
  id: string;
  name: string;
  phone?: string;
  position: string;
  baseSalary: number;
  hireDate: string;
  isActive: boolean;
  isArchived?: boolean;
  deletedAt?: string | null;
  notes?: string;
}

export interface SalaryRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  baseSalary: number;
  commission?: number;
  bonus: number;
  deduction: number;
  advanceDeducted: number;
  netSalary: number;
  paidAt: string;
  walletId?: string;
  notes?: string;
}

export interface Advance {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  date: string;
  deductedMonth?: string;
  notes?: string;
}

interface EmployeeRow {
  id: string;
  name: string;
  phone?: string | null;
  role?: string | null;
  salary?: number | null;
  hireDate?: string | null;
  active?: number | boolean | null;
  isArchived?: number | boolean | null;
  deletedAt?: string | null;
  notes?: string | null;
}

interface SalaryRecordRow {
  id: string;
  employeeId: string;
  employeeName?: string | null;
  month: string;
  baseSalary?: number | null;
  commission?: number | null;
  bonus?: number | null;
  deductions?: number | null;
  advanceDeducted?: number | null;
  netSalary?: number | null;
  paidAt?: string | null;
  walletId?: string | null;
  notes?: string | null;
}

interface AdvanceRow {
  id: string;
  employeeId: string;
  employeeName?: string | null;
  amount?: number | null;
  date: string;
  deductedMonth?: string | null;
  notes?: string | null;
}

let employeesCache: Employee[] | null = null;
let salaryRecordsCache: SalaryRecord[] | null = null;
let advancesCache: Advance[] | null = null;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function sortEmployees(items: Employee[]): Employee[] {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, 'ar'));
}

function sortSalaryRecords(items: SalaryRecord[]): SalaryRecord[] {
  return [...items].sort(
    (left, right) => right.month.localeCompare(left.month)
      || right.paidAt.localeCompare(left.paidAt)
      || right.id.localeCompare(left.id),
  );
}

function sortAdvances(items: Advance[]): Advance[] {
  return [...items].sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id));
}

function normalizeEmployee(row: Partial<EmployeeRow>): Employee {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    name: String(row.name ?? '').trim(),
    phone: row.phone ? String(row.phone) : undefined,
    position: String(row.role ?? ''),
    baseSalary: toNumber(row.salary),
    hireDate: String(row.hireDate ?? new Date().toISOString().slice(0, 10)),
    isActive: Boolean(row.active ?? true),
    isArchived: Boolean(row.isArchived),
    deletedAt: row.deletedAt ? String(row.deletedAt) : null,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function normalizeSalaryRecord(row: Partial<SalaryRecordRow>): SalaryRecord {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    employeeId: String(row.employeeId ?? ''),
    employeeName: String(row.employeeName ?? ''),
    month: String(row.month ?? new Date().toISOString().slice(0, 7)),
    baseSalary: toNumber(row.baseSalary),
    commission: toNumber(row.commission),
    bonus: toNumber(row.bonus),
    deduction: toNumber(row.deductions),
    advanceDeducted: toNumber(row.advanceDeducted),
    netSalary: toNumber(row.netSalary),
    paidAt: String(row.paidAt ?? new Date().toISOString()),
    walletId: row.walletId ? String(row.walletId) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function normalizeAdvance(row: Partial<AdvanceRow>): Advance {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    employeeId: String(row.employeeId ?? ''),
    employeeName: String(row.employeeName ?? ''),
    amount: toNumber(row.amount),
    date: String(row.date ?? new Date().toISOString()),
    deductedMonth: row.deductedMonth ? String(row.deductedMonth) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function toEmployeeRow(employee: Employee): EmployeeRow {
  return {
    id: employee.id,
    name: employee.name,
    phone: employee.phone ?? null,
    role: employee.position,
    salary: employee.baseSalary,
    hireDate: employee.hireDate,
    active: employee.isActive,
    isArchived: employee.isArchived ?? false,
    deletedAt: employee.deletedAt ?? null,
    notes: employee.notes ?? null,
  };
}

function toSalaryRecordRow(record: SalaryRecord): SalaryRecordRow {
  return {
    id: record.id,
    employeeId: record.employeeId,
    employeeName: record.employeeName,
    month: record.month,
    baseSalary: record.baseSalary,
    commission: record.commission ?? 0,
    bonus: record.bonus,
    deductions: record.deduction,
    advanceDeducted: record.advanceDeducted,
    netSalary: record.netSalary,
    paidAt: record.paidAt,
    walletId: record.walletId ?? null,
    notes: record.notes ?? null,
  };
}

function toAdvanceRow(advance: Advance): AdvanceRow {
  return {
    id: advance.id,
    employeeId: advance.employeeId,
    employeeName: advance.employeeName,
    amount: advance.amount,
    date: advance.date,
    deductedMonth: advance.deductedMonth ?? null,
    notes: advance.notes ?? null,
  };
}

function setEmployeesState(employees: Employee[]): void {
  employeesCache = sortEmployees(employees.map(normalizeEmployee));
}

function setSalaryRecordsState(records: SalaryRecord[]): void {
  salaryRecordsCache = sortSalaryRecords(records.map(normalizeSalaryRecord));
}

function setAdvancesState(advances: Advance[]): void {
  advancesCache = sortAdvances(advances.map(normalizeAdvance));
}

function refreshElectronEmployees(): Employee[] {
  const rows = readElectronSync<EmployeeRow[]>('db-sync:employees:get', []);
  setEmployeesState(rows.map(normalizeEmployee));
  return employeesCache ?? [];
}

function refreshElectronSalaryRecords(): SalaryRecord[] {
  const rows = readElectronSync<SalaryRecordRow[]>('db-sync:employee_salaries:get', []);
  setSalaryRecordsState(rows.map(normalizeSalaryRecord));
  return salaryRecordsCache ?? [];
}

function refreshElectronAdvances(): Advance[] {
  const rows = readElectronSync<AdvanceRow[]>('db-sync:employee_advances:get', []);
  setAdvancesState(rows.map(normalizeAdvance));
  return advancesCache ?? [];
}

function loadLocalEmployees(): Employee[] {
  return sortEmployees(getStorageItem<Employee[]>(EMP_KEY, []).map(normalizeEmployee));
}

function loadLocalSalaryRecords(): SalaryRecord[] {
  return sortSalaryRecords(getStorageItem<SalaryRecord[]>(SAL_KEY, []).map(normalizeSalaryRecord));
}

function loadLocalAdvances(): Advance[] {
  return sortAdvances(getStorageItem<Advance[]>(ADV_KEY, []).map(normalizeAdvance));
}

function persistElectronEmployees(employees: Employee[]): void {
  const current = new Map(getEmployees().map((employee) => [employee.id, employee]));
  const nextIds = new Set(employees.map((employee) => employee.id));

  for (const employee of employees) {
    const payload = toEmployeeRow(employee);
    if (current.has(employee.id)) {
      callElectronSync('db-sync:employees:update', employee.id, payload);
    } else {
      callElectronSync('db-sync:employees:add', payload);
    }
  }

  for (const id of current.keys()) {
    if (!nextIds.has(id)) {
      callElectronSync('db-sync:employees:delete', id);
    }
  }
}

function persistElectronSalaryRecords(records: SalaryRecord[]): void {
  const current = new Map(getSalaryRecords().map((record) => [record.id, record]));
  const nextIds = new Set(records.map((record) => record.id));

  for (const record of records) {
    const payload = toSalaryRecordRow(record);
    if (current.has(record.id)) {
      callElectronSync('db-sync:employee_salaries:update', record.id, payload);
    } else {
      callElectronSync('db-sync:employee_salaries:add', payload);
    }
  }

  for (const id of current.keys()) {
    if (!nextIds.has(id)) {
      callElectronSync('db-sync:employee_salaries:delete', id);
    }
  }
}

function persistElectronAdvances(advances: Advance[]): void {
  const current = new Map(getAdvances().map((advance) => [advance.id, advance]));
  const nextIds = new Set(advances.map((advance) => advance.id));

  for (const advance of advances) {
    const payload = toAdvanceRow(advance);
    if (current.has(advance.id)) {
      callElectronSync('db-sync:employee_advances:update', advance.id, payload);
    } else {
      callElectronSync('db-sync:employee_advances:add', payload);
    }
  }

  for (const id of current.keys()) {
    if (!nextIds.has(id)) {
      callElectronSync('db-sync:employee_advances:delete', id);
    }
  }
}

function reconcileAdvanceDeduction(employeeId: string, month: string, amount: number): void {
  const deductionAmount = roundCurrency(Math.max(0, amount));
  if (!deductionAmount) return;

  const allAdvances = getAdvances();
  const nextAdvances = [...allAdvances];
  const pendingIndexes = nextAdvances
    .map((advance, index) => ({ advance, index }))
    .filter(({ advance }) => advance.employeeId === employeeId && !advance.deductedMonth)
    .sort((left, right) => left.advance.date.localeCompare(right.advance.date) || left.advance.id.localeCompare(right.advance.id));

  let remaining = deductionAmount;

  for (const { index } of pendingIndexes) {
    if (remaining <= 0) break;
    const current = nextAdvances[index];
    if (!current) continue;

    if (remaining >= current.amount) {
      nextAdvances[index] = normalizeAdvance({ ...current, deductedMonth: month });
      remaining = roundCurrency(remaining - current.amount);
      continue;
    }

    const deductedPortion = roundCurrency(remaining);
    const pendingPortion = roundCurrency(current.amount - deductedPortion);

    nextAdvances[index] = normalizeAdvance({
      ...current,
      amount: pendingPortion,
      notes: current.notes,
    });

    nextAdvances.push(normalizeAdvance({
      ...current,
      id: crypto.randomUUID(),
      amount: deductedPortion,
      deductedMonth: month,
      notes: current.notes ? `${current.notes} | deducted ${month}` : `deducted ${month}`,
    }));

    remaining = 0;
  }

  saveAdvances(nextAdvances);
}

export function getEmployees(): Employee[] {
  const all = employeesCache ?? (hasElectronIpc() ? refreshElectronEmployees() : (setEmployeesState(loadLocalEmployees()), employeesCache ?? []));
  return all.filter((employee) => !employee.isArchived && !employee.deletedAt);
}

export function saveEmployees(employees: Employee[]): void {
  const normalized = sortEmployees(employees.map(normalizeEmployee));

  if (hasElectronIpc()) {
    persistElectronEmployees(normalized);
    setEmployeesState(normalized);
    emitDataChange(EMP_KEY);
    return;
  }

  setStorageItem(EMP_KEY, normalized);
  setEmployeesState(normalized);
  emitDataChange(EMP_KEY);
}

export function addEmployee(data: Omit<Employee, 'id'>): Employee {
  const employee = normalizeEmployee({ ...data, id: crypto.randomUUID() });

  if (hasElectronIpc()) {
    const saved = callElectronSync<EmployeeRow>('db-sync:employees:add', toEmployeeRow(employee));
    const next = normalizeEmployee(saved ?? employee);
    const employees = refreshElectronEmployees();
    emitDataChange(EMP_KEY);
    return employees.find((item) => item.id === next.id) ?? next;
  }

  saveEmployees([...getEmployees(), employee]);
  return employee;
}

export function updateEmployee(id: string, data: Partial<Employee>): void {
  if (hasElectronIpc()) {
    const current = getEmployees().find((employee) => employee.id === id);
    const next = normalizeEmployee({ ...(current ?? { id, name: '', hireDate: new Date().toISOString().slice(0, 10) }), ...data });
    callElectronSync('db-sync:employees:update', id, toEmployeeRow(next));
    setEmployeesState(getEmployees().map((employee) => (employee.id === id ? next : employee)));
    emitDataChange(EMP_KEY);
    return;
  }

  saveEmployees(getEmployees().map((employee) => (
    employee.id === id ? normalizeEmployee({ ...employee, ...data }) : employee
  )));
}

export function deleteEmployee(id: string): void {
  updateEmployee(id, {
    isArchived: true,
    deletedAt: new Date().toISOString(),
    isActive: false,
  });
}

export function getSalaryRecords(employeeId?: string): SalaryRecord[] {
  const records = salaryRecordsCache
    ?? (hasElectronIpc()
      ? refreshElectronSalaryRecords()
      : (setSalaryRecordsState(loadLocalSalaryRecords()), salaryRecordsCache ?? []));

  return employeeId ? records.filter((record) => record.employeeId === employeeId) : records;
}

export function saveSalaryRecords(records: SalaryRecord[]): void {
  const normalized = sortSalaryRecords(records.map(normalizeSalaryRecord));

  if (hasElectronIpc()) {
    persistElectronSalaryRecords(normalized);
    setSalaryRecordsState(normalized);
    emitDataChange(SAL_KEY);
    return;
  }

  setStorageItem(SAL_KEY, normalized);
  setSalaryRecordsState(normalized);
  emitDataChange(SAL_KEY);
}

export function addSalaryRecord(data: Omit<SalaryRecord, 'id'>): SalaryRecord {
  const record = normalizeSalaryRecord({ ...data, id: crypto.randomUUID() });

  if (hasElectronIpc()) {
    const saved = callElectronSync<SalaryRecordRow>('db-sync:employee_salaries:add', toSalaryRecordRow(record));
    const next = normalizeSalaryRecord(saved ?? record);
    const records = refreshElectronSalaryRecords();
    emitDataChange(SAL_KEY);
    if (next.advanceDeducted > 0) {
      reconcileAdvanceDeduction(next.employeeId, next.month, next.advanceDeducted);
    }
    return records.find((item) => item.id === next.id) ?? next;
  }

  saveSalaryRecords([...getSalaryRecords(), record]);
  if (record.advanceDeducted > 0) {
    reconcileAdvanceDeduction(record.employeeId, record.month, record.advanceDeducted);
  }
  return record;
}

export function paySalary(params: {
  employee: Employee;
  month: string;
  bonus?: number;
  deduction?: number;
  advanceDeducted?: number;
  walletId?: string;
  notes?: string;
}): SalaryRecord {
  const {
    employee,
    month,
    bonus = 0,
    deduction = 0,
    advanceDeducted = 0,
    walletId,
    notes,
  } = params;

  const netSalary = Math.max(0, roundCurrency(employee.baseSalary + bonus - deduction - advanceDeducted));

  return addSalaryRecord({
    employeeId: employee.id,
    employeeName: employee.name,
    month,
    baseSalary: employee.baseSalary,
    commission: 0,
    bonus,
    deduction,
    advanceDeducted,
    netSalary,
    paidAt: new Date().toISOString(),
    walletId,
    notes,
  });
}

export function getSalaryForMonth(month: string): SalaryRecord[] {
  return getSalaryRecords().filter((record) => record.month === month);
}

export function hasBeenPaidThisMonth(employeeId: string, month: string): boolean {
  return getSalaryRecords().some((record) => record.employeeId === employeeId && record.month === month);
}

export function getAdvances(employeeId?: string): Advance[] {
  const advances = advancesCache
    ?? (hasElectronIpc()
      ? refreshElectronAdvances()
      : (setAdvancesState(loadLocalAdvances()), advancesCache ?? []));

  return employeeId ? advances.filter((advance) => advance.employeeId === employeeId) : advances;
}

export function saveAdvances(advances: Advance[]): void {
  const normalized = sortAdvances(advances.map(normalizeAdvance));

  if (hasElectronIpc()) {
    persistElectronAdvances(normalized);
    setAdvancesState(normalized);
    emitDataChange(ADV_KEY);
    return;
  }

  setStorageItem(ADV_KEY, normalized);
  setAdvancesState(normalized);
  emitDataChange(ADV_KEY);
}

export function addAdvance(data: Omit<Advance, 'id'>): Advance {
  const advance = normalizeAdvance({ ...data, id: crypto.randomUUID() });

  if (hasElectronIpc()) {
    const saved = callElectronSync<AdvanceRow>('db-sync:employee_advances:add', toAdvanceRow(advance));
    const next = normalizeAdvance(saved ?? advance);
    const advances = refreshElectronAdvances();
    emitDataChange(ADV_KEY);
    return advances.find((item) => item.id === next.id) ?? next;
  }

  saveAdvances([...getAdvances(), advance]);
  return advance;
}

export function getPendingAdvancesTotal(employeeId: string): number {
  return getAdvances(employeeId)
    .filter((advance) => !advance.deductedMonth)
    .reduce((sum, advance) => sum + advance.amount, 0);
}
