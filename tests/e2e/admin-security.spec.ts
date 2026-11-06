import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, E2E_ADMIN_USER } from './admin-fixtures.ts';
import { postForm, resetLoginAttempts } from './helpers.ts';
import { sessionCookieName } from '../../src/lib/auth/cookie-name.ts';

/**
 * Segurança das Actions e páginas admin: CSRF (mesmo com sessão válida), validação com sessão
 * e cabeçalhos de cache/indexação. Cada login consome do limite por IP (zerado a cada teste).
 */
test.use({ javaScriptEnabled: false });
test.beforeEach(resetLoginAttempts);

const VALID_BLOCK = {
  barberId: '1',
  date: '2031-05-12',
  startTime: '10:00',
  endTime: '11:00',
  reason: 'Teste',
};
const CREATE = '/_actions/createTimeBlock';
const DELETE = '/_actions/deleteTimeBlock';

/** Faz login pela página e devolve o cabeçalho Cookie da sessão. */
async function sessionCookie(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/admin/login');
  await page.getByLabel('Usuário').fill(E2E_ADMIN_USER);
  await page.getByLabel('Senha').fill(E2E_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const c = (await page.context().cookies()).find((x) => x.name === sessionCookieName(true));
  expect(c, 'cookie de sessão').toBeDefined();
  return `${c!.name}=${c!.value}`;
}

test.describe('CSRF nas Actions admin (com sessão válida)', () => {
  test('Sec-Fetch-Site cross-site e Origin estranho recebem 403', async ({ page }) => {
    const cookie = await sessionCookie(page);
    const calls: [string, Record<string, string>][] = [
      [CREATE, VALID_BLOCK],
      [DELETE, { blockId: '1' }],
      ['/_actions/setBookingStatus', { bookingId: '1', status: 'completed' }],
    ];
    for (const [path, fields] of calls) {
      expect(
        await postForm(path, fields, { Cookie: cookie, 'Sec-Fetch-Site': 'cross-site' }),
        `${path} cross-site`,
      ).toBe(403);
      expect(
        await postForm(path, fields, {
          Cookie: cookie,
          Origin: 'http://evil.example',
          'Sec-Fetch-Site': '',
        }),
        `${path} Origin estranho`,
      ).toBe(403);
    }
  });
});

test.describe('validação das Actions admin (com sessão válida)', () => {
  test('dados inválidos respondem 400 e bloqueio inexistente 404', async ({ page }) => {
    const cookie = await sessionCookie(page);
    const create = (over: Record<string, string>) =>
      postForm(CREATE, { ...VALID_BLOCK, ...over }, { Cookie: cookie });
    expect(await create({ date: '2026-02-31' }), 'data inexistente').toBe(400);
    expect(await create({ date: '2101-01-01' }), 'data fora do intervalo').toBe(400);
    expect(await create({ startTime: '09:10' }), 'início fora de 15 em 15').toBe(400);
    expect(await create({ reason: 'a'.repeat(121) }), 'motivo com 121 caracteres').toBe(400);
    expect(await postForm(DELETE, { blockId: '999999999' }, { Cookie: cookie })).toBe(404);
  });
});

test.describe('cabeçalhos', () => {
  test('/admin/login: X-Robots-Tag e Cache-Control no-store', async ({ request }) => {
    const res = await request.get('/admin/login');
    expect(res.status()).toBe(200);
    expect(res.headers()['x-robots-tag']).toContain('noindex');
    expect(res.headers()['cache-control']).toBe('no-store');
  });

  test('/admin sem sessão: redirect com no-store e X-Robots-Tag', async ({ request }) => {
    const res = await request.get('/admin', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toContain('/admin/login');
    expect(res.headers()['cache-control']).toBe('no-store');
    expect(res.headers()['x-robots-tag']).toContain('noindex');
  });

  test('/agendamento/<token>: Referrer-Policy no-referrer', async ({ request }) => {
    // Token inexistente: a página 404 também carrega a política (o token vai na URL).
    const res = await request.get(`/agendamento/${'w'.repeat(43)}`);
    expect(res.status()).toBe(404);
    expect(res.headers()['referrer-policy']).toBe('no-referrer');
  });
});
