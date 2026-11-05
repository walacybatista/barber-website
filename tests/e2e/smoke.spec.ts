import { expect, test } from '@playwright/test';

test('home responde 200 com html lang pt-BR', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
});
