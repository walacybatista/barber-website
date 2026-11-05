import { expect, test, type Page } from '@playwright/test';

/**
 * Fluxo /agendar SEM JavaScript (ADR-010). Banco barber_e2e semeado pelo globalSetup (e esvaziado a
 * cada execução, inclusive o rate limit). Cada criação via Action consome 1 do limite de 10/h por IP;
 * esta suíte faz 4 criações. Telefones são distintos por teste (limite de 3 futuros por telefone).
 */
test.use({ javaScriptEnabled: false });

const BARBER = 'rafael-quintao';
const SERVICE = 'corte-classico';

/** Data local (America/Sao_Paulo) daqui a `offset` dias, pulando domingos (fechado). */
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
const DAY_HAPPY = openDay(3);
const DAY_CONFLICT = openDay(5) === DAY_HAPPY ? openDay(6) : openDay(5);
const DAY_CONSENT = openDay(8);

/** Próximo domingo (fechado) dentro dos 30 dias, em data local. */
function nextSunday(): string {
  for (let n = 1; n <= 30; n++) {
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
      new Date(Date.now() + n * 86_400_000),
    );
    const [y, m, day] = iso.split('-').map(Number);
    if (new Date(Date.UTC(y, m - 1, day)).getUTCDay() === 0) return iso;
  }
  throw new Error('sem domingo na janela');
}

const stepUrl = (data: string, hora?: string) =>
  `/agendar?servico=${SERVICE}&barbeiro=${BARBER}&data=${data}${hora ? `&hora=${encodeURIComponent(hora)}` : ''}`;

async function firstSlot(page: Page, data: string): Promise<string> {
  const response = await page.goto(stepUrl(data));
  expect(response?.status()).toBe(200);
  const value = await page.locator('input[name="hora"]').first().getAttribute('value');
  expect(value).toBeTruthy();
  return value!;
}

async function fillAndSubmit(page: Page, phone: string, opts: { consent?: boolean } = {}) {
  await page.getByLabel('Nome', { exact: true }).fill('Maria Souza');
  await page.getByLabel('Telefone (com DDD)').fill(phone);
  if (opts.consent !== false) await page.getByLabel(/Li e concordo/).check();
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
}

let token = '';

test.describe.serial('agendamento sem JS', () => {
  test('caminho feliz completo até a página do token', async ({ page }) => {
    await page.goto('/agendar');
    await expect(page.getByRole('heading', { name: 'Escolha o serviço' })).toBeVisible();
    await page.locator('label', { hasText: 'Corte clássico' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByRole('heading', { name: 'Escolha o barbeiro' })).toBeVisible();
    await page.locator('label', { hasText: 'Rafael Quintão' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByRole('heading', { name: 'Escolha data e horário' })).toBeVisible();
    await page.locator(`a[href*="data=${DAY_HAPPY}"]`).click();
    await expect(page.getByRole('group', { name: /Horários disponíveis/ })).toBeVisible();
    await page.locator('input[name="hora"]').first().check({ force: true });
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByRole('heading', { name: 'Seus dados' })).toBeVisible();
    const posted = page.waitForResponse((res) => res.request().method() === 'POST');
    await fillAndSubmit(page, '(11) 91234-5601');
    expect((await posted).status()).toBe(303);

    await expect(page).toHaveURL(/\/agendamento\/[A-Za-z0-9_-]{20,}\?novo=1$/);
    token = new URL(page.url()).pathname.split('/').pop()!;
    await expect(page.getByText('Agendamento confirmado!')).toBeVisible();
    await expect(page.getByText('Guarde este link')).toBeVisible();
    await expect(page.getByRole('link', { name: /Adicionar à agenda/ })).toBeVisible();
    await expect(page.getByText('Rafael Quintão')).toBeVisible();
    await expect(page.getByText('Maria', { exact: true })).toBeVisible();
    // Telefone nunca aparece na página pública.
    await expect(page.locator('body')).not.toContainText('91234');
  });

  test('página do token: noindex, no-referrer e no-store', async ({ page }) => {
    const response = await page.goto(`/agendamento/${token}`);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['referrer-policy']).toBe('no-referrer');
    expect(response?.headers()['cache-control']).toBe('no-store');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('sem scroll horizontal em cada passo e na página do token (360/768/1280)', async ({
    page,
  }) => {
    const hora = await firstSlot(page, DAY_HAPPY);
    const urls = [
      '/agendar',
      `/agendar?servico=${SERVICE}`,
      stepUrl(DAY_HAPPY),
      stepUrl(DAY_HAPPY, hora),
      `/agendamento/${token}`,
    ];
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

  test('download do .ics', async ({ request }) => {
    const res = await request.get(`/agendamento/${token}.ics`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/calendar');
    expect(res.headers()['content-disposition']).toContain('attachment');
    expect(res.headers()['cache-control']).toBe('no-store');
    const body = await res.text();
    expect(body).toContain('BEGIN:VCALENDAR\r\n');
    expect(body).toMatch(/DTSTART:\d{8}T\d{6}Z\r\n/);
    expect(body).toContain('SUMMARY:Corte clássico');
  });

  test('token inválido responde 404 (página e .ics)', async ({ page, request }) => {
    const bad = 'x'.repeat(43);
    const response = await page.goto(`/agendamento/${bad}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Agendamento não encontrado' })).toBeVisible();
    const ics = await request.get(`/agendamento/${bad}.ics`);
    expect(ics.status()).toBe(404);
  });

  test('horário reservado por outra pessoa: mensagem e dados preservados', async ({ browser }) => {
    const ctxA = await browser.newContext({ javaScriptEnabled: false });
    const ctxB = await browser.newContext({ javaScriptEnabled: false });
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    try {
      const hora = await firstSlot(a, DAY_CONFLICT);
      await a.goto(stepUrl(DAY_CONFLICT, hora));
      await b.goto(stepUrl(DAY_CONFLICT, hora));
      await expect(b.getByRole('heading', { name: 'Seus dados' })).toBeVisible();

      // A reserva primeiro.
      await fillAndSubmit(a, '11 91234-5602');
      await expect(a).toHaveURL(/\/agendamento\//);

      // B tenta o mesmo horário.
      await fillAndSubmit(b, '11 91234-5603');
      await expect(
        b.getByRole('alert').filter({ hasText: 'Esse horário acabou de ser reservado' }),
      ).toBeVisible();
      await expect(b.getByRole('heading', { name: 'Escolha data e horário' })).toBeVisible();
      await expect(b.getByText('seu nome e telefone foram mantidos')).toBeVisible();
      expect(b.url()).not.toMatch(/customerName|customerPhone/);

      // Escolhe outro horário: nome e telefone continuam preenchidos.
      await b.locator('input[name="hora"]').first().check({ force: true });
      await b.getByRole('button', { name: 'Continuar' }).click();
      await expect(b.getByLabel('Nome', { exact: true })).toHaveValue('Maria Souza');
      await expect(b.getByLabel('Telefone (com DDD)')).toHaveValue('11 91234-5603');
      expect(b.url()).not.toMatch(/customerName|customerPhone/);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('consentimento desmarcado mostra erro no campo', async ({ page }) => {
    const hora = await firstSlot(page, DAY_CONSENT);
    await page.goto(stepUrl(DAY_CONSENT, hora));
    await fillAndSubmit(page, '11 91234-5604', { consent: false });

    const consent = page.getByLabel(/Li e concordo/);
    await expect(consent).toHaveAttribute('aria-invalid', 'true');
    await expect(consent).toHaveAttribute('aria-describedby', 'campo-consentimento-erro');
    await expect(page.locator('#campo-consentimento-erro')).toHaveText(
      /Para agendar, precisamos do seu consentimento/,
    );
    await expect(page.getByRole('alert').filter({ hasText: 'Corrija 1 campo' })).toBeVisible();
    // Dados digitados continuam no formulário.
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Maria Souza');
  });

  test('parâmetros inválidos na URL não geram 500', async ({ page }) => {
    for (const url of [
      '/agendar?servico=nao-existe',
      '/agendar?servico=corte-classico&barbeiro=fantasma',
      `/agendar?servico=${SERVICE}&barbeiro=qualquer&data=2020-01-01`,
      `/agendar?servico=${SERVICE}&barbeiro=qualquer&data=2099-12-31&hora=lixo`,
      `/agendar?servico=${SERVICE}&barbeiro=qualquer&data=${DAY_HAPPY}&hora=2020-01-01T00:00:00.000Z`,
      '/agendar?passo=999&data=abc&hora=%00',
    ]) {
      const response = await page.goto(url);
      expect(response?.status(), url).toBeLessThan(500);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Agendar horário');
    }
    await page.goto('/agendar?servico=nao-existe');
    await expect(page.getByText('Não encontramos o serviço informado')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Escolha o serviço' })).toBeVisible();
  });

  test('nome com HTML aparece escapado (POST)', async ({ page }) => {
    const hora = await firstSlot(page, DAY_CONSENT);
    await page.goto(stepUrl(DAY_CONSENT, hora));
    const xss = '<script>alert(1)</script>';
    await page.getByLabel('Nome', { exact: true }).fill(xss);
    await page.getByLabel('Telefone (com DDD)').fill('11 91234-5605');
    await page.getByRole('button', { name: 'Confirmar agendamento' }).click(); // sem consentimento
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue(xss);
    await expect(page.locator('script', { hasText: 'alert(1)' })).toHaveCount(0);
    expect(page.url()).not.toContain('customerName');
  });

  test('data inexistente: sem 500 e com "data inválida"', async ({ page }) => {
    const response = await page.goto(stepUrl('2026-02-31'));
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByText(/Data inválida/)).toBeVisible();
    await expect(page.getByText(/fora do período/)).toHaveCount(0);
  });

  test('domingo fechado: aviso e nenhum horário', async ({ page }) => {
    const response = await page.goto(stepUrl(nextSunday()));
    expect(response?.status()).toBe(200);
    await expect(page.getByText('Não abrimos nesse dia')).toBeVisible();
    await expect(page.locator('input[name="hora"]')).toHaveCount(0);
  });

  test('CTAs de serviço e barbeiro pré-selecionam', async ({ page }) => {
    await page.goto(`/agendar?servico=${SERVICE}`);
    await expect(page.getByRole('heading', { name: 'Escolha o barbeiro' })).toBeVisible();
    await page.goto(`/agendar?barbeiro=${BARBER}`);
    await expect(page.getByRole('heading', { name: 'Escolha o serviço' })).toBeVisible();
    await expect(page.locator('input[name="barbeiro"][value="rafael-quintao"]')).toHaveCount(1);
    // WhatsApp flutuante oculto e header simplificado.
    await expect(page.locator('a.fixed[href^="https://wa.me"]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Voltar ao site' })).toBeVisible();
  });
});
