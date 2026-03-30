import { test } from '@playwright/test';
import { expectHealthyPage, loginAsOwner, seedApp } from './support/app';

const routes = [
  '/',
  '/pos',
  '/inventory',
  '/sales',
  '/returns',
  '/mobiles',
  '/mobiles/accessories',
  '/mobiles/spare-parts',
  '/computers',
  '/computers/accessories',
  '/computers/spare-parts',
  '/devices',
  '/devices/accessories',
  '/devices/spare-parts',
  '/cars',
  '/cars/spare-parts',
  '/cars/oils',
  '/warehouse',
  '/used-inventory',
  '/maintenance',
  '/maintenance/parts',
  '/installments',
  '/expenses',
  '/damaged',
  '/other-revenue',
  '/settings',
  '/users',
  '/barcodes',
  '/customers',
  '/wallets',
  '/employees',
  '/help',
  '/suppliers',
  '/blacklist',
  '/reminders',
  '/shift-closing',
  '/purchase-invoices',
  '/reports',
  '/diagnostics',
] as const;

test.beforeEach(async ({ page }) => {
  await seedApp(page);
  await loginAsOwner(page);
});

for (const route of routes) {
  test(`opens ${route}`, async ({ page }) => {
    await expectHealthyPage(page, route);
  });
}
