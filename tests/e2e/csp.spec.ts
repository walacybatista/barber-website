import { expect, test, type Page, type Response } from '@playwright/test';
import { createDb, loadDotEnv } from '../../src/db/client.ts';
import { generateToken } from '../../src/lib/booking/token.ts';
import { E2E_ADMIN_PASSWORD, E2E_ADMIN_USER } from './admin-fixtures.ts';
import { resetLoginAttempts } from './helpers.ts';

/**
 * CSP (ADR-011 S4): a política (meta em páginas prerenderizadas, header nas SSR) não pode ter
 * 'unsafe-inline' em script-src/style-src e nenhuma página/fluxo pode gerar violação.
 */
test.beforeEach(resetLoginAttempts);

/** Coleta violações: mensagens de console do Chromium + evento securitypolicyviolation. */
async function watchViolations(page: Page): Promise<string[]> {
  const found: string[] = [];
  page.on('console', (m) => {
    const t = m.text();
    if (/content security policy/i.test(t) || /securitypolicyviolation/i.test(t)) found.push(t);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(
        `securitypolicyviolation ${e.violatedDirective} ${e.blockedURI} ${e.sample ?? ''}`,
      );
    });
  });
  return found;
}

/** Política efetiva: header Content-Security-Policy OU <meta http-equiv>. */
async function policyOf(page: Page, res: Response | null): Promise<string> {
  const header = res?.headers()['content-security-policy'];
  if (header) return header;
  const meta = await page
    .locator('meta[http-equiv="content-security-policy" i]')
    .getAttribute('content');
  return meta ?? '';
}

function expectStrictPolicy(policy: string) {
  expect(policy).not.toBe('');
  const directive = (name: string) =>
    policy
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith(`${name} `));
  const script = directive('script-src');
  const style = directive('style-src');
  expect(script).toBeTruthy();
  expect(script).not.toContain("'unsafe-inline'");
  expect(style).toBeTruthy();
  expect(style).not.toContain("'unsafe-inline'");
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("object-src 'none'");
}

async function visit(page: Page, path: string, found: string[], opts: { ssr?: boolean } = {}) {
  const res = await page.goto(path);
  expect(res?.status()).toBe(200);
  // Rotas SSR: o header precisa existir (meta sozinho não vale).
  if (opts.ssr)
    expect(res?.headers()['content-security-policy'], `header CSP em ${path}`).toBeTruthy();
  expectStrictPolicy(await policyOf(page, res));
  await page.waitForLoadState('load');
  // Todo script inline executável precisa ter o hash na política (guarda contra drift de hash).
  const policy = await policyOf(page, res);
  const inline = await page.evaluate(async () => {
    const out: string[] = [];
    for (const el of document.querySelectorAll('script:not([src])')) {
      if (el.getAttribute('type') === 'application/ld+json') continue;
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(el.textContent));
      out.push('sha256-' + btoa(String.fromCharCode(...new Uint8Array(buf))));
    }
    return out;
  });
  for (const h of inline) expect(policy, `hash ${h} fora da política`).toContain(`'${h}'`);
  await page.waitForTimeout(300);
  expect(found, `violações em ${path}`).toEqual([]);
}

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

/** Agendamento confirmado direto no banco e2e (+60 dias, longe dos outros specs). */
async function insertBooking(days = 60): Promise<string> {
  loadDotEnv();
  const url = process.env.E2E_DATABASE_URL;
  if (!url || !/_e2e$/.test(new URL(url).pathname)) throw new Error('E2E_DATABASE_URL inválida');
  const { sql } = createDb(url, { max: 1 });
  try {
    const { token, hash } = generateToken();
    const [svc] = await sql`select id, duration_min from services where slug = 'corte-classico'`;
    const [bar] = await sql`select id from barbers where slug = 'rafael-quintao'`;
    const startAt = new Date(Math.floor((Date.now() + days * 86_400_000) / 3_600_000) * 3_600_000);
    const endAt = new Date(startAt.getTime() + Number(svc.duration_min) * 60_000);
    await sql.begin(async (tx) => {
      const [b] = await tx`
      insert into bookings (service_id, barber_id, customer_name, customer_phone, start_at, end_at, status, manage_token_hash, consent_at)
      values (${svc.id}, ${bar.id}, 'Csp Teste', '11988009999', ${startAt.toISOString()}::timestamptz, ${endAt.toISOString()}::timestamptz, 'confirmed'::booking_status, ${hash}, now())
      returning id`;
      await tx`
      insert into busy_periods (barber_id, period, booking_id)
      values (${bar.id}, tstzrange(${startAt.toISOString()}::timestamptz, ${endAt.toISOString()}::timestamptz), ${b.id})`;
    });
    return token;
  } finally {
    await sql.end();
  }
}

test.describe('CSP sem violações', () => {
  test('home', async ({ page }) => {
    const found = await watchViolations(page);
    await visit(page, '/', found);
  });

  test('agendar passo 3 com data', async ({ page }) => {
    const found = await watchViolations(page);
    await visit(
      page,
      `/agendar?servico=corte-classico&barbeiro=rafael-quintao&data=${openDay(20)}`,
      found,
      { ssr: true },
    );
    await expect(page.getByRole('navigation', { name: 'Etapas do agendamento' })).toBeVisible();
  });

  test('gestão por token', async ({ page }) => {
    const token = await insertBooking();
    const found = await watchViolations(page);
    await visit(page, `/agendamento/${token}`, found, { ssr: true });
  });

  test('reagendar por token (SSR)', async ({ page }) => {
    const token = await insertBooking(61);
    const found = await watchViolations(page);
    await visit(page, `/agendamento/${token}/reagendar`, found, { ssr: true });
  });

  test('privacidade', async ({ page }) => {
    const found = await watchViolations(page);
    await visit(page, '/privacidade', found);
  });

  test('admin login e agenda logado', async ({ page }) => {
    const found = await watchViolations(page);
    await visit(page, '/admin/login', found, { ssr: true });
    await page.getByLabel('Usuário').fill(E2E_ADMIN_USER);
    await page.getByLabel('Senha').fill(E2E_ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await visit(page, '/admin', found, { ssr: true });
    await visit(page, '/admin/bloqueios/novo', found, { ssr: true });
  });

  test('home a 360px: menu aberto e mapa carregado', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.route('**://maps.google.com/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>mapa</title><p>mapa mock</p>',
      }),
    );
    const found = await watchViolations(page);
    await visit(page, '/', found);

    const menu = page.getByRole('button', { name: 'Menu' });
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    // Menu aberto trava o scroll via CSSOM (document.body.style), permitido sob CSP.
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');

    await page.getByRole('button', { name: 'Carregar mapa' }).click();
    await expect(page.locator('iframe[title^="Mapa"]')).toHaveCount(1);
    await expect(page.locator('iframe[title^="Mapa"]')).toBeFocused();
    await page.waitForTimeout(300);
    expect(found).toEqual([]);
  });
});
