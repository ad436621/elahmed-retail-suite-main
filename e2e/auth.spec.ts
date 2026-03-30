import { expect, test } from '@playwright/test';
import { loginAsOwner, seedApp } from './support/app';

test.beforeEach(async ({ page }) => {
  await seedApp(page);
});

test('redirects guests to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('login-page')).toBeVisible();
});

test('logs in and logs out successfully', async ({ page }) => {
  await loginAsOwner(page);
  await page.getByTestId('logout-button').click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('login-page')).toBeVisible();
});
