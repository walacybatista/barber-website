import { expect, test } from '@playwright/test';

// A barra de progresso (mobile) deve refletir etapa/total. Regressão: com 5 etapas o mapa de
// larguras caía no fallback e a barra aparecia 100% desde a etapa 1.
test.use({ viewport: { width: 360, height: 800 }, javaScriptEnabled: false });

async function progressRatio(page: import('@playwright/test').Page): Promise<number> {
  const bar = page.getByRole('progressbar', { name: 'Progresso do agendamento' });
  const outer = await bar.boundingBox();
  const inner = await bar.locator(':scope > *').first().boundingBox();
  if (!outer || !inner) throw new Error('barra de progresso não encontrada');
  return inner.width / outer.width;
}

test('barra de progresso proporcional à etapa no /agendar', async ({ page }) => {
  await page.goto('/agendar');
  const bar = page.getByRole('progressbar', { name: 'Progresso do agendamento' });
  const total = Number(await bar.getAttribute('aria-valuemax'));
  expect(Number(await bar.getAttribute('aria-valuenow'))).toBe(1);
  expect(await progressRatio(page)).toBeCloseTo(1 / total, 1);

  await page.goto('/agendar?servico=corte-classico');
  const step = Number(await bar.getAttribute('aria-valuenow'));
  expect(step).toBeGreaterThan(1);
  expect(await progressRatio(page)).toBeCloseTo(step / total, 1);
  expect(await progressRatio(page)).toBeLessThan(1);
});
