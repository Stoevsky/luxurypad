import type { LuxurySector } from "./luxury";

/**
 * Abstract textures generated for this project.
 *
 * Each depicts a MATERIAL — silk, aluminium, marble, gold leaf — never a brand,
 * product, logo or wordmark. That is the whole point: the luxury houses in
 * ./luxury.ts have no tokenized asset and have endorsed nothing, so the page
 * must evoke a category without borrowing a trademark.
 *
 * Decorative only. Every tile also states its sector in text, so nothing is
 * communicated by the image alone.
 *
 * Sectors with no companies get no entry rather than a placeholder — an unused
 * texture would be dead weight in the bundle. `tests/landing.test.ts` asserts
 * that every sector with an enabled company has artwork here.
 */
export const SECTOR_TEXTURES: Partial<Record<LuxurySector, string>> = {
  fashion: "/textures/fashion.webp",
  automotive: "/textures/automotive.webp",
  watches: "/textures/watches.webp",
  materials: "/textures/materials.webp",
  conglomerate: "/textures/conglomerate.webp",
  beauty: "/textures/beauty.webp",
  hospitality: "/textures/hospitality.webp",
};

export function sectorTexture(sector: LuxurySector): string | null {
  return SECTOR_TEXTURES[sector] ?? null;
}
