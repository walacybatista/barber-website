import { expect, test } from '@playwright/test';

const SECTIONS = [
  'Serviços e preços',
  'Barbeiros',
  'Galeria',
  'Horário de funcionamento',
  'Onde estamos',
  'Redes sociais e contato',
];

test.describe('home', () => {
  test('responde 200 e tem todas as seções por heading/landmark', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toContainText('Barbearia fictícia');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('section#sobre h2')).toBeVisible();
    for (const name of SECTIONS) {
      await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('region', { name: 'Serviços e preços' })).toBeVisible();
    await expect(page.locator('#servicos article')).not.toHaveCount(0);
    await expect(page.locator('#servicos')).toContainText('R$');
  });

  test('link do WhatsApp usa wa.me', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('a[href^="https://wa.me/"]');
    expect(await links.count()).toBeGreaterThan(0);
    await expect(
      page.getByRole('link', { name: 'Falar no WhatsApp (abre em nova aba)' }).first(),
    ).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+/);
  });

  test('JSON-LD é JSON válido do tipo BarberShop', async ({ page }) => {
    await page.goto('/');
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const data = JSON.parse(raw ?? '');
    expect(data['@type']).toBe('BarberShop');
    expect(data.openingHoursSpecification.length).toBeGreaterThan(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/$/);
  });

  test('mapa: nenhuma requisição ao Google antes do clique; depois, o foco vai ao iframe', async ({
    page,
  }) => {
    const googleRequests: string[] = [];
    page.on('request', (req) => {
      const host = new URL(req.url()).hostname;
      if (host === 'google.com' || host.endsWith('.google.com')) googleRequests.push(req.url());
    });
    // Mock: o teste não depende da rede nem do Google.
    await page.route('**://maps.google.com/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>mapa</title><p>mapa mock</p>',
      }),
    );

    await page.goto('/');
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(googleRequests).toEqual([]);

    await page.getByRole('button', { name: 'Carregar mapa' }).click();
    const iframe = page.locator('iframe[title^="Mapa"]');
    await expect(iframe).toHaveCount(1);
    await expect(iframe).toBeFocused();
    await expect.poll(() => googleRequests.length).toBeGreaterThan(0);
  });

  test('noindex por padrão (ADR-009) no HTML e no robots.txt', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /');
    expect(robots).not.toContain('Allow: /');
  });

  test('todo link target=_blank tem rel com noopener', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('a[target="_blank"]');
    expect(await links.count()).toBeGreaterThan(0);
    const rels = await links.evaluateAll((els) => els.map((e) => e.getAttribute('rel')));
    for (const rel of rels) expect(rel).toContain('noopener');
  });

  test('skip link é o primeiro foco e leva ao conteúdo', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Ir para o conteúdo' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#conteudo$/);
  });

  test('/privacidade responde 200 com aviso de portfólio', async ({ page }) => {
    const response = await page.goto('/privacidade');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Política de Privacidade');
    await expect(page.getByRole('note')).toContainText('Projeto de portfólio');
  });

  test('robots.txt e sitemap.xml respondem', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain('Sitemap:');
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain('/privacidade');
  });
});

test.describe('sem JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 360, height: 740 } });

  test('navegação visível, sem botão de menu e mapa só com o link externo', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByRole('link', { name: 'Sobre' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Contato' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Carregar mapa' })).toBeHidden();
    await expect(page.locator('[data-map-facade]')).toBeHidden();
    await expect(page.getByRole('link', { name: /Abrir no Google Maps/ })).toBeVisible();
    await expect(page.locator('[data-header]')).toHaveCSS('position', 'static');
  });
});

test.describe('menu mobile (360px)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('abre, fecha pelo botão e com Esc devolvendo o foco; inert aplicado e removido', async ({
    page,
  }) => {
    await page.goto('/');
    const button = page.getByRole('button', { name: 'Menu' });
    const nav = page.getByRole('navigation', { name: 'Principal' });
    const main = page.locator('main');
    const footer = page.locator('footer');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(nav.getByRole('link', { name: 'Sobre' })).toBeHidden();
    await expect(main).not.toHaveAttribute('inert', /.*/);

    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(nav.getByRole('link', { name: 'Sobre' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Sobre' })).toBeFocused();
    await expect(main).toHaveAttribute('inert', '');
    await expect(footer).toHaveAttribute('inert', '');

    await button.click();
    await expect(nav.getByRole('link', { name: 'Sobre' })).toBeHidden();
    await expect(main).not.toHaveAttribute('inert', /.*/);
    await expect(footer).not.toHaveAttribute('inert', /.*/);

    await button.click();
    await expect(nav.getByRole('link', { name: 'Sobre' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(nav.getByRole('link', { name: 'Sobre' })).toBeHidden();
    await expect(button).toBeFocused();
    await expect(main).not.toHaveAttribute('inert', /.*/);
  });

  test('selecionar item fecha o menu', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'Galeria' })
      .click();
    await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

test.describe('sem rolagem horizontal', () => {
  for (const width of [360, 768, 1280]) {
    for (const path of ['/', '/privacidade']) {
      test(`${path} em ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        if (path === '/') {
          await testInfo.attach(`home-${width}`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png',
          });
        }
      });
    }
  }
});
