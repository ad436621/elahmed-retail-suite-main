import { expect, test, type Page } from '@playwright/test';
import { loginAsOwner, seedApp } from './support/app';

async function getStoredCount(page: Page, key: string): Promise<number> {
  return page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.length : 0;
  }, key);
}

test.beforeEach(async ({ page }) => {
  await seedApp(page);
  await loginAsOwner(page);
});

test('adds a mobile unit and blocks duplicate IMEI entries', async ({ page }) => {
  await page.goto('/mobiles');

  await page.getByTestId('mobiles-create-product').click();
  await expect(page.getByTestId('mobiles-form-modal')).toBeVisible();

  await page.getByTestId('mobiles-category').selectOption({ index: 1 });
  await page.getByTestId('mobiles-name').fill('هاتف E2E');
  await page.getByTestId('mobiles-model').fill('QA-Phone');
  await page.getByTestId('mobiles-cost').fill('5000');
  await page.getByTestId('mobiles-sale').fill('5600');
  await page.getByTestId('mobiles-unit-imei1-0').fill('359111111111111');
  await page.getByTestId('mobiles-save').click();

  await expect(page.getByTestId('mobiles-form-modal')).toHaveCount(0);
  expect(await getStoredCount(page, 'gx_mobiles_v2')).toBe(1);

  await page.getByTestId('mobiles-create-product').click();
  await expect(page.getByTestId('mobiles-form-modal')).toBeVisible();

  await page.getByTestId('mobiles-category').selectOption({ index: 1 });
  await page.getByTestId('mobiles-name').fill('هاتف مكرر');
  await page.getByTestId('mobiles-cost').fill('5100');
  await page.getByTestId('mobiles-sale').fill('5700');
  await page.getByTestId('mobiles-unit-imei1-0').fill('359111111111111');
  await page.getByTestId('mobiles-save').click();

  await expect(page.getByTestId('mobiles-form-modal')).toBeVisible();
  expect(await getStoredCount(page, 'gx_mobiles_v2')).toBe(1);
});

test('adds a computer item from the inventory modal', async ({ page }) => {
  await page.goto('/computers');

  await page.getByTestId('computers-create-product').click();
  await expect(page.getByTestId('computers-form-modal')).toBeVisible();

  await page.getByTestId('computers-name').fill('كمبيوتر E2E');
  await page.getByTestId('computers-quantity').fill('3');
  await page.getByTestId('computers-cost').fill('12000');
  await page.getByTestId('computers-sale').fill('14500');
  await page.getByTestId('computers-save').click();

  await expect(page.getByTestId('computers-form-modal')).toHaveCount(0);
  expect(await getStoredCount(page, 'gx_computers_v2')).toBe(1);
  await expect(page.getByTestId('app-main').getByText('كمبيوتر E2E')).toBeVisible();
});

test('adds a device item from the inventory modal', async ({ page }) => {
  await page.goto('/devices');

  await page.getByTestId('devices-create-product').click();
  await expect(page.getByTestId('devices-form-modal')).toBeVisible();

  await page.getByTestId('devices-name').fill('جهاز E2E');
  await page.getByTestId('devices-category').click();
  await page.getByRole('option').first().click();
  await page.getByTestId('devices-quantity').fill('2');
  await page.getByTestId('devices-cost').fill('2300');
  await page.getByTestId('devices-sale').fill('2900');
  await page.getByTestId('devices-save').click();

  await expect(page.getByTestId('devices-form-modal')).toHaveCount(0);
  expect(await getStoredCount(page, 'gx_devices_v2')).toBe(1);
  await expect(page.getByTestId('app-main').getByText('جهاز E2E')).toBeVisible();
});

test('blocks negative numeric values in the devices form', async ({ page }) => {
  await page.goto('/devices');

  await page.getByTestId('devices-create-product').click();
  await expect(page.getByTestId('devices-form-modal')).toBeVisible();

  await page.getByTestId('devices-name').fill('جهاز غير صالح');
  await page.getByTestId('devices-category').click();
  await page.getByRole('option').first().click();
  await page.getByTestId('devices-cost').fill('-5');
  await page.getByTestId('devices-sale').fill('100');
  await page.getByTestId('devices-save').click();

  await expect(page.getByTestId('devices-form-modal')).toBeVisible();
  expect(await getStoredCount(page, 'gx_devices_v2')).toBe(0);
});
