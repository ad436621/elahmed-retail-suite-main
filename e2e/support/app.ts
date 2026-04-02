import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

const ALL_PERMISSIONS = [
  'dashboard',
  'pos',
  'sales',
  'inventory',
  'used',
  'stocktake',
  'mobiles',
  'computers',
  'devices',
  'cars',
  'warehouse',
  'maintenance',
  'installments',
  'expenses',
  'damaged',
  'otherRevenue',
  'returns',
  'settings',
  'users',
  'customers',
  'wallets',
  'employees',
  'suppliers',
  'blacklist',
  'reminders',
  'shiftClosing',
  'purchaseInvoices',
  'partners',
] as const;

type SeedOptions = {
  repairs?: Array<Record<string, unknown>>;
};

type StructuredBackup = Record<string, unknown>;

function buildLocalStorageState(options: SeedOptions = {}) {
  const now = '2026-03-28T08:00:00.000Z';

  return {
    gx_users: [
      {
        id: 'owner-e2e',
        username: 'admin',
        password: 'admin123',
        fullName: 'مالك الاختبار',
        role: 'owner',
        permissions: [...ALL_PERMISSIONS],
        active: true,
        createdAt: now,
        updatedAt: now,
        mustChangePassword: false,
      },
    ],
    gx_repairs: options.repairs ?? [],
    gx_repair_parts: [],
    gx_other_revenue_v1: [],
    gx_maintenance_orders_v1: [],
    app_settings: {
      companyName: 'GLEAMEX',
      branchName: 'Main Branch',
      logoUrl: '/logo.png',
    },
    'elahmed-theme': 'light',
    'elahmed-lang': 'ar',
  };
}

function normalizeSalesWithProfit(rawSales: unknown): unknown[] {
  if (!Array.isArray(rawSales)) {
    return [];
  }

  return rawSales.map((sale) => {
    if (!sale || typeof sale !== 'object') {
      return sale;
    }

    const record = sale as Record<string, unknown>;
    const items = Array.isArray(record.items) ? record.items : [];
    const currentGrossProfit = Number(record.grossProfit ?? 0);
    if (currentGrossProfit > 0 || items.length === 0) {
      return record;
    }

    const totalCost = items.reduce((sum, item) => {
      if (!item || typeof item !== 'object') {
        return sum;
      }

      const line = item as Record<string, unknown>;
      const cost = Number(line.cost ?? line.costPrice ?? 0);
      const qty = Number(line.qty ?? line.quantity ?? 1);
      return sum + (cost * qty);
    }, 0);

    const total = Number(record.total ?? record.subtotal ?? 0);

    return {
      ...record,
      totalCost,
      grossProfit: total - totalCost,
    };
  });
}

function mapMaintenanceStatus(status: unknown): string {
  switch (String(status ?? '').toLowerCase()) {
    case 'done':
    case 'completed':
      return 'completed';
    case 'in_progress':
      return 'repairing';
    case 'waiting_for_parts':
      return 'waiting_parts';
    default:
      return String(status ?? 'received') || 'received';
  }
}

function mapMaintenanceOrdersToRepairs(rawOrders: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(rawOrders)) {
    return [];
  }

  return rawOrders.map((order) => {
    const record = (order && typeof order === 'object' ? order : {}) as Record<string, unknown>;

    return {
      id: String(record.id ?? crypto.randomUUID()),
      ticket_no: String(record.orderNumber ?? record.id ?? ''),
      customer_name: String(record.customerName ?? ''),
      customer_phone: String(record.customerPhone ?? ''),
      device_category: String(record.deviceCategory ?? 'mobile'),
      device_brand: String(record.deviceBrand ?? ''),
      device_model: String(record.deviceName ?? ''),
      imei_or_serial: String(record.imeiOrSerial ?? ''),
      issue_description: String(record.issueDescription ?? record.description ?? ''),
      accessories_received: '',
      device_passcode: '',
      status: mapMaintenanceStatus(record.status),
      package_price: Number(record.totalCost ?? 0),
      final_cost: Number(record.totalSale ?? record.finalCost ?? 0),
      createdAt: String(record.createdAt ?? new Date().toISOString()),
      updatedAt: String(record.updatedAt ?? record.createdAt ?? new Date().toISOString()),
    };
  });
}

function reduceSettings(settings: unknown): Record<string, unknown> {
  if (!Array.isArray(settings)) {
    return {};
  }

  return settings.reduce<Record<string, unknown>>((acc, entry) => {
    if (!entry || typeof entry !== 'object') {
      return acc;
    }

    const item = entry as Record<string, unknown>;
    if (typeof item.key === 'string') {
      acc[item.key] = item.value;
    }
    return acc;
  }, {});
}

function structuredBackupToLocalStorageState(backup: StructuredBackup) {
  const settings = reduceSettings(backup.settings);
  const maintenanceOrders = Array.isArray(backup.maintenances) ? backup.maintenances : [];
  const repairTickets = Array.isArray(backup.repairTickets) && backup.repairTickets.length > 0
    ? backup.repairTickets
    : mapMaintenanceOrdersToRepairs(maintenanceOrders);

  return {
    gx_users: Array.isArray(backup.users) ? backup.users : [],
    gx_mobiles_v2: Array.isArray(backup.mobiles) ? backup.mobiles : [],
    gx_computers_v2: Array.isArray(backup.computers) ? backup.computers : [],
    gx_devices_v2: Array.isArray(backup.devices) ? backup.devices : [],
    gx_cars: Array.isArray(backup.cars) ? backup.cars : [],
    gx_car_oils: Array.isArray(backup.carOils) ? backup.carOils : [],
    gx_car_spare_parts: Array.isArray(backup.carSpareParts) ? backup.carSpareParts : [],
    gx_used_devices_v1: Array.isArray(backup.usedDevices) ? backup.usedDevices : [],
    gx_mobile_accessories_v1: Array.isArray(backup.mobileAccessories) ? backup.mobileAccessories : [],
    gx_computer_accessories_v1: Array.isArray(backup.computerAccessories) ? backup.computerAccessories : [],
    gx_device_accessories_v1: Array.isArray(backup.deviceAccessories) ? backup.deviceAccessories : [],
    gx_mobile_spare_parts_v1: Array.isArray(backup.mobileSpareParts) ? backup.mobileSpareParts : [],
    gx_computer_spare_parts_v1: Array.isArray(backup.computerSpareParts) ? backup.computerSpareParts : [],
    gx_device_spare_parts_v1: Array.isArray(backup.deviceSpareParts) ? backup.deviceSpareParts : [],
    gx_warehouse_items: Array.isArray(backup.warehouseItems) ? backup.warehouseItems : [],
    gx_product_batches_v1: Array.isArray(backup.batches) ? backup.batches : [],
    gx_products: Array.isArray(backup.products) ? backup.products : [],
    gx_sales_v2: normalizeSalesWithProfit(backup.sales),
    gx_returns_v2: Array.isArray(backup.returns) ? backup.returns : [],
    gx_expenses_v1: Array.isArray(backup.expenses) ? backup.expenses : [],
    gx_other_revenue_v1: Array.isArray(backup.otherRevenue) ? backup.otherRevenue : [],
    gx_damaged_items_v1: Array.isArray(backup.damagedItems) ? backup.damagedItems : [],
    gx_wallets: Array.isArray(backup.wallets) ? backup.wallets : [],
    gx_wallet_transactions: Array.isArray(backup.walletTransactions) ? backup.walletTransactions : [],
    gx_purchase_invoices: Array.isArray(backup.purchaseInvoices) ? backup.purchaseInvoices : [],
    gx_shift_closings: Array.isArray(backup.shiftClosings) ? backup.shiftClosings : [],
    gx_stock_movements_v2: Array.isArray(backup.stockMovements) ? backup.stockMovements : [],
    gx_audit_logs_v2: Array.isArray(backup.auditLogs) ? backup.auditLogs : [],
    gx_customers: Array.isArray(backup.customers) ? backup.customers : [],
    gx_suppliers: Array.isArray(backup.suppliers) ? backup.suppliers : [],
    gx_supplier_transactions: Array.isArray(backup.supplierTransactions) ? backup.supplierTransactions : [],
    gx_employees: Array.isArray(backup.employees) ? backup.employees : [],
    gx_partners: Array.isArray(backup.partners) ? backup.partners : [],
    gx_blacklist: Array.isArray(backup.blacklist) ? backup.blacklist : [],
    gx_reminders: Array.isArray(backup.reminders) ? backup.reminders : [],
    gx_salary_records: Array.isArray(backup.salaryRecords) ? backup.salaryRecords : [],
    gx_advances: Array.isArray(backup.advances) ? backup.advances : [],
    gx_maintenance_orders_v1: maintenanceOrders,
    gx_installments_v1: Array.isArray(backup.installments) ? backup.installments : [],
    gx_repairs: repairTickets,
    gx_repair_tickets: repairTickets,
    gx_repair_parts: Array.isArray(backup.repairParts) ? backup.repairParts : [],
    gx_categories_v1: Array.isArray(backup.categories) ? backup.categories : [],
    app_settings: settings,
    'elahmed-theme': String(settings.theme ?? 'light'),
    'elahmed-lang': String(settings.language ?? 'ar'),
  };
}

async function seedLocalStorage(page: Page, state: Record<string, unknown>) {
  await page.addInitScript(({ localState }) => {
    if (localStorage.getItem('__playwright_seed_applied__') === 'true') {
      return;
    }

    localStorage.clear();
    sessionStorage.clear();

    for (const [key, value] of Object.entries(localState)) {
      localStorage.setItem(key, JSON.stringify(value));
    }

    localStorage.setItem('__playwright_seed_applied__', 'true');
  }, { localState: state });
}

export async function seedApp(page: Page, options: SeedOptions = {}) {
  await seedLocalStorage(page, buildLocalStorageState(options));
}

export async function seedSampleBackup(page: Page) {
  const rawBackup = readFileSync('sample_backup.json', 'utf8');
  const structuredBackup = JSON.parse(rawBackup) as StructuredBackup;
  await seedLocalStorage(page, structuredBackupToLocalStorageState(structuredBackup));
}

export async function loginAsOwner(page: Page) {
  await page.goto('/login');
  await expect(page.getByTestId('login-submit')).toBeVisible();
  await page.getByTestId('login-username').fill('admin');
  const passwordInput = page.getByTestId('login-password');
  if (await passwordInput.count()) {
    await passwordInput.fill('admin123');
  } else {
    await page.locator('input[type="password"]').first().fill('admin123');
  }
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('app-sidebar')).toBeVisible();
  await expect(page.getByTestId('error-boundary')).toHaveCount(0);
}

function routeToUrlPattern(path: string): RegExp {
  if (path === '/') {
    return /\/$/;
  }

  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}$`);
}

export async function expectHealthyPage(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL(routeToUrlPattern(path));
  await expect(page.getByTestId('app-main')).toBeVisible();
  await expect(page.getByTestId('error-boundary')).toHaveCount(0);
}
