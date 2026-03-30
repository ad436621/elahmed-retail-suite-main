import { expect, test } from '@playwright/test';
import { loginAsOwner, seedApp } from './support/app';

const seededRepair = {
  id: 'repair-e2e-1',
  ticket_no: 'TKT-E2E-1',
  customer_name: 'عميل صيانة',
  customer_phone: '01000000000',
  device_category: 'mobile',
  device_brand: 'Apple',
  device_model: 'iPhone 13',
  imei_or_serial: 'IMEI-E2E-1',
  issue_description: 'تغيير بطارية',
  accessories_received: 'شاحن',
  device_passcode: '1234',
  status: 'repairing',
  package_price: 500,
  final_cost: 650,
  createdAt: '2026-03-28T08:00:00.000Z',
  updatedAt: '2026-03-28T08:00:00.000Z',
};

test.beforeEach(async ({ page }) => {
  await seedApp(page, { repairs: [seededRepair] });
  await loginAsOwner(page);
});

test('creates a maintenance ticket and updates it', async ({ page }) => {
  await page.goto('/maintenance');
  await expect(page.getByTestId('maintenance-page')).toBeVisible();

  await page.getByTestId('maintenance-create-ticket').click();
  await expect(page.getByTestId('maintenance-form-modal')).toBeVisible();

  await page.getByTestId('maintenance-customer-name').fill('عميل جديد');
  await page.getByTestId('maintenance-customer-phone').fill('01111111111');
  await page.getByTestId('maintenance-device-model').fill('Galaxy S24');
  await page.getByTestId('maintenance-device-brand').fill('Samsung');
  await page.getByTestId('maintenance-package-price').fill('800');
  await page.getByTestId('maintenance-final-cost').fill('950');
  await page.getByTestId('maintenance-issue-description').fill('تغيير شاشة وكشف كامل');
  await page.getByTestId('maintenance-status').selectOption('ready');
  await page.getByTestId('maintenance-save').click();

  await expect(page.getByTestId('maintenance-form-modal')).toHaveCount(0);
  const createdRow = page.locator('[data-testid^="maintenance-ticket-"]').filter({ hasText: 'عميل جديد' }).first();
  await expect(createdRow).toBeVisible();
  await expect(createdRow).toContainText('Galaxy S24');

  await createdRow.locator('[data-testid^="maintenance-edit-"]').click();
  await expect(page.getByTestId('maintenance-form-modal')).toBeVisible();

  await page.getByTestId('maintenance-final-cost').fill('1100');
  await page.getByTestId('maintenance-issue-description').fill('تم تحديث التكلفة بعد الفحص');
  await page.getByTestId('maintenance-save').click();

  await expect(page.getByTestId('maintenance-form-modal')).toHaveCount(0);
  await expect(createdRow).toContainText('تم تحديث التكلفة بعد الفحص');

  await page.getByTestId('maintenance-status-repairing').click();
  await expect(page.getByText('عميل صيانة')).toBeVisible();
});
