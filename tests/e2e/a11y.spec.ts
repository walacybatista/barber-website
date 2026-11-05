import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createDb, loadDotEnv } from '../../src/db/client.ts';
import { generateToken } from '../../src/lib/booking/token.ts';
import { E2E_ADMIN_PASSWORD, E2E_ADMIN_USER, E2E_AGENDA_DATE } from './admin-fixtures.ts';
import { resetLoginAttempts } from './helpers.ts';

/**
 * Acessibilidade automatizada (WCAG 2.1 A/AA via axe-core). Falha em violações serious/critical;
 * moderate/minor são só listadas no log. O agendamento de fixture fica a ~60 dias (longe dos demais specs).
 */
test.beforeEach(resetLoginAttempts);

const SERVICE = 'corte-classico';
const BARBER = 'rafael-quintao';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

function openDay(offset: number): string {
  let n = offset;
  for (;;) {
    const d = new Date(Date.now() + n * 86_400_000);
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
    const [y, m, day] = iso.split('-').map(Number);
    if (new Date(Date.UTC(y, m - 1, day)).getUTCDay() !== 0) return iso;
    n++;
  }
}
const DAY = openDay(22);

async function audit(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  for (const v of violations.filter((x) => x.impact !== 'serious' && x.impact !== 'critical')) {
    console.log(`[a11y ${v.impact}] ${label}: ${v.id} (${v.nodes.length}) ${v.help}`);
  }
  const blocking = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(blocking, label).toEqual([]);
}

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Usuário').fill(E2E_ADMIN_USER);
  await page.getByLabel('Senha').fill(E2E_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

let token = '';
let tokenHash = '';

test.beforeAll(async () => {
  loadDotEnv();
  const url = process.env.E2E_DATABASE_URL;
  if (!url || !/_e2e$/.test(new URL(url).pathname)) throw new Error('E2E_DATABASE_URL inválida');
  const { sql } = createDb(url, { max: 1 });
  try {
    const t = generateToken();
    token = t.token;
    tokenHash = t.hash;
    const startAt = new Date(Math.floor((Date.now() + 60 * 86_400_000) / 3_600_000) * 3_600_000);
    const [svc] = await sql`select id, duration_min from services where slug = ${SERVICE}`;
    const [bar] = await sql`select id from barbers where slug = ${BARBER}`;
    const endAt = new Date(startAt.getTime() + Number(svc.duration_min) * 60_000);
    await sql.begin(async (tx) => {
      const [b] = await tx`
        insert into bookings (service_id, barber_id, customer_name, customer_phone, start_at, end_at, status, manage_token_hash, consent_at)
        values (${svc.id}, ${bar.id}, 'Joana A11y', '11988009999', ${startAt.toISOString()}::timestamptz, ${endAt.toISOString()}::timestamptz, 'confirmed'::booking_status, ${tokenHash}, now())
        returning id`;
      await tx`
        insert into busy_periods (barber_id, period, booking_id)
        values (${bar.id}, tstzrange(${startAt.toISOString()}::timestamptz, ${endAt.toISOString()}::timestamptz), ${b.id})`;
    });
  } finally {
    await sql.end();
  }
});

test.afterAll(async () => {
  const url = process.env.E2E_DATABASE_URL;
  if (!url || !/_e2e$/.test(new URL(url).pathname) || !tokenHash) return;
  const { sql } = createDb(url, { max: 1 });
  try {
    await sql`delete from busy_periods where booking_id in (select id from bookings where manage_token_hash = ${tokenHash})`;
    await sql`delete from bookings where manage_token_hash = ${tokenHash}`;
  } finally {
    await sql.end();
  }
});

test.describe('páginas públicas', () => {
  for (const path of ['/', '/privacidade', '/agendar', `/agendar?servico=${SERVICE}`]) {
    test(`axe ${path}`, async ({ page }) => {
      await page.goto(path);
      await audit(page, path);
    });
  }

  test('axe /agendar passo 3 (data) e passo 4', async ({ page }) => {
    const step3 = `/agendar?servico=${SERVICE}&barbeiro=${BARBER}&data=${DAY}`;
    await page.goto(step3);
    await audit(page, 'agendar passo 3');
    const hora = await page.locator('input[name="hora"]').first().getAttribute('value');
    expect(hora).toBeTruthy();
    await page.goto(`${step3}&hora=${encodeURIComponent(hora!)}`);
    await audit(page, 'agendar passo 4');
  });

  test('axe gestão e reagendar', async ({ page }) => {
    await page.goto(`/agendamento/${token}`);
    await audit(page, '/agendamento/<token>');
    await page.getByText('Cancelar agendamento', { exact: true }).click();
    await audit(page, '/agendamento/<token> (cancelar aberto)');
    await page.goto(`/agendamento/${token}/reagendar`);
    await audit(page, '/agendamento/<token>/reagendar');
  });

  test('axe home 360px com menu aberto', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    await expect(page.locator('header[data-menu-ready]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Menu' }).click();
    await audit(page, 'home 360 menu aberto');
  });
});

test.describe('admin', () => {
  test('axe login', async ({ page }) => {
    await page.goto('/admin/login');
    await audit(page, '/admin/login');
  });

  test('axe agenda dia/semana e bloqueio', async ({ page }) => {
    await login(page);
    await page.goto(`/admin?data=${E2E_AGENDA_DATE}`);
    await audit(page, '/admin dia');
    await page.goto(`/admin?data=${E2E_AGENDA_DATE}&visao=semana`);
    await audit(page, '/admin semana');
    await page.goto(`/admin/bloqueios/novo?data=${E2E_AGENDA_DATE}&barbeiro=${BARBER}`);
    await audit(page, '/admin/bloqueios/novo');
  });
});
