import { request } from 'node:http';
import { expect, test, type Page } from '@playwright/test';
import {
  E2E_ADMIN_PASSWORD,
  E2E_ADMIN_USER,
  E2E_AGENDA_CUSTOMER,
  E2E_AGENDA_DATE,
  E2E_XSS_CUSTOMER,
} from './admin-fixtures.ts';
import { E2E_PORT, ORIGIN, resetLoginAttempts } from './helpers.ts';

/**
 * Painel admin (login, logout, agenda somente leitura). O admin e o agendamento da agenda são
 * criados pelo globalSetup no banco barber_e2e. Cada login consome do limite de tentativas por IP
 * (20/15 min, zerado a cada execução): esta suíte faz poucos logins.
 */
test.use({ javaScriptEnabled: false });
test.beforeEach(resetLoginAttempts);

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Usuário').fill(E2E_ADMIN_USER);
  await page.getByLabel('Senha').fill(E2E_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe('acesso sem sessão', () => {
  for (const path of ['/admin', '/admin/', '/%61dmin', '/admin?data=2031-03-12']) {
    test(`${path} redireciona para o login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
      await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    });
  }

  test('POST em /_actions/createTimeBlock sem cookie responde 401', async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const body = JSON.stringify({
        barberId: 1,
        startAt: '2031-03-12T13:00:00Z',
        endAt: '2031-03-12T14:00:00Z',
      });
      const req = request(
        {
          host: 'localhost',
          port: E2E_PORT,
          method: 'POST',
          path: '/_actions/createTimeBlock',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            Origin: ORIGIN,
            Host: `localhost:${E2E_PORT}`,
          },
        },
        (res) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode ?? 0));
        },
      );
      req.on('error', reject);
      req.end(body);
    });
    expect(status).toBe(401);
  });
});

test.describe('login e logout', () => {
  test('credenciais erradas mostram erro genérico', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByLabel('Usuário')).toHaveAttribute('autocomplete', 'username');
    await expect(page.getByLabel('Senha')).toHaveAttribute('autocomplete', 'current-password');
    await page.getByLabel('Usuário').fill(E2E_ADMIN_USER);
    await page.getByLabel('Senha').fill('senha-errada-123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toContainText('Usuário ou senha inválidos');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('login errado responde 401 na navegação final', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Usuário').fill(E2E_ADMIN_USER);
    await page.getByLabel('Senha').fill('outra-senha-errada');
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().isNavigationRequest() && r.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Entrar' }).click(),
    ]);
    expect(response.status()).toBe(401);
  });

  test('excesso de tentativas responde 429 (usuário isolado)', async ({ page }) => {
    let last = 0;
    for (let i = 0; i < 7 && last !== 429; i++) {
      await page.goto('/admin/login');
      await page.getByLabel('Usuário').fill('rate-limit-e2e');
      await page.getByLabel('Senha').fill('senha-errada-123');
      const [response] = await Promise.all([
        page.waitForResponse(
          (r) => r.request().isNavigationRequest() && r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: 'Entrar' }).click(),
      ]);
      last = response.status();
    }
    expect(last).toBe(429);
    // Aviso (warning) usa role="status" pelo design 6.16; erro usa role="alert".
    await expect(page.getByRole('status')).toContainText('Muitas tentativas');
  });

  test('login correto leva à agenda; logout invalida a sessão', async ({ page, context }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible();
    await expect(page.getByText(E2E_ADMIN_USER, { exact: true })).toBeVisible();
    // Já logado: /admin/login volta para a agenda.
    await page.goto('/admin/login');
    await expect(page).toHaveURL(/\/admin$/);

    const oldSession = (await context.cookies()).find((c) => c.name === 'session');
    expect(oldSession).toBeDefined();

    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login$/);

    // Prova no servidor: o cookie antigo, reposto à mão, não vale mais.
    await context.clearCookies();
    await context.addCookies([oldSession!]);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

test.describe('agenda', () => {
  test('mostra o agendamento do dia, com telefone e status', async ({ page }) => {
    await login(page);
    const response = await page.goto(`/admin?data=${E2E_AGENDA_DATE}`);
    expect(response?.headers()['cache-control']).toBe('no-store');
    await expect(page.getByText(E2E_AGENDA_CUSTOMER)).toBeVisible();
    await expect(page.getByText('(11) 95555-0123')).toBeVisible();
    await expect(page.getByText('10:00 - 10:30')).toBeVisible();
    await expect(page.getByText('Confirmado').first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    // Visão semanal inclui o mesmo agendamento.
    await page.goto(`/admin?data=${E2E_AGENDA_DATE}&visao=semana`);
    await expect(page.getByText(E2E_AGENDA_CUSTOMER)).toBeVisible();
  });

  test('nome de cliente com HTML aparece como texto, sem injetar elemento', async ({ page }) => {
    await login(page);
    for (const q of [`data=${E2E_AGENDA_DATE}`, `data=${E2E_AGENDA_DATE}&visao=semana`]) {
      await page.goto(`/admin?${q}`);
      await expect(
        page.getByRole('cell').filter({ hasText: E2E_XSS_CUSTOMER }).first(),
      ).toBeVisible();
      await expect(page.locator('img[src="x"]')).toHaveCount(0);
    }
  });

  test('parâmetros inválidos não quebram a página', async ({ page }) => {
    await login(page);
    for (const q of [
      'data=lixo',
      'data=2026-02-31',
      'barbeiro=nao-existe',
      'visao=x&data=9999-99-99',
    ]) {
      const response = await page.goto(`/admin?${q}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible();
    }
  });

  test('dia sem agendamentos mostra estado vazio', async ({ page }) => {
    await login(page);
    await page.goto('/admin?data=2031-03-13');
    await expect(page.getByText('Sem agendamentos neste dia.')).toBeVisible();
  });

  for (const width of [360, 768, 1280]) {
    test(`sem rolagem horizontal em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await login(page);
      await page.goto(`/admin?data=${E2E_AGENDA_DATE}`);
      await expect(page.getByText(E2E_AGENDA_CUSTOMER)).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
