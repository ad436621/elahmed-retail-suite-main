import { expect, test, type Page } from '@playwright/test';
import { loginAsOwner, seedSampleBackup } from './support/app';

async function getStoredCount(page: Page, key: string): Promise<number> {
  return page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  }, key);
}

test.beforeEach(async ({ page }) => {
  await seedSampleBackup(page);
  await loginAsOwner(page);
});

test('loads realistic backup data across core desktop flows', async ({ page }) => {
  await page.goto('/mobiles');
  await expect(page.getByText('Samsung Galaxy S24 Ultra')).toBeVisible();

  await page.goto('/sales');
  await expect(page.getByText('INV-0001')).toBeVisible();

  await page.goto('/customers');
  await expect(page.getByText('محمد علي حسن').first()).toBeVisible();

  await page.goto('/maintenance');
  await expect(page.getByTestId('maintenance-page')).toBeVisible();
  await expect(page.getByText('Samsung Galaxy S22')).toBeVisible();
});

test('adds used devices and repair parts on top of restored backup data', async ({ page }) => {
  await page.goto('/used-inventory');
  await expect(page.getByTestId('used-inventory-page')).toBeVisible();

  await page.getByTestId('used-inventory-add').click();
  await expect(page.getByTestId('used-inventory-form-modal')).toBeVisible();
  await page.getByTestId('used-inventory-name').fill('MacBook Air M1 Used');
  await page.getByTestId('used-inventory-model').fill('A2337');
  await page.getByTestId('used-inventory-purchase-price').fill('22000');
  await page.getByTestId('used-inventory-sale-price').fill('25500');
  await page.getByTestId('used-inventory-save').click();

  await expect(page.getByTestId('used-inventory-form-modal')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'MacBook Air M1 Used' })).toBeVisible();
  expect(await getStoredCount(page, 'gx_used_devices_v1')).toBe(1);

  await page.goto('/maintenance/parts');
  await expect(page.getByTestId('repair-parts-page')).toBeVisible();

  await page.getByTestId('repair-parts-add').click();
  await expect(page.getByTestId('repair-parts-form-modal')).toBeVisible();
  await page.getByTestId('repair-parts-name').fill('شاشة iPhone 13 أصلية');
  await page.getByTestId('repair-parts-category').fill('شاشات');
  await page.getByTestId('repair-parts-qty').fill('4');
  await page.getByTestId('repair-parts-unit-cost').fill('1800');
  await page.getByTestId('repair-parts-selling-price').fill('2400');
  await page.getByTestId('repair-parts-save').click();

  await expect(page.getByTestId('repair-parts-form-modal')).toHaveCount(0);
  await expect(page.getByText('شاشة iPhone 13 أصلية')).toBeVisible();
  expect(await getStoredCount(page, 'gx_repair_parts')).toBe(1);
});
