import http from 'node:http';
import { expect, test, type Page } from '@playwright/test';
import { createDb, loadDotEnv } from '../../src/db/client.ts';
import { E2E_PORT, ORIGIN, postForm } from './helpers.ts';
import { generateToken, hashToken } from '../../src/lib/booking/token.ts';

/**
 * Gestão por token (cancelar/reagendar) SEM JavaScript (ADR-008/010). Agendamentos são criados por SQL
 * no banco e2e (não consomem o rate limit de criação) em dias distintos dos de booking.spec.ts.
 */
test.use({ javaScriptEnabled: false });

const BARBER = 'rafael-quintao';
const SERVICE = 'corte-classico';

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
const DAY_CANCEL = openDay(10);
const DAY_RESCHEDULE = openDay(12);
const DAY_LAYOUT = openDay(14);
const DAY_OVERLAP = openDay(16);

const stepUrl = (data: string) => `/agendar?servico=${SERVICE}&barbeiro=${BARBER}&data=${data}`;

/** Valores ISO dos horários livres do Rafael numa data (lidos da página pública). */
async function freeSlots(page: Page, day: string): Promise<string[]> {
  const res = await page.goto(stepUrl(day));
  expect(res?.status()).toBe(200);
  return page
    .locator('input[name="hora"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('value')!));
}

let phoneSeq = 0;
/** Cria um agendamento confirmado direto no banco e2e e devolve o token. */
async function insertBooking(startAt: Date, status = 'confirmed'): Promise<string> {
  loadDotEnv();
  const url = process.env.E2E_DATABASE_URL;
  if (!url || !/_e2e$/.test(new URL(url).pathname)) throw new Error('E2E_DATABASE_URL inválida');
  const { sql } = createDb(url, { max: 1 });
  try {
    const { token, hash } = generateToken();
    const [svc] = await sql`select id, duration_min from services where slug = ${SERVICE}`;
    const [bar] = await sql`select id from barbers where slug = ${BARBER}`;
    const endAt = new Date(startAt.getTime() + Number(svc.duration_min) * 60_000);
    return await sql.begin(async (tx) => {
      const [b] = await tx`
      insert into bookings (service_id, barber_id, customer_name, customer_phone, start_at, end_at, status, manage_token_hash, consent_at)
      values (${svc.id}, ${bar.id}, 'Joana Teste', ${`1198800${String(1000 + phoneSeq++)}`}, ${startAt.toISOString()}::timestamptz, ${endAt.toISOString()}::timestamptz, ${status}::booking_status, ${hash}, now())
      returning id`;
      await tx`
      insert into busy_periods (barber_id, period, booking_id)
      values (${bar.id}, tstzrange(${startAt.toISOString()}::timestamptz, ${endAt.toISOString()}::timestamptz), ${b.id})`;
      return token;
    });
  } finally {
    await sql.end();
  }
}

/** Status do agendamento direto no banco e2e. */
async function dbStatus(token: string): Promise<string> {
  loadDotEnv();
  const url = process.env.E2E_DATABASE_URL;
  if (!url || !/_e2e$/.test(new URL(url).pathname)) throw new Error('E2E_DATABASE_URL inválida');
  const { sql } = createDb(url, { max: 1 });
  try {
    const [b] =
      await sql`select status from bookings where manage_token_hash = ${hashToken(token)}`;
    return String(b.status);
  } finally {
    await sql.end();
  }
}

/** POST cru com controle total dos cabeçalhos (fetch descarta Origin). */
function rawPost(path: string, headers: Record<string, string>, body?: string) {
  return new Promise<number>((resolve, reject) => {
    const req = http.request(
      {
        host: 'localhost',
        port: E2E_PORT,
        path,
        method: 'POST',
        // Sec-Fetch-Site: same-origin como um navegador (o Astro prioriza esse cabeçalho; só Origin cai em 403).
        headers: {
          Host: `localhost:${E2E_PORT}`,
          Origin: ORIGIN,
          'Sec-Fetch-Site': 'same-origin',
          ...headers,
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode ?? 0));
      },
    );
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

test.describe.serial('gestão por token sem JS', () => {
  test('cancelar: confirmação em 2 passos, PRG e horário volta a ficar livre', async ({ page }) => {
    const slots = await freeSlots(page, DAY_CANCEL);
    const slot = slots[0];
    const token = await insertBooking(new Date(slot));
    expect(await freeSlots(page, DAY_CANCEL)).not.toContain(slot);

    const res = await page.goto(`/agendamento/${token}`);
    expect(res?.status()).toBe(200);
    expect(res?.headers()['cache-control']).toBe('no-store');
    await expect(page.getByRole('link', { name: 'Reagendar' })).toHaveAttribute(
      'href',
      `/agendamento/${token}/reagendar`,
    );
    // Passo 1: o botão final só aparece depois de abrir o <details>.
    await expect(page.getByRole('button', { name: 'Sim, cancelar agendamento' })).toBeHidden();
    await page.getByText('Cancelar agendamento', { exact: true }).click();
    await expect(page.getByText('Tem certeza que quer cancelar?')).toBeVisible();

    const posted = page.waitForResponse((r) => r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Sim, cancelar agendamento' }).click();
    expect((await posted).status()).toBe(303);
    await expect(page).toHaveURL(new RegExp(`/agendamento/${token}$`));
    await expect(page.getByText('Agendamento cancelado')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reagendar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /cancelar/i })).toHaveCount(0);

    expect(await freeSlots(page, DAY_CANCEL)).toContain(slot);
  });

  test('reagendar: novo horário na página e o antigo fica livre', async ({ page }) => {
    const slots = await freeSlots(page, DAY_RESCHEDULE);
    const oldSlot = slots[0];
    const newSlot = slots[slots.length - 1];
    const token = await insertBooking(new Date(oldSlot));

    await page.goto(`/agendamento/${token}`);
    await page.getByRole('link', { name: 'Reagendar' }).click();
    await expect(page).toHaveURL(new RegExp(`/agendamento/${token}/reagendar$`));
    await expect(page.getByRole('heading', { name: 'Reagendar horário' })).toBeVisible();
    await expect(page.getByText('Rafael Quintão')).toBeVisible();

    await page.locator(`a[href*="data=${DAY_RESCHEDULE}"]`).click();
    await expect(page).toHaveURL(new RegExp(`data=${DAY_RESCHEDULE}`));
    // O próprio horário atual é oferecido (ignoreBookingId): o cliente pode mover para horários sobrepostos.
    await expect(page.locator(`input[name="startAt"][value="${oldSlot}"]`)).toHaveCount(1);
    await page.locator(`input[name="startAt"][value="${newSlot}"]`).check({ force: true });
    const posted = page.waitForResponse((r) => r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirmar novo horário' }).click();
    expect((await posted).status()).toBe(303);

    await expect(page).toHaveURL(new RegExp(`/agendamento/${token}\\?reagendado=1$`));
    await expect(page.getByText('Agendamento reagendado')).toBeVisible();
    const expected = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(newSlot));
    await expect(page.locator('dd').filter({ hasText: expected })).toBeVisible();

    const after = await freeSlots(page, DAY_RESCHEDULE);
    expect(after).toContain(oldSlot);
    expect(after).not.toContain(newSlot);
  });

  test('reagendar: conflito mostra Alert e mantém a página', async ({ page }) => {
    const slots = await freeSlots(page, DAY_RESCHEDULE);
    const [a, b] = [slots[1], slots[slots.length - 2]];
    const token = await insertBooking(new Date(a));
    await page.goto(`/agendamento/${token}/reagendar?data=${DAY_RESCHEDULE}`);
    await page.locator(`input[name="startAt"][value="${b}"]`).check({ force: true });
    // Alguém reserva o mesmo horário antes do envio.
    await insertBooking(new Date(b));
    const posted = page.waitForResponse((r) => r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirmar novo horário' }).click();
    expect((await posted).status()).toBe(409);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Esse horário acabou de ser reservado' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reagendar horário' })).toBeVisible();
  });

  test('menos de 2 h: sem botões, com explicação e WhatsApp', async ({ page }) => {
    const token = await insertBooking(new Date(Date.now() + 60 * 60_000));
    const res = await page.goto(`/agendamento/${token}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByText('Faltam menos de 2 horas')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Falar no WhatsApp' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reagendar' })).toHaveCount(0);
    await expect(page.getByText('Cancelar agendamento', { exact: true })).toHaveCount(0);

    await page.goto(`/agendamento/${token}/reagendar`);
    await expect(page.getByText('Faltam menos de 2 horas')).toBeVisible();
    await expect(page.locator('input[name="startAt"]')).toHaveCount(0);
  });

  test('estados concluído e não compareceu', async ({ page }) => {
    const past = new Date(Date.now() - 3 * 86_400_000);
    const done = await insertBooking(past, 'completed');
    await page.goto(`/agendamento/${done}`);
    await expect(page.getByText('Atendimento concluído')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reagendar' })).toHaveCount(0);
    const miss = await insertBooking(new Date(past.getTime() - 3_600_000), 'no_show');
    await page.goto(`/agendamento/${miss}`);
    await expect(page.getByText('Não registramos sua presença')).toBeVisible();
  });

  test('token inválido: 404 nas duas páginas', async ({ page }) => {
    const bad = 'y'.repeat(43);
    expect((await page.goto(`/agendamento/${bad}`))?.status()).toBe(404);
    const res = await page.goto(`/agendamento/${bad}/reagendar`);
    expect(res?.status()).toBe(404);
    expect(res?.headers()['x-robots-tag']).toContain('noindex');
    expect(res?.headers()['referrer-policy']).toBe('no-referrer');
    await expect(page.getByText('Agendamento não encontrado').first()).toBeVisible();
  });

  test('sem scroll horizontal nas duas páginas (360/768/1280)', async ({ page }) => {
    const slots = await freeSlots(page, DAY_LAYOUT);
    const token = await insertBooking(new Date(slots[0]));
    const urls = [`/agendamento/${token}`, `/agendamento/${token}/reagendar?data=${DAY_LAYOUT}`];
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const url of urls) {
        await page.goto(url);
        const { scroll, inner } = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          inner: window.innerWidth,
        }));
        expect(scroll, `${url} @${width}`).toBeLessThanOrEqual(inner);
      }
    }
  });

  test('corpo > 16 KB na Action responde 413', async () => {
    const body = `serviceId=1&pad=${'a'.repeat(20_000)}`;
    const status = await rawPost(
      '/agendar?_action=createBooking',
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(Buffer.byteLength(body)),
      },
      body,
    );
    expect(status).toBe(413);
  });

  test('POST sem content-length em /agendar responde 411', async () => {
    // Sem Content-Length, o node:http usa Transfer-Encoding: chunked.
    const status = await rawPost(
      '/agendar',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      'servico=corte-classico',
    );
    expect(status).toBe(411);
  });

  test('reagendar: horário que se sobrepõe ao atual aparece e funciona', async ({ page }) => {
    const slots = await freeSlots(page, DAY_OVERLAP);
    const oldSlot = slots[5];
    const overlap = new Date(new Date(oldSlot).getTime() + 15 * 60_000).toISOString();
    expect(slots).toContain(overlap);
    const token = await insertBooking(new Date(oldSlot));
    // Sobrepõe o próprio horário: só aparece porque o próprio busy_period é ignorado.
    await page.goto(`/agendamento/${token}/reagendar?data=${DAY_OVERLAP}`);
    await expect(page.locator(`input[name="startAt"][value="${overlap}"]`)).toHaveCount(1);
    await page.locator(`input[name="startAt"][value="${overlap}"]`).check({ force: true });
    const posted = page.waitForResponse((r) => r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirmar novo horário' }).click();
    expect((await posted).status()).toBe(303);
    await expect(page.getByText('Agendamento reagendado')).toBeVisible();
  });

  test('menos de 2 h: POST direto nas Actions responde 403 e mantém confirmed', async () => {
    // +100 min: < 2 h e sem sobrepor o agendamento de +60 min de outro teste (mesmo barbeiro).
    const token = await insertBooking(new Date(Date.now() + 100 * 60_000));
    const cancel = await postForm(`/agendamento/${token}?_action=cancelBooking`, { token });
    expect(cancel).toBe(403);
    const start = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const resched = await postForm(
      `/agendamento/${token}/reagendar?_action=rescheduleBooking&data=${DAY_OVERLAP}`,
      { token, startAt: start },
    );
    expect(resched).toBe(403);
    expect(await dbStatus(token)).toBe('confirmed');
  });

  test('token inexistente (20-100 caracteres): 404 nas Actions', async () => {
    const bad = 'z'.repeat(43);
    expect(await postForm(`/agendamento/${bad}?_action=cancelBooking`, { token: bad })).toBe(404);
    expect(
      await postForm(
        `/agendamento/${bad}/reagendar?_action=rescheduleBooking&data=${DAY_OVERLAP}`,
        {
          token: bad,
          startAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        },
      ),
    ).toBe(404);
  });

  test('CSRF: cross-site e Origin estranho recebem 403', async () => {
    const token = await insertBooking(new Date(Date.now() + 5 * 86_400_000));
    const path = `/agendamento/${token}?_action=cancelBooking`;
    expect(await postForm(path, { token }, { 'Sec-Fetch-Site': 'cross-site' })).toBe(403);
    expect(
      await postForm(path, { token }, { Origin: 'http://evil.example', 'Sec-Fetch-Site': '' }),
    ).toBe(403);
    expect(await dbStatus(token)).toBe('confirmed');
  });

  test('POST sem _action em /reagendar com corpo grande responde 200 (prova de não-leitura: TODO socket com Content-Length sem corpo)', async () => {
    // Horário irrelevante aqui; +25 dias evita colidir (EXCLUDE) com fixtures de outros testes.
    const token = await insertBooking(new Date(Date.now() + 25 * 86_400_000));
    const status = await postForm(`/agendamento/${token}/reagendar`, {
      data: DAY_OVERLAP,
      pad: 'a'.repeat(200_000),
    });
    expect(status).toBe(200);
  });
});
