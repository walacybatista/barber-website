import { expect, test } from '@playwright/test';

const SERVICE = 'corte-classico';

test.describe('header sem JS em 360px', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });

  test('lista de links fica em linha própria, abaixo do botão Agendar', async ({ page }) => {
    await page.goto('/');
    const button = await page.locator('header a[href="/agendar"]').first().boundingBox();
    const list = await page.locator('#menu-principal').boundingBox();
    expect(button).not.toBeNull();
    expect(list).not.toBeNull();
    expect(list!.y).toBeGreaterThanOrEqual(button!.y + button!.height - 1);
    expect(list!.width).toBeGreaterThan(300);
  });
});

test.describe('faixa de datas com JS', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('rola dentro de si e mostra o dia selecionado', async ({ page }) => {
    // Primeiro dia não-domingo bem à frente, para exigir rolagem.
    let day = '';
    for (let n = 20; n <= 30 && !day; n++) {
      const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
        new Date(Date.now() + n * 86_400_000),
      );
      const [y, m, d] = iso.split('-').map(Number);
      if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 0) day = iso;
    }
    await page.goto(`/agendar?servico=${SERVICE}&barbeiro=qualquer&data=${day}`);
    const strip = page.locator('[data-date-strip]');
    const overflow = await strip.evaluate((el) => ({
      client: el.clientWidth,
      scroll: el.scrollWidth,
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
    }));
    expect(overflow.scroll).toBeGreaterThan(overflow.client);
    expect(overflow.doc).toBeLessThanOrEqual(overflow.win);
    const box = await strip.boundingBox();
    const sel = await page.locator('[aria-current="date"]').boundingBox();
    expect(sel!.x).toBeGreaterThanOrEqual(box!.x - 1);
    expect(sel!.x + sel!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
  });
});
