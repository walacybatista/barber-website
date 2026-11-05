import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, E2E_ADMIN_USER } from './admin-fixtures.ts';
import { postForm, postFormResponse, resetLoginAttempts } from './helpers.ts';
import { sessionCookieName } from '../../src/lib/auth/cookie-name.ts';

test.use({ javaScriptEnabled: false });
test.beforeEach(resetLoginAttempts);

test('Action getBooking removida: 404', async () => {
  expect(await postForm('/_actions/getBooking', { token: 'x'.repeat(43) })).toBe(404);
});

test('logout apaga o cookie __Host-session com Secure', async ({ page }) => {
  const name = sessionCookieName(true);
  await page.goto('/admin/login');
  await page.getByLabel('Usuário').fill(E2E_ADMIN_USER);
  await page.getByLabel('Senha').fill(E2E_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const c = (await page.context().cookies()).find((x) => x.name === name);
  expect(c, 'cookie de sessão').toBeDefined();

  const [res] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('logout')),
    page.getByRole('button', { name: 'Sair' }).click(),
  ]);
  const setCookie = (await res.headersArray())
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value)
    // Só o Set-Cookie do cookie de sessão: outro cookie com Secure não pode fazer o teste passar.
    .find((v) => v.startsWith(`${name}=`));
  expect(setCookie).toBeDefined();
  expect(setCookie).toMatch(/;\s*Secure/i);
  expect((await page.context().cookies()).find((x) => x.name === name)).toBeUndefined();

  // Mesma checagem sem navegador (POST direto com o cookie).
  const raw = await postFormResponse('/_actions/logout', {}, { Cookie: `${name}=${c!.value}` });
  const rawCookie = ([] as string[])
    .concat(raw.headers['set-cookie'] ?? [])
    .find((v) => v.startsWith(`${name}=`));
  expect(rawCookie).toBeDefined();
  expect(rawCookie).toMatch(/;\s*Secure/i);
});
