import { expect, type Page } from '@playwright/test';

const ALL_PERMISSIONS = [
  'dashboard',
  'pos',
  'sales',
  'inventory',
  'mobiles',
  'computers',
  'devices',
  'used',
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
] as const;

type SeedOptions = {
  repairs?: Array<Record<string, unknown>>;
};

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
    gx_other_revenue: [],
    gx_maintenance_v2: [],
    app_settings: {
      companyName: 'GLEAMEX',
      branchName: 'Main Branch',
      logoUrl: '/logo.png',
    },
    'elahmed-theme': 'light',
    'elahmed-lang': 'ar',
  };
}

export async function seedApp(page: Page, options: SeedOptions = {}) {
  const localStorageState = buildLocalStorageState(options);

  await page.addInitScript(({ state }) => {
    if (localStorage.getItem('__playwright_seed_applied__') === 'true') {
      return;
    }

    localStorage.clear();
    sessionStorage.clear();

    for (const [key, value] of Object.entries(state)) {
      localStorage.setItem(key, JSON.stringify(value));
    }

    localStorage.setItem('__playwright_seed_applied__', 'true');
  }, { state: localStorageState });
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
