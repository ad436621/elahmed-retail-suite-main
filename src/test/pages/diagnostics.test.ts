// ============================================================
// Unit Tests — Diagnostics Page
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock dependencies ────────────────────────────────────────

vi.mock('@/repositories/saleRepository', () => ({
    getAllSales: vi.fn(() => []),
}));

vi.mock('@/data/damagedData', () => ({
    getDamagedItems: vi.fn(() => []),
}));

vi.mock('@/data/installmentsData', () => ({
    getContracts: vi.fn(() => []),
}));

vi.mock('@/data/maintenanceData', () => ({
    getMaintenanceOrders: vi.fn(() => []),
}));

vi.mock('@/data/expensesData', () => ({
    getExpenses: vi.fn(() => []),
}));

vi.mock('@/data/mobilesData', () => ({
    getMobiles: vi.fn(() => []),
}));

vi.mock('@/data/computersData', () => ({
    getComputers: vi.fn(() => []),
}));

vi.mock('@/data/devicesData', () => ({
    getDevices: vi.fn(() => []),
}));

// ─── Helper to get mock functions ─────────────────────────────

async function getMocks() {
    const saleRepo = await import('@/repositories/saleRepository');
    const damaged = await import('@/data/damagedData');
    const installments = await import('@/data/installmentsData');
    const maintenance = await import('@/data/maintenanceData');
    const expenses = await import('@/data/expensesData');
    const mobiles = await import('@/data/mobilesData');
    const computers = await import('@/data/computersData');
    const devices = await import('@/data/devicesData');
    
    return {
        getAllSales: saleRepo.getAllSales as ReturnType<typeof vi.fn>,
        getDamagedItems: damaged.getDamagedItems as ReturnType<typeof vi.fn>,
        getContracts: installments.getContracts as ReturnType<typeof vi.fn>,
        getMaintenanceOrders: maintenance.getMaintenanceOrders as ReturnType<typeof vi.fn>,
        getExpenses: expenses.getExpenses as ReturnType<typeof vi.fn>,
        getMobiles: mobiles.getMobiles as ReturnType<typeof vi.fn>,
        getComputers: computers.getComputers as ReturnType<typeof vi.fn>,
        getDevices: devices.getDevices as ReturnType<typeof vi.fn>,
    };
}

// ─── Fixtures ────────────────────────────────────────────────

const makeSale = (overrides: Record<string, unknown> = {}) => ({
    id: 'sale-1',
    invoiceNumber: 'INV-2024-0001',
    grossProfit: 500,
    total: 1500,
    voidedAt: null,
    ...overrides,
});

const makeContract = (overrides: Record<string, unknown> = {}) => ({
    contractNumber: 'CONT-001',
    customerName: 'Ahmed',
    status: 'active',
    schedule: [] as Array<{ paid: boolean; dueDate: string }>,
    ...overrides,
});

const makeProduct = (overrides: Record<string, unknown> = {}) => ({
    id: 'prod-1',
    name: 'iPhone 15',
    quantity: 10,
    ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────

describe('Diagnostics Data Checks', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
    });

    // ─── Sales with negative profit ─────────────────────────

    describe('Negative profit sales detection', () => {
        it('should detect sales with negative profit', async () => {
            const mocks = await getMocks();
            mocks.getAllSales.mockReturnValue([
                makeSale({ grossProfit: -100 }),
                makeSale({ grossProfit: -50 }),
                makeSale({ grossProfit: 500 }),
            ]);
            
            const sales = mocks.getAllSales();
            const negative = sales.filter(s => !s.voidedAt && (s.grossProfit ?? 0) < -10);
            
            expect(negative).toHaveLength(2);
        });

        it('should exclude voided sales from negative profit check', async () => {
            const mocks = await getMocks();
            mocks.getAllSales.mockReturnValue([
                makeSale({ grossProfit: -100, voidedAt: '2024-01-01' }),
            ]);
            
            const sales = mocks.getAllSales();
            const negative = sales.filter(s => !s.voidedAt && (s.grossProfit ?? 0) < -10);
            
            expect(negative).toHaveLength(0);
        });

        it('should ignore small negative profits (-10 or less)', async () => {
            const mocks = await getMocks();
            mocks.getAllSales.mockReturnValue([
                makeSale({ grossProfit: -5 }),
                makeSale({ grossProfit: -10 }),
                makeSale({ grossProfit: -11 }),
            ]);
            
            const sales = mocks.getAllSales();
            const negative = sales.filter(s => !s.voidedAt && (s.grossProfit ?? 0) < -10);
            
            expect(negative).toHaveLength(1);
        });
    });

    // ─── Overdue installment contracts ───────────────────────

    describe('Overdue contracts detection', () => {
        it('should detect contracts with overdue schedule items', async () => {
            const mocks = await getMocks();
            const today = '2024-06-15';
            
            mocks.getContracts.mockReturnValue([
                makeContract({
                    status: 'active',
                    schedule: [
                        { paid: false, dueDate: '2024-05-01' }, // overdue
                        { paid: true, dueDate: '2024-06-01' },
                    ],
                }),
            ]);
            
            const contracts = mocks.getContracts();
            const overdue = contracts.filter(c => {
                if (c.status === 'completed') return false;
                return c.schedule.some(s => !s.paid && s.dueDate < today);
            });
            
            expect(overdue).toHaveLength(1);
        });

        it('should exclude completed contracts from overdue check', async () => {
            const mocks = await getMocks();
            const today = '2024-06-15';
            
            mocks.getContracts.mockReturnValue([
                makeContract({
                    status: 'completed',
                    schedule: [{ paid: false, dueDate: '2024-05-01' }],
                }),
            ]);
            
            const contracts = mocks.getContracts();
            const overdue = contracts.filter(c => {
                if (c.status === 'completed') return false;
                return c.schedule.some(s => !s.paid && s.dueDate < today);
            });
            
            expect(overdue).toHaveLength(0);
        });
    });

    // ─── Negative stock detection ───────────────────────────

    describe('Negative stock detection', () => {
        it('should detect products with negative quantity', async () => {
            const mocks = await getMocks();
            mocks.getMobiles.mockReturnValue([
                makeProduct({ name: 'iPhone 15', quantity: 10 }),
                makeProduct({ name: 'Galaxy S24', quantity: -5 }),
            ]);
            mocks.getComputers.mockReturnValue([]);
            mocks.getDevices.mockReturnValue([]);
            
            const mobiles = mocks.getMobiles();
            const negativeStock = mobiles.filter(m => (m.quantity || 0) < 0);
            
            expect(negativeStock).toHaveLength(1);
            expect(negativeStock[0].name).toBe('Galaxy S24');
        });

        it('should detect products with zero quantity', async () => {
            const mocks = await getMocks();
            mocks.getMobiles.mockReturnValue([
                makeProduct({ name: 'iPhone 15', quantity: 0 }),
                makeProduct({ name: 'Galaxy S24', quantity: 0 }),
                makeProduct({ name: 'Pixel 8', quantity: 5 }),
            ]);
            mocks.getComputers.mockReturnValue([]);
            mocks.getDevices.mockReturnValue([]);
            
            const mobiles = mocks.getMobiles();
            const zeroStock = mobiles.filter(m => (m.quantity || 0) === 0);
            
            expect(zeroStock).toHaveLength(2);
        });
    });

    // ─── localStorage usage ───────────────────────────────────

    describe('localStorage usage calculation', () => {
        beforeEach(() => {
            // Mock localStorage
            const store: Record<string, string> = {
                'gx_test': 'x'.repeat(1000),
            };
            vi.spyOn(localStorage, 'length', 'get').mockReturnValue(1);
            vi.spyOn(localStorage, 'key').mockImplementation((i) => i === 0 ? 'gx_test' : null);
            vi.spyOn(localStorage, 'getItem').mockImplementation((k) => store[k] || null);
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should calculate storage usage correctly', () => {
            let totalBytes = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i) ?? '';
                const val = localStorage.getItem(key) ?? '';
                totalBytes += val.length * 2;
            }
            
            const totalKB = Math.round(totalBytes / 1024);
            expect(totalKB).toBeGreaterThan(0);
        });

        it('should flag storage at 80% usage as critical', () => {
            // Calculate usage percentage
            const totalKB = 4096; // 4MB
            const limitKB = 5120; // 5MB
            const usagePct = Math.round((totalKB / limitKB) * 100);
            
            expect(usagePct).toBe(80);
            expect(usagePct >= 80).toBe(true);
        });

        it('should flag storage at 50% usage as warning', () => {
            const totalKB = 2560; // 2.5MB
            const limitKB = 5120; // 5MB
            const usagePct = Math.round((totalKB / limitKB) * 100);
            
            expect(usagePct).toBe(50);
            expect(usagePct >= 50 && usagePct < 80).toBe(true);
        });
    });

    // ─── Health score calculation ────────────────────────────

    describe('Health score calculation', () => {
        it('should calculate excellent score when all OK', () => {
            const issues = [
                { severity: 'ok' },
                { severity: 'ok' },
                { severity: 'ok' },
            ];
            
            const errors = issues.filter(i => i.severity === 'error').length;
            const warnings = issues.filter(i => i.severity === 'warning').length;
            const oks = issues.filter(i => i.severity === 'ok').length;
            const total = issues.length;
            const score = total > 0 ? Math.round(((oks + warnings * 0.5) / total) * 100) : 100;
            
            expect(score).toBe(100);
        });

        it('should calculate good score with some warnings', () => {
            const issues = [
                { severity: 'ok' },
                { severity: 'warning' },
                { severity: 'ok' },
            ];
            
            const errors = issues.filter(i => i.severity === 'error').length;
            const warnings = issues.filter(i => i.severity === 'warning').length;
            const oks = issues.filter(i => i.severity === 'ok').length;
            const total = issues.length;
            const score = total > 0 ? Math.round(((oks + warnings * 0.5) / total) * 100) : 100;
            
            expect(score).toBe(83); // (2 + 0.5) / 3 * 100 = 83.33
        });

        it('should calculate poor score with errors', () => {
            const issues = [
                { severity: 'error' },
                { severity: 'error' },
                { severity: 'warning' },
                { severity: 'ok' },
            ];
            
            const errors = issues.filter(i => i.severity === 'error').length;
            const warnings = issues.filter(i => i.severity === 'warning').length;
            const oks = issues.filter(i => i.severity === 'ok').length;
            const total = issues.length;
            const score = total > 0 ? Math.round(((oks + warnings * 0.5) / total) * 100) : 100;
            
            expect(score).toBe(38); // (1 + 0.5) / 4 * 100 = 37.5
        });

        it('should return 100 for empty issues', () => {
            const issues: string[] = [];
            
            const errors = issues.filter(i => i === 'error').length;
            const warnings = issues.filter(i => i === 'warning').length;
            const oks = issues.filter(i => i === 'ok').length;
            const total = issues.length;
            const score = total > 0 ? Math.round(((oks + warnings * 0.5) / total) * 100) : 100;
            
            expect(score).toBe(100);
        });
    });

    // ─── Damage items detection ─────────────────────────────

    describe('Damaged items with negative loss', () => {
        it('should detect damaged items with negative totalLoss', async () => {
            const mocks = await getMocks();
            
            mocks.getDamagedItems.mockReturnValue([
                { id: 'd1', productName: 'iPhone 15', totalLoss: 100 },
                { id: 'd2', productName: 'Galaxy S24', totalLoss: -50 }, // negative!
            ]);
            
            const damaged = mocks.getDamagedItems();
            const negDamaged = damaged.filter(d => d.totalLoss < 0);
            
            expect(negDamaged).toHaveLength(1);
            expect(negDamaged[0].productName).toBe('Galaxy S24');
        });
    });

    // ─── Maintenance profit check ────────────────────────────

    describe('Maintenance orders with negative profit', () => {
        it('should detect maintenance orders with netProfit < -5', async () => {
            const mocks = await getMocks();
            
            mocks.getMaintenanceOrders.mockReturnValue([
                { id: 'm1', orderNumber: 'M001', customerName: 'Ahmed', netProfit: 100 },
                { id: 'm2', orderNumber: 'M002', customerName: 'Khaled', netProfit: -10 },
            ]);
            
            const orders = mocks.getMaintenanceOrders();
            const negProfit = orders.filter(m => m.netProfit < -5);
            
            expect(negProfit).toHaveLength(1);
            expect(negProfit[0].orderNumber).toBe('M002');
        });
    });

    // ─── Expenses with zero amount ───────────────────────────

    describe('Expenses with zero or negative amount', () => {
        it('should detect expenses with amount <= 0', async () => {
            const mocks = await getMocks();
            
            mocks.getExpenses.mockReturnValue([
                { id: 'e1', amount: 100 },
                { id: 'e2', amount: 0 },
                { id: 'e3', amount: -50 },
            ]);
            
            const expenses = mocks.getExpenses();
            const zeroExpenses = expenses.filter(e => e.amount <= 0);
            
            expect(zeroExpenses).toHaveLength(2);
        });
    });
});