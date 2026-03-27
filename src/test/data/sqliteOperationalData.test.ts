import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/config';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.resetModules();
  delete (window as typeof window & { electron?: unknown }).electron;
});

describe('sqlite operational bridges', () => {
  it('updates supplier balance from SQLite transaction writes', async () => {
    const suppliers = [
      {
        id: 'sup-1',
        name: 'ACME',
        phone: '01000000000',
        address: 'Cairo',
        balance: 150,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    ];
    const transactions: Array<Record<string, unknown>> = [];

    const sendSync = vi.fn((channel: string, ...args: unknown[]) => {
      if (channel === 'db-sync:suppliers:get') return suppliers;
      if (channel === 'db-sync:supplier_transactions:get') return transactions;
      if (channel === 'db-sync:supplier_transactions:add') {
        const payload = args[0] as Record<string, unknown>;
        const transaction = {
          id: 'txn-1',
          supplierId: 'sup-1',
          supplierName: 'ACME',
          type: payload.type,
          amount: payload.amount,
          balanceBefore: 150,
          balanceAfter: 50,
          notes: payload.notes ?? null,
          createdBy: payload.createdBy,
          createdAt: payload.createdAt,
        };
        suppliers[0] = { ...suppliers[0], balance: 50, updatedAt: '2026-03-02T00:00:00.000Z' };
        transactions.unshift(transaction);
        return transaction;
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const { addSupplierTransaction, getTotalOwedToSuppliers } = await import('@/data/suppliersData');

    const transaction = addSupplierTransaction({
      supplierId: 'sup-1',
      supplierName: 'ACME',
      type: 'payment',
      amount: 100,
      createdBy: 'Admin',
      createdAt: '2026-03-02T00:00:00.000Z',
      notes: 'Installment',
    });

    expect(transaction.balanceAfter).toBe(50);
    expect(getTotalOwedToSuppliers()).toBe(50);
    expect(sendSync).toHaveBeenCalledWith(
      'db-sync:supplier_transactions:add',
      expect.objectContaining({
        supplierId: 'sup-1',
        amount: 100,
        type: 'payment',
      }),
    );
  });

  it('reconciles deducted advances through SQLite salary writes', async () => {
    const employees = [
      {
        id: 'emp-1',
        name: 'Khaled',
        phone: '01011111111',
        role: 'Technician',
        salary: 5000,
        hireDate: '2026-01-01',
        active: 1,
        notes: null,
      },
    ];
    const salaries: Array<Record<string, unknown>> = [];
    const advances: Array<Record<string, unknown>> = [
      {
        id: 'adv-1',
        employeeId: 'emp-1',
        employeeName: 'Khaled',
        amount: 300,
        date: '2026-03-01T00:00:00.000Z',
        deductedMonth: null,
        notes: null,
      },
    ];

    const sendSync = vi.fn((channel: string, ...args: unknown[]) => {
      if (channel === 'db-sync:employees:get') return employees;
      if (channel === 'db-sync:employee_salaries:get') return salaries;
      if (channel === 'db-sync:employee_advances:get') return advances;
      if (channel === 'db-sync:employee_salaries:add') {
        const payload = args[0] as Record<string, unknown>;
        const row = { ...payload, id: 'sal-1' };
        salaries.push(row);
        return row;
      }
      if (channel === 'db-sync:employee_advances:update') {
        const id = args[0] as string;
        const payload = args[1] as Record<string, unknown>;
        const index = advances.findIndex((advance) => advance.id === id);
        advances[index] = { ...advances[index], ...payload };
        return advances[index];
      }
      if (channel === 'db-sync:employee_advances:add') {
        const payload = args[0] as Record<string, unknown>;
        const row = { ...payload, id: 'adv-split' };
        advances.push(row);
        return row;
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const { getEmployees, getPendingAdvancesTotal, paySalary } = await import('@/data/employeesData');
    const employee = getEmployees()[0];

    paySalary({
      employee,
      month: '2026-03',
      bonus: 0,
      deduction: 0,
      advanceDeducted: 100,
      notes: 'March payroll',
    });

    expect(getPendingAdvancesTotal('emp-1')).toBe(200);
    expect(advances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'adv-1', amount: 200 }),
        expect.objectContaining({ deductedMonth: '2026-03', amount: 100 }),
      ]),
    );
  });

  it('maps used devices from SQLite rows with current domain fields', async () => {
    const sendSync = vi.fn((channel: string) => {
      if (channel === 'db-sync:used_devices:get') {
        return [
          {
            id: 'used-1',
            name: 'ThinkPad X1',
            model: 'Gen 11',
            category: 'laptop',
            serialNumber: 'SN-1',
            color: 'Black',
            storage: '512GB',
            ram: '16GB',
            condition: 'Excellent',
            purchasePrice: 22000,
            salePrice: 25500,
            sellingPrice: 25500,
            description: 'Clean condition',
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
        ];
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const { getUsedDevices } = await import('@/data/usedDevicesData');
    const items = getUsedDevices();

    expect(items[0]).toEqual(
      expect.objectContaining({
        id: 'used-1',
        deviceType: 'laptop',
        salePrice: 25500,
        description: 'Clean condition',
      }),
    );
  });

  it('reads wallet metadata from SQLite and computes balances from the ledger', async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === 'db:wallets:get') {
        return [
          {
            id: 'wallet-1',
            name: 'Main Cash',
            type: 'cash',
            icon: '💵',
            color: 'bg-emerald-100 text-emerald-700',
            isDefault: 1,
            createdAt: '2026-03-01T00:00:00.000Z',
          },
        ];
      }
      if (channel === 'db:safe_transactions:get') {
        return [
          {
            id: 'tx-1',
            walletId: 'wallet-1',
            type: 'deposit',
            amount: 1200,
            description: 'Sale INV-1',
            createdAt: '2026-03-01T10:00:00.000Z',
          },
          {
            id: 'tx-2',
            walletId: 'wallet-1',
            type: 'withdrawal',
            amount: 300,
            description: 'Expense',
            createdAt: '2026-03-01T11:00:00.000Z',
          },
        ];
      }
      return [];
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { invoke } },
    });

    const { getWallets } = await import('@/data/walletsData');
    const wallets = await getWallets();

    expect(wallets).toEqual([
      expect.objectContaining({
        id: 'wallet-1',
        name: 'Main Cash',
        balance: 900,
        icon: '💵',
      }),
    ]);
  });

  it('persists sales through SQLite and exposes active-sale filtering', async () => {
    const sales: Array<Record<string, unknown>> = [];

    const sendSync = vi.fn((channel: string, ...args: unknown[]) => {
      if (channel === 'db-sync:sales:get') {
        const activeOnly = Boolean(args[0]);
        return activeOnly ? sales.filter((sale) => !sale.voidedAt) : sales;
      }
      if (channel === 'db-sync:sales:upsert') {
        const payload = args[0] as Record<string, unknown>;
        const index = sales.findIndex((sale) => sale.id === payload.id);
        if (index >= 0) sales[index] = payload;
        else sales.push(payload);
        return payload;
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const { getActiveSales, getAllSales, saveSale } = await import('@/repositories/saleRepository');

    saveSale({
      id: 'sale-1',
      invoiceNumber: 'INV-2026-0001',
      date: '2026-03-01T10:00:00.000Z',
      items: [{ productId: 'prod-1', name: 'Phone', qty: 1, price: 1000, cost: 700, lineDiscount: 0 }],
      subtotal: 1000,
      discount: 0,
      total: 1000,
      totalCost: 700,
      grossProfit: 300,
      marginPct: 30,
      paymentMethod: 'cash',
      employee: 'Tester',
      voidedAt: null,
      voidReason: null,
      voidedBy: null,
    });

    saveSale({
      id: 'sale-2',
      invoiceNumber: 'INV-2026-0002',
      date: '2026-03-01T11:00:00.000Z',
      items: [{ productId: 'prod-2', name: 'Case', qty: 1, price: 100, cost: 50, lineDiscount: 0 }],
      subtotal: 100,
      discount: 0,
      total: 100,
      totalCost: 50,
      grossProfit: 50,
      marginPct: 50,
      paymentMethod: 'card',
      employee: 'Tester',
      voidedAt: '2026-03-01T12:00:00.000Z',
      voidReason: 'void',
      voidedBy: 'owner',
    });

    expect(getAllSales()).toHaveLength(2);
    expect(getActiveSales()).toHaveLength(1);
    expect(sendSync).toHaveBeenCalledWith('db-sync:sales:get', true);
  });

  it('keeps purchase invoice numbers monotonic through SQLite after deletions', async () => {
    const invoices: Array<Record<string, unknown>> = [];
    let nextSequence = 0;

    const sendSync = vi.fn((channel: string, ...args: unknown[]) => {
      if (channel === 'db-sync:purchase_invoices:get') return invoices;
      if (channel === 'db-sync:purchase_invoices:add') {
        const payload = args[0] as Record<string, unknown>;
        nextSequence += 1;
        const row = {
          ...payload,
          id: `pi-${nextSequence}`,
          invoiceNumber: `PI-${String(nextSequence).padStart(4, '0')}`,
          remaining: Number(payload.totalAmount ?? 0) - Number(payload.paidAmount ?? 0),
          status: Number(payload.paidAmount ?? 0) >= Number(payload.totalAmount ?? 0)
            ? 'paid'
            : Number(payload.paidAmount ?? 0) > 0
              ? 'partial'
              : 'confirmed',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        };
        invoices.push(row);
        return row;
      }
      if (channel === 'db-sync:purchase_invoices:delete') {
        const id = args[0] as string;
        const index = invoices.findIndex((invoice) => invoice.id === id);
        if (index >= 0) invoices.splice(index, 1);
        return true;
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const { addPurchaseInvoice, deletePurchaseInvoice } = await import('@/data/purchaseInvoicesData');

    const first = addPurchaseInvoice({
      supplierName: 'Supplier A',
      supplierId: 'sup-1',
      invoiceDate: '2026-03-25',
      totalAmount: 1000,
      paidAmount: 200,
      paymentMethod: 'cash',
      items: [{ id: 'item-1', productName: 'Phone', quantity: 1, unitPrice: 1000, totalPrice: 1000 }],
      notes: '',
      createdBy: 'tester',
    });
    const second = addPurchaseInvoice({
      supplierName: 'Supplier B',
      supplierId: 'sup-2',
      invoiceDate: '2026-03-25',
      totalAmount: 500,
      paidAmount: 500,
      paymentMethod: 'cash',
      items: [{ id: 'item-2', productName: 'Case', quantity: 5, unitPrice: 100, totalPrice: 500 }],
      notes: '',
      createdBy: 'tester',
    });

    deletePurchaseInvoice(first.id);

    const third = addPurchaseInvoice({
      supplierName: 'Supplier C',
      supplierId: 'sup-3',
      invoiceDate: '2026-03-25',
      totalAmount: 750,
      paidAmount: 0,
      paymentMethod: 'credit',
      items: [{ id: 'item-3', productName: 'Cable', quantity: 3, unitPrice: 250, totalPrice: 750 }],
      notes: '',
      createdBy: 'tester',
    });

    expect(second.invoiceNumber).toBe('PI-0002');
    expect(third.invoiceNumber).toBe('PI-0003');
  });

  it('aggregates returned quantities from SQLite-backed return records', async () => {
    const records: Array<Record<string, unknown>> = [];
    let nextSequence = 0;

    const sendSync = vi.fn((channel: string, ...args: unknown[]) => {
      if (channel === 'db-sync:returns:get') return records;
      if (channel === 'db-sync:returns:add') {
        const payload = args[0] as Record<string, unknown>;
        nextSequence += 1;
        const row = {
          ...payload,
          id: `ret-${nextSequence}`,
          returnNumber: `RET-${String(nextSequence).padStart(4, '0')}`,
          createdAt: '2026-03-25T00:00:00.000Z',
        };
        records.unshift(row);
        return row;
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const { addReturnRecord, getReturnedQuantitiesBySaleId } = await import('@/data/returnsData');

    addReturnRecord({
      originalInvoiceNumber: 'INV-001',
      originalSaleId: 'sale-1',
      date: '2026-03-25',
      items: [
        { productId: 'prod-1', name: 'Phone', qty: 1, price: 100, reason: '' },
        { productId: 'prod-2', name: 'Case', qty: 2, price: 50, reason: '' },
      ],
      totalRefund: 200,
      reason: 'Test',
      processedBy: 'user-1',
    });

    addReturnRecord({
      originalInvoiceNumber: 'INV-001',
      originalSaleId: 'sale-1',
      date: '2026-03-26',
      items: [{ productId: 'prod-1', name: 'Phone', qty: 2, price: 100, reason: '' }],
      totalRefund: 200,
      reason: 'Test',
      processedBy: 'user-1',
    });

    expect(getReturnedQuantitiesBySaleId('sale-1')).toEqual({
      'prod-1': 3,
      'prod-2': 2,
    });
  });

  it('builds shift summaries from the SQLite summary handler', async () => {
    const sendSync = vi.fn((channel: string) => {
      if (channel === 'db-sync:shift_closings:get') return [];
      if (channel === 'db-sync:shift_closings:buildSummary') {
        return {
          shiftDate: '2026-03-27',
          closedAt: '2026-03-27T18:00:00.000Z',
          closedBy: 'Owner',
          salesCount: 3,
          salesCash: 1200,
          salesCard: 400,
          salesTransfer: 0,
          salesTotal: 1600,
          expectedCash: 1200,
          actualCash: 1180,
          cashDifference: -20,
          notes: 'Mismatch',
        };
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const { buildShiftSummary } = await import('@/data/shiftData');
    const summary = buildShiftSummary('Owner', 1180, 'Mismatch');

    expect(summary).toEqual(expect.objectContaining({
      salesCount: 3,
      salesTotal: 1600,
      cashDifference: -20,
    }));
    expect(sendSync).toHaveBeenCalledWith('db-sync:shift_closings:buildSummary', 'Owner', 1180, 'Mismatch');
  });

  it('writes stock movements and audit logs through SQLite bulk handlers', async () => {
    const movements: Array<Record<string, unknown>> = [];
    const auditEntries: Array<Record<string, unknown>> = [];
    const sendSync = vi.fn((channel: string, ...args: unknown[]) => {
      if (channel === 'db-sync:stock_movements:get') return movements;
      if (channel === 'db-sync:stock_movements:addBulk') {
        const payload = args[0] as Array<Record<string, unknown>>;
        movements.unshift(...payload);
        return payload;
      }
      if (channel === 'db-sync:audit_logs:get') return auditEntries;
      if (channel === 'db-sync:audit_logs:addBulk') {
        const payload = args[0] as Array<Record<string, unknown>>;
        auditEntries.unshift(...payload);
        return payload;
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const { saveMovements, getAllMovements } = await import('@/repositories/stockRepository');
    const { saveAuditEntries, getAllAuditEntries } = await import('@/repositories/auditRepository');

    saveMovements([
      {
        id: 'mv-1',
        productId: 'prod-1',
        type: 'sale',
        quantityChange: -1,
        previousQuantity: 5,
        newQuantity: 4,
        reason: 'Sale',
        referenceId: 'sale-1',
        userId: 'user-1',
        timestamp: '2026-03-27T10:00:00.000Z',
      },
    ]);
    saveAuditEntries([
      {
        id: 'aud-1',
        userId: 'user-1',
        action: 'sale_completed',
        entityType: 'sale',
        entityId: 'sale-1',
        beforeState: null,
        afterState: { total: 1000 },
        machineId: 'machine-1',
        timestamp: '2026-03-27T10:00:00.000Z',
      },
    ]);

    expect(getAllMovements()).toHaveLength(1);
    expect(getAllAuditEntries()).toHaveLength(1);
    expect(sendSync).toHaveBeenCalledWith('db-sync:stock_movements:addBulk', expect.any(Array));
    expect(sendSync).toHaveBeenCalledWith('db-sync:audit_logs:addBulk', expect.any(Array));
  });

  it('reads category collections from SQLite and persists keyed category lists', async () => {
    const categoryRows: Array<Record<string, unknown>> = [
      { id: 'cat-1', name: 'موبايلات', inventoryType: 'mobile_device' },
    ];
    const settings = new Map<string, unknown>([
      [STORAGE_KEYS.LEGACY_CATEGORIES, ['Phones', 'Tablets']],
      ['computers_cats', ['Laptops', 'Gaming']],
    ]);
    const sendSync = vi.fn((channel: string, ...args: unknown[]) => {
      if (channel === 'db-sync:categories:get') return categoryRows;
      if (channel === 'db-sync:categories:replaceAll') {
        const payload = args[0] as Array<Record<string, unknown>>;
        categoryRows.splice(0, categoryRows.length, ...payload);
        return categoryRows;
      }
      if (channel === 'db-sync:settings:get-json') {
        return settings.get(String(args[0])) ?? null;
      }
      if (channel === 'db-sync:settings:set-json') {
        settings.set(String(args[0]), args[1]);
        return args[1];
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const { addCategory, getCategories, getLegacyCategories, loadCats, saveCats } = await import('@/data/categoriesData');

    expect(getCategories()).toEqual([
      expect.objectContaining({
        id: 'cat-1',
        section: 'mobile',
        type: 'device',
        name: 'موبايلات',
      }),
    ]);
    expect(getLegacyCategories()).toEqual(['Phones', 'Tablets']);
    expect(loadCats('computers_cats', ['Fallback'])).toEqual(['Laptops', 'Gaming']);

    saveCats('computers_cats', ['Laptops', 'Workstations', 'Laptops']);
    expect(loadCats('computers_cats', [])).toEqual(['Laptops', 'Workstations']);

    addCategory({ section: 'computer', name: 'طابعات', type: 'device' });
    expect(sendSync).toHaveBeenCalledWith('db-sync:categories:replaceAll', expect.any(Array));
    expect(categoryRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ inventoryType: 'computer_device', name: 'طابعات' }),
    ]));
  });

  it('seeds and updates users through the SQLite bridge', async () => {
    const users: Array<Record<string, unknown>> = [];
    const settings = new Map<string, unknown>([
      [STORAGE_KEYS.RECOVERY_CODE, 'GX-LOCKED'],
    ]);
    const sendSync = vi.fn((channel: string, ...args: unknown[]) => {
      if (channel === 'db-sync:users:get') return users;
      if (channel === 'db-sync:users:replaceAll') {
        const payload = args[0] as Array<Record<string, unknown>>;
        users.splice(0, users.length, ...payload);
        return users;
      }
      if (channel === 'db-sync:settings:get-json') {
        return settings.get(String(args[0])) ?? null;
      }
      if (channel === 'db-sync:settings:set-json') {
        settings.set(String(args[0]), args[1]);
        return args[1];
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const {
      MASTER_RECOVERY_CODE,
      addUser,
      changePassword,
      findUserByUsername,
      getUsers,
      verifyRecoveryCode,
    } = await import('@/data/usersData');

    const initialUsers = getUsers();
    expect(initialUsers[0]).toEqual(expect.objectContaining({
      username: 'admin',
      role: 'owner',
      mustChangePassword: true,
    }));
    expect(MASTER_RECOVERY_CODE).toBe('GX-LOCKED');
    expect(verifyRecoveryCode('gx-locked')).toBe(true);

    addUser({
      username: 'cashier',
      password: '123456',
      fullName: 'Cashier',
      role: 'employee',
      permissions: ['pos'],
      active: true,
      mustChangePassword: false,
    });

    expect(findUserByUsername('cashier')).toEqual(expect.objectContaining({
      fullName: 'Cashier',
      permissions: ['pos'],
    }));

    const changed = await changePassword('admin', 'admin1234');
    expect(changed).toBe(true);
    expect(getUsers()[0]).toEqual(expect.objectContaining({
      username: 'admin',
      mustChangePassword: false,
      salt: expect.any(String),
    }));
    expect(sendSync).toHaveBeenCalledWith('db-sync:users:replaceAll', expect.any(Array));
  });

  it('persists product batches through SQLite and keeps weighted cost accurate', async () => {
    const batches: Array<Record<string, unknown>> = [];
    const sendSync = vi.fn((channel: string, ...args: unknown[]) => {
      if (channel === 'db-sync:product_batches:get') return batches;
      if (channel === 'db-sync:product_batches:add') {
        const payload = args[0] as Record<string, unknown>;
        const row = { ...payload, id: String(payload.id ?? `batch-${batches.length + 1}`) };
        batches.push(row);
        return row;
      }
      if (channel === 'db-sync:product_batches:update') {
        const id = String(args[0]);
        const payload = args[1] as Record<string, unknown>;
        const index = batches.findIndex((batch) => batch.id === id);
        if (index >= 0) {
          batches[index] = { ...batches[index], ...payload, id };
        }
        return batches[index] ?? null;
      }
      if (channel === 'db-sync:product_batches:delete') {
        const id = String(args[0]);
        const index = batches.findIndex((batch) => batch.id === id);
        if (index >= 0) {
          batches.splice(index, 1);
          return true;
        }
        return false;
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const {
      addBatch,
      getTotalAvailableQty,
      getWeightedAvgCost,
      restoreBatchQty,
      updateBatchQty,
    } = await import('@/data/batchesData');

    const first = addBatch({
      productId: 'prod-1',
      inventoryType: 'mobile',
      productName: 'Galaxy A',
      costPrice: 100,
      salePrice: 150,
      quantity: 1,
      remainingQty: 1,
      purchaseDate: '2026-03-01',
      supplier: 'A',
      notes: '',
    });
    addBatch({
      productId: 'prod-1',
      inventoryType: 'mobile',
      productName: 'Galaxy A',
      costPrice: 200,
      salePrice: 260,
      quantity: 3,
      remainingQty: 3,
      purchaseDate: '2026-03-02',
      supplier: 'B',
      notes: '',
    });

    expect(getTotalAvailableQty('prod-1')).toBe(4);
    expect(getWeightedAvgCost('prod-1')).toBe(175);

    updateBatchQty(first.id, 0);
    expect(getTotalAvailableQty('prod-1')).toBe(3);
    expect(getWeightedAvgCost('prod-1')).toBe(200);

    restoreBatchQty(first.id, 1);
    expect(getTotalAvailableQty('prod-1')).toBe(4);
    expect(getWeightedAvgCost('prod-1')).toBe(175);
    expect(sendSync).toHaveBeenCalledWith('db-sync:product_batches:update', first.id, expect.any(Object));
  });

  it('reads and soft-deletes cars through the SQLite bridge', async () => {
    const cars: Array<Record<string, unknown>> = [];
    const sendSync = vi.fn((channel: string, ...args: unknown[]) => {
      if (channel === 'db-sync:cars:get') return cars;
      if (channel === 'db-sync:cars:add') {
        const payload = args[0] as Record<string, unknown>;
        const row = { ...payload, id: String(payload.id ?? `car-${cars.length + 1}`) };
        cars.unshift(row);
        return row;
      }
      if (channel === 'db-sync:cars:update') {
        const id = String(args[0]);
        const payload = args[1] as Record<string, unknown>;
        const index = cars.findIndex((car) => car.id === id);
        if (index >= 0) {
          cars[index] = { ...cars[index], ...payload, id };
        }
        return cars[index] ?? null;
      }
      if (channel === 'db-sync:cars:delete') return true;
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const { addCar, deleteCar, getCars, getCarsCapital } = await import('@/data/carsData');

    const created = addCar({
      name: 'Toyota Corolla',
      model: 'Corolla',
      year: 2024,
      color: 'White',
      plateNumber: 'س ب 1234',
      licenseExpiry: '2027-03-01',
      condition: 'new',
      category: 'Sedan',
      purchasePrice: 800000,
      salePrice: 900000,
      notes: '',
      warehouseId: '',
      isArchived: false,
      deletedAt: null,
    });

    expect(getCars()).toHaveLength(1);
    expect(getCarsCapital()).toBe(800000);

    deleteCar(created.id);
    expect(getCars()).toHaveLength(0);
    expect(sendSync).toHaveBeenCalledWith('db-sync:cars:update', created.id, expect.objectContaining({
      isArchived: true,
    }));
  });

  it('writes warehouse items through SQLite and recalculates warehouse capital', async () => {
    const items: Array<Record<string, unknown>> = [];
    const sendSync = vi.fn((channel: string, ...args: unknown[]) => {
      if (channel === 'db-sync:warehouse_items:get') return items;
      if (channel === 'db-sync:warehouse_items:add') {
        const payload = args[0] as Record<string, unknown>;
        const row = { ...payload, id: String(payload.id ?? `wh-${items.length + 1}`) };
        items.unshift(row);
        return row;
      }
      if (channel === 'db-sync:warehouse_items:update') {
        const id = String(args[0]);
        const payload = args[1] as Record<string, unknown>;
        const index = items.findIndex((item) => item.id === id);
        if (index >= 0) {
          items[index] = { ...items[index], ...payload, id };
        }
        return items[index] ?? null;
      }
      if (channel === 'db-sync:warehouse_items:delete') {
        const id = String(args[0]);
        const index = items.findIndex((item) => item.id === id);
        if (index >= 0) {
          items.splice(index, 1);
          return true;
        }
        return false;
      }
      return null;
    });

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { sendSync } },
    });

    const {
      addWarehouseItem,
      getWarehouseCapital,
      getWarehouseCategories,
      getWarehouseItems,
      updateWarehouseItem,
    } = await import('@/data/warehouseData');

    const created = addWarehouseItem({
      name: 'USB Cable',
      category: 'Cables',
      quantity: 5,
      costPrice: 20,
      notes: '',
      addedBy: 'Owner',
    });

    expect(getWarehouseItems()).toHaveLength(1);
    expect(getWarehouseCategories()).toEqual(['Cables']);
    expect(getWarehouseCapital()).toBe(100);

    updateWarehouseItem(created.id, { quantity: 8, costPrice: 25 });
    expect(getWarehouseCapital()).toBe(200);
    expect(sendSync).toHaveBeenCalledWith('db-sync:warehouse_items:update', created.id, expect.any(Object));
  });
});
