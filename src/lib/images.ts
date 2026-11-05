import type { ImageMetadata } from 'astro';

const modules = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/**/*.{svg,jpg,jpeg,png,webp,avif}',
  { eager: true },
);

const stripExt = (p: string) => p.replace(/\.[a-z0-9]+$/i, '');

const index = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(modules)) {
  index.set(stripExt(path.replace('/src/assets/', '')), mod.default);
}

/**
 * Resolve uma imagem de src/assets por caminho relativo, ignorando a extensão:
 * trocar `barbers/x.svg` por `barbers/x.jpg` não exige mudar o código nem o business.ts.
 */
export function getAsset(path: string): ImageMetadata {
  const found = index.get(stripExt(path));
  if (!found) throw new Error(`Imagem não encontrada em src/assets: ${path}`);
  return found;
}
