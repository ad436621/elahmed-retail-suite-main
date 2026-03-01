// ============================================================
// Employees & Salary Data Layer
// ============================================================

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

const EMP_KEY = 'gx_employees';
const SAL_KEY = 'gx_salary_records';
const ADV_KEY = 'gx_advances';

// ─── Types ──────────────────────────────────────────────────

export interface Employee {
    id: string;
    name: string;
    phone?: string;
    position: string;       // "كاشير" | "تقني" | "مدير"
    baseSalary: number;
    hireDate: string;
    isActive: boolean;
    notes?: string;
}

export interface SalaryRecord {
    id: string;
    employeeId: string;
    employeeName: string;
    month: string;            // "2026-03"
    baseSalary: number;
    bonus: number;
    deduction: number;
    advanceDeducted: number;
    netSalary: number;        // base + bonus - deduction - advanceDeducted
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
    deductedMonth?: string;   // month it was deducted from salary
    notes?: string;
}

// ─── Helpers ────────────────────────────────────────────────

function genId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Employees ───────────────────────────────────────────────

export function getEmployees(): Employee[] {
    return getStorageItem<Employee[]>(EMP_KEY, []);
}

export function saveEmployees(employees: Employee[]): void {
    setStorageItem(EMP_KEY, employees);
}

export function addEmployee(data: Omit<Employee, 'id'>): Employee {
    const emp: Employee = { ...data, id: genId('emp') };
    saveEmployees([...getEmployees(), emp]);
    return emp;
}

export function updateEmployee(id: string, data: Partial<Employee>): void {
    saveEmployees(getEmployees().map(e => e.id === id ? { ...e, ...data } : e));
}

export function deleteEmployee(id: string): void {
    saveEmployees(getEmployees().filter(e => e.id !== id));
}

// ─── Salary Records ──────────────────────────────────────────

export function getSalaryRecords(employeeId?: string): SalaryRecord[] {
    const all = getStorageItem<SalaryRecord[]>(SAL_KEY, []);
    return employeeId ? all.filter(r => r.employeeId === employeeId) : all;
}

export function saveSalaryRecords(records: SalaryRecord[]): void {
    setStorageItem(SAL_KEY, records);
}

export function addSalaryRecord(data: Omit<SalaryRecord, 'id'>): SalaryRecord {
    const record: SalaryRecord = { ...data, id: genId('sal') };
    saveSalaryRecords([...getSalaryRecords(), record]);
    return record;
}

/** Pay monthly salary — computes net and saves record */
export function paySalary(params: {
    employee: Employee;
    month: string;
    bonus?: number;
    deduction?: number;
    advanceDeducted?: number;
    walletId?: string;
    notes?: string;
}): SalaryRecord {
    const { employee, month, bonus = 0, deduction = 0, advanceDeducted = 0, walletId, notes } = params;
    const netSalary = Math.max(0, employee.baseSalary + bonus - deduction - advanceDeducted);
    return addSalaryRecord({
        employeeId: employee.id,
        employeeName: employee.name,
        month,
        baseSalary: employee.baseSalary,
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
    return getSalaryRecords().filter(r => r.month === month);
}

export function hasBeenPaidThisMonth(employeeId: string, month: string): boolean {
    return getSalaryRecords().some(r => r.employeeId === employeeId && r.month === month);
}

// ─── Advances (سلف) ──────────────────────────────────────────

export function getAdvances(employeeId?: string): Advance[] {
    const all = getStorageItem<Advance[]>(ADV_KEY, []);
    return employeeId ? all.filter(a => a.employeeId === employeeId) : all;
}

export function saveAdvances(advances: Advance[]): void {
    setStorageItem(ADV_KEY, advances);
}

export function addAdvance(data: Omit<Advance, 'id'>): Advance {
    const adv: Advance = { ...data, id: genId('adv') };
    saveAdvances([...getAdvances(), adv]);
    return adv;
}

export function getPendingAdvancesTotal(employeeId: string): number {
    return getAdvances(employeeId)
        .filter(a => !a.deductedMonth)
        .reduce((sum, a) => sum + a.amount, 0);
}
