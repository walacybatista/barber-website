import { expect, test, type Page } from '@playwright/test';
import {
  E2E_ADMIN_PASSWORD,
  E2E_ADMIN_USER,
  E2E_AGENDA_CUSTOMER,
  E2E_AGENDA_DATE,
  E2E_XSS_CUSTOMER,
} from './admin-fixtures.ts';
import { eq } from 'drizzle-orm';
import { createDb, loadDotEnv } from '../../src/db/client.ts';
import { barbers, services } from '../../src/db/schema.ts';
import { SlotTakenError } from '../../src/lib/booking/errors.ts';
import { createBooking } from '../../src/lib/booking/repository.ts';
import { postForm, resetLoginAttempts } from './helpers.ts';

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

// ---------- Status do atendimento e bloqueios (6c-3b) ----------

/** Data local daqui a `offset` dias, pulando domingos (fechado). */
function openDay(offset: number): string {
  let n = offset;
  for (;;) {
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
      new Date(Date.now() + n * 86_400_000),
    );
    const [y, m, d] = iso.split('-').map(Number);
    if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 0) return iso;
    n++;
  }
}

const PAST_DAY = '2026-10-07'; // quarta-feira passada (hoje no ambiente é posterior)
const PAST_BARBER = 'dandara-veloso';
const PAST = {
  complete: { name: 'Cliente Concluir E2E', at: '13:00' },
  noShow: { name: 'Cliente Falta E2E', at: '14:00' },
  cancel: { name: 'Cliente Cancelar E2E', at: '15:00' },
};
const BLOCK_DAY = openDay(20);
const BLOCK_BARBER = 'dandara-veloso';

function rowOf(page: Page, text: string) {
  return page.getByRole('row').filter({ hasText: text });
}

async function seedPastBookings() {
  loadDotEnv();
  const url = process.env.E2E_DATABASE_URL;
  if (!url || !/_e2e$/.test(new URL(url).pathname)) throw new Error('E2E_DATABASE_URL inválida');
  const { db, sql } = createDb(url, { max: 1 });
  try {
    const [service] = await db.select().from(services).where(eq(services.slug, 'corte-classico'));
    const [barber] = await db.select().from(barbers).where(eq(barbers.slug, PAST_BARBER));
    let i = 0;
    for (const f of Object.values(PAST)) {
      try {
        await createBooking(db, {
          serviceId: service.id,
          barberId: barber.id,
          startAt: new Date(`${PAST_DAY}T${f.at}:00Z`),
          customerName: f.name,
          customerPhone: `1197777000${i++}`,
          consent: true,
          now: new Date('2026-10-01T12:00:00Z'), // contorna a janela de agendamento (RN03)
        });
      } catch (err) {
        if (!(err instanceof SlotTakenError)) throw err; // reexecução: já existe
      }
    }
  } finally {
    await sql.end();
  }
}

async function freeSlotTimes(page: Page, day: string): Promise<number[]> {
  const res = await page.goto(
    `/agendar?servico=corte-classico&barbeiro=${BLOCK_BARBER}&data=${day}`,
  );
  expect(res?.status()).toBe(200);
  const values = await page
    .locator('input[name="hora"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('value')!));
  return values.map((v) => new Date(v).getTime());
}

test.describe('status do atendimento e bloqueios', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(seedPastBookings);

  test('concluir atendimento passado: PRG preserva a URL e mostra aviso', async ({ page }) => {
    await login(page);
    await page.goto(`/admin?data=${PAST_DAY}&barbeiro=${PAST_BARBER}`);
    const row = rowOf(page, PAST.complete.name);
    await expect(row.getByRole('button', { name: 'Não compareceu' })).toBeVisible();
    await expect(row.locator('summary', { hasText: 'Cancelar' })).toBeVisible();
    await row.getByRole('button', { name: 'Concluído' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/admin\\?data=${PAST_DAY}&barbeiro=${PAST_BARBER}&ok=concluido$`),
    );
    await expect(
      page.getByRole('status').filter({ hasText: 'marcado como concluído' }),
    ).toBeVisible();
    await expect(rowOf(page, PAST.complete.name)).toContainText('Concluído');
    await expect(rowOf(page, PAST.complete.name).getByRole('button')).toHaveCount(0);
  });

  test('não compareceu e cancelar (com confirmação) em atendimento passado', async ({ page }) => {
    await login(page);
    await page.goto(`/admin?data=${PAST_DAY}&barbeiro=${PAST_BARBER}`);
    await rowOf(page, PAST.noShow.name).getByRole('button', { name: 'Não compareceu' }).click();
    await expect(page).toHaveURL(/ok=faltou$/);
    await expect(rowOf(page, PAST.noShow.name)).toContainText('Não compareceu');

    const row = rowOf(page, PAST.cancel.name);
    await row.locator('summary', { hasText: 'Cancelar' }).click();
    await row.getByRole('button', { name: 'Confirmar cancelamento' }).click();
    await expect(page).toHaveURL(/ok=cancelado$/);
    await expect(rowOf(page, PAST.cancel.name)).toContainText('Cancelado');
  });

  test('atendimento futuro: sem "Não compareceu"', async ({ page }) => {
    await login(page);
    await page.goto(`/admin?data=${E2E_AGENDA_DATE}`);
    const row = rowOf(page, E2E_AGENDA_CUSTOMER);
    await expect(row.getByRole('button', { name: 'Concluído' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Não compareceu' })).toHaveCount(0);
  });

  test('criar bloqueio: aparece na agenda e o horário some de /agendar; remover devolve', async ({
    page,
  }) => {
    await login(page);
    const start = new Date(`${BLOCK_DAY}T10:00:00-03:00`).getTime();
    const end = new Date(`${BLOCK_DAY}T12:00:00-03:00`).getTime();
    const inside = (t: number) => t >= start && t < end;
    const before = await freeSlotTimes(page, BLOCK_DAY);
    expect(before.some(inside)).toBe(true);

    await page.goto(`/admin?data=${BLOCK_DAY}&barbeiro=${BLOCK_BARBER}`);
    await page.getByRole('link', { name: 'Novo bloqueio' }).click();
    await expect(page.getByRole('heading', { name: 'Novo bloqueio', level: 1 })).toBeVisible();
    await expect(page.getByLabel('Barbeiro')).toHaveValue(/\d+/);
    await expect(page.getByLabel('Data')).toHaveValue(BLOCK_DAY);
    await expect(page.getByText('Não coloque dados pessoais')).toBeVisible();
    await page.getByLabel('Início').selectOption('10:00');
    await page.getByLabel('Fim').selectOption('12:00');
    await page.getByLabel('Motivo (opcional)').fill('Folga E2E');
    await page.getByRole('button', { name: 'Criar bloqueio' }).click();

    await expect(page).toHaveURL(
      new RegExp(`/admin\\?data=${BLOCK_DAY}&barbeiro=${BLOCK_BARBER}&ok=bloqueio-criado$`),
    );
    await expect(page.getByRole('status').filter({ hasText: 'Bloqueio criado.' })).toBeVisible();
    await expect(rowOf(page, 'Folga E2E')).toContainText('10:00 - 12:00');

    const during = await freeSlotTimes(page, BLOCK_DAY);
    expect(during.some(inside)).toBe(false);
    expect(during.length).toBeLessThan(before.length);

    await page.goto(`/admin?data=${BLOCK_DAY}&barbeiro=${BLOCK_BARBER}`);
    const blockRow = rowOf(page, 'Folga E2E');
    await blockRow.locator('summary', { hasText: 'Remover' }).click();
    await blockRow.getByRole('button', { name: 'Confirmar remoção' }).click();
    await expect(page).toHaveURL(/ok=bloqueio-removido$/);
    await expect(page.getByRole('status').filter({ hasText: 'Bloqueio removido.' })).toBeVisible();
    await expect(rowOf(page, 'Folga E2E')).toHaveCount(0);
    expect(await freeSlotTimes(page, BLOCK_DAY)).toEqual(before);
  });

  test('bloqueio sobre atendimento mostra alerta de conflito e mantém os valores', async ({
    page,
  }) => {
    await login(page);
    await page.goto(`/admin/bloqueios/novo?data=${E2E_AGENDA_DATE}&barbeiro=rafael-quintao`);
    await page.getByLabel('Início').selectOption('09:45');
    await page.getByLabel('Fim').selectOption('10:15');
    await page.getByLabel('Motivo (opcional)').fill('Conflito E2E');
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().isNavigationRequest() && r.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Criar bloqueio' }).click(),
    ]);
    expect(response.status()).toBe(409);
    await expect(page.getByRole('status')).toContainText('Há atendimento nesse período');
    await expect(page.getByLabel('Motivo (opcional)')).toHaveValue('Conflito E2E');
    await expect(page.getByLabel('Início')).toHaveValue('09:45');
  });

  test('fim antes do início mostra erro de campo', async ({ page }) => {
    await login(page);
    await page.goto(`/admin/bloqueios/novo?data=${BLOCK_DAY}&barbeiro=${BLOCK_BARBER}`);
    await page.getByLabel('Início').selectOption('14:00');
    await page.getByLabel('Fim').selectOption('13:00');
    await page.getByRole('button', { name: 'Criar bloqueio' }).click();
    await expect(page.getByText('O fim deve ser depois do início.')).toBeVisible();
  });

  test('POST direto das Actions admin (createTimeBlock, deleteTimeBlock, setBookingStatus) sem sessão responde 401', async () => {
    const created = await postForm('/_actions/createTimeBlock', {
      barberId: '1',
      date: BLOCK_DAY,
      startTime: '10:00',
      endTime: '11:00',
      reason: '',
    });
    expect(created).toBe(401);
    expect(await postForm('/_actions/deleteTimeBlock', { blockId: '1' })).toBe(401);
    expect(
      await postForm('/_actions/setBookingStatus', { bookingId: '1', status: 'completed' }),
    ).toBe(401);
  });

  for (const width of [360, 768, 1280]) {
    test(`sem rolagem horizontal em ${width}px (agenda com ações e novo bloqueio)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await login(page);
      for (const url of [
        `/admin?data=${E2E_AGENDA_DATE}`,
        `/admin?data=${E2E_AGENDA_DATE}&visao=semana`,
        `/admin/bloqueios/novo?data=${E2E_AGENDA_DATE}`,
      ]) {
        await page.goto(url);
        await page.getByRole('heading', { level: 1 }).waitFor();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, url).toBeLessThanOrEqual(0);
      }
    });
  }
});
